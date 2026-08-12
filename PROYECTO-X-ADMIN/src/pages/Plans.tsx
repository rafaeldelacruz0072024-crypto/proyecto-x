
import React, { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Plan } from '../types';
import StatusBadge from '../components/StatusBadge';
import {
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  Loader2,
  Briefcase,
  TrendingUp,
  Clock,
  DollarSign,
  AlertCircle,
  Zap,
  Target,
  ShieldCheck,
  ArrowUpRight,
  Info,
  Lock
} from 'lucide-react';

const Plans: React.FC = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: 'Geminix Standard ROI',
    roi_percentage: 200,
    duration_days: 91,
    min_amount: 5,
    daily_roi_percent: 2.2,
    max_units: '' as string | number,
    status: 'active' as 'active' | 'inactive'
  });

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    setLoading(true);
    setError(null);

    if (!isSupabaseConfigured()) {
      setError("Faltan las credenciales de Supabase en .env");
      setLoading(false);
      return;
    }

    try {
      // Fetch plans + unit usage in parallel
      const [plansRes, usageRes] = await Promise.all([
        supabase.from('plans').select('*').order('min_amount', { ascending: true }),
        supabase.from('plan_unit_usage').select('plan_id, units_used, units_remaining')
      ]);

      if (plansRes.error) throw plansRes.error;

      const usageMap: Record<string, { units_used: number; units_remaining: number }> = {};
      if (usageRes.data) {
        for (const row of usageRes.data) {
          usageMap[row.plan_id] = { units_used: row.units_used, units_remaining: row.units_remaining };
        }
      }

      const enriched: Plan[] = (plansRes.data || []).map(p => ({
        ...p,
        units_used: usageMap[p.id]?.units_used ?? 0,
        units_remaining: usageMap[p.id]?.units_remaining ?? null,
      }));

      setPlans(enriched);
    } catch (err: any) {
      console.error("Error fetching plans:", err);
      setError("No se pudieron cargar los planes: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const dailyRoi = Number(formData.daily_roi_percent) || 2.2;
    const planData = {
      name: formData.name,
      roi_percentage: formData.roi_percentage,
      min_amount: formData.min_amount,
      status: formData.status,
      daily_roi_percent: dailyRoi,
      max_return_percent: formData.roi_percentage,
      duration_days: Math.ceil(formData.roi_percentage / dailyRoi),
      max_units: formData.max_units === '' ? null : Number(formData.max_units)
    };

    try {
      if (editingPlanId) {
        const { data, error } = await supabase
          .from('plans')
          .update(planData)
          .eq('id', editingPlanId)
          .select();

        if (error) throw error;
        if (data) {
          setPlans(prev => prev.map(p => p.id === editingPlanId ? { ...data[0], units_used: p.units_used, units_remaining: p.units_remaining } : p));
        }
        alert("✅ Estrategia actualizada.");
      } else {
        const { data, error } = await supabase
          .from('plans')
          .insert([planData])
          .select();

        if (error) throw error;
        if (data) setPlans(prev => [...prev, { ...data[0], units_used: 0, units_remaining: data[0].max_units }]);
        alert("✅ Nueva variante de estrategia creada.");
      }
      resetForm();
    } catch (err: any) {
      console.error("Save Plan Error:", err);
      setError(err.message || "Error al sincronizar la estrategia.");
    } finally {
      setSaving(false);
    }
  };

  const handleEditPlan = (plan: Plan) => {
    setFormData({
      name: plan.name,
      roi_percentage: plan.roi_percentage,
      duration_days: plan.duration_days,
      min_amount: plan.min_amount,
      daily_roi_percent: plan.daily_roi_percent ?? 2.2,
      max_units: plan.max_units ?? '',
      status: plan.status as 'active' | 'inactive'
    });
    setEditingPlanId(plan.id);
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: 'GK GEMINIX Standard ROI',
      roi_percentage: 200,
      duration_days: 91,
      min_amount: 5,
      daily_roi_percent: 2.2,
      max_units: '',
      status: 'active'
    });
    setEditingPlanId(null);
    setIsModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Estás seguro de eliminar esta estrategia? Esto podría romper inversiones activas ligadas a este plan.")) return;

    try {
      const { count, error: countErr } = await supabase
        .from('investments')
        .select('*', { count: 'exact', head: true })
        .eq('plan_id', id);

      if (countErr) throw countErr;

      if (count && count > 0) {
        alert(`⚠️ No se puede eliminar: Hay ${count} inversiones activas usando este plan. Desactívalo en su lugar.`);
        return;
      }

      const { error } = await supabase.from('plans').delete().eq('id', id);
      if (error) throw error;

      setPlans(prev => prev.filter(p => p.id !== id));
      alert("🗑️ Plan eliminado correctamente.");

    } catch (err: any) {
      console.error("Delete Plan Error:", err);
      setError("No se pudo eliminar el plan: " + err.message);
    }
  };

  const dailyRoi = Number(formData.daily_roi_percent) || 2.2;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-50 tracking-tight flex items-center gap-3">
            <ShieldCheck className="text-indigo-500" size={36} />
            Investment Strategy
          </h1>
          <p className="text-slate-400 font-medium mt-1">Configuración del motor de rentabilidad única del ecosistema.</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="hidden lg:flex items-center space-x-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
            <Zap size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest">{plans.length} Plan(es) Activos</span>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center space-x-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[1.5rem] font-black uppercase text-xs tracking-widest shadow-2xl shadow-indigo-600/20 transition-all active:scale-95"
          >
            <Plus size={20} />
            <span>Añadir Plan</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 p-5 rounded-2xl flex items-center space-x-4 text-rose-500 animate-in slide-in-from-top-2">
          <AlertCircle size={24} />
          <span className="font-bold">{error}</span>
        </div>
      )}

      {/* Main Strategy Banner */}
      <div className="bg-indigo-600/5 border border-indigo-500/20 p-8 rounded-[2.5rem] flex flex-col md:flex-row items-center gap-8 shadow-inner">
        <div className="w-24 h-24 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-white shadow-2xl shadow-indigo-600/30 shrink-0">
          <TrendingUp size={48} />
        </div>
        <div className="flex-1 space-y-2 text-center md:text-left">
          <h2 className="text-2xl font-black text-white">Estrategia de Crecimiento GK GEMINIX</h2>
          <p className="text-slate-400 font-medium max-w-2xl">
            Múltiples planes con diferentes tasas de rendimiento diario. Los planes con cupos limitados se bloquean automáticamente cuando se agotan.
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl text-center min-w-[180px]">
          <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest mb-1">Planes Totales</p>
          <p className="text-4xl font-black text-white tracking-tighter">{plans.length}</p>
          <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">Configurados</p>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {loading ? (
          <div className="col-span-full py-32 text-center">
            <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mx-auto mb-4" />
            <p className="text-slate-500 font-black uppercase text-xs tracking-[0.2em]">Sincronizando Libro de Planes...</p>
          </div>
        ) : plans.length === 0 ? (
          <div className="col-span-full py-24 text-center bg-slate-900 border border-slate-800 rounded-[3rem]">
            <Briefcase size={64} className="mx-auto text-slate-800 mb-6" />
            <p className="text-slate-500 font-black uppercase tracking-widest">No hay estrategias configuradas.</p>
          </div>
        ) : plans.map((plan) => {
          const isLimited = plan.max_units != null;
          const unitsUsed = plan.units_used ?? 0;
          const unitsTotal = plan.max_units ?? 0;
          const unitsRemaining = isLimited ? Math.max(unitsTotal - unitsUsed, 0) : null;
          const isSoldOut = isLimited && unitsRemaining === 0;
          const usagePct = isLimited ? Math.min((unitsUsed / unitsTotal) * 100, 100) : 0;

          return (
            <div key={plan.id} className={`bg-slate-900 border rounded-[3rem] p-10 relative overflow-hidden group transition-all duration-500 shadow-2xl flex flex-col h-full ${isSoldOut ? 'border-rose-500/30 opacity-70' : 'border-slate-800 hover:border-indigo-500/50'}`}>
              {/* Background Accent */}
              <div className={`absolute -top-10 -right-10 w-40 h-40 blur-[60px] rounded-full transition-all ${isSoldOut ? 'bg-rose-600/10' : 'bg-indigo-600/10 group-hover:bg-indigo-600/20'}`}></div>

              {/* Limited badge */}
              {isLimited && (
                <div className={`absolute top-6 right-6 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${isSoldOut ? 'bg-rose-500/20 border-rose-500/30 text-rose-400' : 'bg-amber-500/20 border-amber-500/30 text-amber-400'}`}>
                  <Lock size={10} />
                  {isSoldOut ? 'AGOTADO' : `${unitsRemaining}/${unitsTotal} CUPOS`}
                </div>
              )}

              <div className="flex justify-between items-start mb-8 relative">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-xl font-black text-white tracking-tight leading-none">{plan.name}</h3>
                  </div>
                  <StatusBadge status={plan.status} />
                </div>
                <div className="text-right">
                  <span className="text-5xl font-black text-indigo-400 tracking-tighter tabular-nums">{plan.roi_percentage}%</span>
                  <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-black mt-2">CAP FINAL</p>
                </div>
              </div>

              <div className="space-y-4 mb-10 relative flex-1">
                <div className="bg-slate-800/30 p-5 rounded-[2rem] border border-slate-800/50 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400"><Clock size={18} /></div>
                    <div>
                      <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Duración Estimada</p>
                      <p className="text-lg font-black text-slate-100">~{plan.duration_days} Días</p>
                    </div>
                  </div>
                  <ArrowUpRight className="text-slate-700" size={20} />
                </div>

                <div className="bg-slate-800/30 p-5 rounded-[2rem] border border-slate-800/50 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400"><DollarSign size={18} /></div>
                    <div>
                      <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Entrada Mínima</p>
                      <p className="text-lg font-black text-emerald-400 tabular-nums">${plan.min_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                  <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-1 rounded-lg font-bold">USD</span>
                </div>

                <div className="px-5 py-4 bg-indigo-600/5 border border-indigo-500/10 rounded-2xl flex items-center gap-3">
                  <Info size={16} className="text-indigo-400 shrink-0" />
                  <p className="text-[9px] text-slate-400 font-bold uppercase leading-tight tracking-tight">
                    {plan.daily_roi_percent ?? 2.2}% diario · Meta {plan.roi_percentage}% total
                  </p>
                </div>

                {/* Units progress bar for limited plans */}
                {isLimited && (
                  <div className="px-5 py-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] text-amber-400 font-black uppercase tracking-widest">Cupos Usados</span>
                      <span className="text-[9px] text-slate-400 font-bold">{unitsUsed} / {unitsTotal}</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${isSoldOut ? 'bg-rose-500' : usagePct > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${usagePct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-3 pt-8 border-t border-slate-800 relative mt-auto">
                <button
                  onClick={() => handleEditPlan(plan)}
                  className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center space-x-2 active:scale-95 border border-slate-700/50"
                >
                  <Edit2 size={16} />
                  <span>Configurar</span>
                </button>
                <button
                  onClick={() => handleDelete(plan.id)}
                  className="p-4 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 rounded-2xl transition-all active:scale-95 border border-rose-500/20"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* CREATE/EDIT PLAN MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
            <div className="p-10 border-b border-slate-800 flex items-center justify-between bg-gradient-to-br from-slate-900 to-indigo-900/10">
              <div className="flex items-center space-x-5">
                <div className="p-4 bg-indigo-600 rounded-3xl text-white shadow-2xl shadow-indigo-600/30">
                  <Plus size={32} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white">Configuración ROI</h3>
                  <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">Ajuste de Parámetros de Retorno</p>
                </div>
              </div>
              <button
                onClick={resetForm}
                className="p-3 text-slate-500 hover:text-white rounded-2xl transition-all hover:bg-slate-800"
              >
                <X size={28} />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="p-10 space-y-8">
              {/* Plan name */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Etiqueta de Estrategia</label>
                <div className="relative group">
                  <Briefcase className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-500 transition-colors" size={20} />
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: Triple Elite 3%"
                    className="w-full bg-[#16161c] border border-slate-800/80 rounded-2xl py-5 pl-14 pr-6 text-white font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner"
                  />
                </div>
              </div>

              {/* ROI + Min amount */}
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Meta ROI Total (%)</label>
                  <div className="relative group">
                    <Target className="absolute left-5 top-1/2 -translate-y-1/2 text-indigo-500/50 group-focus-within:text-indigo-500 transition-colors" size={20} />
                    <input
                      type="number"
                      required
                      min="100"
                      value={formData.roi_percentage}
                      onChange={e => setFormData({ ...formData, roi_percentage: parseFloat(e.target.value) })}
                      className="w-full bg-[#16161c] border border-slate-800/80 rounded-2xl py-5 pl-14 pr-6 text-white font-black text-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner tabular-nums"
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Mínimo de Entrada ($)</label>
                  <div className="relative group">
                    <DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 text-emerald-500/50 group-focus-within:text-emerald-500 transition-colors" size={20} />
                    <input
                      type="number"
                      required
                      min="1"
                      value={formData.min_amount}
                      onChange={e => setFormData({ ...formData, min_amount: parseFloat(e.target.value) })}
                      className="w-full bg-[#16161c] border border-slate-800/80 rounded-2xl py-5 pl-14 pr-6 text-emerald-400 font-black text-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all shadow-inner tabular-nums"
                    />
                  </div>
                </div>
              </div>

              {/* Daily ROI % + Max Units */}
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">ROI Diario (%)</label>
                  <div className="relative group">
                    <TrendingUp className="absolute left-5 top-1/2 -translate-y-1/2 text-amber-500/50 group-focus-within:text-amber-500 transition-colors" size={20} />
                    <input
                      type="number"
                      required
                      min="0.1"
                      step="0.1"
                      value={formData.daily_roi_percent}
                      onChange={e => setFormData({ ...formData, daily_roi_percent: parseFloat(e.target.value) })}
                      className="w-full bg-[#16161c] border border-slate-800/80 rounded-2xl py-5 pl-14 pr-6 text-amber-400 font-black text-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all shadow-inner tabular-nums"
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Cupos Máx (vacío = ilimitado)</label>
                  <div className="relative group">
                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-rose-500/50 group-focus-within:text-rose-500 transition-colors" size={20} />
                    <input
                      type="number"
                      min="1"
                      value={formData.max_units}
                      onChange={e => setFormData({ ...formData, max_units: e.target.value })}
                      placeholder="Sin límite"
                      className="w-full bg-[#16161c] border border-slate-800/80 rounded-2xl py-5 pl-14 pr-6 text-rose-400 font-black text-xl focus:ring-2 focus:ring-rose-500 outline-none transition-all shadow-inner tabular-nums placeholder:text-slate-700"
                    />
                  </div>
                </div>
              </div>

              {/* Projection preview */}
              <div className="bg-[#111114] p-8 rounded-[2.5rem] border border-slate-800/50 shadow-inner">
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-5">Proyección de Sistema</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-slate-800 rounded-2xl text-indigo-400">
                      <Clock size={24} />
                    </div>
                    <div>
                      <p className="text-xl font-black text-white italic tracking-tight">
                        Ciclo de {Math.ceil(formData.roi_percentage / dailyRoi)} días
                      </p>
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">
                        Basado en {dailyRoi}% diario
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-emerald-500 font-black text-xl italic">Habilitado</p>
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Estado Global</p>
                  </div>
                </div>
              </div>

              <div className="pt-6 flex space-x-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 py-5 bg-slate-900 text-slate-400 rounded-3xl font-black uppercase text-xs tracking-widest hover:bg-slate-800 transition-all active:scale-95 border border-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-[2] py-5 bg-indigo-600 text-white rounded-3xl font-black uppercase text-xs tracking-widest shadow-2xl shadow-indigo-600/20 transition-all flex items-center justify-center space-x-3 active:scale-95 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="animate-spin" size={24} /> : <><Save size={24} /><span>Sincronizar Estrategia</span></>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Plans;
