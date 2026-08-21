-- NOVA Digital email delivery audit and idempotency ledger.
create table if not exists public.email_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('WELCOME', 'WITHDRAWAL_REQUESTED')),
  event_key text not null,
  recipient_email text not null,
  provider_message_id text,
  status text not null default 'PENDING' check (status in ('PENDING', 'SENT', 'FAILED')),
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (user_id, event_type, event_key)
);

create index if not exists email_notifications_user_created_idx
  on public.email_notifications(user_id, created_at desc);

alter table public.email_notifications enable row level security;

drop policy if exists email_notifications_select_own on public.email_notifications;
create policy email_notifications_select_own
  on public.email_notifications
  for select
  to authenticated
  using (user_id = auth.uid());

revoke all on public.email_notifications from public, anon, authenticated;
grant select on public.email_notifications to authenticated;

comment on table public.email_notifications is
  'Auditable, idempotent delivery ledger for transactional NOVA Digital emails.';
