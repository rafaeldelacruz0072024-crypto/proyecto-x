import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, BarChart3, CheckCircle2, Clock3, FileCheck2, Gauge, Loader2, ScanSearch, Sparkles, CalendarDays, WalletCards } from 'lucide-react';
import { supabase } from '../lib/supabase';

type TaskCode = 'SYNC_NODE' | 'VALIDATE_BLOCK' | 'AUDIT_MEMPOOL' | 'SIGN_CHECKPOINT';

const TASKS: Array<{ code: TaskCode; title: string; action: string; description: string; Icon: typeof ScanSearch }> = [
  { code: 'SYNC_NODE', title: 'Escanear señales', action: 'Escanear mercado', description: 'Procesa tendencias, eventos y señales activas del mercado de predicción.', Icon: ScanSearch },
  { code: 'VALIDATE_BLOCK', title: 'Calibrar probabilidades', action: 'Calibrar escenario', description: 'Contrasta las probabilidades implícitas y valida la fuerza de cada resultado.', Icon: Gauge },
  { code: 'AUDIT_MEMPOOL', title: 'Verificar liquidez', action: 'Verificar liquidez', description: 'Analiza volumen, profundidad y estabilidad antes del cierre diario.', Icon: BarChart3 },
  { code: 'SIGN_CHECKPOINT', title: 'Confirmar pronóstico', action: 'Confirmar análisis', description: 'Registra tu participación y confirma la lectura algorítmica del día.', Icon: Activity },
];

interface Props {
  userId: string;
  hasActiveContracts: boolean;
  onRoiActivated: (result: any) => void;
  addNotification: (message: string, type?: 'success' | 'error' | 'info') => void;
}

type TaskCompletion = { task_code: TaskCode; task_day: string; completed_at: string; investment_id: string | null };
type HistoryDay = { investment_id: string; task_day: string; completions: TaskCompletion[]; completed_at: string | null };
type ActiveCycle = {
  id: string;
  amount: number;
  accumulated_earnings: number;
  business_days_elapsed: number;
  assigned_roi_percentage: number;
  created_at: string;
  last_cycle_activation_at: string | null;
  plans: { name: string; code: string; duration_business_days: number | null } | null;
};
type CycleEvent = {
  id: string;
  type: 'CAPITAL_RETURN' | 'MATURITY_PAYOUT';
  amount: number;
  status: string;
  description: string | null;
  created_at: string;
};

const localDate = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Santo_Domingo', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

const formatCountdown = (totalSeconds: number) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map(value => String(value).padStart(2, '0')).join(':');
};

const nextBusinessCutoff = (completedAt: string) => {
  const cutoff = new Date(new Date(completedAt).getTime() + 24 * 60 * 60 * 1000);
  while (true) {
    const weekday = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Santo_Domingo', weekday: 'short',
    }).format(cutoff);
    if (weekday !== 'Sat' && weekday !== 'Sun') return cutoff;
    cutoff.setTime(cutoff.getTime() + 24 * 60 * 60 * 1000);
  }
};

export default function RoiDailyTasks({ userId, hasActiveContracts, onRoiActivated, addNotification }: Props) {
  const [completed, setCompleted] = useState<Set<TaskCode>>(new Set());
  const [activeCycles, setActiveCycles] = useState<ActiveCycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<TaskCode | null>(null);
  const [simulation, setSimulation] = useState<TaskCode | null>(null);
  const [history, setHistory] = useState<HistoryDay[]>([]);
  const [cycleEvents, setCycleEvents] = useState<CycleEvent[]>([]);
  const [accumulatedRoi, setAccumulatedRoi] = useState(0);
  const [nextAvailableAt, setNextAvailableAt] = useState<Date | null>(null);
  const [secondsToCut, setSecondsToCut] = useState(0);
  const activeTaskDay = useRef(localDate());

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const [historyResult, investmentsResult, cycleEventsResult] = await Promise.all([
      supabase.from('roi_daily_task_completions').select('task_code, task_day, completed_at, investment_id').eq('user_id', userId).not('investment_id', 'is', null).order('completed_at', { ascending: false }).limit(400),
      supabase.from('investments').select('id, amount, accumulated_earnings, business_days_elapsed, assigned_roi_percentage, created_at, last_cycle_activation_at, plans(name, code, duration_business_days)').eq('user_id', userId).eq('status', 'ACTIVE').order('created_at', { ascending: false }),
      supabase
        .from('transactions')
        .select('id, type, amount, status, description, created_at')
        .eq('user_id', userId)
        .in('type', ['CAPITAL_RETURN', 'MATURITY_PAYOUT'])
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    if (historyResult.error || investmentsResult.error) {
      addNotification('No se pudieron cargar las tareas diarias.', 'error');
    } else {
      const rows = (historyResult.data || []) as TaskCompletion[];
      const cycles = (investmentsResult.data || []) as unknown as ActiveCycle[];
      const chosenCycleId = cycles.some(cycle => cycle.id === selectedCycleId)
        ? selectedCycleId
        : (cycles[0]?.id || '');
      setActiveCycles(cycles);
      if (chosenCycleId !== selectedCycleId) setSelectedCycleId(chosenCycleId);
      const groups = new Map<string, TaskCompletion[]>();
      rows.forEach(row => {
        if (!row.investment_id) return;
        const key = `${row.investment_id}:${row.task_day}`;
        groups.set(key, [...(groups.get(key) || []), row]);
      });
      const groupedHistory = [...groups.entries()].map(([key, completions]) => ({
        investment_id: key.split(':')[0],
        task_day: key.split(':')[1],
        completions,
        completed_at: completions.length === 4
          ? completions.reduce((latest, row) => row.completed_at > latest ? row.completed_at : latest, completions[0].completed_at)
          : null,
      })).sort((a, b) => (b.completed_at || b.task_day).localeCompare(a.completed_at || a.task_day));
      const latestComplete = groupedHistory
        .filter(day => day.investment_id === chosenCycleId && day.completions.length === 4 && day.completed_at)
        .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())[0];
      const availableAt = latestComplete?.completed_at
        ? nextBusinessCutoff(latestComplete.completed_at)
        : null;

      setNextAvailableAt(availableAt && availableAt.getTime() > Date.now() ? availableAt : null);
      setCompleted(new Set(
        rows.filter(item => item.investment_id === chosenCycleId && item.task_day === localDate()).map(item => item.task_code),
      ));
      setHistory(groupedHistory.slice(0, 28));
      setAccumulatedRoi(Number(cycles.find(cycle => cycle.id === chosenCycleId)?.accumulated_earnings || 0));
    }
    if (cycleEventsResult.error) {
      addNotification('No se pudieron cargar los cierres de ciclos.', 'error');
    } else {
      setCycleEvents((cycleEventsResult.data || []).map(event => ({
        ...event,
        amount: Number(event.amount || 0),
      })) as CycleEvent[]);
    }
    setLoading(false);
  }, [userId, addNotification, selectedCycleId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`cycle-ledger-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'transactions', filter: `user_id=eq.${userId}` },
        payload => {
          const type = String(payload.new?.type || '');
          if (type === 'CAPITAL_RETURN' || type === 'MATURITY_PAYOUT') void load();
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load, userId]);

  useEffect(() => {
    const tick = () => {
      const currentTaskDay = localDate();
      const remaining = nextAvailableAt
        ? Math.max(0, Math.ceil((nextAvailableAt.getTime() - Date.now()) / 1000))
        : 0;
      setSecondsToCut(remaining);
      if (nextAvailableAt && remaining === 0) {
        setNextAvailableAt(null);
        void load();
      }
      if (activeTaskDay.current !== currentTaskDay) {
        activeTaskDay.current = currentTaskDay;
        void load();
      }
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [load, nextAvailableAt]);

  const progress = useMemo(() => completed.size, [completed]);
  const selectedCycle = useMemo(
    () => activeCycles.find(cycle => cycle.id === selectedCycleId) || null,
    [activeCycles, selectedCycleId],
  );
  const cycleIdentifier = (investmentId: string) => `NOVA-${investmentId.slice(0, 8).toUpperCase()}`;
  const formatTaskTime = (completion?: TaskCompletion) => completion
    ? new Intl.DateTimeFormat('es-DO', { timeZone: 'America/Santo_Domingo', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(completion.completed_at))
    : '—';

  const complete = async (taskCode: TaskCode) => {
    if (!selectedCycleId || completed.has(taskCode) || working) return;
    setSimulation(taskCode);
    await new Promise(resolve => setTimeout(resolve, 650));
    setWorking(taskCode);
    const { data, error } = await supabase.rpc('complete_roi_cycle_task', {
      p_user_id: userId,
      p_investment_id: selectedCycleId,
      p_task_code: taskCode,
    });
    setWorking(null);
    setSimulation(null);
    if (error || !data?.success) {
      addNotification(error?.message || data?.error || 'No se pudo completar la tarea.', 'error');
      return;
    }

    setCompleted(current => new Set([...current, taskCode]));
    if (data.completed_tasks === 4) {
      const activation = data.roi_activation;
      const resets = Number(activation?.reset_contracts || 0);
      const activated = Number(activation?.activated_contracts || 0);
      const paid = Number(activation?.total_paid || 0);
      addNotification(
        `${data.cycle_identifier}: análisis diario completado. ROI activado en ${activated} ciclo.${resets ? ' El ciclo fue reiniciado antes de procesar el día actual.' : ''}${paid ? ` +$${paid.toFixed(2)} acreditados.` : ''}`,
        resets ? 'info' : 'success',
      );
      onRoiActivated(activation);
      void load();
    } else {
      addNotification(`${data.cycle_identifier}: señal registrada a las ${formatTaskTime({ task_code: taskCode, task_day: localDate(), completed_at: data.completed_at, investment_id: selectedCycleId })}. ${data.completed_tasks}/4 listas.`, 'success');
    }
  };

  return (
    <section className="relative overflow-hidden border border-proyecto-accent/20 bg-[#070c18]/95 p-4 sm:p-6 lg:p-7 shadow-[0_0_40px_rgba(0,220,255,0.08)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_90%_0%,rgba(105,74,255,0.14),transparent_38%),radial-gradient(circle_at_0%_100%,rgba(0,220,255,0.08),transparent_34%)]" />
      <div className="relative">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-proyecto-accent"><Sparkles size={17} /><span className="text-[10px] font-orbitron font-black uppercase tracking-[0.22em]">Calibración diaria del mercado</span></div>
            <h2 className="mt-3 text-2xl font-orbitron font-black text-white sm:text-3xl">Analiza 4 señales y habilita el ROI del día</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">Tu contrato activo acredita el rendimiento únicamente al completar el análisis diario. Si el proceso queda incompleto, el día no acredita y el ciclo interrumpido reinicia el contador y el ROI pendiente.</p>
          </div>
          <div className={`w-full min-w-0 border p-4 sm:min-w-[235px] lg:w-auto ${progress === 4 ? 'border-emerald-400/40 bg-emerald-400/10' : 'border-proyecto-accent/35 bg-proyecto-accent/5'}`}>
            <div className="flex items-center gap-3"><div className={`flex h-11 w-11 items-center justify-center border ${progress === 4 ? 'border-emerald-300 text-emerald-300' : 'border-proyecto-accent text-proyecto-accent'}`}>{progress === 4 ? <CheckCircle2 size={26} /> : <FileCheck2 size={24} />}</div><div><p className="font-orbitron text-2xl font-black text-white">{progress}/4</p><p className="text-[10px] font-mono-tech uppercase tracking-wider text-slate-400">Señales analizadas</p></div></div>
            <p className={`mt-3 text-xs ${progress === 4 ? 'text-emerald-300' : 'text-slate-400'}`}>{progress === 4 ? `Análisis confirmado el ${localDate()}. ROI solicitado para este ciclo.` : hasActiveContracts ? 'Completa la lectura del mercado para habilitar el ROI de hoy.' : 'Activa un contrato para habilitar el análisis.'}</p>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
              <div className="flex items-center gap-2 text-slate-400"><Clock3 size={14} /><span className="text-[9px] font-mono-tech uppercase tracking-wider">Próxima sesión</span></div>
              <div className="text-right">
                <p className="font-mono text-sm font-bold tabular-nums text-proyecto-accent">{nextAvailableAt ? formatCountdown(secondsToCut) : 'Disponible'}</p>
                <p className="text-[8px] font-mono-tech uppercase tracking-wider text-slate-500">Corte personal del próximo día hábil</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[9px] font-mono-tech uppercase tracking-[0.2em] text-proyecto-accent">Identificador de contrato</p>
              <h3 className="mt-1 font-orbitron text-sm font-black text-white">Selecciona el ciclo que vas a procesar</h3>
            </div>
            <p className="text-[10px] text-slate-500">Cada ciclo mantiene sus propias 4 tareas, horarios y rendimiento.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {activeCycles.map(cycle => {
              const selected = cycle.id === selectedCycleId;
              const cycleTasks = history.find(day => day.investment_id === cycle.id && day.task_day === localDate())?.completions.length || 0;
              return (
                <button key={cycle.id} type="button" onClick={() => setSelectedCycleId(cycle.id)} className={`min-w-0 border p-3 text-left transition ${selected ? 'border-proyecto-accent bg-proyecto-accent/10 shadow-[0_0_24px_rgba(0,220,255,0.14)]' : 'border-white/10 bg-black/20 hover:border-proyecto-accent/40'}`}>
                  <div className="flex items-start justify-between gap-2"><span className="break-all font-mono text-xs font-bold text-proyecto-accent">{cycleIdentifier(cycle.id)}</span><span className={`shrink-0 px-2 py-1 text-[8px] font-mono-tech uppercase ${selected ? 'bg-proyecto-accent text-slate-950' : 'bg-slate-800 text-slate-400'}`}>{selected ? 'Activo' : `${cycleTasks}/4`}</span></div>
                  <p className="mt-2 truncate font-orbitron text-sm font-black text-white">{cycle.plans?.name || 'Nodo NOVA'}</p>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-slate-400"><span>Capital ${Number(cycle.amount).toFixed(2)}</span><span>Día {cycle.business_days_elapsed}</span><span>ROI {Number(cycle.assigned_roi_percentage).toFixed(3)}%</span></div>
                </button>
              );
            })}
          </div>
          {!activeCycles.length && <p className="border border-amber-400/20 bg-amber-400/5 p-4 text-xs text-amber-200">No hay ciclos activos para procesar.</p>}
        </div>

        {progress === 4 && <div className="mt-5 flex items-center gap-2 border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200"><CheckCircle2 size={18} /> Análisis diario confirmado. Tu participación y el procesamiento del ROI quedaron registrados.</div>}

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {TASKS.map(({ code, title, action, description, Icon }) => {
            const done = completed.has(code);
            const busy = working === code;
            const completion = history
              .find(day => day.investment_id === selectedCycleId && day.task_day === localDate())
              ?.completions.find(item => item.task_code === code);
            return (
              <article key={code} className={`min-w-0 border p-4 sm:p-5 transition-all duration-500 ${done ? 'border-emerald-500/35 bg-emerald-500/[0.06]' : simulation === code ? 'border-proyecto-accent bg-proyecto-accent/[0.08] shadow-[0_0_30px_rgba(0,220,255,0.18)]' : 'border-slate-700/70 bg-[#0b101d]/90 hover:border-proyecto-accent/45'}`}>
                <div className="flex flex-col gap-4 min-[390px]:flex-row min-[390px]:items-start">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center border ${done ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-proyecto-accent/40 bg-proyecto-brand/15 text-proyecto-accent'}`}>{done ? <CheckCircle2 size={25} /> : <Icon size={24} />}</div>
                  <div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><h3 className="text-base font-orbitron font-black text-white sm:text-lg">{title}</h3><span className={`shrink-0 px-2 py-1 text-[9px] font-mono-tech uppercase ${done ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-800 text-blue-200'}`}>{done ? `Completada · ${formatTaskTime(completion)}` : 'Pendiente'}</span></div><p className="mt-2 text-sm leading-relaxed text-slate-400">{description}</p><p className="mt-2 break-all font-mono text-[9px] text-slate-600">{selectedCycle ? cycleIdentifier(selectedCycle.id) : 'SIN CICLO SELECCIONADO'}</p></div>
                </div>
                <button type="button" onClick={() => void complete(code)} disabled={!hasActiveContracts || done || !!working || loading} className={`mt-5 w-full border px-4 py-3 text-sm font-orbitron font-black transition disabled:cursor-not-allowed ${done ? 'border-emerald-400/25 bg-emerald-500/15 text-emerald-300' : hasActiveContracts ? 'border-proyecto-accent/60 bg-gradient-to-r from-cyan-500 to-violet-600 text-white shadow-[0_8px_24px_rgba(53,100,255,0.25)] hover:brightness-110' : 'border-slate-700 bg-slate-800 text-slate-500'}`}>
                  {busy || simulation === code ? <span className="flex items-center justify-center gap-2"><Loader2 size={18} className="animate-spin" /> Procesando señal…</span> : done ? `✓ Registrada ${formatTaskTime(completion)}` : selectedCycle ? action : 'Requiere contrato activo'}
                </button>
              </article>
            );
          })}
        </div>

        <section className="mt-6 border border-white/10 bg-black/20 p-4 sm:p-5">
          <div className="flex items-center gap-2"><CalendarDays size={18} className="text-proyecto-accent" /><h3 className="font-orbitron text-sm font-black text-white">Bitácora de análisis y rendimiento</h3></div>
          <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead className="border-b border-white/10 text-[9px] font-mono-tech uppercase tracking-wider text-slate-500"><tr><th className="pb-3">Ciclo</th><th className="pb-3">Fecha</th>{TASKS.map(task => <th key={task.code} className="pb-3">{task.title}</th>)}<th className="pb-3">Estado</th></tr></thead><tbody className="divide-y divide-white/5 text-slate-300">{history.map(day => {
            const cycle = activeCycles.find(item => item.id === day.investment_id);
            return <tr key={`${day.investment_id}:${day.task_day}`} className={day.investment_id === selectedCycleId ? 'bg-proyecto-accent/[0.04]' : ''}><td className="py-3"><p className="font-mono text-[10px] font-bold text-proyecto-accent">{cycleIdentifier(day.investment_id)}</p><p className="mt-1 text-[9px] text-slate-500">{cycle?.plans?.name || 'Ciclo histórico'}</p></td><td className="font-mono">{day.task_day}</td>{TASKS.map(task => <td key={task.code} className="font-mono text-[10px]">{formatTaskTime(day.completions.find(item => item.task_code === task.code))}</td>)}<td className={day.completions.length === 4 ? 'text-emerald-300' : 'text-amber-300'}>{day.completions.length}/4 · {day.completions.length === 4 ? 'ROI procesado' : 'Incompleto'}</td></tr>;
          })}</tbody></table></div>
          {!history.length && <p className="py-4 text-xs text-slate-500">Aún no hay análisis diarios registrados.</p>}
          <div className="mt-5 border-t border-white/10 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-orbitron text-xs font-black uppercase tracking-wider text-white">Cierres y cancelaciones de ciclos</h4>
              <span className="text-[9px] font-mono-tech uppercase tracking-wider text-slate-500">Últimos 20 movimientos</span>
            </div>
            {cycleEvents.length ? (
              <div className="mt-3 grid gap-3">
                {cycleEvents.map(event => {
                  const cancelled = event.type === 'CAPITAL_RETURN';
                  const eventDate = new Intl.DateTimeFormat('es-DO', {
                    timeZone: 'America/Santo_Domingo',
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit',
                  }).format(new Date(event.created_at));
                  return (
                    <article key={event.id} className={`grid gap-3 border p-3 sm:grid-cols-[145px_170px_1fr_auto] sm:items-center ${cancelled ? 'border-amber-400/20 bg-amber-400/[0.04]' : 'border-emerald-400/20 bg-emerald-400/[0.04]'}`}>
                      <div><p className="text-[8px] font-mono-tech uppercase tracking-wider text-slate-500">Fecha y hora</p><p className="mt-1 font-mono text-[11px] text-slate-300">{eventDate}</p></div>
                      <div><p className="text-[8px] font-mono-tech uppercase tracking-wider text-slate-500">Evento</p><p className={`mt-1 text-xs font-bold ${cancelled ? 'text-amber-300' : 'text-emerald-300'}`}>{cancelled ? 'Ciclo cancelado' : 'Ciclo finalizado'}</p></div>
                      <div className="min-w-0"><p className="text-[8px] font-mono-tech uppercase tracking-wider text-slate-500">Detalle</p><p className="mt-1 text-xs leading-relaxed text-slate-300">{event.description || (cancelled ? 'Capital flexible devuelto a Wallet Bank.' : 'Capital y ROI liberados al vencimiento.')}</p></div>
                      <div className="sm:text-right"><p className="text-[8px] font-mono-tech uppercase tracking-wider text-slate-500">{cancelled ? 'Capital devuelto' : 'Capital + ROI liberados'}</p><p className="mt-1 font-orbitron text-base font-black text-emerald-300">+${event.amount.toFixed(2)}</p><p className="text-[8px] font-mono-tech uppercase text-slate-500">Wallet Bank · {event.status}</p></div>
                    </article>
                  );
                })}
              </div>
            ) : <p className="mt-3 py-3 text-xs text-slate-500">Aún no hay ciclos cancelados o finalizados.</p>}
          </div>
          <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-slate-500"><WalletCards size={15} className="mt-0.5 shrink-0 text-proyecto-accent" />El acumulado del ciclo seleccionado es ${accumulatedRoi.toFixed(2)}. Cada identificador NOVA conserva sus propias tareas, horas y procesamiento de ROI.</p>
        </section>
      </div>
    </section>
  );
}
