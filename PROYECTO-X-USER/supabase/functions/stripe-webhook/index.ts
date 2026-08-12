import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

// IMPORTANTE: Este endpoint NO requiere CORS porque es llamado por Stripe, no por el browser.
serve(async (req) => {
  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!stripeSecretKey || !webhookSecret) {
      console.error("Faltan variables de entorno de Stripe.");
      return new Response("Server configuration error", { status: 500 });
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // CRÍTICO: Leer el body como texto plano para verificar la firma de Stripe
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      console.error("No se recibió firma de Stripe.");
      return new Response("Missing stripe-signature header", { status: 400 });
    }

    // Verificar autenticidad del webhook con la firma de Stripe
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      console.error(`Firma de webhook inválida: ${err.message}`);
      return new Response(`Webhook signature verification failed: ${err.message}`, { status: 400 });
    }

    console.log(`--- STRIPE WEBHOOK: ${event.type} ---`);

    // Manejar el evento de pago completado
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      // Verificar que el pago fue exitoso
      if (session.payment_status !== "paid") {
        console.log(`Sesión ${session.id} no está pagada. Estado: ${session.payment_status}`);
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      const depositId = session.metadata?.deposit_id;
      const userId = session.metadata?.user_id;
      const amount = parseFloat(session.metadata?.amount ?? "0");

      if (!depositId || !userId || !amount) {
        console.error("Metadata de sesión incompleta:", session.metadata);
        return new Response("Missing metadata", { status: 400 });
      }

      console.log(`Procesando pago confirmado: $${amount} para usuario ${userId} (depósito ${depositId})`);

      // 1. Actualizar depósito a COMPLETED
      const { error: depError } = await supabase
        .from("deposits")
        .update({
          status: "COMPLETED",
          transaction_hash: session.payment_intent as string ?? session.id,
        })
        .eq("id", depositId)
        .eq("user_id", userId);

      if (depError) {
        console.error("Error al actualizar depósito:", depError.message);
        throw new Error(`Error DB (deposits): ${depError.message}`);
      }

      // 2. Actualizar transacción en el ledger
      const { error: txError } = await supabase
        .from("transactions")
        .update({ status: "COMPLETED" })
        .match({
          user_id: userId,
          type: "DEPOSIT",
          status: "PENDING",
        })
        .like("description", `%${depositId}%`);

      if (txError) {
        console.warn("No se pudo actualizar la transacción en ledger:", txError.message);
      }

      // 3. Acreditar saldo al usuario (actualizar balance en profiles)
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("wallet_balance")
        .eq("user_id", userId)
        .single();

      if (profileError) {
        console.error("Error al obtener perfil del usuario:", profileError.message);
        throw new Error(`Error DB (profiles): ${profileError.message}`);
      }

      const currentBalance = parseFloat(profile?.wallet_balance ?? "0");
      const newBalance = currentBalance + amount;

      const { error: balanceError } = await supabase
        .from("profiles")
        .update({ wallet_balance: newBalance })
        .eq("user_id", userId);

      if (balanceError) {
        console.error("Error al acreditar saldo:", balanceError.message);
        throw new Error(`Error DB (balance update): ${balanceError.message}`);
      }

      console.log(`✅ Saldo acreditado: $${amount} → Nuevo balance: $${newBalance} para usuario ${userId}`);
      console.log("--- WEBHOOK PROCESADO CON ÉXITO ---");
    }

    // Devolver 200 a Stripe para confirmar recepción
    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("STRIPE WEBHOOK ERROR:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
});
