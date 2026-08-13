import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCheck, FileCheck2, Loader2, LockKeyhole, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

type TaskCode = 'SYNC_NODE' | 'VALIDATE_BLOCK' | 'AUDIT_MEMPOOL' | 'SIGN_CHECKPOINT';

const TASKS: Array<{ code: TaskCode; title: string; description: string; Icon: typeof RefreshCw }> = [
  { code: 'SYNC_NODE', title: 'Sincronizar nodo', description: 'Conecta con los pares de la red y descarga los bloques más recientes.', Icon: RefreshCw },
  { code: 'VALIDATE_BLOCK', title: 'Validar bloque', description: 'Verifica el hash, las firmas y el merkle root del bloque propuesto.', Icon: CheckCircle2 },
  { code: 'AUDIT_MEMPOOL', title: 'Auditar mempool', description: 'Revisa las transacciones pendientes y descarta las inválidas.', Icon: ClipboardCheck },
  { code: 'SIGN_CHECKPOINT', title: 'Firmar checkpoint', description: 'Firma el punto de control diario que asegura tu participación.', Icon: LockKeyhole },
];

interface Props {
  userId: string;
  hasActiveContracts: boolean;
  onRoiActivated: (result: any) => void;
  addNotification: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const localDate = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Santo_Domingo', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

export default function RoiDailyTasks({ userId, hasActiveContracts, onRoiActivated, addNotification }: Props) {
  const [completed, setCompleted] = useState<Set<TaskCode>>(new Set());
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<TaskCode | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('roi_daily_task_completions')
      .select('task_code')
      .eq('user_id', userId)
      .eq('task_day', localDate());
    if (error) addNotification('No se pudieron cargar las tareas diarias.', 'error');
    else setCompleted(new Set((data || []).map(item => item.task_code as TaskCode)));
    setLoading(false);
  }, [userId, addNotification]);

  useEffect(() => { void load(); }, [load]);

  const progress = useMemo(() => completed.size, [completed]);

  const complete = async (taskCode: TaskCode) => {
    if (!hasActiveContracts || completed.has(taskCode) || working) return;
    setWorking(taskCode);
    const { data, error } = await supabase.rpc('complete_roi_daily_task', {
      p_user_id: userId,
      p_task_code: taskCode,
    });
    setWorking(null);
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
        `Las cuatro tareas fueron completadas. ROI activado en ${activated} nodo(s).${resets ? ` ${resets} ciclo(s) reiniciado(s).` : ''}${paid ? ` +$${paid.toFixed(2)} acreditados.` : ''}`,
        resets ? 'info' : 'success',
      );
      onRoiActivated(activation);
    } else {
      addNotification(`Tarea completada. ${data.completed_tasks}/4 listas para activar el ROI.`, 'success');
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <p className="text-[10px] font-orbitron font-black uppercase tracking-[0.18em] text-proyecto-accent">Impulso diario de nodos</p>
          <p className="mt-1 text-xs text-slate-400">Completa las 4 tareas para reflejar automáticamente tu ROI.</p>
        </div>
        <div className="rounded-lg border border-proyecto-accent/20 bg-proyecto-accent/5 px-3 py-2 text-[10px] font-mono-tech text-proyecto-accent">{progress}/4 completadas</div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {TASKS.map(({ code, title, description, Icon }) => {
          const done = completed.has(code);
          const busy = working === code;
          return (
            <article key={code} className={`rounded-2xl border p-6 transition-all ${done ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-slate-700/70 bg-[#0b101d]'}`}>
              <div className="flex items-start gap-4">
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border ${done ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-blue-400/20 bg-blue-500/10 text-blue-300'}`}>
                  {done ? <CheckCircle2 size={25} /> : <Icon size={25} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3"><h3 className="text-xl font-black text-white">{title}</h3><span className={`rounded-lg px-3 py-1 text-[10px] font-mono-tech ${done ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-800 text-blue-200'}`}>{done ? 'Completada' : 'Pendiente'}</span></div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{description}</p>
                </div>
              </div>
              <button type="button" onClick={() => void complete(code)} disabled={!hasActiveContracts || done || !!working || loading} className={`mt-6 w-full rounded-xl px-4 py-4 text-base font-black transition disabled:cursor-not-allowed ${done ? 'bg-emerald-500/15 text-emerald-300' : hasActiveContracts ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-slate-800 text-slate-500'}`}>
                {busy ? <span className="flex items-center justify-center gap-2"><Loader2 size={18} className="animate-spin" /> Procesando…</span> : done ? '✓ Tarea completada' : hasActiveContracts ? 'Completar tarea' : 'Requiere contrato activo'}
              </button>
            </article>
          );
        })}
      </div>
      <p className="px-1 text-xs leading-relaxed text-slate-500">Regla de Oro: si no completas las cuatro tareas en un día hábil, el ROI no se acredita. Cuando vuelvas a completar las tareas, cualquier ciclo interrumpido reinicia su contador y pierde el ROI pendiente.</p>
    </section>
  );
}
