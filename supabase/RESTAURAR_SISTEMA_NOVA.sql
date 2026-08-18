-- ============================================================================
-- RESTAURACION COMPLETA DEL SISTEMA NOVA DIGITAL
-- ============================================================================
-- Ejecutar TODO este archivo en: Supabase Dashboard -> SQL Editor -> Run
-- Restaura el esquema binario NOVA (binary_accounts, corte diario, 8%/10%)
-- que fue sobrescrito por scripts GEMINIX.
-- Es idempotente: puede ejecutarse mas de una vez sin romper nada.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- LIMPIEZA DE OBJETOS GEMINIX
-- ---------------------------------------------------------------------------

-- Desprogramar cron jobs de GEMINIX
do $$ begin
  perform cron.unschedule(jobid) from cron.job where jobname in ('geminix-binary-weekly-cut','geminix-binary-daily-cut');
exception when undefined_table or invalid_schema_name then null; end $$;

-- Eliminar trigger GEMINIX de volumen binario sobre investments (si existe)
drop trigger if exists trg_record_binary_volume on public.investments;
drop trigger if exists trg_distribute_referral_commissions_gem on public.investments;

-- ===========================================================================
-- MIGRACION 1: configure_nova_binary_system (nucleo binario + registro)
-- ===========================================================================
-- NOVA Digital: binario 8% + indicacion directa 10%.
-- Corte diario: 00:00 America/Santo_Domingo (04:00 UTC).

create extension if not exists pg_cron with schema extensions;

alter table public.profiles
  add column if not exists binary_parent_id uuid references public.profiles(id),
  add column if not exists binary_side text,
  add column if not exists binary_registered_at timestamptz;

do $$ begin
  alter table public.profiles add constraint profiles_binary_side_check
    check (binary_side is null or binary_side in ('LEFT','RIGHT'));
exception when duplicate_object then null; end $$;

create unique index if not exists profiles_binary_slot_unique
  on public.profiles(binary_parent_id, binary_side)
  where binary_parent_id is not null and binary_side is not null;

create index if not exists profiles_binary_parent_idx on public.profiles(binary_parent_id);

create table if not exists public.binary_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  left_volume numeric(18,2) not null default 0 check (left_volume >= 0),
  right_volume numeric(18,2) not null default 0 check (right_volume >= 0),
  total_matched_volume numeric(18,2) not null default 0 check (total_matched_volume >= 0),
  total_binary_earned numeric(18,2) not null default 0 check (total_binary_earned >= 0),
  last_cut_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.binary_volume_events (
  id bigint generated always as identity primary key,
  beneficiary_id uuid not null references public.profiles(id) on delete cascade,
  source_user_id uuid not null references public.profiles(id) on delete cascade,
  investment_id uuid not null references public.investments(id) on delete cascade,
  side text not null check (side in ('LEFT','RIGHT')),
  volume numeric(18,2) not null check (volume > 0),
  created_at timestamptz not null default now(),
  unique (beneficiary_id, investment_id)
);

create index if not exists binary_volume_beneficiary_idx
  on public.binary_volume_events(beneficiary_id, created_at desc);

create table if not exists public.binary_cuts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  cut_date date not null,
  left_before numeric(18,2) not null,
  right_before numeric(18,2) not null,
  matched_volume numeric(18,2) not null,
  commission numeric(18,2) not null,
  left_carry numeric(18,2) not null,
  right_carry numeric(18,2) not null,
  created_at timestamptz not null default now(),
  unique (user_id, cut_date)
);

alter table public.binary_accounts enable row level security;
alter table public.binary_volume_events enable row level security;
alter table public.binary_cuts enable row level security;

drop policy if exists binary_accounts_select_own on public.binary_accounts;
create policy binary_accounts_select_own on public.binary_accounts for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists binary_events_select_own on public.binary_volume_events;
create policy binary_events_select_own on public.binary_volume_events for select to authenticated
  using ((select auth.uid()) = beneficiary_id);
drop policy if exists binary_cuts_select_own on public.binary_cuts;
create policy binary_cuts_select_own on public.binary_cuts for select to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.binary_accounts, public.binary_volume_events, public.binary_cuts to authenticated;

create or replace function public.find_binary_position(p_sponsor_id uuid, p_side text)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare v_parent uuid := p_sponsor_id; v_child uuid; v_guard int := 0;
begin
  if upper(p_side) not in ('LEFT','RIGHT') then raise exception 'Pierna binaria invalida'; end if;
  loop
    v_guard := v_guard + 1;
    if v_guard > 1000 then raise exception 'Profundidad binaria excedida'; end if;
    select id into v_child from public.profiles
      where binary_parent_id = v_parent and binary_side = upper(p_side) limit 1;
    if v_child is null then return v_parent; end if;
    v_parent := v_child;
  end loop;
end $$;

-- Firma oficial de registro con posicion binaria explicita.
revoke all on function public.find_binary_position(uuid,text) from public, anon, authenticated;

-- Borra las firmas anterior (8) y actual (9) para que esta migracion sea reintentable
-- incluso si una ejecucion previa se interrumpio justo despues de crear la funcion.
drop function if exists public.complete_registration(uuid,text,text,text,text,text,text,text);
drop function if exists public.complete_registration(uuid,text,text,text,text,text,text,text,text);
create function public.complete_registration(
  p_user_id uuid, p_username text, p_full_name text, p_email text,
  p_country text default null, p_phone text default null, p_ref_code text default null,
  p_sponsor_code text default null, p_binary_side text default null
) returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare v_sponsor_id uuid; v_binary_parent uuid; v_side text;
begin
  if (select auth.uid()) is distinct from p_user_id then
    return jsonb_build_object('success',false,'error','Usuario no autorizado');
  end if;
  v_side := upper(coalesce(nullif(trim(p_binary_side),''),'LEFT'));
  if v_side not in ('LEFT','RIGHT') then return jsonb_build_object('success',false,'error','Pierna invalida'); end if;
  select id into v_sponsor_id from public.profiles where ref_code = upper(trim(p_sponsor_code)) limit 1;
  if v_sponsor_id is null then select default_sponsor_id into v_sponsor_id from public.system_settings limit 1; end if;
  if v_sponsor_id is null then return jsonb_build_object('success',false,'error','Patrocinador no configurado'); end if;
  v_binary_parent := public.find_binary_position(v_sponsor_id, v_side);
  insert into public.profiles(id,username,full_name,email,country,phone,ref_code,referred_by,binary_parent_id,binary_side,binary_registered_at,role,status,credit_balance,wallet_balance,created_at)
  values(p_user_id,p_username,p_full_name,p_email,p_country,p_phone,
    coalesce(p_ref_code,'GK-'||upper(substring(replace(gen_random_uuid()::text,'-',''),1,6))),
    v_sponsor_id,v_binary_parent,v_side,now(),'user','active',0,0,now())
  on conflict(id) do update set username=excluded.username,full_name=excluded.full_name,
    country=coalesce(excluded.country,profiles.country),phone=coalesce(excluded.phone,profiles.phone),
    ref_code=coalesce(profiles.ref_code,excluded.ref_code),referred_by=coalesce(profiles.referred_by,excluded.referred_by),
    binary_parent_id=coalesce(profiles.binary_parent_id,excluded.binary_parent_id),
    binary_side=coalesce(profiles.binary_side,excluded.binary_side),updated_at=now();
  insert into public.binary_accounts(user_id) values(p_user_id) on conflict do nothing;
  return jsonb_build_object('success',true,'sponsor_id',v_sponsor_id,'binary_parent_id',v_binary_parent,'binary_side',v_side);
exception when unique_violation then
  return jsonb_build_object('success',false,'error','La posicion binaria cambio durante el registro. Intenta nuevamente.');
when others then return jsonb_build_object('success',false,'error',sqlerrm);
end $$;
revoke execute on function public.complete_registration(uuid,text,text,text,text,text,text,text,text) from public, anon;
grant execute on function public.complete_registration(uuid,text,text,text,text,text,text,text,text) to authenticated;

alter table public.investments add column if not exists is_referral_commission_paid boolean not null default false;

-- Sustituye cualquier residual historico por el unico bono directo oficial: 10%.
create or replace function public.distribute_residual_commissions()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_sponsor uuid; v_bonus numeric; v_name text;
begin
  if new.status <> 'ACTIVE' or coalesce(new.is_referral_commission_paid,false) then return new; end if;
  if exists(select 1 from public.transactions where reference_id=new.id and type='REFERRAL_COMMISSION') then
    update public.investments set is_referral_commission_paid=true where id=new.id;
    return new;
  end if;
  select referred_by,coalesce(full_name,username,email) into v_sponsor,v_name from public.profiles where id=new.user_id;
  if v_sponsor is not null then
    v_bonus:=round(new.amount*0.10,2);
    update public.profiles set wallet_balance=coalesce(wallet_balance,0)+v_bonus where id=v_sponsor;
    insert into public.transactions(user_id,amount,type,status,description,reference_id,created_at)
      values(v_sponsor,v_bonus,'REFERRAL_COMMISSION','COMPLETED','Indicacion directa 10% por activacion de '||coalesce(v_name,'referido'),new.id,now());
  end if;
  update public.investments set is_referral_commission_paid=true where id=new.id;
  return new;
end $$;
revoke execute on function public.distribute_residual_commissions() from public, anon, authenticated;

drop trigger if exists tr_distribute_referral_commissions on public.investments;
create trigger tr_distribute_referral_commissions after update of status on public.investments
for each row when (new.status='ACTIVE' and old.status is distinct from 'ACTIVE') execute function public.distribute_residual_commissions();
drop trigger if exists tr_distribute_referral_commissions_insert on public.investments;
create trigger tr_distribute_referral_commissions_insert after insert on public.investments
for each row when (new.status='ACTIVE') execute function public.distribute_residual_commissions();

create or replace function public.credit_binary_volume()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_ancestor uuid; v_child uuid; v_side text; v_seen int := 0;
begin
  if new.status <> 'ACTIVE' then return new; end if;
  v_child := new.user_id;
  select binary_parent_id into v_ancestor from public.profiles where id=v_child;
  while v_ancestor is not null loop
    v_seen := v_seen + 1; if v_seen > 1000 then exit; end if;
    select binary_side into v_side from public.profiles where id=v_child;
    insert into public.binary_volume_events(beneficiary_id,source_user_id,investment_id,side,volume)
      values(v_ancestor,new.user_id,new.id,v_side,new.amount) on conflict do nothing;
    if found then
      insert into public.binary_accounts(user_id) values(v_ancestor) on conflict do nothing;
      update public.binary_accounts set
        left_volume=left_volume+case when v_side='LEFT' then new.amount else 0 end,
        right_volume=right_volume+case when v_side='RIGHT' then new.amount else 0 end,
        updated_at=now() where user_id=v_ancestor;
    end if;
    v_child:=v_ancestor;
    select binary_parent_id into v_ancestor from public.profiles where id=v_child;
  end loop;
  return new;
end $$;
revoke execute on function public.credit_binary_volume() from public, anon, authenticated;

drop trigger if exists tr_credit_binary_volume_insert on public.investments;
create trigger tr_credit_binary_volume_insert after insert on public.investments
for each row when (new.status='ACTIVE') execute function public.credit_binary_volume();
drop trigger if exists tr_credit_binary_volume_update on public.investments;
create trigger tr_credit_binary_volume_update after update of status on public.investments
for each row when (new.status='ACTIVE' and old.status is distinct from 'ACTIVE') execute function public.credit_binary_volume();

create or replace function public.process_binary_cut(p_cut_date date default (now() at time zone 'America/Santo_Domingo')::date)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r record; v_match numeric; v_bonus numeric; v_count int:=0; v_total numeric:=0;
begin
  for r in select * from public.binary_accounts for update loop
    if exists(select 1 from public.binary_cuts where user_id=r.user_id and cut_date=p_cut_date) then continue; end if;
    v_match:=least(r.left_volume,r.right_volume); v_bonus:=round(v_match*0.08,2);
    insert into public.binary_cuts(user_id,cut_date,left_before,right_before,matched_volume,commission,left_carry,right_carry)
      values(r.user_id,p_cut_date,r.left_volume,r.right_volume,v_match,v_bonus,r.left_volume-v_match,r.right_volume-v_match);
    update public.binary_accounts set left_volume=left_volume-v_match,right_volume=right_volume-v_match,
      total_matched_volume=total_matched_volume+v_match,total_binary_earned=total_binary_earned+v_bonus,last_cut_at=now(),updated_at=now()
      where user_id=r.user_id;
    if v_bonus>0 then
      update public.profiles set wallet_balance=coalesce(wallet_balance,0)+v_bonus where id=r.user_id;
      insert into public.transactions(user_id,amount,type,status,description,created_at)
        values(r.user_id,v_bonus,'BINARY_COMMISSION','COMPLETED','Bono binario 8% - corte '||p_cut_date,now());
      v_count:=v_count+1; v_total:=v_total+v_bonus;
    end if;
  end loop;
  return jsonb_build_object('success',true,'paid_accounts',v_count,'total_paid',v_total,'cut_date',p_cut_date);
end $$;
revoke execute on function public.process_binary_cut(date) from public, anon, authenticated;

do $$ begin
  perform cron.unschedule(jobid) from cron.job where jobname='nova-binary-daily-cut';
exception when undefined_table or invalid_schema_name then null; end $$;
select cron.schedule('nova-binary-daily-cut','0 4 * * *',$$select public.process_binary_cut();$$);

create or replace function public.get_my_binary_summary()
returns jsonb language sql security definer set search_path=public stable as $$
  select jsonb_build_object(
    'left_volume',coalesce(a.left_volume,0),'right_volume',coalesce(a.right_volume,0),
    'matched_available',least(coalesce(a.left_volume,0),coalesce(a.right_volume,0)),
    'estimated_commission',round(least(coalesce(a.left_volume,0),coalesce(a.right_volume,0))*0.08,2),
    'total_earned',coalesce(a.total_binary_earned,0),'last_cut_at',a.last_cut_at,
    'left_member',(select jsonb_build_object('username',p.username,'email',p.email) from public.profiles p where p.binary_parent_id=(select auth.uid()) and p.binary_side='LEFT' limit 1),
    'right_member',(select jsonb_build_object('username',p.username,'email',p.email) from public.profiles p where p.binary_parent_id=(select auth.uid()) and p.binary_side='RIGHT' limit 1),
    'recent_cuts',coalesce((select jsonb_agg(to_jsonb(x) order by x.cut_date desc) from (select cut_date,matched_volume,commission,left_carry,right_carry from public.binary_cuts where user_id=(select auth.uid()) order by cut_date desc limit 7)x),'[]'::jsonb)
  ) from (select 1) q left join public.binary_accounts a on a.user_id=(select auth.uid());
$$;
revoke execute on function public.get_my_binary_summary() from public, anon;
grant execute on function public.get_my_binary_summary() to authenticated;

-- ROOT oficial y enlace base.
do $$ declare v_root uuid; v_owner uuid; begin
  select id into v_root from auth.users where lower(email)='rafaeldelacruz0072024@gmail.com' limit 1;
  if v_root is not null then
    select id into v_owner from public.profiles where ref_code='GK-NOVA-ROOT' and id<>v_root limit 1;
    if v_owner is not null then
      raise exception 'El codigo GK-NOVA-ROOT ya pertenece a otro perfil';
    end if;
    update public.profiles set ref_code='GK-NOVA-ROOT',role='admin',status='active',referred_by=null,binary_parent_id=null,binary_side=null where id=v_root;
    update public.system_settings set default_sponsor_id=v_root;
    insert into public.binary_accounts(user_id) values(v_root) on conflict do nothing;
  end if;
end $$;

-- ===========================================================================
-- MIGRACION 2: allow_root_referral_code (acepta GK-NOVA-ROOT)
-- ===========================================================================
-- The public registration flow accepts the existing ROOT referral code.
-- GK-NOVA-ROOT includes a second hyphen, so the former ^GK-[A-Z0-9]{4,30}$
-- expression rejected a valid active sponsor before the signup could begin.
create or replace function public.validate_sponsor_code(p_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as 'select exists (
  select 1
  from public.profiles
  where ref_code = upper(trim(coalesce(p_code, '''')))
    and upper(trim(coalesce(p_code, ''''))) ~ ''^GK-[A-Z0-9-]{4,30}$''
    and status = ''active''
);';

revoke all on function public.validate_sponsor_code(text) from public, authenticated;
grant execute on function public.validate_sponsor_code(text) to anon, authenticated;

-- ===========================================================================
-- MIGRACION 3: repair_root_binary_and_registration_trigger (handle_new_user)
-- ===========================================================================
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

-- ===========================================================================
-- MIGRACION 4: fix_nova_referrals_and_commissions (saldo indicacion directa)
-- ===========================================================================
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

-- ===========================================================================
-- MIGRACION 5: fix_authenticated_profile_access
-- ===========================================================================
-- Allow authenticated users to evaluate the admin branch used by the
-- profiles RLS policy. The function is SECURITY DEFINER and only returns a
-- boolean, while the policy still limits profile rows to the owner or admins.
revoke all on function private.is_admin(uuid) from public, anon;
grant execute on function private.is_admin(uuid) to authenticated;

-- ===========================================================================
-- MIGRACION 6: add_binary_tree_summary
-- ===========================================================================
-- NOVA Digital: arbol binario visible solo para el propietario conectado.
create or replace function public.get_my_binary_tree(p_max_depth integer default 6)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with recursive tree as (
    select
      p.id, p.binary_parent_id, p.binary_side, p.username, p.full_name, p.email,
      0 as depth,
      array[p.id] as path
    from public.profiles p
    where p.id = (select auth.uid())

    union all

    select
      child.id, child.binary_parent_id, child.binary_side, child.username,
      child.full_name, child.email, tree.depth + 1, tree.path || child.id
    from public.profiles child
    join tree on child.binary_parent_id = tree.id
    where tree.depth < greatest(1, least(coalesce(p_max_depth, 6), 12))
      and not child.id = any(tree.path)
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'parent_id', binary_parent_id,
        'side', binary_side,
        'username', coalesce(username, full_name, split_part(email, '@', 1), 'Usuario'),
        'depth', depth
      ) order by depth, username
    ),
    '[]'::jsonb
  )
  from tree;
$$;

revoke all on function public.get_my_binary_tree(integer) from public, anon;
grant execute on function public.get_my_binary_tree(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- REPARACION DE DATOS: usuarios registrados durante el periodo GEMINIX
-- estaban en binary_nodes; se sincronizan al esquema NOVA (profiles).
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='binary_nodes') then
    for r in select * from public.binary_nodes loop
      begin
        update public.profiles
        set binary_parent_id = coalesce(binary_parent_id, r.placement_id),
            binary_side = coalesce(binary_side, r.position),
            binary_registered_at = coalesce(binary_registered_at, now()),
            updated_at = now()
        where id = r.user_id;
        insert into public.binary_accounts(user_id) values (r.user_id) on conflict do nothing;
      exception when others then
        raise notice 'Salto usuario % (conflict binario): %', r.user_id, sqlerrm;
      end;
    end loop;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- VERIFICACION FINAL
-- Debe mostrar: complete_registration con p_binary_side (9 args) y NO versiones viejas
-- ---------------------------------------------------------------------------
select p.proname, pg_get_function_identity_arguments(p.oid) as argumentos
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'complete_registration';

select count(*) as usuarios_con_binary_accounts from public.binary_accounts;
select ref_code, role from public.profiles where ref_code = 'GK-NOVA-ROOT';
