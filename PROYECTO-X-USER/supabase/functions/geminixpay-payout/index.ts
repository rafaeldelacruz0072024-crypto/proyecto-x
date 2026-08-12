import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ethers } from 'https://esm.sh/ethers@6.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const USDT_BSC   = '0x55d398326f99059fF775485246999027B3197955'
const USDT_ABI   = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
]
const BSC_SCAN   = 'https://bscscan.com/tx/'
const LOW_BNB    = 0.005  // warn if BNB below this

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── Auth: only admin ───────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseUrl        = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase           = createClient(supabaseUrl, supabaseServiceKey)

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

    // ── Wallet setup ───────────────────────────────────────────────────
    const privateKey = Deno.env.get('GEMINIXPAY_PRIVATE_KEY') ?? ''
    const rpcUrl     = Deno.env.get('BSC_RPC_URL') ?? 'https://bsc-dataseed.binance.org'

    if (!privateKey) {
      return new Response(JSON.stringify({ error: 'GEMINIXPAY_PRIVATE_KEY no configurado.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl)
    const wallet   = new ethers.Wallet(privateKey, provider)
    const usdt     = new ethers.Contract(USDT_BSC, USDT_ABI, wallet)

    const url    = new URL(req.url)
    const action = url.searchParams.get('action') ?? ''

    // ── GET BALANCE ────────────────────────────────────────────────────
    if (req.method === 'GET' && action === 'balance') {
      const [rawUsdt, decimals, rawBnb] = await Promise.all([
        usdt.balanceOf(wallet.address),
        usdt.decimals(),
        provider.getBalance(wallet.address),
      ])

      const usdtBalance = parseFloat(ethers.formatUnits(rawUsdt, decimals))
      const bnbBalance  = parseFloat(ethers.formatEther(rawBnb))

      return new Response(JSON.stringify({
        success:    true,
        balance:    usdtBalance,
        bnb:        bnbBalance,
        low_bnb:    bnbBalance < LOW_BNB,
        wallet:     wallet.address,
        bsc_scan:   BSC_SCAN,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ── SINGLE PAYOUT ──────────────────────────────────────────────────
    if (req.method === 'POST' && action === 'single') {
      const { withdrawal_id, address, amount } = await req.json()

      if (!withdrawal_id || !address || !amount) {
        return new Response(JSON.stringify({ error: 'Faltan campos requeridos.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const decimals  = await usdt.decimals()
      const amountWei = ethers.parseUnits(String(amount), decimals)

      const tx      = await usdt.transfer(address, amountWei)
      const receipt = await tx.wait()
      const txHash  = receipt.hash

      const { error: rpcError } = await supabase.rpc('mark_payout_completed', {
        p_withdrawal_id:  withdrawal_id,
        p_nowpayments_id: txHash,
      })

      if (rpcError) {
        return new Response(JSON.stringify({ success: false, error: rpcError.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({
        success:       true,
        withdrawal_id,
        tx_hash:       txHash,
        bsc_scan_url:  BSC_SCAN + txHash,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ── BATCH PAYOUT ───────────────────────────────────────────────────
    if (req.method === 'POST' && action === 'batch') {
      const { withdrawals } = await req.json() as {
        withdrawals: { withdrawal_id: string; address: string; amount: number }[]
      }

      if (!withdrawals?.length) {
        return new Response(JSON.stringify({ error: 'No hay retiros.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const decimals = await usdt.decimals()
      const results: {
        withdrawal_id: string
        success: boolean
        tx_hash?: string
        bsc_scan_url?: string
        error?: string
      }[] = []

      // Sequential to avoid nonce collisions
      for (const w of withdrawals) {
        try {
          const amountWei = ethers.parseUnits(String(w.amount), decimals)
          const tx        = await usdt.transfer(w.address, amountWei)
          const receipt   = await tx.wait()
          const txHash    = receipt.hash

          const { error: rpcError } = await supabase.rpc('mark_payout_completed', {
            p_withdrawal_id:  w.withdrawal_id,
            p_nowpayments_id: txHash,
          })

          results.push({
            withdrawal_id: w.withdrawal_id,
            success:       !rpcError,
            tx_hash:       txHash,
            bsc_scan_url:  BSC_SCAN + txHash,
            error:         rpcError?.message,
          })
        } catch (e: any) {
          results.push({ withdrawal_id: w.withdrawal_id, success: false, error: e.message })
        }
      }

      const paid = results.filter(r => r.success).length

      return new Response(JSON.stringify({
        success: true,
        total:   withdrawals.length,
        paid,
        failed:  withdrawals.length - paid,
        results,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Acción inválida.' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('GeminixPay error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
