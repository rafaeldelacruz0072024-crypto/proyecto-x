import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

serve(async (req) => {
    try {
        const payload = await req.json()

        // Only process INSERT events on transactions table
        if (payload.type !== 'INSERT') {
            return new Response("Not an insert event", { status: 200 })
        }

        const record = payload.record

        // Only for weekly salary transactions
        const isSalary = record.type === 'bonus_weekly' || record.type === 'BONUS_WEEKLY'
        if (!isSalary) {
            return new Response("Not a salary transaction", { status: 200 })
        }

        const amount = record.amount || 0

        // Fetch user profile
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('email, full_name, username')
            .eq('id', record.user_id)
            .single()

        if (error || !profile) {
            console.error("Error fetching profile:", error)
            return new Response("Error fetching profile", { status: 500 })
        }

        const email = profile.email
        const name = profile.full_name || profile.username || 'Usuario'
        const description = record.description || 'Salario Semanal NOVA DIGITAL'
        const paidAt = new Date(record.created_at).toLocaleDateString('es-ES', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        })

        const html = `
<div style="font-family: 'Arial', sans-serif; max-width: 600px; margin: 0 auto; background-color: #030712; color: #ffffff; border: 1px solid #1f2937; border-radius: 8px; overflow: hidden;">
    <div style="background-color: #0f172a; padding: 20px; text-align: center; border-bottom: 2px solid #00f3ff;">
        <h1 style="margin: 0; color: #00f3ff; font-size: 28px; letter-spacing: 4px;">GEMINI<span style="color: #ffffff;">X</span></h1>
        <p style="margin: 4px 0 0; color: #475569; font-size: 12px; letter-spacing: 2px;">PROTOCOL</p>
    </div>
    <div style="padding: 40px 30px;">
        <div style="text-align: center; margin-bottom: 25px;">
            <p style="color: #00f3ff; font-size: 32px; margin: 0;">💰</p>
        </div>
        <h2 style="color: #ffffff; margin-top: 0; text-align: center;">¡Tu Salario Semanal fue Acreditado!</h2>
        <p style="color: #94a3b8; font-size: 16px; line-height: 1.7;">
            Hola <strong style="color: #ffffff;">${name}</strong>,<br/><br/>
            Tu salario semanal correspondiente a esta semana ha sido acreditado en tu <strong style="color: #00f3ff;">Wallet Bank</strong>.
        </p>

        <div style="background-color: #0f172a; border: 2px solid #00f3ff; padding: 25px; border-radius: 8px; margin: 25px 0; text-align: center;">
            <p style="color: #94a3b8; margin: 0 0 8px; font-size: 14px; letter-spacing: 1px;">MONTO ACREDITADO</p>
            <p style="color: #00f3ff; font-size: 36px; font-weight: bold; margin: 0;">$${amount} USDT</p>
            <p style="color: #475569; font-size: 13px; margin: 8px 0 0;">Acreditado el ${paidAt}</p>
        </div>

        <div style="background-color: #1e293b; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 6px 0; color: #e2e8f0;"><strong>Descripción:</strong> <span style="color: #94a3b8;">${description}</span></p>
            <p style="margin: 6px 0; color: #e2e8f0;"><strong>Destino:</strong> <span style="color: #00f3ff;">Wallet Bank ✓</span></p>
        </div>

        <div style="background-color: #0c1a2e; border: 1px solid #1e3a5f; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #7dd3fc; margin: 0; font-size: 14px; font-weight: bold;">💡 REGLA DE ORO</p>
            <p style="color: #94a3b8; font-size: 14px; margin: 8px 0 0; line-height: 1.6;">
                Tu salario está en tu Wallet Bank. Puedes retirarlo los <strong>Sábados de 8:00 AM a 11:59 PM (UTC-5)</strong> mediante solicitud de retiro.
            </p>
        </div>

        <div style="text-align: center; margin: 35px 0 20px;">
            <a href="https://proyecto-x-user.vercel.app" style="background-color: #00f3ff; color: #030712; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px; letter-spacing: 1px; display: inline-block;">
                VER MI WALLET BANK →
            </a>
        </div>

        <p style="color: #475569; font-size: 13px; text-align: center; margin-top: 30px; border-top: 1px solid #1f2937; padding-top: 20px;">
            Gracias por confiar en NOVA DIGITAL Protocol.<br/>
            Ventana de retiro: Sábados 8:00 AM – 11:59 PM UTC-5
        </p>
    </div>
</div>
`

        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${RESEND_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                from: "NOVA DIGITAL Protocol <soporte@proyecto-x-user.vercel.app>",
                to: [email],
                subject: `NOVA DIGITAL: ¡Tu salario semanal de $${amount} USDT fue acreditado!`,
                html
            })
        })

        const resendData = await res.json()
        console.log("Salary email sent:", resendData)

        if (!res.ok) {
            return new Response(JSON.stringify({ error: resendData }), { status: res.status })
        }

        return new Response(JSON.stringify({ success: true, resendData }), {
            headers: { "Content-Type": "application/json" },
            status: 200,
        })

    } catch (error) {
        console.error("Function exception:", error)
        return new Response(JSON.stringify({ error: error.message }), { status: 400 })
    }
})
