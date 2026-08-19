import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Investment } from '../types';
import StatusBadge from '../components/StatusBadge';
import {
  Plus,
  Search,
  RefreshCw,
  TrendingUp,
  Target,
  CheckCircle2,
  AlertCircle,
  Clock,
  User as UserIcon,
  ChevronRight,
  ShieldCheck,
  Zap,
  Info,
  Trash2,
  RotateCcw
} from 'lucide-react';

const Investments: React.FC = () => {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [plans, setPlans] = useState<{ id: string, name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [tableSearch, setTableSearch] = useState('');
  const [filter, setFilter] = useState<'ACTIVE' | 'COMPLETED' | 'ALL'>('ACTIVE');
  const [profiles, setProfiles] = useState<any[]>([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Delete confirmation modal
  const [deleteTarget, setDeleteTarget] = useState<Investment | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState(false);

  // Reset confirmation modal
  const [resetTarget, setResetTarget] = useState<Investment | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  const [newInvestment, setNewInvestment] = useState({
    userId: '',
    planId: '',
    amount: '',
    generateCommission: true
  });

  useEffect(() => {
    loadInvestments();
    loadProfiles();
    loadPlans();
  }, []);

  const loadInvestments = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: invData, error: invError } = await supabase
        .from('investments')
        .select('*')
        .order('created_at', { ascending: false });

      if (invError) throw invError;
      const rows = invData || [];

      // Enriquecer con perfiles en batch separado (evita fallos de RLS en JOIN)
      if (rows.length > 0) {
        // Only keep valid-looking UUIDs to prevent Supabase 22P02 errors
        const uniqueIds = [...new Set(rows.map((i: any) => i.user_id))].filter(id => id && typeof id === 'string' && id.length > 10);
        
        if (uniqueIds.length > 0) {
          const { data: profData, error: profError } = await supabase
            .from('profiles')
            .select('id, email, full_name, username, user_tag')
            .in('id', uniqueIds);

          if (profError) {
            console.error('Error fetching batch profiles in Investments:', profError);
          }

          const profMap: Record<string, any> = {};
          (profData || []).forEach((p: any) => { profMap[p.id] = p; });

          setInvestments(rows.map((inv: any) => ({
            ...inv,
            profiles: profMap[inv.user_id] || null,
          })));
        } else {
          setInvestments(rows);
        }
      } else {
        setInvestments([]);
      }
    } catch (err: any) {
      console.error('Investment Load Error:', err);
      setError("No se pudieron cargar los datos.");
    } finally {
      setLoading(false);
    }
  };

  const loadProfiles = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, email, full_name, user_tag')
      .order('full_name');
    setProfiles(data || []);
  };

  const loadPlans = async () => {
    const { data } = await supabase
      .from('plans')
      .select('id, name')
      .eq('status', 'active');
    setPlans(data || []);
  };

  const handleAuditCap = async () => {
    if (!confirm('¿Deseas auditar todas las inversiones? Los contratos que llegaron al 200% serán marcados como COMPLETADOS.')) return;

    setProcessing('audit');
    try {
      const activeInvests = investments.filter(i => i.status === 'ACTIVE');
      let completedCount = 0;

      for (const inv of activeInvests) {
        // Deep Audit: Recalculate from transaction ledger to catch commissions 
        // that might have missed the accumulated_earnings update.
        const { data: txs } = await supabase
          .from('transactions')
          .select('amount')
          .eq('user_id', inv.user_id)
          .in('type', ['DAILY_RETURN', 'REFERRAL_COMMISSION', 'WEEKLY_BONUS', 'bonus_weekly'])
          .gte('created_at', inv.created_at); // Only count earnings since this investment started

        const realEarnings = (txs || []).reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
        const threshold = inv.amount * 2;
        const isCompleted = realEarnings >= threshold;

        // If data is out of sync or threshold is hit, update the record
        if (realEarnings !== inv.accumulated_earnings || isCompleted) {
          const cappedEarnings = Math.min(realEarnings, threshold);
          const { error } = await supabase
            .from('investments')
            .update({
              accumulated_earnings: cappedEarnings,
              status: isCompleted ? 'COMPLETED' : 'ACTIVE',
              completed_at: isCompleted ? new Date().toISOString() : (inv.completed_at || null)
            })
            .eq('id', inv.id);

          if (!error && isCompleted) completedCount++;
        }
      }

      alert(`Auditoría finalizada.\n✅ Contratos saturados: ${completedCount}`);
      await loadInvestments();
    } catch (err: any) {
      alert('Error en auditoría: ' + err.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleCreateInvestment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const amount = parseFloat(newInvestment.amount);

    if (!newInvestment.userId || !newInvestment.planId || isNaN(amount) || amount < 5) {
      setError("Completa todos los campos correctamente. El monto mínimo es $5.");
      return;
    }

    setProcessing('create');
    try {
      const { error } = await supabase
        .from('investments')
        .insert([{
          user_id: newInvestment.userId,
          plan_id: newInvestment.planId,
          amount: amount,
          status: 'ACTIVE',
          accumulated_earnings: 0,
          is_referral_commission_paid: !newInvestment.generateCommission,
          created_at: new Date().toISOString()
        }]);

      if (error) throw error;

      setIsModalOpen(false);
      setNewInvestment({ userId: '', planId: '', amount: '', generateCommission: true });
      setSearchTerm('');
      await loadInvestments();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessing(null);
    }
  };
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setProcessing('delete');
    try {
      const { error } = await supabase
        .from('investments')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;
      await loadInvestments();
      setDeleteSuccess(true);
    } catch (err: any) {
      alert('Error al eliminar: ' + err.message);
      setDeleteTarget(null);
    } finally {
      setProcessing(null);
    }
  };

  const confirmReset = async () => {
    if (!resetTarget) return;
    setProcessing('reset');
    try {
      // Reset only the investment contract. User balances are never modified here.
      const { data: rpcData, error: rpcError } = await supabase.rpc('admin_reset_investment', {
        p_investment_id: resetTarget.id,
        p_admin_id: (await supabase.auth.getUser()).data.user?.id
      });

      if (rpcError) throw rpcError;
      if (rpcData && !rpcData.success) throw new Error(rpcData.message || 'No se pudo reiniciar la inversión.');

      await loadInvestments();
      setResetSuccess(true);
    } catch (err: any) {
      alert('Error al reiniciar: ' + err.message);
      setResetTarget(null);
    } finally {
      setProcessing(null);
    }
  };

  const handleReplaceInvestment = () => {
    if (!deleteTarget) return;
    const profile = (deleteTarget.profiles as any);
    const name = profile?.full_name || profile?.email || '';
    setSearchTerm(name);
    setNewInvestment({ userId: deleteTarget.user_id, planId: deleteTarget.plan_id || '', amount: '', generateCommission: true });
    setDeleteTarget(null);
    setDeleteSuccess(false);
    setIsModalOpen(true);
  };

  const getProgress = (inv: Investment) => {
    const target = inv.amount * 2;
    const progress = (inv.accumulated_earnings / target) * 100;
    return Math.min(progress, 100);
  };

  const filtered = investments.filter(i => {
    // Status normalization to ensure visibility regardless of casing in DB
    const currentStatus = (i.status || '').toUpperCase();
    const matchesFilter = filter === 'ALL' || currentStatus === filter;

    const profile = i.profiles as any;
    const searchLow = tableSearch.toLowerCase();

    const matchesSearch =
      (profile?.full_name?.toLowerCase().includes(searchLow)) ||
      (profile?.email?.toLowerCase().includes(searchLow)) ||
      (i.id.toLowerCase().includes(searchLow)) ||
      (i.user_id.toLowerCase().includes(searchLow));

    return matchesFilter && matchesSearch;
  });

  const filteredProfiles = profiles.filter(p =>
    p.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: investments.length,
    active: investments.filter(i => (i.status || '').toUpperCase() === 'ACTIVE').length,
    completed: investments.filter(i => (i.status || '').toUpperCase() === 'COMPLETED').length,
    totalCap: investments.reduce((sum, i) => sum + i.amount, 0)
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-700 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight flex items-center gap-4">
            <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
              <TrendingUp className="text-indigo-500" size={32} />
            </div>
            Investment Audit
          </h1>
          <p className="text-slate-500 font-medium mt-2">Monitoreo de capital y cumplimiento de Meta 200%.</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={handleAuditCap}
            disabled={!!processing}
            className="flex items-center gap-2 px-6 py-4 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-3xl font-black text-xs uppercase tracking-widest border border-slate-800 transition-all active:scale-95"
          >
            {processing === 'audit' ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
            Auditar 200% Cap
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-3 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-3xl font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-600/20 transition-all active:scale-95 translate-y-[-2px]"
          >
            <Plus size={20} />
            Nuevo Contrato
          </button>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Contratos', val: stats.total, icon: Clock, color: 'text-slate-400' },
          { label: 'Activos', val: stats.active, icon: Zap, color: 'text-emerald-500' },
          { label: 'Completados', val: stats.completed, icon: CheckCircle2, color: 'text-emerald-500' },
          { label: 'Capital Auditado', val: `$${stats.totalCap.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: Target, color: 'text-indigo-500' }
        ].map((s, i) => (
          <div key={i} className="bg-[#111114] border border-slate-800 p-6 rounded-[2rem] flex items-center justify-between shadow-xl">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">{s.label}</p>
              <p className={`text-3xl font-black ${s.color}`}>{s.val}</p>
            </div>
            <s.icon className={`opacity-20 ${s.color}`} size={40} />
          </div>
        ))}
      </div>

      {/* Tabs and Search */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3 bg-[#111114]/50 p-2 rounded-[2rem] border border-slate-800/50 shadow-inner">
          {(['ACTIVE', 'COMPLETED', 'ALL'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`
                px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300
                ${filter === t
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800'
                }
              `}
            >
              {t === 'ACTIVE' ? 'Activos' : t === 'COMPLETED' ? 'Completados' : 'Historial Global'}
            </button>
          ))}
        </div>

        <div className="relative group w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-500 transition-colors" size={20} />
          <input
            type="text"
            placeholder="Buscar inversor..."
            value={tableSearch}
            onChange={(e) => setTableSearch(e.target.value)}
            className="w-full bg-[#111114] border border-slate-800 rounded-3xl py-4 pl-12 pr-6 text-white font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-2xl"
          />
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-[#111114] border border-slate-800/50 rounded-[3rem] overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/60 text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] border-b border-slate-800/50">
                <th className="px-10 py-6">Inversor & Progreso</th>
                <th className="px-10 py-6 text-center">Capital / Objetivo 200%</th>
                <th className="px-10 py-6 text-center">Beneficio Generado</th>
                <th className="px-10 py-6 text-center">Estado</th>
                <th className="px-10 py-6 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/30">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-10 py-40 text-center">
                    <div className="flex flex-col items-center justify-center space-y-6">
                      <RefreshCw className="animate-spin text-indigo-500" size={48} />
                      <span className="text-slate-500 font-black uppercase text-xs tracking-[0.3em] animate-pulse">Sincronizando Ledger...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-10 py-32 text-center opacity-30 italic font-bold text-slate-600 font-mono">
                    NO ACTIVE CONTRACTS: No hay inversiones bajo este filtro.
                  </td>
                </tr>
              ) : filtered.map((inv) => {
                const progress = getProgress(inv);
                const falta = (inv.amount * 2) - inv.accumulated_earnings;

                return (
                  <tr key={inv.id} className="group hover:bg-white/[0.02] transition-colors">
                    <td className="px-10 py-8">
                      <div className="flex items-center space-x-6 min-w-[300px]">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-indigo-500/5 border border-indigo-500/20 flex items-center justify-center text-xl font-black text-indigo-400 group-hover:scale-105 transition-all duration-500 shadow-xl">
                          {(inv.profiles as any)?.full_name?.[0] || 'U'}
                        </div>
                        <div className="flex-1 space-y-3">
                          <div>
                            <p className="text-base font-black text-slate-100 italic">{(inv.profiles as any)?.full_name || 'System User'}</p>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">{(inv.profiles as any)?.email}</p>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                              <span>ROI Progress</span>
                              <span className={progress >= 100 ? 'text-rose-500' : 'text-indigo-400'}>{progress.toFixed(1)}% / 200%</span>
                            </div>
                            <div className="h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
                              <div
                                className={`h-full transition-all duration-1000 ${progress >= 100 ? 'bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.5)]' : 'bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]'}`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-8 text-center">
                      <div className="inline-block p-4 bg-slate-900/50 rounded-2xl border border-slate-800">
                        <p className="text-2xl font-black text-white tabular-nums">${inv.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">META: ${(inv.amount * 2).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      </div>
                    </td>
                    <td className="px-10 py-8 text-center">
                      <div className="space-y-1">
                        <p className="text-2xl font-black text-emerald-500 tabular-nums">${inv.accumulated_earnings.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                        <p className={`text-[10px] font-black uppercase tracking-widest ${falta <= 0 ? 'text-emerald-500' : 'text-slate-600'}`}>
                          {falta <= 0 ? 'META COMPLETADA' : `FALTA: $${falta.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                        </p>
                      </div>
                    </td>
                    <td className="px-10 py-8 text-center">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-10 py-8 text-right">
                      <div className="flex flex-col items-end gap-2">
                        <p className="text-sm font-black text-slate-400 font-mono tracking-tighter">#{inv.id.slice(0, 8).toUpperCase()}</p>
                        <div className="flex items-center gap-3">
                          <p className="text-[10px] text-slate-600 font-bold uppercase">{new Date(inv.created_at).toLocaleDateString()}</p>
                          <button
                            onClick={() => { setResetTarget(inv); setResetSuccess(false); }}
                            className="p-2 text-slate-600 hover:text-amber-500 hover:bg-amber-500/10 rounded-lg transition-all"
                            title="Reiniciar Inversión al 0%"
                          >
                            <RotateCcw size={16} />
                          </button>
                          <button
                            onClick={() => { setDeleteTarget(inv); setDeleteSuccess(false); }}
                            className="p-2 text-slate-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                            title="Eliminar / Reemplazar Inversión"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* RESET MODAL */}
      {resetTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => { setResetTarget(null); setResetSuccess(false); }} />
          <div className="relative bg-[#111114] border border-slate-800 w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95">

            {!resetSuccess ? (
              <>
                <div className="p-7 border-b border-slate-800 flex items-center gap-4">
                  <div className="p-3 bg-amber-500/10 rounded-2xl">
                    <RotateCcw size={22} className="text-amber-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white uppercase tracking-tight">Reiniciar Inversión</h3>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Ganancias, balance y wallet → $0</p>
                  </div>
                  <button onClick={() => setResetTarget(null)} className="ml-auto p-2 hover:bg-slate-800 rounded-xl text-slate-500 hover:text-white transition-colors">
                    <X size={20} />
                  </button>
                </div>

                <div className="p-7 space-y-5">
                  <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center font-black text-amber-400 text-lg">
                        {(resetTarget.profiles as any)?.full_name?.[0] || 'U'}
                      </div>
                      <div>
                        <p className="text-sm font-black text-white">{(resetTarget.profiles as any)?.full_name || 'Usuario'}</p>
                        <p className="text-[10px] text-slate-500 font-bold">{(resetTarget.profiles as any)?.email}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 pt-2">
                      <div className="text-center bg-black/30 rounded-xl p-3">
                        <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Capital</p>
                        <p className="text-lg font-black text-white">${resetTarget.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div className="text-center bg-black/30 rounded-xl p-3">
                        <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Ganado</p>
                        <p className="text-lg font-black text-emerald-400">${resetTarget.accumulated_earnings.toLocaleString('en-US', { maximumFractionDigits: 2 })}</p>
                      </div>
                      <div className="text-center bg-black/30 rounded-xl p-3">
                        <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Estado</p>
                        <StatusBadge status={resetTarget.status} />
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-amber-500/5 rounded-2xl border border-amber-500/10 flex gap-3 text-amber-500">
                    <AlertCircle size={18} className="shrink-0 mt-0.5" />
                    <p className="text-[10px] font-bold leading-relaxed">
                      Esto reiniciará únicamente las ganancias del contrato a $0 y lo reactivará desde hoy. El Wallet Bank y el Credit Balance del usuario no serán modificados.
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setResetTarget(null)}
                      className="flex-1 py-4 border border-slate-800 rounded-2xl text-slate-400 hover:text-white hover:border-slate-700 font-black text-xs uppercase tracking-widest transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={confirmReset}
                      disabled={processing === 'reset'}
                      className="flex-1 py-4 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-600/20"
                    >
                      {processing === 'reset'
                        ? <><RefreshCw size={14} className="animate-spin" /> Reiniciando...</>
                        : <><RotateCcw size={14} /> Reiniciar al 0%</>
                      }
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-10 text-center space-y-6">
                <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto">
                  <CheckCircle2 size={32} className="text-amber-400" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-tight mb-2">Inversión Reiniciada</h3>
                  <p className="text-sm text-slate-500">Ganancias, balance y wallet han sido reseteados a $0. La inversión arranca desde hoy.</p>
                </div>
                <button
                  onClick={() => { setResetTarget(null); setResetSuccess(false); }}
                  className="w-full py-4 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
                >
                  Cerrar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DELETE / REPLACE MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => { setDeleteTarget(null); setDeleteSuccess(false); }} />
          <div className="relative bg-[#111114] border border-slate-800 w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95">

            {!deleteSuccess ? (
              <>
                {/* Header */}
                <div className="p-7 border-b border-slate-800 flex items-center gap-4">
                  <div className="p-3 bg-rose-500/10 rounded-2xl">
                    <Trash2 size={22} className="text-rose-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white uppercase tracking-tight">Eliminar Inversión</h3>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Esta acción es irreversible</p>
                  </div>
                  <button onClick={() => setDeleteTarget(null)} className="ml-auto p-2 hover:bg-slate-800 rounded-xl text-slate-500 hover:text-white transition-colors">
                    <X size={20} />
                  </button>
                </div>

                {/* Investment details */}
                <div className="p-7 space-y-5">
                  <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center font-black text-indigo-400 text-lg">
                        {(deleteTarget.profiles as any)?.full_name?.[0] || 'U'}
                      </div>
                      <div>
                        <p className="text-sm font-black text-white">{(deleteTarget.profiles as any)?.full_name || 'Usuario'}</p>
                        <p className="text-[10px] text-slate-500 font-bold">{(deleteTarget.profiles as any)?.email}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 pt-2">
                      <div className="text-center bg-black/30 rounded-xl p-3">
                        <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Capital</p>
                        <p className="text-lg font-black text-white">${deleteTarget.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      </div>
                      <div className="text-center bg-black/30 rounded-xl p-3">
                        <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Ganado</p>
                        <p className="text-lg font-black text-emerald-400">${deleteTarget.accumulated_earnings.toLocaleString('en-US', { maximumFractionDigits: 2 })}</p>
                      </div>
                      <div className="text-center bg-black/30 rounded-xl p-3">
                        <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Estado</p>
                        <StatusBadge status={deleteTarget.status} />
                      </div>
                    </div>
                    <p className="text-[9px] text-slate-600 font-mono text-center">#{deleteTarget.id.slice(0, 16).toUpperCase()}</p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setDeleteTarget(null)}
                      className="flex-1 py-4 border border-slate-800 rounded-2xl text-slate-400 hover:text-white hover:border-slate-700 font-black text-xs uppercase tracking-widest transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={confirmDelete}
                      disabled={processing === 'delete'}
                      className="flex-1 py-4 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-600/20"
                    >
                      {processing === 'delete'
                        ? <><RefreshCw size={14} className="animate-spin" /> Eliminando...</>
                        : <><Trash2 size={14} /> Eliminar</>
                      }
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Success state */}
                <div className="p-10 text-center space-y-6">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
                    <CheckCircle2 size={32} className="text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white uppercase tracking-tight mb-2">Inversión Eliminada</h3>
                    <p className="text-sm text-slate-500">¿Deseas crear una nueva inversión para este usuario?</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => { setDeleteTarget(null); setDeleteSuccess(false); }}
                      className="py-4 border border-slate-800 rounded-2xl text-slate-400 hover:text-white hover:border-slate-700 font-black text-xs uppercase tracking-widest transition-all"
                    >
                      No, cerrar
                    </button>
                    <button
                      onClick={handleReplaceInvestment}
                      className="py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
                    >
                      <Plus size={14} /> Nueva Inversión
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* NEW CONTRACT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-[#111114] border border-slate-800 w-full max-w-lg rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-8 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-500">
                  <TrendingUp size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">Emitir Contrato ROI</h3>
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Inyección manual de capital</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-slate-500 hover:text-white">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleCreateInvestment} className="p-10 space-y-6">
              <div className="space-y-4 relative">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inversor Objetivo</label>
                <div className="relative group">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-500" size={18} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setShowUserDropdown(true);
                      if (!e.target.value) setNewInvestment({ ...newInvestment, userId: '' });
                    }}
                    onFocus={() => setShowUserDropdown(true)}
                    placeholder="Buscar por ID, Nombre o Email..."
                    className="w-full bg-[#09090b] border border-slate-800 rounded-2xl py-4 pl-12 pr-6 text-white text-sm outline-none focus:border-indigo-500 transition-all"
                  />
                  {newInvestment.userId && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                      <CheckCircle2 size={12} className="text-emerald-500" />
                      <span className="text-[9px] font-black text-emerald-500 uppercase">Selected</span>
                    </div>
                  )}
                </div>

                {showUserDropdown && searchTerm && (
                  <div className="absolute z-[110] w-full mt-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl max-h-48 overflow-y-auto">
                    {filteredProfiles.length > 0 ? filteredProfiles.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setNewInvestment({ ...newInvestment, userId: p.id });
                          setSearchTerm(p.full_name || p.email);
                          setShowUserDropdown(false);
                        }}
                        className="w-full text-left p-4 hover:bg-indigo-600/10 border-b border-slate-800 last:border-0 transition-colors flex items-center justify-between group"
                      >
                        <div>
                          <p className="text-sm font-black text-white italic">{p.full_name}</p>
                          <p className="text-[10px] text-slate-500 font-bold">{p.email}</p>
                        </div>
                        <ChevronRight size={16} className="text-slate-700 group-hover:text-indigo-400" />
                      </button>
                    )) : (
                      <div className="p-4 text-center text-slate-500 text-xs italic">Usuario no encontrado</div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estrategia ROI</label>
                  <select
                    value={newInvestment.planId}
                    onChange={(e) => setNewInvestment({ ...newInvestment, planId: e.target.value })}
                    className="w-full bg-[#09090b] border border-slate-800 rounded-2xl p-4 text-white text-sm outline-none focus:border-indigo-500 transition-all appearance-none"
                  >
                    <option value="">-- Elige Estrategia --</option>
                    {plans.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Capital US$</label>
                  <input
                    type="number"
                    value={newInvestment.amount}
                    onChange={(e) => setNewInvestment({ ...newInvestment, amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full bg-[#09090b] border border-slate-800 rounded-2xl p-4 text-white text-lg font-black outline-none focus:border-indigo-500 transition-all font-mono"
                  />
                </div>
              </div>

              <div className="bg-slate-900/50 p-6 rounded-[2rem] border border-slate-800 flex items-center justify-between group cursor-pointer"
                onClick={() => setNewInvestment({ ...newInvestment, generateCommission: !newInvestment.generateCommission })}>
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-xl transition-colors ${newInvestment.generateCommission ? 'bg-indigo-500/10 text-indigo-500' : 'bg-slate-800 text-slate-500'}`}>
                    <Zap size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-white uppercase">Generar Comisión</p>
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Bono de referido para el Upline</p>
                  </div>
                </div>
                <div className={`w-12 h-6 rounded-full transition-all flex items-center px-1 ${newInvestment.generateCommission ? 'bg-indigo-600' : 'bg-slate-700'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full transition-all transform ${newInvestment.generateCommission ? 'translate-x-6' : 'translate-x-0'}`} />
                </div>
              </div>

              {error && (
                <div className="p-4 bg-rose-500/5 rounded-2xl border border-rose-500/10 flex gap-3 text-rose-500">
                  <AlertCircle size={18} className="shrink-0" />
                  <p className="text-[10px] font-bold leading-relaxed">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={!!processing}
                className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-3xl font-black uppercase text-xs tracking-[0.2em] transition-all shadow-xl shadow-indigo-600/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {processing === 'create' ? <RefreshCw size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                Vincular Inversión
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const Loader2: React.FC<{ size?: number; className?: string }> = ({ size = 24, className }) => (
  <RefreshCw size={size} className={`animate-spin ${className}`} />
);

const X: React.FC<{ size?: number; className?: string }> = ({ size = 24, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

export default Investments;
