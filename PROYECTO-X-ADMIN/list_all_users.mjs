
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://fejzahnvcxyxnckphcuu.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlanphaG52Y3h5eG5ja3BoY3V1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTAxNDYzNywiZXhwIjoyMDg2NTkwNjM3fQ.hcLxdLC5VUuuhcXmMllfXpAdoVcskfrdqu1oKnhb5s0'
);

async function listAllUsers() {
    console.log("Listing all profiles in database...");
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, email, role, full_name, created_at');

    if (error) {
        console.error("Error fetching profiles:", error.message);
    } else {
        console.log(`Found ${profiles.length} total users.`);
        profiles.forEach(p => {
            console.log(`- ${p.email} [${p.role}] (${p.full_name}) Created: ${p.created_at}`);
        });
    }
}

listAllUsers();
