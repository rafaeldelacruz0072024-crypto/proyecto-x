import { supabase } from '../lib/supabase';
import { GatewayConfig } from '../types';

/**
 * NOWPayments Service
 * Handles interaction with the NOWPayments API to create payment orders.
 */

const API_BASE_URL = 'https://api.nowpayments.io/v1';
const SANDBOX_API_BASE_URL = 'https://api.sandbox.nowpayments.io/v1';

export async function getGatewayConfig(provider: string = 'now'): Promise<GatewayConfig | null> {
    try {
        // Broad search for ANY gateway that might be NOWPayments
        const { data: allGateways, error: fetchAllError } = await supabase
            .from('system_gateways')
            .select('*');

        if (fetchAllError) {
            console.error("Error fetching any gateway:", fetchAllError.message);
            return null;
        }

        console.log("Total pasarelas encontradas en DB:", allGateways?.length || 0);
        console.log("Nombres de pasarelas:", allGateways?.map(g => g.provider).join(', '));

        // Find the most likely candidate
        const candidate = allGateways?.find(g =>
            g.is_active &&
            g.provider.toLowerCase().includes(provider.toLowerCase())
        );

        if (candidate) {
            console.log("Candidato encontrado:", candidate.provider);
            return candidate;
        }

        // Fallback: If no direct match, take the first active one if it's the only one
        if (allGateways?.length === 1 && allGateways[0].is_active) {
            console.log("Solo hay una pasarela activa, usándola:", allGateways[0].provider);
            return allGateways[0];
        }

        return null;
    } catch (error) {
        console.error(`Unexpected error in getGatewayConfig:`, error);
        return null;
    }
}

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
