import React, { useEffect, useState } from 'react';
import { Clock, DollarSign, Edit2, Loader2, Save, ShieldCheck, TrendingUp, X } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Plan } from '../types';

const Plans: React.FC = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadPlans = async () => {
    setLoading(true);
    setError('');
    if (!isSupabaseConfigured()) {
      setError('Faltan las credenciales de Supabase.');
      setLoading(false);
      return;
    }
    const { data, error: queryError } = await supabase.from('plans').select('*').order('display_order');
    if (queryError) setError(queryError.message);
    else setPlans((data || []) as Plan[]);
    setLoading(false);
  };

  useEffect(() => { void loadPlans(); }, []);

  const savePlan = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    if (editing.roi_min_percentage <= 0 || editing.roi_max_percentage < editing.roi_min_percentage) {
      setError('El rango de ROI no es válido.');
      return;
    }
    setSaving(true);
    setError('');
    const { error: updateError } = await supabase.from('plans').update({
      name: editing.name,
      description: editing.description,
      roi_min_percentage: editing.roi_min_percentage,
      roi_max_percentage: editing.roi_max_percentage,
      min_amount: editing.min_amount,
      max_amount: editing.max_amount,
      status: editing.status,
    }).eq('id', editing.id);
    setSaving(false);
    if (updateError) setError(updateError.message);
    else {
      setEditing(null);
      await loadPlans();
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-5">
        <div>
          <h1 className="flex items-center gap-3 text-4xl font-black text-white"><ShieldCheck className="text-indigo-400" /> Planes ROI</h1>
          <p className="mt-2 text-slate-400">Cuatro ciclos oficiales. Cada nodo requiere activación diaria de lunes a viernes.</p>
        </div>
        <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/10 px-5 py-3 text-sm font-black text-indigo-300">{plans.length} planes configurados</div>
      </header>

      {error && <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-rose-300">{error}</div>}

      {loading ? (
        <div className="py-28 text-center"><Loader2 className="mx-auto animate-spin text-indigo-400" size={42} /></div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 2xl:grid-cols-4">
          {plans.map(plan => (
            <article key={plan.id} className="flex min-h-[410px] flex-col rounded-[2rem] border border-slate-800 bg-slate-900 p-8 shadow-2xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-400">{plan.code}</p>
                  <h2 className="mt-2 text-2xl font-black text-white">{plan.name}</h2>
                </div>
                <span className={`rounded-xl px-3 py-1 text-[10px] font-black uppercase ${plan.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>{plan.status}</span>
              </div>
              <div className="mt-8 text-5xl font-black tracking-tight text-indigo-400">{plan.roi_min_percentage}%–{plan.roi_max_percentage}%</div>
              <p className="mt-2 text-sm text-slate-500">Rango diario asignado al activar el contrato</p>
              <p className="mt-6 text-sm leading-relaxed text-slate-300">{plan.description}</p>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-slate-800 bg-black/20 p-4">
                  <Clock size={17} className="text-indigo-400" />
                  <p className="mt-2 text-[10px] uppercase text-slate-500">Plazo</p>
                  <p className="font-black text-white">{plan.duration_business_days ? `${plan.duration_business_days} días hábiles` : 'Sin plazo'}</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-black/20 p-4">
                  <DollarSign size={17} className="text-emerald-400" />
                  <p className="mt-2 text-[10px] uppercase text-slate-500">Mínimo</p>
                  <p className="font-black text-white">${plan.min_amount.toFixed(2)}</p>
                </div>
              </div>

              <button onClick={() => setEditing(plan)} className="mt-auto flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-4 text-xs font-black uppercase tracking-widest text-white hover:bg-indigo-500">
                <Edit2 size={16} /> Configurar
              </button>
            </article>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-lg">
          <form onSubmit={savePlan} className="max-h-[90vh] w-full max-w-2xl space-y-6 overflow-y-auto rounded-[2rem] border border-slate-800 bg-slate-900 p-8">
            <div className="flex items-center justify-between">
              <div><p className="text-xs font-black text-indigo-400">{editing.code}</p><h2 className="text-2xl font-black text-white">Configurar plan</h2></div>
              <button type="button" onClick={() => setEditing(null)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><X /></button>
            </div>
            <label className="block text-sm text-slate-400">Nombre<input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-4 text-white" /></label>
            <label className="block text-sm text-slate-400">Descripción<textarea value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} className="mt-2 min-h-24 w-full rounded-xl border border-slate-700 bg-slate-950 p-4 text-white" /></label>
            <div className="grid grid-cols-2 gap-4">
              <label className="text-sm text-slate-400">ROI mínimo %<input type="number" step="0.001" value={editing.roi_min_percentage} onChange={e => setEditing({ ...editing, roi_min_percentage: Number(e.target.value) })} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-4 text-white" /></label>
              <label className="text-sm text-slate-400">ROI máximo %<input type="number" step="0.001" value={editing.roi_max_percentage} onChange={e => setEditing({ ...editing, roi_max_percentage: Number(e.target.value) })} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-4 text-white" /></label>
              <label className="text-sm text-slate-400">Monto mínimo<input type="number" min="10" step="0.01" value={editing.min_amount} onChange={e => setEditing({ ...editing, min_amount: Number(e.target.value) })} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-4 text-white" /></label>
              <label className="text-sm text-slate-400">Estado<select value={editing.status} onChange={e => setEditing({ ...editing, status: e.target.value as Plan['status'] })} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-4 text-white"><option value="active">Activo</option><option value="inactive">Inactivo</option></select></label>
            </div>
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200"><TrendingUp className="mr-2 inline" size={17} />Regla de Oro: si se omite un día hábil, el contador y el ROI pendiente del ciclo se reinician.</div>
            <button disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-5 text-sm font-black uppercase tracking-widest text-white disabled:opacity-50">{saving ? <Loader2 className="animate-spin" /> : <Save />} Guardar cambios</button>
          </form>
        </div>
      )}
    </div>
  );
};

export default Plans;
