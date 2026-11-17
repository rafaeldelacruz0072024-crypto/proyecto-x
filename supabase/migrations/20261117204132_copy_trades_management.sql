-- Copy profiles and manually recorded operations. No exchange orders or wallet transfers.
alter table public.copy_traders add column if not exists trading_style text not null default 'Spot' check (char_length(trim(trading_style)) between 1 and 80);
alter table public.copy_traders add column if not exists trading_pairs text[] not null default '{}' check (cardinality(trading_pairs) <= 30);
create table public.copy_manual_trades (
 id uuid primary key default gen_random_uuid(),
 trader_id uuid not null references public.copy_traders(id) on delete restrict,
 pair text not null check (char_length(trim(pair)) between 1 and 40),
 operation_type text not null check (operation_type in ('compra','venta','long','short')),
 entry_price numeric(28,12) not null check (entry_price > 0),
 exit_price numeric(28,12) check (exit_price > 0),
 return_pct numeric(12,4),
 status text not null default 'open' check (status in ('open','closed')),
 opened_at timestamptz not null default now(),
 closed_at timestamptz,
 created_at timestamptz not null default now(),
 check ((status='open' and exit_price is null and return_pct is null and closed_at is null) or (status='closed' and exit_price is not null and return_pct is not null and closed_at is not null)),
 check (closed_at is null or closed_at >= opened_at)
);
create index copy_manual_trades_trader_opened_idx on public.copy_manual_trades(trader_id,opened_at desc);
alter table public.copy_manual_trades enable row level security;
revoke all on public.copy_manual_trades from public, anon, authenticated;
grant select,insert,update on public.copy_manual_trades to authenticated;
create policy copy_manual_trades_read on public.copy_manual_trades for select to authenticated using (private.is_admin((select auth.uid())) or exists (select 1 from public.copy_traders t where t.id = trader_id and t.active));
create policy copy_manual_trades_insert on public.copy_manual_trades for insert to authenticated with check (private.is_admin((select auth.uid())));
create policy copy_manual_trades_update on public.copy_manual_trades for update to authenticated using (private.is_admin((select auth.uid()))) with check (private.is_admin((select auth.uid())));
comment on table public.copy_manual_trades is 'Manual informational records only; no execution, settlement, wallet balance or earnings.';
