const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function test() {
  const { data: profile } = await supabase.from('profiles').select('id, email').eq('email', 'alejo@bancus.io').single();
  if (!profile) {
    console.log("No profile found for alejo@bancus.io");
    return;
  }
  console.log("Profile ID:", profile.id);
  const { data: txs, error } = await supabase.from('transactions').select('*').eq('user_id', profile.id);
  console.log("Transactions count:", txs?.length, "Error:", error);
}
test();
