import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

serve(async (req) => {
    try {
        const payload = await req.json()

        if (payload.type !== 'UPDATE') {
            return new Response("Not an update event", { status: 200 })
        }

        const { record, old_record } = payload

        const isNowApproved = record.status === 'approved' || record.status === 'APPROVED'
        const isNowRejected = record.status === 'rejected' || record.status === 'REJECTED'
        const wasPending = old_record.status === 'pending' || old_record.status === 'PENDING'

        if (!wasPending || (!isNowApproved && !isNowRejected)) {
            return new Response("No condition matched for email sending", { status: 200 })
        }

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
        const amount = record.amount || 0
        const createdAt = new Date(record.created_at).toLocaleDateString('es-ES', {
            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
        })

        let subject: string
        let html: string

        if (isNowApproved) {
            subject = "GEMINIX: ¡Tu depósito ha sido aprobado!"
            html = `
<div style="font-family: 'Arial', sans-serif; max-width: 600px; margin: 0 auto; background-color: #030712; color: #ffffff; border: 1px solid #1f2937; border-radius: 8px; overflow: hidden;">
    <div style="background-color: #0f172a; padding: 20px; text-align: center; border-bottom: 2px solid #00f3ff;">
        <h1 style="margin: 0; color: #00f3ff; font-size: 28px; letter-spacing: 4px;">GEMINI<span style="color: #ffffff;">X</span></h1>
        <p style="margin: 4px 0 0; color: #475569; font-size: 12px; letter-spacing: 2px;">PROTOCOL</p>
    </div>
    <div style="padding: 40px 30px;">
        <div style="text-align: center; margin-bottom: 25px;">
            <div style="display: inline-block; background-color: #052e16; border: 2px solid #22c55e; border-radius: 50%; width: 60px; height: 60px; line-height: 60px; font-size: 28px;">✓</div>
        </div>
        <h2 style="color: #22c55e; margin-top: 0; text-align: center;">Depósito Aprobado</h2>
        <p style="color: #94a3b8; font-size: 16px; line-height: 1.7;">
            Hola <strong style="color: #ffffff;">${name}</strong>,<br/><br/>
            Tu depósito ha sido verificado y acreditado exitosamente en tu cuenta GEMINIX.
        </p>

        <div style="background-color: #1e293b; padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #22c55e;">
            <p style="margin: 8px 0; color: #e2e8f0;"><strong>Monto:</strong> <span style="color: #22c55e; font-size: 20px; font-weight: bold;">$${amount} USDT</span></p>
            <p style="margin: 8px 0; color: #e2e8f0;"><strong>Estado:</strong> <span style="color: #22c55e;">APROBADO ✓</span></p>
            <p style="margin: 8px 0; color: #e2e8f0;"><strong>Fecha:</strong> ${createdAt}</p>
        </div>

        <p style="color: #94a3b8; font-size: 15px;">
            Los fondos ya están disponibles en tu Wallet Bank. Puedes utilizarlos para activar o renovar tu membresía.
        </p>

        <div style="text-align: center; margin: 35px 0 20px;">
            <a href="https://geminixprotocol.com" style="background-color: #22c55e; color: #030712; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px; letter-spacing: 1px; display: inline-block;">
                IR A MI PANEL →
            </a>
        </div>

        <p style="color: #475569; font-size: 13px; text-align: center; margin-top: 30px; border-top: 1px solid #1f2937; padding-top: 20px;">
            Gracias por confiar en GEMINIX Protocol.
        </p>
    </div>
</div>
`
        } else {
            // REJECTED
            subject = "GEMINIX: Tu solicitud de depósito fue rechazada"
            html = `
<div style="font-family: 'Arial', sans-serif; max-width: 600px; margin: 0 auto; background-color: #030712; color: #ffffff; border: 1px solid #1f2937; border-radius: 8px; overflow: hidden;">
    <div style="background-color: #0f172a; padding: 20px; text-align: center; border-bottom: 2px solid #00f3ff;">
        <h1 style="margin: 0; color: #00f3ff; font-size: 28px; letter-spacing: 4px;">GEMINI<span style="color: #ffffff;">X</span></h1>
        <p style="margin: 4px 0 0; color: #475569; font-size: 12px; letter-spacing: 2px;">PROTOCOL</p>
    </div>
    <div style="padding: 40px 30px;">
        <h2 style="color: #f87171; margin-top: 0;">Depósito No Procesado</h2>
        <p style="color: #94a3b8; font-size: 16px; line-height: 1.7;">
            Hola <strong style="color: #ffffff;">${name}</strong>,<br/><br/>
            Lamentamos informarte que tu solicitud de depósito por <strong style="color: #f87171;">$${amount} USDT</strong> no pudo ser procesada.
        </p>

        <div style="background-color: #1e293b; padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #ef4444;">
            <p style="margin: 8px 0; color: #e2e8f0;"><strong>Monto:</strong> <span style="color: #f87171; font-size: 18px;">$${amount} USDT</span></p>
            <p style="margin: 8px 0; color: #e2e8f0;"><strong>Estado:</strong> <span style="color: #f87171;">RECHAZADO</span></p>
        </div>

        <div style="background-color: #1c1917; border: 1px solid #78350f; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #fbbf24; margin: 0; font-size: 14px;"><strong>¿Qué hacer ahora?</strong></p>
            <ul style="color: #94a3b8; font-size: 14px; line-height: 1.9; margin: 10px 0 0; padding-left: 20px;">
                <li>Verifica que el comprobante de pago sea legible y correcto</li>
                <li>Asegúrate de haber enviado al wallet correcto de GEMINIX</li>
                <li>Contacta a soporte si crees que es un error</li>
            </ul>
        </div>

        <div style="text-align: center; margin: 35px 0 20px;">
            <a href="https://geminixprotocol.com" style="background-color: #00f3ff; color: #030712; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px; letter-spacing: 1px; display: inline-block;">
                CONTACTAR SOPORTE →
            </a>
        </div>

        <p style="color: #475569; font-size: 13px; text-align: center; margin-top: 30px; border-top: 1px solid #1f2937; padding-top: 20px;">
            Gracias por confiar en GEMINIX Protocol.
        </p>
    </div>
</div>
`
        }

        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${RESEND_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                from: "GEMINIX Protocol <soporte@geminixprotocol.com>",
                to: [email],
                subject,
                html
            })
        })

        const resendData = await res.json()
        console.log("Deposit email sent:", resendData)

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
