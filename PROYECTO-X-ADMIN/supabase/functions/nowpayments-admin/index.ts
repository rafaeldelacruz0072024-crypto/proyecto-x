import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const origin = Deno.env.get('ADMIN_ORIGIN') ?? 'http://localhost:5173';
const headers = {
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const admin = createClient(supabaseUrl, serviceKey);
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });

    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (!profile || !['admin', 'sub-admin'].includes(profile.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers });
    }

    const { action } = await req.json().catch(() => ({ action: 'status' }));
    if (action !== 'status') return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers });

    const apiKey = Deno.env.get('NOWPAYMENTS_API_KEY') ?? '';
    const ipnSecret = Deno.env.get('NOWPAYMENTS_IPN_SECRET') ?? '';
    const email = Deno.env.get('NOWPAYMENTS_EMAIL') ?? '';
    const password = Deno.env.get('NOWPAYMENTS_PASSWORD') ?? '';
    const callbackUrl = Deno.env.get('NOWPAYMENTS_IPN_URL') ?? '';
    const mode = (Deno.env.get('NOWPAYMENTS_MODE') === 'live' ? 'live' : 'test') as 'test' | 'live';
    const missing = [
      !apiKey && 'NOWPAYMENTS_API_KEY', !ipnSecret && 'NOWPAYMENTS_IPN_SECRET',
      !callbackUrl && 'NOWPAYMENTS_IPN_URL', !email && 'NOWPAYMENTS_EMAIL',
      !password && 'NOWPAYMENTS_PASSWORD',
    ].filter(Boolean) as string[];

    let connected = false;
    let apiStatus = 'not_checked';
    let payoutAuth = false;
    if (apiKey) {
      const base = mode === 'test' ? 'https://api.sandbox.nowpayments.io/v1' : 'https://api.nowpayments.io/v1';
      const statusRes = await fetch(`${base}/status`, { headers: { 'x-api-key': apiKey } });
      connected = statusRes.ok;
      apiStatus = statusRes.ok ? 'ok' : `http_${statusRes.status}`;
      if (connected && email && password) {
        const authRes = await fetch(`${base}/auth`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
        payoutAuth = authRes.ok;
      }
    }

    return new Response(JSON.stringify({
      configured: missing.length === 0,
      connected,
      mode,
      api_status: apiStatus,
      deposits_ready: connected && Boolean(ipnSecret && callbackUrl),
      payouts_ready: connected && payoutAuth && Boolean(ipnSecret),
      ipn_ready: Boolean(ipnSecret && callbackUrl),
      missing,
      checked_at: new Date().toISOString(),
    }), { headers });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers });
  }
});
