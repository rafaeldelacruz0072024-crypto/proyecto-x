create table public.copy_traders (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  wallet text not null default '' check (length(wallet) <= 100),
  risk text not null check (risk in ('bajo','medio','alto')),
  pnl_total numeric(12,2) not null default 0,
  pnl_7d numeric(12,2) not null default 0,
  pnl_30d numeric(12,2) not null default 0,
  pnl_90d numeric(12,2) not null default 0,
  win_rate numeric(5,2) not null default 0 check (win_rate between 0 and 100),
  drawdown numeric(5,2) not null default 0 check (drawdown between 0 and 100),
  copiers integer not null default 0 check (copiers >= 0),
  commission numeric(5,2) not null default 0 check (commission between 0 and 100),
  is_demo boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.copy_traders enable row level security;
grant select, insert, update on public.copy_traders to authenticated;
create policy copy_traders_read on public.copy_traders for select to authenticated using (active or private.is_admin((select auth.uid())));
create policy copy_traders_insert on public.copy_traders for insert to authenticated with check (private.is_admin((select auth.uid())));
create policy copy_traders_update on public.copy_traders for update to authenticated using (private.is_admin((select auth.uid()))) with check (private.is_admin((select auth.uid())));
insert into public.copy_traders (name, wallet, risk, pnl_total, pnl_7d, pnl_30d, pnl_90d, win_rate, drawdown, copiers, commission, is_demo) values
('Nova Alpha', 'Ejemplo', 'bajo', 28.5, 1.4, 6.8, 16.2, 72, 8.5, 0, 10, true),
('Nova Balance', 'Ejemplo', 'medio', 19.7, -0.8, 4.3, 11.6, 65, 14, 0, 12, true),
('Nova Momentum', 'Ejemplo', 'alto', 35.2, 2.6, 8.1, 20.4, 61, 24, 0, 15, true);
