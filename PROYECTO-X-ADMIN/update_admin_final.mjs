
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://fejzahnvcxyxnckphcuu.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlanphaG52Y3h5eG5ja3BoY3V1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTAxNDYzNywiZXhwIjoyMDg2NTkwNjM3fQ.hcLxdLC5VUuuhcXmMllfXpAdoVcskfrdqu1oKnhb5s0'
);

async function updateAdminAccess() {
    const email = 'gentecash@gmail.com';
    const password = 'Password123!';

    console.log(`🔍 Updating admin access for ${email}...`);

    // 1. Find User by Email in Auth
    const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
        console.error("❌ Auth Error:", listError.message);
        return;
    }

    const user = listData.users.find(u => u.email === email);

    if (!user) {
        console.log("❌ User not found in Auth. Please register first or use createUser script.");
        return;
    }

    const userId = user.id;
    console.log(`✅ Found User ID: ${userId}`);

    // 2. Update Password
    const { error: updateAuthError } = await supabase.auth.admin.updateUserById(userId, { password });
    if (updateAuthError) {
        console.error("❌ Password Update Error:", updateAuthError.message);
        return;
    }
    console.log("✅ Password updated successfully.");

    // 3. Upsert Profile as Admin
    const { data: profile, error: profileError } = await supabase
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
        console.log("✅ SUCCESS: gentecash@gmail.com is now an ADMIN.");
    }
}

updateAdminAccess();
