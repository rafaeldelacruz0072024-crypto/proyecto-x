alter table public.investments add column exclude_referral_rewards boolean not null default false;

create or replace function public.admin_activate_investment(
  p_user_id uuid,
  p_plan_id uuid,
  p_amount numeric,
  p_generate_commission boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := auth.uid();
  v_plan public.plans%rowtype;
  v_profile public.profiles%rowtype;
  v_roi numeric;
  v_id uuid;
  v_matures date;
begin
  if p_generate_commission is null then raise exception 'Selecciona el modo de activación'; end if;
  if v_admin is null or not exists (
    select 1 from public.profiles
    where id = v_admin and role in ('admin', 'sub-admin') and status = 'active'
  ) then
    raise exception 'No autorizado';
  end if;

  select * into v_plan
  from public.plans
  where id = p_plan_id and status = 'active';
  if not found then raise exception 'Plan no disponible'; end if;

  if p_amount is null or p_amount < v_plan.min_amount
     or (v_plan.max_amount is not null and p_amount > v_plan.max_amount) then
    raise exception 'Monto fuera del rango del plan';
  end if;

  select * into v_profile
  from public.profiles
  where id = p_user_id
  for update;

  if not found or lower(coalesce(v_profile.status, '')) <> 'active' then
    raise exception 'Usuario no disponible';
  end if;
  if coalesce(v_profile.wallet_balance, 0) < p_amount then
    raise exception 'Saldo insuficiente en Wallet Bank';
  end if;

  v_roi := round(
    v_plan.roi_min_percentage
      + random() * (v_plan.roi_max_percentage - v_plan.roi_min_percentage),
    4
  );
  v_matures := case
    when v_plan.duration_business_days is null then null
    else private.add_business_days(current_date, v_plan.duration_business_days)
  end;

  update public.profiles
  set wallet_balance = wallet_balance - round(p_amount, 2),
      updated_at = now()
  where id = p_user_id;

  insert into public.investments (
    user_id, plan_id, amount, assigned_roi_percentage, status,
    accumulated_earnings, business_days_elapsed, last_accrual_on,
    matures_on, capital_returned, created_at, cycle_started_on,
    last_cycle_activation_on, is_referral_commission_paid, exclude_referral_rewards
  ) values (
    p_user_id, p_plan_id, round(p_amount, 2), v_roi, 'ACTIVE',
    0, 0, current_date, v_matures, false, now(), current_date,
    current_date, not p_generate_commission, not p_generate_commission
  ) returning id into v_id;

  insert into public.transactions (
    user_id, investment_id, type, amount, status, description, reference_id
  ) values (
    p_user_id, v_id, 'INVESTMENT', -round(p_amount, 2), 'COMPLETED',
    (case when p_generate_commission then 'Activación administrativa desde Wallet Bank · '
      else 'Activación administrativa sin comisión ni volumen binario · ' end) || v_plan.name,
    v_id::text
  );

  insert into public.credit_logs (
    user_id, amount, type, description, performed_by, balance_column, reference_id
  ) values (
    p_user_id, -round(p_amount, 2), 'INVESTMENT',
    'Activación de ciclo ' || v_plan.name, v_admin,
    'wallet_balance', v_id::text
  );

  return jsonb_build_object(
    'success', true,
    'investment_id', v_id,
    'assigned_roi_percentage', v_roi,
    'wallet_balance', v_profile.wallet_balance - round(p_amount, 2)
  );
end;
$$;

create or replace function private.accumulate_binary_volume()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  leg record;
begin
  if new.exclude_referral_rewards or upper(new.status) is distinct from 'ACTIVE' or not coalesce(new.amount > 0,false) then
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

create or replace function private.pay_direct_referral_commission()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  sponsor_id uuid;
  commission numeric(18,2);
begin
  if new.exclude_referral_rewards or upper(new.status) is distinct from 'ACTIVE' or coalesce(new.is_referral_commission_paid,false)
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
