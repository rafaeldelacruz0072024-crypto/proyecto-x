alter table public.investments add column tasks_available_at timestamptz;

create function private.set_nova_node_task_unlock()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'ACTIVE' and new.tasks_available_at is null
     and (tg_op = 'INSERT' or old.status is distinct from 'ACTIVE') then
    new.tasks_available_at := statement_timestamp() + interval '24 hours';
  end if;
  return new;
end;
$$;

create trigger set_nova_node_task_unlock
before insert or update of status on public.investments
for each row execute function private.set_nova_node_task_unlock();

CREATE OR REPLACE FUNCTION private.activate_daily_roi(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
      and coalesce(tasks_available_at, created_at + interval '24 hours') <= now()
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
$function$;

CREATE OR REPLACE FUNCTION private.activate_investment_roi(p_user_id uuid, p_investment_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    and coalesce(tasks_available_at, created_at + interval '24 hours') <= now()
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
$function$;

CREATE OR REPLACE FUNCTION private.complete_roi_cycle_task(p_user_id uuid, p_investment_id uuid, p_task_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  if exists (
    select 1 from public.investments
    where id = p_investment_id and user_id = p_user_id
      and coalesce(tasks_available_at, created_at + interval '24 hours') > now()
  ) then
    raise exception 'Las tareas estarán disponibles 24 horas después de activar el nodo';
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
$function$;

CREATE OR REPLACE FUNCTION private.complete_roi_daily_task(p_user_id uuid, p_task_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_task_day date := (now() at time zone 'America/Santo_Domingo')::date;
  v_completed integer;
  v_last_completed_at timestamptz;
  v_next_available_at timestamptz;
  v_activation jsonb := jsonb_build_object('success', true, 'activated_contracts', 0);
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'No autorizado';
  end if;

  if p_task_code not in ('SYNC_NODE', 'VALIDATE_BLOCK', 'AUDIT_MEMPOOL', 'SIGN_CHECKPOINT') then
    raise exception 'Tarea ROI no valida';
  end if;

  if not exists (
    select 1 from public.investments
    where user_id = p_user_id and status = 'ACTIVE'
      and coalesce(tasks_available_at, created_at + interval '24 hours') <= now()
  ) then
    raise exception 'Requiere al menos un contrato activo';
  end if;

  select max(completed_at)
    into v_last_completed_at
  from (
    select max(completed_at) as completed_at
    from public.roi_daily_task_completions
    where user_id = p_user_id
    group by task_day
    having count(distinct task_code) = 4
  ) completed_windows;

  if v_last_completed_at is not null then
    v_next_available_at := v_last_completed_at + interval '24 hours';
    if now() < v_next_available_at then
      raise exception 'La proxima calibracion estara disponible el %',
        to_char(v_next_available_at at time zone 'America/Santo_Domingo', 'YYYY-MM-DD HH24:MI:SS');
    end if;
  end if;

  insert into public.roi_daily_task_completions(user_id, task_day, task_code)
  values (p_user_id, v_task_day, p_task_code)
  on conflict (user_id, task_day, task_code) do nothing;

  select count(*) into v_completed
  from public.roi_daily_task_completions
  where user_id = p_user_id and task_day = v_task_day;

  if v_completed = 4 then
    select max(completed_at)
      into v_last_completed_at
    from public.roi_daily_task_completions
    where user_id = p_user_id and task_day = v_task_day;

    v_next_available_at := v_last_completed_at + interval '24 hours';
    v_activation := private.activate_daily_roi(p_user_id);
  end if;

  return jsonb_build_object(
    'success', true,
    'task_code', p_task_code,
    'completed_tasks', v_completed,
    'required_tasks', 4,
    'completed_at', case when v_completed = 4 then v_last_completed_at else null end,
    'next_available_at', case when v_completed = 4 then v_next_available_at else null end,
    'roi_activation', v_activation
  );
end;
$function$;

CREATE OR REPLACE FUNCTION private.run_nova_ia()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  subscriber record;
  cycle record;
  task text;
  previous_claim text := current_setting('request.jwt.claim.sub', true);
  previous_claims text := current_setting('request.jwt.claims', true);
  local_day date := (now() at time zone 'America/Santo_Domingo')::date;
begin
  if extract(isodow from local_day) not between 1 and 5 then return; end if;
  for subscriber in
    select s.user_id
    from public.nova_ia_subscriptions s join public.profiles p on p.id = s.user_id
    where p.status = 'active' and s.paid_until > now()
  loop
    begin

      -- Serialize cancellation and processing for this subscription.
      perform 1 from public.nova_ia_subscriptions
      where user_id = subscriber.user_id and paid_until > now() for update;
      if not found then continue; end if;

      perform set_config('request.jwt.claim.sub', subscriber.user_id::text, true);
      perform set_config('request.jwt.claims', jsonb_build_object('sub', subscriber.user_id, 'role', 'authenticated')::text, true);

      for cycle in
        select i.id
        from public.investments i
        where i.user_id = subscriber.user_id and i.status = 'ACTIVE'
          and coalesce(i.tasks_available_at, i.created_at + interval '24 hours') <= now()
          and i.last_cycle_activation_on is distinct from local_day
          and not exists (
            select 1 from public.roi_daily_task_completions c
            where c.investment_id = i.id and c.user_id = subscriber.user_id
            group by c.task_day
            having count(distinct c.task_code) = 4
              and now() < private.next_business_cutoff(max(c.completed_at))
          )
        order by i.id
      loop
        begin
          foreach task in array array['SYNC_NODE', 'VALIDATE_BLOCK', 'AUDIT_MEMPOOL', 'SIGN_CHECKPOINT']
          loop
            perform private.complete_roi_cycle_task(subscriber.user_id, cycle.id, task);
          end loop;
        exception when others then
          raise warning 'Nova IA: ciclo %, SQLSTATE %', cycle.id, sqlstate;
        end;
      end loop;
      perform set_config('request.jwt.claim.sub', coalesce(previous_claim, ''), true);
      perform set_config('request.jwt.claims', coalesce(previous_claims, ''), true);
    exception when others then
      raise warning 'Nova IA: suscripción %, SQLSTATE %', subscriber.user_id, sqlstate;
    end;
  end loop;
end;
$function$;
