import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

serve(async (req) => {
    try {
        const payload = await req.json()

        // Only process INSERT events on profiles table
        if (payload.type !== 'INSERT') {
            return new Response("Not an insert event", { status: 200 })
        }

        const record = payload.record

        // Get email and name from the new profile record
        const email = record.email
        const name = record.full_name || record.username || 'Miembro PROYECTO X'

        if (!email) {
            console.error("No email found in profile record")
            return new Response("No email in record", { status: 200 })
        }

        const html = `
<div style="font-family: 'Arial', sans-serif; max-width: 600px; margin: 0 auto; background-color: #030712; color: #ffffff; border: 1px solid #1f2937; border-radius: 8px; overflow: hidden;">
    <div style="background-color: #0f172a; padding: 20px; text-align: center; border-bottom: 2px solid #00f3ff;">
        <h1 style="margin: 0; color: #00f3ff; font-size: 28px; letter-spacing: 4px;">GEMINI<span style="color: #ffffff;">X</span></h1>
        <p style="margin: 4px 0 0; color: #475569; font-size: 12px; letter-spacing: 2px;">PROTOCOL</p>
    </div>
    <div style="padding: 40px 30px;">
        <h2 style="color: #00f3ff; margin-top: 0; font-size: 22px;">¡Bienvenido al Protocolo, ${name}!</h2>
        <p style="color: #94a3b8; font-size: 16px; line-height: 1.7;">
            Tu cuenta ha sido creada exitosamente. Ahora formas parte de la red de inteligencia financiera más avanzada del ecosistema cripto.
        </p>

        <div style="background-color: #0f172a; border: 1px solid #1e3a5f; padding: 25px; border-radius: 8px; margin: 30px 0;">
            <h3 style="color: #00f3ff; margin-top: 0; font-size: 16px; letter-spacing: 1px;">¿QUÉ PUEDES HACER AHORA?</h3>
            <ul style="color: #94a3b8; font-size: 15px; line-height: 2; padding-left: 20px; margin: 0;">
                <li>Activar tu membresía y comenzar a generar rendimientos</li>
                <li>Acceder a los planes de inversión PROYECTO X GOLD</li>
                <li>Invitar referidos y ganar comisiones en 30 niveles</li>
                <li>Recibir tu salario semanal cada Sábado</li>
            </ul>
        </div>

        <div style="background-color: #052e16; border: 1px solid #166534; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <p style="color: #86efac; margin: 0; font-size: 14px; font-weight: bold;">
                💡 PROYECTO X GOLD — +1000% auditado en Myfxbook 2025
            </p>
            <p style="color: #4ade80; margin: 8px 0 0; font-size: 13px;">
                5 IAs Neurales operando XAU/USD en tiempo real
            </p>
        </div>

        <div style="text-align: center; margin: 35px 0 20px;">
            <a href="https://proyecto-x-user.vercel.app" style="background-color: #00f3ff; color: #030712; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px; letter-spacing: 1px; display: inline-block;">
                ACCEDER AL PANEL →
            </a>
        </div>

        <p style="color: #475569; font-size: 13px; text-align: center; margin-top: 30px; border-top: 1px solid #1f2937; padding-top: 20px;">
            Gracias por confiar en PROYECTO X Protocol.<br/>
            Si no creaste esta cuenta, ignora este mensaje.
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
                from: "PROYECTO X Protocol <soporte@proyecto-x-user.vercel.app>",
                to: [email],
                subject: "¡Bienvenido a PROYECTO X Protocol! Tu cuenta está lista",
                html: html
            })
        })

        const resendData = await res.json()
        console.log("Welcome email sent:", resendData)

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
