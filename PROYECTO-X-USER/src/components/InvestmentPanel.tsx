import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Investment, Plan } from '../types';

interface Props {
  onInvest: (amount: number, planId?: string) => void;
  investments: Investment[];
  addNotification: (message: string, type?: 'success' | 'error' | 'info') => void;
  walletBalance: number;
  isLoading?: boolean;
  dynamicSettings?: unknown;
}

const planAccent: Record<string, string> = {
  DAILY: 'from-cyan-500 to-blue-600',
  D10: 'from-blue-500 to-indigo-600',
  D15: 'from-indigo-500 to-violet-600',
  D30: 'from-violet-500 to-fuchsia-600',
};

const InvestmentPanel: React.FC<Props> = ({
  onInvest,
  investments,
  addNotification,
  walletBalance,
  isLoading = false,
}) => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let mounted = true;
    supabase
      .from('plans')
      .select('*')
      .eq('status', 'active')
      .order('display_order')
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) setLoadError('No se pudieron cargar los planes.');
        else setPlans((data || []) as Plan[]);
      });
    return () => { mounted = false; };
  }, []);

  const activeInvestments = useMemo(
    () => investments.filter(investment => investment.status === 'ACTIVE'),
    [investments],
  );

  const activate = (plan: Plan) => {
    const amount = Number(amounts[plan.id] || 0);
    if (!Number.isFinite(amount) || amount < plan.min_amount) {
      addNotification(`El monto mínimo es $${plan.min_amount.toFixed(2)}.`, 'error');
      return;
    }
    if (plan.max_amount != null && amount > plan.max_amount) {
      addNotification(`El monto máximo es $${plan.max_amount.toFixed(2)}.`, 'error');
      return;
    }
    if (amount > walletBalance) {
      addNotification('No tienes saldo suficiente en Wallet Bank para activar este nodo.', 'error');
      return;
    }
    onInvest(amount, plan.id);
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-0 animate-fade-in sm:space-y-8">
      <section className="rounded-2xl border border-white/10 bg-[#080c17]/90 p-4 shadow-2xl sm:p-6">
        <div className="mb-5 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-mono-tech tracking-[0.3em] text-blue-400">Nova Digital</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">Mis nodos</h2>
          </div>
          <div className="flex w-full items-center justify-between rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3 text-left sm:block sm:w-auto sm:px-4 sm:py-2 sm:text-right">
            <p className="text-[9px] uppercase tracking-widest text-slate-500">Wallet Bank</p>
            <p className="font-mono text-lg font-black text-emerald-400">${walletBalance.toFixed(2)}</p>
          </div>
        </div>

        {loadError && <p className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">{loadError}</p>}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 sm:gap-5">
          {plans.map(plan => {
            const amount = Number(amounts[plan.id] || 0);
            const minDaily = amount * plan.roi_min_percentage / 100;
            const maxDaily = amount * plan.roi_max_percentage / 100;
            const isMaturity = plan.payout_mode === 'maturity';
            return (
              <article key={plan.id} className="flex min-h-[390px] flex-col rounded-2xl border border-slate-700/70 bg-[#0b101d] p-4 shadow-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-400/40 hover:shadow-blue-950/30 sm:min-h-[430px] sm:p-6">
                <div className="mb-5 flex items-start justify-between gap-2 sm:mb-6 sm:gap-3">
                  <h3 className="text-lg font-black leading-tight text-white sm:text-xl">{plan.name}</h3>
                  <span className="max-w-[48%] rounded-lg border border-blue-400/10 bg-blue-500/10 px-2 py-1 text-right text-[10px] font-bold leading-tight text-blue-300 sm:max-w-none sm:px-3 sm:text-[11px]">
                    {plan.duration_business_days ? `${plan.duration_business_days} días hábiles` : 'Sin plazo'}
                  </span>
                </div>

                <div className={`bg-gradient-to-r ${planAccent[plan.code] || planAccent.DAILY} bg-clip-text text-4xl font-black leading-none text-transparent sm:text-5xl`}>
                  {plan.roi_min_percentage}% - {plan.roi_max_percentage}%
                </div>
                <p className="mt-2 text-xs text-slate-400 sm:text-sm">diario · lunes a viernes</p>
                <p className="mt-4 min-h-0 text-xs leading-relaxed text-slate-300 sm:mt-5 sm:min-h-[66px] sm:text-sm">{plan.description}</p>

                <div className={`mt-4 text-xs font-bold sm:text-sm ${isMaturity ? 'text-blue-300' : 'text-emerald-400'}`}>
                  {isMaturity ? 'Pago al vencimiento' : 'Pago diario'}
                </div>

                <div className="mt-auto pt-5 sm:pt-6">
                  <label className="mb-2 block text-xs font-medium text-slate-300 sm:text-sm">Monto (mín. ${plan.min_amount.toFixed(0)})</label>
                  <input
                    type="number"
                    min={plan.min_amount}
                    max={plan.max_amount ?? undefined}
                    step="0.01"
                    value={amounts[plan.id] || ''}
                    onChange={event => setAmounts(current => ({ ...current, [plan.id]: event.target.value }))}
                    placeholder={plan.min_amount.toFixed(0)}
                    className="w-full rounded-xl border border-slate-700 bg-[#050812] px-3 py-3.5 text-base font-bold text-white outline-none transition focus:border-blue-500 sm:px-4 sm:py-4 sm:text-lg"
                  />
                  {amount > 0 && (
                    <p className="mt-2 text-xs text-slate-500">
                      Rendimiento diario asignable: ${minDaily.toFixed(2)}–${maxDaily.toFixed(2)}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => activate(plan)}
                    disabled={isLoading || amount <= 0 || amount > walletBalance}
                    className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3.5 text-sm font-black text-white transition hover:bg-blue-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 sm:mt-5 sm:py-4 sm:text-base"
                  >
                    {isLoading ? 'Procesando…' : 'Activar contrato'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {activeInvestments.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-[#080c17]/90 p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-lg font-black text-white">Contratos activos</h3>
            <span className="text-sm font-bold text-blue-300">{activeInvestments.length}</span>
          </div>
          <div className="space-y-3">
            {activeInvestments.map(investment => (
              <div key={investment.id} className="grid gap-3 rounded-xl border border-white/5 bg-black/20 p-4 text-sm sm:grid-cols-3 xl:grid-cols-6">
                <div><p className="text-slate-500">Capital</p><p className="font-bold text-white">${Number(investment.amount).toFixed(2)}</p></div>
                <div><p className="text-slate-500">Tasa asignada</p><p className="font-bold text-blue-300">{Number(investment.assigned_roi_percentage).toFixed(3)}%</p></div>
                <div><p className="text-slate-500">Ganancia acumulada</p><p className="font-bold text-emerald-400">${Number(investment.accumulated_earnings).toFixed(2)}</p></div>
                <div><p className="text-slate-500">Días procesados</p><p className="font-bold text-white">{investment.business_days_elapsed}</p></div>
                <div><p className="text-slate-500">Última activación</p><p className="font-bold text-cyan-300">{investment.last_cycle_activation_on || 'Pendiente'}</p></div>
                <div><p className="text-slate-500">Vencimiento</p><p className="font-bold text-white">{investment.matures_on || 'Sin plazo'}</p></div>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="text-xs text-slate-600">Wallet Bank: ${walletBalance.toFixed(2)} · Las tasas se asignan al activar y no cambian durante el contrato.</p>
    </div>
  );
};

export default InvestmentPanel;
