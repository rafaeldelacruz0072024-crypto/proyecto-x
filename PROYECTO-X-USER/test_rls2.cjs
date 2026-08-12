const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

// We need service_role key to query pg_policies, but we don't have it.
// Let's just create a SQL RPC to get the policies.
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
  const { data, error } = await supabase.from('transactions').select('*').limit(1);
  console.log(data);
}
main();
