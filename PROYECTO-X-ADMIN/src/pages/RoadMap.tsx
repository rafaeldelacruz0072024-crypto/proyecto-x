import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  Map, Plus, Trash2, Edit3, Check, X, Clock,
  ChevronRight, Zap, Globe, DollarSign, RefreshCw,
  Target, TrendingUp, Save, AlertCircle
} from 'lucide-react';

interface RoadmapItem {
  id: string;
  phase: number;
  title: string;
  description: string | null;
  icon: string;
  status: 'planned' | 'in_progress' | 'done';
  sort_order: number;
  created_at: string;
}

interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

const PHASE2_DURATION_DAYS = 60;

const iconOptions = ['📈','🌐','💰','🔄','🎯','⚡','🚀','🔷','💎','🏆','🔑','📊','🛡️','🌟','💡'];
const statusColors: Record<string, string> = {
  planned:     'bg-slate-800 text-slate-400 border-slate-700',
  in_progress: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  done:        'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};
const statusLabels: Record<string, string> = {
  planned:     'Planificado',
  in_progress: 'En Progreso',
  done:        'Completado',
};

// ── Phase 1 hardcoded items (current state)
const PHASE1_ITEMS = [
  { icon: '📊', title: 'Pasivo PROYECTO X GOLD', desc: '+1000% auditado Myfxbook 2025 · 5 IAs XAU/USD' },
  { icon: '🌐', title: '30 Niveles de Referidos', desc: 'Comisiones residuales según Regla de Oro oficial' },
  { icon: '💰', title: 'Salario Semanal', desc: 'Pago cada Sábado a miembros activos calificados' },
  { icon: '🎯', title: 'Predicciones V1', desc: 'Módulo de mercados de predicción activo' },
  { icon: '💎', title: 'Sistema de Créditos', desc: 'Créditos internos para operaciones dentro del ecosistema' },
];

export default function RoadMap() {
  const [items, setItems]           = useState<RoadmapItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [countdown, setCountdown]   = useState<Countdown>({ days: 60, hours: 0, minutes: 0, seconds: 0, total: 0 });
  const [startDate, setStartDate]   = useState<Date | null>(null);
  const [showModal, setShowModal]   = useState(false);
  const [editItem, setEditItem]     = useState<RoadmapItem | null>(null);
  const [saving, setSaving]         = useState(false);
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const [form, setForm] = useState({
    title: '', description: '', icon: '🔷', status: 'planned' as RoadmapItem['status'], phase: 2,
  });

  // ── Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsRes, settingsRes] = await Promise.all([
        supabase.from('roadmap_items').select('*').order('phase').order('sort_order'),
        supabase.from('system_settings').select('phase2_start_date').limit(1).single(),
      ]);
      if (itemsRes.data) setItems(itemsRes.data);
      if (settingsRes.data?.phase2_start_date) {
        setStartDate(new Date(settingsRes.data.phase2_start_date));
      } else {
        setStartDate(new Date());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Countdown timer
  useEffect(() => {
    if (!startDate) return;
    const target = new Date(startDate.getTime() + PHASE2_DURATION_DAYS * 24 * 60 * 60 * 1000);

    const tick = () => {
      const now  = new Date();
      const diff = target.getTime() - now.getTime();
      if (diff <= 0) {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 });
        return;
      }
      setCountdown({
        total:   diff,
        days:    Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours:   Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startDate]);

  // ── Helpers
  const notify = (msg: string, type: 'success' | 'error') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const openCreate = () => {
    setEditItem(null);
    setForm(f => ({ title: '', description: '', icon: '🔷', status: 'planned', phase: f.phase || 1 }));
    setShowModal(true);
  };

  const openEdit = (item: RoadmapItem) => {
    setEditItem(item);
    setForm({ title: item.title, description: item.description || '', icon: item.icon, status: item.status, phase: item.phase });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      if (editItem) {
        const { error } = await supabase.from('roadmap_items')
          .update({ title: form.title, description: form.description, icon: form.icon, status: form.status, phase: form.phase })
          .eq('id', editItem.id);
        if (error) throw error;
        notify('Item actualizado', 'success');
      } else {
        const maxOrder = items.filter(i => i.phase === form.phase).length + 1;
        const { error } = await supabase.from('roadmap_items')
          .insert({ title: form.title, description: form.description, icon: form.icon, status: form.status, phase: form.phase, sort_order: maxOrder });
        if (error) throw error;
        notify('Item agregado', 'success');
      }
      setShowModal(false);
      fetchData();
    } catch (e: any) {
      notify(e.message || 'Error al guardar', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este item?')) return;
    const { error } = await supabase.from('roadmap_items').delete().eq('id', id);
    if (error) { notify('Error al eliminar', 'error'); return; }
    notify('Item eliminado', 'success');
    fetchData();
  };

  const toggleStatus = async (item: RoadmapItem) => {
    const next: Record<string, RoadmapItem['status']> = { planned: 'in_progress', in_progress: 'done', done: 'planned' };
    await supabase.from('roadmap_items').update({ status: next[item.status] }).eq('id', item.id);
    fetchData();
  };

  const resetCountdown = async () => {
    const now = new Date().toISOString();
    await supabase.from('system_settings').update({ phase2_start_date: now });
    setStartDate(new Date());
    notify('Contador reiniciado a 60 días', 'success');
  };

  const phase1Items = items.filter(i => i.phase === 1);
  const phase2Items = items.filter(i => i.phase === 2);
  const phase3Items = items.filter(i => i.phase === 3);
  const progressPct = Math.max(0, Math.min(100, Math.round(((PHASE2_DURATION_DAYS * 86400 - countdown.total / 1000) / (PHASE2_DURATION_DAYS * 86400)) * 100)));

  // ─────────────────────────────────────────────
  return (
    <div className="p-6 space-y-8 animate-in fade-in duration-700">

      {/* Notification */}
      {notification && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl border text-sm font-bold shadow-2xl transition-all ${notification.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
          {notification.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
          {notification.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Map size={22} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white uppercase tracking-widest">Road Map</h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Plan de evolución del protocolo PROYECTO X</p>
          </div>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95">
          <Plus size={16} /> Agregar Paso
        </button>
      </div>

      {/* ── COUNTDOWN ──────────────────────────────── */}
      <div className="relative bg-[#111114] border border-slate-800/50 rounded-3xl p-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 via-transparent to-indigo-600/5 pointer-events-none" />
        <div className="absolute top-4 right-4">
          <button onClick={resetCountdown} title="Reiniciar contador" className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all">
            <RefreshCw size={12} /> Reset
          </button>
        </div>

        <div className="text-center mb-6">
          <p className="text-[10px] text-blue-400 font-black uppercase tracking-[0.3em] mb-1">Transición a</p>
          <h2 className="text-3xl font-black text-white uppercase tracking-widest">FASE 2</h2>
          <p className="text-slate-500 text-xs mt-1 font-bold">Contador de {PHASE2_DURATION_DAYS} días activo</p>
        </div>

        {/* Timer blocks */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {[
            { value: countdown.days,    label: 'DÍAS' },
            { value: countdown.hours,   label: 'HORAS' },
            { value: countdown.minutes, label: 'MIN' },
            { value: countdown.seconds, label: 'SEG' },
          ].map(({ value, label }, i) => (
            <React.Fragment key={label}>
              <div className="text-center">
                <div className="w-20 h-20 md:w-24 md:h-24 bg-black border border-slate-800 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/5 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent" />
                  <span className="text-3xl md:text-4xl font-black text-white font-mono relative z-10">
                    {String(value).padStart(2, '0')}
                  </span>
                </div>
                <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mt-2">{label}</p>
              </div>
              {i < 3 && <span className="text-2xl font-black text-slate-700 mb-6">:</span>}
            </React.Fragment>
          ))}
        </div>

        {/* Progress bar */}
        <div className="max-w-lg mx-auto">
          <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
            <span>Fase 1 — Activa</span>
            <span>{progressPct}% transcurrido</span>
            <span>Fase 2</span>
          </div>
          <div className="h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full transition-all duration-1000 relative"
              style={{ width: `${progressPct}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
            </div>
          </div>
        </div>
      </div>

      {/* ── FASES ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* FASE 1 */}
        <div className="bg-[#111114] border border-emerald-500/20 rounded-3xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-400 rounded-t-3xl" />
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Check size={18} className="text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-widest">Fase 1</h3>
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">● Activa Ahora</span>
              </div>
            </div>
            <button onClick={() => { setForm(f => ({ ...f, phase: 1 })); openCreate(); }}
              className="p-2 hover:bg-emerald-500/10 text-slate-600 hover:text-emerald-400 rounded-xl transition-colors" title="Agregar a Fase 1">
              <Plus size={15} />
            </button>
          </div>
          {loading ? (
            <div className="space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-slate-900/50 rounded-xl animate-pulse" />)}</div>
          ) : (
            <div className="space-y-3">
              {phase1Items.map((item) => (
                <div key={item.id} className="flex items-start gap-3 p-3 bg-black/30 rounded-xl border border-slate-800/50 group hover:border-emerald-500/20 transition-colors">
                  <span className="text-xl mt-0.5 cursor-pointer" onClick={() => toggleStatus(item)} title="Click para cambiar estado">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-white truncate">{item.title}</p>
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border ${statusColors[item.status]}`}>
                        {statusLabels[item.status]}
                      </span>
                    </div>
                    {item.description && <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{item.description}</p>}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(item)} className="p-1.5 hover:bg-emerald-500/10 text-slate-500 hover:text-emerald-400 rounded-lg transition-colors"><Edit3 size={13} /></button>
                    <button onClick={() => handleDelete(item.id)} className="p-1.5 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 rounded-lg transition-colors"><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
              {phase1Items.length === 0 && (
                <div className="text-center py-8 text-slate-600">
                  <Map size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-xs font-bold uppercase tracking-widest">Sin pasos agregados</p>
                  <p className="text-[10px] mt-1">Haz clic en "+" para agregar</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* FASE 2 */}
        <div className="bg-[#111114] border border-blue-500/20 rounded-3xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-400 rounded-t-3xl" />
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <Clock size={18} className="text-blue-400" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-widest">Fase 2</h3>
                <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">⏳ Próximamente</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 font-bold bg-slate-900 border border-slate-800 rounded-xl px-2 py-1">{countdown.days}d</span>
              <button onClick={() => { setForm(f => ({ ...f, phase: 2 })); openCreate(); }}
                className="p-2 hover:bg-blue-500/10 text-slate-600 hover:text-blue-400 rounded-xl transition-colors" title="Agregar a Fase 2">
                <Plus size={15} />
              </button>
            </div>
          </div>
          {loading ? (
            <div className="space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-slate-900/50 rounded-xl animate-pulse" />)}</div>
          ) : (
            <div className="space-y-3">
              {phase2Items.map((item) => (
                <div key={item.id} className="flex items-start gap-3 p-3 bg-black/30 rounded-xl border border-slate-800/50 group hover:border-blue-500/20 transition-colors">
                  <span className="text-xl mt-0.5 cursor-pointer" onClick={() => toggleStatus(item)} title="Click para cambiar estado">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-white truncate">{item.title}</p>
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border ${statusColors[item.status]}`}>
                        {statusLabels[item.status]}
                      </span>
                    </div>
                    {item.description && <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{item.description}</p>}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(item)} className="p-1.5 hover:bg-blue-500/10 text-slate-500 hover:text-blue-400 rounded-lg transition-colors"><Edit3 size={13} /></button>
                    <button onClick={() => handleDelete(item.id)} className="p-1.5 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 rounded-lg transition-colors"><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
              {phase2Items.length === 0 && (
                <div className="text-center py-8 text-slate-600">
                  <Map size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-xs font-bold uppercase tracking-widest">Sin pasos agregados</p>
                  <p className="text-[10px] mt-1">Haz clic en "+" para agregar</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* FASE 3 */}
        <div className="bg-[#111114] border border-purple-500/20 rounded-3xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-violet-400 rounded-t-3xl" />
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                <Zap size={18} className="text-purple-400" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-widest">Fase 3</h3>
                <span className="text-[10px] text-purple-400 font-bold uppercase tracking-widest">🔮 Visión Futura</span>
              </div>
            </div>
            <button onClick={() => { setForm(f => ({ ...f, phase: 3 })); openCreate(); }}
              className="p-2 hover:bg-purple-500/10 text-slate-600 hover:text-purple-400 rounded-xl transition-colors" title="Agregar a Fase 3">
              <Plus size={15} />
            </button>
          </div>
          {loading ? (
            <div className="space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-slate-900/50 rounded-xl animate-pulse" />)}</div>
          ) : (
            <div className="space-y-3">
              {phase3Items.map((item) => (
                <div key={item.id} className="flex items-start gap-3 p-3 bg-black/30 rounded-xl border border-slate-800/50 group hover:border-purple-500/20 transition-colors">
                  <span className="text-xl mt-0.5 cursor-pointer" onClick={() => toggleStatus(item)} title="Click para cambiar estado">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-white truncate">{item.title}</p>
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border ${statusColors[item.status]}`}>
                        {statusLabels[item.status]}
                      </span>
                    </div>
                    {item.description && <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{item.description}</p>}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(item)} className="p-1.5 hover:bg-purple-500/10 text-slate-500 hover:text-purple-400 rounded-lg transition-colors"><Edit3 size={13} /></button>
                    <button onClick={() => handleDelete(item.id)} className="p-1.5 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 rounded-lg transition-colors"><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
              {phase3Items.length === 0 && (
                <div className="text-center py-8 text-slate-600">
                  <Map size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-xs font-bold uppercase tracking-widest">Sin pasos agregados</p>
                  <p className="text-[10px] mt-1">Haz clic en "+" para agregar</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── MIND MAP ───────────────────────────────── */}
      <div className="bg-[#111114] border border-slate-800/50 rounded-3xl p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <TrendingUp size={16} className="text-indigo-400" />
          </div>
          <h3 className="text-sm font-black text-white uppercase tracking-widest">Mapa Mental — Visión del Protocolo</h3>
        </div>

        <div className="relative overflow-x-auto">
          <div className="min-w-[700px]">
            {/* SVG connecting lines */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
              {/* Center to Phase 1 */}
              <line x1="50%" y1="50%" x2="18%" y2="30%" stroke="#10b981" strokeWidth="1.5" strokeDasharray="6,4" opacity="0.4" />
              {/* Center to Phase 2 */}
              <line x1="50%" y1="50%" x2="82%" y2="30%" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="6,4" opacity="0.4" />
              {/* Center to Future */}
              <line x1="50%" y1="50%" x2="50%" y2="85%" stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="6,4" opacity="0.4" />
            </svg>

            <div className="relative z-10 grid grid-rows-3 gap-6" style={{ minHeight: 480 }}>

              {/* Row 1: Phase 1 — Center — Phase 2 */}
              <div className="grid grid-cols-3 gap-6 items-center">

                {/* Phase 1 mini-map */}
                <div className="bg-black/40 border border-emerald-500/20 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <Check size={12} className="text-emerald-400" />
                    </div>
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Fase 1 · Activa</span>
                  </div>
                  <div className="space-y-1.5">
                    {(phase1Items.length > 0 ? phase1Items : PHASE1_ITEMS.map((item, i) => ({ id: `s${i}`, icon: item.icon, title: item.title }))).slice(0, 5).map((item) => (
                      <div key={item.id} className="flex items-center gap-2">
                        <span className="text-sm">{item.icon}</span>
                        <span className="text-[10px] text-slate-400 font-bold truncate">{item.title}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CENTER NODE */}
                <div className="flex items-center justify-center">
                  <div className="relative">
                    <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-2xl scale-150 animate-pulse" />
                    <div className="relative w-36 h-36 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 border-2 border-blue-400/50 flex flex-col items-center justify-center shadow-2xl shadow-blue-500/30">
                      <span className="text-2xl mb-1">💎</span>
                      <span className="text-white font-black text-xs uppercase tracking-widest leading-tight text-center">PROYECTO X<br/>PROTOCOL</span>
                    </div>
                  </div>
                </div>

                {/* Phase 2 mini-map */}
                <div className="bg-black/40 border border-blue-500/20 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Clock size={12} className="text-blue-400" />
                    </div>
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Fase 2 · {countdown.days}d</span>
                  </div>
                  <div className="space-y-1.5">
                    {phase2Items.slice(0, 5).map((item) => (
                      <div key={item.id} className="flex items-center gap-2">
                        <span className="text-sm">{item.icon}</span>
                        <span className="text-[10px] text-slate-400 font-bold truncate">{item.title}</span>
                      </div>
                    ))}
                    {phase2Items.length === 0 && (
                      <p className="text-[10px] text-slate-600 italic">Sin pasos definidos</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 2: Feature nodes */}
              <div className="grid grid-cols-5 gap-3 px-4">
                {[
                  { icon: '📈', label: '1.1%\nDiario', color: 'emerald' },
                  { icon: '🌐', label: '15 Niv.\nReferidos', color: 'blue' },
                  { icon: '💰', label: 'Salario\nQuincenal', color: 'amber' },
                  { icon: '🔄', label: 'Fee 10%\nCrédito', color: 'rose' },
                  { icon: '🎯', label: 'Predict.\nV2', color: 'purple' },
                ].map((node, i) => (
                  <div key={i} className={`flex flex-col items-center gap-2 p-4 bg-black/40 border rounded-2xl border-${node.color}-500/20 hover:border-${node.color}-500/40 transition-colors`}>
                    <span className="text-2xl">{node.icon}</span>
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest text-center whitespace-pre-line leading-tight">
                      {node.label}
                    </p>
                    <div className={`w-1.5 h-1.5 rounded-full bg-${node.color}-400 animate-pulse`} />
                  </div>
                ))}
              </div>

              {/* Row 3: Phase 3 — dynamic from DB */}
              <div className="flex items-center justify-center">
                <div className="bg-black/40 border border-purple-500/20 rounded-2xl px-8 py-5 text-center max-w-2xl w-full">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <Zap size={16} className="text-purple-400" />
                    <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Fase 3 — Visión Futura</span>
                  </div>
                  {phase3Items.length > 0 ? (
                    <div className="flex flex-wrap justify-center gap-3">
                      {phase3Items.map(item => (
                        <div key={item.id} className="flex items-center gap-2 bg-black/30 border border-purple-500/10 rounded-xl px-3 py-2 group">
                          <span className="text-base">{item.icon}</span>
                          <span className="text-[10px] font-bold text-slate-400">{item.title}</span>
                          <button onClick={() => openEdit(item)} className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-purple-400 text-slate-600 transition-all">
                            <Edit3 size={10} />
                          </button>
                          <button onClick={() => handleDelete(item.id)} className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-rose-400 text-slate-600 transition-all">
                            <Trash2 size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-600 text-[11px] font-bold italic">
                      Sin pasos definidos para Fase 3 — agrégalos desde el botón "Agregar Paso"
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── MODAL ──────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111114] border border-slate-800 rounded-3xl p-8 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-black text-white uppercase tracking-widest">
                {editItem ? 'Editar Paso' : 'Nuevo Paso'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-800 text-slate-500 hover:text-white rounded-xl transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-5">
              {/* Phase */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Fase</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { p: 1, color: 'emerald' },
                    { p: 2, color: 'blue' },
                    { p: 3, color: 'purple' },
                  ].map(({ p, color }) => (
                    <button key={p} onClick={() => setForm(f => ({ ...f, phase: p }))}
                      className={`py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all border ${form.phase === p ? `bg-${color}-500/10 border-${color}-500/30 text-${color}-400` : 'border-slate-800 text-slate-500 hover:border-slate-700'}`}>
                      Fase {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Icon */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Ícono</label>
                <div className="flex flex-wrap gap-2">
                  {iconOptions.map(ic => (
                    <button key={ic} onClick={() => setForm(f => ({ ...f, icon: ic }))}
                      className={`text-xl p-2 rounded-xl transition-all border ${form.icon === ic ? 'bg-blue-500/10 border-blue-500/30 scale-110' : 'border-slate-800 hover:border-slate-700'}`}>
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Título *</label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Ej: Pasivo 1.1% Diario"
                  className="w-full bg-black border border-slate-800 rounded-xl px-4 py-3 text-white text-sm font-bold placeholder-slate-700 focus:border-blue-500/50 focus:outline-none transition-colors"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Descripción</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Detalle del paso..."
                  rows={2}
                  className="w-full bg-black border border-slate-800 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-700 focus:border-blue-500/50 focus:outline-none transition-colors resize-none"
                />
              </div>

              {/* Status */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Estado</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['planned', 'in_progress', 'done'] as const).map(s => (
                    <button key={s} onClick={() => setForm(f => ({ ...f, status: s }))}
                      className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${form.status === s ? `${statusColors[s]} scale-105` : 'border-slate-800 text-slate-500 hover:border-slate-700'}`}>
                      {statusLabels[s]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 py-3 border border-slate-800 rounded-xl text-slate-500 hover:text-white hover:border-slate-700 text-xs font-black uppercase tracking-widest transition-all">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving || !form.title.trim()} className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all">
                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={14} />}
                {editItem ? 'Guardar' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
