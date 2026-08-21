import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, CreditCard, Loader2, RefreshCw, ShieldAlert, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';

type ConnectionStatus = {
  configured: boolean; connected: boolean; mode: 'test' | 'live'; api_status?: string;
  deposits_ready: boolean; payouts_ready: boolean; ipn_ready: boolean;
  missing: string[]; checked_at: string; error?: string;
};

const Gateways: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const checkConnection = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('nowpayments-admin', { body: { action: 'status' } });
    setStatus(error
      ? { configured: false, connected: false, mode: 'test', deposits_ready: false, payouts_ready: false, ipn_ready: false, missing: [], checked_at: new Date().toISOString(), error: error.message }
      : data);
    setLoading(false);
  }, []);

  useEffect(() => { void checkConnection(); }, [checkConnection]);

  const readiness: Array<[string, boolean | undefined, string]> = [
    ['Depósitos', status?.deposits_ready, 'API Key + callback IPN'],
    ['Retiros', status?.payouts_ready, 'API Key + acceso Mass Payouts'],
    ['Confirmaciones', status?.ipn_ready, 'Firma HMAC con IPN Secret'],
  ];

  return <div className="min-h-screen bg-[#0c0c0e] p-5 md:p-8 text-slate-300">
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-4 text-3xl md:text-5xl font-black uppercase italic tracking-tighter text-white">
            <span className="rounded-3xl border border-yellow-500/20 bg-yellow-500/10 p-4"><CreditCard className="text-yellow-400" /></span>NOWPayments
          </h1>
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.25em] text-slate-500">Conexión segura de depósitos y retiros</p>
        </div>
        <button onClick={checkConnection} disabled={loading} className="flex items-center justify-center gap-3 rounded-2xl border border-slate-700 bg-slate-900 px-6 py-4 text-xs font-black uppercase tracking-widest hover:border-yellow-500/50 disabled:opacity-50">
          {loading ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />} Verificar conexión
        </button>
      </header>

      <section className={`rounded-[2rem] border p-7 md:p-10 ${status?.connected ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            {status?.connected ? <CheckCircle2 className="mt-1 text-emerald-400" size={30} /> : <ShieldAlert className="mt-1 text-amber-400" size={30} />}
            <div><h2 className="text-2xl font-black text-white">{loading ? 'Comprobando…' : status?.connected ? 'API conectada' : 'Conexión pendiente'}</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">Las credenciales se guardan únicamente como secretos del servidor. El navegador nunca puede leerlas ni mostrarlas.</p>
              {status?.error && <p className="mt-3 text-sm font-bold text-rose-400">{status.error}</p>}
            </div>
          </div>
          <span className={`w-fit rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest ${status?.mode === 'live' ? 'bg-rose-500/10 text-rose-300' : 'bg-sky-500/10 text-sky-300'}`}>{status?.mode === 'live' ? 'Producción' : 'Sandbox'}</span>
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-3">{readiness.map(([label, ready, detail]) => <article key={label} className="rounded-3xl border border-slate-800 bg-[#111114] p-6">
        <div className="flex items-center justify-between"><Zap className={ready ? 'text-emerald-400' : 'text-slate-600'} /><span className={`rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest ${ready ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-800 text-slate-500'}`}>{ready ? 'Listo' : 'Pendiente'}</span></div>
        <h3 className="mt-6 text-xl font-black text-white">{label}</h3><p className="mt-2 text-xs text-slate-500">{detail}</p>
      </article>)}</div>

      {status?.missing?.length ? <section className="rounded-3xl border border-amber-500/20 bg-amber-500/5 p-6"><h3 className="font-black text-amber-300">Configuración restante</h3><p className="mt-2 text-sm text-slate-400">Faltan secretos del servidor: {status.missing.join(', ')}. Deben cargarse en Supabase Edge Functions; nunca en esta pantalla.</p></section> : null}
      <p className="text-center text-[10px] uppercase tracking-[0.25em] text-slate-700">Última verificación: {status?.checked_at ? new Date(status.checked_at).toLocaleString() : '—'}</p>
    </div>
  </div>;
};

export default Gateways;
