-- NOVA Digital: enlaces de referido, indicacion directa y binario.
-- La indicacion directa se conserva fuera del saldo ROI/wallet y el binario
-- mantiene su propio volumen y corte diario.

alter table public.profiles
  add column if not exists referral_commission_balance numeric(18,2) not null default 0;

-- Garantiza un codigo utilizable para el usuario autenticado. La funcion no
-- expone perfiles ajenos y conserva el codigo actual si ya existe.
create or replace function public.ensure_my_ref_code()
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_code text;
begin
  if v_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  select ref_code into v_code from public.profiles where id = v_user_id for update;
  if v_code is not null and btrim(v_code) <> '' then
    return upper(v_code);
  end if;

  loop
    v_code := 'GK-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    begin
      update public.profiles
      set ref_code = v_code, updated_at = now()
      where id = v_user_id and (ref_code is null or btrim(ref_code) = '');
      exit;
    exception when unique_violation then
      -- Reintenta con un codigo nuevo sin confiar en una consulta del cliente.
    end;
  end loop;

  select ref_code into v_code from public.profiles where id = v_user_id;
  if v_code is null then
    raise exception 'No se pudo generar el codigo de referido';
  end if;
  return upper(v_code);
end $$;

revoke all on function public.ensure_my_ref_code() from public, anon;
grant execute on function public.ensure_my_ref_code() to authenticated;

-- Un solo bono directo: 10% de la activacion, acreditado en un saldo exclusivo.
create or replace function public.distribute_residual_commissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sponsor uuid;
  v_bonus numeric;
  v_name text;
begin
  if new.status <> 'ACTIVE' or coalesce(new.is_referral_commission_paid, false) then
    return new;
  end if;
  if exists (select 1 from public.transactions where reference_id = new.id and type = 'REFERRAL_COMMISSION') then
    update public.investments set is_referral_commission_paid = true where id = new.id;
    return new;
  end if;

  select referred_by, coalesce(full_name, username, email)
    into v_sponsor, v_name
  from public.profiles
  where id = new.user_id;

  if v_sponsor is not null then
    v_bonus := round(new.amount * 0.10, 2);
    update public.profiles
    set referral_commission_balance = coalesce(referral_commission_balance, 0) + v_bonus,
        updated_at = now()
    where id = v_sponsor;
    insert into public.transactions(user_id, amount, type, status, description, reference_id, created_at)
    values (v_sponsor, v_bonus, 'REFERRAL_COMMISSION', 'COMPLETED',
      'Indicación directa 10% por activación de ' || coalesce(v_name, 'referido'), new.id, now());
  end if;

  update public.investments set is_referral_commission_paid = true where id = new.id;
  return new;
end $$;

revoke execute on function public.distribute_residual_commissions() from public, anon, authenticated;

-- La comision directa se retira independientemente de ROI y del binario.
create or replace function public.withdraw_direct_commission(
  p_user_id uuid,
  p_amount numeric,
  p_method text,
  p_wallet_address text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_withdrawal_id uuid := gen_random_uuid();
begin
  if auth.uid() is distinct from p_user_id then
    return jsonb_build_object('success', false, 'error', 'Usuario no autorizado');
  end if;
  if coalesce(p_amount, 0) <= 0 then
    return jsonb_build_object('success', false, 'error', 'El monto debe ser mayor que cero');
  end if;
  if coalesce(btrim(p_wallet_address), '') = '' then
    return jsonb_build_object('success', false, 'error', 'Configura una billetera de retiro');
  end if;

  update public.profiles
  set referral_commission_balance = referral_commission_balance - p_amount,
      updated_at = now()
  where id = p_user_id
    and coalesce(referral_commission_balance, 0) >= p_amount;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Saldo de indicación directa insuficiente');
  end if;

  insert into public.withdrawals(id, user_id, amount, fee, net_amount, method, wallet_address, status, created_at)
  values (v_withdrawal_id, p_user_id, p_amount, 0, p_amount,
    coalesce(nullif(btrim(p_method), ''), 'COMISIÓN DIRECTA'), p_wallet_address, 'PENDING', now());
  insert into public.transactions(user_id, amount, type, status, description, created_at)
  values (p_user_id, -p_amount, 'WITHDRAWAL', 'PENDING',
    'Retiro de indicación directa 10% (sin restricción de día)', now());

  return jsonb_build_object('success', true, 'withdrawal_id', v_withdrawal_id, 'amount', p_amount, 'fee', 0, 'net_amount', p_amount);
end $$;

revoke all on function public.withdraw_direct_commission(uuid, numeric, text, text) from public, anon;
grant execute on function public.withdraw_direct_commission(uuid, numeric, text, text) to authenticated;
