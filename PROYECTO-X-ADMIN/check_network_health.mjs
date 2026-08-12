import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fejzahnvcxyxnckphcuu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlanphaG52Y3h5eG5ja3BoY3V1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTAxNDYzNywiZXhwIjoyMDg2NTkwNjM3fQ.hcLxdLC5VUuuhcXmMllfXpAdoVcskfrdqu1oKnhb5s0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkNetwork() {
    console.log('--- Checking residual_config ---');
    const { data: settings } = await supabase.from('system_settings').select('residual_config, default_sponsor_id').single();
    console.log('residual_config:', JSON.stringify(settings?.residual_config, null, 2));
    console.log('default_sponsor_id:', settings?.default_sponsor_id);

    console.log('\n--- Checking Analysts (Users with null referred_by) ---');
    const { data: orphans, error: orphansError } = await supabase
        .from('profiles')
        .select('id, email, username, role, referred_by')
        .is('referred_by', null)
        .eq('role', 'user');
    
    if (orphansError) console.error('Orphans Error:', orphansError);
    else {
        console.log(`Found ${orphans?.length || 0} users without sponsor.`);
        if (orphans && orphans.length > 0) {
            console.log('Sample orphans:', JSON.stringify(orphans.slice(0, 5), null, 2));
        }
    }

    console.log('\n--- Checking ROOT user existence ---');
    const rootId = '982b42f4-dc05-4a55-b8b5-dac8b01c64f7';
    const { data: rootUser } = await supabase.from('profiles').select('id, username, email').eq('id', rootId).maybeSingle();
    if (rootUser) {
        console.log('ROOT User found:', rootUser);
    } else {
        console.log('ROOT User NOT found!');
    }
}

checkNetwork();
