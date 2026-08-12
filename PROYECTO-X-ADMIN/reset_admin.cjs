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

if (!key) {
    console.error("No key found in .env");
    process.exit(1);
}

const supabase = createClient(url, key, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function main() {
    // 1. Fetch all users from profiles to find an admin
    const { data: profiles, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['admin', 'super-admin'])
        .limit(1);

    if (profErr || !profiles || profiles.length === 0) {
        console.log("No admins found in profiles. Looking for ANY user...");
        const { data: anyUser, error } = await supabase.from('profiles').select('*').limit(1);
        if (!anyUser || anyUser.length === 0) {
            console.error("Database is empty! No users exist.");
            return;
        }

        console.log("Found user:", anyUser[0].email, "Promoting to admin and resetting password...");
        await resetAndPromote(anyUser[0].id, anyUser[0].email);
        return;
    }

    const admin = profiles[0];
    console.log("Found Admin Account:");
    console.log("Email:", admin.email);
    console.log("Role:", admin.role);

    await resetAndPromote(admin.id, admin.email);
}

async function resetAndPromote(userId, email) {
    const newPassword = "Password123!";

    // Update user password using admin API
    const { data, error } = await supabase.auth.admin.updateUserById(
        userId,
        { password: newPassword }
    );

    if (error) {
        console.error("Error updating password:", error.message);
        return;
    }

    // Ensure they are admin
    await supabase.from('profiles').update({ role: 'admin' }).eq('id', userId);

    console.log("\n✅ SUCCESS: Account access restored.");
    console.log("====================================");
    console.log("Email:    " + email);
    console.log("Password: " + newPassword);
    console.log("====================================");
}

main();
