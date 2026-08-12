const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
    if (line.trim() && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        if (key) env[key.trim()] = valueParts.join('=').trim().replace(/^['"]|['"]$/g, '');
    }
});

const url = env['VITE_SUPABASE_URL'];
const key = env['VITE_SUPABASE_SERVICE_ROLE_KEY'] || env['VITE_SUPABASE_ANON_KEY'];

const supabase = createClient(url, key);

async function main() {
    const { data: users, error: err } = await supabase.from('profiles').select('id, full_name').ilike('full_name', '%ALAN%').limit(5);
    if (err) {
        console.error('Error fetching users:', err);
        return;
    }
    console.log('Found users:', users);

    if (users && users.length > 0) {
        const userId = users[0].id;

        // Check investments
        const { data: invs } = await supabase.from('investments').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(10);
        console.log('\nLast 10 investments:', invs);
    }
}

main();
