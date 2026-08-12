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

async function check() {
    const { data: invs, error } = await supabase
        .from('investments')
        .select(`
          id,
          user_id,
          profiles:user_id ( id, name, full_name, email )
        `)
        .limit(3);

    console.log("Error:", error);
    console.log(JSON.stringify(invs, null, 2));
}

check();
