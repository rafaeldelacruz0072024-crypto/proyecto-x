-- Proyecto X: esquema financiero inicial sin usuarios ni datos historicos.
-- Los tres registros de plans son configuracion operativa del producto.

create extension if not exists pgcrypto;
create schema if not exists private;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  username text unique,
  role text not null default 'user' check (role in ('user', 'admin', 'sub-admin')),
  status text not null default 'active' check (status in ('active', 'inactive', 'suspended')),
  credit_balance numeric(18,2) not null default 0 check (credit_balance >= 0),
  wallet_balance numeric(18,2) not null default 0 check (wallet_balance >= 0),
  ref_code text unique,
  referred_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null,
  roi_min_percentage numeric(6,3) not null check (roi_min_percentage > 0),
  roi_max_percentage numeric(6,3) not null check (roi_max_percentage >= roi_min_percentage),
  duration_business_days integer check (duration_business_days is null or duration_business_days > 0),
  payout_mode text not null check (payout_mode in ('daily', 'maturity')),
  capital_release_mode text not null check (capital_release_mode in ('on_close', 'maturity')),
  min_amount numeric(18,2) not null default 10 check (min_amount >= 10),
  max_amount numeric(18,2) check (max_amount is null or max_amount >= min_amount),
  status text not null default 'active' check (status in ('active', 'inactive')),
  display_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (payout_mode = 'daily' and duration_business_days is null and capital_release_mode = 'on_close')
    or
    (payout_mode = 'maturity' and duration_business_days is not null and capital_release_mode = 'maturity')
  )
);

create table if not exists public.investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  plan_id uuid not null references public.plans(id) on delete restrict,
  amount numeric(18,2) not null check (amount >= 10),
  assigned_roi_percentage numeric(6,3) not null check (assigned_roi_percentage > 0),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'COMPLETED', 'CANCELLED')),
  accumulated_earnings numeric(18,2) not null default 0 check (accumulated_earnings >= 0),
  business_days_elapsed integer not null default 0 check (business_days_elapsed >= 0),
  last_accrual_on date not null,
  matures_on date,
  capital_returned boolean not null default false,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  investment_id uuid references public.investments(id) on delete set null,
  type text not null,
  amount numeric(18,2) not null,
  status text not null default 'COMPLETED',
  description text,
  created_at timestamptz not null default now()
);

create index if not exists investments_user_status_idx
  on public.investments(user_id, status, created_at desc);
create index if not exists transactions_user_created_idx
  on public.transactions(user_id, created_at desc);

insert into public.plans (
  code, name, description, roi_min_percentage, roi_max_percentage,
  duration_business_days, payout_mode, capital_release_mode, min_amount, display_order
) values
  ('DAILY', 'Nodo Diario', 'Rendimiento acreditado cada dia habil, sin plazo.', 0.3, 0.5, null, 'daily', 'on_close', 10, 1),
  ('D17', 'Nodo 17 Dias', 'Capital y ganancias se liberan al completar 17 dias habiles.', 0.7, 1.0, 17, 'maturity', 'maturity', 10, 2),
  ('D33', 'Nodo 33 Dias', 'Capital y ganancias se liberan al completar 33 dias habiles.', 1.2, 2.0, 33, 'maturity', 'maturity', 10, 3)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  roi_min_percentage = excluded.roi_min_percentage,
  roi_max_percentage = excluded.roi_max_percentage,
  duration_business_days = excluded.duration_business_days,
  payout_mode = excluded.payout_mode,
  capital_release_mode = excluded.capital_release_mode,
  min_amount = excluded.min_amount,
  display_order = excluded.display_order,
  updated_at = now();

create or replace function private.is_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = p_user_id and role in ('admin', 'sub-admin') and status = 'active'
  );
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles(id, email, full_name, username, ref_code)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'username', ''),
    upper(substr(replace(new.id::text, '-', ''), 1, 10))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.add_business_days(p_start date, p_days integer)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_date date := p_start;
  v_added integer := 0;
begin
  while v_added < p_days loop
    v_date := v_date + 1;
    if extract(isodow from v_date) between 1 and 5 then
      v_added := v_added + 1;
    end if;
  end loop;
  return v_date;
end;
$$;

create or replace function private.business_days_between(p_after date, p_through date)
returns integer
language sql
immutable
set search_path = ''
as $$
  select count(*)::integer
  from generate_series(p_after + 1, p_through, interval '1 day') d
  where extract(isodow from d) between 1 and 5;
$$;

create or replace function private.process_investment(
  p_user_id uuid,
  p_amount numeric,
  p_plan_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.plans%rowtype;
  v_balance numeric(18,2);
  v_rate numeric(6,3);
  v_today date := (now() at time zone 'America/Santo_Domingo')::date;
  v_investment public.investments%rowtype;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'No autorizado';
  end if;

  select * into v_plan from public.plans where id = p_plan_id and status = 'active';
  if not found then raise exception 'Plan no disponible'; end if;
  if p_amount < v_plan.min_amount or (v_plan.max_amount is not null and p_amount > v_plan.max_amount) then
    raise exception 'Monto fuera de los limites del plan';
  end if;

  select credit_balance into v_balance
  from public.profiles where id = p_user_id and status = 'active' for update;
  if not found then raise exception 'Perfil no disponible'; end if;
  if v_balance < p_amount then raise exception 'Balance de credito insuficiente'; end if;

  v_rate := round((v_plan.roi_min_percentage + random() *
    (v_plan.roi_max_percentage - v_plan.roi_min_percentage))::numeric, 3);

  update public.profiles
  set credit_balance = credit_balance - p_amount, updated_at = now()
  where id = p_user_id;

  insert into public.investments (
    user_id, plan_id, amount, assigned_roi_percentage,
    last_accrual_on, matures_on
  ) values (
    p_user_id, p_plan_id, round(p_amount, 2), v_rate,
    v_today,
    case when v_plan.duration_business_days is null then null
      else private.add_business_days(v_today, v_plan.duration_business_days) end
  ) returning * into v_investment;

  insert into public.transactions(user_id, investment_id, type, amount, description)
  values (p_user_id, v_investment.id, 'INVESTMENT_COST', -round(p_amount, 2),
    'Activacion de ' || v_plan.name);

  return jsonb_build_object('success', true, 'investment', to_jsonb(v_investment));
end;
$$;

create or replace function private.collect_daily_passive(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/Santo_Domingo')::date;
  v_inv public.investments%rowtype;
  v_plan public.plans%rowtype;
  v_days integer;
  v_remaining integer;
  v_earnings numeric(18,2);
  v_total_credit numeric(18,2) := 0;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'No autorizado';
  end if;

  for v_inv in
    select * from public.investments
    where user_id = p_user_id and status = 'ACTIVE'
    order by created_at for update
  loop
    select * into v_plan from public.plans where id = v_inv.plan_id;
    v_days := private.business_days_between(v_inv.last_accrual_on, v_today);
    if v_days <= 0 then continue; end if;

    if v_plan.duration_business_days is not null then
      v_remaining := greatest(v_plan.duration_business_days - v_inv.business_days_elapsed, 0);
      v_days := least(v_days, v_remaining);
    end if;
    if v_days <= 0 then continue; end if;

    v_earnings := round(v_inv.amount * (v_inv.assigned_roi_percentage / 100) * v_days, 2);

    if v_plan.payout_mode = 'daily' then
      update public.profiles set wallet_balance = wallet_balance + v_earnings, updated_at = now()
      where id = p_user_id;
      v_total_credit := v_total_credit + v_earnings;
      insert into public.transactions(user_id, investment_id, type, amount, description)
      values (p_user_id, v_inv.id, 'DAILY_RETURN', v_earnings,
        v_days || ' dia(s) habil(es) de ' || v_plan.name);
    end if;

    update public.investments
    set accumulated_earnings = accumulated_earnings + v_earnings,
        business_days_elapsed = business_days_elapsed + v_days,
        last_accrual_on = private.add_business_days(last_accrual_on, v_days)
    where id = v_inv.id;

    if v_plan.payout_mode = 'maturity'
       and v_inv.business_days_elapsed + v_days >= v_plan.duration_business_days then
      update public.profiles
      set wallet_balance = wallet_balance + v_inv.amount + v_inv.accumulated_earnings + v_earnings,
          updated_at = now()
      where id = p_user_id;
      v_total_credit := v_total_credit + v_inv.amount + v_inv.accumulated_earnings + v_earnings;
      update public.investments
      set status = 'COMPLETED', capital_returned = true, completed_at = now()
      where id = v_inv.id;
      insert into public.transactions(user_id, investment_id, type, amount, description)
      values (p_user_id, v_inv.id, 'MATURITY_PAYOUT',
        v_inv.amount + v_inv.accumulated_earnings + v_earnings,
        'Capital y ganancias liberados: ' || v_plan.name);
    end if;
  end loop;

  return jsonb_build_object('success', true, 'credited', v_total_credit, 'processed_on', v_today);
end;
$$;

create or replace function public.process_investment(p_user_id uuid, p_amount numeric, p_plan_id uuid)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.process_investment(p_user_id, p_amount, p_plan_id); $$;

create or replace function public.collect_daily_passive(p_user_id uuid)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.collect_daily_passive(p_user_id); $$;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
revoke all on all functions in schema private from public, anon;
grant execute on function private.process_investment(uuid, numeric, uuid) to authenticated;
grant execute on function private.collect_daily_passive(uuid) to authenticated;
revoke all on function public.process_investment(uuid, numeric, uuid) from public, anon;
revoke all on function public.collect_daily_passive(uuid) from public, anon;
grant execute on function public.process_investment(uuid, numeric, uuid) to authenticated;
grant execute on function public.collect_daily_passive(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.investments enable row level security;
alter table public.transactions enable row level security;

create policy profiles_select_own_or_admin on public.profiles for select to authenticated
using ((select auth.uid()) = id or private.is_admin((select auth.uid())));
create policy plans_read_active on public.plans for select to authenticated
using (status = 'active' or private.is_admin((select auth.uid())));
create policy plans_admin_write on public.plans for all to authenticated
using (private.is_admin((select auth.uid()))) with check (private.is_admin((select auth.uid())));
create policy investments_select_own_or_admin on public.investments for select to authenticated
using ((select auth.uid()) = user_id or private.is_admin((select auth.uid())));
create policy transactions_select_own_or_admin on public.transactions for select to authenticated
using ((select auth.uid()) = user_id or private.is_admin((select auth.uid())));

grant select on public.plans to authenticated;
grant select on public.profiles, public.investments, public.transactions to authenticated;
grant insert, update, delete on public.plans to authenticated;
