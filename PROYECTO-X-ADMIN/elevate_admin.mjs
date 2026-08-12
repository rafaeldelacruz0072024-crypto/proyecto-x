
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://fejzahnvcxyxnckphcuu.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlanphaG52Y3h5eG5ja3BoY3V1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTAxNDYzNywiZXhwIjoyMDg2NTkwNjM3fQ.hcLxdLC5VUuuhcXmMllfXpAdoVcskfrdqu1oKnhb5s0'
);

async function elevateUser() {
    const email = 'test5@gmail.com';
    console.log(`Elevating ${email} to admin...`);

    const { data, error } = await supabase
        .from('profiles')
        .update({ role: 'admin' })
        .eq('email', email)
        .select();

    if (error) {
        console.error("Error elevating user:", error.message);
    } else if (data && data.length > 0) {
        console.log("✅ SUCCESS: User elevated to admin.");
        console.log(data[0]);
    } else {
        console.log("❌ FAILED: User not found.");
    }
}

elevateUser();
