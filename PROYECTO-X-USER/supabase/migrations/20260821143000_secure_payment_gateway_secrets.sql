-- Payment credentials are server secrets. No browser role may read this table.
alter table if exists public.system_gateways enable row level security;

drop policy if exists system_gateways_select_authenticated on public.system_gateways;
drop policy if exists "system_gateways_select_authenticated" on public.system_gateways;
drop policy if exists system_gateways_admin_all on public.system_gateways;

revoke all on table public.system_gateways from anon, authenticated;

comment on table public.system_gateways is
  'Legacy gateway metadata. API keys and IPN secrets must live in Supabase Edge Function secrets.';
