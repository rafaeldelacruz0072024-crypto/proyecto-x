import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

const money = (value: number) => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
}).format(value)

serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  // El enlace no entrega una sesión: sólo confirma un identificador UUID de un solo uso.
  if (req.method === 'GET') {
    const requestId = new URL(req.url).searchParams.get('confirm_wallet')
    const withdrawalRequestId = new URL(req.url).searchParams.get('confirm_withdrawal')
    if ((!requestId && !withdrawalRequestId) || !supabaseUrl || !serviceRoleKey) return new Response('Invalid confirmation link', { status: 400 })
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    if (withdrawalRequestId) {
      const { data: pendingWithdrawal } = await admin.from('withdrawal_confirmation_requests')
        .select('id,withdrawal_id,expires_at,confirmed_at').eq('id', withdrawalRequestId).maybeSingle()
      if (!pendingWithdrawal || pendingWithdrawal.confirmed_at || new Date(pendingWithdrawal.expires_at) < new Date()) {
        return new Response('This confirmation link is invalid or expired.', { status: 400 })
      }
      const { error } = await admin.from('withdrawals').update({ status: 'PENDING' }).eq('id', pendingWithdrawal.withdrawal_id).eq('status', 'EMAIL_CONFIRMATION_PENDING')
      if (error) return new Response('Could not confirm withdrawal.', { status: 500 })
      await admin.from('withdrawal_confirmation_requests').update({ confirmed_at: new Date().toISOString() }).eq('id', pendingWithdrawal.id)
      const appUrl = Deno.env.get('NOVA_APP_URL') ?? 'https://proyecto-x-user.vercel.app/login'
      return Response.redirect(`${appUrl}?withdrawal-confirmed=1`, 302)
    }
    const { data: pending } = await admin.from('wallet_confirmation_requests')
      .select('id,user_id,wallet_address,expires_at,confirmed_at').eq('id', requestId).maybeSingle()
    if (!pending || pending.confirmed_at || new Date(pending.expires_at) < new Date()) {
      return new Response('This confirmation link is invalid or expired.', { status: 400 })
    }
    const { error } = await admin.from('profiles').update({
      withdrawal_wallet: pending.wallet_address,
      withdrawal_wallet_confirmed_at: new Date().toISOString(),
      two_factor_enabled: false,
    }).eq('id', pending.user_id)
    if (error) return new Response('Could not confirm wallet.', { status: 500 })
    await admin.from('wallet_confirmation_requests').update({ confirmed_at: new Date().toISOString() }).eq('id', pending.id)
    const appUrl = Deno.env.get('NOVA_APP_URL') ?? 'https://proyecto-x-user.vercel.app/login'
    return Response.redirect(`${appUrl}?wallet-confirmed=1`, 302)
  }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? ''
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? ''
  const replyTo = Deno.env.get('RESEND_REPLY_TO') ?? ''
  const authorization = req.headers.get('Authorization') ?? ''

  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: 'Supabase configuration missing' }, 500)
  if (!resendApiKey || !fromEmail) return json({ error: 'Email provider configuration missing' }, 503)
  if (!authorization.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  })
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: { user }, error: userError } = await userClient.auth.getUser()
  if (userError || !user?.email) return json({ error: 'Unauthorized' }, 401)

  let payload: { type?: string; withdrawalId?: string; confirmationId?: string; walletAddress?: string }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const type = payload.type === 'WITHDRAWAL_REQUESTED' ? 'WITHDRAWAL_REQUESTED' : payload.type === 'WELCOME' ? 'WELCOME' : payload.type === 'WALLET_CONFIRMATION' ? 'WALLET_CONFIRMATION' : null
  if (!type) return json({ error: 'Unsupported notification type' }, 400)

  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, username')
    .eq('id', user.id)
    .maybeSingle()

  const displayName = profile?.full_name || profile?.username || 'miembro NOVA'
  let eventKey = user.id
  let subject = 'Bienvenido a NOVA Digital'
  let preheader = 'Tu cuenta ya forma parte del ecosistema NOVA Digital.'
  let content = `
    <h1 style="margin:0 0 16px;color:#fff;font-size:28px">Bienvenido a NOVA Digital</h1>
    <p style="color:#cbd5e1;font-size:16px;line-height:1.7">Hola ${displayName}, tu cuenta fue creada correctamente.</p>
    <p style="color:#cbd5e1;font-size:16px;line-height:1.7">Ya puedes acceder a tu panel, consultar los mercados de predicción y administrar tu actividad desde Wallet Bank.</p>
  `

  if (type === 'WITHDRAWAL_REQUESTED') {
    if (!payload.withdrawalId) return json({ error: 'withdrawalId is required' }, 400)
    const { data: withdrawal, error: withdrawalError } = await admin
      .from('withdrawals')
      .select('id, user_id, amount, fee, net_amount, method, wallet_address, status, created_at')
      .eq('id', payload.withdrawalId)
      .maybeSingle()

    if (withdrawalError || !withdrawal || withdrawal.user_id !== user.id) return json({ error: 'Withdrawal not found' }, 404)

    eventKey = withdrawal.id
    subject = `Solicitud de retiro recibida · ${money(Number(withdrawal.amount))}`
    preheader = 'Tu solicitud de retiro está pendiente de revisión.'
    const confirmationLink = payload.confirmationId
      ? `${supabaseUrl}/functions/v1/nova-email-notifications?confirm_withdrawal=${payload.confirmationId}`
      : ''
    content = `
      <h1 style="margin:0 0 16px;color:#fff;font-size:28px">Solicitud de retiro recibida</h1>
      <p style="color:#cbd5e1;font-size:16px;line-height:1.7">Hola ${displayName}, registramos correctamente tu solicitud.</p>
      <div style="margin:24px 0;padding:18px;border:1px solid #26395c;background:#071226;border-radius:14px">
        <p style="margin:5px 0;color:#94a3b8">Monto solicitado: <strong style="color:#fff">${money(Number(withdrawal.amount))}</strong></p>
        <p style="margin:5px 0;color:#94a3b8">Monto neto: <strong style="color:#22d3ee">${money(Number(withdrawal.net_amount))}</strong></p>
        <p style="margin:5px 0;color:#94a3b8">Método: <strong style="color:#fff">${withdrawal.method}</strong></p>
        <p style="margin:5px 0;color:#94a3b8">Estado: <strong style="color:#fbbf24">${withdrawal.status}</strong></p>
        <p style="margin:5px 0;color:#94a3b8">Referencia: <strong style="color:#fff">${withdrawal.id}</strong></p>
      </div>
      ${confirmationLink ? `<p><a href="${confirmationLink}" style="display:inline-block;padding:14px 22px;background:#22d3ee;color:#071226;text-decoration:none;font-weight:700;border-radius:8px">Confirmar retiro</a></p>` : ''}
      <p style="color:#94a3b8;font-size:14px;line-height:1.6">El retiro no será enviado a pago hasta que confirmes este enlace. El enlace vence en 30 minutos.</p>
    `
  }

  if (type === 'WALLET_CONFIRMATION') {
    const walletAddress = payload.walletAddress?.trim()
    if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) return json({ error: 'Invalid wallet address' }, 400)
    const { data: request, error: requestError } = await admin.from('wallet_confirmation_requests')
      .insert({ user_id: user.id, wallet_address: walletAddress })
      .select('id').single()
    if (requestError || !request) return json({ error: 'Could not create wallet confirmation' }, 500)
    eventKey = request.id
    const appUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const link = `${appUrl}/functions/v1/nova-email-notifications?confirm_wallet=${request.id}`
    subject = 'Confirma tu billetera BEP-20 · NOVA Digital'
    preheader = 'Confirma la dirección que usarás para retiros.'
    content = `
      <h1 style="margin:0 0 16px;color:#fff;font-size:28px">Confirma tu billetera BEP-20</h1>
      <p style="color:#cbd5e1;font-size:16px;line-height:1.7">Hola ${displayName}, confirma esta dirección antes de poder solicitar retiros:</p>
      <p style="padding:14px;border:1px solid #26395c;background:#071226;color:#22d3ee;font-family:monospace">${walletAddress}</p>
      <p><a href="${link}" style="display:inline-block;padding:14px 22px;background:#22d3ee;color:#071226;text-decoration:none;font-weight:700;border-radius:8px">Confirmar billetera</a></p>
      <p style="color:#94a3b8;font-size:14px">El enlace vence en 30 minutos. Si no solicitaste este cambio, ignora este mensaje.</p>
    `
  }

  const { data: reservation, error: reservationError } = await admin
    .from('email_notifications')
    .insert({
      user_id: user.id,
      event_type: type,
      event_key: eventKey,
      recipient_email: user.email,
      status: 'PENDING',
    })
    .select('id')
    .single()

  if (reservationError) {
    if (reservationError.code === '23505') return json({ success: true, duplicate: true })
    return json({ error: 'Could not reserve notification' }, 500)
  }

  const html = `<!doctype html><html><body style="margin:0;background:#020617;font-family:Arial,sans-serif">
    <span style="display:none">${preheader}</span>
    <div style="max-width:620px;margin:0 auto;padding:38px 20px">
      <div style="padding:30px;border:1px solid #172554;border-radius:18px;background:linear-gradient(145deg,#071426,#11123a)">
        <div style="margin-bottom:26px;color:#22d3ee;font-size:20px;font-weight:800;letter-spacing:4px">NOVA DIGITAL</div>
        ${content}
        <div style="margin-top:28px;padding-top:18px;border-top:1px solid #1e293b;color:#64748b;font-size:12px">Mensaje transaccional automático de NOVA Digital.</div>
      </div>
    </div></body></html>`

  try {
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `nova-${type.toLowerCase()}-${eventKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [user.email],
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    })
    const resendBody = await resendResponse.json()
    if (!resendResponse.ok) throw new Error(resendBody?.message || 'Resend rejected the message')

    await admin.from('email_notifications').update({
      status: 'SENT',
      provider_message_id: resendBody.id ?? null,
      sent_at: new Date().toISOString(),
      error_message: null,
    }).eq('id', reservation.id)

    return json({ success: true })
  } catch (error) {
    await admin.from('email_notifications').update({
      status: 'FAILED',
      error_message: error instanceof Error ? error.message.slice(0, 500) : 'Unknown delivery error',
    }).eq('id', reservation.id)
    return json({ error: 'Email delivery failed' }, 502)
  }
})
