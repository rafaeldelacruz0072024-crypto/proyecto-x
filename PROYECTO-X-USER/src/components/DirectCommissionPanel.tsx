import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';

interface Props {
  profile: Profile;
  walletBalance: number;
  referralCommissionBalance: number;
  handleWithdrawal: (amount: number, method: string, address: string) => void;
}

interface CommissionStats {
  totalLifetime: number;
  thisWeek: number;
  todayEarned: number;
  directCount: number;
}

const EMPTY_STATS: CommissionStats = { totalLifetime: 0, thisWeek: 0, todayEarned: 0, directCount: 0 };

export default function DirectCommissionPanel({ profile, walletBalance: _walletBalance, referralCommissionBalance, handleWithdrawal }: Props) {
  const [stats, setStats] = useState<CommissionStats>(EMPTY_STATS);
  const [loading, setLoading]   = useState(true);
  const [amount, setAmount]     = useState('');
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess]   = useState(false);
  const [errMsg, setErrMsg]     = useState('');

  const withdrawalAddress =
    profile.withdrawal_wallet || profile.wallet_address || '';

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      // Level-1 commissions are tagged with "level 1" or "nivel 1" in description
      const { data } = await supabase
        .from('transactions')
        .select('amount, created_at, description')
        .eq('user_id', profile.id)
        .eq('type', 'REFERRAL_COMMISSION')
        .in('status', ['COMPLETED', 'CONFIRMED', 'APPROVED']);

      const rows = data || [];

      // Filter only level 1 (direct)
      const direct = rows.filter(r =>
        r.description?.toLowerCase().includes('level 1') ||
        r.description?.toLowerCase().includes('nivel 1')
      );

      // Fallback: if no level-tagged records exist, treat all REFERRAL_COMMISSION as direct
      const source = direct.length > 0 ? direct : rows;

      const now     = new Date();
      const today   = now.toLocaleDateString();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const totalLifetime = source.reduce((s, r) => s + Number(r.amount), 0);
      const thisWeek = source
        .filter(r => new Date(r.created_at) >= weekAgo)
        .reduce((s, r) => s + Number(r.amount), 0);
      const todayEarned = source
        .filter(r => new Date(r.created_at).toLocaleDateString() === today)
        .reduce((s, r) => s + Number(r.amount), 0);

      // Count direct referrals
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('referred_by', profile.id);

      setStats({ totalLifetime, thisWeek, todayEarned, directCount: count ?? 0 });
    } catch {
      // Silent — keep defaults
    } finally {
      setLoading(false);
    }
  }, [profile.id, profile.ref_code]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const maxWithdrawable = referralCommissionBalance;

  const handleSubmit = async () => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) { setErrMsg('Ingresa un monto válido.'); return; }
    if (num > referralCommissionBalance) { setErrMsg(`Saldo de comisión directa insuficiente. Disponible: $${referralCommissionBalance.toFixed(2)}`); return; }
    if (!withdrawalAddress)     { setErrMsg('No tienes billetera configurada. Ve a Perfil → Configurar billetera.'); return; }

    setErrMsg('');
    setProcessing(true);

    try {
      // La comisión directa usa su propio RPC sin ventana horaria.
      handleWithdrawal(num, 'Comisión Directa', withdrawalAddress);
      setAmount('');
      setSuccess(true);
      setTimeout(() => { setSuccess(false); fetchStats(); }, 4000);
    } catch (e: any) {
      setErrMsg(e.message || 'Error al procesar el retiro.');
    } finally {
      setProcessing(false);
    }
  };

  const fmtUSD = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="rounded-none clip-corner p-6 bg-black/40 backdrop-blur-md relative overflow-hidden border border-cyan-500/40 shadow-[0_0_24px_rgba(34,211,238,0.15),inset_0_0_24px_rgba(34,211,238,0.04)] animate-pulse-border">
      {/* Animated corner accent */}
      <div className="absolute -right-4 -top-4 w-32 h-32 rounded-full blur-3xl opacity-20 bg-cyan-400 animate-pulse" />
      <div className="absolute -left-4 -bottom-4 w-24 h-24 rounded-full blur-3xl opacity-10 bg-cyan-400" />

      {/* NEW badge — top-left ribbon */}
      <div className="absolute top-0 left-0 z-20">
        <div className="bg-gradient-to-r from-cyan-500 to-cyan-400 text-slate-950 text-[8px] font-black uppercase tracking-[0.25em] px-3 py-1 clip-corner-sm shadow-[0_0_12px_rgba(34,211,238,0.6)]">
          ✦ NUEVO
        </div>
      </div>

      {/* Header */}
      <div className="flex justify-between items-start mb-6 relative z-10 mt-5">
        <div>
          <h3 className="text-lg font-orbitron font-black text-white uppercase tracking-[0.2em]">
            Comisiones Directas
          </h3>
          <p className="text-[9px] text-slate-500 font-mono-tech uppercase tracking-widest mt-0.5">
            10% · Nivel 1 · Retiro Diario
          </p>
        </div>

        {/* OPEN 24/7 badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border bg-cyan-400/10 border-cyan-400/30 shadow-[0_0_10px_rgba(34,211,238,0.2)]">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
          <span className="text-[9px] font-black uppercase tracking-widest text-cyan-400">Abierto 7 días</span>
        </div>
      </div>

      {/* "Disponible cualquier día" banner */}
      <div className="mb-5 border border-cyan-500/20 bg-cyan-500/5 clip-corner p-3 flex items-center gap-3 relative z-10">
        <div className="w-8 h-8 clip-corner-sm bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center shrink-0">
          {/* Calendar-check icon */}
          <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </div>
        <div>
          <p className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.15em]">Sin restricción de día</p>
          <p className="text-[9px] text-slate-500 font-mono-tech">
            Puedes retirar el 10% de tus comisiones de invitados directos cualquier día de la semana.
          </p>
        </div>
      </div>

      {/* Stats row */}
      {loading ? (
        <div className="flex items-center gap-2 py-4 relative z-10">
          <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-[10px] text-slate-500 font-mono-tech uppercase">Cargando estadísticas...</span>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 mb-5 relative z-10">
          {[
            { label: 'Total histórico', value: fmtUSD(stats.totalLifetime), color: 'text-white' },
            { label: 'Esta semana',     value: fmtUSD(stats.thisWeek),      color: 'text-cyan-300' },
            { label: 'Hoy ganado',      value: fmtUSD(stats.todayEarned),   color: 'text-emerald-400' },
          ].map(s => (
            <div key={s.label} className="bg-black/30 border border-slate-800/60 rounded p-2 text-center">
              <p className="text-[8px] text-slate-600 font-mono-tech uppercase tracking-wider mb-1">{s.label}</p>
              <p className={`text-xs font-orbitron font-black ${s.color}`}>${s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Directs count */}
      <div className="flex items-center gap-2 mb-5 relative z-10">
        <div className="w-1 h-6 bg-cyan-400/60 rounded" />
        <p className="text-[10px] text-slate-400 font-mono-tech">
          <span className="text-cyan-400 font-black">{stats.directCount}</span> invitados directos activos
          <span className="ml-2 text-slate-600">· Saldo disponible: <span className="text-white font-black">${fmtUSD(referralCommissionBalance)}</span></span>
        </p>
      </div>

      {/* Success message */}
      {success && (
        <div className="mb-4 p-3 border border-emerald-500/30 bg-emerald-500/5 clip-corner flex items-center gap-2 relative z-10">
          <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-[10px] text-emerald-400 font-black uppercase tracking-widest">
            Solicitud enviada. Tu retiro está siendo procesado.
          </p>
        </div>
      )}

      {/* Error */}
      {errMsg && (
        <div className="mb-4 p-3 border border-rose-500/30 bg-rose-500/5 clip-corner relative z-10">
          <p className="text-[10px] text-rose-400 font-mono-tech">{errMsg}</p>
        </div>
      )}

      {/* Withdrawal input */}
      <div className="space-y-3 relative z-10">
        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">
          Monto a retirar (USD)
        </label>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400 font-black text-sm">$</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={e => { setAmount(e.target.value); setErrMsg(''); }}
              placeholder="0.00"
              className="w-full bg-black/60 border border-slate-700 clip-corner-sm pl-7 pr-3 py-3 text-white font-orbitron font-black text-sm focus:outline-none focus:border-cyan-500/50 placeholder-slate-700"
            />
          </div>
          <button
            onClick={() => setAmount(maxWithdrawable.toFixed(2))}
            className="px-3 py-2 bg-slate-900 border border-slate-700 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/30 text-[9px] font-black uppercase tracking-widest transition-all clip-corner-sm"
          >
            MAX
          </button>
        </div>

        {/* Withdrawal address preview */}
        {withdrawalAddress ? (
          <p className="text-[9px] text-slate-600 font-mono-tech truncate">
            → {withdrawalAddress}
          </p>
        ) : (
          <p className="text-[9px] text-rose-400 font-mono-tech">
            ⚠ Configura tu billetera de retiro en Perfil antes de retirar.
          </p>
        )}

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={processing || !amount || parseFloat(amount) <= 0 || !withdrawalAddress}
          className={`w-full py-4 clip-corner-sm font-orbitron font-black text-[10px] uppercase tracking-[0.3em] transition-all transform active:scale-95 flex items-center justify-center gap-3 ${
            !processing && amount && parseFloat(amount) > 0 && withdrawalAddress
              ? 'bg-cyan-500 text-slate-950 shadow-[0_0_20px_rgba(34,211,238,0.4)] hover:shadow-[0_0_30px_rgba(34,211,238,0.6)] hover:bg-cyan-400'
              : 'bg-slate-900/50 text-white/10 cursor-not-allowed border border-slate-800/50'
          }`}
        >
          {processing ? (
            <>
              <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              Procesando...
            </>
          ) : (
            <>
              {/* Wallet icon */}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Retirar Comisión Directa
            </>
          )}
        </button>
      </div>

      {/* Footer note */}
      <div className="mt-5 pt-4 border-t border-slate-800/30 flex justify-between items-center relative z-10">
        <span className="text-[8px] font-mono-tech text-slate-600 uppercase tracking-widest">
          Ventana de Retiro
        </span>
        <span className="text-[9px] font-mono-tech text-cyan-400 font-bold uppercase tracking-widest">
          Lunes a Domingo · Sin Restricción
        </span>
      </div>
    </div>
  );
}
