const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function test() {
  const { data: { session } } = await supabase.auth.getSession();
  console.log("Session:", session);
  const { data: profile } = await supabase.from('profiles').select('id, email').eq('email', 'vanessacano019@gmail.com').single();
  const { data: txs } = await supabase.from('transactions').select('*').eq('user_id', profile.id);
  console.log("Vanessa txs length:", txs?.length);
}
test();
