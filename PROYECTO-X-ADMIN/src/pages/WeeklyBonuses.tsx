
import React, { useEffect, useState, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Profile, Investment, Transaction } from '../types';
import {
  Gift,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  Zap,
  DollarSign,
  Trophy,
  Target,
  ArrowUpRight,
  Clock,
  CalendarDays,
  Medal,
  Star,
  ChevronRight,
  TrendingUp,
  Award,
  RefreshCw,
  History,
  Wallet,
  Search,
  ChevronLeft
} from 'lucide-react';

// Definición de la tabla de rangos ACTUALIZADA
const SALARY_TIERS = [
  { minVolume: 1000000, salary: 30000, label: 'Diamond Legend', color: 'text-sky-400' },
  { minVolume: 800000, salary: 20000, label: 'Crown Ambassador', color: 'text-purple-400' },
  { minVolume: 400000, salary: 7500, label: 'Platinum President', color: 'text-slate-200' },
  { minVolume: 200000, salary: 4000, label: 'Golden Director', color: 'text-amber-400' },
  { minVolume: 100000, salary: 1500, label: 'Regional Manager', color: 'text-indigo-400' },
  { minVolume: 65000, salary: 800, label: 'Senior Executive', color: 'text-emerald-400' },
  { minVolume: 40000, salary: 500, label: 'Executive', color: 'text-rose-400' },
  { minVolume: 25000, salary: 300, label: 'Team Leader', color: 'text-orange-400' },
  { minVolume: 10000, salary: 100, label: 'Rising Star', color: 'text-teal-400' },
];

const WeeklyBonuses: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [distributing, setDistributing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const [users, setUsers] = useState<Profile[]>([]);
  const [activeInvestments, setActiveInvestments] = useState<Investment[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const isSaturday = useMemo(() => new Date().getDay() === 6, []);

  // Historial auditable
  const [historial, setHistorial] = useState<any[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [histSearch, setHistSearch] = useState('');
  const [histPage, setHistPage] = useState(0);
  const HIST_PAGE_SIZE = 15;

  const fetchHistorial = async () => {
    if (!isSupabaseConfigured()) return;
    setLoadingHistorial(true);
    try {
      const { data } = await supabase
        .from('transactions')
        .select('id, user_id, amount, description, created_at, profiles:user_id(full_name, email)')
        .eq('type', 'bonus_weekly')
        .order('created_at', { ascending: false })
        .limit(500);
      setHistorial(data || []);
    } catch (_) {}
    setLoadingHistorial(false);
  };

  useEffect(() => {
    fetchData();
    fetchHistorial();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    if (!isSupabaseConfigured()) {
      setUsers([
        { id: 'u1', email: 'carlos@fintech.io', full_name: 'Carlos Mendez', credit_balance: 5000, role: 'user', created_at: '' },
        { id: 'u2', email: 'elena@whale.com', full_name: 'Elena Rodriguez', credit_balance: 120000, role: 'user', created_at: '' }
      ]);
      setActiveInvestments([
        { id: 'i1', user_id: 'u1', plan_id: 'p1', amount: 25000, status: 'ACTIVE', accumulated_earnings: 0, created_at: '' },
        { id: 'i2', user_id: 'u2', plan_id: 'p2', amount: 1000000, status: 'ACTIVE', accumulated_earnings: 0, created_at: '' }
      ]);
      setLoading(false);
      return;
    }

    try {
      // 1. Fetch Users, Active Investments, and Network Structure
      const [userRes, invRes, commissionRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('role', 'user'),
        supabase.from('investments').select('*').eq('status', 'ACTIVE'),
        supabase.from('transactions').select('user_id, amount').eq('type', 'REFERRAL_COMMISSION')
      ]);

      const allUsers = userRes.data || [];
      const activeInvs = invRes.data || [];
      const allCommissions = commissionRes.data || [];

      // 2. Map personal commissions per user
      const commissionMap = new Map<string, number>();
      allCommissions.forEach(tx => {
        commissionMap.set(tx.user_id, (commissionMap.get(tx.user_id) || 0) + (Number(tx.amount) || 0));
      });

      // 3. Calculate Team Commission Volume for each user
      // We need to build the downline for each user. 
      // Since we have all users and their referred_by, we can do this.
      const userVolumes = new Map<string, number>();

      allUsers.forEach(u => {
        // Recursive helper to get total commission volume of a user's downline
        const getDownlineCommissions = (userId: string, depth = 0): number => {
          if (depth > 10) return 0; // Guard
          const children = allUsers.filter(child => child.referred_by === userId);
          let sum = 0;
          children.forEach(child => {
            sum += (commissionMap.get(child.id) || 0) + getDownlineCommissions(child.id, depth + 1);
          });
          return sum;
        };

        const teamVol = (commissionMap.get(u.id) || 0) + getDownlineCommissions(u.id);
        userVolumes.set(u.id, teamVol);
      });

      // Attach volume to users or store it
      setUsers(allUsers.map(u => ({ ...u, team_volume: userVolumes.get(u.id) || 0 })));
      setActiveInvestments(activeInvs);
    } catch (err: any) {
      setError("Error al sincronizar datos de producción.");
    } finally {
      setLoading(false);
    }
  };

  const getSalaryForVolume = (volume: number) => {
    const tier = SALARY_TIERS.find(t => volume >= t.minVolume);
    return tier ? { salary: tier.salary, label: tier.label } : { salary: 0, label: 'No Califica' };
  };

  const calculatedBonuses = useMemo(() => {
    return activeInvestments.map(inv => {
      const user = users.find(u => u.id === inv.user_id);
      const teamVolume = (user as any)?.team_volume || 0;
      const { salary, label } = getSalaryForVolume(teamVolume);

      return {
        user_id: inv.user_id,
        user_name: user?.full_name || 'Desconocido',
        volume: teamVolume,
        salary,
        label
      };
    }).filter(b => b.salary > 0);
  }, [activeInvestments, users]);

  const totalPayroll = calculatedBonuses.reduce((acc, curr) => acc + curr.salary, 0);

  const handleExecuteDistribution = async () => {
    if (!isSaturday && !window.confirm("Hoy no es sábado. ¿Confirmas el pago manual de la nómina de líderes?")) return;

    setDistributing(true);
    setError(null);
    setSuccess(null);

    try {
      if (!isSupabaseConfigured()) {
        setSuccess(`Nómina dominical pagada: $${totalPayroll.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`);
      } else {
        for (const bonus of calculatedBonuses) {
          // 1. Get current investment state to ensure precision
          const { data: inv, error: invFetchError } = await supabase
            .from('investments')
            .select('amount, accumulated_earnings, status, created_at')
            .eq('user_id', bonus.user_id)
            .eq('status', 'ACTIVE')
            .order('created_at', { ascending: true })
            .limit(1)
            .single();

          if (invFetchError || !inv) {
            console.warn(`Skipping bonus for ${bonus.user_name}: No active investment found.`);
            continue;
          }

          // Deep Audit: Recalculate real earnings from transactions to ensure precision
          const { data: txs } = await supabase
            .from('transactions')
            .select('amount')
            .eq('user_id', bonus.user_id)
            .in('type', ['DAILY_RETURN', 'REFERRAL_COMMISSION', 'WEEKLY_BONUS', 'bonus_weekly', 'BONUS', 'DEPOSIT_BONUS'])
            .gte('created_at', inv.created_at);

          const currentEarnings = (txs || []).reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
          const capLimit = Number(inv.amount) * 2;
          const remainingCap = Math.max(0, capLimit - currentEarnings);

          // 2. Precision Pay: pay the smaller of (salary, remainingCap)
          const actualPay = Math.min(bonus.salary, remainingCap);
          const willSaturate = actualPay >= remainingCap || (currentEarnings + actualPay) >= capLimit;

          if (actualPay <= 0) {
            console.log(`Skipping bonus for ${bonus.user_name}: Investment already at cap.`);
            continue;
          }

          // 3. Update Balance (Wallet Bank)
          const { data: profile } = await supabase.from('profiles').select('wallet_balance').eq('id', bonus.user_id).single();
          const newBalance = (profile?.wallet_balance || 0) + actualPay;
          await supabase.from('profiles').update({ wallet_balance: newBalance }).eq('id', bonus.user_id);


          // 4. Update Investment Accumulated Earnings and Status
          const { error: invUpdateError } = await supabase
            .from('investments')
            .update({
              accumulated_earnings: Math.min(currentEarnings + actualPay, capLimit),
              status: willSaturate ? 'COMPLETED' : 'ACTIVE',
              completed_at: willSaturate ? new Date().toISOString() : null
            })
            .eq('user_id', bonus.user_id)
            .eq('status', 'ACTIVE')
            .eq('amount', inv.amount); // Precision guard

          // 5. Log Transaction
          await supabase.from('transactions').insert([{
            user_id: bonus.user_id,
            amount: actualPay,
            type: 'bonus_weekly',
            description: `Bono Salarial Semanal - Rango ${bonus.label}${willSaturate ? ' (CAP 200% ALCANZADO)' : ''}`,
            created_at: new Date().toISOString(),
            reference_id: bonus.user_id // Or better, investment id if available in transactions table
          }]);
        }
        await fetchData();
        await fetchHistorial();
        setSuccess(`Pago semanal exitoso para ${calculatedBonuses.length} líderes. Acreditado en Wallet Bank.`);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setError("Fallo en la ejecución de la nómina.");
    } finally {
      setDistributing(false);
    }
  };

  const handleGlobalReset = async () => {
    if (!window.confirm("⚠️ ATENCIÓN: Esto reseteará los VOLÚMENES y RANGOS de todos los usuarios a 0. ¿Estás seguro de que ya pagaste todas las nóminas?")) return;

    setResetting(true);
    setError(null);
    setSuccess(null);

    try {
      if (!isSupabaseConfigured()) {
        setSuccess("Simulación: Volúmenes globales reseteados correctamente.");
      } else {
        const { error: resetError } = await supabase.rpc('reset_all_weekly_volumes');
        if (resetError) throw resetError;

        await fetchData();
        setSuccess("✅ CICLO SEMANAL REINICIADO. Todos los volúmenes están en 0.");
      }
    } catch (err: any) {
      console.error("Error en reset global:", err);
      setError("Error al ejecutar el reinicio global: " + (err.message || "Error desconocido"));
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
        <p className="text-slate-500 font-black uppercase text-xs tracking-widest">Compilando Producción de Equipos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-50 tracking-tight flex items-center gap-3">
            <Gift className="text-indigo-500" size={32} />
            Weekly Salary Bonus
          </h1>
          <p className="text-slate-400 font-medium mt-1">Liquidación automática de líderes basada en facturación de red.</p>
        </div>

        <div className="flex items-center space-x-3">
          <div className={`flex items-center space-x-2 px-4 py-2 rounded-xl border ${isSaturday ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-rose-500/10 border-rose-500/20 text-rose-500'}`}>
            <Clock size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest">{isSaturday ? 'Sábado: Ventana Abierta' : 'Pendiente Sábado'}</span>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            disabled={calculatedBonuses.length === 0}
            className="flex items-center justify-center space-x-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-[1.25rem] font-black uppercase text-xs tracking-widest shadow-xl shadow-indigo-600/20 transition-all active:scale-95"
          >
            <Zap size={20} />
            <span>Ejecutar Nómina</span>
          </button>

          <button
            onClick={handleGlobalReset}
            disabled={resetting || loading}
            className="flex items-center justify-center space-x-2 px-6 py-4 bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-500 border border-slate-700 hover:border-rose-500/30 rounded-[1.25rem] font-black uppercase text-xs tracking-widest transition-all active:scale-95 disabled:opacity-30"
          >
            {resetting ? <Loader2 className="animate-spin" size={20} /> : <RefreshCw size={20} />}
            <span>Reiniciar Ciclo</span>
          </button>
        </div>
      </div>

      {(error || success) && (
        <div className="space-y-3">
          {error && <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl flex items-center space-x-3 text-rose-500 shadow-lg"><AlertCircle size={20} /><span className="font-bold">{error}</span></div>}
          {success && <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl flex items-center space-x-3 text-emerald-500 shadow-lg"><CheckCircle2 size={20} /><span className="font-bold">{success}</span></div>}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Lado Izquierdo: Lista Vertical de Rangos (COMPACTA) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 shadow-2xl">
            <div className="flex items-center space-x-3 mb-6 px-2">
              <Award className="text-indigo-500" size={20} />
              <h3 className="text-sm font-black text-slate-100 uppercase tracking-widest">Escala Salarial</h3>
            </div>

            <div className="space-y-2">
              {SALARY_TIERS.map((tier, idx) => (
                <div key={idx} className="group relative bg-slate-800/30 hover:bg-indigo-600/10 border border-slate-800 hover:border-indigo-500/30 p-3 rounded-2xl transition-all duration-300 flex items-center justify-between overflow-hidden">
                  <div className="flex items-center space-x-3 relative z-10">
                    <div className={`w-8 h-8 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-[10px] font-black ${tier.color}`}>
                      {idx + 1}
                    </div>
                    <div>
                      <p className={`text-[11px] font-black uppercase tracking-tight ${tier.color}`}>{tier.label}</p>
                      <p className="text-[9px] text-slate-500 font-bold tracking-widest">PROD: ${tier.minVolume.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                  <div className="text-right relative z-10">
                    <p className="text-sm font-black text-white tabular-nums">${tier.salary.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    <p className="text-[8px] text-slate-600 font-black uppercase">Semanal</p>
                  </div>
                  {/* Background Glow Effect on hover */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-500/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Lado Derecho: Auditoría y Líderes */}
        <div className="lg:col-span-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Trophy size={80} />
              </div>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-4">Métrica de Nómina</p>
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <p className="text-xs text-slate-400 font-bold uppercase">Líderes Calificados</p>
                  <p className="text-3xl font-black text-white">{calculatedBonuses.length}</p>
                </div>
                <div className="pt-4 border-t border-slate-800">
                  <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest mb-1">Presupuesto Dominical</p>
                  <p className="text-5xl font-black text-emerald-400 tabular-nums">${totalPayroll.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-8 rounded-[2rem] text-white shadow-2xl flex flex-col justify-between relative overflow-hidden group">
              <Star className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10 group-hover:rotate-12 transition-transform duration-700" />
              <div>
                <div className="flex items-center space-x-2 mb-4">
                  <div className="p-2 bg-white/10 rounded-lg"><Medal size={20} /></div>
                  <h3 className="text-lg font-black uppercase tracking-widest">Incentivo de Red</h3>
                </div>
                <p className="text-indigo-100 text-sm font-medium leading-relaxed italic pr-8">
                  "La recompensa al liderazgo se paga cada domingo. Asegura que tu producción de equipo esté sincronizada."
                </p>
              </div>
              <div className="mt-6 flex items-center space-x-2 text-[10px] font-black uppercase tracking-[0.2em] bg-black/20 w-fit px-3 py-1.5 rounded-full">
                <TrendingUp size={14} />
                <span>Corte Semanal en Vivo</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
            <div className="p-8 border-b border-slate-800">
              <h2 className="text-xl font-black text-slate-100 flex items-center gap-3">
                <Target className="text-rose-500" size={24} />
                Líderes Calificados Actuales
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-800/40 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                    <th className="px-8 py-5">Identidad Líder</th>
                    <th className="px-8 py-5">Producción</th>
                    <th className="px-8 py-5 text-right">Bono a Pagar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {calculatedBonuses.length === 0 ? (
                    <tr><td colSpan={3} className="px-8 py-20 text-center text-slate-600 italic font-medium">No se detectan líderes calificados en esta ventana.</td></tr>
                  ) : calculatedBonuses.map((bonus, idx) => (
                    <tr key={idx} className="hover:bg-indigo-500/5 transition-colors group">
                      <td className="px-8 py-5">
                        <div>
                          <p className="text-sm font-black text-slate-100 group-hover:text-indigo-400 transition-colors">{bonus.user_name}</p>
                          <span className="text-[9px] text-indigo-500 font-black uppercase tracking-widest">{bonus.label}</span>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center space-x-1.5 text-slate-300 font-bold tabular-nums">
                          <span>${bonus.volume.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          <ArrowUpRight size={12} className="text-emerald-500" />
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <p className="font-black text-emerald-400 text-lg tabular-nums">+${bonus.salary.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* HISTORIAL AUDITABLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
        <div className="p-8 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-xl font-black text-slate-100 flex items-center gap-3">
            <History className="text-amber-500" size={24} />
            Historial Auditable — Salarios Pagados
          </h2>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2">
              <Search size={14} className="text-slate-400" />
              <input
                type="text"
                value={histSearch}
                onChange={e => { setHistSearch(e.target.value); setHistPage(0); }}
                placeholder="Buscar usuario..."
                className="bg-transparent text-sm text-slate-200 placeholder-slate-500 outline-none w-40"
              />
            </div>
            <button
              onClick={fetchHistorial}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
            >
              {loadingHistorial ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Actualizar
            </button>
          </div>
        </div>

        {/* Wallet Bank notice */}
        <div className="px-8 py-4 bg-cyan-500/5 border-b border-cyan-500/10 flex items-center gap-3">
          <Wallet size={16} className="text-cyan-400" />
          <p className="text-xs text-cyan-300 font-bold">
            Regla de Oro: Todos los salarios se acreditan directamente en la <span className="text-cyan-200 font-black">Wallet Bank</span> del usuario. Desde ahí puede retirar, transferir o invertir libremente.
          </p>
        </div>

        {loadingHistorial ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-amber-500" size={32} />
          </div>
        ) : (() => {
          const filtered = historial.filter(tx => {
            if (!histSearch) return true;
            const name = ((tx.profiles as any)?.full_name || '').toLowerCase();
            const email = ((tx.profiles as any)?.email || '').toLowerCase();
            const desc = (tx.description || '').toLowerCase();
            const q = histSearch.toLowerCase();
            return name.includes(q) || email.includes(q) || desc.includes(q);
          });
          const totalPages = Math.ceil(filtered.length / HIST_PAGE_SIZE);
          const paginated = filtered.slice(histPage * HIST_PAGE_SIZE, (histPage + 1) * HIST_PAGE_SIZE);
          const totalPaid = filtered.reduce((s, tx) => s + (Number(tx.amount) || 0), 0);

          return (
            <>
              {/* Stats row */}
              <div className="px-8 py-4 bg-slate-800/30 border-b border-slate-800 flex gap-8 flex-wrap">
                <div>
                  <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Registros</p>
                  <p className="text-xl font-black text-white">{filtered.length}</p>
                </div>
                <div>
                  <p className="text-[9px] text-amber-500 font-black uppercase tracking-widest">Total Pagado (filtro)</p>
                  <p className="text-xl font-black text-amber-400">${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-800/40 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                      <th className="px-6 py-4">Fecha / Hora</th>
                      <th className="px-6 py-4">Usuario</th>
                      <th className="px-6 py-4">Descripción</th>
                      <th className="px-6 py-4 text-center">Destino</th>
                      <th className="px-6 py-4 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {paginated.length === 0 ? (
                      <tr><td colSpan={5} className="px-6 py-16 text-center text-slate-600 italic">Sin registros de pagos salariales.</td></tr>
                    ) : paginated.map((tx, i) => {
                      const profile = tx.profiles as any;
                      const date = new Date(tx.created_at);
                      const isCap = tx.description?.includes('CAP');
                      return (
                        <tr key={tx.id || i} className="hover:bg-amber-500/5 transition-colors group">
                          <td className="px-6 py-4">
                            <p className="text-xs font-bold text-slate-300">{date.toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                            <p className="text-[10px] text-slate-500">{date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm font-black text-slate-100 group-hover:text-amber-400 transition-colors">{profile?.full_name || '—'}</p>
                            <p className="text-[10px] text-slate-500">{profile?.email || tx.user_id?.slice(0, 8)}</p>
                          </td>
                          <td className="px-6 py-4 max-w-xs">
                            <p className="text-xs text-slate-400 truncate">{tx.description || 'Bono Salarial Semanal'}</p>
                            {isCap && <span className="text-[9px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full font-black uppercase">CAP 200%</span>}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-flex items-center gap-1 text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-1 rounded-full font-black uppercase">
                              <Wallet size={10} /> Wallet Bank
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <p className="font-black text-emerald-400 tabular-nums">+${Number(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="px-8 py-5 border-t border-slate-800 flex items-center justify-between">
                  <p className="text-xs text-slate-500 font-bold">Página {histPage + 1} de {totalPages}</p>
                  <div className="flex gap-2">
                    <button onClick={() => setHistPage(p => Math.max(0, p - 1))} disabled={histPage === 0} className="p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded-xl text-slate-300 transition-all">
                      <ChevronLeft size={16} />
                    </button>
                    <button onClick={() => setHistPage(p => Math.min(totalPages - 1, p + 1))} disabled={histPage >= totalPages - 1} className="p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded-xl text-slate-300 transition-all">
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* MODAL DE LIQUIDACIÓN */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/98 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-10 border-b border-slate-800 flex items-center justify-between bg-gradient-to-br from-slate-900 to-indigo-900/10">
              <div className="flex items-center space-x-5">
                <div className="p-4 bg-indigo-600 rounded-3xl text-white shadow-2xl shadow-indigo-600/30"><DollarSign size={32} /></div>
                <div>
                  <h3 className="text-2xl font-black text-white">Liquidación Final</h3>
                  <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">Ejecución Global de Nómina</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-3 text-slate-500 hover:text-white rounded-2xl transition-all hover:bg-slate-800"><X size={28} /></button>
            </div>

            <div className="p-10 space-y-8">
              <div className="bg-slate-950/50 border border-slate-800 rounded-[2rem] p-8 space-y-6">
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-1">
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Beneficiarios</p>
                    <p className="text-3xl font-black text-slate-100">{calculatedBonuses.length}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">Total a Descontar</p>
                    <p className="text-3xl font-black text-emerald-500">${totalPayroll.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                </div>
              </div>

              {!isSaturday && (
                <div className="bg-rose-500/10 border border-rose-500/20 p-6 rounded-2xl flex items-start space-x-4">
                  <AlertCircle className="text-rose-500 shrink-0 mt-1" size={24} />
                  <p className="text-sm text-rose-100/80 leading-relaxed font-medium italic">
                    "Atención Admin: Hoy no es sábado. Ejecutar la nómina fuera de ciclo requiere una auditoría manual posterior."
                  </p>
                </div>
              )}

              <div className="flex space-x-4">
                <button onClick={() => setIsModalOpen(false)} className="flex-1 py-5 bg-slate-800 text-slate-300 rounded-3xl font-black uppercase text-xs tracking-widest hover:bg-slate-700 transition-all active:scale-95">Cancelar</button>
                <button onClick={handleExecuteDistribution} disabled={distributing} className="flex-[2] py-5 bg-indigo-600 text-white rounded-3xl font-black uppercase text-xs tracking-widest hover:bg-indigo-500 shadow-2xl shadow-indigo-600/30 transition-all flex items-center justify-center space-x-3 active:scale-95 disabled:opacity-75">
                  {distributing ? <Loader2 className="animate-spin" size={24} /> : <><CalendarDays size={24} /><span>Confirmar Pago Semanal</span></>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeeklyBonuses;
