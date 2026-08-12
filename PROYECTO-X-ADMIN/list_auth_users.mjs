
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://fejzahnvcxyxnckphcuu.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlanphaG52Y3h5eG5ja3BoY3V1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTAxNDYzNywiZXhwIjoyMDg2NTkwNjM3fQ.hcLxdLC5VUuuhcXmMllfXpAdoVcskfrdqu1oKnhb5s0'
);

async function listAllAuthUsers() {
    console.log("Listing all users in Supabase Auth...");
    const { data, error } = await supabase.auth.admin.listUsers();

    if (error) {
        console.error("❌ Error listing users:", error.message);
        return;
    }

    console.log(`Found ${data.users.length} users in Auth:`);
    data.users.forEach(u => {
        console.log(`- ${u.email} (ID: ${u.id}) [Last Sign In: ${u.last_sign_in_at || 'Never'}]`);
    });
}

listAllAuthUsers();
