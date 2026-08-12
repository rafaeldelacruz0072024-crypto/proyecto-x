import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { createClient } from '@supabase/supabase-js';
import {
  Cpu,
  Activity,
  TrendingUp,
  Target,
  RefreshCw,
  AlertCircle,
  History,
  ArrowUpRight,
  Calendar,
  Layers,
  Zap,
  ShieldCheck,
  Search,
  X,
  Calculator,
  LayoutDashboard,
  CheckSquare,
  Square
} from 'lucide-react';

const getTagStyles = (tag?: string | null) => {
  switch (tag) {
    case 'ADM':    return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
    case 'DEMO':   return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
    case 'SYSTEM': return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    default:       return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  }
};

const RoiEngine: React.FC = () => {
  const [executing, setExecuting] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [investments, setInvestments] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [todaysTransactions, setTodaysTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastExecution, setLastExecution] = useState<string | null>(null);
  const [totalPaidToday, setTotalPaidToday] = useState(0);
  const [selectedContracts, setSelectedContracts] = useState<string[]>([]);

  // Audit Modal States
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditPreview, setAuditPreview] = useState<any>({
    items: [],
    totalROI: 0,
    saturatedCount: 0
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // 1. Fetch ALL Investments + Plans, then enrich profiles via RPC (bypasses RLS)
      const { data: invData, error: invError } = await supabase
        .from('investments')
        .select('*, plans:plan_id ( roi_percentage )');

      if (invError) throw invError;
      const invRows = invData || [];

      if (invRows.length > 0) {
        const uniqueInvIds = [...new Set(invRows.map((i: any) => i.user_id))].filter(id => id && typeof id === 'string' && id.length > 10);
        
        if (uniqueInvIds.length > 0) {
          const { data: invProfiles, error: invProfError } = await supabase
            .from('profiles')
            .select('id, email, full_name, username, user_tag, roi_blocked')
            .in('id', uniqueInvIds);
            
          if (invProfError) console.error('Error fetching invProfiles:', invProfError);

          const invProfMap: Record<string, any> = {};
          (invProfiles || []).forEach((p: any) => { invProfMap[p.id] = p; });
          setInvestments(invRows.map((i: any) => ({ ...i, profiles: invProfMap[i.user_id] || null })));
        } else {
          setInvestments(invRows);
        }
      } else {
        setInvestments([]);
      }

      // 2. Fetch Recent ROI Transactions for the Ledger (sin JOIN, enriquecimiento manual siempre)
      // FIX: Use anon client to bypass potential RLS policy issues for admins reading transactions
      const anonSupabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } }
      );

      let { data: txData } = await anonSupabase
        .from('transactions')
        .select('*')
        .eq('type', 'DAILY_RETURN')
        .order('created_at', { ascending: false })
        .limit(20);

      // Siempre enriquecer con profiles manualmente (más confiable que JOIN con RLS)
      if (txData && txData.length > 0) {
        const uniqueIds = [...new Set(txData.map((t: any) => t.user_id))].filter(id => id && typeof id === 'string' && id.length > 10);
        
        if (uniqueIds.length > 0) {
          const { data: profRows, error: profRowsError } = await supabase
            .from('profiles')
            .select('id, email, full_name, username, user_tag, roi_blocked')
            .in('id', uniqueIds);
            
          if (profRowsError) console.error('Error fetching profRows:', profRowsError);

          const profMap: Record<string, any> = {};
          (profRows || []).forEach((p: any) => { profMap[p.id] = p; });
          txData = txData.map((t: any) => ({ ...t, profiles: profMap[t.user_id] || null }));
        }
      }

      console.log(`ROI Engine: Fetched ${txData?.length || 0} transactions.`);
      setTransactions(txData || []);

      // 3. Last Execution Time - Fix: Show "Nunca" if no data
      if (txData && txData.length > 0) {
        setLastExecution(new Date(txData[0].created_at).toLocaleString('en-US'));
      } else {
        setLastExecution('Nunca');
      }

      // 4. Fetch ALL Transactions from last 24h for Duplicate Check & Total Calculation
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));

      const { data: todayTxData } = await supabase
        .from('transactions')
        .select('*')
        .eq('type', 'DAILY_RETURN')
        .gte('created_at', oneDayAgo.toISOString());

      const todayTxs = todayTxData || [];
      setTodaysTransactions(todayTxs);

      const todayTotal = todayTxs.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
      setTotalPaidToday(todayTotal);


    } catch (err) {
      console.error('Error fetching ROI data:', err);
      setLastExecution('Error de carga');
    } finally {
      setLoading(false);
    }
  };

  const addLog = (msg: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    setLogs(prev => [{
      msg,
      type,
      time: new Date().toLocaleTimeString()
    }, ...prev]);
  };

  // PRECISION ALGORITHM: Actual amount = min(base_roi, remaining_cap)
  const handleOpenAuditModal = async () => {
    setLoading(true);
    const activeContracts = investments.filter(i => i.status === 'ACTIVE');

    // Fetch ALL profiles for active contracts in ONE batch query (reliable, no FK join)
    const uniqueUserIds = [...new Set(activeContracts.map(i => i.user_id))].filter(id => id && typeof id === 'string' && id.length > 10);
    
    let profilesData: any[] | null = [];
    if (uniqueUserIds.length > 0) {
      const { data, error: profError } = await supabase
        .from('profiles')
        .select('id, email, full_name, username, user_tag, roi_blocked')
        .in('id', uniqueUserIds);
        
      if (profError) console.error('Error fetching profiles in audit modal:', profError);
      profilesData = data;
    }

    const profilesMap: Record<string, any> = {};
    (profilesData || []).forEach(p => { profilesMap[p.id] = p; });

    const rawItemsPromises = activeContracts.map(async (inv) => {
      // 1. Precise Audit: Include ALL income types that count against the cap
      const { data: txs } = await supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', inv.user_id)
        .in('type', ['DAILY_RETURN', 'REFERRAL_COMMISSION', 'WEEKLY_BONUS', 'bonus_weekly', 'BONUS', 'DEPOSIT_BONUS'])
        .gte('created_at', inv.created_at);

      const currentEarnings = (txs || []).reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
      const baseRoi = inv.amount * 0.022;

      // 2. Dynamic Cap: Use plan's target or default 200%
      const planLimitFactor = (inv.plans?.roi_percentage || 200) / 100;
      const capLimit = Number(inv.amount) * planLimitFactor;
      const remainingCap = Math.max(0, capLimit - currentEarnings);

      // Precision ROI calculation
      let finalRoi = Math.max(0, Math.min(baseRoi, remainingCap));
      let willSaturate = finalRoi < baseRoi || (currentEarnings + finalRoi) >= capLimit;

      const hasPaidToday = todaysTransactions.some(tx =>
        tx.reference_id === inv.id ||
        (tx.description && tx.description.includes(inv.id))
      );

      // Get profile from batch map
      const prof = profilesMap[inv.user_id];
      
      if (prof?.roi_blocked) {
        finalRoi = 0;
        willSaturate = false;
      }

      const profEmail = prof?.email || 'N/A';
      const profName = prof?.full_name || prof?.username || prof?.name ||
        (profEmail !== 'N/A' ? profEmail.split('@')[0] : `Usuario ${inv.user_id.slice(0, 8)}`);

      return {
        id: inv.id,
        user_id: inv.user_id,
        full_name: profName,
        email: profEmail,
        user_tag: prof?.user_tag || null,
        amount: inv.amount,
        roi: finalRoi,
        baseRoi: baseRoi,
        willSaturate,
        currentEarnings: currentEarnings
      };
    });

    const rawItems = await Promise.all(rawItemsPromises);
    const items = rawItems.filter(item => item !== null && item.roi > 0) as any[]; // Solo pendientes y con ROI > 0

    // Calculate totals from the final list
    const totalROI = items.reduce((sum, item) => sum + item.roi, 0);
    const saturatedCount = items.filter((item: any) => item.willSaturate).length;

    setAuditPreview({
      items,
      totalROI,
      saturatedCount
    });
    setSelectedContracts(items.map(item => item.id)); // Pre-select all
    setLoading(false);
    setShowAuditModal(true);
  };

  const executeROI = async () => {
    if (executing) return;
    setExecuting(true);
    setShowAuditModal(false);
    setLogs([]);
    addLog('🚀 Iniciando ROI Intelligence Core (Cap Precision)...', 'info');

    try {
      let distributed = 0;
      let processed = 0;
      let audited = 0;
      let errorsCount = 0;

      const itemsToProcess = auditPreview.items.filter((item: any) => selectedContracts.includes(item.id));

      for (const item of itemsToProcess) {
        try {
          const { id, user_id, roi, willSaturate, currentEarnings, full_name } = item;
          console.log(`ROI: Procesando ${full_name} (${id}) - Pago: $${roi}`);
          addLog(`Procesando ${full_name}: $${roi.toFixed(2)}...`, 'info');

          // 1. Update Investment
          const planLimitFactor = (item.plans?.roi_percentage || 200) / 100;
          const capLimit = item.amount * planLimitFactor;
          const { error: invError } = willSaturate
            ? await supabase.from('investments').update({
              status: 'COMPLETED',
              accumulated_earnings: Math.min(currentEarnings + roi, capLimit),
              completed_at: new Date().toISOString()
            }).eq('id', id)
            : await supabase.from('investments').update({
              accumulated_earnings: Math.min(currentEarnings + roi, capLimit)
            }).eq('id', id);

          if (invError) throw invError;

          // 2. Create Transaction
          const { error: txError } = await supabase.from('transactions').insert({
            user_id: user_id,
            type: 'DAILY_RETURN',
            amount: roi,
            status: 'COMPLETED',
            description: 'ROI Diario 2.2% (Audited)',
            reference_id: id
          });

          if (txError) throw txError;

          // 3. Update Balance (Wallet Bank)
          const { data: prof, error: profFetchError } = await supabase
            .from('profiles')
            .select('wallet_balance')
            .eq('id', user_id)
            .single();

          if (profFetchError) throw profFetchError;

          const { error: profUpdateError } = await supabase
            .from('profiles')
            .update({ wallet_balance: (prof.wallet_balance || 0) + roi })
            .eq('id', user_id);


          if (profUpdateError) throw profUpdateError;

          distributed += roi;
          processed++;
          if (willSaturate) audited++;

        } catch (itemErr: any) {
          console.error(`Error procesando item ROI:`, itemErr);
          addLog(`⚠️ Fallo en ${item.full_name}: ${itemErr.message}`, 'warning');
          errorsCount++;
        }
      }

      addLog(`✅ Distribución finalizada: $${distributed.toFixed(2)}`, 'success');
      addLog(`📊 Éxito: ${processed} | Fallos: ${errorsCount} | Cierres: ${audited}`, 'info');
      await fetchInitialData();
      alert(`✅ ¡PROCESO COMPLETADO!\n\nSe han distribuido $${distributed.toFixed(2)} correctamente.\nEl historial ha sido actualizado.`);

    } catch (err: any) {
      console.error('ROI Execution Fatal Error:', err);
      addLog(`🛑 ERROR FATAL: ${err.message}`, 'error');
    } finally {
      setExecuting(false);
    }
  };

  const stats = {
    totalManaged: investments.reduce((sum, i) => sum + (Number(i.amount) || 0), 0),
    activeContracts: investments.filter(i => i.status === 'ACTIVE').length,
    dailyLiability: Math.max(0, investments
      .filter(i => i.status === 'ACTIVE')
      .reduce((sum, i) => sum + (Number(i.amount) * 0.022), 0) - totalPaidToday),
    atRisk: investments.filter(i => {
      const factor = (i.plans?.roi_percentage || 200) / 100;
      return i.status === 'ACTIVE' && (Number(i.accumulated_earnings) / (Number(i.amount) * factor)) > 0.9;
    }).length,
    totalPaidToday,
    nextPaymentDue: (() => {
      if (!lastExecution || lastExecution === 'Nunca' || lastExecution === 'Error de carga') return 'Ahora';
      const last = new Date(transactions?.[0]?.created_at || new Date().toISOString());
      const next = new Date(last.getTime() + (24 * 60 * 60 * 1000));
      const now = new Date();
      if (now >= next) return 'Ahora';
      const diff = next.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      return `${hours}h ${minutes}m`;
    })()
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-700 max-w-[1600px] mx-auto bg-[#0a0a0c]">
      {/* Header matching Image 1 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="p-5 bg-indigo-500/10 rounded-[2.5rem] border border-indigo-500/20 shadow-inner">
            <Cpu className="text-indigo-400" size={48} />
          </div>
          <div>
            <h1 className="text-6xl font-black text-white tracking-tighter italic">ROI Intelligence Core</h1>
            <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-xs mt-2">
              Automatización de pagos pasivos del 2.2% con auditoría de CAP al 200%.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-3 text-right">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Última Ejecución</p>
            <p className="text-sm font-bold text-white italic">{lastExecution || 'Cargando...'}</p>
          </div>
          <button
            onClick={handleOpenAuditModal}
            disabled={executing || loading}
            className="flex items-center gap-4 px-12 py-6 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white rounded-[2.5rem] font-black text-sm uppercase tracking-widest shadow-[0_20px_40px_-15px_rgba(79,70,229,0.4)] transition-all active:scale-95 group"
          >
            {executing ? <RefreshCw className="animate-spin" size={24} /> : <Zap className="group-hover:fill-current" size={24} />}
            AUDITAR & PAGAR 2.2%
          </button>
        </div>
      </div>

      {/* KPI Cards matching Image 1 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Inversión Bajo Gestión */}
        <div className="bg-[#121217] border border-white/[0.03] p-10 rounded-[4rem] relative overflow-hidden group shadow-2xl">
          <div className="absolute right-0 bottom-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform duration-1000">
            <ShieldCheck size={200} />
          </div>
          <div className="relative space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Layers size={16} />
              </div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Inversión Bajo Gestión</p>
            </div>
            <p className="text-7xl font-black text-white tracking-tighter tabular-nums">${stats.totalManaged.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              <p className="text-xs font-black text-indigo-400 uppercase tracking-widest">{stats.activeContracts} Contratos Activos</p>
            </div>
          </div>
        </div>

        {/* Carga Pasiva Diaria */}
        <div className="bg-[#121217] border border-white/[0.03] p-10 rounded-[4rem] relative overflow-hidden group shadow-2xl">
          <div className="absolute right-0 bottom-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform duration-1000 text-emerald-500">
            <TrendingUp size={200} />
          </div>
          <div className="relative space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Activity size={16} />
              </div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Carga Pasiva Diaria</p>
            </div>
            <p className="text-7xl font-black text-emerald-500 tracking-tighter tabular-nums">${stats.dailyLiability.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            <div className="flex items-center justify-between">
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest italic">
                {stats.nextPaymentDue === 'Ahora' ? 'Pago Disponible' : `Próx. Ciclo: ${stats.nextPaymentDue}`}
              </p>
              {totalPaidToday > 0 && (
                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-tighter">Pagado: ${totalPaidToday.toFixed(2)}</p>
              )}
            </div>
          </div>
        </div>

        {/* Cierres por 200% */}
        <div className="bg-[#121217] border border-white/[0.03] p-10 rounded-[4rem] relative overflow-hidden group shadow-2xl">
          <div className="absolute right-0 bottom-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform duration-1000 text-amber-500">
            <Target size={200} />
          </div>
          <div className="relative space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400">
                <ShieldCheck size={16} />
              </div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Cierres por 200% Cap</p>
            </div>
            <p className="text-7xl font-black text-amber-500 tracking-tighter tabular-nums">{stats.atRisk}</p>
            <p className="text-xs font-black text-slate-500 uppercase tracking-[0.1em] font-bold">Inversores cerca de duplicar</p>
          </div>
        </div>
      </div>

      {/* Ledger Section matching Image 1 */}
      <div className="bg-[#121217] border border-white/[0.03] rounded-[4rem] overflow-hidden shadow-2xl flex flex-col">
        <div className="p-10 border-b border-white/[0.02] flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-slate-800 rounded-[1.5rem] text-indigo-400">
              <History size={28} />
            </div>
            <div>
              <h3 className="text-2xl font-black text-white italic tracking-tight uppercase">Ledger de Acreditaciones</h3>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mt-1">Últimos movimientos del motor</p>
            </div>
          </div>
          <button onClick={fetchInitialData} className="p-4 hover:bg-slate-800 rounded-2xl transition-all text-slate-500 hover:text-white">
            <RefreshCw size={24} />
          </button>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-black/10 text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] border-b border-white/[0.02]">
                <th className="px-12 py-6">Inversor</th>
                <th className="px-12 py-6 text-center">Inversión</th>
                <th className="px-12 py-6 text-center">Pago ROI</th>
                <th className="px-12 py-6 text-right">Fecha Sincronización</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.01]">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-12 py-24 text-center">
                    <div className="flex flex-col items-center gap-4 opacity-20">
                      <RefreshCw className="animate-spin" size={40} />
                      <p className="font-black uppercase tracking-[0.3em] text-xs">Sincronizando Core...</p>
                    </div>
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-12 py-24 text-center">
                    <div className="flex flex-col items-center gap-4 opacity-10">
                      <LayoutDashboard size={64} />
                      <p className="font-black uppercase tracking-widest text-sm">Sin actividad reciente</p>
                    </div>
                  </td>
                </tr>
              ) : transactions.map((tx) => {
                const p = tx.profiles && Array.isArray(tx.profiles) ? tx.profiles[0] : tx.profiles;
                const displayName = p?.full_name || p?.name || p?.username || (p?.email ? p.email.split('@')[0] : 'Inversor GK GEMINIX');
                const displayEmail = p?.email || 'ID: ' + (p?.id?.slice(0, 8) || 'Desconocido');

                return (
                  <tr key={tx.id} className="hover:bg-white/[0.01] transition-all">
                    <td className="px-12 py-8">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-lg font-black text-slate-200">{displayName}</p>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black border uppercase tracking-widest ${getTagStyles(p?.user_tag)}`}>
                          {p?.user_tag || 'REAL'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-600 font-bold tracking-tight uppercase">{displayEmail}</p>
                    </td>
                    <td className="px-12 py-8 text-center tabular-nums">
                    <span className="text-slate-400 font-bold text-lg">
                      ${((tx.investments as any)?.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td className="px-12 py-8 text-center tabular-nums">
                    <span className="text-emerald-500 font-black text-2xl">+$ {Number(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </td>
                  <td className="px-12 py-8 text-right">
                    <p className="text-sm font-black text-slate-400 italic">{new Date(tx.created_at).toLocaleDateString()}</p>
                    <p className="text-[11px] text-slate-600 font-bold uppercase">{new Date(tx.created_at).toLocaleTimeString()}</p>
                  </td>
                </tr>
              );
            })}
            </tbody>
          </table>
        </div>
      </div>

      {/* AUDIT MODAL matching Image 2 */}
      {showAuditModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12">
          <div className="absolute inset-0 bg-black/98 backdrop-blur-2xl animate-in fade-in duration-500" onClick={() => setShowAuditModal(false)} />
          <div className="relative bg-[#0d0d12] border border-white/[0.05] w-full max-w-6xl rounded-[4rem] md:rounded-[5rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,1)] animate-in zoom-in-95 duration-400 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-10 md:p-14 border-b border-white/[0.03] flex items-center justify-between bg-black/20 shrink-0">
              <div className="flex items-center gap-8">
                <div className="p-6 bg-indigo-600 rounded-[2.2rem] text-white shadow-[0_15px_40px_rgba(79,70,229,0.4)]">
                  <Zap size={44} />
                </div>
                <div>
                  <h3 className="text-4xl font-black text-white italic tracking-tighter uppercase leading-none">Auditoría de Nómina</h3>
                  <p className="text-[11px] text-slate-500 font-black uppercase tracking-[0.5em] mt-3">Algoritmo de Precisión 2.2% / Cap 200%</p>
                </div>
              </div>
              <button
                onClick={() => setShowAuditModal(false)}
                className="p-4 hover:bg-white/5 rounded-2xl transition-all text-slate-500 hover:text-white"
              >
                <X size={48} />
              </button>
            </div>

            <div className="p-10 md:p-14 space-y-12 overflow-y-auto custom-scrollbar flex-1">
              {/* Stat Boxes matching Image 2 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-[#121217] border border-white/[0.03] p-10 rounded-[3.5rem] shadow-inner border-t border-white/[0.05]">
                  <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-500 mb-3">Contratos en Lote</p>
                  <p className="text-7xl font-black text-white tabular-nums leading-none">{selectedContracts.length}</p>
                </div>
                <div className="bg-[#121217] border border-white/[0.03] p-10 rounded-[3.5rem] shadow-inner border-t border-white/[0.05]">
                  <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-500 mb-3">Acreditación Seleccionada</p>
                  <p className="text-7xl font-black text-emerald-500 tabular-nums leading-none tracking-tighter">
                    ${auditPreview.items.filter((item: any) => selectedContracts.includes(item.id)).reduce((sum: number, item: any) => sum + item.roi, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-[#121217] border border-white/[0.03] p-10 rounded-[3.5rem] shadow-inner border-t border-white/[0.05]">
                  <p className="text-[11px] font-black uppercase tracking-[0.3em] text-amber-500 mb-3 uppercase">Cierres por 200%</p>
                  <p className="text-7xl font-black text-amber-500 tabular-nums leading-none">
                    {auditPreview.items.filter((item: any) => selectedContracts.includes(item.id) && item.willSaturate).length}
                  </p>
                </div>
              </div>

              {/* Table wrapper with scroll */}
              <div className="bg-black/40 rounded-[3.5rem] border border-white/[0.04] overflow-hidden shadow-2xl">
                <div className="max-h-[450px] overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-[#16161c] sticky top-0 z-10">
                      <tr className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] border-b border-white/[0.03]">
                        <th className="px-6 py-7 w-16">
                          <button
                            onClick={() => {
                              if (selectedContracts.length === auditPreview.items.length && auditPreview.items.length > 0) {
                                setSelectedContracts([]);
                              } else {
                                setSelectedContracts(auditPreview.items.map((item: any) => item.id));
                              }
                            }}
                            className="text-slate-400 hover:text-white transition-colors flex items-center justify-center w-full"
                          >
                            {selectedContracts.length === auditPreview.items.length && auditPreview.items.length > 0 ? <CheckSquare size={20} className="text-indigo-500" /> : <Square size={20} />}
                          </button>
                        </th>
                        <th className="px-6 py-7">Inversor</th>
                        <th className="px-12 py-7 text-center">Capital</th>
                        <th className="px-12 py-7 text-center text-emerald-500">ROI 2.2%</th>
                        <th className="px-12 py-7 text-right">Sugerencia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.02]">
                      {auditPreview.items.map((item: any) => {
                        const isSelected = selectedContracts.includes(item.id);
                        return (
                        <tr key={item.id} className={`hover:bg-white/[0.02] transition-all group ${isSelected ? '' : 'opacity-40 grayscale'}`}>
                          <td className="px-6 py-8 text-center">
                            <button
                              onClick={() => {
                                setSelectedContracts(prev =>
                                  prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]
                                );
                              }}
                              className="text-slate-500 hover:text-white transition-colors"
                            >
                              {isSelected ? <CheckSquare size={20} className="text-indigo-400" /> : <Square size={20} />}
                            </button>
                          </td>
                          <td className="px-6 py-8">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="text-xl font-black text-slate-200 group-hover:text-white transition-colors">{item.full_name}</p>
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-black border uppercase tracking-widest ${getTagStyles(item.user_tag)}`}>
                                {item.user_tag || 'REAL'}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-600 font-bold uppercase tracking-tight mt-1">{item.email !== 'N/A' ? item.email : `ID: ${item.user_id.slice(0, 12).toUpperCase()}`}</p>
                          </td>
                          <td className="px-12 py-8 text-center text-slate-400">
                            <span className="text-lg font-black tabular-nums">${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </td>
                          <td className="px-12 py-8 text-center">
                            <div className="flex flex-col items-center">
                              <span className="text-xl font-black text-emerald-400 tabular-nums">+$ {item.roi.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                              {item.roi < item.baseRoi && (
                                <span className="text-[9px] text-amber-500 font-bold uppercase tracking-tighter">Cap Ajustado</span>
                              )}
                            </div>
                          </td>
                          <td className="px-12 py-8 text-right">
                            <span className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${!isSelected
                              ? 'bg-slate-800/50 text-slate-500 border-slate-700'
                              : item.willSaturate
                                ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.1)]'
                                : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                              }`}>
                              {!isSelected ? 'Descartado' : (item.willSaturate ? 'Completar Contrato' : 'Mantener Activo')}
                            </span>
                          </td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Footer matching Image 2 */}
              <div className="flex items-center justify-between pt-6 shrink-0">
                <div className="flex items-center gap-7 max-w-md p-7 bg-white/[0.02] rounded-[2.5rem] border border-white/[0.02] shadow-inner">
                  <div className="p-4 bg-amber-500/10 rounded-2xl text-amber-500 shrink-0">
                    <Calculator size={36} />
                  </div>
                  <div>
                    <p className="text-base font-black text-white uppercase tracking-tight">Verificación de Algoritmo</p>
                    <p className="text-[11px] text-slate-500 font-bold uppercase leading-relaxed mt-1">Garantía GK GEMINIX: Pagos auditados bajo el 200% Cap.</p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <button
                    onClick={() => setShowAuditModal(false)}
                    className="px-14 py-8 bg-slate-900/50 hover:bg-slate-800 text-slate-400 rounded-[2.5rem] font-black text-xs uppercase tracking-[0.3em] border border-white/5 transition-all active:scale-95"
                  >
                    Descartar
                  </button>
                  <button
                    onClick={executeROI}
                    disabled={executing || selectedContracts.length === 0}
                    className="flex items-center gap-5 px-16 py-8 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[2.5rem] font-black text-xs uppercase tracking-[0.3em] shadow-[0_25px_60px_-15px_rgba(79,70,229,0.5)] transition-all active:scale-95 translate-y-[-2px] disabled:opacity-50"
                  >
                    {executing ? <RefreshCw className="animate-spin" size={24} /> : <Zap size={24} className="fill-current" />}
                    Confirmar & Sincronizar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoiEngine;
