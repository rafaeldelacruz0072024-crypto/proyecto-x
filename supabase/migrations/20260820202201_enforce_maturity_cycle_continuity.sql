-- NOVA Digital - continuidad obligatoria solo para ciclos con vencimiento.
-- DAILY paga cada dia y no pierde dias ni ganancias por una interrupcion.
-- D10, D15 y D30 vuelven a dia 0 y ROI pendiente 0 si falta un dia habil.

update public.plans
set description = case code
  when 'D10' then 'ROI variable de 0.6% a 0.8% diario durante 10 días hábiles consecutivos. Si no completas las 4 tareas un día hábil, los días y el ROI pendiente vuelven a cero. Capital y ROI se liberan al vencer.'
  when 'D15' then 'ROI variable de 1% a 1.3% diario durante 15 días hábiles consecutivos. Si no completas las 4 tareas un día hábil, los días y el ROI pendiente vuelven a cero. Capital y ROI se liberan al vencer.'
  when 'D30' then 'ROI variable de 1.6% a 2% diario durante 30 días hábiles consecutivos. Si no completas las 4 tareas un día hábil, los días y el ROI pendiente vuelven a cero. Capital y ROI se liberan al vencer.'
  else description
end,
updated_at = now()
where code in ('D10', 'D15', 'D30');

create or replace function private.reset_missed_maturity_cycles(
  p_check_day date default (now() at time zone 'America/Santo_Domingo')::date
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expected_previous date := private.previous_business_day(p_check_day);
  v_investment record;
  v_resets integer := 0;
begin
  for v_investment in
    select i.id, i.user_id, i.accumulated_earnings
    from public.investments i
    join public.plans p on p.id = i.plan_id
    where i.status = 'ACTIVE'
      and p.payout_mode = 'maturity'
      and p.duration_business_days is not null
      and (i.business_days_elapsed > 0 or i.accumulated_earnings > 0)
      and i.last_cycle_activation_on is distinct from v_expected_previous
    order by i.created_at
    for update of i
  loop
    insert into public.transactions (
      user_id, investment_id, type, amount, status, description, reference_id
    ) values (
      v_investment.user_id,
      v_investment.id,
      'ROI_CYCLE_RESET',
      -v_investment.accumulated_earnings,
      'COMPLETED',
      'Ciclo reiniciado por no completar las 4 tareas del día hábil. Días y ROI pendiente eliminados.',
      'maturity_reset_' || v_investment.id::text || '_' || p_check_day::text
    );

    update public.investments
    set accumulated_earnings = 0,
        business_days_elapsed = 0,
        last_cycle_activation_on = null,
        last_accrual_on = p_check_day,
        cycle_started_on = null,
        cycle_reset_count = cycle_reset_count + 1,
        matures_on = null
    where id = v_investment.id;

    v_resets := v_resets + 1;
  end loop;

  return v_resets;
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
  v_was_reset boolean;
  v_total_paid numeric(18,2) := 0;
  v_activated integer := 0;
  v_resets integer := 0;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'No autorizado';
  end if;
  if extract(isodow from v_today) not between 1 and 5 then
    raise exception 'La activación ROI solo está disponible de lunes a viernes';
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

    select * into v_plan from public.plans where id = v_inv.plan_id;
    v_pending_before := v_inv.accumulated_earnings;
    v_elapsed_before := v_inv.business_days_elapsed;
    v_was_reset := false;

    if v_plan.payout_mode = 'maturity'
       and v_inv.last_cycle_activation_on is not null
       and v_inv.last_cycle_activation_on <> v_expected_previous then
      insert into public.transactions (
        user_id, investment_id, type, amount, status, description, reference_id
      ) values (
        p_user_id, v_inv.id, 'ROI_CYCLE_RESET', -v_inv.accumulated_earnings,
        'COMPLETED',
        'Ciclo reiniciado por interrupción. Días y ROI pendiente eliminados.',
        'maturity_reset_' || v_inv.id::text || '_' || v_today::text
      );
      v_elapsed_before := 0;
      v_pending_before := 0;
      v_was_reset := true;
      v_resets := v_resets + 1;
    end if;

    v_earnings := round(v_inv.amount * (v_inv.assigned_roi_percentage / 100), 2);
    v_elapsed_after := v_elapsed_before + 1;

    if v_plan.payout_mode = 'daily' then
      update public.profiles
      set wallet_balance = wallet_balance + v_earnings, updated_at = now()
      where id = p_user_id;

      insert into public.transactions (
        user_id, investment_id, type, amount, status, description, reference_id
      ) values (
        p_user_id, v_inv.id, 'DAILY_RETURN', v_earnings, 'COMPLETED',
        'Activación diaria completada: ' || v_plan.name,
        'daily_return_' || v_inv.id::text || '_' || v_today::text
      );
      v_total_paid := v_total_paid + v_earnings;
    end if;

    update public.investments
    set accumulated_earnings = v_pending_before + v_earnings,
        business_days_elapsed = v_elapsed_after,
        last_cycle_activation_on = v_today,
        last_accrual_on = v_today,
        cycle_started_on = case
          when v_plan.payout_mode = 'maturity' and (v_was_reset or last_cycle_activation_on is null)
            then v_today
          else coalesce(cycle_started_on, v_today)
        end,
        cycle_reset_count = cycle_reset_count + case when v_was_reset then 1 else 0 end,
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

      insert into public.transactions (
        user_id, investment_id, type, amount, status, description, reference_id
      ) values (
        p_user_id, v_inv.id, 'MATURITY_PAYOUT',
        v_inv.amount + v_pending_before + v_earnings, 'COMPLETED',
        'Capital y ROI del ciclo liberados: ' || v_plan.name,
        'maturity_payout_' || v_inv.id::text
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

revoke all on function private.reset_missed_maturity_cycles(date) from public, anon, authenticated;

do $$
declare
  v_job_id bigint;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    for v_job_id in
      select jobid from cron.job where jobname = 'nova-maturity-continuity-cut'
    loop
      perform cron.unschedule(v_job_id);
    end loop;

    perform cron.schedule(
      'nova-maturity-continuity-cut',
      '0 4 * * *',
      $job$select private.reset_missed_maturity_cycles((now() at time zone 'America/Santo_Domingo')::date);$job$
    );
  end if;
end;
$$;

comment on function private.reset_missed_maturity_cycles(date) is
  'A las 00:00 de Santo Domingo reinicia solo ciclos con vencimiento que no completaron las cuatro tareas del día hábil anterior.';

notify pgrst, 'reload schema';
