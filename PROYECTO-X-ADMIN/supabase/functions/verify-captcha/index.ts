import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, details: "Token no proporcionado." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const secretKey = Deno.env.get("RECAPTCHA_SECRET");
    if (!secretKey) {
      return new Response(
        JSON.stringify({ success: false, details: "Secret Key no configurada en el servidor (Edge Function)." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const verifyUrl = "https://www.google.com/recaptcha/api/siteverify";
    const formData = new URLSearchParams();
    formData.append("secret", secretKey);
    formData.append("response", token);

    const response = await fetch(verifyUrl, {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (!result.success) {
      const errorCodes: Record<string, string> = {
        "missing-input-secret": "Secret Key no configurada. Verifica las variables de entorno.",
        "invalid-input-secret": "La Secret Key en Supabase es incorrecta para este Site Key.",
        "missing-input-response": "Token de reCAPTCHA no recibido.",
        "invalid-input-response": "Token de reCAPTCHA inválido o expirado.",
        "bad-request": "Solicitud inválida.",
        "timeout-or-duplicate": "El token expiró o ya fue usado. Por favor recarga la página.",
      };
      
      const firstError = result["error-codes"]?.[0] || "unknown";
      const details = errorCodes[firstError] || `Error: ${firstError}`;
      
      // DEBUG: Incluimos el resultado completo de Google para ver el hostname y otros detalles
      const debugInfo = ` | Google Response: ${JSON.stringify(result)}`;

      return new Response(
            JSON.stringify({ success: false, error: result["error-codes"], details: details + debugInfo }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, details: "Error interno del servidor." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
