import { useEffect, useState } from 'react';
import { CreditCard, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

type GatewayStatus = 'loading' | 'available' | 'disabled' | 'error';

export default function Gateways() {
  const [status, setStatus] = useState<GatewayStatus>('loading');

  async function refresh() {
    setStatus('loading');
    try {
      const { data, error } = await supabase.functions.invoke('nowpayments-proxy', { method: 'GET' });
      if (error || typeof data?.available !== 'boolean') {
        setStatus('error');
        return;
      }
      setStatus(data.available ? 'available' : 'disabled');
    } catch {
      setStatus('error');
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const statusText = {
    loading: 'Consultando estado…',
    available: 'Habilitado para depósitos',
    disabled: 'Deshabilitado',
    error: 'No se pudo consultar el estado',
  }[status];

  return (
    <div className="min-h-screen space-y-8 bg-[#0c0c0e] p-6 text-slate-300 md:p-8">
      <h1 className="flex items-center gap-4 text-3xl font-black uppercase text-white">
        <CreditCard className="shrink-0 text-yellow-500" size={32} />
        Pasarelas de pago
      </h1>
      <section className="rounded-3xl border border-slate-800 bg-[#111114] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">NOWPayments</h2>
            <p className="mt-1 text-sm">Depósitos en USDT por BNB Smart Chain (BEP20)</p>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={status === 'loading'}
            className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60"
          >
            <RefreshCw size={16} />
            Actualizar estado
          </button>
        </div>
        <p role="status" className={`mt-4 font-semibold ${status === 'available' ? 'text-emerald-400' : 'text-slate-300'}`}>
          {statusText}
        </p>
        <p className="mt-3 text-sm text-slate-400">
          Las credenciales y el modo de operación se gestionan en los secretos de Edge Functions de Supabase.
        </p>
      </section>
    </div>
  );
}
