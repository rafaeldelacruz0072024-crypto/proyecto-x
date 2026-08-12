
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://fejzahnvcxyxnckphcuu.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlanphaG52Y3h5eG5ja3BoY3V1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTAxNDYzNywiZXhwIjoyMDg2NTkwNjM3fQ.hcLxdLC5VUuuhcXmMllfXpAdoVcskfrdqu1oKnhb5s0'
);

async function createAdminFromScratch() {
    const email = 'gentecash@gmail.com';
    const password = 'Password123!';

    console.log(`🚀 Creating and elevating ${email}...`);

    // 1. Create User in Auth
    const { data: userData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: 'GenteCash Admin' }
    });

    if (authError) {
        console.error("❌ Auth Error:", authError.message);
        return;
    }

    const userId = userData.user.id;
    console.log(`✅ User created with ID: ${userId}`);

    // 2. Clear existing profile if there's any conflict (unlikely but safe)
    await supabase.from('profiles').delete().eq('email', email);

    // 3. Insert/Upsert Profile as Admin
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .upsert({
            id: userId,
            email: email,
            role: 'admin',
            status: 'ACTIVE',
            full_name: 'GenteCash Admin',
            user_tag: 'REAL'
        }, { onConflict: 'id' })
        .select();

    if (profileError) {
        console.error("❌ Profile Error:", profileError.message);
    } else {
        console.log("✅ SUCCESS: User established as ADMIN.");
        console.log("-----------------------------------");
        console.log(`Email: ${email}`);
        console.log(`Password: ${password}`);
        console.log("-----------------------------------");
    }
}

createAdminFromScratch();
