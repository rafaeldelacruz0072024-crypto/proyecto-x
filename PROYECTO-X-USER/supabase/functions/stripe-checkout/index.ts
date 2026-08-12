import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("--- INICIO STRIPE CHECKOUT ---");

    // 1. Validar JWT del usuario
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No se proporcionó cabecera de autorización.");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
    const successUrl = Deno.env.get("STRIPE_SUCCESS_URL") ?? "https://tu-app.com/dashboard?payment=success";
    const cancelUrl = Deno.env.get("STRIPE_CANCEL_URL") ?? "https://tu-app.com/dashboard?payment=cancelled";

    if (!stripeSecretKey) {
      throw new Error("La clave secreta de Stripe no está configurada en el servidor.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    // 2. Obtener usuario autenticado
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error("Auth error:", authError);
      throw new Error("Sesión expirada. Por favor, vuelve a iniciar sesión.");
    }

    // 3. Leer y validar el monto
    const body = await req.json();
    const amount = Number(body.amount);

    if (!amount || isNaN(amount) || amount <= 0) {
      throw new Error("Monto de depósito inválido.");
    }
    if (amount < 5) {
      throw new Error("El monto mínimo para pago con tarjeta es $5.");
    }
    if (amount > 50000) {
      throw new Error("El monto máximo por depósito es $50,000.");
    }

    console.log(`Paso 1: Monto válido ($${amount}) para usuario ${user.id}`);

    // 4. Crear registro de depósito PENDING en DB
    const { data: deposit, error: depError } = await supabase
      .from("deposits")
      .insert({
        user_id: user.id,
        amount,
        method: "STRIPE",
        status: "PENDING",
        transaction_hash: null,
      })
      .select()
      .single();

    if (depError) {
      console.error("Error al insertar depósito:", depError);
      throw new Error(`Error en base de datos: ${depError.message}`);
    }

    // 5. Crear registro en transactions (Ledger)
    const { error: txError } = await supabase.from("transactions").insert({
      user_id: user.id,
      type: "DEPOSIT",
      amount,
      status: "PENDING",
      description: `Depósito con Tarjeta (Stripe): $${amount} (Ref: ${deposit.id})`,
    });

    if (txError) {
      console.warn("No se pudo crear el log en transactions:", txError.message);
    }

    console.log(`Paso 2: Depósito creado en DB (ID: ${deposit.id})`);

    // 6. Crear Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Depósito Geminix",
              description: `Recarga de saldo por $${amount} USD`,
              images: [],
            },
            unit_amount: Math.round(amount * 100), // Stripe usa centavos
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${successUrl}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: {
        deposit_id: deposit.id,
        user_id: user.id,
        amount: amount.toString(),
      },
      customer_email: user.email,
    });

    // 7. Guardar el session_id de Stripe en el depósito para rastreo
    await supabase
      .from("deposits")
      .update({ transaction_hash: session.id })
      .eq("id", deposit.id);

    console.log(`Paso 3: Stripe Session creada (ID: ${session.id})`);
    console.log("--- STRIPE CHECKOUT COMPLETADO ---");

    return new Response(
      JSON.stringify({
        url: session.url,
        session_id: session.id,
        deposit_id: deposit.id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("STRIPE CHECKOUT ERROR:", error.message);
    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
