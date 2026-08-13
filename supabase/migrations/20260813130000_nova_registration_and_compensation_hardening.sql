-- NOVA Digital: registro inicial seguro y correcciones para las pruebas de compensación.
-- Esta migración no crea usuarios, inversiones, comisiones ni saldos.

alter table public.profiles
  add column if not exists country text,
  add column if not exists phone text,
  add column if not exists user_tag text;

-- El trigger de Auth entrega un código apto para compartir desde el inicio.
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
    'GK-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Las consultas pre-registro son booleanas: no exponen filas protegidas de profiles.
create or replace function public.validate_sponsor_code(p_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when upper(trim(coalesce(p_code, ''))) !~ '^GK-[A-Z0-9]{4,30}$' then false
    else exists (
      select 1
      from public.profiles
      where ref_code = upper(trim(p_code))
        and status = 'active'
    )
  end;
$$;

create or replace function public.check_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when trim(coalesce(p_username, '')) !~ '^[A-Za-z0-9_]{3,30}$' then false
    else not exists (
      select 1 from public.profiles where lower(username) = lower(trim(p_username))
    )
  end;
$$;

create or replace function public.check_email_in_auth(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users where lower(email) = lower(trim(coalesce(p_email, '')))
  );
$$;

create or replace function public.complete_registration(
  p_user_id uuid,
  p_username text,
  p_full_name text,
  p_email text,
  p_country text default null,
  p_phone text default null,
  p_ref_code text default null,
  p_sponsor_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sponsor_id uuid;
  v_ref_code text;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'No autorizado';
  end if;

  select id into v_sponsor_id
  from public.profiles
  where ref_code = upper(trim(coalesce(p_sponsor_code, '')))
    and status = 'active';

  if v_sponsor_id is null then
    return jsonb_build_object('success', false, 'error', 'Código de patrocinador inválido');
  end if;

  select ref_code into v_ref_code from public.profiles where id = p_user_id for update;
  if v_ref_code is null or v_ref_code !~ '^GK-[A-Z0-9]{4,30}$' then
    v_ref_code := 'GK-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  end if;

  update public.profiles
  set username = trim(p_username),
      full_name = nullif(trim(p_full_name), ''),
      email = lower(trim(p_email)),
      country = nullif(trim(p_country), ''),
      phone = nullif(trim(p_phone), ''),
      ref_code = v_ref_code,
      referred_by = v_sponsor_id,
      status = 'active',
      updated_at = now()
  where id = p_user_id;

  return jsonb_build_object('success', true, 'sponsor_id', v_sponsor_id, 'ref_code', v_ref_code);
exception when unique_violation then
  return jsonb_build_object('success', false, 'error', 'Usuario o código de referido ya existe');
end;
$$;

revoke all on function public.validate_sponsor_code(text) from public;
revoke all on function public.check_username_available(text) from public;
revoke all on function public.check_email_in_auth(text) from public;
revoke all on function public.complete_registration(uuid, text, text, text, text, text, text, text) from public;
grant execute on function public.validate_sponsor_code(text) to anon, authenticated;
grant execute on function public.check_username_available(text) to anon, authenticated;
grant execute on function public.check_email_in_auth(text) to anon, authenticated;
grant execute on function public.complete_registration(uuid, text, text, text, text, text, text, text) to authenticated;

-- Una inversión solo suma volumen binario al activarse por primera vez.
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
  if new.status <> 'ACTIVE' or (tg_op = 'UPDATE' and old.status = 'ACTIVE') then
    return new;
  end if;

  loop
    select placement_parent_id, leg_position into v_parent_id, v_side
    from public.binary_nodes where user_id = v_current_id;
    exit when v_parent_id is null;

    update public.binary_nodes
    set pending_left_volume = pending_left_volume + case when v_side = 'LEFT' then new.amount else 0 end,
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

drop trigger if exists tr_accumulate_binary_volume on public.investments;
create trigger tr_accumulate_binary_volume
after insert or update of status on public.investments
for each row execute function private.accumulate_binary_volume();
