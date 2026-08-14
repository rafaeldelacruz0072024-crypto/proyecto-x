-- The ROOT is the binary tree anchor and must never be its own sponsor or
-- binary child. This removes a corrupted self-reference that blocked placement.
update public.profiles
set referred_by = null,
    binary_parent_id = null,
    binary_side = null,
    binary_registered_at = null,
    updated_at = now()
where ref_code = 'GK-NOVA-ROOT'
  and (referred_by = id or binary_parent_id = id);

-- Create the initial profile and its binary placement from trusted Auth
-- metadata. This runs within the Auth transaction, so a user who must confirm
-- email is still correctly linked before a browser session is available.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sponsor_id uuid;
  v_parent_id uuid;
  v_side text := upper(coalesce(nullif(trim(new.raw_user_meta_data ->> 'binary_side'), ''), 'LEFT'));
  v_sponsor_code text := upper(trim(coalesce(new.raw_user_meta_data ->> 'sponsor_code', '')));
begin
  if v_side not in ('LEFT', 'RIGHT') then
    v_side := 'LEFT';
  end if;

  select id into v_sponsor_id
  from public.profiles
  where ref_code = v_sponsor_code and status = 'active'
  limit 1;

  if v_sponsor_id is null then
    select default_sponsor_id into v_sponsor_id from public.system_settings limit 1;
  end if;

  if v_sponsor_id is not null then
    select public.find_binary_position(v_sponsor_id, v_side) into v_parent_id;
  end if;

  insert into public.profiles(
    id, email, full_name, username, ref_code, referred_by,
    binary_parent_id, binary_side, binary_registered_at, role, status
  )
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'username', ''),
    'GK-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
    v_sponsor_id,
    v_parent_id,
    case when v_sponsor_id is null then null else v_side end,
    case when v_sponsor_id is null then null else now() end,
    'user',
    'active'
  )
  on conflict (id) do nothing;
  insert into public.binary_accounts(user_id) values(new.id) on conflict do nothing;
  return new;
end;
$$;

-- Repair a registration that was created before its authenticated completion
-- RPC ran. This preserves the existing Auth account and assigns the next open
-- slot on the requested branch.
create or replace function public.repair_pending_registration(
  p_user_id uuid,
  p_sponsor_code text,
  p_binary_side text default 'LEFT'
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_sponsor_id uuid;
  v_parent_id uuid;
  v_side text := upper(coalesce(nullif(trim(p_binary_side), ''), 'LEFT'));
begin
  if auth.uid() is distinct from p_user_id then
    return jsonb_build_object('success', false, 'error', 'Usuario no autorizado');
  end if;
  if v_side not in ('LEFT', 'RIGHT') then
    return jsonb_build_object('success', false, 'error', 'Pierna invalida');
  end if;

  select id into v_sponsor_id
  from public.profiles
  where ref_code = upper(trim(p_sponsor_code)) and status = 'active'
  limit 1;
  if v_sponsor_id is null then
    return jsonb_build_object('success', false, 'error', 'Patrocinador no valido');
  end if;

  select public.find_binary_position(v_sponsor_id, v_side) into v_parent_id;

  update public.profiles
  set referred_by = coalesce(referred_by, v_sponsor_id),
      binary_parent_id = coalesce(binary_parent_id, v_parent_id),
      binary_side = coalesce(binary_side, v_side),
      binary_registered_at = coalesce(binary_registered_at, now()),
      updated_at = now()
  where id = p_user_id;

  insert into public.binary_accounts(user_id) values(p_user_id)
  on conflict do nothing;

  return jsonb_build_object('success', true, 'sponsor_id', v_sponsor_id, 'binary_parent_id', v_parent_id, 'binary_side', v_side);
exception
  when unique_violation then
    return jsonb_build_object('success', false, 'error', 'La posicion binaria cambio. Intenta nuevamente.');
  when others then
    return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;

revoke all on function public.repair_pending_registration(uuid, text, text) from public, anon;
grant execute on function public.repair_pending_registration(uuid, text, text) to authenticated;
