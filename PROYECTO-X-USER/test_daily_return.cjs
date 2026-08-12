const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function test() {
  const { data, error } = await supabase.from("transactions").select("*").eq("type", "DAILY_RETURN").limit(5);
  console.log("Error:", error);
  console.log("Data length:", data?.length);
  if(data?.length > 0) console.log("Sample:", data[0]);
}
test();
