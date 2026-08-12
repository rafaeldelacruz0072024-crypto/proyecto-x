import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if(!supabaseUrl || !supabaseKey) {
  console.log("No env vars found. Trying to parse .env directly...");
  // fallback if needed
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("=== DEBUGGING ROI ENGINE && INVESTMENTS ===");
  
  // 1. Fetch investments
  console.log("Fetching investments...");
  const { data: invData, error: invError } = await supabase
    .from('investments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (invError) {
    console.error("Error fetching investments:", invError);
    return;
  }
  
  console.log(`Found ${invData?.length} investments.`);
  
  if (invData && invData.length > 0) {
    const uniqueIds = [...new Set(invData.map((i: any) => i.user_id))].filter(Boolean);
    console.log("Unique User IDs to fetch:", uniqueIds);
    
    // 2. Fetch profiles
    const { data: profData, error: profError } = await supabase
      .from('profiles')
      .select('id, email, full_name, username, user_tag')
      .in('id', uniqueIds);
      
    if (profError) {
      console.error("Error fetching profiles:", profError);
    } else {
      console.log(`Fetched ${profData?.length} profiles via .in()`);
      console.log("Profiles returned:", profData);
    }
  }

  console.log("=== DONE ===");
}

main();
