-- NOVA Digital - Regla de Oro de ciclos ROI.
-- Cada contrato requiere activacion del usuario todos los dias habiles.
-- Si se rompe la continuidad, el ROI pendiente y el contador del ciclo vuelven a cero.

alter table public.investments
  add column if not exists last_cycle_activation_on date,
  add column if not exists cycle_started_on date,
  add column if not exists cycle_reset_count integer not null default 0
    check (cycle_reset_count >= 0);

update public.plans
set
  name = 'Nodo Diario',
  description = 'ROI variable de 0.2% a 0.4% por cada dia habil activado.',
  roi_min_percentage = 0.2,
  roi_max_percentage = 0.4,
  duration_business_days = null,
  payout_mode = 'daily',
  capital_release_mode = 'on_close',
  display_order = 1,
  status = 'active',
  updated_at = now()
where code = 'DAILY';

update public.plans
set status = 'inactive', updated_at = now()
where code in ('D17', 'D33');

insert into public.plans (
  code, name, description, roi_min_percentage, roi_max_percentage,
  duration_business_days, payout_mode, capital_release_mode,
  min_amount, display_order, status
) values
  ('D10', 'Nodo 10 Dias', 'ROI variable de 0.6% a 0.8% diario durante 10 dias habiles consecutivos. Capital y ROI pendiente se liberan al vencer.', 0.6, 0.8, 10, 'maturity', 'maturity', 10, 2, 'active'),
  ('D15', 'Nodo 15 Dias', 'ROI variable de 1% a 1.3% diario durante 15 dias habiles consecutivos. Capital y ROI pendiente se liberan al vencer.', 1.0, 1.3, 15, 'maturity', 'maturity', 10, 3, 'active'),
  ('D30', 'Nodo 30 Dias', 'ROI variable de 1.6% a 2% diario durante 30 dias habiles consecutivos. Capital y ROI pendiente se liberan al vencer.', 1.6, 2.0, 30, 'maturity', 'maturity', 10, 4, 'active')
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
  status = excluded.status,
  updated_at = now();

create or replace function private.previous_business_day(p_day date)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_day date := p_day - 1;
begin
  while extract(isodow from v_day) not between 1 and 5 loop
    v_day := v_day - 1;
  end loop;
  return v_day;
end;
$$;

create or replace function private.activate_daily_roi(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/Santo_Domingo')::date;
  v_expected_previous date;
  v_inv public.investments%rowtype;
  v_plan public.plans%rowtype;
  v_earnings numeric(18,2);
  v_pending_before numeric(18,2);
  v_elapsed_before integer;
  v_elapsed_after integer;
  v_total_paid numeric(18,2) := 0;
  v_activated integer := 0;
  v_resets integer := 0;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'No autorizado';
  end if;
  if extract(isodow from v_today) not between 1 and 5 then
    raise exception 'La activacion ROI solo esta disponible de lunes a viernes';
  end if;

  v_expected_previous := private.previous_business_day(v_today);

  for v_inv in
    select * from public.investments
    where user_id = p_user_id and status = 'ACTIVE'
    order by created_at
    for update
  loop
    if v_inv.last_cycle_activation_on = v_today then
      continue;
    end if;

    select * into v_plan
    from public.plans
    where id = v_inv.plan_id;

    v_pending_before := v_inv.accumulated_earnings;
    v_elapsed_before := v_inv.business_days_elapsed;

    if v_inv.last_cycle_activation_on is not null
       and v_inv.last_cycle_activation_on <> v_expected_previous then
      v_elapsed_before := 0;
      if v_plan.payout_mode = 'maturity' then
        v_pending_before := 0;
      end if;
      v_resets := v_resets + 1;

      insert into public.transactions(user_id, investment_id, type, amount, description)
      values (
        p_user_id,
        v_inv.id,
        'ROI_CYCLE_RESET',
        case when v_plan.payout_mode = 'maturity' then -v_inv.accumulated_earnings else 0 end,
        'Ciclo reiniciado por interrupcion. ROI pendiente eliminado: ' ||
          round(case when v_plan.payout_mode = 'maturity' then v_inv.accumulated_earnings else 0 end, 2)
      );
    end if;

    v_earnings := round(v_inv.amount * (v_inv.assigned_roi_percentage / 100), 2);
    v_elapsed_after := v_elapsed_before + 1;

    if v_plan.payout_mode = 'daily' then
      update public.profiles
      set wallet_balance = wallet_balance + v_earnings, updated_at = now()
      where id = p_user_id;

      insert into public.transactions(user_id, investment_id, type, amount, description)
      values (p_user_id, v_inv.id, 'DAILY_RETURN', v_earnings,
        'Activacion diaria completada: ' || v_plan.name);

      v_total_paid := v_total_paid + v_earnings;
    end if;

    update public.investments
    set
      accumulated_earnings = v_pending_before + v_earnings,
      business_days_elapsed = v_elapsed_after,
      last_cycle_activation_on = v_today,
      last_accrual_on = v_today,
      cycle_started_on = case
        when last_cycle_activation_on is null or last_cycle_activation_on <> v_expected_previous
          then v_today
        else coalesce(cycle_started_on, v_today)
      end,
      cycle_reset_count = cycle_reset_count + case
        when last_cycle_activation_on is not null and last_cycle_activation_on <> v_expected_previous then 1
        else 0
      end,
      matures_on = case
        when v_plan.duration_business_days is null then null
        else private.add_business_days(v_today, greatest(v_plan.duration_business_days - v_elapsed_after, 0))
      end
    where id = v_inv.id;

    if v_plan.payout_mode = 'maturity'
       and v_elapsed_after >= v_plan.duration_business_days then
      update public.profiles
      set wallet_balance = wallet_balance + v_inv.amount + v_pending_before + v_earnings,
          updated_at = now()
      where id = p_user_id;

      update public.investments
      set status = 'COMPLETED', capital_returned = true, completed_at = now()
      where id = v_inv.id;

      insert into public.transactions(user_id, investment_id, type, amount, description)
      values (
        p_user_id,
        v_inv.id,
        'MATURITY_PAYOUT',
        v_inv.amount + v_pending_before + v_earnings,
        'Capital y ROI del ciclo liberados: ' || v_plan.name
      );

      v_total_paid := v_total_paid + v_inv.amount + v_pending_before + v_earnings;
    end if;

    v_activated := v_activated + 1;
  end loop;

  return jsonb_build_object(
    'success', true,
    'activated_contracts', v_activated,
    'reset_contracts', v_resets,
    'total_paid', v_total_paid,
    'already_activated_today', v_activated = 0,
    'processed_on', v_today
  );
end;
$$;

create or replace function private.collect_daily_passive(p_user_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.activate_daily_roi(p_user_id);
$$;

create or replace function public.activate_daily_roi(p_user_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.activate_daily_roi(p_user_id);
$$;

create or replace function public.collect_daily_passive(p_user_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.activate_daily_roi(p_user_id);
$$;

revoke all on function private.activate_daily_roi(uuid) from public, anon;
grant execute on function private.activate_daily_roi(uuid) to authenticated;
revoke all on function public.activate_daily_roi(uuid) from public, anon;
grant execute on function public.activate_daily_roi(uuid) to authenticated;

comment on function public.activate_daily_roi(uuid) is
  'Regla de Oro: activa todos los contratos del usuario para el dia habil actual y reinicia ciclos interrumpidos.';
