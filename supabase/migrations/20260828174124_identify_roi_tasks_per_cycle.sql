-- NOVA Digital - tareas ROI identificadas por contrato/ciclo.
-- Cada inversión mantiene su propio 4/4, horario y bitácora.

alter table public.roi_daily_task_completions
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists investment_id uuid references public.investments(id) on delete cascade;

alter table public.roi_daily_task_completions
  drop constraint if exists roi_daily_task_completions_pkey;

update public.roi_daily_task_completions
set id = gen_random_uuid()
where id is null;

alter table public.roi_daily_task_completions
  alter column id set not null,
  add constraint roi_daily_task_completions_pkey primary key (id);

create unique index if not exists roi_tasks_cycle_day_code_uidx
  on public.roi_daily_task_completions(user_id, investment_id, task_day, task_code)
  where investment_id is not null;

create index if not exists roi_tasks_user_cycle_time_idx
  on public.roi_daily_task_completions(user_id, investment_id, completed_at desc);

create or replace function private.activate_investment_roi(
  p_user_id uuid,
  p_investment_id uuid
)
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
  v_was_reset boolean := false;
  v_paid numeric(18,2) := 0;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'No autorizado';
  end if;
  if extract(isodow from v_today) not between 1 and 5 then
    raise exception 'La activación ROI solo está disponible de lunes a viernes';
  end if;

  select * into v_inv
  from public.investments
  where id = p_investment_id
    and user_id = p_user_id
    and status = 'ACTIVE'
  for update;

  if not found then
    raise exception 'Contrato activo no encontrado';
  end if;

  select * into v_plan from public.plans where id = v_inv.plan_id;
  if v_inv.last_cycle_activation_on = v_today then
    return jsonb_build_object(
      'success', true,
      'activated_contracts', 0,
      'reset_contracts', 0,
      'total_paid', 0,
      'already_activated_today', true,
      'investment_id', v_inv.id,
      'cycle_identifier', 'NOVA-' || upper(substr(v_inv.id::text, 1, 8))
    );
  end if;

  v_pending_before := v_inv.accumulated_earnings;
  v_elapsed_before := v_inv.business_days_elapsed;

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
    v_paid := v_earnings;
  end if;

  update public.investments
  set accumulated_earnings = v_pending_before + v_earnings,
      business_days_elapsed = v_elapsed_after,
      last_cycle_activation_on = v_today,
      last_cycle_activation_at = v_now,
      last_accrual_on = v_today,
      cycle_started_on = case
        when v_plan.payout_mode = 'maturity' and (v_was_reset or v_inv.last_cycle_activation_at is null)
          then v_today
        else coalesce(v_inv.cycle_started_on, v_today)
      end,
      cycle_reset_count = v_inv.cycle_reset_count + case when v_was_reset then 1 else 0 end,
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
    v_paid := v_inv.amount + v_pending_before + v_earnings;
  end if;

  return jsonb_build_object(
    'success', true,
    'activated_contracts', 1,
    'reset_contracts', case when v_was_reset then 1 else 0 end,
    'total_paid', v_paid,
    'already_activated_today', false,
    'processed_on', v_today,
    'processed_at', v_now,
    'investment_id', v_inv.id,
    'cycle_identifier', 'NOVA-' || upper(substr(v_inv.id::text, 1, 8))
  );
end;
$$;

create or replace function private.complete_roi_cycle_task(
  p_user_id uuid,
  p_investment_id uuid,
  p_task_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/Santo_Domingo')::date;
  v_completed integer;
  v_completed_at timestamptz;
  v_previous_completed_at timestamptz;
  v_activation jsonb := jsonb_build_object('success', true, 'activated_contracts', 0);
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'No autorizado';
  end if;
  if extract(isodow from v_today) not between 1 and 5 then
    raise exception 'Las tareas ROI solo están disponibles de lunes a viernes';
  end if;
  if p_task_code not in ('SYNC_NODE', 'VALIDATE_BLOCK', 'AUDIT_MEMPOOL', 'SIGN_CHECKPOINT') then
    raise exception 'Tarea ROI no válida';
  end if;
  if not exists (
    select 1 from public.investments
    where id = p_investment_id and user_id = p_user_id and status = 'ACTIVE'
  ) then
    raise exception 'Contrato activo no encontrado';
  end if;

  select max(day_completion.completed_at) into v_previous_completed_at
  from (
    select task_day, max(completed_at) as completed_at
    from public.roi_daily_task_completions
    where user_id = p_user_id and investment_id = p_investment_id
    group by task_day
    having count(distinct task_code) = 4
  ) day_completion;

  if v_previous_completed_at is not null
     and now() < private.next_business_cutoff(v_previous_completed_at) then
    raise exception 'Este ciclo aún está dentro de su corte personal';
  end if;

  insert into public.roi_daily_task_completions(user_id, investment_id, task_day, task_code)
  values (p_user_id, p_investment_id, v_today, p_task_code)
  on conflict (user_id, investment_id, task_day, task_code)
    where investment_id is not null
  do update set completed_at = public.roi_daily_task_completions.completed_at
  returning completed_at into v_completed_at;

  select count(distinct task_code) into v_completed
  from public.roi_daily_task_completions
  where user_id = p_user_id
    and investment_id = p_investment_id
    and task_day = v_today;

  if v_completed = 4 then
    v_activation := private.activate_investment_roi(p_user_id, p_investment_id);
  end if;

  return jsonb_build_object(
    'success', true,
    'task_code', p_task_code,
    'completed_at', v_completed_at,
    'completed_tasks', v_completed,
    'required_tasks', 4,
    'investment_id', p_investment_id,
    'cycle_identifier', 'NOVA-' || upper(substr(p_investment_id::text, 1, 8)),
    'roi_activation', v_activation
  );
end;
$$;

create or replace function public.complete_roi_cycle_task(
  p_user_id uuid,
  p_investment_id uuid,
  p_task_code text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.complete_roi_cycle_task(p_user_id, p_investment_id, p_task_code);
$$;

revoke all on function private.activate_investment_roi(uuid, uuid) from public, anon, authenticated;
revoke all on function private.complete_roi_cycle_task(uuid, uuid, text) from public, anon, authenticated;
grant execute on function private.complete_roi_cycle_task(uuid, uuid, text) to authenticated;
revoke all on function public.complete_roi_cycle_task(uuid, uuid, text) from public, anon;
grant execute on function public.complete_roi_cycle_task(uuid, uuid, text) to authenticated;

comment on column public.roi_daily_task_completions.investment_id is
  'Contrato/ciclo específico al que pertenece la tarea diaria.';

comment on function public.complete_roi_cycle_task(uuid, uuid, text) is
  'Registra una tarea con hora exacta para un contrato y activa únicamente ese ciclo al completar 4/4.';

notify pgrst, 'reload schema';
