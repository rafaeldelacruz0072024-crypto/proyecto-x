import { supabase } from '../lib/supabase';

export interface StripeCheckoutResult {
  url?: string;
  session_id?: string;
  deposit_id?: string;
  error?: string;
}

/**
 * Crea una sesión de pago con Stripe Checkout.
 * Llama a la Edge Function 'stripe-checkout' en Supabase.
 *
 * @param amount - Monto en USD a depositar
 * @param userId - ID del usuario (se valida en el servidor vía JWT)
 * @returns URL de la sesión de Stripe para redirigir al usuario
 */
export async function createStripeCheckout(
  amount: number,
  _userId: string // Se mantiene por compatibilidad pero el servidor usa el JWT
): Promise<StripeCheckoutResult> {
  try {
    console.log(`Invocando stripe-checkout para monto $${amount}...`);

    const { data, error } = await supabase.functions.invoke('stripe-checkout', {
      body: { amount },
    });

    if (error) {
      console.error('Error al invocar Edge Function stripe-checkout:', error);

      // Intentar extraer mensaje de error del body de la respuesta
      try {
        if (error instanceof Error && 'context' in error) {
          const ctx = (error as any).context;
          if (ctx && typeof ctx.json === 'function') {
            const errorBody = await ctx.json();
            if (errorBody?.error) {
              return { error: `Error del servidor: ${errorBody.error}` };
            }
          }
        }
      } catch (e) {
        console.error('No se pudo parsear el error:', e);
      }

      return { error: error.message || 'No se pudo conectar con el servidor de pagos.' };
    }

    if (data?.error) {
      return { error: data.error };
    }

    if (!data?.url) {
      return { error: 'No se recibió URL de pago de Stripe.' };
    }

    return {
      url: data.url,
      session_id: data.session_id,
      deposit_id: data.deposit_id,
    };
  } catch (err: any) {
    console.error('Error inesperado en createStripeCheckout:', err);
    return { error: 'Error inesperado al procesar el pago con tarjeta.' };
  }
}
