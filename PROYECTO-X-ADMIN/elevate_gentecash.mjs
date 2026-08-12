
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://fejzahnvcxyxnckphcuu.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlanphaG52Y3h5eG5ja3BoY3V1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTAxNDYzNywiZXhwIjoyMDg2NTkwNjM3fQ.hcLxdLC5VUuuhcXmMllfXpAdoVcskfrdqu1oKnhb5s0'
);

async function elevateUser() {
    const email = 'gentecash@gmail.com';
    console.log(`Checking profile for ${email}...`);

    // 1. First check if profile exists
    const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('id, email, role')
        .eq('email', email)
        .maybeSingle();

    if (fetchError) {
        console.error("Error fetching profile:", fetchError.message);
        return;
    }

    if (!profile) {
        console.log(`❌ FAILED: User ${email} not found in profiles table.`);
        console.log("Please make sure you registered this account on the landing/login page first.");
        return;
    }

    // 2. Elevate to admin
    console.log(`Found user ID: ${profile.id}. Elevating to admin...`);

    const { data, error } = await supabase
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', profile.id)
        .select();

    if (error) {
        console.error("Error elevating user:", error.message);
    } else {
        console.log("✅ SUCCESS: User elevated to admin.");
        console.log(data[0]);
    }
}

elevateUser();
