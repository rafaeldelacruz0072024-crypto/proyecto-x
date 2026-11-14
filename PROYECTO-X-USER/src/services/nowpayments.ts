import { supabase } from '../lib/supabase';

export interface PaymentDetails {
  payment_id: string;
  pay_address: string;
  pay_amount: number;
  pay_currency: string;
}

export async function isNowPaymentsAvailable(): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('nowpayments-proxy', { method: 'GET' });
    return !error && data?.available === true;
  } catch {
    return false;
  }
}

export async function createNowPayment(amount: number): Promise<{ data?: PaymentDetails; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('nowpayments-proxy', {
      body: { amount },
    });
    if (error) {
      const details = await error.context?.json?.().catch(() => null);
      return { error: details?.error };
    }
    return { data };
  } catch {
    return {};
  }
}
