
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://fejzahnvcxyxnckphcuu.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlanphaG52Y3h5eG5ja3BoY3V1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTAxNDYzNywiZXhwIjoyMDg2NTkwNjM3fQ.hcLxdLC5VUuuhcXmMllfXpAdoVcskfrdqu1oKnhb5s0'
);

async function forceAdminSetup() {
    const email = 'gentecash@gmail.com';
    const userId = '982b42f4-dc05-4a55-b8b5-dac8b01c64f7';
    const password = 'Password123!';

    console.log(`🛠️ Forcing Admin Setup for ${email} (${userId})...`);

    // 1. Force Update Password in Auth
    const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
        password: password,
        email_confirm: true
    });

    if (authError) {
        console.error("❌ Auth update error:", authError.message);
        return;
    }
    console.log("✅ Auth password updated.");

    // 2. Ensure Profile exists and is ADMIN
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .upsert({
            id: userId,
            email: email,
            role: 'admin',
            status: 'ACTIVE',
            full_name: 'GenteCash Admin',
            user_tag: 'REAL'
        })
        .select();

    if (profileError) {
        console.error("❌ Profile error:", profileError.message);
    } else {
        console.log("✅ Profile set to ADMIN.");
        console.log("-----------------------------------");
        console.log(`Email: ${email}`);
        console.log(`Password: ${password}`);
        console.log("-----------------------------------");
        console.log("🚀 Everything ready! Please try logging in at https://admin.geminixprotocol.com");
    }
}

forceAdminSetup();
