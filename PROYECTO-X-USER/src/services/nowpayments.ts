import { supabase } from '../lib/supabase';

/**
 * NOWPayments Service
 * Handles interaction with the NOWPayments API to create payment orders.
 */

export interface PaymentRequest {
    price_amount: number;
    price_currency: string;
    pay_currency: string;
    order_id: string;
    order_description: string;
    ipn_callback_url?: string;
}

export interface PaymentResponse {
    payment_id: string;
    pay_address: string;
    price_amount: number;
    price_currency: string;
    pay_amount: number;
    pay_currency: string;
    order_id: string;
    order_description: string;
    created_at: string;
    updated_at: string;
}

export async function createNowPayment(amount: number, userId: string): Promise<{ data?: PaymentResponse; error?: string }> {
    try {
        console.log(`Invocando proxy de pago para usuario ${userId} y monto ${amount}...`);

        const { data, error } = await supabase.functions.invoke('nowpayments-proxy', {
            body: { amount, userId }
        });

        if (error) {
            console.error("Error al invocar Edge Function:", error);

            // Intentar extraer el mensaje de error del cuerpo de la respuesta si es una instancia de FunctionsHttpError
            try {
                if (error instanceof Error && 'context' in error) {
                    const ctx = (error as any).context;
                    if (ctx && typeof ctx.json === 'function') {
                        const errorBody = await ctx.json();
                        if (errorBody && errorBody.error) {
                            return { error: `Error del Servidor: ${errorBody.error}` };
                        }
                    }
                }
            } catch (e) {
                console.error("No se pudo parsear el error:", e);
            }

            const errorMessage = error.message || "No se pudo conectar con el servidor de pagos.";
            return { error: `Error del Servidor: ${errorMessage}` };
        }

        if (data && data.error) {
            return { error: data.error };
        }

        return { data };
    } catch (err: any) {
        console.error("Execute Payment Exception:", err);
        return { error: "Error inesperado al procesar el pago." };
    }
}
