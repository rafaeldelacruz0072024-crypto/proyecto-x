import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, CheckCircle2, Copy, Crosshair, GitFork, Minus, Plus, UserRound, Users } from 'lucide-react';
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

type TreeNode = {
  id: string;
  parent_id: string | null;
  side: 'LEFT' | 'RIGHT' | null;
  username: string;
  depth: number;
};

type BinarySide = 'LEFT' | 'RIGHT';

type Props = {
  userId: string;
  refCode: string | null;
  addNotification: (message: string, type?: 'success' | 'error' | 'info') => void;
};

const EMPTY: Summary = {
  left_volume: 0,
  right_volume: 0,
  matched_available: 0,
  estimated_commission: 0,
  total_earned: 0,
  last_cut_at: null,
  left_member: null,
  right_member: null,
  recent_cuts: [],
};

const money = (value: number) => Number(value || 0).toLocaleString('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const initials = (node: TreeNode) => {
  const value = node.username?.trim() || node.id.slice(0, 6);
  return value.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'N';
};

const sideLabel = (side: BinarySide | null) => side === 'LEFT' ? 'Izquierda' : side === 'RIGHT' ? 'Derecha' : 'Raíz';

function BinaryNodeCard({ node, legSide, selected, onSelect }: { node: TreeNode; legSide: BinarySide | null; selected: boolean; onSelect: (node: TreeNode) => void }) {
  const accent = (legSide ?? node.side) === 'RIGHT' ? 'violet' : 'cyan';
  return (
    <button
      type="button"
      onClick={() => onSelect(node)}
      className={`group relative w-[160px] sm:w-[176px] text-left transition-all duration-200 hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-cyan-300/70 ${selected ? 'scale-[1.03]' : ''}`}
      aria-label={`Seleccionar nodo ${node.username || node.id}`}
    >
      <div className={`absolute -inset-px rounded-xl opacity-70 blur-sm transition-opacity group-hover:opacity-100 ${accent === 'violet' ? 'bg-violet-500/25' : 'bg-cyan-400/25'}`} />
      <div className={`relative overflow-hidden rounded-xl border bg-[#0a1020]/95 p-3 shadow-[0_12px_35px_rgba(0,0,0,.3)] ${selected ? 'border-amber-300/80 shadow-[0_0_24px_rgba(252,211,77,.2)]' : accent === 'violet' ? 'border-violet-400/40' : 'border-cyan-400/40'}`}>
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-sky-400 to-violet-500 opacity-80" />
        <div className="flex items-start gap-2">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-[11px] font-orbitron font-black ${accent === 'violet' ? 'border-violet-300/60 bg-violet-400/10 text-violet-200' : 'border-cyan-300/60 bg-cyan-400/10 text-cyan-200'}`}>
            {initials(node)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[11px] font-orbitron font-black text-white">{node.username || `Nodo ${node.id.slice(0, 6)}`}</span>
            <span className="mt-1 block text-[8px] font-mono-tech uppercase tracking-[.18em] text-slate-500">{node.depth === 0 ? 'Nodo raíz' : `${sideLabel(node.side)} · Nivel ${node.depth}`}</span>
          </span>
          <span className="mt-1 h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,.8)]" title="Nodo activo" />
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2 text-[8px] font-mono-tech uppercase tracking-wider text-slate-500">
          <span>En red</span>
          <span>{node.side || 'ROOT'}</span>
        </div>
      </div>
    </button>
  );
}

function EmptyBinarySlot({ side, legSide }: { side: BinarySide; legSide: BinarySide | null }) {
  const accent = legSide ?? side;
  return (
    <div className={`flex h-[105px] w-[160px] sm:w-[176px] flex-col items-center justify-center rounded-xl border border-dashed bg-black/20 text-center ${accent === 'RIGHT' ? 'border-violet-300/35' : 'border-cyan-300/35'}`}>
      <span className={`text-[9px] font-orbitron font-black uppercase tracking-[.2em] ${accent === 'RIGHT' ? 'text-violet-200' : 'text-cyan-200'}`}>{side}</span>
      <span className="mt-2 text-[10px] font-mono-tech text-slate-500">Posición disponible</span>
      <span className="mt-1 text-[8px] uppercase tracking-widest text-slate-600">Comparte este enlace</span>
    </div>
  );
}

export default function BinaryBonusPanel({ userId, refCode, addNotification }: Props) {
  const [summary, setSummary] = useState<Summary>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<BinarySide | null>(null);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [visibleDepth, setVisibleDepth] = useState(4);
  const treeViewportRef = useRef<HTMLDivElement | null>(null);

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
    return { LEFT: `${base}&side=LEFT`, RIGHT: `${base}&side=RIGHT` } as const;
  }, [refCode]);

  const childMap = useMemo(() => {
    const map = new Map<string, { LEFT?: TreeNode; RIGHT?: TreeNode }>();
    tree.forEach(node => {
      if (!node.parent_id || !node.side) return;
      const current = map.get(node.parent_id) || {};
      current[node.side] = node;
      map.set(node.parent_id, current);
    });
    return map;
  }, [tree]);

  const root = useMemo(() => tree.find(node => node.depth === 0) || tree.find(node => !node.parent_id) || null, [tree]);
  const maxDepth = 6;
  const visibleCount = useMemo(() => tree.filter(node => node.depth <= visibleDepth).length, [tree, visibleDepth]);

  const copy = async (side: BinarySide) => {
    const link = links?.[side];
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(side);
      addNotification(`Enlace de pierna ${side === 'LEFT' ? 'izquierda' : 'derecha'} copiado.`, 'success');
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      addNotification('No se pudo copiar el enlace.', 'error');
    }
  };

  const focusTree = () => {
    treeViewportRef.current?.scrollTo({ left: Math.max(0, (treeViewportRef.current.scrollWidth - treeViewportRef.current.clientWidth) / 2), top: 0, behavior: 'smooth' });
  };

  const renderNode = (node: TreeNode, legSide: BinarySide | null = null): React.ReactNode => {
    const children = childMap.get(node.id) || {};
    const canExpand = node.depth < visibleDepth;
    const isRoot = node.depth === 0;
    const childGap = isRoot ? 'gap-6 sm:gap-10 md:gap-16 xl:gap-24' : 'gap-4 sm:gap-6 md:gap-10';
    return (
      <div key={node.id} className="flex w-max min-w-[176px] flex-col items-center">
        <BinaryNodeCard node={node} legSide={legSide} selected={selectedNode?.id === node.id} onSelect={setSelectedNode} />
        {canExpand && (
          <div className={`relative flex w-max items-start pt-8 ${childGap}`}>
            <div className="absolute left-1/4 right-1/4 top-3 h-px bg-gradient-to-r from-cyan-300/20 via-white/25 to-violet-300/20" />
            <div className="absolute left-1/2 top-0 h-5 w-px -translate-x-1/2 bg-white/25" />
            {(['LEFT', 'RIGHT'] as const).map(side => {
              const branchLeg = isRoot ? side : legSide;
              const branchAccent = branchLeg ?? side;
              return (
                <div
                  key={side}
                  data-tree-leg={isRoot ? side : undefined}
                  className={`relative flex w-max min-w-[176px] flex-col items-center pt-2 ${isRoot ? `rounded-2xl border px-4 pb-5 sm:px-6 md:px-8 ${branchAccent === 'RIGHT' ? 'border-violet-400/25 bg-violet-500/[.035] shadow-[0_0_35px_rgba(139,92,246,.08)]' : 'border-cyan-400/25 bg-cyan-500/[.035] shadow-[0_0_35px_rgba(34,211,238,.08)]'}` : ''}`}
                >
                  <span className={`mb-2 text-[8px] font-orbitron font-black uppercase tracking-[.25em] ${branchAccent === 'RIGHT' ? 'text-violet-200' : 'text-cyan-200'}`}>
                    {isRoot ? `Rama ${side === 'LEFT' ? 'izquierda' : 'derecha'}` : side}
                  </span>
                  <div className="h-3 w-px bg-white/20" />
                  {children[side] ? renderNode(children[side] as TreeNode, branchLeg) : <EmptyBinarySlot side={side} legSide={branchLeg} />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const legs = [
    { side: 'LEFT' as const, title: 'Pierna izquierda', volume: summary.left_volume, member: summary.left_member, accent: 'cyan' },
    { side: 'RIGHT' as const, title: 'Pierna derecha', volume: summary.right_volume, member: summary.right_member, accent: 'violet' },
  ];

  return (
    <section className="relative overflow-hidden border border-cyan-400/20 bg-[#070c18]/95 p-5 shadow-[0_0_40px_rgba(59,130,246,.08)] sm:p-7">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(0,220,255,.09),transparent_35%),radial-gradient(circle_at_100%_100%,rgba(124,58,237,.12),transparent_38%)]" />
      <div className="relative">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-cyan-300"><GitFork size={18} /><span className="text-[10px] font-orbitron font-black uppercase tracking-[.24em]">Sistema binario NOVA</span></div>
            <h2 className="mt-2 font-orbitron text-2xl font-black text-white">8% sobre la pierna de menor volumen</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">Una persona directa a la izquierda y otra a la derecha. El árbol se actualiza con los nodos reales de tus dos piernas.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-center"><div className="border border-cyan-400/25 bg-cyan-400/5 px-5 py-3"><p className="text-[9px] font-mono-tech uppercase tracking-widest text-slate-500">Volumen emparejable</p><p className="mt-1 font-orbitron text-xl font-black text-cyan-300">${money(summary.matched_available)}</p></div><div className="border border-violet-400/25 bg-violet-400/5 px-5 py-3"><p className="text-[9px] font-mono-tech uppercase tracking-widest text-slate-500">Próximo bono estimado</p><p className="mt-1 font-orbitron text-xl font-black text-violet-300">${money(summary.estimated_commission)}</p></div></div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {legs.map(leg => <article key={leg.side} className={`border p-5 ${leg.accent === 'cyan' ? 'border-cyan-400/25 bg-cyan-400/[.035]' : 'border-violet-400/25 bg-violet-400/[.035]'}`}>
            <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-mono-tech uppercase tracking-[.2em] text-slate-500">{leg.title}</p><p className="mt-2 font-orbitron text-2xl font-black text-white">${money(leg.volume)}</p></div><div className={`flex h-11 w-11 items-center justify-center border ${leg.accent === 'cyan' ? 'border-cyan-400/30 text-cyan-300' : 'border-violet-400/30 text-violet-300'}`}><Users size={22} /></div></div>
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">{leg.member ? <><CheckCircle2 size={15} className="text-emerald-300" /><span>{leg.member.username || leg.member.email || 'Registro activo'}</span></> : <><span className="h-2 w-2 rounded-full bg-amber-300" /><span>Primera posición disponible</span></>}</div>
            <div className="mt-4 flex min-w-0 items-center gap-2 border border-white/10 bg-black/25 p-2"><code className="min-w-0 flex-1 truncate text-[10px] text-slate-400">{links?.[leg.side] || 'Enlace pendiente de sincronizar'}</code><button type="button" onClick={() => void copy(leg.side)} disabled={!links} className={`flex shrink-0 items-center gap-2 border px-3 py-2 text-[9px] font-orbitron font-black uppercase disabled:opacity-30 ${leg.accent === 'cyan' ? 'border-cyan-400/35 text-cyan-200 hover:bg-cyan-400/10' : 'border-violet-400/35 text-violet-200 hover:bg-violet-400/10'}`}>{copied === leg.side ? <CheckCircle2 size={14} /> : <Copy size={14} />}{copied === leg.side ? 'Copiado' : `Copiar ${leg.side}`}</button></div>
          </article>)}
        </div>

        <section className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-[#040914]/90 shadow-[0_20px_60px_rgba(0,0,0,.28)]">
          <div className="flex flex-col gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div><div className="flex items-center gap-2 text-cyan-200"><GitFork size={19} /><p className="text-sm font-orbitron font-black uppercase tracking-[.16em] sm:text-base">Árbol de usuarios binarios</p></div><p className="mt-1 text-sm font-semibold text-slate-400 sm:text-base">{visibleCount} nodos visibles · profundidad {visibleDepth} de {maxDepth || 0}</p></div>
            <div className="flex items-center gap-2 self-end sm:self-auto"><button type="button" onClick={() => setVisibleDepth(depth => Math.max(0, depth - 1))} disabled={visibleDepth <= 0} className="border border-white/10 bg-white/[.03] p-2 text-slate-300 transition hover:border-cyan-300/50 disabled:opacity-30" aria-label="Reducir profundidad"><Minus size={15} /></button><span className="min-w-12 text-center text-[10px] font-mono-tech text-cyan-200">{Math.round((visibleDepth / Math.max(1, maxDepth || 1)) * 100)}%</span><button type="button" onClick={() => setVisibleDepth(depth => Math.min(maxDepth, depth + 1))} disabled={visibleDepth >= maxDepth} className="border border-white/10 bg-white/[.03] p-2 text-slate-300 transition hover:border-cyan-300/50 disabled:opacity-30" aria-label="Aumentar profundidad"><Plus size={15} /></button><button type="button" onClick={focusTree} className="border border-cyan-400/20 bg-cyan-400/[.06] p-2 text-cyan-200 transition hover:bg-cyan-400/15" aria-label="Centrar árbol"><Crosshair size={15} /></button></div>
          </div>
          <div ref={treeViewportRef} className="relative min-h-[360px] touch-pan-x touch-pan-y overflow-auto overscroll-contain bg-[radial-gradient(circle_at_center,rgba(14,116,144,.10),transparent_45%)] p-3 sm:min-h-[430px] sm:p-8">
            <div className="mx-auto flex min-w-max justify-center pb-8 pt-4">
              {root ? renderNode(root) : <div className="flex min-h-[260px] w-full min-w-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-cyan-300/25 px-8 text-center"><UserRound size={28} className="text-cyan-300/70" /><p className="mt-3 font-orbitron text-sm font-bold text-white">Árbol pendiente de sincronización</p><p className="mt-2 max-w-sm text-xs leading-relaxed text-slate-500">Cuando el nodo raíz esté disponible, aquí aparecerán las dos ramas con sus posiciones ocupadas y disponibles.</p></div>}
            </div>
          </div>
          {selectedNode && <div className="flex flex-col gap-2 border-t border-white/10 bg-black/20 px-5 py-3 text-xs sm:flex-row sm:items-center sm:justify-between"><span className="text-slate-400">Nodo seleccionado: <strong className="text-white">{selectedNode.username || selectedNode.id.slice(0, 8)}</strong></span><span className="font-mono-tech uppercase tracking-widest text-cyan-200">{sideLabel(selectedNode.side)} · Nivel {selectedNode.depth}</span></div>}
        </section>

        <div className="mt-5 grid gap-4 sm:grid-cols-3"><div className="border border-white/10 bg-black/20 p-4"><p className="text-[9px] uppercase tracking-widest text-slate-500">Total ganado</p><p className="mt-2 font-orbitron text-lg font-black text-emerald-300">${money(summary.total_earned)}</p></div><div className="border border-white/10 bg-black/20 p-4"><p className="text-[9px] uppercase tracking-widest text-slate-500">Último corte</p><p className="mt-2 text-sm font-bold text-white">{summary.last_cut_at ? new Date(summary.last_cut_at).toLocaleString('es-DO') : 'Pendiente'}</p></div><div className="border border-white/10 bg-black/20 p-4"><p className="text-[9px] uppercase tracking-widest text-slate-500">Estado</p><p className="mt-2 flex items-center gap-2 text-sm font-bold text-cyan-200"><ArrowDownToLine size={16} />{loading ? 'Sincronizando…' : 'Corte diario 00:00'}</p></div></div>

        {!!summary.recent_cuts.length && <div className="mt-5 overflow-x-auto border border-white/10"><table className="w-full min-w-[620px] text-left text-xs"><thead className="bg-white/[.03] text-[9px] uppercase tracking-widest text-slate-500"><tr><th className="p-3">Fecha</th><th>Volumen menor</th><th>Bono 8%</th><th>Arrastre izquierdo</th><th>Arrastre derecho</th></tr></thead><tbody className="divide-y divide-white/5 text-slate-300">{summary.recent_cuts.map(cut => <tr key={cut.cut_date}><td className="p-3">{cut.cut_date}</td><td>${money(cut.matched_volume)}</td><td className="text-emerald-300">${money(cut.commission)}</td><td>${money(cut.left_carry)}</td><td>${money(cut.right_carry)}</td></tr>)}</tbody></table></div>}
      </div>
    </section>
  );
}
