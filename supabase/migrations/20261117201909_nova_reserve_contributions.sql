-- Manual reserve contributions. Recording or approving a reference does not transfer money.
create table public.nova_reserve_contributions (
  id uuid primary key default gen_random_uuid(),
  amount numeric(18,2) not null check (amount > 0),
  proof_reference text not null check (length(trim(proof_reference)) between 4 and 500),
  notes text not null default '' check (length(notes) <= 1000),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_by uuid not null references public.profiles(id),
  reviewed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  check ((status = 'pending' and reviewed_by is null and reviewed_at is null) or (status in ('approved','rejected') and reviewed_by is not null and reviewed_at is not null))
);
alter table public.nova_reserve_contributions enable row level security;
revoke all on public.nova_reserve_contributions from public, anon, authenticated;
grant select on public.nova_reserve_contributions to authenticated;
create policy nova_reserve_admin_read on public.nova_reserve_contributions for select to authenticated using (private.is_admin((select auth.uid())));

create function public.nova_reserve_submit(p_amount numeric, p_proof_reference text, p_notes text default '')
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_id uuid;
begin
 if v_user is null or not private.is_admin(v_user) then raise exception 'No autorizado'; end if;
 if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount,2) then raise exception 'Monto inválido'; end if;
 insert into public.nova_reserve_contributions(amount, proof_reference, notes, created_by)
 values (p_amount, trim(p_proof_reference), coalesce(trim(p_notes),''), v_user) returning id into v_id;
 return v_id;
end; $$;
revoke all on function public.nova_reserve_submit(numeric,text,text) from public, anon;
grant execute on function public.nova_reserve_submit(numeric,text,text) to authenticated;

create function public.nova_reserve_review(p_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid();
begin
 if v_user is null or not private.is_admin(v_user) then raise exception 'No autorizado'; end if;
 if p_id is null or p_approve is null then raise exception 'Revisión inválida'; end if;
 update public.nova_reserve_contributions set status = case when p_approve then 'approved' else 'rejected' end,
 reviewed_by = v_user, reviewed_at = now() where id = p_id and status = 'pending';
 if not found then raise exception 'Aporte no encontrado o ya revisado'; end if;
end; $$;
revoke all on function public.nova_reserve_review(uuid,boolean) from public, anon;
grant execute on function public.nova_reserve_review(uuid,boolean) to authenticated;
