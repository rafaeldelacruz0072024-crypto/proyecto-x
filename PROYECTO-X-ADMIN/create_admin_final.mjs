
import { createClient } from '@supabase/supabase-js';

// Using the Service Role Key for administrative actions
const supabase = createClient(
    'https://fejzahnvcxyxnckphcuu.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlanphaG52Y3h5eG5ja3BoY3V1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTAxNDYzNywiZXhwIjoyMDg2NTkwNjM3fQ.hcLxdLC5VUuuhcXmMllfXpAdoVcskfrdqu1oKnhb5s0'
);

async function createAndElevateAdmin() {
    const email = 'gentecash@gmail.com';
    const password = 'Password123!';

    console.log(`🚀 Starting administrative setup for ${email}...`);

    // 1. Create User in Supabase Auth (or Update if exists)
    const { data: userData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: 'GenteCash Admin' }
    });

    let userId;

    if (authError) {
        if (authError.message.includes('already registered')) {
            console.log("ℹ️ User already exists in Auth. Fetching ID...");
            const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
            const existingUser = listData.users.find(u => u.email === email);
            if (!existingUser) throw new Error("Could not find existing user ID.");
            userId = existingUser.id;

            // Update password for existing user
            await supabase.auth.admin.updateUserById(userId, { password });
            console.log("✅ Password updated for existing user.");
        } else {
            console.error("❌ Auth Error:", authError.message);
            return;
        }
    } else {
        userId = userData.user.id;
        console.log("✅ User created in Supabase Auth.");
    }

    // 2. Ensure Profile exists and set Role to Admin
    // Sometimes the trigger creates the profile, but we'll upsert to be safe.
    const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .upsert({
            id: userId,
            email: email,
            role: 'admin',
            status: 'ACTIVE',
            full_name: 'GenteCash Admin'
        }, { onConflict: 'id' })
        .select();

    if (profileError) {
        console.error("❌ Profile Error:", profileError.message);
    } else {
        console.log("✅ Profile established as ADMIN.");
        console.log("-----------------------------------");
        console.log(`Email: ${email}`);
        console.log(`Password: ${password}`);
        console.log(`Role: ${profileData[0].role}`);
        console.log("-----------------------------------");
    }
}

createAndElevateAdmin();
