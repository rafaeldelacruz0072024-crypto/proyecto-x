-- Keep a separate entitlement within the existing wallet. Deposits and ROI
-- increase the wallet but never increase its withdrawable commission portion.
lock table public.profiles, public.transactions, public.withdrawals in share row exclusive mode;

create table private.withdrawable_commissions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  amount numeric(18,2) not null check (amount >= 0)
);
revoke all on private.withdrawable_commissions from public, anon, authenticated;

create function private.is_commission(kind text) returns boolean
language sql immutable set search_path='' as $$
  select kind in ('REFERRAL_COMMISSION','BINARY_COMMISSION','BINARY_BONUS',
                  'WEEKLY_SALARY','WEEKLY_BONUS','BONUS_WEEKLY');
$$;

-- Replay historical wallet entries. Other wallet spending consumes ordinary
-- funds first. A withdrawal consumes available commissions first.
do $$
declare
  entry record;
  owner_id uuid;
  wallet numeric := 0;
  eligible numeric := 0;
begin
  for entry in select user_id, type, amount from public.transactions
    where (status='COMPLETED' or (type='WITHDRAWAL' and status in ('PENDING','APPROVED')))
    and (private.is_commission(type) or type in ('DEPOSIT','BONUS','DAILY_RETURN',
      'CAPITAL_RETURN','INVESTMENT_COST','WITHDRAWAL'))
    order by user_id,created_at,id
  loop
    if owner_id is distinct from entry.user_id then
      owner_id := entry.user_id; wallet := 0; eligible := 0;
    end if;
    wallet := greatest(0,wallet + entry.amount);
    if private.is_commission(entry.type) or entry.type='WITHDRAWAL' then
      eligible := greatest(0,eligible + entry.amount);
    end if;
    eligible := least(eligible,wallet);
    insert into private.withdrawable_commissions values(owner_id,eligible)
    on conflict(user_id) do update set amount=excluded.amount;
  end loop;
  update private.withdrawable_commissions c set amount=least(c.amount,p.wallet_balance)
    from public.profiles p where p.id=c.user_id;
end $$;

create function private.credit_withdrawable_commission() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.status='COMPLETED' and new.amount>0 and private.is_commission(new.type) then
    if tg_op='UPDATE' and old.status='COMPLETED' then return new; end if;
    insert into private.withdrawable_commissions values(new.user_id,new.amount)
    on conflict(user_id) do update set amount=private.withdrawable_commissions.amount+excluded.amount;
  end if;
  return new;
end $$;
create trigger credit_withdrawable_commission after insert or update of status on public.transactions
for each row execute function private.credit_withdrawable_commission();

create function private.cap_commissions_to_wallet() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  update private.withdrawable_commissions set amount=new.wallet_balance
    where user_id=new.id and amount>new.wallet_balance;
  return new;
end $$;
create trigger cap_commissions_to_wallet after update of wallet_balance on public.profiles
for each row when (new.wallet_balance<old.wallet_balance) execute function private.cap_commissions_to_wallet();

create function public.my_withdrawable_commissions() returns numeric
language sql stable security definer set search_path='' as $$
  select coalesce((select least(c.amount,p.wallet_balance) from private.withdrawable_commissions c
    join public.profiles p on c.user_id=p.id where p.id=auth.uid()),0);
$$;
revoke all on function public.my_withdrawable_commissions() from public,anon;
grant execute on function public.my_withdrawable_commissions() to authenticated;

alter table public.withdrawals add column commission_reserved numeric(18,2) not null default 0;
create function private.restore_rejected_commission() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  update private.withdrawable_commissions set amount=amount+old.commission_reserved where user_id=old.user_id;
  return new;
end $$;
create trigger restore_rejected_commission after update of status on public.withdrawals
for each row when (old.status in ('PENDING','APPROVED') and new.status='REJECTED' and old.commission_reserved>0)
execute function private.restore_rejected_commission();

update public.system_settings set min_withdrawal=40,withdrawal_window_enabled=true,
  withdrawal_open_day=5,withdrawal_open_hour=8,withdrawal_close_hour=15 where id=1;

create function private.withdrawal_window_open(at_time timestamptz, open_day integer, open_hour integer, close_hour integer)
returns boolean language sql stable set search_path='' as $$
  select coalesce((open_day is null or extract(dow from local_time)=open_day)
    and extract(hour from local_time)>=open_hour and extract(hour from local_time)<close_hour,false)
  from (select at_time at time zone 'America/Bogota' as local_time) local_clock;
$$;

create or replace function public.create_withdrawal_request(
  p_user_id uuid, p_amount numeric, p_method text, p_wallet_address text, p_bypass_window boolean default false
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_profile public.profiles%rowtype; v_settings public.system_settings%rowtype; v_fee numeric; v_net numeric; v_id uuid;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then raise exception 'No autorizado'; end if;
  if p_bypass_window then raise exception 'Parámetro no permitido'; end if;
  select * into v_settings from public.system_settings where id=1;
  select * into v_profile from public.profiles where id=p_user_id for update;
  if p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity') or p_amount<=0 or p_amount<>round(p_amount,2) then
    raise exception 'Monto inválido';
  end if;
  if p_method is distinct from 'USDT' or p_wallet_address is distinct from v_profile.withdrawal_wallet
    or coalesce(p_wallet_address,'') !~ '^0x[0-9A-Fa-f]{40}$' then raise exception 'Wallet BEP-20 o método inválido'; end if;
  if not found or lower(coalesce(v_profile.status,''))<>'active' then raise exception 'Usuario no disponible'; end if;
  if v_profile.withdrawals_blocked or coalesce(v_settings.withdrawal_global_blocked,false) then raise exception 'Retiros bloqueados'; end if;
  if v_settings.id is null then raise exception 'Configuración de retiros no disponible'; end if;
  if v_settings.withdrawal_window_enabled and not private.withdrawal_window_open(
    now(),v_settings.withdrawal_open_day,v_settings.withdrawal_open_hour,v_settings.withdrawal_close_hour
  ) then raise exception 'Ventana de retiros cerrada (hora de Colombia)'; end if;
  if p_amount < coalesce(v_settings.min_withdrawal,10) then raise exception 'Monto menor al mínimo'; end if;
  if coalesce(v_profile.wallet_balance,0) < p_amount then raise exception 'Balance insuficiente'; end if;
  if exists(select 1 from public.withdrawals where user_id=p_user_id and created_at >= date_trunc('day', now() at time zone 'America/Bogota') at time zone 'America/Bogota' and status<>'REJECTED') then
    raise exception 'Solo se permite un retiro diario';
  end if;
  update private.withdrawable_commissions set amount=amount-p_amount where user_id=p_user_id and amount>=p_amount;
  if not found then raise exception 'Comisiones disponibles insuficientes'; end if;
  v_fee := round(p_amount * coalesce(v_settings.withdrawal_fee,0) / 100,2); v_net := round(p_amount-v_fee,2);
  update public.profiles set wallet_balance=wallet_balance-p_amount,withdrawal_wallet=p_wallet_address,updated_at=now() where id=p_user_id;
  insert into public.withdrawals(user_id,amount,fee,net_amount,method,wallet_address,commission_reserved)
  values(p_user_id,round(p_amount,2),v_fee,v_net,p_method,btrim(p_wallet_address),p_amount) returning id into v_id;
  insert into public.transactions(user_id,type,amount,status,description,reference_id)
  values(p_user_id,'WITHDRAWAL',-round(p_amount,2),'PENDING','Solicitud de retiro',v_id::text);
  return jsonb_build_object('success',true,'withdrawal_id',v_id,'fee',v_fee,'net_amount',v_net,'status','PENDING');
end $$;

-- Older clients requesting a direct commission use the same reservation and schedule.
create or replace function public.withdraw_direct_commission(
  p_user_id uuid, p_amount numeric, p_method text, p_wallet_address text
) returns jsonb language plpgsql security invoker set search_path='' as $$
begin
  if auth.uid() is null or auth.uid() is distinct from p_user_id then
    return jsonb_build_object('success',false,'error','Usuario no autorizado');
  end if;
  return public.request_withdrawal_review(p_amount,'USDT')::jsonb;
exception when raise_exception then
  return jsonb_build_object('success',false,'error',sqlerrm);
end $$;
