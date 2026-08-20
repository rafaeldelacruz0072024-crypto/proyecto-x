-- NOVA Digital: repair the production financial ledger used by USER and ADMIN.
-- This migration is idempotent and preserves all existing financial records.

create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists withdrawals_blocked boolean not null default false,
  add column if not exists withdrawal_wallet text;

alter table public.transactions
  add column if not exists reference_id text,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists transactions_reference_id_idx on public.transactions(reference_id);
create index if not exists transactions_user_type_status_idx on public.transactions(user_id, type, status);

alter table public.system_settings
  add column if not exists withdrawal_global_blocked boolean not null default false,
  add column if not exists withdrawal_open_day smallint,
  add column if not exists withdrawal_open_hour smallint not null default 0,
  add column if not exists withdrawal_close_hour smallint not null default 24;

create table if not exists public.deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  amount numeric(18,2) not null check (amount > 0),
  method text not null default 'CRYPTOP',
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED')),
  transaction_hash text,
  blockchain_tx_hash text,
  proof_url text,
  approved_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  approved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists deposits_transaction_hash_unique
  on public.deposits(lower(transaction_hash)) where transaction_hash is not null and btrim(transaction_hash) <> '';
create index if not exists deposits_user_status_idx on public.deposits(user_id, status, created_at desc);

create table if not exists public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  amount numeric(18,2) not null check (amount > 0),
  fee numeric(18,2) not null default 0 check (fee >= 0),
  net_amount numeric(18,2) not null check (net_amount >= 0),
  method text not null,
  wallet_address text not null,
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED','COMPLETED')),
  blockchain_tx_hash text,
  rejection_reason text,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  rejected_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists withdrawals_user_status_idx on public.withdrawals(user_id, status, created_at desc);

create table if not exists public.binary_payouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  cycle_day date not null,
  matched_volume numeric(18,2) not null,
  bonus_percent numeric(5,2) not null default 8,
  paid_bonus numeric(18,2) not null,
  left_carryover numeric(18,2) not null,
  right_carryover numeric(18,2) not null,
  status text not null default 'PAID',
  processed_at timestamptz not null default now(),
  unique(user_id, cycle_day)
);

alter table public.deposits enable row level security;
alter table public.withdrawals enable row level security;

drop policy if exists deposits_select_own_or_admin on public.deposits;
create policy deposits_select_own_or_admin on public.deposits for select to authenticated
using (user_id = (select auth.uid()) or exists (
  select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin','sub-admin')
));
drop policy if exists deposits_admin_update on public.deposits;
create policy deposits_admin_update on public.deposits for update to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin','sub-admin')))
with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin','sub-admin')));

drop policy if exists withdrawals_select_own_or_admin on public.withdrawals;
create policy withdrawals_select_own_or_admin on public.withdrawals for select to authenticated
using (user_id = (select auth.uid()) or exists (
  select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin','sub-admin')
));

create or replace function public.create_deposit_request_atomic(
  p_user_id uuid, p_amount numeric, p_method text default 'CRYPTOP', p_transaction_hash text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_hash text := nullif(btrim(p_transaction_hash), '');
begin
  if auth.uid() is null or auth.uid() <> p_user_id then raise exception 'No autorizado'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Monto inválido'; end if;
  if upper(coalesce(p_method,'')) <> 'CRYPTOP' then raise exception 'Método no permitido'; end if;
  if v_hash is not null and exists(select 1 from public.deposits where lower(transaction_hash)=lower(v_hash)) then
    raise exception 'Este hash ya fue registrado';
  end if;
  insert into public.deposits(user_id,amount,method,transaction_hash)
  values(p_user_id,round(p_amount,2),'CRYPTOP',v_hash) returning id into v_id;
  insert into public.transactions(user_id,type,amount,status,description,reference_id)
  values(p_user_id,'DEPOSIT',round(p_amount,2),'PENDING','Solicitud de depósito CRYPTOP',v_id::text);
  return jsonb_build_object('success',true,'deposit_id',v_id,'amount',round(p_amount,2),'method','CRYPTOP','status','PENDING');
end $$;

create or replace function public.process_deposit_approval(p_deposit_id uuid, p_admin_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_dep public.deposits%rowtype; v_admin uuid := auth.uid();
begin
  if v_admin is null or not exists(select 1 from public.profiles where id=v_admin and role in ('admin','sub-admin')) then raise exception 'No autorizado'; end if;
  select * into v_dep from public.deposits where id=p_deposit_id for update;
  if not found then raise exception 'Depósito no encontrado'; end if;
  if v_dep.status='APPROVED' then return jsonb_build_object('success',true,'idempotent',true); end if;
  if v_dep.status<>'PENDING' then raise exception 'El depósito ya fue procesado'; end if;
  update public.profiles set wallet_balance=coalesce(wallet_balance,0)+v_dep.amount,updated_at=now() where id=v_dep.user_id;
  update public.deposits set status='APPROVED',approved_at=now(),approved_by=v_admin,updated_at=now() where id=v_dep.id;
  update public.transactions set status='COMPLETED',updated_at=now() where reference_id=v_dep.id::text and type='DEPOSIT' and status='PENDING';
  insert into public.credit_logs(user_id,amount,type,description,performed_by,balance_column,reference_id)
  values(v_dep.user_id,v_dep.amount,'DEPOSIT','Depósito aprobado',v_admin,'wallet_balance',v_dep.id::text);
  return jsonb_build_object('success',true,'deposit_id',v_dep.id,'credited',v_dep.amount);
end $$;

create or replace function public.admin_reject_deposit_atomic(p_deposit_id uuid, p_admin_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_dep public.deposits%rowtype; v_admin uuid := auth.uid();
begin
  if v_admin is null or not exists(select 1 from public.profiles where id=v_admin and role in ('admin','sub-admin')) then raise exception 'No autorizado'; end if;
  select * into v_dep from public.deposits where id=p_deposit_id for update;
  if not found then raise exception 'Depósito no encontrado'; end if;
  if v_dep.status='REJECTED' then return jsonb_build_object('success',true,'idempotent',true); end if;
  if v_dep.status<>'PENDING' then raise exception 'El depósito ya fue procesado'; end if;
  update public.deposits set status='REJECTED',rejected_at=now(),approved_by=v_admin,updated_at=now() where id=v_dep.id;
  update public.transactions set status='REJECTED',updated_at=now() where reference_id=v_dep.id::text and type='DEPOSIT' and status='PENDING';
  return jsonb_build_object('success',true,'deposit_id',v_dep.id);
end $$;

create or replace function public.create_withdrawal_request(
  p_user_id uuid, p_amount numeric, p_method text, p_wallet_address text, p_bypass_window boolean default false
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_profile public.profiles%rowtype; v_settings public.system_settings%rowtype; v_fee numeric; v_net numeric; v_id uuid;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then raise exception 'No autorizado'; end if;
  if p_bypass_window then raise exception 'Parámetro no permitido'; end if;
  select * into v_settings from public.system_settings where id=1;
  select * into v_profile from public.profiles where id=p_user_id for update;
  if not found or lower(coalesce(v_profile.status,''))<>'active' then raise exception 'Usuario no disponible'; end if;
  if v_profile.withdrawals_blocked or coalesce(v_settings.withdrawal_global_blocked,false) then raise exception 'Retiros bloqueados'; end if;
  if p_amount < coalesce(v_settings.min_withdrawal,10) then raise exception 'Monto menor al mínimo'; end if;
  if coalesce(v_profile.wallet_balance,0) < p_amount then raise exception 'Balance insuficiente'; end if;
  if exists(select 1 from public.withdrawals where user_id=p_user_id and created_at >= date_trunc('day', now() at time zone 'America/Santo_Domingo') at time zone 'America/Santo_Domingo' and status<>'REJECTED') then
    raise exception 'Solo se permite un retiro diario';
  end if;
  v_fee := round(p_amount * coalesce(v_settings.withdrawal_fee,0) / 100,2); v_net := round(p_amount-v_fee,2);
  update public.profiles set wallet_balance=wallet_balance-p_amount,withdrawal_wallet=p_wallet_address,updated_at=now() where id=p_user_id;
  insert into public.withdrawals(user_id,amount,fee,net_amount,method,wallet_address)
  values(p_user_id,round(p_amount,2),v_fee,v_net,p_method,btrim(p_wallet_address)) returning id into v_id;
  insert into public.transactions(user_id,type,amount,status,description,reference_id)
  values(p_user_id,'WITHDRAWAL',-round(p_amount,2),'PENDING','Solicitud de retiro',v_id::text);
  return jsonb_build_object('success',true,'withdrawal_id',v_id,'fee',v_fee,'net_amount',v_net,'status','PENDING');
end $$;

create or replace function public.get_user_balance(p_user_id uuid)
returns numeric language plpgsql security definer set search_path = '' stable as $$
begin
  if auth.uid()<>p_user_id and not exists(select 1 from public.profiles where id=auth.uid() and role in ('admin','sub-admin')) then raise exception 'No autorizado'; end if;
  return coalesce((select wallet_balance from public.profiles where id=p_user_id),0);
end $$;

create or replace function public.process_withdrawal_approval(p_withdrawal_id uuid, p_admin_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_w public.withdrawals%rowtype; v_admin uuid:=auth.uid();
begin
  if v_admin is null or not exists(select 1 from public.profiles where id=v_admin and role in ('admin','sub-admin')) then raise exception 'No autorizado'; end if;
  select * into v_w from public.withdrawals where id=p_withdrawal_id for update;
  if not found then raise exception 'Retiro no encontrado'; end if;
  if v_w.status='APPROVED' then return jsonb_build_object('success',true,'idempotent',true); end if;
  if v_w.status<>'PENDING' then raise exception 'El retiro ya fue procesado'; end if;
  update public.withdrawals set status='APPROVED',approved_at=now(),approved_by=v_admin,updated_at=now() where id=v_w.id;
  return jsonb_build_object('success',true,'withdrawal_id',v_w.id);
end $$;

create or replace function public.reject_withdrawal(p_withdrawal_id uuid, p_reason text, p_admin_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_w public.withdrawals%rowtype; v_admin uuid:=auth.uid();
begin
  if v_admin is null or not exists(select 1 from public.profiles where id=v_admin and role in ('admin','sub-admin')) then raise exception 'No autorizado'; end if;
  select * into v_w from public.withdrawals where id=p_withdrawal_id for update;
  if not found then raise exception 'Retiro no encontrado'; end if;
  if v_w.status='REJECTED' then return jsonb_build_object('success',true,'idempotent',true); end if;
  if v_w.status not in ('PENDING','APPROVED') then raise exception 'El retiro no puede rechazarse'; end if;
  update public.profiles set wallet_balance=coalesce(wallet_balance,0)+v_w.amount,updated_at=now() where id=v_w.user_id;
  update public.withdrawals set status='REJECTED',rejection_reason=nullif(btrim(p_reason),''),rejected_at=now(),approved_by=v_admin,updated_at=now() where id=v_w.id;
  update public.transactions set status='REJECTED',description='Retiro rechazado; saldo restaurado',updated_at=now() where reference_id=v_w.id::text and type='WITHDRAWAL';
  return jsonb_build_object('success',true,'withdrawal_id',v_w.id,'restored',v_w.amount);
end $$;

create or replace function public.complete_withdrawal_atomic(p_withdrawal_id uuid, p_tx_hash text, p_admin_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_w public.withdrawals%rowtype; v_admin uuid:=auth.uid();
begin
  if v_admin is null or not exists(select 1 from public.profiles where id=v_admin and role in ('admin','sub-admin')) then raise exception 'No autorizado'; end if;
  if nullif(btrim(p_tx_hash),'') is null then raise exception 'Hash requerido'; end if;
  select * into v_w from public.withdrawals where id=p_withdrawal_id for update;
  if not found then raise exception 'Retiro no encontrado'; end if;
  if v_w.status='COMPLETED' then return jsonb_build_object('success',true,'idempotent',true); end if;
  if v_w.status<>'APPROVED' then raise exception 'El retiro debe estar aprobado'; end if;
  update public.withdrawals set status='COMPLETED',blockchain_tx_hash=btrim(p_tx_hash),completed_at=now(),updated_at=now() where id=v_w.id;
  update public.transactions set status='COMPLETED',description='Retiro completado · TX '||btrim(p_tx_hash),updated_at=now() where reference_id=v_w.id::text and type='WITHDRAWAL';
  return jsonb_build_object('success',true,'withdrawal_id',v_w.id);
end $$;

create or replace function public.admin_activate_investment(
  p_user_id uuid, p_plan_id uuid, p_amount numeric, p_generate_commission boolean default true
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_admin uuid:=auth.uid(); v_plan public.plans%rowtype; v_profile public.profiles%rowtype; v_roi numeric; v_id uuid; v_matures date;
begin
  if v_admin is null or not exists(select 1 from public.profiles where id=v_admin and role in ('admin','sub-admin')) then raise exception 'No autorizado'; end if;
  select * into v_plan from public.plans where id=p_plan_id and status='active';
  if not found then raise exception 'Plan no disponible'; end if;
  if p_amount < v_plan.min_amount or (v_plan.max_amount is not null and p_amount > v_plan.max_amount) then raise exception 'Monto fuera del rango del plan'; end if;
  select * into v_profile from public.profiles where id=p_user_id for update;
  if not found or lower(coalesce(v_profile.status,''))<>'active' then raise exception 'Usuario no disponible'; end if;
  if coalesce(v_profile.credit_balance,0) < p_amount then raise exception 'Credit Balance insuficiente'; end if;
  v_roi := round(v_plan.roi_min_percentage + random()*(v_plan.roi_max_percentage-v_plan.roi_min_percentage),4);
  v_matures := case when v_plan.duration_business_days is null then null else current_date + v_plan.duration_business_days end;
  update public.profiles set credit_balance=credit_balance-p_amount,updated_at=now() where id=p_user_id;
  insert into public.investments(user_id,plan_id,amount,assigned_roi_percentage,status,accumulated_earnings,business_days_elapsed,last_accrual_on,matures_on,capital_returned,created_at,cycle_started_on,last_cycle_activation_on,is_referral_commission_paid)
  values(p_user_id,p_plan_id,round(p_amount,2),v_roi,'ACTIVE',0,0,null,v_matures,false,now(),current_date,current_date,not p_generate_commission) returning id into v_id;
  insert into public.transactions(user_id,investment_id,type,amount,status,description,reference_id)
  values(p_user_id,v_id,'INVESTMENT',-round(p_amount,2),'COMPLETED','Activación administrativa · '||v_plan.name,v_id::text);
  insert into public.credit_logs(user_id,amount,type,description,performed_by,balance_column,reference_id)
  values(p_user_id,-round(p_amount,2),'INVESTMENT','Activación de ciclo '||v_plan.name,v_admin,'credit_balance',v_id::text);
  return jsonb_build_object('success',true,'investment_id',v_id,'assigned_roi_percentage',v_roi);
end $$;

-- Remove the obsolete residual/binary trigger pair. The canonical NOVA engine is private.* + binary_nodes.
drop trigger if exists tr_credit_binary_volume_insert on public.investments;
drop trigger if exists tr_credit_binary_volume_update on public.investments;
drop trigger if exists tr_distribute_referral_commissions on public.investments;
drop trigger if exists tr_distribute_referral_commissions_insert on public.investments;

create or replace function private.pay_direct_referral_commission()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_sponsor_id uuid; v_commission numeric(18,2);
begin
  if new.status<>'ACTIVE' or coalesce(new.is_referral_commission_paid,false) then return new; end if;
  if tg_op='UPDATE' and old.status='ACTIVE' then return new; end if;
  if exists(select 1 from public.transactions where investment_id=new.id and type='REFERRAL_COMMISSION') then return new; end if;
  select referred_by into v_sponsor_id from public.profiles where id=new.user_id;
  if v_sponsor_id is null then return new; end if;
  v_commission:=round(new.amount*0.10,2);
  update public.profiles set wallet_balance=coalesce(wallet_balance,0)+v_commission,updated_at=now() where id=v_sponsor_id;
  insert into public.transactions(user_id,investment_id,type,amount,status,description,reference_id)
  values(v_sponsor_id,new.id,'REFERRAL_COMMISSION',v_commission,'COMPLETED','Indicación directa 10% por activación',new.id::text);
  update public.investments set is_referral_commission_paid=true where id=new.id;
  return new;
end $$;

-- Ensure the canonical trigger does not count an already-active row on unrelated updates.
create or replace function private.accumulate_binary_volume()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_current_id uuid:=new.user_id; v_parent_id uuid; v_side text;
begin
  if new.status<>'ACTIVE' or (tg_op='UPDATE' and old.status='ACTIVE') then return new; end if;
  loop
    select placement_parent_id,leg_position into v_parent_id,v_side from public.binary_nodes where user_id=v_current_id;
    exit when v_parent_id is null;
    update public.binary_nodes set
      pending_left_volume=pending_left_volume+case when v_side='LEFT' then new.amount else 0 end,
      pending_right_volume=pending_right_volume+case when v_side='RIGHT' then new.amount else 0 end,
      lifetime_left_volume=lifetime_left_volume+case when v_side='LEFT' then new.amount else 0 end,
      lifetime_right_volume=lifetime_right_volume+case when v_side='RIGHT' then new.amount else 0 end,
      updated_at=now() where user_id=v_parent_id;
    v_current_id:=v_parent_id;
  end loop;
  return new;
end $$;

create or replace function public.get_my_binary_summary()
returns jsonb language sql security definer set search_path = '' stable as $$
  select jsonb_build_object(
    'left_volume',coalesce(n.pending_left_volume,0),
    'right_volume',coalesce(n.pending_right_volume,0),
    'matched_available',least(coalesce(n.pending_left_volume,0),coalesce(n.pending_right_volume,0)),
    'estimated_commission',round(least(coalesce(n.pending_left_volume,0),coalesce(n.pending_right_volume,0))*0.08,2),
    'total_earned',coalesce(n.lifetime_paid_bonus,0),
    'last_cut_at',(select max(processed_at) from public.binary_payouts where user_id=auth.uid()),
    'left_member',(select jsonb_build_object('username',p.username,'email',p.email) from public.binary_nodes c join public.profiles p on p.id=c.user_id where c.placement_parent_id=auth.uid() and c.leg_position='LEFT' limit 1),
    'right_member',(select jsonb_build_object('username',p.username,'email',p.email) from public.binary_nodes c join public.profiles p on p.id=c.user_id where c.placement_parent_id=auth.uid() and c.leg_position='RIGHT' limit 1),
    'recent_cuts',coalesce((select jsonb_agg(to_jsonb(x) order by x.cut_date desc) from (select cycle_day as cut_date,matched_volume,paid_bonus as commission,left_carryover as left_carry,right_carryover as right_carry from public.binary_payouts where user_id=auth.uid() order by cycle_day desc limit 7)x),'[]'::jsonb)
  ) from (select 1) q left join public.binary_nodes n on n.user_id=auth.uid();
$$;

create or replace function public.get_my_binary_tree(p_max_depth integer default 6)
returns jsonb language sql security definer set search_path = '' stable as $$
  with recursive tree as (
    select p.id,n.placement_parent_id,n.leg_position,p.username,p.full_name,p.email,0 depth,array[p.id] path
    from public.profiles p left join public.binary_nodes n on n.user_id=p.id where p.id=auth.uid()
    union all
    select p.id,n.placement_parent_id,n.leg_position,p.username,p.full_name,p.email,t.depth+1,t.path||p.id
    from tree t join public.binary_nodes n on n.placement_parent_id=t.id join public.profiles p on p.id=n.user_id
    where t.depth<greatest(1,least(coalesce(p_max_depth,6),12)) and not p.id=any(t.path)
  )
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'parent_id',placement_parent_id,'side',leg_position,'username',coalesce(username,full_name,split_part(email,'@',1),'Usuario'),'depth',depth) order by depth,username),'[]'::jsonb) from tree;
$$;

revoke all on function public.create_deposit_request_atomic(uuid,numeric,text,text) from public,anon;
revoke all on function public.create_withdrawal_request(uuid,numeric,text,text,boolean) from public,anon;
grant execute on function public.create_deposit_request_atomic(uuid,numeric,text,text) to authenticated;
grant execute on function public.create_withdrawal_request(uuid,numeric,text,text,boolean) to authenticated;
grant execute on function public.get_user_balance(uuid) to authenticated;
grant execute on function public.get_my_binary_summary(), public.get_my_binary_tree(integer) to authenticated;
grant execute on function public.process_deposit_approval(uuid,uuid), public.admin_reject_deposit_atomic(uuid,uuid), public.process_withdrawal_approval(uuid,uuid), public.reject_withdrawal(uuid,text,uuid), public.complete_withdrawal_atomic(uuid,text,uuid), public.admin_activate_investment(uuid,uuid,numeric,boolean) to authenticated;
grant select on public.deposits, public.withdrawals to authenticated;
