import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

// Environment Variables automatically injected by Supabase
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

// Traducciones básicas
const translations = {
    es: {
        subject: "PROYECTO X: Tu retiro ha sido procesado exitosamente",
        title: "Retiro Procesado con Éxito",
        hello: "Hola",
        body: "Tu solicitud de retiro ha sido aprobada y procesada a través de nuestra red.",
        amount: "Monto",
        status: "Estado",
        wallet: "Billetera de Destino",
        network: "Red / Método",
        footer: "Gracias por confiar en PROYECTO X Protocol."
    },
    en: {
        subject: "PROYECTO X: Your withdrawal has been successfully processed",
        title: "Withdrawal Processed Successfully",
        hello: "Hello",
        body: "Your withdrawal request has been approved and processed through our network.",
        amount: "Amount",
        status: "Status",
        wallet: "Destination Wallet",
        network: "Network / Method",
        footer: "Thank you for trusting PROYECTO X Protocol."
    }
}

serve(async (req) => {
    try {
        const payload = await req.json()

        // Only process UPDATE events
        if (payload.type !== 'UPDATE') {
            return new Response("Not an update event", { status: 200 })
        }

        const { record, old_record } = payload

        // Trigger when status changes TO 'approved'/'completed' OR 'rejected'
        const isNowApproved = record.status === 'completed' || record.status === 'approved' || record.status === 'COMPLETED' || record.status === 'APPROVED'
        const isNowRejected = record.status === 'rejected' || record.status === 'REJECTED'
        const wasPending = old_record.status === 'pending' || old_record.status === 'PENDING'

        if (wasPending && (isNowApproved || isNowRejected)) {

            // 1. Fetch user profile
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
            const lang = 'es'
            const t = translations[lang]

            // 2. Build email based on status
            let subject: string
            let html: string

            if (isNowApproved) {
                subject = t.subject
                html = `
        <div style="font-family: 'Arial', sans-serif; max-width: 600px; margin: 0 auto; background-color: #030712; color: #ffffff; border: 1px solid #1f2937; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #0f172a; padding: 20px; text-align: center; border-bottom: 2px solid #00f3ff;">
                <h1 style="margin: 0; color: #00f3ff; font-size: 24px; letter-spacing: 2px;">GEMINI<span style="color: #ffffff;">X</span></h1>
                <p style="margin: 4px 0 0; color: #475569; font-size: 12px; letter-spacing: 2px;">PROTOCOL</p>
            </div>
            <div style="padding: 30px;">
                <h2 style="color: #22c55e; margin-top: 0;">${t.title}</h2>
                <p style="color: #94a3b8; font-size: 16px;">${t.hello} <strong>${name}</strong>,</p>
                <p style="color: #94a3b8; font-size: 16px; line-height: 1.5;">${t.body}</p>

                <div style="background-color: #1e293b; padding: 20px; border-radius: 6px; margin: 25px 0; border-left: 4px solid #22c55e;">
                    <p style="margin: 5px 0; color: #e2e8f0;"><strong>${t.amount}:</strong> <span style="color: #00f3ff; font-size: 18px;">$${record.amount} USDT</span></p>
                    <p style="margin: 5px 0; color: #e2e8f0;"><strong>${t.status}:</strong> <span style="color: #22c55e;">COMPLETADO ✓</span></p>
                    <p style="margin: 5px 0; color: #e2e8f0;"><strong>${t.wallet}:</strong> <span style="font-family: monospace;">${record.wallet_address || 'Interno'}</span></p>
                    <p style="margin: 5px 0; color: #e2e8f0;"><strong>${t.network}:</strong> ${record.method || 'TRC20'}</p>
                </div>

                <p style="color: #64748b; font-size: 14px; text-align: center; margin-top: 30px;">
                    ${t.footer}
                </p>
            </div>
        </div>
        `
            } else {
                // REJECTED
                subject = "PROYECTO X: Tu solicitud de retiro fue rechazada"
                html = `
        <div style="font-family: 'Arial', sans-serif; max-width: 600px; margin: 0 auto; background-color: #030712; color: #ffffff; border: 1px solid #1f2937; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #0f172a; padding: 20px; text-align: center; border-bottom: 2px solid #00f3ff;">
                <h1 style="margin: 0; color: #00f3ff; font-size: 24px; letter-spacing: 2px;">GEMINI<span style="color: #ffffff;">X</span></h1>
                <p style="margin: 4px 0 0; color: #475569; font-size: 12px; letter-spacing: 2px;">PROTOCOL</p>
            </div>
            <div style="padding: 30px;">
                <h2 style="color: #f87171; margin-top: 0;">Retiro No Procesado</h2>
                <p style="color: #94a3b8; font-size: 16px;">${t.hello} <strong>${name}</strong>,</p>
                <p style="color: #94a3b8; font-size: 16px; line-height: 1.5;">
                    Lamentamos informarte que tu solicitud de retiro por <strong style="color: #f87171;">$${record.amount} USDT</strong> no pudo ser procesada en esta ocasión.
                </p>

                <div style="background-color: #1e293b; padding: 20px; border-radius: 6px; margin: 25px 0; border-left: 4px solid #ef4444;">
                    <p style="margin: 5px 0; color: #e2e8f0;"><strong>${t.amount}:</strong> <span style="color: #f87171; font-size: 18px;">$${record.amount} USDT</span></p>
                    <p style="margin: 5px 0; color: #e2e8f0;"><strong>${t.status}:</strong> <span style="color: #f87171;">RECHAZADO</span></p>
                    <p style="margin: 5px 0; color: #e2e8f0;"><strong>${t.wallet}:</strong> <span style="font-family: monospace;">${record.wallet_address || 'N/A'}</span></p>
                </div>

                <div style="background-color: #1c1917; border: 1px solid #78350f; padding: 18px; border-radius: 8px; margin: 20px 0;">
                    <p style="color: #fbbf24; margin: 0 0 8px; font-size: 14px; font-weight: bold;">¿Qué puedo hacer?</p>
                    <ul style="color: #94a3b8; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                        <li>Los fondos han sido devueltos a tu Wallet Bank</li>
                        <li>Verifica que tu wallet destino sea correcta</li>
                        <li>Recuerda: retiros solo Sábados 8:00 AM – 11:59 PM UTC-5</li>
                        <li>Contacta a soporte si necesitas asistencia</li>
                    </ul>
                </div>

                <p style="color: #64748b; font-size: 14px; text-align: center; margin-top: 30px;">
                    ${t.footer}
                </p>
            </div>
        </div>
        `
            }

            // 3. Send email using Resend API
            const res = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${RESEND_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    from: "PROYECTO X Protocol <soporte@proyecto-x-user.vercel.app>",
                    to: [email],
                    subject,
                    html
                })
            })

            const resendData = await res.json()

            console.log("Resend API Response:", resendData)

            if (!res.ok) {
                return new Response(JSON.stringify({ error: resendData }), { status: res.status })
            }

            return new Response(JSON.stringify({ success: true, resendData }), {
                headers: { "Content-Type": "application/json" },
                status: 200,
            })
        }

        return new Response("No condition matched for email sending", { status: 200 })

    } catch (error) {
        console.error("Function exception:", error)
        return new Response(JSON.stringify({ error: error.message }), { status: 400 })
    }
})
