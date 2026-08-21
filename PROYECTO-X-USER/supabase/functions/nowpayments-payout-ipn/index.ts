import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const jsonHeaders = { 'Content-Type': 'application/json' };

const hmac = async (payload: Record<string, unknown>, secret: string) => {
  const sorted = Object.keys(payload).sort().reduce<Record<string, unknown>>((acc, key) => {
    if (payload[key] !== null && payload[key] !== undefined) acc[key] = payload[key];
    return acc;
  }, {});
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(JSON.stringify(sorted)));
  return Array.from(new Uint8Array(signed)).map(byte => byte.toString(16).padStart(2, '0')).join('');
};

serve(async (req) => {
  try {
    if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: jsonHeaders });
    const secret = Deno.env.get('NOWPAYMENTS_IPN_SECRET') ?? '';
    const signature = req.headers.get('x-nowpayments-sig') ?? '';
    if (!secret || !signature) return new Response(JSON.stringify({ error: 'Missing signature' }), { status: 401, headers: jsonHeaders });

    const payload = await req.json() as Record<string, any>;
    if ((await hmac(payload, secret)) !== signature) {
      return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401, headers: jsonHeaders });
    }

    const item = Array.isArray(payload.withdrawals) ? payload.withdrawals[0] : payload;
    const providerId = String(item?.id ?? payload?.id ?? '');
    const externalId = String(item?.extra_id ?? payload?.extra_id ?? '');
    const status = String(item?.status ?? item?.payout_status ?? payload?.status ?? payload?.payout_status ?? '').toLowerCase();
    if (!providerId && !externalId) return new Response(JSON.stringify({ error: 'Missing payout reference' }), { status: 400, headers: jsonHeaders });

    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    let query = supabase.from('withdrawals').select('id,status,blockchain_tx_hash').limit(1);
    query = externalId ? query.eq('id', externalId) : query.eq('blockchain_tx_hash', providerId);
    const { data: withdrawal, error: lookupError } = await query.maybeSingle();
    if (lookupError || !withdrawal) return new Response(JSON.stringify({ error: 'Withdrawal not found' }), { status: 404, headers: jsonHeaders });

    if (status === 'finished') {
      if (withdrawal.status.toLowerCase() !== 'completed') {
        const { error } = await supabase.rpc('complete_withdrawal_atomic', {
          p_withdrawal_id: withdrawal.id,
          p_tx_hash: providerId || withdrawal.blockchain_tx_hash,
          p_admin_id: '00000000-0000-0000-0000-000000000000',
        });
        if (error) throw error;
      }
    } else if (['failed', 'rejected', 'rejected_not_checked', 'cancelled', 'canceled'].includes(status)) {
      if (!['rejected', 'completed'].includes(withdrawal.status.toLowerCase())) {
        const { error } = await supabase.rpc('reject_withdrawal', {
          p_withdrawal_id: withdrawal.id,
          p_reason: `NOWPayments: ${status}`,
          p_admin_id: '00000000-0000-0000-0000-000000000000',
        });
        if (error) throw error;
      }
    }

    return new Response(JSON.stringify({ ok: true, status }), { headers: jsonHeaders });
  } catch (error) {
    console.error('NOWPayments payout IPN error:', error instanceof Error ? error.message : 'unknown');
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: jsonHeaders });
  }
});
