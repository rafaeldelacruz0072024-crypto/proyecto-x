
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://fejzahnvcxyxnckphcuu.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlanphaG52Y3h5eG5ja3BoY3V1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTAxNDYzNywiZXhwIjoyMDg2NTkwNjM3fQ.hcLxdLC5VUuuhcXmMllfXpAdoVcskfrdqu1oKnhb5s0'
);

async function checkAdmins() {
    console.log("Checking for admin users...");
    const { data: admins, error } = await supabase
        .from('profiles')
        .select('id, email, role')
        .eq('role', 'admin');

    if (error) {
        console.error("Error fetching admins:", error.message);
    } else {
        console.log("Admins found:", admins.length);
        admins.forEach(a => console.log(`ID: ${a.id} | Email: ${a.email}`));
    }
}

checkAdmins();
