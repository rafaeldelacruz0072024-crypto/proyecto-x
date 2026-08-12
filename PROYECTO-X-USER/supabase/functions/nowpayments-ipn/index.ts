import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // 1. Get IPN Payload and Signature
        const bodyText = await req.text()
        const payload = JSON.parse(bodyText)
        const signature = req.headers.get('x-nowpayments-sig')

        console.log("NOWPayments IPN Header Sig:", signature)
        console.log("NOWPayments IPN Payload:", payload)

        const {
            payment_status,
            payment_id,
            order_id,
            pay_amount,
            price_amount,
            actually_paid
        } = payload

        // 2. GET API KEY / IPN SECRET FROM DB
        const { data: config } = await supabase
            .from('system_gateways')
            .select('webhook_secret')
            .ilike('provider', '%Now%')
            .eq('is_active', true)
            .maybeSingle()

        const ipnSecret = config?.webhook_secret

        // 3. SECURE SIGNATURE VERIFICATION
        if (ipnSecret && signature) {
            // NowPayments uses HMAC-SHA512 with the IPN secret
            // However, their docs sometimes mention sorting the payload.
            // A more common approach is just checking the raw body.
            // Let's implement the standard verification.
            try {
                const encoder = new TextEncoder();
                const key = await crypto.subtle.importKey(
                    "raw",
                    encoder.encode(ipnSecret),
                    { name: "HMAC", hash: "SHA-512" },
                    false,
                    ["verify", "sign"]
                );

                // Sort keys alphabetically (standard for many payment gateways)
                const sortedKeys = Object.keys(payload).sort();
                const sortedPayload: any = {};
                sortedKeys.forEach(k => {
                    if (payload[k] !== null && payload[k] !== undefined) {
                        sortedPayload[k] = payload[k];
                    }
                });

                const dataToSign = JSON.stringify(sortedPayload);
                const signatureBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(dataToSign));
                const generatedSig = Array.from(new Uint8Array(signatureBytes))
                    .map(b => b.toString(16).padStart(2, '0'))
                    .join('');

                console.log("Generated Sig:", generatedSig);

                if (generatedSig !== signature) {
                    console.error(`IPN signature mismatch. Expected: ${generatedSig} | Received: ${signature}`);
                    return new Response(
                        JSON.stringify({ error: "Invalid IPN signature. Request rejected." }),
                        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    );
                }
                console.log("IPN signature verified OK.");
            } catch (sigErr) {
                console.error("Signature verification error:", sigErr);
                return new Response(
                    JSON.stringify({ error: "Signature verification failed." }),
                    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }
        } else if (!ipnSecret) {
            // Webhook secret not configured — block all IPN processing as a safety measure
            console.error("IPN rejected: webhook_secret not configured in system_gateways.");
            return new Response(
                JSON.stringify({ error: "Gateway not configured." }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 4. Validate Payment Status
        const status = (payment_status || '').toLowerCase()
        console.log(`Processing IPN for Order: ${order_id} | Payment: ${payment_id} | Status: ${status}`)

        if (status !== 'finished' && status !== 'partially_paid' && status !== 'confirmed') {
            console.log(`Payment status ${status} is not final yet. Skipping processing.`);
            return new Response(JSON.stringify({ message: `Status ${status} ignored.` }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            })
        }

        // 5. Find deposit by order_id (which is the UUID from our proxy)
        const { data: deposit, error: depError } = await supabase
            .from('deposits')
            .select('id, user_id, status')
            .eq('id', order_id)
            .maybeSingle()

        if (depError || !deposit) {
            console.error("Deposit not found for ID:", order_id);
            throw new Error(`Deposit not found: ${order_id}`);
        }

        // Update technical details if available
        if (payment_id || payload.pay_hash || payload.blockchain_tx_hash) {
            await supabase.from('deposits').update({
                transaction_hash: payment_id,
                blockchain_tx_hash: payload.pay_hash || payload.blockchain_tx_hash
            }).eq('id', deposit.id)
        }

        if (deposit.status === 'APPROVED') {
            return new Response(JSON.stringify({ message: "Already processed." }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            })
        }

        // 5b. Validate that the amount actually paid covers the expected amount
        // Use actually_paid (confirmed by blockchain) if available, else pay_amount
        const paidAmount    = Number(actually_paid ?? pay_amount ?? 0);
        const expectedAmount = Number(price_amount ?? 0);
        const TOLERANCE      = 0.99; // Allow up to 1% shortage to cover network fees

        if (expectedAmount > 0 && paidAmount < expectedAmount * TOLERANCE) {
            console.error(`Partial payment rejected: paid=${paidAmount}, expected=${expectedAmount}, deposit=${deposit.id}`);
            // Mark deposit as REJECTED so admin can review it
            await supabase.from('deposits').update({ status: 'REJECTED' }).eq('id', deposit.id);
            return new Response(
                JSON.stringify({
                    error: `Partial payment: received $${paidAmount}, expected $${expectedAmount}. Deposit rejected.`
                }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 6. Finalize in DB via RPC (Modified to support Golden Rule)
        const { data: rpcResult, error: rpcError } = await supabase.rpc('process_deposit_approval', {
            p_deposit_id: deposit.id,
            p_admin_id: '00000000-0000-0000-0000-000000000000' // System actor
        })

        if (rpcError) {
            console.error(`RPC Error for Deposit ${deposit.id}:`, rpcError.message)
            throw new Error(`RPC Error: ${rpcError.message}`)
        }

        const isAutoActivated = rpcResult?.auto_credited === true || rpcResult?.auto_invested === true
        console.log(`NowPayments IPN successfully processed for deposit: ${deposit.id}. Auto-Credited: ${rpcResult?.auto_credited} | Auto-Invested: ${rpcResult?.auto_invested}`)

        return new Response(JSON.stringify({
            success: true,
            auto_activated: isAutoActivated,
            message: rpcResult?.message
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        })

    } catch (error) {
        console.error("IPN Handler Error:", error.message)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
        })
    }
})
