create table public.site_stats (
  id integer primary key check (id = 1),
  registered_users integer not null check (registered_users >= 0),
  active_investors integer not null check (active_investors >= 0),
  active_investments integer not null check (active_investments >= 0),
  active_capital numeric(14,2) not null check (active_capital >= 0 and active_capital <> 'NaN'),
  as_of date not null,
  updated_at timestamptz not null default now()
);
insert into public.site_stats values (1,22,3,3,1100,'2026-11-23',now());
alter table public.site_stats enable row level security;
revoke all on public.site_stats from public, anon, authenticated;
grant select on public.site_stats to anon, authenticated;
grant update (registered_users,active_investors,active_investments,active_capital,as_of) on public.site_stats to authenticated;
create policy public_landing_figures on public.site_stats for select to anon,authenticated using (true);
create policy admin_edits_landing on public.site_stats for update to authenticated
using (exists (select 1 from public.profiles where id=(select auth.uid()) and role='admin'))
with check (exists (select 1 from public.profiles where id=(select auth.uid()) and role='admin'));
create function private.stamp_landing_stats() returns trigger language plpgsql set search_path='' as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;
create trigger stamp_landing_stats before update on public.site_stats for each row execute function private.stamp_landing_stats();
