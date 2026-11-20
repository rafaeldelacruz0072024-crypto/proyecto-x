-- Profiles already record the requested placement. Use that tree for both display and accounting.
drop trigger tr_assign_binary_node on public.profiles;

create table private.nova_binary_counted_investments (
  investment_id uuid primary key references public.investments(id) on delete cascade
);
alter table private.nova_binary_counted_investments enable row level security;
revoke all on private.nova_binary_counted_investments from public, anon, authenticated;

-- Legacy investments must not generate new volume merely by being reactivated.
lock table public.investments in share row exclusive mode;
insert into private.nova_binary_counted_investments
select id from public.investments where upper(status) in ('ACTIVE', 'COMPLETED');

create or replace function private.accumulate_binary_volume()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  leg record;
begin
  if upper(new.status) is distinct from 'ACTIVE' or not coalesce(new.amount > 0,false) then
    return new;
  end if;

  insert into private.nova_binary_counted_investments values (new.id) on conflict do nothing;
  if not found then return new; end if;

  for leg in
    with recursive lineage as (
      select p.id, p.binary_parent_id, p.binary_side, array[p.id] as path
      from public.profiles p where p.id = new.user_id
      union all
      select p.id, p.binary_parent_id, p.binary_side, l.path || p.id
      from lineage l join public.profiles p on p.id = l.binary_parent_id
      where not p.id = any(l.path)
    )
    select binary_parent_id as parent_id, binary_side as side from lineage
    where binary_parent_id is not null and not binary_parent_id = any(path)
      and binary_side in ('LEFT','RIGHT')
    order by binary_parent_id
  loop
    insert into public.binary_accounts(user_id,left_volume,right_volume)
    values (leg.parent_id,
      case when leg.side='LEFT' then new.amount else 0 end,
      case when leg.side='RIGHT' then new.amount else 0 end)
    on conflict (user_id) do update
    set left_volume = binary_accounts.left_volume + excluded.left_volume,
        right_volume = binary_accounts.right_volume + excluded.right_volume,
        updated_at = now();
  end loop;
  return new;
end;
$$;

create or replace function public.get_my_binary_summary()
returns jsonb language sql security definer set search_path = '' stable as $$
  select jsonb_build_object(
    'left_volume',coalesce(a.left_volume,0),
    'right_volume',coalesce(a.right_volume,0),
    'matched_available',least(coalesce(a.left_volume,0),coalesce(a.right_volume,0)),
    'estimated_commission',round(least(coalesce(a.left_volume,0),coalesce(a.right_volume,0))*0.08,2),
    'total_earned',coalesce(a.total_binary_earned,0),
    'last_cut_at',a.last_cut_at,
    'left_member',(select jsonb_build_object('username',p.username,'email',p.email) from public.profiles p where p.binary_parent_id=auth.uid() and p.binary_side='LEFT' limit 1),
    'right_member',(select jsonb_build_object('username',p.username,'email',p.email) from public.profiles p where p.binary_parent_id=auth.uid() and p.binary_side='RIGHT' limit 1),
    'recent_cuts',coalesce((select jsonb_agg(to_jsonb(x) order by x.cut_date desc)
      from (select cut_date,matched_volume,commission,left_carry,right_carry
        from public.binary_cuts where user_id=auth.uid() and matched_volume>0 order by cut_date desc limit 7)x),'[]'::jsonb)
  ) from (select 1) q left join public.binary_accounts a on a.user_id=auth.uid();
$$;

create or replace function public.get_my_binary_tree(p_max_depth integer default 6)
returns jsonb language sql security definer set search_path = '' stable as $$
  with recursive tree as (
    select p.id,p.binary_parent_id,p.binary_side,p.username,p.full_name,p.email,0 depth,array[p.id] path
    from public.profiles p where p.id=auth.uid()
    union all
    select p.id,p.binary_parent_id,p.binary_side,p.username,p.full_name,p.email,t.depth+1,t.path||p.id
    from tree t join public.profiles p on p.binary_parent_id=t.id
    where t.depth<greatest(1,least(coalesce(p_max_depth,6),12)) and not p.id=any(t.path)
  )
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'parent_id',binary_parent_id,'side',binary_side,'username',coalesce(username,full_name,split_part(email,'@',1),'Usuario'),'depth',depth) order by depth,username),'[]'::jsonb) from tree;
$$;

-- The root profile may reference itself. Only a distinct sponsor can earn a commission.
create or replace function private.pay_direct_referral_commission()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  sponsor_id uuid;
  commission numeric(18,2);
begin
  if upper(new.status) is distinct from 'ACTIVE' or coalesce(new.is_referral_commission_paid,false)
    or not coalesce(new.amount>0,false) then return new; end if;
  if tg_op='UPDATE' and upper(old.status)='ACTIVE' then return new; end if;
  if exists (select 1 from public.transactions where type='REFERRAL_COMMISSION'
       and (investment_id=new.id or reference_id=new.id::text)) then return new; end if;

  select referred_by into sponsor_id from public.profiles where id=new.user_id;
  if sponsor_id is null or sponsor_id=new.user_id then return new; end if;
  commission := round(new.amount*0.10,2);
  if commission<=0 then return new; end if;

  update public.profiles set wallet_balance=coalesce(wallet_balance,0)+commission,updated_at=now()
  where id=sponsor_id;
  insert into public.transactions(user_id,investment_id,type,amount,status,description,reference_id)
  values(sponsor_id,new.id,'REFERRAL_COMMISSION',commission,'COMPLETED','Indicación directa 10% por activación',new.id::text);
  update public.investments set is_referral_commission_paid=true where id=new.id;
  return new;
end;
$$;
