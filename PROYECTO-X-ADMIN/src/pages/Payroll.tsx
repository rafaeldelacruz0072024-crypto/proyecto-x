import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Withdrawal } from '../types';
import {
  Banknote, RefreshCw, CheckSquare, Square, Zap, AlertTriangle,
  CheckCircle2, XCircle, Loader2, Copy, ExternalLink, ChevronRight,
  Wallet, Users, DollarSign, Send
} from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

type PayrollStatus = 'idle' | 'loading' | 'confirming' | 'processing' | 'done' | 'error';

interface PayoutResult {
  withdrawal_id: string;
  user_email: string;
  amount: number;
  wallet: string;
  status: 'sent' | 'failed';
  batch_withdrawal_id?: string;
  error?: string;
}

const Payroll: React.FC = () => {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<PayrollStatus>('idle');
  const [results, setResults] = useState<PayoutResult[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [batchId, setBatchId] = useState('');
  const [copied, setCopied] = useState(false);

  const loadPending = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('withdrawals')
      .select(`*, profiles:user_id (id, email, full_name, wallet_address)`)
      .in('status', ['pending', 'approved'])
      .order('created_at', { ascending: true });
    if (!error) setWithdrawals(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadPending(); }, [loadPending]);

  const toggleAll = () => {
    const eligible = withdrawals.filter(w => w.wallet_address);
    if (selected.size === eligible.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(eligible.map(w => w.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectedItems = withdrawals.filter(w => selected.has(w.id));
  const totalGross = selectedItems.reduce((s, w) => s + w.amount, 0);
  const totalNet = selectedItems.reduce((s, w) => s + (w.net_amount ?? w.amount * 0.9), 0);
  const noWallet = withdrawals.filter(w => !w.wallet_address);

  const executePayroll = async () => {
    if (selectedItems.length === 0) return;
    setStatus('processing');
    setErrorMsg('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const payload = {
        withdrawals: selectedItems.map(w => ({
          id: w.id,
          amount: w.net_amount ?? +(w.amount * 0.9).toFixed(2),
          wallet: w.wallet_address,
          user_email: (w.profiles as any)?.email || '',
        }))
      };

      const res = await fetch(`${SUPABASE_URL}/functions/v1/process-payroll`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error en el servidor');

      setResults(json.results || []);
      setBatchId(json.batch_id || '');
      setStatus('done');
      loadPending();
    } catch (e: any) {
      setErrorMsg(e.message);
      setStatus('error');
    }
  };

  const copyBatchId = () => {
    navigator.clipboard.writeText(batchId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sentCount = results.filter(r => r.status === 'sent').length;
  const failedCount = results.filter(r => r.status === 'failed').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-widest flex items-center gap-3">
            <Banknote className="text-blue-400" size={28} />
            Nómina Cripto
          </h1>
          <p className="text-slate-500 text-xs uppercase tracking-widest mt-1">
            Pagos masivos via NOWPayments · USDT BEP-20
          </p>
        </div>
        <button
          onClick={loadPending}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase tracking-widest rounded-xl border border-slate-700 transition-all"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Pendientes</p>
          <p className="text-2xl font-black text-white">{withdrawals.length}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Sin Wallet</p>
          <p className="text-2xl font-black text-amber-400">{noWallet.length}</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4">
          <p className="text-[10px] text-blue-400 uppercase tracking-widest mb-1">Seleccionados</p>
          <p className="text-2xl font-black text-white">{selected.size}</p>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4">
          <p className="text-[10px] text-emerald-400 uppercase tracking-widest mb-1">Total Neto</p>
          <p className="text-2xl font-black text-white">${totalNet.toFixed(2)}</p>
        </div>
      </div>

      {/* Warning no wallet */}
      {noWallet.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
          <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-300">
            <span className="font-bold">{noWallet.length} retiro(s)</span> no tienen wallet configurada y no pueden procesarse. Aparecen deshabilitados.
          </p>
        </div>
      )}

      {/* Processing / Done / Error states */}
      {status === 'processing' && (
        <div className="flex items-center gap-4 p-6 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
          <Loader2 size={24} className="animate-spin text-blue-400 shrink-0" />
          <div>
            <p className="text-white font-bold text-sm">Ejecutando nómina...</p>
            <p className="text-slate-400 text-xs mt-0.5">Enviando pagos a NOWPayments. No cierres esta ventana.</p>
          </div>
        </div>
      )}

      {status === 'done' && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={22} className="text-emerald-400" />
            <p className="text-white font-black text-sm uppercase tracking-wider">Nómina completada</p>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-black text-emerald-400">{sentCount}</p>
              <p className="text-[10px] text-slate-500 uppercase">Enviados</p>
            </div>
            <div>
              <p className="text-2xl font-black text-red-400">{failedCount}</p>
              <p className="text-[10px] text-slate-500 uppercase">Fallidos</p>
            </div>
            <div>
              <p className="text-2xl font-black text-white">{results.length}</p>
              <p className="text-[10px] text-slate-500 uppercase">Total</p>
            </div>
          </div>
          {batchId && (
            <div className="flex items-center gap-3 bg-black/40 border border-slate-700 rounded-xl px-4 py-3">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest shrink-0">Batch ID</p>
              <p className="text-xs text-emerald-400 font-mono flex-1 truncate">{batchId}</p>
              <button onClick={copyBatchId} className="shrink-0 text-slate-400 hover:text-white transition-colors">
                {copied ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Copy size={14} />}
              </button>
            </div>
          )}
          {/* Results detail */}
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {results.map((r, i) => (
              <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs ${r.status === 'sent' ? 'bg-emerald-500/5 border border-emerald-500/10' : 'bg-red-500/10 border border-red-500/20'}`}>
                <span className="text-slate-400 truncate flex-1">{r.user_email}</span>
                <span className="text-white font-bold mx-3">${r.amount.toFixed(2)}</span>
                {r.status === 'sent'
                  ? <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                  : <XCircle size={13} className="text-red-400 shrink-0" />
                }
              </div>
            ))}
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
          <XCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-red-300 font-bold text-xs">Error al procesar la nómina</p>
            <p className="text-slate-400 text-xs mt-0.5">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-blue-400" />
        </div>
      ) : withdrawals.length === 0 ? (
        <div className="text-center py-20 text-slate-600">
          <Banknote size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-bold uppercase tracking-widest">No hay retiros pendientes</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          {/* Table header */}
          <div className="flex items-center gap-4 px-5 py-4 border-b border-slate-800 bg-slate-800/40">
            <button onClick={toggleAll} className="text-slate-400 hover:text-white transition-colors shrink-0">
              {selected.size === withdrawals.filter(w => w.wallet_address).length && selected.size > 0
                ? <CheckSquare size={16} className="text-blue-400" />
                : <Square size={16} />
              }
            </button>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest flex-1">Usuario</span>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest w-28 text-right hidden sm:block">Bruto</span>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest w-28 text-right">Neto USDT</span>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest w-40 hidden md:block">Wallet</span>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest w-20 text-center">Estado</span>
          </div>

          <div className="divide-y divide-slate-800/50">
            {withdrawals.map(w => {
              const profile = w.profiles as any;
              const hasWallet = !!w.wallet_address;
              const net = w.net_amount ?? +(w.amount * 0.9).toFixed(2);
              const isSelected = selected.has(w.id);

              return (
                <div
                  key={w.id}
                  onClick={() => hasWallet && toggleOne(w.id)}
                  className={`flex items-center gap-4 px-5 py-4 transition-all ${hasWallet ? 'cursor-pointer hover:bg-slate-800/40' : 'opacity-40 cursor-not-allowed'} ${isSelected ? 'bg-blue-500/5 border-l-2 border-blue-500' : ''}`}
                >
                  <div className="shrink-0 text-slate-400">
                    {isSelected
                      ? <CheckSquare size={16} className="text-blue-400" />
                      : <Square size={16} />
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      {profile?.full_name || profile?.email || 'Usuario'}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate">{profile?.email}</p>
                  </div>

                  <div className="w-28 text-right hidden sm:block">
                    <p className="text-sm text-slate-300">${w.amount.toFixed(2)}</p>
                  </div>

                  <div className="w-28 text-right">
                    <p className="text-sm font-bold text-emerald-400">${net.toFixed(2)}</p>
                  </div>

                  <div className="w-40 hidden md:block">
                    {w.wallet_address ? (
                      <p className="text-[10px] font-mono text-slate-400 truncate">{w.wallet_address}</p>
                    ) : (
                      <p className="text-[10px] text-amber-500 font-bold uppercase">Sin wallet</p>
                    )}
                  </div>

                  <div className="w-20 text-center">
                    <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${
                      w.status === 'approved' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {w.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom action bar */}
      {selected.size > 0 && status !== 'processing' && (
        <div className="sticky bottom-4 z-50">
          <div className="bg-slate-900 border border-blue-500/30 rounded-2xl p-5 shadow-2xl shadow-blue-500/10 space-y-4">
            {/* Fee breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
              <div className="bg-slate-800/60 rounded-xl p-3">
                <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Usuarios</p>
                <p className="text-lg font-black text-white">{selected.size}</p>
              </div>
              <div className="bg-slate-800/60 rounded-xl p-3">
                <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Bruto total</p>
                <p className="text-lg font-black text-slate-300">${totalGross.toFixed(2)}</p>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                <p className="text-[9px] text-amber-500 uppercase tracking-widest mb-1">Fee NOVA DIGITAL (10%)</p>
                <p className="text-lg font-black text-amber-400">+${(totalGross - totalNet).toFixed(2)}</p>
              </div>
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                <p className="text-[9px] text-red-400 uppercase tracking-widest mb-1">Fee NOWPay (0.5%)</p>
                <p className="text-lg font-black text-red-400">-${(totalNet * 0.005).toFixed(2)}</p>
                <p className="text-[8px] text-slate-600 mt-0.5">absorbido empresa</p>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                <p className="text-[9px] text-emerald-400 uppercase tracking-widest mb-1">Depósito NOWPay</p>
                <p className="text-lg font-black text-emerald-400">${(totalNet + totalNet * 0.005).toFixed(2)}</p>
                <p className="text-[8px] text-slate-500 mt-0.5">USDT necesarios</p>
              </div>
            </div>

            {/* Profit line */}
            <div className="flex items-center justify-between px-3 py-2 bg-blue-500/5 border border-blue-500/10 rounded-xl">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest">
                Ganancia neta empresa tras nómina:
              </span>
              <span className="text-sm font-black text-blue-400">
                +${((totalGross - totalNet) - (totalNet * 0.005)).toFixed(2)} USDT
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <p className="text-[10px] text-slate-600 uppercase tracking-widest">
                ⚠ Asegúrate de tener <span className="text-white font-bold">${(totalNet + totalNet * 0.005).toFixed(2)} USDT</span> en tu balance de NOWPayments antes de ejecutar.
              </p>
              <button
                onClick={executePayroll}
                className="flex items-center gap-2.5 px-6 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all active:scale-95 shadow-lg shadow-blue-500/20 shrink-0"
              >
                <Send size={15} />
                Ejecutar Nómina
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Payroll;
