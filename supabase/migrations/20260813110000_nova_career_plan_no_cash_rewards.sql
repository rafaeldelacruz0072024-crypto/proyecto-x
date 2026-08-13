-- NOVA Career Plan replaces the legacy weekly/biweekly cash salary.
-- This migration preserves historical transactions and only stops future cash claims.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'system_settings'
      and column_name = 'salary_config'
  ) then
    execute 'update public.system_settings set salary_config = ''[]''';
  end if;
end;
$$;

create table if not exists public.career_rewards (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  rank_name text not null,
  required_team_volume numeric not null check (required_team_volume >= 0),
  reward_title text not null,
  reward_category text not null check (reward_category in ('recognition', 'tablet', 'phone', 'laptop', 'event_trip', 'international_trip')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.career_awards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  career_reward_id uuid not null references public.career_rewards(id) on delete restrict,
  status text not null default 'pending_validation' check (status in ('pending_validation', 'approved', 'delivered', 'rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, career_reward_id)
);

insert into public.career_rewards (code, rank_name, required_team_volume, reward_title, reward_category) values
  ('BRONZE', 'Bronze', 10000, 'Reconocimiento NOVA', 'recognition'),
  ('SILVER', 'Silver', 25000, 'Tablet', 'tablet'),
  ('GOLD', 'Gold', 40000, 'Teléfono móvil', 'phone'),
  ('GOLD_II', 'Gold II', 65000, 'Acceso a evento NOVA', 'event_trip'),
  ('PLATINUM', 'Platinum', 100000, 'Laptop', 'laptop'),
  ('DIAMOND', 'Diamond', 200000, 'Viaje a evento NOVA', 'event_trip'),
  ('DIAMOND_II', 'Diamond II', 400000, 'Viaje internacional a evento', 'international_trip'),
  ('BLACK_CROWN', 'Black Crown', 800000, 'Experiencia NOVA Black Crown', 'recognition'),
  ('LEGEND', 'Legend', 1000000, 'Experiencia NOVA Legend', 'recognition')
on conflict (code) do update set
  rank_name = excluded.rank_name,
  required_team_volume = excluded.required_team_volume,
  reward_title = excluded.reward_title,
  reward_category = excluded.reward_category,
  active = true,
  updated_at = now();

alter table public.career_rewards enable row level security;
alter table public.career_awards enable row level security;

drop policy if exists career_rewards_read_active on public.career_rewards;
create policy career_rewards_read_active on public.career_rewards for select to authenticated
using (active or private.is_admin((select auth.uid())));

drop policy if exists career_rewards_admin_write on public.career_rewards;
create policy career_rewards_admin_write on public.career_rewards for all to authenticated
using (private.is_admin((select auth.uid())))
with check (private.is_admin((select auth.uid())));

drop policy if exists career_awards_select_own_or_admin on public.career_awards;
create policy career_awards_select_own_or_admin on public.career_awards for select to authenticated
using (user_id = (select auth.uid()) or private.is_admin((select auth.uid())));

drop policy if exists career_awards_admin_write on public.career_awards;
create policy career_awards_admin_write on public.career_awards for all to authenticated
using (private.is_admin((select auth.uid())))
with check (private.is_admin((select auth.uid())));

grant select on public.career_rewards, public.career_awards to authenticated;
grant insert, update, delete on public.career_rewards, public.career_awards to authenticated;

-- Retire known server-side cash claim entry points if they exist. Historical
-- transactions and withdrawals are intentionally untouched.
do $$
declare
  candidate regprocedure;
begin
  foreach candidate in array array[
    to_regprocedure('public.claim_weekly_bonus(uuid,numeric)'),
    to_regprocedure('public.reset_weekly_volume(uuid)')
  ] loop
    if candidate is not null then
      execute format('revoke execute on function %s from public, anon, authenticated', candidate);
    end if;
  end loop;
end;
$$;
