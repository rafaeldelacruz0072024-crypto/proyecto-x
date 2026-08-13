-- NOVA Digital - Cuatro tareas diarias para activar el ROI.
-- El ROI solo se acredita al completar las cuatro tareas del dia habil.
-- Las tareas, las comisiones directa y binaria son modulos independientes.

create table if not exists public.roi_daily_task_completions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  task_day date not null,
  task_code text not null check (task_code in (
    'SYNC_NODE', 'VALIDATE_BLOCK', 'AUDIT_MEMPOOL', 'SIGN_CHECKPOINT'
  )),
  completed_at timestamptz not null default now(),
  primary key (user_id, task_day, task_code)
);

alter table public.roi_daily_task_completions enable row level security;

drop policy if exists roi_daily_tasks_select_own on public.roi_daily_task_completions;
create policy roi_daily_tasks_select_own
on public.roi_daily_task_completions for select to authenticated
using ((select auth.uid()) = user_id);

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
  v_today date := (now() at time zone 'America/Santo_Domingo')::date;
  v_completed integer;
  v_activation jsonb := jsonb_build_object('success', true, 'activated_contracts', 0);
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'No autorizado';
  end if;
  if extract(isodow from v_today) not between 1 and 5 then
    raise exception 'Las tareas ROI solo estan disponibles de lunes a viernes';
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

  insert into public.roi_daily_task_completions(user_id, task_day, task_code)
  values (p_user_id, v_today, p_task_code)
  on conflict (user_id, task_day, task_code) do nothing;

  select count(*) into v_completed
  from public.roi_daily_task_completions
  where user_id = p_user_id and task_day = v_today;

  if v_completed = 4 then
    v_activation := private.activate_daily_roi(p_user_id);
  end if;

  return jsonb_build_object(
    'success', true,
    'task_code', p_task_code,
    'completed_tasks', v_completed,
    'required_tasks', 4,
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

revoke all on table public.roi_daily_task_completions from public, anon;
grant select on public.roi_daily_task_completions to authenticated;
revoke all on function private.complete_roi_daily_task(uuid, text) from public, anon;
grant execute on function private.complete_roi_daily_task(uuid, text) to authenticated;
revoke all on function public.complete_roi_daily_task(uuid, text) from public, anon;
grant execute on function public.complete_roi_daily_task(uuid, text) to authenticated;

comment on table public.roi_daily_task_completions is
  'Cuatro tareas requeridas cada dia habil para activar el ROI. Si no se completan, no hay activacion y la Regla de Oro reinicia el ciclo en la proxima activacion.';
