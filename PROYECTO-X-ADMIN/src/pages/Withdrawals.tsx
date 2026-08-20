import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Withdrawal } from '../types';
import StatusBadge from '../components/StatusBadge';
import {
  ArrowUpCircle,
  RefreshCw,
  Search,
  Check,
  X,
  Eye,
  Loader2,
  Inbox,
  Calendar,
  User as UserIcon,
  CreditCard,
  Hash,
  MessageSquare,
  AlertCircle,
  ShieldCheck,
  ExternalLink,
  ChevronRight,
  Send,
  Settings2
} from 'lucide-react';

const Withdrawals: React.FC = () => {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'completed'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modals state
  const [showRejectModal, setShowRejectModal] = useState<Withdrawal | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const [showCompleteModal, setShowCompleteModal] = useState<Withdrawal | null>(null);
  const [txHash, setTxHash] = useState('');

  useEffect(() => {
    loadWithdrawals();
  }, []);

  const loadWithdrawals = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from('withdrawals')
        .select(`
          *,
          profiles:user_id (
            id,
            email,
            full_name,
            user_tag
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWithdrawals(data || []);
      setSelectedIds([]); // Clear selection on reload
    } catch (error: any) {
      console.error('Error loading withdrawals:', error);
      setWithdrawals([]);
      setLoadError(error?.message || 'No se pudieron cargar los retiros.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (withdrawal: Withdrawal) => {
    if (!confirm(`¿ESTÁS SEGURO? Se aprobarán $${withdrawal.amount} para este usuario.`)) return;

    setProcessing(withdrawal.id);
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('process_withdrawal_approval', {
        p_withdrawal_id: withdrawal.id,
        p_admin_id: (await supabase.auth.getUser()).data.user?.id
      });

      if (rpcError) throw rpcError;
      if (rpcData && !rpcData.success) throw new Error(rpcData.message);

      await loadWithdrawals();
    } catch (error: any) {
      console.error('Error approving withdrawal:', error);
      alert('Error en aprobación: ' + error.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return;

    const pendingToApprove = withdrawals.filter(w =>
      selectedIds.includes(w.id) && (w.status.toUpperCase() === 'PENDING')
    );

    if (pendingToApprove.length === 0) {
      alert('Solo se pueden aprobar masivamente retiros en estado PENDIENTE.');
      return;
    }

    if (!confirm(`¿PAGAR NÓMINA SELECCIONADA? Se procesarán ${pendingToApprove.length} retiros.`)) return;

    setProcessing('bulk');
    let successCount = 0;
    let failCount = 0;

    for (const w of pendingToApprove) {
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('process_withdrawal_approval', {
          p_withdrawal_id: w.id,
          p_admin_id: (await supabase.auth.getUser()).data.user?.id
        });

        if (rpcError) throw rpcError;
        if (rpcData && !rpcData.success) throw new Error(rpcData.message);

        successCount++;
      } catch (err) {
        console.error(`Error aprobando masivo ${w.id}:`, err);
        failCount++;
      }
    }

    alert(`Nómina procesada.\n✅ Éxito: ${successCount}\n❌ Fallidos: ${failCount}`);
    await loadWithdrawals();
    setProcessing(null);
  };

  const submitReject = async () => {
    if (!showRejectModal || !rejectionReason.trim()) return;

    setProcessing(showRejectModal.id);
    try {
      // Usar RPC que rechaza Y restaura el saldo al usuario automáticamente
      const { data: rpcData, error: rpcError } = await supabase.rpc('reject_withdrawal', {
        p_withdrawal_id: showRejectModal.id,
        p_reason: rejectionReason,
        p_admin_id: (await supabase.auth.getUser()).data.user?.id
      });

      if (rpcError) throw rpcError;
      if (rpcData && !rpcData.success) throw new Error(rpcData.message);

      setShowRejectModal(null);
      setRejectionReason('');
      await loadWithdrawals();
    } catch (error: any) {
      alert('Error al rechazar: ' + error.message);
    } finally {
      setProcessing(null);
    }
  };

  const submitComplete = async () => {
    if (!showCompleteModal || !txHash.trim()) return;

    setProcessing(showCompleteModal.id);
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('complete_withdrawal_atomic', {
        p_withdrawal_id: showCompleteModal.id,
        p_tx_hash: txHash,
        p_admin_id: (await supabase.auth.getUser()).data.user?.id
      });

      if (rpcError) throw rpcError;
      if (rpcData && !rpcData.success) throw new Error(rpcData.message);

      setShowCompleteModal(null);
      setTxHash('');
      await loadWithdrawals();
    } catch (error: any) {
      alert('Error al completar: ' + error.message);
    } finally {
      setProcessing(null);
    }
  };

  const getFilteredWithdrawals = () => {
    return withdrawals.filter(w => {
      const matchesFilter = filter === 'all' || w.status.toLowerCase() === filter.toLowerCase();
      const profile = w.profiles || {};
      const fullName = (profile as any)?.full_name || (profile as any)?.name || '';
      const email = (profile as any)?.email || '';
      const matchesSearch =
        fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.id.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  };

  const filtered = getFilteredWithdrawals();

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map(w => w.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const counts = {
    all: withdrawals.length,
    pending: withdrawals.filter(w => w.status.toLowerCase() === 'pending').length,
    approved: withdrawals.filter(w => w.status.toLowerCase() === 'approved').length,
    rejected: withdrawals.filter(w => w.status.toLowerCase() === 'rejected').length,
    completed: withdrawals.filter(w => w.status.toLowerCase() === 'completed').length,
  };

  const getTagStyles = (tag?: string) => {
    switch (tag) {
      case 'ADM': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'DEMO': return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
      case 'SYSTEM': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      default: return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'; // REAL
    }
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-700 max-w-[1600px] mx-auto">
      {loadError && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm font-bold text-rose-300">
          Error al cargar retiros: {loadError}
        </div>
      )}
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight flex items-center gap-4">
            <div className="p-3 bg-rose-500/10 rounded-2xl border border-rose-500/20">
              <ArrowUpCircle className="text-rose-500" size={32} />
            </div>
            Withdrawal Terminal
          </h1>
          <p className="text-slate-500 font-medium mt-2">Auditoría y procesamiento de egresos de capital del sistema.</p>
        </div>

        <div className="flex items-center space-x-4">
          {selectedIds.length > 0 && (
            <button
              onClick={handleBulkApprove}
              disabled={!!processing}
              className="bg-rose-600 hover:bg-rose-500 text-white px-6 py-4 rounded-3xl font-black uppercase text-[10px] tracking-widest shadow-[0_10px_30px_rgba(225,29,72,0.3)] flex items-center gap-3 animate-in zoom-in-95 scale-105"
            >
              <Send size={18} />
              APROBAR NÓMINA ({selectedIds.length})
            </button>
          )}

          <div className="relative group flex-1 md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-rose-500 transition-colors" size={20} />
            <input
              type="text"
              placeholder="Buscar retiro o usuario..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#111114] border border-slate-800 rounded-3xl py-4 pl-12 pr-6 text-white font-medium focus:ring-2 focus:ring-rose-500 outline-none transition-all shadow-2xl"
            />
          </div>
          <button
            onClick={loadWithdrawals}
            className="p-4 bg-[#111114] hover:bg-slate-800 text-slate-400 hover:text-white rounded-3xl transition-all active:scale-90 border border-slate-800 shadow-xl"
          >
            <RefreshCw size={24} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Stats and Filters */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="bg-[#111114] border border-slate-800/50 p-6 rounded-[2rem] shadow-xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Total Egresos</p>
            <p className="text-3xl font-black text-rose-500 tracking-tight tabular-nums">
              ${withdrawals.filter(w => ['approved', 'completed'].includes(w.status.toLowerCase())).reduce((sum, w) => sum + Number(w.amount), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="p-4 bg-rose-500/10 rounded-2xl text-rose-500 border border-rose-500/20">
            <ArrowUpCircle size={24} />
          </div>
        </div>

      </div>

      {/* Stats and Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-[#111114]/50 p-2 rounded-[2rem] border border-slate-800/50 shadow-inner w-fit">
        {(['all', 'pending', 'approved', 'rejected', 'completed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`
              flex items-center space-x-3 px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300
              ${filter === f
                ? 'bg-rose-600 text-white shadow-[0_10px_30px_rgba(225,29,72,0.3)]'
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

      {/* Main Table Container */}
      <div className="bg-[#111114] border border-slate-800/50 rounded-[3rem] overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/60 text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] border-b border-slate-800/50">
                <th className="px-10 py-6 w-16">
                  <button
                    onClick={toggleSelectAll}
                    className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${selectedIds.length === filtered.length ? 'bg-rose-500 border-rose-500 text-white' : 'border-slate-700 hover:border-rose-500'}`}
                  >
                    {selectedIds.length === filtered.length && <Check size={14} />}
                  </button>
                </th>
                <th className="px-10 py-6">Identidad</th>
                <th className="px-10 py-6 text-center">Egreso Neto</th>
                <th className="px-10 py-6 text-center">Wallet Destino</th>
                <th className="px-10 py-6 text-center">Estatus</th>
                <th className="px-10 py-6 text-right w-64">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/30">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-10 py-40 text-center">
                    <div className="flex flex-col items-center justify-center space-y-6">
                      <Loader2 className="animate-spin text-rose-500" size={48} />
                      <span className="text-slate-500 font-black uppercase text-xs tracking-[0.3em] animate-pulse">Sincronizando Solicitudes...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-10 py-32 text-center opacity-30 italic font-bold text-slate-600 font-mono">
                    CLEAN QUEUE: No hay retiros detectados.
                  </td>
                </tr>
              ) : filtered.map((w) => (
                <tr key={w.id} className={`group hover:bg-white/[0.02] transition-colors border-l-2 ${selectedIds.includes(w.id) ? 'border-l-rose-500 bg-rose-500/[0.01]' : 'border-l-transparent hover:border-l-rose-500'}`}>
                  <td className="px-10 py-8">
                    <button
                      onClick={() => toggleSelect(w.id)}
                      className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${selectedIds.includes(w.id) ? 'bg-rose-500 border-rose-500 text-white shadow-lg shadow-rose-600/20' : 'border-slate-700 hover:border-rose-500'}`}
                    >
                      {selectedIds.includes(w.id) && <Check size={14} />}
                    </button>
                  </td>
                  <td className="px-10 py-8">
                    <div className="flex items-center space-x-5">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 flex items-center justify-center text-xl font-black text-slate-400 group-hover:scale-105 transition-transform duration-500 shadow-xl">
                        {(w.profiles as any)?.full_name?.[0] || 'U'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-base font-black text-slate-100">{(w.profiles as any)?.full_name || 'System User'}</p>
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black border uppercase tracking-widest ${getTagStyles((w.profiles as any)?.user_tag)}`}>
                            {(w.profiles as any)?.user_tag || 'REAL'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-tight">{(w.profiles as any)?.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-10 py-8 text-center">
                    <div className="inline-block px-6 py-3 bg-rose-500/5 rounded-2xl border border-rose-500/10">
                      <p className="text-2xl font-black text-rose-500 tabular-nums">-${w.net_amount ? w.net_amount.toLocaleString('en-US', { minimumFractionDigits: 2 }) : w.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                      <p className="text-[9px] text-slate-600 font-black uppercase tracking-[0.2em] mt-1">Neto a Enviar</p>
                      {(w.fee || 0) > 0 && (
                        <p className="text-[8px] text-proyecto-gold font-bold uppercase tracking-widest mt-1">Fee Retenido: ${(w.fee || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                      )}
                      <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest mt-1">Bruto: ${w.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                    </div>
                  </td>
                  <td className="px-10 py-8 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-xl border border-slate-700/50 group/wallet">
                        <CreditCard size={14} className="text-slate-500" />
                        <span className="text-[10px] font-mono text-slate-400">
                          {w.wallet_address ? `${w.wallet_address.slice(0, 8)}...${w.wallet_address.slice(-8)}` : 'No Configurada'}
                        </span>
                        {w.wallet_address && (
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(w.wallet_address || '');
                              alert('Billetera copiada al portapapeles');
                            }}
                            className="text-slate-600 hover:text-white transition-colors p-1"
                          >
                            <ExternalLink size={12} />
                          </button>
                        )}
                      </div>
                      <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest">{w.method || 'Crypto Transfer'}</p>
                      {w.blockchain_tx_hash && (
                        <div className="flex items-center gap-1 text-[9px] text-emerald-500 font-mono">
                          <Hash size={10} />
                          <span>{w.blockchain_tx_hash.slice(0, 12)}...</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-10 py-8 text-center">
                    <StatusBadge status={w.status} />
                    <p className="text-[9px] text-slate-500 font-bold mt-2 uppercase tracking-widest leading-loose">
                      Solicitado el <br /> {new Date(w.created_at).toLocaleDateString()}
                    </p>
                    {w.rejection_reason && (
                      <div className="mt-2 p-2 bg-rose-500/5 rounded-lg border border-rose-500/10 max-w-[150px] mx-auto">
                        <p className="text-[8px] text-rose-400 font-medium italic">"{w.rejection_reason}"</p>
                      </div>
                    )}
                  </td>
                  <td className="px-10 py-8">
                    <div className="flex items-center justify-end gap-3">
                      {(w.status.toLowerCase() === 'pending') && (
                        <div className="flex items-center gap-3 animate-in slide-in-from-right-4">
                          <button
                            onClick={() => handleApprove(w)}
                            disabled={!!processing}
                            className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white px-5 py-3 rounded-2xl border border-emerald-500/20 transition-all duration-300 flex items-center gap-3 text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 disabled:opacity-50"
                          >
                            {processing === w.id ? <Loader2 size={16} className="animate-spin" /> : <ChevronRight size={16} />}
                            APROBAR
                          </button>
                          <button
                            onClick={() => setShowRejectModal(w)}
                            disabled={!!processing}
                            className="w-12 h-12 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-2xl border border-rose-500/20 transition-all duration-300 flex items-center justify-center shadow-lg active:scale-95 disabled:opacity-50"
                          >
                            <X size={24} />
                          </button>
                        </div>
                      )}

                      {(w.status.toLowerCase() === 'approved') && (
                        <div className="flex items-center gap-3 animate-in slide-in-from-right-4">
                          <button
                            onClick={() => setShowCompleteModal(w)}
                            disabled={!!processing}
                            className="bg-sky-500/10 hover:bg-sky-500 text-sky-500 hover:text-white px-5 py-3 rounded-2xl border border-sky-500/20 transition-all duration-300 flex items-center gap-3 text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 disabled:opacity-50"
                          >
                            {processing === w.id ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                            Marcar Enviado
                          </button>
                        </div>
                      )}

                      {(w.status.toLowerCase() === 'completed' || w.status.toLowerCase() === 'rejected') && (
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

      {/* REJECTION MODAL */}
      {showRejectModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowRejectModal(null)} />
          <div className="relative bg-[#111114] border border-slate-800 w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-8 border-b border-slate-800 flex items-center gap-4">
              <div className="p-3 bg-rose-500/10 rounded-2xl text-rose-500 font-bold">
                <MessageSquare size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">Rechazar Solicitud</h3>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Informar motivo al inversor</p>
              </div>
            </div>

            <div className="p-10 space-y-6">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Motivo del Rechazo</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Ej: Wallet incorrecta, falta verificación KYC, etc..."
                  className="w-full bg-[#09090b] border border-slate-800 rounded-2xl p-4 text-white text-sm outline-none focus:border-rose-500 transition-all min-h-[120px] resize-none"
                />
              </div>

              <div className="p-4 bg-rose-500/5 rounded-2xl border border-rose-500/10 flex gap-4">
                <AlertCircle size={20} className="text-rose-500 shrink-0" />
                <p className="text-[10px] text-rose-400 font-medium leading-relaxed">
                  IMPORTANTE: Al rechazar un retiro, el capital permanece en el historial del usuario como "REJECTED". Asegúrese de que el motivo sea claro.
                </p>
              </div>
            </div>

            <div className="p-8 bg-slate-900/50 border-t border-slate-800 flex gap-4">
              <button
                onClick={() => { setShowRejectModal(null); setRejectionReason(''); }}
                className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={submitReject}
                disabled={!rejectionReason.trim() || !!processing}
                className="flex-[2] py-4 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg shadow-rose-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {processing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Confirmar Rechazo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMPLETION MODAL */}
      {showCompleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowCompleteModal(null)} />
          <div className="relative bg-[#111114] border border-slate-800 w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-8 border-b border-slate-800 flex items-center gap-4">
              <div className="p-3 bg-sky-500/10 rounded-2xl text-sky-500 font-bold">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">Finalizar Desembolso</h3>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Registro de Hash Blockchain</p>
              </div>
            </div>

            <div className="p-10 space-y-6">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Transaction Hash (TXID)</label>
                <input
                  type="text"
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value)}
                  placeholder="Pegue aquí el hash de la transacción..."
                  className="w-full bg-[#09090b] border border-slate-800 rounded-2xl p-4 text-white text-sm outline-none focus:border-sky-500 transition-all font-mono"
                />
              </div>

              <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 flex gap-4 text-emerald-400">
                <Check size={20} className="shrink-0" />
                <p className="text-[10px] font-medium leading-relaxed uppercase tracking-widest">
                  Este paso ejecutará una operación atómica: validará el estado aprobado, registrará el TXID y cerrará el ledger del retiro. No uses un texto ficticio como hash.
                </p>
              </div>
            </div>

            <div className="p-8 bg-slate-900/50 border-t border-slate-800 flex gap-4">
              <button
                onClick={() => { setShowCompleteModal(null); setTxHash(''); }}
                className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all"
              >
                Volver
              </button>
              <button
                onClick={submitComplete}
                disabled={!txHash.trim() || !!processing}
                className="flex-[2] py-4 bg-sky-600 hover:bg-sky-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg shadow-sky-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {processing ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Actualizar Ledger
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Withdrawals;
