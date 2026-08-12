const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function test() {
  const { data: profile } = await supabase.from('profiles').select('id, email, full_name').eq('email', 'vanessacano019@gmail.com').single();
  if (!profile) {
    console.log("No profile found for vanessacano019@gmail.com");
    return;
  }
  const { data: txs, error } = await supabase.from('transactions').select('*').eq('user_id', profile.id);
  console.log("Vanessa Transactions count:", txs?.length, "Error:", error);
  if (txs && txs.length > 0) {
    console.log("Sample types:", txs.map(t => t.type));
  }
}
test();
