create function public.create_nowpayments_deposit(
  p_id uuid, p_user_id uuid, p_amount numeric, p_payment_id text
) returns void
language plpgsql set search_path = ''
as $$
begin
  if p_amount is null or p_amount not between 25 and 50000
     or p_amount <> round(p_amount, 2) or p_payment_id is null or p_payment_id !~ '^[0-9]+$' then
    raise exception 'Orden NOWPayments inválida';
  end if;

  insert into public.deposits (id, user_id, amount, method, status, transaction_hash)
  values (p_id, p_user_id, p_amount, 'NOWPAYMENTS', 'PENDING', p_payment_id);

  insert into public.transactions (user_id, type, amount, status, description, reference_id)
  values (p_user_id, 'DEPOSIT', p_amount, 'PENDING', 'Depósito NOWPayments · USDT BEP20', p_id::text);
end;
$$;

create unique index deposits_nowpayments_payment_id_uidx
  on public.deposits (transaction_hash) where method = 'NOWPAYMENTS';

create function public.confirm_nowpayments_deposit(
  p_id uuid, p_payment_id text, p_amount numeric
) returns void
language plpgsql set search_path = ''
as $$
declare
  deposit public.deposits%rowtype;
begin
  select * into deposit from public.deposits
  where id = p_id and method = 'NOWPAYMENTS' and transaction_hash = p_payment_id
  for update;

  if not found or p_amount is distinct from deposit.amount then
    raise exception 'Orden NOWPayments no coincide';
  end if;

  if deposit.status = 'APPROVED' then
    return;
  end if;

  if deposit.status <> 'PENDING' then
    raise exception 'El depósito ya fue procesado';
  end if;

  update public.profiles
  set wallet_balance = coalesce(wallet_balance, 0) + deposit.amount, updated_at = now()
  where id = deposit.user_id;

  update public.deposits set status = 'APPROVED', approved_at = now(), updated_at = now()
  where id = deposit.id;

  update public.transactions set status = 'COMPLETED', updated_at = now()
  where reference_id = deposit.id::text and user_id = deposit.user_id
    and type = 'DEPOSIT' and status = 'PENDING';

  insert into public.credit_logs (user_id, amount, type, description, balance_column, reference_id)
  values (deposit.user_id, deposit.amount, 'DEPOSIT', 'Confirmado por NOWPayments', 'wallet_balance', deposit.id::text);
end;
$$;

revoke all on function public.create_nowpayments_deposit(uuid, uuid, numeric, text) from public, anon, authenticated;
revoke all on function public.confirm_nowpayments_deposit(uuid, text, numeric) from public, anon, authenticated;
grant execute on function public.create_nowpayments_deposit(uuid, uuid, numeric, text) to service_role;
grant execute on function public.confirm_nowpayments_deposit(uuid, text, numeric) to service_role;
