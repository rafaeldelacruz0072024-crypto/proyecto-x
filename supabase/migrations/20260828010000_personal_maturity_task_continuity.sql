-- NOVA Digital - continuidad personal de tareas para ciclos con vencimiento.
-- DAILY conserva pago diario y capital flexible.
-- D10, D15 y D30 requieren 4/4 antes del mismo corte del siguiente dia habil.

alter table public.investments
  add column if not exists last_cycle_activation_at timestamptz;

create or replace function private.next_business_cutoff(p_completed_at timestamptz)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
declare
  v_cutoff timestamptz := p_completed_at + interval '24 hours';
begin
  while extract(isodow from (v_cutoff at time zone 'America/Santo_Domingo')::date) not between 1 and 5 loop
    v_cutoff := v_cutoff + interval '24 hours';
  end loop;
  return v_cutoff;
end;
$$;

update public.investments i
set last_cycle_activation_at = coalesce(
  (
    select max(c.completed_at)
    from public.roi_daily_task_completions c
    where c.user_id = i.user_id
      and c.task_day = i.last_cycle_activation_on
  ),
  i.last_cycle_activation_on::timestamp at time zone 'America/Santo_Domingo'
)
where i.status = 'ACTIVE'
  and i.last_cycle_activation_on is not null
  and i.last_cycle_activation_at is null;

create or replace function private.reset_expired_maturity_cycles()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_investment record;
  v_resets integer := 0;
  v_cutoff timestamptz;
begin
  for v_investment in
    select i.id, i.user_id, i.accumulated_earnings, i.last_cycle_activation_at
    from public.investments i
    join public.plans p on p.id = i.plan_id
    where i.status = 'ACTIVE'
      and p.payout_mode = 'maturity'
      and p.duration_business_days is not null
      and i.last_cycle_activation_at is not null
      and (i.business_days_elapsed > 0 or i.accumulated_earnings > 0)
    order by i.created_at
    for update of i
  loop
    v_cutoff := private.next_business_cutoff(v_investment.last_cycle_activation_at);
    if now() < v_cutoff then
      continue;
    end if;

    insert into public.transactions (
      user_id, investment_id, type, amount, status, description, reference_id
    ) values (
      v_investment.user_id,
      v_investment.id,
      'ROI_CYCLE_RESET',
      -v_investment.accumulated_earnings,
      'COMPLETED',
      'Ciclo reiniciado por no completar las 4 tareas antes del corte personal. Días y ROI pendiente eliminados; el capital permanece desplegado.',
      'personal_maturity_reset_' || v_investment.id::text || '_' || floor(extract(epoch from v_cutoff))::bigint::text
    );

    update public.investments
    set accumulated_earnings = 0,
        business_days_elapsed = 0,
        last_cycle_activation_on = null,
        last_cycle_activation_at = null,
        last_accrual_on = (now() at time zone 'America/Santo_Domingo')::date,
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
  v_now timestamptz := now();
  v_today date := (now() at time zone 'America/Santo_Domingo')::date;
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
       and v_inv.last_cycle_activation_at is not null
       and v_now >= private.next_business_cutoff(v_inv.last_cycle_activation_at) then
      insert into public.transactions (
        user_id, investment_id, type, amount, status, description, reference_id
      ) values (
        p_user_id, v_inv.id, 'ROI_CYCLE_RESET', -v_inv.accumulated_earnings,
        'COMPLETED',
        'Ciclo reiniciado por interrupción de las 4 tareas. Días y ROI pendiente eliminados; el capital permanece desplegado.',
        'personal_maturity_reset_' || v_inv.id::text || '_' || floor(extract(epoch from private.next_business_cutoff(v_inv.last_cycle_activation_at)))::bigint::text
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
        last_cycle_activation_at = v_now,
        last_accrual_on = v_today,
        cycle_started_on = case
          when v_plan.payout_mode = 'maturity' and (v_was_reset or last_cycle_activation_at is null)
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

revoke all on function private.next_business_cutoff(timestamptz) from public, anon, authenticated;
revoke all on function private.reset_expired_maturity_cycles() from public, anon, authenticated;

do $$
declare
  v_job_id bigint;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    for v_job_id in
      select jobid from cron.job where jobname in ('nova-maturity-continuity-cut', 'nova-personal-maturity-continuity')
    loop
      perform cron.unschedule(v_job_id);
    end loop;

    perform cron.schedule(
      'nova-personal-maturity-continuity',
      '*/5 * * * *',
      $job$select private.reset_expired_maturity_cycles();$job$
    );
  end if;
end;
$$;

comment on function private.reset_expired_maturity_cycles() is
  'Reinicia D10, D15 y D30 al vencer el corte personal sin 4/4. Elimina días y ROI pendiente, nunca el capital.';

notify pgrst, 'reload schema';
