-- Administrative configuration only. Does not move funds or accrue returns.
alter table public.copy_traders
  add column if not exists daily_rate numeric(7,4) not null default 0
  check (daily_rate >= 0 and daily_rate <= 100);
comment on column public.copy_traders.daily_rate is
  'Daily percentage on original capital. Configuration only; no automatic credit or live copy trading is enabled.';
