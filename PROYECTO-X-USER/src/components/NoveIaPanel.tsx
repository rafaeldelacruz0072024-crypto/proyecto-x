import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { createNowPayment, type PaymentDetails } from '../services/nowpayments';
import { Bot, CalendarDays, CreditCard, Layers } from 'lucide-react';

export default function NoveIaPanel({ activeCycles, userId }: { activeCycles: number; userId: string }) {
  const [paidUntil, setPaidUntil] = useState<string>();
  const [payment, setPayment] = useState<PaymentDetails>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function refresh() {
      const { data } = await supabase.from('nova_ia_subscriptions').select('paid_until').eq('user_id', userId).maybeSingle();
      if (active) setPaidUntil(data?.paid_until);
    }
    void refresh();
    const timer = window.setInterval(refresh, 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, [userId]);

  async function buy() {
    setBusy(true);
    setError('');
    const result = await createNowPayment(50, 'nova-ia');
    setPayment(result.data);
    if (!result.data) setError(result.error || 'No se pudo generar el pago. Intenta de nuevo.');
    setBusy(false);
  }

  const subscribed = Boolean(paidUntil && Date.parse(paidUntil) > Date.now());
  return (
    <section aria-labelledby="nova-ia-plan" className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,24rem)]">
      <div className="holo-card space-y-6 rounded-xl p-6 sm:p-9">
        <Bot className="text-proyecto-accent" size={32} aria-hidden="true" />
        <h2 id="nova-ia-plan" className="text-3xl font-black text-white sm:text-4xl">
          Deja que la IA lo haga por ti
        </h2>
        <p className="max-w-xl text-slate-300">
          Nova IA completará las cuatro tareas de cada ciclo activo de lunes a viernes,
          según el horario de Santo Domingo y el corte de cada ciclo.
        </p>
        <dl className="grid gap-4 border-t border-white/10 pt-5 sm:grid-cols-2">
          <div>
            <dt className="flex items-center gap-2 text-sm text-slate-300">
              <Layers size={17} aria-hidden="true" /> Tus ciclos activos
            </dt>
            <dd className="mt-2 text-2xl font-bold text-white">{activeCycles}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-2 text-sm text-slate-300">
              <CalendarDays size={17} aria-hidden="true" /> Días de ejecución
            </dt>
            <dd className="mt-2 text-lg font-bold text-white">Lunes a viernes</dd>
          </div>
        </dl>
      </div>
      <div className="holo-card space-y-4 self-start rounded-xl p-6 sm:p-8">
        <h2 className="flex items-center gap-2 text-lg font-bold text-white">
          <CreditCard className="text-proyecto-accent" size={20} aria-hidden="true" />
          Suscripción mensual
        </h2>
        <p className="text-3xl font-black text-proyecto-accent">50 USDT <span className="text-base">al mes</span></p>
        <p className="text-sm text-slate-300">USDT por BNB Smart Chain (BEP20) mediante NOWPayments.</p>
        <p role="status" className="border-t border-white/10 pt-4 text-sm text-slate-300">
          {subscribed && paidUntil
            ? `Activa hasta el ${new Date(paidUntil).toLocaleDateString('es-DO', { timeZone: 'America/Santo_Domingo' })}`
            : 'Pendiente de activación'}
        </p>
        {payment ? (
          <div className="space-y-3 rounded-xl border border-white/10 p-4 text-sm">
            <p>Envía exactamente <strong>{payment.pay_amount} USDT</strong> por BEP20.</p>
            <p className="break-all font-mono">{payment.pay_address}</p>
            <p>Referencia de pago: {payment.payment_id}</p>
            <p>La vigencia se actualiza cuando NOWPayments confirma el pago completo.</p>
          </div>
        ) : (
          <button type="button" onClick={buy} disabled={busy}
            className="w-full rounded-xl bg-proyecto-accent px-4 py-3 font-bold text-slate-950 disabled:opacity-50">
            {busy ? 'Generando pago…' : subscribed ? 'Renovar un mes' : 'Comprar Nova IA'}
          </button>
        )}
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      </div>
    </section>
  );
}
