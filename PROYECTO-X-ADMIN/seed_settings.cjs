const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
    if (line.trim() && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        if (key) env[key.trim()] = valueParts.join('=').trim().replace(/^['"]|['"]$/g, '');
    }
});

const url = env['VITE_SUPABASE_URL'];
const key = env['VITE_SUPABASE_ANON_KEY'];
const supabase = createClient(url, key);

async function fixSettings() {
    const { data: existing, error: errFetch } = await supabase.from('system_settings').select('*');
    if (existing && existing.length > 0) {
        console.log("Settings exist:", existing);
        return;
    }
    console.log("Settings is empty, inserting defaults...");

    // Default values based on PROYECTO X setup
    const defaultSettings = {
        withdrawal_fee: 10,
        credit_transfer_fee: 3,
        support_whatsapp: "+1234567890",
        residual_config: [
            { level: 1, percentage: 5 },
            { level: 2, percentage: 3 },
            { level: 3, percentage: 2 },
            { level: 4, percentage: 1 },
            { level: 5, percentage: 1 },
            { level: 6, percentage: 0.5 },
            { level: 7, percentage: 0.5 }
        ],
        direct_referral_percentage: 10
    };

    const { data, error } = await supabase.from('system_settings').insert([defaultSettings]).select();
    if (error) {
        console.error("Error inserting:", error);
    } else {
        console.log("Successfully inserted defaults:", data);
    }
}

fixSettings();
