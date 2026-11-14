create table public.nova_ia_subscriptions (
  user_id uuid primary key references public.profiles(id),
  paid_until timestamptz not null
);
create table public.nova_ia_orders (
  id uuid primary key,
  user_id uuid not null references public.profiles(id),
  payment_id text not null unique,
  confirmed_at timestamptz
);
create table public.nova_ia_admin_grants (
  user_id uuid not null references public.profiles(id),
  admin_id uuid not null references public.profiles(id),
  granted_at timestamptz not null default now()
);
alter table public.nova_ia_subscriptions enable row level security;
alter table public.nova_ia_orders enable row level security;
alter table public.nova_ia_admin_grants enable row level security;
revoke all on public.nova_ia_subscriptions, public.nova_ia_orders, public.nova_ia_admin_grants from public, anon, authenticated;
grant select on public.nova_ia_subscriptions to authenticated;
grant insert on public.nova_ia_orders to service_role;
create policy nova_ia_read_own on public.nova_ia_subscriptions for select to authenticated using (user_id = (select auth.uid()));

create function private.extend_nova_ia(p_user_id uuid) returns timestamptz
language sql set search_path = '' as $$
  insert into public.nova_ia_subscriptions as subscription (user_id, paid_until)
  values (p_user_id, now() + interval '1 month')
  on conflict (user_id) do update
    set paid_until = greatest(subscription.paid_until, now()) + interval '1 month'
  returning paid_until;
$$;

create function public.confirm_nova_ia_payment(p_id uuid, p_payment_id text, p_amount numeric)
returns void language plpgsql security definer set search_path = '' as $$
declare
  payment public.nova_ia_orders%rowtype;
begin
  select * into payment from public.nova_ia_orders
  where id = p_id and payment_id = p_payment_id for update;
  if not found or p_amount is distinct from 50::numeric then raise exception 'Orden Nova IA inválida'; end if;
  if payment.confirmed_at is not null then return; end if;
  perform private.extend_nova_ia(payment.user_id);
  update public.nova_ia_orders set confirmed_at = now() where id = payment.id;
end;
$$;

create function public.admin_activate_nova_ia(p_user_id uuid)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  expires_at timestamptz;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'No autorizado';
  end if;

  insert into public.nova_ia_subscriptions as subscription (user_id, paid_until)
  values (p_user_id, now() + interval '1 month')
  on conflict (user_id) do update set paid_until = excluded.paid_until
  where subscription.paid_until <= now()
  returning paid_until into expires_at;

  if found then
    insert into public.nova_ia_admin_grants (user_id, admin_id) values (p_user_id, auth.uid());
  else
    select paid_until into expires_at from public.nova_ia_subscriptions where user_id = p_user_id;
  end if;
  return expires_at;
end;
$$;

revoke all on function private.extend_nova_ia(uuid), public.confirm_nova_ia_payment(uuid,text,numeric), public.admin_activate_nova_ia(uuid) from public, anon, authenticated;
grant execute on function public.confirm_nova_ia_payment(uuid,text,numeric) to service_role;
grant execute on function public.admin_activate_nova_ia(uuid) to authenticated;

create function private.run_nova_ia()
returns void language plpgsql security definer set search_path = '' as $$
declare
  subscriber record;
  cycle record;
  task text;
  previous_claim text := current_setting('request.jwt.claim.sub', true);
  previous_claims text := current_setting('request.jwt.claims', true);
  local_day date := (now() at time zone 'America/Santo_Domingo')::date;
begin
  if extract(isodow from local_day) not between 1 and 5 then return; end if;
  for subscriber in
    select s.user_id
    from public.nova_ia_subscriptions s join public.profiles p on p.id = s.user_id
    where p.status = 'active' and s.paid_until > now()
  loop
    begin

      -- Serialize cancellation and processing for this subscription.
      perform 1 from public.nova_ia_subscriptions
      where user_id = subscriber.user_id and paid_until > now() for update;
      if not found then continue; end if;

      perform set_config('request.jwt.claim.sub', subscriber.user_id::text, true);
      perform set_config('request.jwt.claims', jsonb_build_object('sub', subscriber.user_id, 'role', 'authenticated')::text, true);

      for cycle in
        select i.id
        from public.investments i
        where i.user_id = subscriber.user_id and i.status = 'ACTIVE'
          and i.last_cycle_activation_on is distinct from local_day
          and not exists (
            select 1 from public.roi_daily_task_completions c
            where c.investment_id = i.id and c.user_id = subscriber.user_id
            group by c.task_day
            having count(distinct c.task_code) = 4
              and now() < private.next_business_cutoff(max(c.completed_at))
          )
        order by i.id
      loop
        begin
          foreach task in array array['SYNC_NODE', 'VALIDATE_BLOCK', 'AUDIT_MEMPOOL', 'SIGN_CHECKPOINT']
          loop
            perform private.complete_roi_cycle_task(subscriber.user_id, cycle.id, task);
          end loop;
        exception when others then
          raise warning 'Nova IA: ciclo %, SQLSTATE %', cycle.id, sqlstate;
        end;
      end loop;
      perform set_config('request.jwt.claim.sub', coalesce(previous_claim, ''), true);
      perform set_config('request.jwt.claims', coalesce(previous_claims, ''), true);
    exception when others then
      raise warning 'Nova IA: suscripción %, SQLSTATE %', subscriber.user_id, sqlstate;
    end;
  end loop;
end;
$$;

revoke all on function private.run_nova_ia() from public, anon, authenticated;
select cron.schedule('nova-ia-cycle-tasks', '*/15 * * * 1-6', 'select private.run_nova_ia()');
