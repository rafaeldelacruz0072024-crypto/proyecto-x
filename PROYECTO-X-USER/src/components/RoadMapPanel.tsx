import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

interface RoadmapItem {
  id: string;
  phase: number;
  title: string;
  description: string | null;
  icon: string;
  status: 'planned' | 'in_progress' | 'done';
  sort_order: number;
}

interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

const PHASE2_DURATION_DAYS = 60;

const PHASE1_ITEMS = [
  { icon: '📊', title: 'Pasivo GEMINIX GOLD', desc: '+1000% auditado Myfxbook 2025 · 5 IAs XAU/USD' },
  { icon: '🌐', title: '30 Niveles de Referidos', desc: 'Comisiones residuales según Regla de Oro oficial' },
  { icon: '💰', title: 'Salario Semanal', desc: 'Pago cada Sábado a miembros activos calificados' },
  { icon: '🎯', title: 'Predicciones V1', desc: 'Módulo de mercados de predicción activo' },
  { icon: '💎', title: 'Sistema de Créditos', desc: 'Créditos internos para operaciones dentro del ecosistema' },
];

const statusColors: Record<string, string> = {
  planned:     'text-slate-400 bg-slate-800/60 border-slate-700',
  in_progress: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  done:        'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
};
const statusLabels: Record<string, string> = {
  planned:     'Planificado',
  in_progress: 'En Progreso',
  done:        'Completado',
};

export default function RoadMapPanel() {
  const [items, setItems]         = useState<RoadmapItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [countdown, setCountdown] = useState<Countdown>({ days: 60, hours: 0, minutes: 0, seconds: 0, total: 0 });
  const [startDate, setStartDate] = useState<Date | null>(null);

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

  const phase2Items = items.filter(i => i.phase === 2);
  const phase3Items = items.filter(i => i.phase === 3);
  const progressPct = Math.max(0, Math.min(100,
    Math.round(((PHASE2_DURATION_DAYS * 86400 - countdown.total / 1000) / (PHASE2_DURATION_DAYS * 86400)) * 100)
  ));

  return (
    <div className="space-y-8 animate-slide-in">

      {/* HEADER */}
      <div className="flex items-center gap-4 bg-black/30 p-4 border-l-2 border-geminix-accent">
        <div>
          <h2 className="text-xl font-orbitron font-bold text-white uppercase tracking-[0.3em] text-glow-cyan">ROAD MAP</h2>
          <p className="text-[9px] font-mono-tech text-geminix-accent uppercase tracking-widest mt-0.5">PLAN DE EVOLUCIÓN · PROTOCOLO GEMINIX</p>
        </div>
      </div>

      {/* COUNTDOWN */}
      <div className="holo-card p-8 clip-corner relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-geminix-brand/5 via-transparent to-geminix-accent/5 pointer-events-none" />

        <div className="text-center mb-6 relative z-10">
          <p className="text-[10px] font-mono-tech text-geminix-accent uppercase tracking-[0.4em] mb-1">Transición a</p>
          <h3 className="text-2xl font-orbitron font-black text-white uppercase tracking-widest text-glow-cyan">FASE 2</h3>
          <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-widest">Contador oficial — {PHASE2_DURATION_DAYS} días</p>
        </div>

        {/* Timer */}
        <div className="flex items-center justify-center gap-3 mb-8 relative z-10">
          {[
            { value: countdown.days,    label: 'DÍAS' },
            { value: countdown.hours,   label: 'HRS' },
            { value: countdown.minutes, label: 'MIN' },
            { value: countdown.seconds, label: 'SEG' },
          ].map(({ value, label }, i) => (
            <React.Fragment key={label}>
              <div className="text-center">
                <div className="w-16 h-16 md:w-20 md:h-20 bg-black border border-geminix-brand/30 clip-corner flex items-center justify-center shadow-neon-cyan relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-b from-geminix-brand/10 to-transparent" />
                  <span className="text-2xl md:text-3xl font-orbitron font-black text-white relative z-10 tabular-nums">
                    {String(value).padStart(2, '0')}
                  </span>
                </div>
                <p className="text-[8px] font-mono-tech text-geminix-accent uppercase tracking-widest mt-2">{label}</p>
              </div>
              {i < 3 && <span className="text-xl font-black text-geminix-brand/50 mb-4">:</span>}
            </React.Fragment>
          ))}
        </div>

        {/* Progress bar */}
        <div className="max-w-lg mx-auto relative z-10">
          <div className="flex justify-between text-[9px] font-mono-tech text-slate-500 uppercase tracking-widest mb-2">
            <span className="text-emerald-400">Fase 1 · Activa</span>
            <span className="text-geminix-accent">{progressPct}% transcurrido</span>
            <span className="text-geminix-brand">Fase 2</span>
          </div>
          <div className="h-1.5 bg-slate-900 rounded-none overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-geminix-brand to-geminix-accent transition-all duration-1000 relative"
              style={{ width: `${progressPct}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* FASES */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* FASE 1 */}
        <div className="holo-card p-6 clip-corner relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-emerald-500 to-teal-400" />
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 clip-corner bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h4 className="text-sm font-orbitron font-black text-white uppercase tracking-widest">Fase 1</h4>
              <span className="text-[9px] font-mono-tech text-emerald-400 uppercase tracking-widest">● ACTIVA AHORA</span>
            </div>
          </div>
          <div className="space-y-3">
            {PHASE1_ITEMS.map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-black/40 border border-emerald-500/10 clip-corner">
                <span className="text-lg mt-0.5">{item.icon}</span>
                <div>
                  <p className="text-[11px] font-bold text-white uppercase tracking-tight">{item.title}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FASE 2 */}
        <div className="holo-card p-6 clip-corner relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-geminix-brand to-geminix-accent" />
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 clip-corner bg-geminix-brand/10 border border-geminix-brand/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-geminix-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-orbitron font-black text-white uppercase tracking-widest">Fase 2</h4>
                <span className="text-[9px] font-mono-tech text-geminix-accent uppercase tracking-widest">⏳ PRÓXIMAMENTE</span>
              </div>
            </div>
            <span className="text-[9px] font-mono-tech text-slate-400 bg-black/50 border border-slate-800 px-2 py-1">
              {countdown.days}d restantes
            </span>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="h-12 bg-slate-900/50 animate-pulse clip-corner" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {phase2Items.map((item) => (
                <div key={item.id} className="flex items-start gap-3 p-3 bg-black/40 border border-geminix-brand/10 clip-corner">
                  <span className="text-lg mt-0.5">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[11px] font-bold text-white uppercase tracking-tight">{item.title}</p>
                      <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 border ${statusColors[item.status]}`}>
                        {statusLabels[item.status]}
                      </span>
                    </div>
                    {item.description && (
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-tight line-clamp-2">{item.description}</p>
                    )}
                  </div>
                </div>
              ))}
              {phase2Items.length === 0 && (
                <div className="text-center py-8 text-slate-600">
                  <p className="text-[10px] font-mono-tech uppercase tracking-widest">Cargando roadmap...</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* FASE 3 */}
        <div className="holo-card p-6 clip-corner relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-purple-500 to-pink-400" />
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 clip-corner bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h4 className="text-sm font-orbitron font-black text-white uppercase tracking-widest">Fase 3</h4>
              <span className="text-[9px] font-mono-tech text-purple-400 uppercase tracking-widest">⚡ VISIÓN FUTURA</span>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="h-12 bg-slate-900/50 animate-pulse clip-corner" />
              ))}
            </div>
          ) : phase3Items.length > 0 ? (
            <div className="space-y-3">
              {phase3Items.map((item) => (
                <div key={item.id} className="flex items-start gap-3 p-3 bg-black/40 border border-purple-500/10 clip-corner">
                  <span className="text-lg mt-0.5">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[11px] font-bold text-white uppercase tracking-tight">{item.title}</p>
                      <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 border ${statusColors[item.status]}`}>
                        {statusLabels[item.status]}
                      </span>
                    </div>
                    {item.description && (
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-tight line-clamp-2">{item.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-600">
              <p className="text-[10px] font-mono-tech uppercase tracking-widest">Próximamente...</p>
            </div>
          )}
        </div>
      </div>

      {/* VISION BANNER */}
      <div className="holo-card p-6 clip-corner relative overflow-hidden border border-geminix-accent/10">
        <div className="absolute inset-0 bg-gradient-to-r from-geminix-brand/5 via-transparent to-purple-600/5 pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-center md:text-left">
            <p className="text-[9px] font-mono-tech text-geminix-accent uppercase tracking-[0.3em] mb-1">Visión del Protocolo</p>
            <h3 className="text-lg font-orbitron font-black text-white uppercase tracking-widest">GEMINIX ECOSYSTEM</h3>
            <p className="text-[10px] text-slate-400 font-bold mt-1">
              3 fases · {PHASE2_DURATION_DAYS} días de transición · Evolución continua
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="w-12 h-12 clip-corner bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-1">
                <span className="text-lg">✅</span>
              </div>
              <p className="text-[8px] font-mono-tech text-emerald-400 uppercase tracking-widest">Fase 1</p>
            </div>
            <div className="text-geminix-brand/30 font-black">→</div>
            <div className="text-center">
              <div className="w-12 h-12 clip-corner bg-geminix-brand/10 border border-geminix-brand/20 flex items-center justify-center mx-auto mb-1 shadow-neon-cyan">
                <span className="text-lg">⏳</span>
              </div>
              <p className="text-[8px] font-mono-tech text-geminix-accent uppercase tracking-widest">Fase 2</p>
            </div>
            <div className="text-geminix-brand/30 font-black">→</div>
            <div className="text-center">
              <div className="w-12 h-12 clip-corner bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto mb-1">
                <span className="text-lg">⚡</span>
              </div>
              <p className="text-[8px] font-mono-tech text-purple-400 uppercase tracking-widest">Fase 3</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
