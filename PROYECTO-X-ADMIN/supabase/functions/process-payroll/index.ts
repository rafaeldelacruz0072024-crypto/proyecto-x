import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Only the admin panel origin is allowed to trigger payroll.
// Set ADMIN_ORIGIN in Supabase Edge Function secrets to your deployed admin URL.
// Falls back to localhost for local development only.
const ALLOWED_ORIGIN = Deno.env.get('ADMIN_ORIGIN') ?? 'http://localhost:5173';

const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const NOWPAY_BASE = Deno.env.get('NOWPAYMENTS_MODE') === 'live'
  ? 'https://api.nowpayments.io/v1'
  : 'https://api.sandbox.nowpayments.io/v1';

interface PayoutItem {
  id: string;
  amount: number;
  wallet: string;
  user_email: string;
}

// ── Step 1: Get JWT from NOWPayments ────────────────────────
async function getNowPayJWT(email: string, password: string): Promise<string> {
  const res = await fetch(`${NOWPAY_BASE}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok || !data.token) {
    throw new Error(`NOWPayments auth failed: ${data.message || JSON.stringify(data)}`);
  }
  return data.token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Sesión administrativa requerida');
    // ── Load secrets ─────────────────────────────────────────
    const NOWPAY_KEY      = Deno.env.get('NOWPAYMENTS_API_KEY');
    const NOWPAY_EMAIL    = Deno.env.get('NOWPAYMENTS_EMAIL');
    const NOWPAY_PASSWORD = Deno.env.get('NOWPAYMENTS_PASSWORD');

    if (!NOWPAY_KEY)      throw new Error('Secret faltante: NOWPAYMENTS_API_KEY');
    if (!NOWPAY_EMAIL)    throw new Error('Secret faltante: NOWPAYMENTS_EMAIL');
    if (!NOWPAY_PASSWORD) throw new Error('Secret faltante: NOWPAYMENTS_PASSWORD');

    const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase      = createClient(SUPABASE_URL, SERVICE_KEY);

    const token = authHeader.replace(/^Bearer\s+/i, '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Sesión administrativa inválida');
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (!profile || !['admin', 'sub-admin'].includes(profile.role)) throw new Error('Acceso administrativo requerido');

    // ── Parse body ───────────────────────────────────────────
    const { withdrawals }: { withdrawals: PayoutItem[] } = await req.json();
    if (!withdrawals || withdrawals.length === 0) {
      throw new Error('No hay retiros seleccionados');
    }

    // ── Step 1: Authenticate with NOWPayments ────────────────
    const jwt = await getNowPayJWT(NOWPAY_EMAIL, NOWPAY_PASSWORD);

    // ── Step 2: Build payout batch ───────────────────────────
    // NOWPayments Payout API: POST /v1/payout
    // Requires: x-api-key + Authorization: Bearer JWT
    const withdrawalsPayload = withdrawals.map(w => ({
      address:        w.wallet,
      currency:       'usdtbsc',   // USDT BEP-20
      amount:         w.amount,
      extra_id:       w.id,
      ipn_callback_url: `${SUPABASE_URL}/functions/v1/nowpayments-payout-ipn`,
    }));

    const nowResponse = await fetch(`${NOWPAY_BASE}/payout`, {
      method: 'POST',
      headers: {
        'x-api-key':     NOWPAY_KEY,
        'Authorization': `Bearer ${jwt}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ withdrawals: withdrawalsPayload }),
    });

    const nowData = await nowResponse.json();

    // ── Step 3: Handle NOWPayments response ──────────────────
    if (!nowResponse.ok) {
      console.error('NOWPayments payout error:', JSON.stringify(nowData));
      // Mark all as failed, do NOT update DB status
      const results = withdrawals.map(w => ({
        withdrawal_id: w.id,
        user_email:    w.user_email,
        amount:        w.amount,
        wallet:        w.wallet,
        status:        'failed',
        error:         nowData?.message || nowData?.error || 'NOWPayments rechazó el batch',
      }));
      return new Response(
        JSON.stringify({ success: false, results, error: nowData?.message }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    // ── Step 4: Batch accepted — update DB ───────────────────
    const batchId     = nowData.id || String(Date.now());
    const nowPayouts: any[] = nowData.withdrawals || [];
    const results: any[]    = [];

    for (const w of withdrawals) {
      const match = nowPayouts.find((p: any) => p.extra_id === w.id);

      // La aceptación del batch no equivale a pago terminado. El IPN firmado
      // será el único que cambie el retiro a COMPLETED.
      await supabase
        .from('withdrawals')
        .update({
          status:               'approved',
          blockchain_tx_hash:   match?.id || batchId,
          approved_at:          new Date().toISOString(),
        })
        .eq('id', w.id);

      results.push({
        withdrawal_id:        w.id,
        user_email:           w.user_email,
        amount:               w.amount,
        wallet:               w.wallet,
        status:               'processing',
        batch_withdrawal_id:  batchId,
      });
    }

    return new Response(
      JSON.stringify({ success: true, batch_id: batchId, results }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    );

  } catch (e: any) {
    console.error('process-payroll error:', e.message);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }
});
