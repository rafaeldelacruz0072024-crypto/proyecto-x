-- NOVA Digital: el Nodo Diario es el unico ciclo con capital flexible.
-- El principal puede regresar a Wallet Bank en cualquier momento; los ciclos
-- con plazo conservan el bloqueo hasta su vencimiento.

create or replace function private.withdraw_daily_node_capital(
  p_user_id uuid,
  p_investment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_investment public.investments%rowtype;
  v_plan public.plans%rowtype;
  v_wallet_balance numeric(18,2);
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'No autorizado';
  end if;

  select * into v_investment
  from public.investments
  where id = p_investment_id
    and user_id = p_user_id
  for update;

  if not found then
    raise exception 'Contrato no encontrado';
  end if;

  select * into v_plan
  from public.plans
  where id = v_investment.plan_id;

  if not found then
    raise exception 'Plan no encontrado';
  end if;

  if v_plan.code <> 'DAILY'
     or v_plan.payout_mode <> 'daily'
     or v_plan.capital_release_mode <> 'on_close'
     or v_plan.duration_business_days is not null then
    raise exception 'Este nodo mantiene el capital bloqueado hasta su vencimiento';
  end if;

  if v_investment.status <> 'ACTIVE' or v_investment.capital_returned then
    raise exception 'El capital de este nodo ya fue liberado o el contrato no esta activo';
  end if;

  update public.profiles
  set wallet_balance = coalesce(wallet_balance, 0) + v_investment.amount,
      updated_at = now()
  where id = p_user_id
    and status = 'active'
  returning wallet_balance into v_wallet_balance;

  if not found then
    raise exception 'Perfil no disponible';
  end if;

  update public.investments
  set status = 'CANCELLED',
      capital_returned = true,
      completed_at = now()
  where id = v_investment.id;

  insert into public.transactions (
    user_id, investment_id, type, amount, status, description, reference_id
  ) values (
    p_user_id,
    v_investment.id,
    'CAPITAL_RETURN',
    v_investment.amount,
    'COMPLETED',
    'Capital flexible devuelto a Wallet Bank · ' || v_plan.name,
    'daily_capital_return_' || v_investment.id::text
  );

  return jsonb_build_object(
    'success', true,
    'investment_id', v_investment.id,
    'capital_returned', v_investment.amount,
    'wallet_balance', v_wallet_balance,
    'status', 'CANCELLED'
  );
end;
$$;

create or replace function public.withdraw_daily_node_capital(
  p_investment_id uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.withdraw_daily_node_capital((select auth.uid()), p_investment_id);
$$;

revoke all on function private.withdraw_daily_node_capital(uuid, uuid) from public, anon;
revoke all on function public.withdraw_daily_node_capital(uuid) from public, anon;
grant execute on function private.withdraw_daily_node_capital(uuid, uuid) to authenticated;
grant execute on function public.withdraw_daily_node_capital(uuid) to authenticated;

comment on function public.withdraw_daily_node_capital(uuid) is
  'Devuelve a Wallet Bank el capital de un Nodo Diario activo. Los planes con plazo no pueden cerrarse anticipadamente.';

notify pgrst, 'reload schema';
