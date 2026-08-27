-- NOVA: una sola Wallet Bank y confirmación de dirección por correo.
-- La dirección de retiro no se escribe desde el navegador: se confirma desde un enlace de un solo uso.

create table if not exists public.wallet_confirmation_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  wallet_address text not null check (wallet_address ~* '^0x[0-9a-f]{40}$'),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.withdrawal_confirmation_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  withdrawal_id uuid not null references public.withdrawals(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (withdrawal_id)
);

alter table public.profiles add column if not exists withdrawal_wallet_confirmed_at timestamptz;

alter table public.wallet_confirmation_requests enable row level security;
alter table public.withdrawal_confirmation_requests enable row level security;
revoke all on public.wallet_confirmation_requests from anon, authenticated;
revoke all on public.withdrawal_confirmation_requests from anon, authenticated;

-- Elimina el saldo heredado separado y lo concentra en Wallet Bank.
update public.profiles
set wallet_balance = coalesce(wallet_balance, 0) + coalesce(referral_commission_balance, 0),
    referral_commission_balance = 0
where coalesce(referral_commission_balance, 0) <> 0;

-- Las nuevas indicaciones directas acreditan la única Wallet Bank, igual que el binario.
create or replace function public.distribute_residual_commissions()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_sponsor_id uuid;
  v_bonus numeric;
begin
  select referred_by into v_sponsor_id from public.profiles where id = new.user_id;
  if v_sponsor_id is null then return new; end if;
  v_bonus := round(new.amount * 0.10, 2);
  if v_bonus <= 0 then return new; end if;
  update public.profiles
    set wallet_balance = coalesce(wallet_balance, 0) + v_bonus
    where id = v_sponsor_id;
  insert into public.transactions(user_id, type, amount, status, description, created_at)
    values (v_sponsor_id, 'REFERRAL_COMMISSION', v_bonus, 'COMPLETED',
      'Indicación directa 10% · acreditada a Wallet Bank', now());
  return new;
end;
$$;

-- La UI sólo permite crear retiros usando withdrawal_wallet. La función de retiro
-- existente debe validar esa misma igualdad antes de activarse en producción.

-- Reserva Wallet Bank mediante el RPC existente, pero no deja el retiro visible
-- para pago hasta que el usuario confirme el correo. Así se evita doble gasto.
create or replace function public.request_withdrawal_email_confirmation(p_amount numeric, p_method text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_wallet text;
  v_wallet_confirmed_at timestamptz;
  v_result json;
  v_withdrawal_id uuid;
  v_request_id uuid;
begin
  if v_user_id is null then return json_build_object('success', false, 'error', 'No autorizado.'); end if;
  select withdrawal_wallet, withdrawal_wallet_confirmed_at
    into v_wallet, v_wallet_confirmed_at
    from public.profiles
    where id = v_user_id;
  if v_wallet is null or v_wallet_confirmed_at is null then
    return json_build_object('success', false, 'error', 'Confirma primero tu dirección BEP-20 por correo.');
  end if;
  v_result := public.create_withdrawal_request(v_user_id, p_amount, p_method, v_wallet, false);
  if coalesce((v_result->>'success')::boolean, false) = false then return v_result; end if;
  v_withdrawal_id := (v_result->>'withdrawal_id')::uuid;
  update public.withdrawals set status = 'EMAIL_CONFIRMATION_PENDING' where id = v_withdrawal_id;
  insert into public.withdrawal_confirmation_requests(user_id, withdrawal_id)
    values (v_user_id, v_withdrawal_id) returning id into v_request_id;
  return json_build_object('success', true, 'withdrawal_id', v_withdrawal_id, 'confirmation_id', v_request_id, 'amount', p_amount);
end;
$$;
grant execute on function public.request_withdrawal_email_confirmation(numeric, text) to authenticated;
