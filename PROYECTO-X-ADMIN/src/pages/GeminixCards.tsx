import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Withdrawal } from '../types';
import StatusBadge from '../components/StatusBadge';
import {
  CreditCard,
  RefreshCw,
  Search,
  Check,
  X,
  Loader2,
  Calendar,
  User as UserIcon,
  Hash,
  MessageSquare,
  AlertCircle,
  ShieldCheck,
  ExternalLink,
  ChevronRight,
  Send,
  ArrowUpRight,
  TrendingDown,
  PieChart
} from 'lucide-react';

const GeminixCards: React.FC = () => {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [registeredUsers, setRegisteredUsers] = useState<any[]>([]);
  const [viewTab, setViewTab] = useState<'terminal' | 'registry'>('terminal');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'completed'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [showRejectModal, setShowRejectModal] = useState<Withdrawal | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const [showCompleteModal, setShowCompleteModal] = useState<Withdrawal | null>(null);
  const [txHash, setTxHash] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Filtrar por método 'GEMINIX CARD'
      const { data, error } = await supabase
        .from('withdrawals')
        .select(`
          *,
          profiles:user_id (
            id,
            email,
            name,
            full_name,
            user_tag
          )
        `)
        .eq('method', 'GEMINIX CARD')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWithdrawals(data || []);

      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('*')
        .not('geminix_card_address', 'is', null)
        .order('created_at', { ascending: false });
        
      if (usersError) throw usersError;
      setRegisteredUsers(usersData || []);

    } catch (error: any) {
      console.error('Error loading card withdrawals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (withdrawal: Withdrawal) => {
    if (!confirm(`¿APROBAR DESEMBOLSO A TARJETA? Se procesarán $${withdrawal.amount} para este usuario.`)) return;

    setProcessing(withdrawal.id);
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('process_withdrawal_approval', {
        p_withdrawal_id: withdrawal.id,
        p_admin_id: (await supabase.auth.getUser()).data.user?.id
      });

      if (rpcError) throw rpcError;
      if (rpcData && !rpcData.success) throw new Error(rpcData.message);

      await loadData();
    } catch (error: any) {
      console.error('Error approving withdrawal:', error);
      alert('Error en aprobación: ' + error.message);
    } finally {
      setProcessing(null);
    }
  };

  const submitReject = async () => {
    if (!showRejectModal || !rejectionReason.trim()) return;

    setProcessing(showRejectModal.id);
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('reject_withdrawal', {
        p_withdrawal_id: showRejectModal.id,
        p_reason: rejectionReason,
        p_admin_id: (await supabase.auth.getUser()).data.user?.id
      });

      if (rpcError) throw rpcError;
      if (rpcData && !rpcData.success) throw new Error(rpcData.message);

      setShowRejectModal(null);
      setRejectionReason('');
      await loadData();
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
      const { data: rpcData, error: rpcError } = await supabase.rpc('complete_withdrawal', {
        p_withdrawal_id: showCompleteModal.id,
        p_tx_hash: txHash,
        p_admin_id: (await supabase.auth.getUser()).data.user?.id
      });

      if (rpcError) throw rpcError;
      if (rpcData && !rpcData.success) throw new Error(rpcData.message);

      setShowCompleteModal(null);
      setTxHash('');
      await loadData();
    } catch (error: any) {
      alert('Error al completar: ' + error.message);
    } finally {
      setProcessing(null);
    }
  };

  const filtered = withdrawals.filter(w => {
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

  const totals = {
    processed: withdrawals.filter(w => w.status === 'COMPLETED').reduce((sum, w) => sum + Number(w.amount), 0),
    pending: withdrawals.filter(w => w.status === 'PENDING').reduce((sum, w) => sum + Number(w.amount), 0),
    savings: withdrawals.filter(w => ['APPROVED', 'COMPLETED'].includes(w.status.toUpperCase())).reduce((sum, w) => sum + (Number(w.amount) * 0.07), 0), // 7% saving calculation
    count: withdrawals.length
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-700 max-w-[1600px] mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight flex items-center gap-4">
            <div className="p-3 bg-geminix-accent/10 rounded-2xl border border-geminix-accent/20 shadow-[0_0_20px_rgba(0,243,255,0.1)]">
              <CreditCard className="text-geminix-accent" size={32} />
            </div>
            GEMINIX CARD Terminal
          </h1>
          <p className="text-slate-500 font-medium mt-2">Gestión exclusiva de desembolsos a tarjetas corporativas Geminix.</p>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex bg-[#111114] border border-slate-800 rounded-3xl overflow-hidden p-1 mr-2 shadow-xl">
            <button
              onClick={() => setViewTab('terminal')}
              className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${viewTab === 'terminal' ? 'bg-geminix-accent text-slate-950 shadow-lg' : 'text-slate-500 hover:text-white'}`}
            >
              Terminal
            </button>
            <button
              onClick={() => setViewTab('registry')}
              className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${viewTab === 'registry' ? 'bg-geminix-accent text-slate-950 shadow-lg' : 'text-slate-500 hover:text-white'}`}
            >
              Directorio
            </button>
          </div>

          <div className="relative group flex-1 md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-geminix-accent transition-colors" size={20} />
            <input
              type="text"
              placeholder="Buscar tarjeta o usuario..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#111114] border border-slate-800 rounded-3xl py-4 pl-12 pr-6 text-white font-medium focus:ring-2 focus:ring-geminix-accent outline-none transition-all shadow-2xl"
            />
          </div>
          <button
            onClick={loadData}
            className="p-4 bg-[#111114] hover:bg-slate-800 text-slate-400 hover:text-white rounded-3xl transition-all active:scale-90 border border-slate-800 shadow-xl"
          >
            <RefreshCw size={24} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {viewTab === 'terminal' ? (
        <>
          {/* Metrics Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-[#111114] border border-slate-800/50 p-6 rounded-[2rem] shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <PieChart size={64} className="text-geminix-accent" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Total Procesado</p>
          <p className="text-3xl font-black text-white tabular-nums">${totals.processed.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          <p className="text-[9px] text-emerald-500 font-bold mt-2 uppercase tracking-tight flex items-center gap-1">
            <Check size={10} /> {withdrawals.filter(w => w.status === 'COMPLETED').length} transacciones exitosas
          </p>
        </div>

        <div className="bg-[#111114] border border-slate-800/50 p-6 rounded-[2rem] shadow-xl relative overflow-hidden group border-l-geminix-gold/30">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <RefreshCw size={64} className="text-geminix-gold" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Pendiente por Pagar</p>
          <p className="text-3xl font-black text-geminix-gold tabular-nums">${totals.pending.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          <p className="text-[9px] text-slate-400 font-bold mt-2 uppercase tracking-tight">
            {withdrawals.filter(w => w.status === 'PENDING').length} solicitudes en espera
          </p>
        </div>

        <div className="bg-[#111114] border border-slate-800/50 p-6 rounded-[2rem] shadow-xl relative overflow-hidden group border-l-geminix-accent/30">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <TrendingDown size={64} className="text-geminix-accent" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Ahorro en Comisiones</p>
          <p className="text-3xl font-black text-geminix-accent tracking-tighter tabular-nums">${totals.savings.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          <p className="text-[9px] text-slate-400 font-bold mt-2 uppercase tracking-tight">7% de ahorro vs USDT Standard</p>
        </div>

        <div className="bg-[#111114] border border-slate-800/50 p-6 rounded-[2rem] shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <UserIcon size={64} className="text-blue-500" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Usuarios con Tarjeta</p>
          <p className="text-3xl font-black text-white tabular-nums">{new Set(withdrawals.map(w => w.user_id)).size}</p>
          <p className="text-[9px] text-slate-400 font-bold mt-2 uppercase tracking-tight">Inversores utilizando el producto</p>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-[#111114] border border-slate-800/50 rounded-[3rem] overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/60 text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] border-b border-slate-800/50">
                <th className="px-10 py-6">Identidad</th>
                <th className="px-10 py-6 text-center">Neto a Tarjeta</th>
                <th className="px-10 py-6 text-center">Dirección BSC</th>
                <th className="px-10 py-6 text-center">Estatus</th>
                <th className="px-10 py-6 text-right w-64">Operaciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/30">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-10 py-40 text-center">
                    <div className="flex flex-col items-center justify-center space-y-6">
                      <Loader2 className="animate-spin text-geminix-accent" size={48} />
                      <span className="text-slate-500 font-black uppercase text-xs tracking-[0.3em] animate-pulse">Sincronizando Tarjetas...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-10 py-32 text-center opacity-30 italic font-bold text-slate-600 font-mono">
                    TERMINAL VACÍA: No hay solicitudes de tarjeta.
                  </td>
                </tr>
              ) : filtered.map((w) => (
                <tr key={w.id} className="group hover:bg-white/[0.02] transition-colors border-l-2 border-l-transparent hover:border-l-geminix-accent">
                  <td className="px-10 py-8">
                    <div className="flex items-center space-x-5">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 flex items-center justify-center text-xl font-black text-slate-400 group-hover:scale-105 transition-transform duration-500 shadow-xl">
                        {(w.profiles as any)?.full_name?.[0] || 'U'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-base font-black text-slate-100">{(w.profiles as any)?.full_name || 'System User'}</p>
                        </div>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-tight">{(w.profiles as any)?.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-10 py-8 text-center">
                    <div className="inline-block px-6 py-3 bg-geminix-accent/5 rounded-2xl border border-geminix-accent/10">
                      <p className="text-2xl font-black text-geminix-accent tabular-nums">-${w.net_amount?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                      <p className="text-[9px] text-slate-600 font-black uppercase tracking-[0.2em] mt-1">Neto a Desembolsar</p>
                      <p className="text-[8px] text-emerald-500 font-bold uppercase tracking-widest mt-1">Comisión: 3%</p>
                    </div>
                  </td>
                  <td className="px-10 py-8 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-xl border border-slate-700/50">
                        <ArrowUpRight size={14} className="text-slate-500" />
                        <span className="text-[10px] font-mono text-slate-400">
                          {w.wallet_address ? `${w.wallet_address.slice(0, 10)}...${w.wallet_address.slice(-10)}` : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-10 py-8 text-center">
                    <StatusBadge status={w.status} />
                    <p className="text-[8px] text-slate-500 font-bold mt-2 uppercase tracking-widest leading-loose">
                      {new Date(w.created_at).toLocaleString()}
                    </p>
                  </td>
                  <td className="px-10 py-8">
                    <div className="flex items-center justify-end gap-3">
                      {(w.status.toLowerCase() === 'pending') && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleApprove(w)}
                            disabled={!!processing}
                            className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white px-5 py-3 rounded-2xl border border-emerald-500/20 transition-all duration-300 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest active:scale-95 disabled:opacity-50"
                          >
                            {processing === w.id ? <Loader2 size={16} className="animate-spin" /> : <ChevronRight size={16} />}
                            PROCESAR
                          </button>
                          <button
                            onClick={() => setShowRejectModal(w)}
                            disabled={!!processing}
                            className="w-12 h-12 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-2xl border border-rose-500/20 transition-all active:scale-95 flex items-center justify-center"
                          >
                            <X size={20} />
                          </button>
                        </div>
                      )}

                      {(w.status.toLowerCase() === 'approved') && (
                        <button
                          onClick={() => setShowCompleteModal(w)}
                          disabled={!!processing}
                          className="bg-geminix-accent/10 hover:bg-geminix-accent text-geminix-accent hover:text-slate-950 px-5 py-3 rounded-2xl border border-geminix-accent/20 transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                        >
                          <ShieldCheck size={16} />
                          COMPLETAR ENVÍO
                        </button>
                      )}

                      {(['completed', 'rejected'].includes(w.status.toLowerCase())) && (
                        <div className="px-4 py-2 bg-slate-800/20 rounded-xl text-slate-600 border border-slate-800/50">
                          <Check size={16} />
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
      </>
      ) : (
      <div className="bg-[#111114] border border-slate-800/50 rounded-[3rem] overflow-hidden shadow-2xl mb-8 animate-in fade-in duration-500">
        <div className="p-8 border-b border-slate-800/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-white">Directorio de Usuarios</h2>
            <p className="text-slate-500 font-medium text-sm mt-1">Usuarios que han vinculado la Geminix Card.</p>
          </div>
          <div className="bg-slate-900/50 px-6 py-3 rounded-2xl border border-slate-800 flex items-center gap-3">
            <UserIcon size={18} className="text-geminix-accent" />
            <div>
              <span className="block text-[10px] font-black tracking-widest uppercase text-slate-500">Tarjetas Activas</span>
              <span className="block text-lg font-black text-white leading-none mt-1">{registeredUsers.length}</span>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/60 text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] border-b border-slate-800/50">
                <th className="px-10 py-6">Identidad</th>
                <th className="px-10 py-6 text-left">Geminix Card (Bancus)</th>
                <th className="px-10 py-6 text-center">Registro</th>
                <th className="px-10 py-6 text-right">Estatus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/30">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-10 py-40 text-center">
                    <div className="flex flex-col items-center justify-center space-y-6">
                      <Loader2 className="animate-spin text-geminix-accent" size={48} />
                      <span className="text-slate-500 font-black uppercase text-xs tracking-[0.3em] animate-pulse">Sincronizando Directorio...</span>
                    </div>
                  </td>
                </tr>
              ) : registeredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-10 py-32 text-center opacity-30 italic font-bold text-slate-600 font-mono">
                    DIRECTORIO VACÍO: Ningún usuario ha vinculado su tarjeta.
                  </td>
                </tr>
              ) : registeredUsers.map((user) => (
                <tr key={user.id} className="group hover:bg-white/[0.02] transition-colors border-l-2 border-l-transparent hover:border-l-geminix-accent">
                  <td className="px-10 py-8">
                    <div className="flex items-center space-x-5">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 flex items-center justify-center text-xl font-black text-slate-400 group-hover:scale-105 transition-transform duration-500 shadow-xl">
                        {user.full_name?.[0]?.toUpperCase() || user.username?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-base font-black text-slate-100">{user.full_name || user.username || 'Usuario del Sistema'}</p>
                        </div>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-tight">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-10 py-8">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 px-4 py-3 bg-geminix-accent/5 rounded-xl border border-geminix-accent/10 w-max">
                        <CreditCard size={14} className="text-geminix-accent" />
                        <span className="text-xs font-mono text-geminix-accent">
                          {user.geminix_card_user || 'Sin Bancus ID'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-xl border border-slate-700/50 w-max">
                        <ArrowUpRight size={14} className="text-slate-500" />
                        <span className="text-[10px] font-mono text-slate-400">
                          {user.geminix_card_address || 'Sin Dirección BSC'}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-10 py-8 text-center">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                      {new Date(user.created_at || new Date()).toLocaleDateString()}
                    </p>
                  </td>
                  <td className="px-10 py-8 text-right">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-500 rounded-xl border border-emerald-500/20 text-[10px] font-black uppercase tracking-widest">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      VINCULADA
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {viewTab === 'terminal' && showRejectModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowRejectModal(null)} />
          <div className="relative bg-[#111114] border border-slate-800 w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-8 border-b border-slate-800 flex items-center gap-4">
              <div className="p-3 bg-rose-500/10 rounded-2xl text-rose-500 font-bold">
                <MessageSquare size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">Rechazar Operación</h3>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Informar al usuario Geminix</p>
              </div>
            </div>

            <div className="p-10 space-y-6">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Motivo</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Detalla el motivo del rechazo..."
                  className="w-full bg-[#09090b] border border-slate-800 rounded-2xl p-4 text-white text-sm outline-none focus:border-rose-500 transition-all min-h-[120px] resize-none"
                />
              </div>
            </div>

            <div className="p-8 bg-slate-900/50 border-t border-slate-800 flex gap-4">
              <button
                onClick={() => { setShowRejectModal(null); setRejectionReason(''); }}
                className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all"
              >
                Volver
              </button>
              <button
                onClick={submitReject}
                disabled={!rejectionReason.trim() || !!processing}
                className="flex-[2] py-4 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-2"
              >
                {processing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {viewTab === 'terminal' && showCompleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowCompleteModal(null)} />
          <div className="relative bg-[#111114] border border-slate-800 w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-8 border-b border-slate-800 flex items-center gap-4">
              <div className="p-3 bg-geminix-accent/10 rounded-2xl text-geminix-accent font-bold">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">Finalizar Desembolso</h3>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Registro de Hash Blockchain (BSC)</p>
              </div>
            </div>

            <div className="p-10 space-y-6">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Transaction Hash (BNB Smart Chain)</label>
                <input
                  type="text"
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value)}
                  placeholder="Hash de la transacción BSC..."
                  className="w-full bg-[#09090b] border border-slate-800 rounded-2xl p-4 text-white text-sm outline-none focus:border-geminix-accent transition-all font-mono"
                />
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
                className="flex-[2] py-4 bg-geminix-accent hover:bg-cyan-400 text-slate-950 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all"
              >
                {processing ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Confirmar Envío
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GeminixCards;
