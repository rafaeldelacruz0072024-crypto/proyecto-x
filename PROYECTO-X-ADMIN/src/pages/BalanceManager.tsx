import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  Search, User, Wallet, RotateCcw, MinusCircle, CheckCircle2,
  AlertTriangle, Loader2, ChevronRight, Package, RefreshCw,
  TrendingDown, ShieldAlert, X, History, Eye
} from 'lucide-react';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  username: string | null;
  wallet_balance: number;
  rank: string;
  user_tag?: string;
}

interface Investment {
  id: string;
  user_id: string;
  plan_id: string | null;
  amount: number;
  accumulated_earnings: number;
  status: string;
  is_referral_commission_paid: boolean;
  created_at: string;
  completed_at: string | null;
  plan_name?: string;
}

interface OpLog {
  ts: string;
  type: 'reset_package' | 'reset_all' | 'subtract_wallet';
  detail: string;
}

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  const s = status.toUpperCase();
  const cls =
    s === 'ACTIVE'    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' :
    s === 'COMPLETED' ? 'bg-blue-500/15 text-blue-400 border-blue-500/25' :
                        'bg-slate-700/50 text-slate-400 border-slate-700';
  return <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${cls}`}>{s}</span>;
};

const BalanceManager: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loadingInv, setLoadingInv] = useState(false);

  // Subtract state
  const [subWallet, setSubWallet] = useState('');

  // Reset per-package
  const [resetPkgTarget, setResetPkgTarget] = useState<Investment | null>(null);
  const [confirmAllReset, setConfirmAllReset] = useState(false);
  const [confirmSubtract, setConfirmSubtract] = useState(false);

  const [processing, setProcessing] = useState(false);
  const [logs, setLogs] = useState<OpLog[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Derived
  const subWalletNum  = parseFloat(subWallet)  || 0;
  const newWallet     = Math.max((selected?.wallet_balance ?? 0) - subWalletNum, 0);
  const canSubtract   = subWalletNum > 0;
  const subWalletOver = subWalletNum > (selected?.wallet_balance ?? 0);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const addLog = (type: OpLog['type'], detail: string) => {
    setLogs(prev => [{ ts: new Date().toLocaleTimeString(), type, detail }, ...prev.slice(0, 19)]);
  };

  // Search users
  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from('profiles')
        .select('id, email, full_name, username, wallet_balance, rank, user_tag')
        .or(`email.ilike.%${query}%,full_name.ilike.%${query}%,username.ilike.%${query}%`)
        .limit(8);
      setResults(data ?? []);
      setSearching(false);
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  const selectUser = async (p: Profile) => {
    setSelected(p);
    setResults([]);
    setQuery('');
    setSubWallet('');
    setConfirmAllReset(false);
    setConfirmSubtract(false);
    setResetPkgTarget(null);
    loadInvestments(p.id);
  };

  const loadInvestments = async (uid: string) => {
    setLoadingInv(true);
    const { data: invData } = await supabase
      .from('investments')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });

    const rows: Investment[] = invData ?? [];

    // enrich with plan names
    const planIds = [...new Set(rows.map(r => r.plan_id).filter(Boolean))];
    if (planIds.length > 0) {
      const { data: plans } = await supabase.from('plans').select('id, name').in('id', planIds);
      const map: Record<string, string> = {};
      (plans ?? []).forEach((p: any) => { map[p.id] = p.name; });
      rows.forEach(r => { if (r.plan_id) r.plan_name = map[r.plan_id] ?? '—'; });
    }

    setInvestments(rows);
    setLoadingInv(false);
  };

  const refreshUser = async () => {
    if (!selected) return;
    const { data } = await supabase.from('profiles').select('*').eq('id', selected.id).single();
    if (data) setSelected(data as Profile);
    loadInvestments(selected.id);
  };

  // ── RESET SINGLE PACKAGE ─────────────────────────────────────────────────
  const resetPackage = async (inv: Investment) => {
    setProcessing(true);
    const { error } = await supabase
      .from('investments')
      .update({
        accumulated_earnings: 0,
        status: 'ACTIVE',
        completed_at: null,
        is_referral_commission_paid: false,
        created_at: new Date().toISOString(),
      })
      .eq('id', inv.id);

    if (error) {
      showToast('Error al resetear paquete: ' + error.message, 'error');
    } else {
      addLog('reset_package', `Paquete $${fmt(inv.amount)} (${inv.id.slice(0, 8)}) reseteado`);
      showToast('Paquete reseteado correctamente', 'success');
      await refreshUser();
    }
    setResetPkgTarget(null);
    setProcessing(false);
  };

  // ── RESET ALL PACKAGES ───────────────────────────────────────────────────
  const resetAllPackages = async () => {
    if (!selected) return;
    setProcessing(true);
    const ids = investments.map(i => i.id);
    const { error } = await supabase
      .from('investments')
      .update({
        accumulated_earnings: 0,
        status: 'ACTIVE',
        completed_at: null,
        is_referral_commission_paid: false,
        created_at: new Date().toISOString(),
      })
      .in('id', ids);

    if (error) {
      showToast('Error al resetear paquetes: ' + error.message, 'error');
    } else {
      addLog('reset_all', `${ids.length} paquete(s) reseteados para ${selected.full_name || selected.email}`);
      showToast(`${ids.length} paquetes reseteados`, 'success');
      await refreshUser();
    }
    setConfirmAllReset(false);
    setProcessing(false);
  };

  // ── SUBTRACT BALANCES ────────────────────────────────────────────────────
  const applySubtract = async () => {
    if (!selected) return;
    setProcessing(true);
    try {
      const adminId = (await supabase.auth.getUser()).data.user?.id;
      if (!adminId) throw new Error('SesiÃ³n administrativa no disponible.');
      if (subWalletNum <= 0) throw new Error('Indica un monto mayor que cero.');
      const { data, error } = await supabase.rpc('admin_adjust_balance', {
        p_user_id: selected.id,
        p_balance_column: 'wallet_balance',
        p_amount: -subWalletNum,
        p_description: `Ajuste desde Balance Manager: Wallet Bank -${fmt(subWalletNum)}`,
        p_reference_id: `balance_manager_${selected.id}_${Date.now()}`,
      });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || data.message || 'El RPC rechazó el ajuste.');

      addLog('subtract_wallet', `Wallet Bank -${fmt(subWalletNum)} → ${selected.full_name || selected.email}`);
      showToast('Wallet Bank ajustada correctamente mediante RPC atómico', 'success');
      setSubWallet('');
      await refreshUser();
    } catch (error: any) {
      showToast('Error al ajustar balances: ' + (error?.message || error), 'error');
    }
    setConfirmSubtract(false);
    setProcessing(false);
  };

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-8 animate-in fade-in duration-500">

      {/* ═══ TOAST ═══ */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border text-sm font-bold animate-in slide-in-from-top-4 ${
          toast.type === 'success' ? 'bg-emerald-900/90 border-emerald-500/40 text-emerald-300' : 'bg-red-900/90 border-red-500/40 text-red-300'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* ═══ HEADER ═══ */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight flex items-center gap-4">
            <div className="p-3 bg-rose-500/10 rounded-2xl border border-rose-500/20">
              <TrendingDown className="text-rose-400" size={32} />
            </div>
            Balance Manager
          </h1>
          <p className="text-slate-500 font-medium mt-2">Resetea paquetes de inversión y ajusta balances de forma controlada.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-rose-500/8 border border-rose-500/20 rounded-2xl">
          <ShieldAlert size={14} className="text-rose-400" />
          <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Operaciones Irreversibles</span>
        </div>
      </div>

      {/* ═══ USER SEARCH ═══ */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-4">
        <h3 className="text-sm font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
          <User size={14} className="text-indigo-400" /> Seleccionar Usuario
        </h3>
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por email, nombre o username..."
            className="w-full bg-black/40 border border-slate-800 focus:border-indigo-500/50 rounded-2xl py-4 pl-11 pr-5 text-white font-medium text-sm outline-none transition-all"
          />
          {searching && <Loader2 size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 animate-spin" />}
        </div>

        {/* Dropdown results */}
        {results.length > 0 && (
          <div className="border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800/60 shadow-2xl">
            {results.map(p => (
              <button
                key={p.id}
                onClick={() => selectUser(p)}
                className="w-full flex items-center gap-4 px-5 py-4 bg-slate-950 hover:bg-slate-900 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-sm font-black text-indigo-400 flex-shrink-0">
                  {(p.full_name || p.email || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{p.full_name || p.username || '—'}</p>
                  <p className="text-[10px] text-slate-500 truncate">{p.email}</p>
                </div>
                <div className="text-right flex-shrink-0 space-y-0.5">
                  <p className="text-xs font-black text-emerald-400">${fmt(p.wallet_balance)}</p>
                  <p className="text-[9px] text-slate-600">wallet</p>
                </div>
                <ChevronRight size={14} className="text-slate-600 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}

        {/* Selected user pill */}
        {selected && (
          <div className="flex items-center gap-4 p-4 bg-indigo-500/8 border border-indigo-500/20 rounded-2xl">
            <div className="w-10 h-10 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-base font-black text-indigo-400 flex-shrink-0">
              {(selected.full_name || selected.email)[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-white text-sm">{selected.full_name || selected.username || '—'}</p>
              <p className="text-[10px] text-slate-500">{selected.email} · {selected.rank}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-xs font-black text-emerald-400">${fmt(selected.wallet_balance)}</p>
                <p className="text-[8px] text-slate-600 uppercase">Wallet</p>
              </div>
              <button onClick={refreshUser} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors">
                <RefreshCw size={14} className="text-slate-400" />
              </button>
              <button onClick={() => setSelected(null)} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors">
                <X size={14} className="text-slate-400" />
              </button>
            </div>
          </div>
        )}
      </div>

      {selected && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

          {/* ═══ LEFT: PACKAGES ═══ */}
          <div className="xl:col-span-2 space-y-5">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
              <div className="px-8 py-5 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
                  <Package size={14} className="text-amber-400" />
                  Paquetes de Inversión
                  <span className="px-2 py-0.5 bg-slate-800 rounded-lg text-[9px] font-black text-slate-500">
                    {investments.length}
                  </span>
                </h3>
                {investments.length > 0 && (
                  <button
                    onClick={() => setConfirmAllReset(true)}
                    disabled={processing}
                    className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 rounded-xl text-[10px] font-black text-rose-400 uppercase tracking-widest transition-all disabled:opacity-40"
                  >
                    <RotateCcw size={12} />
                    Reset Todos
                  </button>
                )}
              </div>

              {loadingInv ? (
                <div className="flex justify-center items-center h-32">
                  <Loader2 size={24} className="text-slate-600 animate-spin" />
                </div>
              ) : investments.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-slate-600 gap-2">
                  <Package size={24} />
                  <p className="text-sm font-bold">Sin paquetes registrados</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-800/50">
                  {investments.map(inv => (
                    <div key={inv.id} className="px-8 py-5 flex items-center gap-5 hover:bg-slate-800/20 transition-colors group">
                      {/* Amount badge */}
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/15 to-amber-600/5 border border-amber-500/20 flex flex-col items-center justify-center flex-shrink-0">
                        <span className="text-[8px] font-black text-amber-500/70 uppercase">$</span>
                        <span className="text-sm font-black text-amber-400 leading-none">{inv.amount >= 1000 ? (inv.amount/1000).toFixed(1)+'K' : inv.amount}</span>
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-black text-white">${fmt(inv.amount)}</span>
                          <StatusPill status={inv.status} />
                          {inv.plan_name && <span className="text-[9px] text-slate-600 font-bold">{inv.plan_name}</span>}
                        </div>
                        <div className="flex items-center gap-4 text-[10px] font-bold">
                          <span className="text-slate-500">Ganancias acum.: <span className="text-emerald-400">${fmt(inv.accumulated_earnings)}</span></span>
                          <span className="text-slate-700">·</span>
                          <span className="text-slate-500">Creado: {new Date(inv.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {/* Action */}
                      <button
                        onClick={() => setResetPkgTarget(inv)}
                        disabled={processing}
                        className="opacity-0 group-hover:opacity-100 flex items-center gap-2 px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 rounded-xl text-[10px] font-black text-amber-400 uppercase tracking-wider transition-all disabled:opacity-40"
                      >
                        <RotateCcw size={11} />
                        Reset
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ═══ RIGHT: SUBTRACT + LOGS ═══ */}
          <div className="space-y-5">

            {/* Balance Subtraction */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5">
              <h3 className="text-sm font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
                <MinusCircle size={14} className="text-rose-400" />
                Sustraer Balance
              </h3>

              {/* Wallet */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Wallet Balance</label>
                  <span className="text-[10px] font-black text-emerald-400">Actual: ${fmt(selected.wallet_balance)}</span>
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">-$</span>
                  <input
                    type="number"
                    value={subWallet}
                    min="0"
                    step="0.01"
                    onChange={e => setSubWallet(e.target.value)}
                    placeholder="0.00"
                    className={`w-full bg-black/40 border-2 rounded-2xl py-4 pl-10 pr-4 text-white font-black text-lg outline-none transition-all ${
                      subWalletOver ? 'border-red-500/60 text-red-400' : 'border-slate-800 focus:border-rose-500/50'
                    }`}
                  />
                </div>
                {subWalletNum > 0 && (
                  <p className={`text-[9px] font-bold px-1 ${subWalletOver ? 'text-red-400' : 'text-slate-500'}`}>
                    {subWalletOver ? '⚠ Excede el saldo disponible' : `Nuevo saldo: $${fmt(newWallet)}`}
                  </p>
                )}
              </div>

              {/* Preview */}
              {canSubtract && (
                <div className="rounded-2xl bg-black/30 border border-slate-800/60 p-4 space-y-2">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">Vista Previa del Ajuste</p>
                  {subWalletNum > 0 && (
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Wallet</span>
                      <span className="font-black">
                        <span className="text-slate-500">${fmt(selected.wallet_balance)}</span>
                        <span className="text-rose-500 mx-1">→</span>
                        <span className={subWalletOver ? 'text-red-400' : 'text-emerald-400'}>${fmt(newWallet)}</span>
                      </span>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={() => setConfirmSubtract(true)}
                disabled={!canSubtract || processing || subWalletOver}
                className="w-full py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all flex items-center justify-center gap-2
                  disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed
                  enabled:bg-rose-500/15 enabled:hover:bg-rose-500/25 enabled:border enabled:border-rose-500/30 enabled:text-rose-400"
              >
                <MinusCircle size={14} />
                Aplicar Sustracción
              </button>
            </div>

            {/* Operation Log */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
              <h3 className="text-sm font-black text-slate-300 uppercase tracking-widest flex items-center gap-2 mb-4">
                <History size={14} className="text-slate-500" />
                Log de Operaciones
              </h3>
              {logs.length === 0 ? (
                <p className="text-[11px] text-slate-600 font-bold text-center py-4">Sin operaciones en esta sesión</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {logs.map((l, i) => (
                    <div key={i} className="flex items-start gap-3 text-[10px]">
                      <span className="text-slate-700 font-mono flex-shrink-0 mt-0.5">{l.ts}</span>
                      <div className="flex-1">
                        <span className={`font-black uppercase tracking-wide ${
                          l.type === 'reset_package' || l.type === 'reset_all' ? 'text-amber-400' : 'text-rose-400'
                        }`}>
                          {l.type === 'reset_package' ? 'RESET PKG' : l.type === 'reset_all' ? 'RESET ALL' :
                           l.type === 'subtract_wallet' ? 'SUSTRACCIÓN' : 'SUSTRACCIÓN'}
                        </span>
                        <p className="text-slate-500 font-bold mt-0.5 leading-relaxed">{l.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: Reset single package ═══ */}
      {resetPkgTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#0d1117] border border-amber-500/25 rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20">
                <RotateCcw className="text-amber-400" size={22} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Reset Paquete</h3>
                <p className="text-[11px] text-slate-500 font-bold">Esta acción es irreversible</p>
              </div>
            </div>

            <div className="bg-black/30 border border-slate-800 rounded-2xl p-4 space-y-2 mb-6 text-[11px] font-bold">
              <div className="flex justify-between"><span className="text-slate-500">Monto</span><span className="text-amber-400">${fmt(resetPkgTarget.amount)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Ganancias Acumuladas</span><span className="text-emerald-400">${fmt(resetPkgTarget.accumulated_earnings)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Estado actual</span><StatusPill status={resetPkgTarget.status} /></div>
              <div className="h-px bg-slate-800 my-1" />
              <div className="flex justify-between"><span className="text-slate-500">Nuevo estado</span><span className="text-white">ACTIVE · Ganancias → $0.00</span></div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setResetPkgTarget(null)} className="flex-1 py-3 rounded-2xl border border-slate-800 text-slate-400 font-black text-[11px] uppercase tracking-widest hover:bg-slate-800 transition-all">
                Cancelar
              </button>
              <button
                onClick={() => resetPackage(resetPkgTarget)}
                disabled={processing}
                className="flex-1 py-3 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-400 font-black text-[11px] uppercase tracking-widest transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {processing ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                Confirmar Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: Reset ALL packages ═══ */}
      {confirmAllReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#0d1117] border border-rose-500/25 rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-rose-500/10 rounded-2xl border border-rose-500/20">
                <AlertTriangle className="text-rose-400" size={22} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Reset TODOS los Paquetes</h3>
                <p className="text-[11px] text-slate-500 font-bold">{investments.length} paquetes de {selected?.full_name || selected?.email}</p>
              </div>
            </div>

            <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-4 mb-6 text-[11px] font-bold text-rose-400">
              ⚠ Se resetearán las ganancias acumuladas de todos los paquetes a $0.00 y el estado a ACTIVE. Esta acción no se puede deshacer.
            </div>

            <div className="flex gap-3">
              <button onClick={() => setConfirmAllReset(false)} className="flex-1 py-3 rounded-2xl border border-slate-800 text-slate-400 font-black text-[11px] uppercase tracking-widest hover:bg-slate-800 transition-all">
                Cancelar
              </button>
              <button
                onClick={resetAllPackages}
                disabled={processing}
                className="flex-1 py-3 rounded-2xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 font-black text-[11px] uppercase tracking-widest transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {processing ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                Reset {investments.length} Paquetes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: Confirm subtract ═══ */}
      {confirmSubtract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#0d1117] border border-rose-500/25 rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-rose-500/10 rounded-2xl border border-rose-500/20">
                <MinusCircle className="text-rose-400" size={22} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Confirmar Sustracción</h3>
                <p className="text-[11px] text-slate-500 font-bold">{selected?.full_name || selected?.email}</p>
              </div>
            </div>

            <div className="bg-black/30 border border-slate-800 rounded-2xl p-4 space-y-3 mb-6 text-[11px] font-bold">
              {subWalletNum > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Wallet Balance</span>
                  <span>${fmt(selected!.wallet_balance)} <span className="text-rose-500">→</span> <span className="text-emerald-400">${fmt(newWallet)}</span></span>
                </div>
              )}
              <div className="h-px bg-slate-800" />
              <div className="flex justify-between items-center text-rose-400">
                <span>Total sustraído</span>
                <span>-${fmt(subWalletNum)}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setConfirmSubtract(false)} className="flex-1 py-3 rounded-2xl border border-slate-800 text-slate-400 font-black text-[11px] uppercase tracking-widest hover:bg-slate-800 transition-all">
                Cancelar
              </button>
              <button
                onClick={applySubtract}
                disabled={processing}
                className="flex-1 py-3 rounded-2xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 font-black text-[11px] uppercase tracking-widest transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {processing ? <Loader2 size={14} className="animate-spin" /> : <MinusCircle size={14} />}
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default BalanceManager;
