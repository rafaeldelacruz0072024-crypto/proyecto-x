import React, { useEffect, useMemo, useState } from 'react';
import { Activity, CalendarClock, Cpu, History, Loader2, RefreshCw, ShieldCheck, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface InvestmentRow {
  id: string;
  amount: number;
  assigned_roi_percentage: number;
  accumulated_earnings: number;
  business_days_elapsed: number;
  matures_on: string | null;
  last_cycle_activation_on: string | null;
  cycle_reset_count: number;
  status: string;
  plans: { name: string; code: string; duration_business_days: number | null; payout_mode: string } | null;
}

interface TransactionRow {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
}

const RoiEngine: React.FC = () => {
  const [investments, setInvestments] = useState<InvestmentRow[]>([]);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    const [investmentResult, transactionResult] = await Promise.all([
      supabase.from('investments').select('id, amount, assigned_roi_percentage, accumulated_earnings, business_days_elapsed, matures_on, last_cycle_activation_on, cycle_reset_count, status, plans:plan_id(name, code, duration_business_days, payout_mode)').order('created_at', { ascending: false }),
      supabase.from('transactions').select('id, type, amount, description, created_at').in('type', ['DAILY_RETURN', 'MATURITY_PAYOUT', 'ROI_CYCLE_RESET']).order('created_at', { ascending: false }).limit(50),
    ]);
    if (investmentResult.error || transactionResult.error) {
      setError(investmentResult.error?.message || transactionResult.error?.message || 'No se pudo cargar el motor ROI.');
    } else {
      setInvestments((investmentResult.data || []) as unknown as InvestmentRow[]);
      setTransactions((transactionResult.data || []) as TransactionRow[]);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const stats = useMemo(() => {
    const active = investments.filter(item => item.status === 'ACTIVE');
    return {
      capital: active.reduce((sum, item) => sum + Number(item.amount), 0),
      active: active.length,
      dailyLiability: active.reduce((sum, item) => sum + Number(item.amount) * Number(item.assigned_roi_percentage) / 100, 0),
      maturity: active.filter(item => item.plans?.payout_mode === 'maturity').length,
    };
  }, [investments]);

  return (
    <div className="mx-auto max-w-[1600px] space-y-8 p-8">
      <header className="flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="rounded-3xl border border-indigo-500/20 bg-indigo-500/10 p-5"><Cpu className="text-indigo-400" size={42} /></div>
          <div>
            <h1 className="text-5xl font-black tracking-tight text-white">Motor ROI</h1>
            <p className="mt-2 text-xs font-bold uppercase tracking-[0.25em] text-slate-500">Activación diaria · continuidad obligatoria · reinicio automático</p>
          </div>
        </div>
        <button onClick={() => void load()} disabled={loading} className="flex items-center gap-3 rounded-2xl bg-indigo-600 px-7 py-4 text-xs font-black uppercase tracking-widest text-white disabled:opacity-50">
          <RefreshCw className={loading ? 'animate-spin' : ''} size={18} /> Actualizar
        </button>
      </header>

      {error && <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-5 text-rose-300">{error}</div>}

      <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Capital activo', value: `$${stats.capital.toFixed(2)}`, icon: ShieldCheck, color: 'text-indigo-400' },
          { label: 'Contratos activos', value: String(stats.active), icon: Activity, color: 'text-cyan-400' },
          { label: 'ROI diario comprometido', value: `$${stats.dailyLiability.toFixed(2)}`, icon: TrendingUp, color: 'text-emerald-400' },
          { label: 'Pendientes de vencimiento', value: String(stats.maturity), icon: CalendarClock, color: 'text-amber-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-[2rem] border border-white/5 bg-[#121217] p-7 shadow-2xl">
            <Icon className={color} size={24} />
            <p className="mt-5 text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
            <p className={`mt-2 text-4xl font-black ${color}`}>{value}</p>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-white/5 bg-[#121217]">
        <div className="flex items-center gap-3 border-b border-white/5 p-7"><Activity className="text-indigo-400" /><h2 className="text-xl font-black text-white">Contratos</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/20 text-[10px] uppercase tracking-widest text-slate-500"><tr><th className="p-5">Plan</th><th className="p-5">Capital</th><th className="p-5">Tasa</th><th className="p-5">Días</th><th className="p-5">Ganancia</th><th className="p-5">Última activación</th><th className="p-5">Reinicios</th><th className="p-5">Estado</th></tr></thead>
            <tbody className="divide-y divide-white/5">
              {loading ? <tr><td colSpan={8} className="p-16 text-center"><Loader2 className="mx-auto animate-spin text-indigo-400" /></td></tr> : investments.map(item => (
                <tr key={item.id} className="text-slate-300"><td className="p-5 font-bold text-white">{item.plans?.name || 'Plan'}</td><td className="p-5">${Number(item.amount).toFixed(2)}</td><td className="p-5 text-indigo-300">{Number(item.assigned_roi_percentage).toFixed(3)}%</td><td className="p-5">{item.business_days_elapsed}{item.plans?.duration_business_days ? `/${item.plans.duration_business_days}` : ''}</td><td className="p-5 text-emerald-400">${Number(item.accumulated_earnings).toFixed(2)}</td><td className="p-5 text-cyan-300">{item.last_cycle_activation_on || 'Pendiente'}</td><td className="p-5 text-amber-300">{item.cycle_reset_count || 0}</td><td className="p-5">{item.status}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-white/5 bg-[#121217]">
        <div className="flex items-center gap-3 border-b border-white/5 p-7"><History className="text-indigo-400" /><h2 className="text-xl font-black text-white">Últimas liquidaciones</h2></div>
        <div className="divide-y divide-white/5">
          {transactions.length === 0 ? <p className="p-12 text-center text-slate-600">Sin liquidaciones todavía.</p> : transactions.map(item => (
            <div key={item.id} className="grid gap-2 p-5 text-sm sm:grid-cols-4"><span className="font-bold text-white">{item.type}</span><span className="text-emerald-400">+${Number(item.amount).toFixed(2)}</span><span className="text-slate-500">{item.description}</span><span className="text-right text-slate-600">{new Date(item.created_at).toLocaleString()}</span></div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default RoiEngine;
