const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkAnon() {
  const { data, error } = await supabase.from('transactions').select('*').limit(5);
  console.log("Transactions with anon:", data?.length, error);
}
checkAnon();
