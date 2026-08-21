import { supabase } from '../lib/supabase';

type NotificationPayload =
  | { type: 'WELCOME' }
  | { type: 'WITHDRAWAL_REQUESTED'; withdrawalId: string };

async function requestEmailNotification(payload: NotificationPayload) {
  try {
    const { data, error } = await supabase.functions.invoke('nova-email-notifications', {
      body: payload,
    });

    if (error) throw error;
    return { success: Boolean(data?.success), duplicate: Boolean(data?.duplicate) };
  } catch (error) {
    // El correo es secundario: nunca debe revertir un registro o retiro válido.
    console.warn('No se pudo solicitar el correo transaccional:', error);
    return { success: false, duplicate: false };
  }
}

export const requestWelcomeEmail = () => requestEmailNotification({ type: 'WELCOME' });

export const requestWithdrawalEmail = (withdrawalId: string) =>
  requestEmailNotification({ type: 'WITHDRAWAL_REQUESTED', withdrawalId });
