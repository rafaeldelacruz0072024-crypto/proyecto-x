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
        console.log("--- INICIO DE PROXY DEPÓSITO ---")

        // 0. VERIFICATION: Validate user JWT
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            throw new Error("No authorization header provided.")
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        const token = authHeader.replace('Bearer ', '')
        const { data: { user }, error: authError } = await supabase.auth.getUser(token)

        if (authError || !user) {
            console.error("Auth error:", authError)
            throw new Error("Su sesión ha expirado. Por favor, vuelva a iniciar sesión.")
        }

        const body = await req.json()
        const amount = body.amount
        const userId = user.id

        console.log(`Paso 1: Validando monto ($${amount}) para usuario ${userId}`)

        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
            throw new Error("Monto de depósito inválido.")
        }

        const numAmount = Number(amount)

        // 2. Obtener la configuración del Gateway
        console.log("Paso 2: Buscando pasarela NOWPayments activa")
        const { data: config, error: configError } = await supabase
            .from('system_gateways')
            .select('*')
            .ilike('provider', '%Now%')
            .eq('is_active', true)
            .maybeSingle()

        if (configError) throw new Error(`Error en base de datos (Gateways): ${configError.message}`)
        if (!config) throw new Error("No hay una pasarela NOWPayments activa en el sistema.")

        // 3. Crear registro en DB (Depósito y Transacción)
        console.log("Paso 3: Creando registros preventivos en base de datos")
        const { data: deposit, error: depError } = await supabase
            .from('deposits')
            .insert({
                user_id: userId,
                amount: numAmount,
                method: 'USDT', // Usamos 'USDT' que es el estándar en el resto del código
                status: 'PENDING'
            })
            .select()
            .single()

        if (depError) {
            console.error("Error al insertar depósito:", depError)
            throw new Error(`Error DB (Deposits): ${depError.message}`)
        }

        // Transacción Ledger
        const { error: txError } = await supabase.from('transactions').insert({
            user_id: userId,
            type: 'DEPOSIT',
            amount: numAmount,
            status: 'PENDING',
            description: `Depósito Cripto: $${numAmount} (Referencia: ${deposit.id})`
        })

        if (txError) {
            console.warn("No se pudo crear el log en transactions, pero el depósito sigue:", txError.message)
        }

        // 4. Crear el pago en NOWPayments
        console.log("Paso 4: Solicitando pago a NOWPayments API")
        const baseUrl = config.mode === 'test'
            ? 'https://api-sandbox.nowpayments.io/v1'
            : 'https://api.nowpayments.io/v1'

        const npPayload = {
            price_amount: numAmount,
            price_currency: 'usd',
            pay_currency: 'usdtbsc',
            order_id: deposit.id,
            order_description: `Deposit ${deposit.id}`,
            ipn_callback_url: Deno.env.get('NOWPAYMENTS_IPN_URL')
        }

        const response = await fetch(`${baseUrl}/payment`, {
            method: 'POST',
            headers: {
                'x-api-key': config.api_key,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(npPayload)
        })

        const npData = await response.json()

        if (!response.ok) {
            console.error("Falla en API NOWPayments:", npData)
            // Marcamos el depósito y la transacción como REJECTED/FAILED si la API falla
            await Promise.all([
                supabase.from('deposits').update({ status: 'REJECTED' }).eq('id', deposit.id),
                supabase.from('transactions').update({ status: 'FAILED' }).match({
                    user_id: userId,
                    description: `Depósito Cripto: $${numAmount} (Referencia: ${deposit.id})`
                })
            ])
            throw new Error(npData.message || npData.error || "Error al generar el pago con NOWPayments.")
        }

        // 5. Finalizar: Guardar payment_id (Transaction Hash)
        console.log(`Paso 5: Pago generado con éxito (ID: ${npData.payment_id}). Actualizando registros DB.`)

        // Actualizamos el depósito con el hash y opcionalmente la descripción de la transacción
        const [depUpdate, txUpdate] = await Promise.all([
            supabase.from('deposits').update({
                transaction_hash: npData.payment_id
            }).eq('id', deposit.id),

            supabase.from('transactions').update({
                description: `Depósito Cripto: $${numAmount} (Ref: ${deposit.id} | NP: ${npData.payment_id})`
            }).match({
                user_id: userId,
                type: 'DEPOSIT',
                status: 'PENDING',
                description: `Depósito Cripto: $${numAmount} (Referencia: ${deposit.id})`
            })
        ])

        if (depUpdate.error) {
            console.error("❌ FATAL: Error al guardar el ID de pago en el depósito:", depUpdate.error.message)
            throw new Error(`Error guardando hash del pago: ${depUpdate.error.message}`)
        }

        console.log("--- PROCESO COMPLETADO CON ÉXITO ---")
        return new Response(JSON.stringify(npData), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        })

    } catch (error) {
        console.error("CRITICAL PROXY ERROR:", error.message)
        return new Response(JSON.stringify({
            error: error.message,
            success: false
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
        })
    }
})
