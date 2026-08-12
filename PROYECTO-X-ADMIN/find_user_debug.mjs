
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://fejzahnvcxyxnckphcuu.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlanphaG52Y3h5eG5ja3BoY3V1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTAxNDYzNywiZXhwIjoyMDg2NTkwNjM3fQ.hcLxdLC5VUuuhcXmMllfXpAdoVcskfrdqu1oKnhb5s0'
);

async function findSpecificUser() {
    const targetEmail = 'gentecash@gmail.com';
    console.log(`🔍 Searching for ${targetEmail} in all Auth users...`);

    let allUsers = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase.auth.admin.listUsers({
            page: page,
            perPage: 1000
        });

        if (error) {
            console.error("❌ Error:", error.message);
            break;
        }

        allUsers = allUsers.concat(data.users);
        if (data.users.length < 1000) {
            hasMore = false;
        } else {
            page++;
        }
    }

    console.log(`Total users in Auth: ${allUsers.length}`);

    const found = allUsers.filter(u => u.email?.toLowerCase().includes('gentecash'));

    if (found.length > 0) {
        console.log("✅ Found matches:");
        found.forEach(u => {
            console.log(`- Email: ${u.email} | ID: ${u.id} | Confirmed: ${u.email_confirmed_at}`);
        });
    } else {
        console.log("❌ No matches found with 'gentecash' in email.");
    }
}

findSpecificUser();
