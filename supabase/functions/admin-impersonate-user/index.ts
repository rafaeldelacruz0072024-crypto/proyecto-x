import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const USER_APP_URL = "https://proyecto-x-user.vercel.app/login";
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://proyecto-x-admin.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      ...corsHeaders,
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
    },
  });

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Configuración del servidor incompleta" }, 500);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const authorization = req.headers.get("Authorization") ?? "";
  const accessToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";

  if (!accessToken) return json({ error: "Sesión administrativa requerida" }, 401);

  const { data: callerData, error: callerError } =
    await supabaseAdmin.auth.getUser(accessToken);
  const caller = callerData?.user;

  if (callerError || !caller) return json({ error: "Sesión administrativa inválida" }, 401);

  const { data: adminProfile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, role, status")
    .eq("id", caller.id)
    .single();

  if (
    profileError ||
    !adminProfile ||
    !["admin", "sub-admin"].includes(adminProfile.role) ||
    adminProfile.status !== "active"
  ) {
    return json({ error: "Acceso reservado para administradores activos" }, 403);
  }

  const payload = await req.json().catch(() => ({}));
  const targetUserId = typeof payload?.targetUserId === "string" ? payload.targetUserId : "";

  if (!targetUserId) return json({ error: "Usuario objetivo requerido" }, 400);
  if (targetUserId === caller.id) {
    return json({ error: "Ya estás conectado con esta cuenta administrativa" }, 400);
  }

  const { data: targetData, error: targetError } =
    await supabaseAdmin.auth.admin.getUserById(targetUserId);
  const targetUser = targetData?.user;

  if (targetError || !targetUser?.email) {
    return json({ error: "No se encontró una cuenta de acceso para este usuario" }, 404);
  }

  const { data: linkData, error: linkError } =
    await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: targetUser.email,
      options: { redirectTo: USER_APP_URL },
    });

  const actionLink = linkData?.properties?.action_link;
  if (linkError || !actionLink) {
    console.error("No se pudo generar el acceso administrativo", linkError);
    return json({ error: "No se pudo generar el acceso temporal" }, 500);
  }

  return json({ success: true, actionLink, targetUserId });
});
