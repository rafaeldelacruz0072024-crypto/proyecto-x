-- NOVA Digital: una sola billetera operativa.
-- Wallet Bank financia ciclos, recibe depósitos/comisiones y procesa retiros.
-- credit_balance se conserva únicamente como columna heredada para evitar
-- romper integraciones antiguas, pero se consolida en wallet_balance y queda en 0.

create extension if not exists pgcrypto;

create table if not exists public.credit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(18,2) not null default 0,
  type text not null default 'ADMIN_ADJUSTMENT',
  description text,
  performed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.credit_logs
  add column if not exists balance_column text,
  add column if not exists reference_id text;

-- Consolidación única e idempotente de saldos heredados.
with legacy_balances as (
  select id, round(coalesce(credit_balance, 0), 2) as amount
  from public.profiles
  where coalesce(credit_balance, 0) > 0
), moved as (
  update public.profiles p
  set wallet_balance = coalesce(p.wallet_balance, 0) + l.amount,
      credit_balance = 0,
      updated_at = now()
  from legacy_balances l
  where p.id = l.id
  returning p.id, l.amount
)
insert into public.credit_logs (
  user_id, amount, type, description, performed_by, balance_column, reference_id
)
select
  id,
  amount,
  'WALLET_CONSOLIDATION',
  'Consolidación del balance heredado en Wallet Bank',
  null,
  'wallet_balance',
  'wallet_consolidation_' || id::text
from moved;

comment on column public.profiles.credit_balance is
  'LEGACY: saldo deprecado. NOVA Digital opera exclusivamente con wallet_balance.';

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

  if p_amount is null or p_amount <= 0 then
    raise exception 'Monto inválido';
  end if;

  select * into v_plan
  from public.plans
  where id = p_plan_id and status = 'active';

  if not found then raise exception 'Plan no disponible'; end if;
  if p_amount < v_plan.min_amount
     or (v_plan.max_amount is not null and p_amount > v_plan.max_amount) then
    raise exception 'Monto fuera de los límites del plan';
  end if;

  select coalesce(wallet_balance, 0) into v_balance
  from public.profiles
  where id = p_user_id and status = 'active'
  for update;

  if not found then raise exception 'Perfil no disponible'; end if;
  if v_balance < p_amount then
    raise exception 'Saldo insuficiente en Wallet Bank';
  end if;

  v_rate := round((v_plan.roi_min_percentage + random() *
    (v_plan.roi_max_percentage - v_plan.roi_min_percentage))::numeric, 3);

  update public.profiles
  set wallet_balance = wallet_balance - round(p_amount, 2),
      updated_at = now()
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

  insert into public.transactions (
    user_id, investment_id, type, amount, status, description, reference_id
  ) values (
    p_user_id,
    v_investment.id,
    'INVESTMENT_COST',
    -round(p_amount, 2),
    'COMPLETED',
    'Activación de ' || v_plan.name || ' desde Wallet Bank',
    v_investment.id::text
  );

  return jsonb_build_object(
    'success', true,
    'investment', to_jsonb(v_investment),
    'wallet_balance', v_balance - round(p_amount, 2)
  );
end;
$$;

create or replace function public.process_investment(
  p_user_id uuid,
  p_amount numeric,
  p_plan_id uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.process_investment(p_user_id, p_amount, p_plan_id);
$$;

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
    last_cycle_activation_on, is_referral_commission_paid
  ) values (
    p_user_id, p_plan_id, round(p_amount, 2), v_roi, 'ACTIVE',
    0, 0, current_date, v_matures, false, now(), current_date,
    current_date, not p_generate_commission
  ) returning id into v_id;

  insert into public.transactions (
    user_id, investment_id, type, amount, status, description, reference_id
  ) values (
    p_user_id, v_id, 'INVESTMENT', -round(p_amount, 2), 'COMPLETED',
    'Activación administrativa desde Wallet Bank · ' || v_plan.name,
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

-- Se mantiene la firma existente para compatibilidad con el ADMIN, pero se
-- rechaza cualquier destino distinto de Wallet Bank.
drop function if exists public.admin_adjust_balance(uuid, text, numeric, text);

create or replace function public.admin_adjust_balance(
  p_user_id uuid,
  p_balance_column text,
  p_amount numeric,
  p_description text default null,
  p_reference_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid := auth.uid();
  v_current numeric(18,2);
  v_new numeric(18,2);
  v_description text := coalesce(nullif(btrim(p_description), ''), 'Ajuste admin Wallet Bank');
  v_reference text := coalesce(nullif(btrim(p_reference_id), ''), 'admin_wallet_' || gen_random_uuid()::text);
  v_existing public.credit_logs%rowtype;
begin
  if v_admin_id is null or not exists (
    select 1 from public.profiles
    where id = v_admin_id and role in ('admin', 'sub-admin') and status = 'active'
  ) then
    raise exception 'No autorizado para ajustar balances';
  end if;

  if p_balance_column is distinct from 'wallet_balance' then
    raise exception 'NOVA Digital opera únicamente con Wallet Bank';
  end if;
  if p_user_id is null then raise exception 'Usuario objetivo requerido'; end if;
  if p_amount is null or p_amount = 0 then raise exception 'El monto debe ser distinto de cero'; end if;
  if abs(p_amount) > 5000 then raise exception 'El monto máximo por ajuste es 5000'; end if;

  select * into v_existing
  from public.credit_logs
  where reference_id = v_reference
  limit 1;
  if found then
    return jsonb_build_object(
      'success', true,
      'idempotent', true,
      'balance_column', 'wallet_balance',
      'new_balance', coalesce((select wallet_balance from public.profiles where id = p_user_id), 0),
      'reference_id', v_reference
    );
  end if;

  select coalesce(wallet_balance, 0) into v_current
  from public.profiles
  where id = p_user_id
  for update;
  if not found then raise exception 'Usuario objetivo no encontrado'; end if;

  v_new := v_current + round(p_amount, 2);
  if v_new < 0 then raise exception 'Fondos insuficientes en Wallet Bank'; end if;

  update public.profiles
  set wallet_balance = v_new, updated_at = now()
  where id = p_user_id;

  insert into public.credit_logs (
    user_id, amount, type, description, performed_by, balance_column, reference_id
  ) values (
    p_user_id, round(p_amount, 2), 'ADMIN_ADJUSTMENT', v_description,
    v_admin_id, 'wallet_balance', v_reference
  );

  insert into public.transactions (
    user_id, amount, type, status, description, reference_id, created_at
  ) values (
    p_user_id,
    round(p_amount, 2),
    case when p_amount > 0 then 'BONUS' else 'WITHDRAWAL' end,
    'COMPLETED',
    v_description,
    v_reference,
    now()
  );

  return jsonb_build_object(
    'success', true,
    'idempotent', false,
    'user_id', p_user_id,
    'balance_column', 'wallet_balance',
    'previous_balance', v_current,
    'new_balance', v_new,
    'amount', round(p_amount, 2),
    'reference_id', v_reference
  );
end;
$$;

revoke all on function public.process_investment(uuid, numeric, uuid) from public, anon;
revoke all on function public.admin_activate_investment(uuid, uuid, numeric, boolean) from public, anon;
revoke all on function public.admin_adjust_balance(uuid, text, numeric, text, text) from public, anon;
grant execute on function public.process_investment(uuid, numeric, uuid) to authenticated;
grant execute on function public.admin_activate_investment(uuid, uuid, numeric, boolean) to authenticated;
grant execute on function public.admin_adjust_balance(uuid, text, numeric, text, text) to authenticated;

notify pgrst, 'reload schema';
