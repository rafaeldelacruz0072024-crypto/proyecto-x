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

type HistoryDay = { task_day: string; completed_tasks: number; completed_at: string | null };
type TaskCompletion = { task_code: TaskCode; task_day: string; completed_at: string };

const localDate = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Santo_Domingo', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

const formatCountdown = (totalSeconds: number) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map(value => String(value).padStart(2, '0')).join(':');
};

export default function RoiDailyTasks({ userId, hasActiveContracts, onRoiActivated, addNotification }: Props) {
  const [completed, setCompleted] = useState<Set<TaskCode>>(new Set());
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<TaskCode | null>(null);
  const [simulation, setSimulation] = useState<TaskCode | null>(null);
  const [history, setHistory] = useState<HistoryDay[]>([]);
  const [accumulatedRoi, setAccumulatedRoi] = useState(0);
  const [nextAvailableAt, setNextAvailableAt] = useState<Date | null>(null);
  const [secondsToCut, setSecondsToCut] = useState(0);
  const activeTaskDay = useRef(localDate());

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const [todayResult, historyResult, investmentsResult] = await Promise.all([
      supabase.from('roi_daily_task_completions').select('task_code, task_day, completed_at').eq('user_id', userId).eq('task_day', localDate()),
      supabase.from('roi_daily_task_completions').select('task_code, task_day, completed_at').eq('user_id', userId).order('completed_at', { ascending: false }).limit(100),
      supabase.from('investments').select('accumulated_earnings').eq('user_id', userId),
    ]);

    if (todayResult.error || historyResult.error) {
      addNotification('No se pudieron cargar las tareas diarias.', 'error');
    } else {
      const rows = (historyResult.data || []) as TaskCompletion[];
      const groups = new Map<string, TaskCompletion[]>();
      rows.forEach(row => groups.set(row.task_day, [...(groups.get(row.task_day) || []), row]));
      const groupedHistory = [...groups.entries()].map(([task_day, completions]) => ({
        task_day,
        completed_tasks: completions.length,
        completed_at: completions.length === 4
          ? completions.reduce((latest, row) => row.completed_at > latest ? row.completed_at : latest, completions[0].completed_at)
          : null,
      })).sort((a, b) => b.task_day.localeCompare(a.task_day));
      const latestComplete = groupedHistory
        .filter(day => day.completed_tasks === 4 && day.completed_at)
        .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())[0];
      const availableAt = latestComplete?.completed_at
        ? new Date(new Date(latestComplete.completed_at).getTime() + 24 * 60 * 60 * 1000)
        : null;
      const coolingDown = !!availableAt && availableAt.getTime() > Date.now();

      setNextAvailableAt(coolingDown ? availableAt : null);
      setCompleted(new Set(
        coolingDown && latestComplete
          ? rows.filter(row => row.task_day === latestComplete.task_day).map(row => row.task_code)
          : ((todayResult.data || []) as TaskCompletion[]).map(item => item.task_code),
      ));
      setHistory(groupedHistory.slice(0, 7));
    }
    setAccumulatedRoi((investmentsResult.data || []).reduce((sum, investment) => sum + Number(investment.accumulated_earnings || 0), 0));
    setLoading(false);
  }, [userId, addNotification]);

  useEffect(() => { void load(); }, [load]);

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

  const complete = async (taskCode: TaskCode) => {
    if (!hasActiveContracts || completed.has(taskCode) || working) return;
    setSimulation(taskCode);
    await new Promise(resolve => setTimeout(resolve, 650));
    setWorking(taskCode);
    const { data, error } = await supabase.rpc('complete_roi_daily_task', {
      p_user_id: userId,
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
        `Análisis diario completado. ROI activado en ${activated} contrato(s).${resets ? ` ${resets} ciclo(s) reiniciado(s).` : ''}${paid ? ` +$${paid.toFixed(2)} acreditados.` : ''}`,
        resets ? 'info' : 'success',
      );
      onRoiActivated(activation);
      void load();
    } else {
      addNotification(`Señal procesada. ${data.completed_tasks}/4 análisis listos para activar el ROI.`, 'success');
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
                <p className="text-[8px] font-mono-tech uppercase tracking-wider text-slate-500">24 h desde completar 4/4</p>
              </div>
            </div>
          </div>
        </div>

        {progress === 4 && <div className="mt-5 flex items-center gap-2 border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200"><CheckCircle2 size={18} /> Análisis diario confirmado. Tu participación y el procesamiento del ROI quedaron registrados.</div>}

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {TASKS.map(({ code, title, action, description, Icon }) => {
            const done = completed.has(code);
            const busy = working === code;
            return (
              <article key={code} className={`min-w-0 border p-4 sm:p-5 transition-all duration-500 ${done ? 'border-emerald-500/35 bg-emerald-500/[0.06]' : simulation === code ? 'border-proyecto-accent bg-proyecto-accent/[0.08] shadow-[0_0_30px_rgba(0,220,255,0.18)]' : 'border-slate-700/70 bg-[#0b101d]/90 hover:border-proyecto-accent/45'}`}>
                <div className="flex flex-col gap-4 min-[390px]:flex-row min-[390px]:items-start">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center border ${done ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-proyecto-accent/40 bg-proyecto-brand/15 text-proyecto-accent'}`}>{done ? <CheckCircle2 size={25} /> : <Icon size={24} />}</div>
                  <div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><h3 className="text-base font-orbitron font-black text-white sm:text-lg">{title}</h3><span className={`shrink-0 px-2 py-1 text-[9px] font-mono-tech uppercase ${done ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-800 text-blue-200'}`}>{done ? 'Completada' : 'Pendiente'}</span></div><p className="mt-2 text-sm leading-relaxed text-slate-400">{description}</p></div>
                </div>
                <button type="button" onClick={() => void complete(code)} disabled={!hasActiveContracts || done || !!working || loading} className={`mt-5 w-full border px-4 py-3 text-sm font-orbitron font-black transition disabled:cursor-not-allowed ${done ? 'border-emerald-400/25 bg-emerald-500/15 text-emerald-300' : hasActiveContracts ? 'border-proyecto-accent/60 bg-gradient-to-r from-cyan-500 to-violet-600 text-white shadow-[0_8px_24px_rgba(53,100,255,0.25)] hover:brightness-110' : 'border-slate-700 bg-slate-800 text-slate-500'}`}>
                  {busy || simulation === code ? <span className="flex items-center justify-center gap-2"><Loader2 size={18} className="animate-spin" /> Procesando señal…</span> : done ? '✓ Análisis completado' : hasActiveContracts ? action : 'Requiere contrato activo'}
                </button>
              </article>
            );
          })}
        </div>

        <section className="mt-6 border border-white/10 bg-black/20 p-4 sm:p-5">
          <div className="flex items-center gap-2"><CalendarDays size={18} className="text-proyecto-accent" /><h3 className="font-orbitron text-sm font-black text-white">Bitácora de análisis y rendimiento</h3></div>
          <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[560px] text-left text-xs"><thead className="border-b border-white/10 text-[9px] font-mono-tech uppercase tracking-wider text-slate-500"><tr><th className="pb-3">Fecha</th><th className="pb-3">Señales</th><th className="pb-3">Lectura</th><th className="pb-3">Rendimiento</th><th className="pb-3">Acumulado</th></tr></thead><tbody className="divide-y divide-white/5 text-slate-300">{history.map(day => <tr key={day.task_day}><td className="py-3 font-mono">{day.task_day}</td><td>{day.completed_tasks}/4</td><td className={day.completed_tasks === 4 ? 'text-emerald-300' : 'text-amber-300'}>{day.completed_tasks === 4 ? 'Confirmada' : 'Incompleta'}</td><td>{day.completed_tasks === 4 ? 'ROI procesado por ciclo' : 'Sin acreditación'}</td><td className="text-proyecto-accent">${accumulatedRoi.toFixed(2)}</td></tr>)}</tbody></table></div>
          {!history.length && <p className="py-4 text-xs text-slate-500">Aún no hay análisis diarios registrados.</p>}
          <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-slate-500"><WalletCards size={15} className="mt-0.5 shrink-0 text-proyecto-accent" />El acumulado refleja el ROI actual de tus contratos. El motor de ciclos calcula el rendimiento cuando confirmas las cuatro lecturas del mercado.</p>
        </section>
      </div>
    </section>
  );
}
