create extension if not exists pg_net;
create extension if not exists pg_cron;
revoke all on net.http_request_queue, net._http_response from public, anon, authenticated;
create schema if not exists private;

create table private.nova_transactional_emails (
  event_key text primary key,
  recipient text not null,
  subject text not null,
  message text not null,
  created_at timestamptz not null default now(),
  next_attempt_at timestamptz not null default now(),
  attempts integer not null default 0,
  request_id bigint,
  sent_at timestamptz,
  failed_at timestamptz
);
alter table private.nova_transactional_emails enable row level security;
revoke all on private.nova_transactional_emails from public, anon, authenticated;

create function private.queue_nova_transactional_email()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  recipient_email text;
  event_key text;
  email_subject text;
  email_message text;
begin
  if tg_table_name = 'profiles' then
    if new.role is distinct from 'user' then return new; end if;
    select email into recipient_email from auth.users where id = new.id;
    event_key := 'welcome/' || new.id;
    email_subject := 'Te damos la bienvenida a Nova';
    email_message := 'Tu cuenta de Nova ya está disponible. Accede en https://app.novacopy.digital/login';
  else
    if tg_op = 'INSERT' and upper(new.status) = 'PENDING' then
      event_key := 'withdrawal-requested/' || new.id;
      email_subject := 'Recibimos tu solicitud de retiro';
      email_message := 'Tu solicitud de retiro está pendiente de revisión.';
    elsif tg_op = 'UPDATE' and upper(new.status) = 'COMPLETED'
          and upper(old.status) is distinct from 'COMPLETED' then
      event_key := 'withdrawal-completed/' || new.id;
      email_subject := 'Tu retiro se completó';
      email_message := 'Nova registró el pago de tu retiro como completado.';
    else
      return new;
    end if;
    select email into recipient_email from auth.users where id = new.user_id;
    email_message := email_message || E'\n\nReferencia: ' || new.id
      || E'\nPuedes revisar los detalles en https://app.novacopy.digital/login';
  end if;

  if recipient_email is not null and recipient_email ~ '^[^[:space:]@,<>]+@[^[:space:]@,<>]+$' then
    insert into private.nova_transactional_emails(event_key, recipient, subject, message)
    values (event_key, recipient_email, email_subject, email_message)
    on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function private.queue_nova_transactional_email() from public, anon, authenticated;

create trigger nova_welcome_email after insert on public.profiles
for each row execute function private.queue_nova_transactional_email();
create trigger nova_withdrawal_email after insert or update of status on public.withdrawals
for each row execute function private.queue_nova_transactional_email();

create function private.send_nova_transactional_emails()
returns void language plpgsql security definer set search_path = ''
as $$
declare
  api_key text;
  item private.nova_transactional_emails%rowtype;
  response_status integer;
  new_request_id bigint;
begin
  select decrypted_secret into api_key from vault.decrypted_secrets where name = 'RESEND_API_KEY';
  if nullif(btrim(api_key), '') is null then return; end if;

  for item in
    select * from private.nova_transactional_emails
    where sent_at is null and failed_at is null and next_attempt_at <= now()
    order by created_at limit 10 for update skip locked
  loop
    if item.request_id is not null then
      select status_code into response_status from net._http_response where id = item.request_id;
      if response_status between 200 and 299 then
        update private.nova_transactional_emails set sent_at = now() where event_key = item.event_key;
        continue;
      end if;
    end if;
    if item.attempts >= 5 or item.created_at < now() - interval '23 hours' then
      update private.nova_transactional_emails set failed_at = now() where event_key = item.event_key;
      continue;
    end if;

    new_request_id := net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object('Authorization', 'Bearer ' || api_key,
        'Content-Type', 'application/json', 'Idempotency-Key', item.event_key),
      body := jsonb_build_object('from', 'Nova Digital <notificaciones@avisos.novacopy.digital>',
        'to', jsonb_build_array(item.recipient), 'subject', item.subject, 'text', item.message),
      timeout_milliseconds := 10000
    );

    update private.nova_transactional_emails
    set request_id = new_request_id, attempts = attempts + 1,
        next_attempt_at = now() + make_interval(mins => 2 * (attempts + 1))
    where event_key = item.event_key;
  end loop;
end;
$$;
revoke all on function private.send_nova_transactional_emails() from public, anon, authenticated;

select cron.schedule('nova-transactional-emails', '* * * * *',
  'select private.send_nova_transactional_emails()');
