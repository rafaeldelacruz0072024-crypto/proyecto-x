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
        JSON.stringify({ success: false, details: "Secret Key no configurada en las variables de entorno de Supabase." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Log parcial para verificar sincronización (Solo primeros 5 caracteres)
    const partialSecret = secretKey.substring(0, 5) + "...";
    console.log(`Verificando captcha con Secret Key que empieza por: ${partialSecret}`);

    const verifyUrl = "https://www.google.com/recaptcha/api/siteverify";
    const formData = new URLSearchParams();
    formData.append("secret", secretKey);
    formData.append("response", token);

    const response = await fetch(verifyUrl, {
      method: "POST",
      body: formData,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    const result = await response.json();

    if (!result.success) {
      const errorCodes: Record<string, string> = {
        "missing-input-secret": "Secret Key no configurada.",
        "invalid-input-secret": "La Secret Key en Supabase es inválida.",
        "missing-input-response": "Token no recibido.",
        "invalid-input-response": "Token rechazado por Google (Mismatched con Site Key o Dominio).",
        "bad-request": "Solicitud mal formada.",
        "timeout-or-duplicate": "Token expirado o duplicado.",
      };
      
      const firstError = result["error-codes"]?.[0] || "unknown";
      const details = errorCodes[firstError] || `Error: ${firstError}`;
      
      // DEBUG ampliado
      const debugInfo = ` | Proyect: fejzahnvcxyxnckphcuu | Key Start: ${partialSecret} | Google Raw: ${JSON.stringify(result)}`;

      return new Response(
        JSON.stringify({ success: false, details: details + debugInfo }),
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
