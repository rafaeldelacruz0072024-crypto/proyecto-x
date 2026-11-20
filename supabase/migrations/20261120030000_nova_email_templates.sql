create function private.render_nova_transactional_email(event_key text)
returns text language plpgsql immutable set search_path = ''
as $render$
declare
  reference_id text := split_part(event_key, '/', 2);
  template text;
begin
  -- Only internal event keys with UUID references can reach the HTML.
  if reference_id !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then return null; end if;
  case split_part(event_key, '/', 1)
    when 'welcome' then template := $html$
<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Te damos la bienvenida a Nova</title></head>
<body style="margin:0;background:#050e0b;font-family:Arial,sans-serif;color:#f0f8f4">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">Tu cuenta ya está disponible.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#050e0b"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#0b1713;border:1px solid #244134">
<tr><td><img src="https://app.novacopy.digital/nova-email-header.jpg" width="600" alt="Nova Copy Trade" style="display:block;width:100%;max-width:600px;height:auto;border:0"></td></tr>
<tr><td style="padding:30px 24px;border-top:3px solid #a9ec35">
<p style="margin:0;color:#baf465;font-size:14px;font-weight:bold">Tu cuenta de Nova</p>
<h1 style="margin:10px 0 18px;font-size:29px;line-height:1.2;color:#fff">Te damos la bienvenida a Nova</h1>
<p style="margin:0 0 12px;line-height:1.6;color:#f0f8f4">Tu cuenta ya está disponible.</p>
<p style="margin:0 0 18px;line-height:1.6;color:#c3d6cd">Desde tu panel puedes consultar tu saldo, revisar tus movimientos y acceder a las herramientas de Nova.</p>

<a href="https://app.novacopy.digital/login" style="display:inline-block;padding:14px 20px;background:#baf465;color:#0a180d;text-decoration:none;font-weight:bold;border-radius:6px">Ir a mi cuenta</a>
</td></tr>
<tr><td style="padding:18px 24px;border-top:1px solid #244134;color:#adc5b9;font-size:13px;line-height:1.5">Nova Digital · Aviso automático de tu cuenta</td></tr>
</table></td></tr></table></body></html>
$html$;
    when 'withdrawal-requested' then template := $html$
<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Recibimos tu solicitud de retiro</title></head>
<body style="margin:0;background:#050e0b;font-family:Arial,sans-serif;color:#f0f8f4">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">Tu solicitud quedó registrada y está pendiente de revisión.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#050e0b"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#0b1713;border:1px solid #244134">
<tr><td><img src="https://app.novacopy.digital/nova-email-header.jpg" width="600" alt="Nova Copy Trade" style="display:block;width:100%;max-width:600px;height:auto;border:0"></td></tr>
<tr><td style="padding:30px 24px;border-top:3px solid #a9ec35">
<p style="margin:0;color:#baf465;font-size:14px;font-weight:bold">Pendiente de revisión</p>
<h1 style="margin:10px 0 18px;font-size:29px;line-height:1.2;color:#fff">Recibimos tu solicitud de retiro</h1>
<p style="margin:0 0 12px;line-height:1.6;color:#f0f8f4">Tu solicitud quedó registrada y está pendiente de revisión.</p>
<p style="margin:0 0 18px;line-height:1.6;color:#c3d6cd">Puedes consultar el estado en Finanzas. Te avisaremos por correo cuando el pago se complete.</p>
<p style="margin:24px 0;background:#10251d;padding:16px;color:#def5e9;border-left:3px solid #a9ec35;overflow-wrap:anywhere">Referencia del retiro: {{referencia}}</p>
<a href="https://app.novacopy.digital/login" style="display:inline-block;padding:14px 20px;background:#baf465;color:#0a180d;text-decoration:none;font-weight:bold;border-radius:6px">Consultar mi retiro</a>
</td></tr>
<tr><td style="padding:18px 24px;border-top:1px solid #244134;color:#adc5b9;font-size:13px;line-height:1.5">Nova Digital · Aviso automático de tu cuenta</td></tr>
</table></td></tr></table></body></html>
$html$;
    when 'withdrawal-completed' then template := $html$
<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tu retiro se completó</title></head>
<body style="margin:0;background:#050e0b;font-family:Arial,sans-serif;color:#f0f8f4">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">Nova registró el pago de tu retiro como completado.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#050e0b"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#0b1713;border:1px solid #244134">
<tr><td><img src="https://app.novacopy.digital/nova-email-header.jpg" width="600" alt="Nova Copy Trade" style="display:block;width:100%;max-width:600px;height:auto;border:0"></td></tr>
<tr><td style="padding:30px 24px;border-top:3px solid #a9ec35">
<p style="margin:0;color:#baf465;font-size:14px;font-weight:bold">Pago completado</p>
<h1 style="margin:10px 0 18px;font-size:29px;line-height:1.2;color:#fff">Tu retiro se completó</h1>
<p style="margin:0 0 12px;line-height:1.6;color:#f0f8f4">Nova registró el pago de tu retiro como completado.</p>
<p style="margin:0 0 18px;line-height:1.6;color:#c3d6cd">En Finanzas puedes consultar los detalles de la operación y el identificador de la transacción.</p>
<p style="margin:24px 0;background:#10251d;padding:16px;color:#def5e9;border-left:3px solid #a9ec35;overflow-wrap:anywhere">Referencia del retiro: {{referencia}}</p>
<a href="https://app.novacopy.digital/login" style="display:inline-block;padding:14px 20px;background:#baf465;color:#0a180d;text-decoration:none;font-weight:bold;border-radius:6px">Ver detalle del retiro</a>
</td></tr>
<tr><td style="padding:18px 24px;border-top:1px solid #244134;color:#adc5b9;font-size:13px;line-height:1.5">Nova Digital · Aviso automático de tu cuenta</td></tr>
</table></td></tr></table></body></html>
$html$;
    else return null;
  end case;
  return replace(template, '{{referencia}}', reference_id);
end;
$render$;

revoke all on function private.render_nova_transactional_email(text) from public, anon, authenticated;

create or replace function private.send_nova_transactional_emails()
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
        'to', jsonb_build_array(item.recipient), 'subject', item.subject, 'text', item.message,
        'html', private.render_nova_transactional_email(item.event_key)),
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
