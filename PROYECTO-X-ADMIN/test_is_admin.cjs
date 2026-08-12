const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env" });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function test() {
  const { data, error } = await supabase.rpc("is_admin");
  console.log("is_admin result:", data, error);
}
test();
