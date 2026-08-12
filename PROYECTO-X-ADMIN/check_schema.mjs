import { createClient } from '@supabase/supabase-js';

const url = 'https://fejzahnvcxyxnckphcuu.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlanphaG52Y3h5eG5ja3BoY3V1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTAxNDYzNywiZXhwIjoyMDg2NTkwNjM3fQ.hcLxdLC5VUuuhcXmMllfXpAdoVcskfrdqu1oKnhb5s0';

const s = createClient(url, key);

async function run() {
    console.log("Checking profiles table schema...");
    const { data: schema, error: schemaErr } = await s.rpc('exec_sql', { 
        sql_query: "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'profiles' AND table_schema = 'public' ORDER BY column_name;" 
    });
    
    if (schemaErr) {
        console.error('Error fetching schema:', schemaErr);
    } else {
        console.table(schema);
    }

    console.log("\nChecking triggers for auth.users and public.profiles...");
    const { data: triggers, error: trigErr } = await s.rpc('exec_sql', { 
        sql_query: `
            SELECT 
                tgname as trigger_name, 
                relname as table_name,
                proname as function_name
            FROM pg_trigger 
            JOIN pg_class ON pg_class.oid = tgrelid 
            JOIN pg_proc ON pg_proc.oid = tgfoid 
            WHERE relname IN ('users', 'profiles')
            AND nspname = CASE WHEN relname = 'users' THEN 'auth' ELSE 'public' END
            FROM pg_namespace n JOIN pg_class c ON c.relnamespace = n.oid WHERE c.relname IN ('users', 'profiles');
        `.trim() // This query might be too complex for a single string, let's simplify
    });

    // SIMPLER QUERY FOR TRIGGERS
    const { data: simpleTriggers, error: simpleTrigErr } = await s.rpc('exec_sql', { 
        sql_query: "SELECT trigger_name, event_manipulation, event_object_table, action_timing FROM information_schema.triggers WHERE event_object_table = 'users' OR event_object_table = 'profiles';" 
    });

    if (simpleTrigErr) {
        console.error('Error fetching simple triggers:', simpleTrigErr);
    } else {
        console.table(simpleTriggers);
    }
}

run();
