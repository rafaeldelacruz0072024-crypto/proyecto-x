-- NOVA Digital: registro y cambio directo de wallet de retiro.
-- No requiere 2FA ni confirmacion por correo; solo una sesion autenticada.

create or replace function public.save_my_withdrawal_wallet(p_wallet text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_wallet text := btrim(coalesce(p_wallet, ''));
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if v_wallet !~ '^0x[0-9A-Fa-f]{40}$' then
    raise exception 'INVALID_BEP20_WALLET';
  end if;

  update public.profiles
  set withdrawal_wallet = v_wallet,
      withdrawal_wallet_confirmed_at = now(),
      updated_at = now()
  where id = v_user_id;

  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  return jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'withdrawal_wallet', v_wallet
  );
end;
$$;

revoke all on function public.save_my_withdrawal_wallet(text) from public, anon;
grant execute on function public.save_my_withdrawal_wallet(text) to authenticated;
