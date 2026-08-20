import React, { useEffect, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Deposit } from '../types';
import StatusBadge from '../components/StatusBadge';
import {
  Check,
  X,
  Eye,
  AlertCircle,
  Loader2,
  Search,
  Filter,
  RefreshCw,
  Inbox,
  ShieldCheck,
  PlusCircle,
  Wallet,
  Coins,
  ArrowDownCircle,
  ArrowRightLeft,
  Settings2,
  Image as ImageIcon,
  Download
} from 'lucide-react';

const Deposits: React.FC = () => {
  const [deposits, setDeposits] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedProofUrl, setSelectedProofUrl] = useState<string | null>(null);
  const [editingHash, setEditingHash] = useState<{ id: string, value: string } | null>(null);

  // Manual Injection State
  const [showManualModal, setShowManualModal] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [foundUsers, setFoundUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [injectAmount, setInjectAmount] = useState('');
  const [injectType, setInjectType] = useState<'ADD' | 'SUBTRACT'>('ADD');
  const [injectDescription, setInjectDescription] = useState('');
  const [searchingUsers, setSearchingUsers] = useState(false);

  // Conserva la misma referencia cuando una solicitud se reintenta después
  // de un timeout, para que el RPC pueda responder idempotentemente.
  const injectionRequestRef = useRef<{
    fingerprint: string;
    referenceId: string;
  } | null>(null);

  useEffect(() => {
    fetchDeposits();
  }, []);

  const fetchDeposits = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch Deposits
      const { data: depositsData, error: depErr } = await supabase
        .from('deposits')
        .select(`
          *,
          profiles:user_id ( id, email, full_name )
        `)
        .order('created_at', { ascending: false });

      if (depErr) throw depErr;

      // Fetch Withdrawals
      const { data: withdrawalsData, error: withErr } = await supabase
        .from('withdrawals')
        .select(`
          *,
          profiles:user_id ( id, email, full_name )
        `)
        .order('created_at', { ascending: false });

      if (withErr) throw withErr;

      // Combine and mark types
      const combined = [
        ...(depositsData || []).map(d => ({ ...d, type: 'DEPOSIT' })),
        ...(withdrawalsData || []).map(w => ({ ...w, type: 'WITHDRAWAL' }))
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setDeposits(combined as any);
    } catch (err: any) {
      console.error("Ledger Fetch Error:", err);
      setError(err.message === 'Failed to fetch' ? "No se pudo conectar con el servidor." : err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, newStatus: 'APPROVED' | 'REJECTED', userId: string, amount: number, type: 'DEPOSIT' | 'WITHDRAWAL' = 'DEPOSIT') => {
    setActionLoading(id);
    try {
      if (newStatus === 'APPROVED') {
        const { data: rpcData, error: rpcError } = await supabase.rpc('process_deposit_approval', {
          p_deposit_id: id,
          p_admin_id: (await supabase.auth.getUser()).data.user?.id
        });

        if (rpcError) throw rpcError;
        if (rpcData && !rpcData.success) throw new Error(rpcData.message);
      } else if (type === 'DEPOSIT') {
        const adminId = (await supabase.auth.getUser()).data.user?.id;
        const { data: rpcData, error: rpcError } = await supabase.rpc('admin_reject_deposit_atomic', {
          p_deposit_id: id,
          p_admin_id: adminId,
        });
        if (rpcError) throw rpcError;
        if (rpcData && !rpcData.success) throw new Error(rpcData.message || rpcData.error || 'El RPC rechazÃ³ el depÃ³sito.');
      } else {
        const adminId = (await supabase.auth.getUser()).data.user?.id;
        const { data: rpcData, error: rpcError } = await supabase.rpc('reject_withdrawal', {
          p_withdrawal_id: id,
          p_reason: 'Rechazado desde Deposits Terminal',
          p_admin_id: adminId,
        });
        if (rpcError) throw rpcError;
        if (rpcData && !rpcData.success) throw new Error(rpcData.message || rpcData.error || 'El RPC rechazÃ³ el retiro.');
      }

      await fetchDeposits();
    } catch (err: any) {
      console.error("Update Status Error:", err);
      alert('Error al procesar: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateHash = async (id: string) => {
    if (!editingHash || editingHash.id !== id) return;

    setActionLoading(id);
    try {
      const { error } = await supabase
        .from('deposits')
        .update({ blockchain_tx_hash: editingHash.value })
        .eq('id', id);

      if (error) throw error;

      setDeposits(prev => prev.map(d => d.id === id ? { ...d, blockchain_tx_hash: editingHash.value } : d));
      setEditingHash(null);
    } catch (err: any) {
      alert('Error actualizando hash: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const getFilteredDeposits = () => {
    return deposits.filter(d => {
      const matchesFilter = filter === 'all' || d.status.toLowerCase() === filter.toLowerCase();
      const profileInfo = d.profiles || {};
      const fullName = (profileInfo as any)?.full_name || (profileInfo as any)?.name || '';
      const email = (profileInfo as any)?.email || '';

      const matchesSearch =
        fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(d.id).toLowerCase().includes(searchTerm.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  };

  const handleSearchUsers = async (val: string) => {
    setUserSearchTerm(val);
    if (val.length < 3) {
      setFoundUsers([]);
      return;
    }

    setSearchingUsers(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, wallet_balance')
        .or(`full_name.ilike.%${val}%,email.ilike.%${val}%`)
        .limit(5);

      if (error) throw error;
      setFoundUsers(data || []);
    } catch (err) {
      console.error("User search error:", err);
    } finally {
      setSearchingUsers(false);
    }
  };

  const executeManualInjection = async () => {
    if (!selectedUser || !injectAmount || parseFloat(injectAmount) <= 0) return;

    setActionLoading('manual_injection');

    try {
      const numAmount = Number.parseFloat(injectAmount);
      if (!Number.isFinite(numAmount) || numAmount <= 0) {
        throw new Error('El monto debe ser positivo y válido');
      }

      const finalAmount = injectType === 'ADD' ? numAmount : -numAmount;
      const description =
        injectDescription.trim() ||
        `Ajuste manual de administración (${injectType})`;

      const fingerprint = [
        selectedUser.id,
        'wallet_balance',
        finalAmount.toFixed(2),
        description,
      ].join('|');

      if (
        !injectionRequestRef.current ||
        injectionRequestRef.current.fingerprint !== fingerprint
      ) {
        injectionRequestRef.current = {
          fingerprint,
          referenceId: crypto.randomUUID(),
        };
      }

      const referenceId = injectionRequestRef.current.referenceId;

      // La autorización, el bloqueo del perfil, el cálculo del saldo,
      // credit_logs y transactions se ejecutan dentro de Supabase.
      const { data, error } = await supabase.rpc('admin_adjust_balance', {
        p_user_id: selectedUser.id,
        p_balance_column: 'wallet_balance',
        p_amount: finalAmount,
        p_description: description,
        p_reference_id: referenceId,
      });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.message || 'El RPC rechazó el ajuste');
      }

      const balanceLabel = 'Wallet Bank';
      const resultingBalance = data.new_balance ?? data.current_balance;
      const idempotentNote = data.idempotent
        ? ' (reintento idempotente; no se duplicó)'
        : '';

      alert(
        `Ajuste procesado correctamente${idempotentNote}. ` +
        `${balanceLabel}: $${Number(resultingBalance ?? 0).toFixed(2)}`
      );

      setShowManualModal(false);
      setSelectedUser(null);
      setInjectAmount('');
      setInjectDescription('');
      setUserSearchTerm('');
      setFoundUsers([]);
      injectionRequestRef.current = null;

      // Solo refresca la vista; no realiza ninguna escritura.
      await fetchDeposits();
    } catch (err: any) {
      console.error('Manual balance adjustment error:', err);
      alert('Error: ' + (err?.message || 'No se pudo procesar el ajuste'));
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = getFilteredDeposits();

  const counts = {
    all: deposits.length,
    pending: deposits.filter(d => d.status.toLowerCase() === 'pending').length,
    approved: deposits.filter(d => d.status.toLowerCase() === 'approved').length,
    rejected: deposits.filter(d => d.status.toLowerCase() === 'rejected').length,
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-700 max-w-[1600px] mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
              <ArrowDownCircle className="text-emerald-500" size={32} />
            </div>
            Deposits Terminal
          </h1>
          <p className="text-slate-500 font-medium mt-2">Gestión y auditoría de inyecciones de capital fiat y cripto.</p>
        </div>

        <div className="flex items-center space-x-4">
          <div className="relative group flex-1 md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-500 transition-colors" size={20} />
            <input
              type="text"
              placeholder="Buscar transacción..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#111114] border border-slate-800 rounded-3xl py-4 pl-12 pr-6 text-white font-medium focus:ring-2 focus:ring-emerald-500 outline-none transition-all shadow-2xl"
            />
          </div>
          <button
            onClick={() => setShowManualModal(true)}
            className="flex items-center gap-3 px-6 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-3xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg shadow-emerald-600/20 active:scale-95 border border-emerald-400/20"
          >
            <PlusCircle size={20} />
            Inyección Manual
          </button>
          <button
            onClick={fetchDeposits}
            className="p-4 bg-[#111114] hover:bg-slate-800 text-slate-400 hover:text-white rounded-3xl transition-all active:scale-90 border border-slate-800 shadow-xl"
          >
            <RefreshCw size={24} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Stats and Filters */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="bg-[#111114] border border-slate-800/50 p-6 rounded-[2rem] shadow-xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Flujo de Caja (Bruto)</p>
            <p className="text-2xl font-black text-emerald-500 tracking-tight tabular-nums">
              ${deposits.filter(d => d.type === 'DEPOSIT' && (d.status === 'APPROVED' || d.status === 'approved' || d.status === 'COMPLETED')).reduce((sum, d) => sum + Number(d.amount), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500 border border-emerald-500/20">
            <Coins size={20} />
          </div>
        </div>

        <div className="bg-[#111114] border border-slate-800/50 p-6 rounded-[2rem] shadow-xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Flujo de Caja (Neto)</p>
            <p className={`text-2xl font-black tracking-tight tabular-nums ${deposits.filter(d => d.status === 'APPROVED' || d.status === 'approved' || d.status === 'COMPLETED').reduce((sum, d) => sum + (d.type === 'DEPOSIT' ? Number(d.amount) : -Number(d.amount)), 0) >= 0 ? 'text-indigo-400' : 'text-rose-400'}`}>
              ${deposits.filter(d => d.status === 'APPROVED' || d.status === 'approved' || d.status === 'COMPLETED').reduce((sum, d) => sum + (d.type === 'DEPOSIT' ? Number(d.amount) : -Number(d.amount)), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/20">
            <ArrowRightLeft size={20} />
          </div>
        </div>

        <div className="xl:col-span-3 flex flex-wrap items-center gap-3 bg-[#111114]/50 p-2 rounded-[2rem] border border-slate-800/50 shadow-inner w-full">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`
                flex items-center space-x-3 px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300
                ${filter === f
                  ? 'bg-emerald-600 text-white shadow-[0_10px_30px_rgba(16,185,129,0.3)]'
                  : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800'
                }
              `}
            >
              <span>{f}</span>
              <span className={`${filter === f ? 'bg-white/20' : 'bg-slate-800/50'} px-3 py-1 rounded-full font-black text-[10px]`}>
                {counts[f]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="flex items-center gap-4 p-6 bg-rose-500/10 border border-rose-500/20 rounded-[2rem] text-rose-400 animate-in slide-in-from-top-4">
          <AlertCircle size={28} />
          <div className="flex-1">
            <p className="font-black text-lg">System Integrity Error</p>
            <p className="font-medium opacity-80">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="p-2 hover:bg-rose-500/10 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>
      )}

      {/* Main Table Container */}
      <div className="bg-[#111114] border border-slate-800/50 rounded-[3rem] overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/60 text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] border-b border-slate-800/50">
                <th className="px-10 py-6">Identidad</th>
                <th className="px-10 py-6 text-center">Operación</th>
                <th className="px-10 py-6 text-center">Evidencia / Hash</th>
                <th className="px-10 py-6 text-center">Estatus</th>
                <th className="px-10 py-6 text-right w-48">Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/30">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-10 py-40 text-center">
                    <div className="flex flex-col items-center justify-center space-y-6">
                      <div className="relative">
                        <div className="w-16 h-16 border-4 border-emerald-500/10 rounded-full" />
                        <div className="absolute top-0 w-16 h-16 border-4 border-t-emerald-500 rounded-full animate-spin" />
                      </div>
                      <span className="text-slate-500 font-black uppercase text-xs tracking-[0.3em] animate-pulse">Sincronizando Ledger Global...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-10 py-32 text-center opacity-30 italic font-bold text-slate-600">
                    No se detectaron transacciones entrantes para este filtro.
                  </td>
                </tr>
              ) : filtered.map((dep) => (
                <tr key={dep.id} className="group hover:bg-white/[0.02] transition-colors border-l-2 border-l-transparent hover:border-l-emerald-500">
                  <td className="px-10 py-8">
                    <div className="flex items-center space-x-5">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 flex items-center justify-center text-xl font-black text-slate-400 group-hover:scale-105 transition-transform duration-500 shadow-xl">
                        {(dep.profiles as any)?.full_name?.[0] || 'U'}
                      </div>
                      <div>
                        <p className="text-base font-black text-slate-100">{(dep.profiles as any)?.full_name || 'System User'}</p>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-tight">{(dep.profiles as any)?.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-10 py-8 text-center">
                    <div className={`inline-block px-6 py-3 rounded-2xl border ${dep.type === 'DEPOSIT' ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-rose-500/5 border-rose-500/10'}`}>
                      <p className={`text-2xl font-black tabular-nums ${dep.type === 'DEPOSIT' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {dep.type === 'DEPOSIT' ? '+' : '-'}${dep.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-[9px] text-slate-600 font-black uppercase tracking-[0.2em] mt-1">{dep.type === 'DEPOSIT' ? 'DEPÓSITO' : 'RETIRO'}</p>
                    </div>
                  </td>
                  <td className="px-10 py-8 text-center">
                    <div className="flex flex-col items-center gap-3">
                      {dep.type === 'DEPOSIT' ? (
                        dep.proof_url ? (
                          <button
                            onClick={() => setSelectedProofUrl(dep.proof_url || null)}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-xl transition-all transform hover:-translate-y-1 shadow-lg group/btn"
                          >
                            <Eye size={16} className="group-hover/btn:scale-110" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Ver Recibo</span>
                          </button>
                        ) : (
                          <span className="text-[9px] font-black text-slate-700 uppercase italic">Sin Comprobante</span>
                        )
                      ) : (
                        <div className="flex flex-col items-center">
                          <span className="text-[9px] font-black text-slate-500 uppercase">Wallet Destino</span>
                          <span className="text-[10px] font-mono text-emerald-500/70 truncate w-32">{dep.wallet_address || 'Internal'}</span>
                        </div>
                      )}

                      {/* Blockchain Hash Section */}
                      <div className="flex items-center gap-2 max-w-[200px]">
                        {editingHash && editingHash.id === dep.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={editingHash.value}
                              onChange={(e) => setEditingHash(prev => prev ? { ...prev, value: e.target.value } : null)}
                              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[10px] text-emerald-400 w-32 outline-none"
                              placeholder="Tx Hash..."
                            />
                            <button onClick={() => handleUpdateHash(dep.id)} className="text-emerald-500 hover:text-emerald-400"><Check size={14} /></button>
                            <button onClick={() => setEditingHash(null)} className="text-rose-500 hover:text-rose-400"><X size={14} /></button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1 group/hash">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono text-slate-500 truncate cursor-pointer hover:text-emerald-400 transition-colors"
                                onClick={() => setEditingHash({ id: String(dep.id), value: dep.blockchain_tx_hash || '' })}>
                                {dep.blockchain_tx_hash ? `${dep.blockchain_tx_hash.slice(0, 10)}...` : (dep.transaction_hash ? `NP: ${dep.transaction_hash.slice(0, 8)}...` : 'N/A')}
                              </span>
                              <Settings2 size={12} className="text-slate-700 opacity-0 group-hover/hash:opacity-100 transition-opacity cursor-pointer"
                                onClick={() => setEditingHash({ id: String(dep.id), value: dep.blockchain_tx_hash || '' })} />
                            </div>
                            {!dep.blockchain_tx_hash && dep.transaction_hash && (
                              <span className="text-[8px] text-slate-600 font-bold uppercase tracking-tighter">ID NowPayments</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-10 py-8 text-center">
                    <StatusBadge status={dep.status} />
                    <p className="text-[9px] text-slate-500 font-bold mt-2 uppercase tracking-widest">{new Date(dep.created_at).toLocaleDateString()}</p>
                  </td>
                  <td className="px-10 py-8">
                    <div className="flex items-center justify-end gap-3">
                      {(dep.status.toLowerCase() === 'pending') && (
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => {
                              if (confirm(`¿VALIDAR Y APROBAR ${dep.type === 'DEPOSIT' ? 'DEPÓSITO' : 'RETIRO'} DE $${dep.amount}?`)) {
                                updateStatus(dep.id, 'APPROVED', dep.user_id, dep.amount, dep.type as any);
                              }
                            }}
                            disabled={!!actionLoading}
                            className={`w-12 h-12 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white rounded-2xl border border-emerald-500/20 transition-all duration-300 flex items-center justify-center shadow-lg active:scale-95 disabled:opacity-50 group/save`}
                          >
                            {actionLoading === dep.id ? <Loader2 size={24} className="animate-spin" /> : <Check size={24} />}
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`¿RECHAZAR ${dep.type === 'DEPOSIT' ? 'DEPÓSITO' : 'RETIRO'} de $${dep.amount}?`)) {
                                updateStatus(dep.id, 'REJECTED', dep.user_id, dep.amount, dep.type as any);
                              }
                            }}
                            disabled={!!actionLoading}
                            className="w-12 h-12 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-2xl border border-rose-500/20 transition-all duration-300 flex items-center justify-center shadow-lg active:scale-95 disabled:opacity-50"
                          >
                            <X size={24} />
                          </button>
                        </div>
                      )}

                      {dep.status.toLowerCase() !== 'pending' && (
                        <div className="w-12 h-12 flex items-center justify-center opacity-20">
                          <ShieldCheck className="text-slate-500" size={24} />
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* PROOF MODAL */}
      {selectedProofUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/95 transition-opacity" onClick={() => setSelectedProofUrl(null)} />
          <div className="relative bg-[#0f0f12] border border-slate-800 w-full max-w-4xl rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] animate-in zoom-in-95 flex flex-col max-h-[90vh]">
            <div className="p-10 border-b border-slate-800/50 flex items-center justify-between bg-slate-900/20">
              <div className="flex items-center space-x-6">
                <div className="w-14 h-14 bg-indigo-600/10 rounded-2xl flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                  <ImageIcon size={28} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white tracking-tight">Financial Audit Evidence</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-1">Verificación visual de transferencia bancaria / Cripto</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedProofUrl(null)}
                className="p-4 text-slate-500 hover:text-white rounded-2xl hover:bg-slate-800 transition-all border border-transparent hover:border-slate-700"
              >
                <X size={32} />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-12 bg-slate-950/30 flex items-center justify-center relative min-h-[500px]">
              <img
                src={selectedProofUrl}
                alt="Evidence"
                className="max-w-full h-auto rounded-3xl shadow-[0_30px_60px_-12px_rgba(0,0,0,0.5)] border border-slate-800/50"
              />
            </div>

            <div className="p-10 border-t border-slate-800/50 bg-[#0c0c0f] flex justify-between items-center">
              <div className="flex items-center gap-4 text-slate-500">
                <AlertCircle size={24} className="text-amber-500/50" />
                <p className="text-[10px] font-bold max-w-md uppercase tracking-tight leading-relaxed">
                  Confirme que el remitente, fecha y monto coincidan exactamente con la base de datos antes de liberar liquidez.
                </p>
              </div>
              <div className="flex space-x-4">
                <a
                  href={selectedProofUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-10 py-5 bg-slate-800 hover:bg-slate-700 text-white rounded-3xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center space-x-3 border border-slate-700/50"
                >
                  <Download size={18} />
                  <span>Download Original</span>
                </a>
                <button
                  onClick={() => setSelectedProofUrl(null)}
                  className="px-12 py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-3xl font-black uppercase text-[10px] tracking-widest shadow-[0_10px_30px_rgba(79,70,229,0.3)] transition-all active:scale-95 border border-indigo-400/20"
                >
                  Cerrar Auditoría
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MANUAL INJECTION MODAL */}
      {showManualModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md transition-opacity" onClick={() => setShowManualModal(false)} />
          <div className="relative bg-[#0f0f12] border border-slate-800 w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 flex flex-col">
            <div className="p-8 border-b border-slate-800/50 flex items-center justify-between bg-emerald-950/20">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                  <Wallet size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white tracking-tight">Inyección de Liquidez</h3>
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.2em]">Abono directo al balance del usuario</p>
                </div>
              </div>
              <button
                onClick={() => setShowManualModal(false)}
                className="p-2 text-slate-500 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-8 space-y-6">
              {/* User Search */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Buscar Usuario</label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                  <input
                    type="text"
                    placeholder="Email o nombre del usuario..."
                    value={userSearchTerm}
                    onChange={(e) => handleSearchUsers(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-white text-sm focus:border-emerald-500 outline-none transition-all"
                  />
                  {searchingUsers && (
                    <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500 animate-spin" size={18} />
                  )}
                </div>

                {/* Search Results */}
                {foundUsers.length > 0 && !selectedUser && (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden mt-2 divide-y divide-slate-800 animate-in slide-in-from-top-2">
                    {foundUsers.map(u => (
                      <button
                        key={u.id}
                        onClick={() => setSelectedUser(u)}
                        className="w-full p-4 flex items-center justify-between hover:bg-emerald-500/10 text-left transition-colors"
                      >
                        <div>
                          <p className="text-sm font-bold text-white">{u.full_name || 'Sin Nombre'}</p>
                          <p className="text-[10px] text-slate-500">{u.email}</p>
                        </div>
                        <p className="text-xs font-black text-emerald-500">
                          Wallet Bank: ${(u.wallet_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedUser && (
                <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6">
                  {/* Selected User Badge */}
                  <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white font-black">
                        {selectedUser.full_name?.[0] || 'U'}
                      </div>
                      <div>
                        <p className="text-xs font-black text-white">{selectedUser.full_name}</p>
                        <p className="text-[9px] text-emerald-500/70 font-bold uppercase tracking-widest">Target Node Selected</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedUser(null)}
                      className="text-[9px] font-black text-rose-500 uppercase hover:underline"
                    >
                      Cambiar
                    </button>
                  </div>

                  {/* Action Type */}
                  <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800/50">
                    <button
                      onClick={() => setInjectType('ADD')}
                      className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${injectType === 'ADD' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500'}`}
                    >
                      Aumentar (+)
                    </button>
                    <button
                      onClick={() => setInjectType('SUBTRACT')}
                      className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${injectType === 'SUBTRACT' ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-500'}`}
                    >
                      Disminuir (-)
                    </button>
                  </div>

                  {/* Single operational wallet */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Saldo a Afectar</label>
                    <div className="flex items-center gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-emerald-400">
                      <Wallet size={16} />
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest">Wallet Bank</p>
                        <p className="text-[9px] text-slate-500">Saldo único para ciclos, comisiones y retiros.</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Monto (USD)</label>
                      <input
                        type="number"
                        placeholder="0.00"
                        value={injectAmount}
                        onChange={(e) => setInjectAmount(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 px-5 text-white font-black text-lg focus:border-emerald-500 outline-none tabular-nums"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Referencia</label>
                      <input
                        type="text"
                        placeholder="Motivo..."
                        value={injectDescription}
                        onChange={(e) => setInjectDescription(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 px-5 text-white text-sm focus:border-emerald-500 outline-none"
                      />
                    </div>
                  </div>

                  <button
                    onClick={executeManualInjection}
                    disabled={!injectAmount || parseFloat(injectAmount) <= 0 || actionLoading === 'manual_injection'}
                    className="w-full py-5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-xs uppercase tracking-[0.3em] rounded-2xl shadow-xl shadow-emerald-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {actionLoading === 'manual_injection' ? (
                      <Loader2 size={20} className="animate-spin" />
                    ) : (
                      <ShieldCheck size={20} />
                    )}
                    Confirmar Transacción
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Deposits;
