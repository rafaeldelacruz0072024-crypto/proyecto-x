import { createClient } from 'npm:@supabase/supabase-js@2.95.3';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const reply = (status: number, body: object) =>
  Response.json(body, { status, headers: cors });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const apiKey = Deno.env.get('NOWPAYMENTS_API_KEY');
  const ready = !!(apiKey && Deno.env.get('NOWPAYMENTS_IPN_SECRET') && Deno.env.get('NOWPAYMENTS_MODE') === 'live');
  if (req.method === 'GET') return reply(200, { available: ready });
  if (req.method !== 'POST') return reply(405, { error: 'Método inválido.' });
  if (!ready) return reply(503, { error: 'NOWPayments todavía no está disponible.' });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const token = req.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
    if (!token) return reply(401, { error: 'Inicia sesión para depositar.' });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return reply(401, { error: 'Inicia sesión para depositar.' });

    const body = await req.json().catch(() => null);
    const amount = body?.amount;
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 25 ||
        amount > 50000 || Number(amount.toFixed(2)) !== amount) {
      return reply(400, { error: 'Introduce un importe entre 25 y 50,000 USD con hasta dos decimales.' });
    }

    const orderId = crypto.randomUUID();
    const response = await fetch('https://api.nowpayments.io/v1/payment', {
      method: 'POST',
      headers: { 'x-api-key': apiKey!, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        price_amount: amount,
        price_currency: 'usd',
        pay_currency: 'usdtbsc',
        order_id: orderId,
        order_description: 'Depósito Nova Copy Trade',
        ipn_callback_url: new URL('/functions/v1/nowpayments-ipn', supabaseUrl).href,
      }),
    });
    const payment = await response.json();
    const paymentId = String(payment?.payment_id);
    const payAmount = Number(payment?.pay_amount);
    if (!response.ok || !/^\d+$/.test(paymentId) ||
        !/^0x[0-9a-f]{40}$/i.test(payment?.pay_address) ||
        payment?.pay_currency !== 'usdtbsc' || !Number.isFinite(payAmount) || payAmount <= 0) {
      console.error('NOWPayments rechazó la orden', response.status);
      return reply(502, { error: 'NOWPayments no pudo generar el pago para ese importe.' });
    }

    const { error } = await supabase.rpc('create_nowpayments_deposit', {
      p_id: orderId, p_user_id: user.id, p_amount: amount, p_payment_id: paymentId,
    });
    if (error) throw error;

    return reply(200, {
      payment_id: paymentId, pay_address: payment.pay_address, pay_amount: payAmount, pay_currency: 'USDT',
    });
  } catch (error) {
    console.error('Error al crear depósito NOWPayments', error);
    return reply(503, { error: 'No se pudo crear el depósito. Intenta nuevamente.' });
  }
});
