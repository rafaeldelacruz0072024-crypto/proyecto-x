import { createClient } from 'npm:@supabase/supabase-js@2.95.3';

function sortedJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedJson);
  if (!value || typeof value !== 'object') return value;
  const entries = Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  return Object.fromEntries(entries.map(([key, item]) => [key, sortedJson(item)]));
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response(null, { status: 405 });
  const secret = Deno.env.get('NOWPAYMENTS_IPN_SECRET');
  const signature = req.headers.get('x-nowpayments-sig') ?? '';
  if (!secret || !/^[0-9a-f]{128}$/i.test(signature)) return new Response(null, { status: 401 });

  const payload = await req.json().catch(() => null);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return new Response(null, { status: 400 });
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-512' }, false, ['verify']);
  const bytes = Uint8Array.from(signature.match(/.{2}/g)!, (byte) => parseInt(byte, 16));
  if (!await crypto.subtle.verify('HMAC', key, bytes, encoder.encode(JSON.stringify(sortedJson(payload))))) {
    return new Response(null, { status: 401 });
  }

  if (payload.payment_status !== 'finished') return new Response(null, { status: 204 });
  const price = Number(payload.price_amount);
  const quoted = Number(payload.pay_amount);
  const paid = Number(payload.actually_paid);
  const paymentId = String(payload.payment_id);
  if (!/^\d+$/.test(paymentId) || !/^[0-9a-f-]{36}$/i.test(payload.order_id) ||
      payload.price_currency !== 'usd' || payload.pay_currency !== 'usdtbsc' ||
      !Number.isFinite(price) || price <= 0 || !Number.isFinite(quoted) || quoted <= 0 ||
      !Number.isFinite(paid) || paid < quoted) {
    return Response.json({ error: 'Importe o moneda de pago inválidos' }, { status: 422 });
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { error } = await supabase.rpc('confirm_nowpayments_deposit', {
    p_id: payload.order_id, p_payment_id: paymentId, p_amount: price,
  });
  if (error) {
    console.error('No se pudo acreditar depósito NOWPayments', error.code);
    return new Response(null, { status: 503 });
  }
  return new Response(null, { status: 204 });
});
