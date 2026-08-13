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
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // 1. Fetch Telegram Settings from the database
        const { data: settings, error: settingsError } = await supabase
            .from('system_settings')
            .select('*')
            .limit(1)
            .single()

        if (settingsError || !settings) {
            console.error("Error fetching settings:", settingsError)
            throw new Error("Could not fetch system settings.")
        }

        const botToken = settings.telegram_bot_token
        if (!botToken) {
            console.error("Telegram Bot Token not configured in Admin Settings.")
            return new Response(JSON.stringify({ error: "Bot token not configured" }), { status: 200 })
        }

        // 2. Parse Telegram Update
        const update = await req.json()
        console.log("Received update:", JSON.stringify(update))

        if (!update.message || !update.message.text) {
            return new Response("ok")
        }

        const chatId = update.message.chat.id
        const messageText = update.message.text
        const userLanguage = update.message.from?.language_code || 'en'

        // 3. Handle /start command
        if (messageText.startsWith('/start')) {
            // Choose the right welcome message based on language
            let welcomeMessage = settings.telegram_welcome_en || "Welcome to PROYECTO X!"

            if (userLanguage.startsWith('es')) {
                welcomeMessage = settings.telegram_welcome_es || welcomeMessage
            } else if (userLanguage.startsWith('pt')) {
                welcomeMessage = settings.telegram_welcome_pt || welcomeMessage
            } else if (userLanguage.startsWith('fr')) {
                welcomeMessage = settings.telegram_welcome_fr || welcomeMessage
            } else if (userLanguage.startsWith('it')) {
                welcomeMessage = settings.telegram_welcome_it || welcomeMessage
            } else if (userLanguage.startsWith('zh')) {
                welcomeMessage = settings.telegram_welcome_zh || welcomeMessage
            } else if (userLanguage.startsWith('ja')) {
                welcomeMessage = settings.telegram_welcome_ja || welcomeMessage
            }

            // 4. Send Message via Telegram API
            const telResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: welcomeMessage,
                    parse_mode: 'HTML'
                })
            })

            const telData = await telResponse.json()
            if (!telData.ok) {
                console.error("Telegram API Error:", telData)
            }
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        })

    } catch (error) {
        console.error("Error processing update:", error.message)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
        })
    }
})
