import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fejzahnvcxyxnckphcuu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlanphaG52Y3h5eG5ja3BoY3V1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTAxNDYzNywiZXhwIjoyMDg2NTkwNjM3fQ.hcLxdLC5VUuuhcXmMllfXpAdoVcskfrdqu1oKnhb5s0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    console.log('--- Checking Plans ---');
    const { data: plans, error: plansError } = await supabase.from('plans').select('*');
    if (plansError) console.error('Plans Error:', plansError);
    else console.log('Plans:', JSON.stringify(plans, null, 2));

    console.log('\n--- Checking Deposits ---');
    const { data: deposits, error: depError } = await supabase.from('deposits').select('*').limit(5);
    if (depError) console.error('Deposits Error:', depError);
    else console.log('Deposits:', JSON.stringify(deposits, null, 2));

    console.log('\n--- Checking Transactions ---');
    const { data: txs, error: txError } = await supabase.from('transactions').select('*').limit(5);
    if (txError) console.error('Transactions Error:', txError);
    else console.log('Transactions:', JSON.stringify(txs, null, 2));
}

checkData();
