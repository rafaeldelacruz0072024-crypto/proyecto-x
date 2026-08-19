import { supabase } from '../lib/supabase';

export interface CryptopPaymentResponse {
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

/**
 * Solicita una orden CRYPTOP a través de una Edge Function server-side.
 * Las credenciales nunca se exponen en el navegador.
 */
export async function createCryptopPayment(
  amount: number,
  userId: string,
): Promise<{ data?: CryptopPaymentResponse; error?: string }> {
  if (!Number.isFinite(amount) || amount < 25) {
    return { error: 'El depósito mínimo es de 25 USD.' };
  }
  if (!userId) {
    return { error: 'Sesión de usuario requerida.' };
  }

  try {
    const { data, error } = await supabase.functions.invoke('cryptop-proxy', {
      body: {
        amount,
        userId,
        network: 'BEP20',
        blockchain: 'BNB',
        asset: 'USDT',
      },
    });

    if (error) return { error: error.message || 'No se pudo conectar con CRYPTOP.' };
    if (!data || data.error) return { error: data?.error || 'CRYPTOP no devolvió una orden válida.' };
    return { data: data as CryptopPaymentResponse };
  } catch (error: any) {
    return { error: error?.message || 'Error inesperado al crear el pago CRYPTOP.' };
  }
}
