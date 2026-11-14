-- Keep the legacy RPC callable for sessions already open during deployment.
create or replace function public.request_withdrawal_email_confirmation(
  p_amount numeric, p_method text
) returns json
language plpgsql security definer set search_path = ''
as $$
declare
  user_id uuid := auth.uid();
  wallet text;
  result jsonb;
begin
  if user_id is null then raise exception 'No autorizado'; end if;
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2)
     or p_amount::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception 'Introduce un monto válido con hasta dos decimales';
  end if;
  if p_method is distinct from 'USDT' then raise exception 'Método de retiro no válido'; end if;

  select p.withdrawal_wallet into wallet
  from public.profiles p where p.id = user_id for update;
  if wallet is null or wallet !~ '^0x[0-9A-Fa-f]{40}$' then
    raise exception 'Registra primero una dirección BEP-20 válida';
  end if;

  result := public.create_withdrawal_request(user_id, p_amount, p_method, wallet, false);
  return (result || jsonb_build_object('amount', p_amount))::json;
end;
$$;

create function public.request_withdrawal_review(p_amount numeric, p_method text)
returns json language sql security invoker set search_path = ''
as $$
  select public.request_withdrawal_email_confirmation(p_amount, p_method);
$$;

revoke all on function public.request_withdrawal_review(numeric, text) from public, anon;
grant execute on function public.request_withdrawal_review(numeric, text) to authenticated;

update public.withdrawals set status = 'PENDING', updated_at = now()
where status = 'EMAIL_CONFIRMATION_PENDING';

alter table public.withdrawals drop constraint withdrawals_status_check;
alter table public.withdrawals add constraint withdrawals_status_check
  check (status in ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'));
