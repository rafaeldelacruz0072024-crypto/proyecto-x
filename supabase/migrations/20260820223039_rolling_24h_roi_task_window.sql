-- NOVA Digital - ventana personal de 24 horas para las cuatro tareas ROI.
-- Cada usuario vuelve a tener acceso exactamente 24 horas despues de completar su 4/4.

create or replace function private.complete_roi_daily_task(
  p_user_id uuid,
  p_task_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

create or replace function public.complete_roi_daily_task(
  p_user_id uuid,
  p_task_code text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.complete_roi_daily_task(p_user_id, p_task_code);
$$;

revoke all on function private.complete_roi_daily_task(uuid, text) from public, anon;
grant execute on function private.complete_roi_daily_task(uuid, text) to authenticated;
revoke all on function public.complete_roi_daily_task(uuid, text) from public, anon;
grant execute on function public.complete_roi_daily_task(uuid, text) to authenticated;

comment on function public.complete_roi_daily_task(uuid, text) is
  'Completa una tarea ROI y aplica una ventana individual de 24 horas desde la finalizacion del 4/4.';
