-- NOVA Digital compensation rule.
-- Future activations pay only a 10% direct referral commission.
-- A separate binary bonus pays 8% of the matched (smaller) leg every day at 00:00 America/Santo_Domingo.
-- Historical transactions are intentionally preserved for auditability.

create extension if not exists pg_cron;

-- Normal withdrawals: US$10 minimum, 0% fee and no time window by default.
update public.system_settings
set
  min_withdrawal = 10,
  withdrawal_fee = 0,
  withdrawal_window_enabled = false
where id = 1;

-- Disable the legacy 30-level residual triggers. The trigger names are shared by prior scripts.
drop trigger if exists tr_distribute_referral_commissions on public.investments;
drop trigger if exists tr_distribute_referral_commissions_insert on public.investments;

create or replace function private.pay_direct_referral_commission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sponsor_id uuid;
  v_commission numeric(18,2);
begin
  if new.status <> 'ACTIVE' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'ACTIVE' then
    return new;
  end if;

  if exists (
    select 1 from public.transactions
    where investment_id = new.id and type = 'REFERRAL_COMMISSION'
  ) then
    return new;
  end if;

  select referred_by into v_sponsor_id
  from public.profiles
  where id = new.user_id;

  if v_sponsor_id is null then
    return new;
  end if;

  v_commission := round(new.amount * 0.10, 2);

  insert into public.transactions (user_id, investment_id, type, amount, status, description)
  values (
    v_sponsor_id,
    new.id,
    'REFERRAL_COMMISSION',
    v_commission,
    'COMPLETED',
    'Indicación directa 10% por activación'
  );

  update public.profiles
  set wallet_balance = wallet_balance + v_commission,
      updated_at = now()
  where id = v_sponsor_id;

  return new;
end;
$$;

create trigger tr_pay_direct_referral_commission
after insert or update of status on public.investments
for each row
execute function private.pay_direct_referral_commission();

-- Binary tree. Placement is deterministic: first available position in breadth-first order.
create table if not exists public.binary_nodes (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  placement_parent_id uuid references public.profiles(id) on delete set null,
  leg_position text check (leg_position in ('LEFT', 'RIGHT')),
  pending_left_volume numeric(18,2) not null default 0 check (pending_left_volume >= 0),
  pending_right_volume numeric(18,2) not null default 0 check (pending_right_volume >= 0),
  lifetime_left_volume numeric(18,2) not null default 0,
  lifetime_right_volume numeric(18,2) not null default 0,
  lifetime_matched_volume numeric(18,2) not null default 0,
  lifetime_paid_bonus numeric(18,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (placement_parent_id, leg_position)
);

create table if not exists public.binary_payouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  cycle_day date not null,
  matched_volume numeric(18,2) not null,
  bonus_percent numeric(5,2) not null default 8 check (bonus_percent = 8),
  paid_bonus numeric(18,2) not null,
  left_carryover numeric(18,2) not null,
  right_carryover numeric(18,2) not null,
  status text not null default 'PAID' check (status in ('PAID', 'FAILED')),
  processed_at timestamptz not null default now(),
  unique (user_id, cycle_day)
);

alter table public.binary_nodes enable row level security;
alter table public.binary_payouts enable row level security;

create policy binary_nodes_select_own_or_admin on public.binary_nodes for select to authenticated
using (user_id = (select auth.uid()) or private.is_admin((select auth.uid())));
create policy binary_payouts_select_own_or_admin on public.binary_payouts for select to authenticated
using (user_id = (select auth.uid()) or private.is_admin((select auth.uid())));

create or replace function private.place_binary_node(p_user_id uuid, p_sponsor_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent_id uuid;
  v_side text;
begin
  if p_sponsor_id is null then
    insert into public.binary_nodes(user_id) values (p_user_id) on conflict (user_id) do nothing;
    return;
  end if;

  -- The first direct referral takes LEFT, the second takes RIGHT; later referrals fill the tree level by level.
  with recursive queue as (
    select n.user_id, 0 as depth from public.binary_nodes n where n.user_id = p_sponsor_id
    union all
    select child.user_id, queue.depth + 1
    from queue
    join public.binary_nodes child on child.placement_parent_id = queue.user_id
    where queue.depth < 20
  ), candidates as (
    select q.user_id,
           case
             when not exists (select 1 from public.binary_nodes c where c.placement_parent_id = q.user_id and c.leg_position = 'LEFT') then 'LEFT'
             when not exists (select 1 from public.binary_nodes c where c.placement_parent_id = q.user_id and c.leg_position = 'RIGHT') then 'RIGHT'
           end as side,
           q.depth
    from queue q
  )
  select user_id, side into v_parent_id, v_side
  from candidates
  where side is not null
  order by depth, case side when 'LEFT' then 1 else 2 end
  limit 1;

  if v_parent_id is null then
    raise exception 'No hay posición binaria disponible';
  end if;

  insert into public.binary_nodes(user_id, placement_parent_id, leg_position)
  values (p_user_id, v_parent_id, v_side)
  on conflict (user_id) do nothing;
end;
$$;

create or replace function private.assign_binary_node()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.place_binary_node(new.id, new.referred_by);
  return new;
end;
$$;

drop trigger if exists tr_assign_binary_node on public.profiles;
create trigger tr_assign_binary_node
after insert on public.profiles
for each row execute function private.assign_binary_node();

create or replace function private.accumulate_binary_volume()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_id uuid := new.user_id;
  v_parent_id uuid;
  v_side text;
begin
  loop
    select placement_parent_id, leg_position into v_parent_id, v_side
    from public.binary_nodes where user_id = v_current_id;
    exit when v_parent_id is null;

    update public.binary_nodes
    set
      pending_left_volume = pending_left_volume + case when v_side = 'LEFT' then new.amount else 0 end,
      pending_right_volume = pending_right_volume + case when v_side = 'RIGHT' then new.amount else 0 end,
      lifetime_left_volume = lifetime_left_volume + case when v_side = 'LEFT' then new.amount else 0 end,
      lifetime_right_volume = lifetime_right_volume + case when v_side = 'RIGHT' then new.amount else 0 end,
      updated_at = now()
    where user_id = v_parent_id;

    v_current_id := v_parent_id;
  end loop;
  return new;
end;
$$;

create trigger tr_accumulate_binary_volume
after insert or update of status on public.investments
for each row
execute function private.accumulate_binary_volume();

create or replace function private.process_binary_daily_cut(p_cycle_day date default (now() at time zone 'America/Santo_Domingo')::date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_node public.binary_nodes%rowtype;
  v_matched numeric(18,2);
  v_bonus numeric(18,2);
  v_processed integer := 0;
begin
  for v_node in select * from public.binary_nodes order by user_id for update loop
    v_matched := least(v_node.pending_left_volume, v_node.pending_right_volume);
    if v_matched <= 0 then continue; end if;

    insert into public.binary_payouts(user_id, cycle_day, matched_volume, paid_bonus, left_carryover, right_carryover)
    values (
      v_node.user_id, p_cycle_day, v_matched, round(v_matched * 0.08, 2),
      v_node.pending_left_volume - v_matched, v_node.pending_right_volume - v_matched
    ) on conflict (user_id, cycle_day) do nothing;

    if not found then continue; end if;
    v_bonus := round(v_matched * 0.08, 2);

    update public.binary_nodes
    set pending_left_volume = pending_left_volume - v_matched,
        pending_right_volume = pending_right_volume - v_matched,
        lifetime_matched_volume = lifetime_matched_volume + v_matched,
        lifetime_paid_bonus = lifetime_paid_bonus + v_bonus,
        updated_at = now()
    where user_id = v_node.user_id;

    update public.profiles set wallet_balance = wallet_balance + v_bonus, updated_at = now()
    where id = v_node.user_id;

    insert into public.transactions(user_id, type, amount, status, description)
    values (v_node.user_id, 'BINARY_BONUS', v_bonus, 'COMPLETED', 'Bono binario 8% · corte diario · pierna menor');

    v_processed := v_processed + 1;
  end loop;
  return v_processed;
end;
$$;

-- Supabase Cron uses UTC. Santo Domingo is UTC-4, so 04:00 UTC is midnight local time.
select cron.schedule(
  'nova-binary-daily-cut',
  '0 4 * * *',
  $$select private.process_binary_daily_cut((now() at time zone 'America/Santo_Domingo')::date);$$
);

revoke all on function private.pay_direct_referral_commission() from public, anon;
revoke all on function private.place_binary_node(uuid, uuid) from public, anon;
revoke all on function private.process_binary_daily_cut(date) from public, anon;
grant select on public.binary_nodes, public.binary_payouts to authenticated;
