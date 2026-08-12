import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const NP_BASE = 'https://api.nowpayments.io/v1'

// Authenticates with NowPayments and returns a short-lived JWT
async function getNowPaymentsJWT(email: string, password: string): Promise<string> {
  const res = await fetch(`${NP_BASE}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`NowPayments auth failed: ${err}`)
  }
  const data = await res.json()
  return data.token
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── Validate caller is authenticated admin ──────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseUrl        = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase           = createClient(supabaseUrl, supabaseServiceKey)

    // Verify the calling user is an admin
    const userSupabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } }
    })
    const { data: { user }, error: authError } = await userSupabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── NowPayments credentials ─────────────────────────────────────
    const apiKey   = Deno.env.get('NOWPAYMENTS_API_KEY') ?? ''
    const npEmail  = Deno.env.get('NOWPAYMENTS_EMAIL') ?? ''
    const npPass   = Deno.env.get('NOWPAYMENTS_PASSWORD') ?? ''

    if (!apiKey || !npEmail || !npPass) {
      return new Response(JSON.stringify({ error: 'NowPayments credentials not configured.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const url    = new URL(req.url)
    const action = url.searchParams.get('action') ?? ''

    // ── GET BALANCE ─────────────────────────────────────────────────
    if (req.method === 'GET' && action === 'balance') {
      // Use JWT auth — API key alone lacks ENDPOINT permission for /balance
      const jwt = await getNowPaymentsJWT(npEmail, npPass)

      const res = await fetch(`${NP_BASE}/balance`, {
        headers: {
          'x-api-key':     apiKey,
          'Authorization': `Bearer ${jwt}`,
        }
      })
      const data = await res.json()

      let balance = 0
      const rawCurrencies = data?.currencies

      if (Array.isArray(rawCurrencies)) {
        const entry = rawCurrencies.find((c: any) =>
          (c.currency ?? '').toLowerCase().includes('usdt')
        )
        balance = parseFloat(entry?.amount ?? 0) || 0
      } else if (rawCurrencies && typeof rawCurrencies === 'object') {
        const key = Object.keys(rawCurrencies).find(k =>
          k.toLowerCase().includes('usdt')
        )
        if (key) balance = parseFloat(rawCurrencies[key]?.amount ?? 0) || 0
      } else if (typeof data?.balance === 'number') {
        balance = data.balance
      }

      return new Response(JSON.stringify({ success: true, balance, raw: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── SINGLE PAYOUT ───────────────────────────────────────────────
    if (req.method === 'POST' && action === 'single') {
      const { withdrawal_id, address, amount, currency = 'usdtbsc' } = await req.json()

      if (!withdrawal_id || !address || !amount) {
        return new Response(JSON.stringify({ error: 'Missing required fields.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const jwt = await getNowPaymentsJWT(npEmail, npPass)

      const payoutRes = await fetch(`${NP_BASE}/payout`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'x-api-key':     apiKey,
          'Authorization': `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          address,
          currency,
          amount,
          extra_id:         withdrawal_id,
          ipn_callback_url: `${supabaseUrl}/functions/v1/nowpayments-payout-ipn`,
        }),
      })

      const payoutData = await payoutRes.json()

      if (!payoutRes.ok) {
        console.error('NowPayments payout error:', payoutData)
        return new Response(JSON.stringify({ success: false, error: payoutData?.message ?? 'Payout failed' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const nowpaymentsId = payoutData?.id ?? `NP-${withdrawal_id.slice(0, 8)}`

      // Mark withdrawal as COMPLETED in DB
      const { data: rpcResult, error: rpcError } = await supabase.rpc('mark_payout_completed', {
        p_withdrawal_id:  withdrawal_id,
        p_nowpayments_id: String(nowpaymentsId),
      })

      if (rpcError) {
        console.error('RPC error:', rpcError)
        return new Response(JSON.stringify({ success: false, error: rpcError.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({
        success: true,
        withdrawal_id,
        nowpayments_id: nowpaymentsId,
        payout: payoutData,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ── BATCH PAYOUT ────────────────────────────────────────────────
    if (req.method === 'POST' && action === 'batch') {
      const { withdrawals } = await req.json() as {
        withdrawals: { withdrawal_id: string; address: string; amount: number; currency?: string }[]
      }

      if (!withdrawals?.length) {
        return new Response(JSON.stringify({ error: 'No withdrawals provided.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const jwt = await getNowPaymentsJWT(npEmail, npPass)

      const batchPayload = {
        withdrawals: withdrawals.map(w => ({
          address:          w.address,
          currency:         w.currency ?? 'usdtbsc',
          amount:           w.amount,
          extra_id:         w.withdrawal_id,
          ipn_callback_url: `${supabaseUrl}/functions/v1/nowpayments-payout-ipn`,
        }))
      }

      const batchRes = await fetch(`${NP_BASE}/batch-payment`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'x-api-key':     apiKey,
          'Authorization': `Bearer ${jwt}`,
        },
        body: JSON.stringify(batchPayload),
      })

      const batchData = await batchRes.json()

      if (!batchRes.ok) {
        console.error('NowPayments batch error:', batchData)
        return new Response(JSON.stringify({ success: false, error: batchData?.message ?? 'Batch payout failed' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Mark each withdrawal as COMPLETED
      const results: { withdrawal_id: string; success: boolean; nowpayments_id?: string; error?: string }[] = []

      const batchItems: any[] = batchData?.withdrawals ?? []

      for (const w of withdrawals) {
        const npItem = batchItems.find((i: any) => i.extra_id === w.withdrawal_id) ?? batchItems[results.length]
        const npId   = npItem?.id ? String(npItem.id) : `BATCH-${batchData?.id ?? 'unknown'}`

        const { error: rpcError } = await supabase.rpc('mark_payout_completed', {
          p_withdrawal_id:  w.withdrawal_id,
          p_nowpayments_id: npId,
        })

        results.push({
          withdrawal_id:  w.withdrawal_id,
          success:        !rpcError,
          nowpayments_id: npId,
          error:          rpcError?.message,
        })
      }

      const successCount = results.filter(r => r.success).length

      return new Response(JSON.stringify({
        success:       true,
        batch_id:      batchData?.id,
        total:         withdrawals.length,
        paid:          successCount,
        failed:        withdrawals.length - successCount,
        results,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Invalid action.' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('Payout handler error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})