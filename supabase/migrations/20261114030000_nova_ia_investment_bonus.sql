create table public.nova_ia_investment_grants (
  user_id uuid primary key references public.profiles(id),
  granted_at timestamptz not null default now()
);

alter table public.nova_ia_investment_grants enable row level security;
revoke all on public.nova_ia_investment_grants from public, anon, authenticated;

create function private.grant_nova_ia_investment_bonus()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  recipient uuid;
  granted_count integer := 0;
begin
  for recipient in
    insert into public.nova_ia_investment_grants (user_id)
    select investment.user_id
    from public.investments investment
    join public.profiles profile on profile.id = investment.user_id
    where investment.status = 'ACTIVE'
      and profile.status = 'active'
      and not exists (
        select 1 from public.nova_ia_investment_grants grant_record
        where grant_record.user_id = investment.user_id
      )
    group by investment.user_id
    having sum(investment.amount) > 1000
    order by investment.user_id
    on conflict (user_id) do nothing
    returning user_id
  loop
    perform private.extend_nova_ia(recipient);
    granted_count := granted_count + 1;
  end loop;
  return granted_count;
end;
$$;

revoke all on function private.grant_nova_ia_investment_bonus() from public, anon, authenticated;

select private.grant_nova_ia_investment_bonus();
select cron.schedule(
  'nova-ia-investment-bonus',
  '* * * * *',
  'select private.grant_nova_ia_investment_bonus()'
);
