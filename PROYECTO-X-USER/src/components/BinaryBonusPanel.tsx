import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, CheckCircle2, Copy, GitFork, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Summary = {
  left_volume: number;
  right_volume: number;
  matched_available: number;
  estimated_commission: number;
  total_earned: number;
  last_cut_at: string | null;
  left_member: { username?: string; email?: string } | null;
  right_member: { username?: string; email?: string } | null;
  recent_cuts: Array<{ cut_date: string; matched_volume: number; commission: number; left_carry: number; right_carry: number }>;
};
type TreeNode = { id: string; parent_id: string | null; side: 'LEFT' | 'RIGHT' | null; username: string; depth: number };

interface Props {
  userId: string;
  refCode: string | null;
  addNotification: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const EMPTY: Summary = { left_volume: 0, right_volume: 0, matched_available: 0, estimated_commission: 0, total_earned: 0, last_cut_at: null, left_member: null, right_member: null, recent_cuts: [] };
const money = (value: number) => Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BinaryBonusPanel({ userId, refCode, addNotification }: Props) {
  const [summary, setSummary] = useState<Summary>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<'LEFT' | 'RIGHT' | null>(null);
  const [tree, setTree] = useState<TreeNode[]>([]);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const [{ data, error }, { data: treeData, error: treeError }] = await Promise.all([
      supabase.rpc('get_my_binary_summary'),
      supabase.rpc('get_my_binary_tree', { p_max_depth: 6 }),
    ]);
    if (!error && data) setSummary({ ...EMPTY, ...data, recent_cuts: data.recent_cuts || [] });
    if (!treeError && Array.isArray(treeData)) setTree(treeData as TreeNode[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
    const refreshInterval = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(refreshInterval);
  }, [load]);

  const links = useMemo(() => {
    if (!refCode) return null;
    const base = `${window.location.origin}/login?ref=${encodeURIComponent(refCode)}&action=register`;
    return { LEFT: `${base}&side=LEFT`, RIGHT: `${base}&side=RIGHT` };
  }, [refCode]);

  const copy = async (side: 'LEFT' | 'RIGHT') => {
    if (!links) return;
    await navigator.clipboard.writeText(links[side]);
    setCopied(side);
    addNotification(`Enlace de pierna ${side === 'LEFT' ? 'izquierda' : 'derecha'} copiado.`, 'success');
    setTimeout(() => setCopied(null), 1800);
  };

  const legs = [
    { side: 'LEFT' as const, title: 'Pierna izquierda', volume: summary.left_volume, member: summary.left_member, accent: 'cyan' },
    { side: 'RIGHT' as const, title: 'Pierna derecha', volume: summary.right_volume, member: summary.right_member, accent: 'violet' },
  ];

  return (
    <section className="relative overflow-hidden border border-cyan-400/20 bg-[#070c18]/95 p-5 sm:p-7 shadow-[0_0_40px_rgba(59,130,246,.08)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(0,220,255,.09),transparent_35%),radial-gradient(circle_at_100%_100%,rgba(124,58,237,.12),transparent_38%)]" />
      <div className="relative">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div><div className="flex items-center gap-2 text-cyan-300"><GitFork size={18} /><span className="text-[10px] font-orbitron font-black uppercase tracking-[.24em]">Sistema binario NOVA</span></div><h2 className="mt-2 font-orbitron text-2xl font-black text-white">8% sobre la pierna de menor volumen</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">Una persona directa a la izquierda y otra a la derecha. El corte se procesa diariamente a las 00:00; el volumen no emparejado permanece para el próximo corte.</p></div>
          <div className="grid grid-cols-2 gap-3 text-center"><div className="border border-cyan-400/25 bg-cyan-400/5 px-5 py-3"><p className="text-[9px] font-mono-tech uppercase tracking-widest text-slate-500">Volumen emparejable</p><p className="mt-1 font-orbitron text-xl font-black text-cyan-300">${money(summary.matched_available)}</p></div><div className="border border-violet-400/25 bg-violet-400/5 px-5 py-3"><p className="text-[9px] font-mono-tech uppercase tracking-widest text-slate-500">Próximo bono estimado</p><p className="mt-1 font-orbitron text-xl font-black text-violet-300">${money(summary.estimated_commission)}</p></div></div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {legs.map(leg => <article key={leg.side} className={`border p-5 ${leg.accent === 'cyan' ? 'border-cyan-400/25 bg-cyan-400/[.035]' : 'border-violet-400/25 bg-violet-400/[.035]'}`}>
            <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-mono-tech uppercase tracking-[.2em] text-slate-500">{leg.title}</p><p className="mt-2 font-orbitron text-2xl font-black text-white">${money(leg.volume)}</p></div><div className={`flex h-11 w-11 items-center justify-center border ${leg.accent === 'cyan' ? 'border-cyan-400/30 text-cyan-300' : 'border-violet-400/30 text-violet-300'}`}><Users size={22} /></div></div>
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">{leg.member ? <><CheckCircle2 size={15} className="text-emerald-300" /><span>{leg.member.username || leg.member.email || 'Registro activo'}</span></> : <><span className="h-2 w-2 rounded-full bg-amber-300" /><span>Primera posición disponible</span></>}</div>
            <div className="mt-4 flex min-w-0 items-center gap-2 border border-white/10 bg-black/25 p-2"><code className="min-w-0 flex-1 truncate text-[10px] text-slate-400">{links?.[leg.side] || 'Enlace pendiente de sincronizar'}</code><button type="button" onClick={() => void copy(leg.side)} disabled={!links} className={`flex shrink-0 items-center gap-2 border px-3 py-2 text-[9px] font-orbitron font-black uppercase disabled:opacity-30 ${leg.accent === 'cyan' ? 'border-cyan-400/35 text-cyan-200 hover:bg-cyan-400/10' : 'border-violet-400/35 text-violet-200 hover:bg-violet-400/10'}`}>{copied === leg.side ? <CheckCircle2 size={14} /> : <Copy size={14} />}{copied === leg.side ? 'Copiado' : 'Copiar link'}</button></div>
          </article>)}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3"><div className="border border-white/10 bg-black/20 p-4"><p className="text-[9px] uppercase tracking-widest text-slate-500">Total ganado</p><p className="mt-2 font-orbitron text-lg font-black text-emerald-300">${money(summary.total_earned)}</p></div><div className="border border-white/10 bg-black/20 p-4"><p className="text-[9px] uppercase tracking-widest text-slate-500">Último corte</p><p className="mt-2 text-sm font-bold text-white">{summary.last_cut_at ? new Date(summary.last_cut_at).toLocaleString('es-DO') : 'Pendiente'}</p></div><div className="border border-white/10 bg-black/20 p-4"><p className="text-[9px] uppercase tracking-widest text-slate-500">Estado</p><p className="mt-2 flex items-center gap-2 text-sm font-bold text-cyan-200"><ArrowDownToLine size={16} />{loading ? 'Sincronizando…' : 'Corte diario 00:00'}</p></div></div>

        <section className="mt-5 border border-white/10 bg-black/20 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4"><div><p className="text-[10px] font-orbitron font-black uppercase tracking-[.2em] text-cyan-200">Árbol binario</p><p className="mt-1 text-xs text-slate-500">Sincronizado con los registros de tus dos piernas.</p></div><span className="border border-cyan-400/20 px-3 py-1 text-[9px] font-mono-tech text-cyan-200">{tree.length} nodos visibles</span></div>
          {tree.length ? <div className="mt-5 space-y-3 overflow-x-auto">{[...new Set(tree.map(node => node.depth))].map(depth => <div key={depth} className="flex min-w-max justify-center gap-3">{tree.filter(node => node.depth === depth).map(node => <article key={node.id} className={`w-40 border p-3 text-center ${node.depth === 0 ? 'border-cyan-400/40 bg-cyan-400/10' : node.side === 'RIGHT' ? 'border-violet-400/35 bg-violet-400/[.06]' : 'border-cyan-400/30 bg-cyan-400/[.05]'}`}><p className="truncate font-orbitron text-xs font-black text-white">{node.username}</p><p className="mt-1 text-[9px] font-mono-tech uppercase tracking-wider text-slate-400">{node.depth === 0 ? 'Tu nodo' : `Nivel ${node.depth} · ${node.side === 'RIGHT' ? 'Derecha' : 'Izquierda'}`}</p></article>)}</div>)}</div> : <p className="py-8 text-center text-sm text-slate-500">Aún no hay registros binarios. Comparte los enlaces de izquierda y derecha para construir tu árbol.</p>}
        </section>

        {!!summary.recent_cuts.length && <div className="mt-5 overflow-x-auto border border-white/10"><table className="w-full min-w-[620px] text-left text-xs"><thead className="bg-white/[.03] text-[9px] uppercase tracking-widest text-slate-500"><tr><th className="p-3">Fecha</th><th>Volumen menor</th><th>Bono 8%</th><th>Arrastre izquierdo</th><th>Arrastre derecho</th></tr></thead><tbody className="divide-y divide-white/5 text-slate-300">{summary.recent_cuts.map(cut => <tr key={cut.cut_date}><td className="p-3">{cut.cut_date}</td><td>${money(cut.matched_volume)}</td><td className="text-emerald-300">${money(cut.commission)}</td><td>${money(cut.left_carry)}</td><td>${money(cut.right_carry)}</td></tr>)}</tbody></table></div>}
      </div>
    </section>
  );
}
