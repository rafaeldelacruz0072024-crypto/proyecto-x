import { createClient } from '@supabase/supabase-js';

const s = createClient('https://fejzahnvcxyxnckphcuu.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlanphaG52Y3h5eG5ja3BoY3V1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTAxNDYzNywiZXhwIjoyMDg2NTkwNjM3fQ.hcLxdLC5VUuuhcXmMllfXpAdoVcskfrdqu1oKnhb5s0');

async function check() {
    const { data, error } = await s
        .from('profiles')
        .select('id, email, ref_code')
        .or('ref_code.eq.Generating...,ref_code.is.null,ref_code.eq.');

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Users with missing or suspicious ref_code:', data.length);
        data.forEach(u => console.log(`ID: ${u.id}, Email: ${u.email}, Code: "${u.ref_code}"`));
    }
}

check();
