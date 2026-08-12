import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { NetworkNode } from '../types';

interface Props {
  data: NetworkNode;
  totalVolume?: number;
  totalEarnings?: number;
  totalUsers?: number;
}

// ==========================================
// PHYSIC ENGINE NODE INTERFACE
// ==========================================
interface SimNode extends NetworkNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface SimLink {
  source: string; // ID
  target: string; // ID
}

// ==========================================
// NEURAL EXPLORER (Force Directed Graph)
// ==========================================
const NeuralExplorer: React.FC<{ data: NetworkNode }> = ({ data }) => {
  const { t } = useTranslation();
  const svgRef = useRef<SVGSVGElement>(null);
  const [nodes, setNodes] = useState<SimNode[]>([]);
  const [links, setLinks] = useState<SimLink[]>([]);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // Initialize Simulation Data
  useEffect(() => {
    const flatNodes: SimNode[] = [];
    const flatLinks: SimLink[] = [];
    const width = 1200;
    const height = 800;

    const traverse = (node: NetworkNode, parentX?: number, parentY?: number) => {
      const simNode: SimNode = {
        ...node,
        x: parentX ? parentX + (Math.random() - 0.5) * 100 : width / 2,
        y: parentY ? parentY + (Math.random() - 0.5) * 100 : height / 2,
        vx: 0,
        vy: 0
      };
      flatNodes.push(simNode);

      if (node.children) {
        node.children.forEach(child => {
          flatLinks.push({ source: node.id, target: child.id });
          traverse(child, simNode.x, simNode.y);
        });
      }
    };

    traverse(data);
    setNodes(flatNodes);
    setLinks(flatLinks);
  }, [data]);

  // physics loop
  useEffect(() => {
    if (nodes.length === 0) return;
    let frameId: number;

    const tick = () => {
      setNodes(prev => {
        const next = prev.map(n => ({ ...n }));

        // 1. Center Gravity
        next.forEach(n => {
          n.vx += (600 - n.x) * 0.002;
          n.vy += (400 - n.y) * 0.002;
        });

        // 2. Node Repulsion
        for (let i = 0; i < next.length; i++) {
          for (let j = i + 1; j < next.length; j++) {
            const dx = next[i].x - next[j].x;
            const dy = next[i].y - next[j].y;
            const d2 = dx * dx + dy * dy + 1;
            // Aumentar repulsión para dar espacio a etiquetas
            const force = 3000 / d2;
            const fx = (dx / Math.sqrt(d2)) * force;
            const fy = (dy / Math.sqrt(d2)) * force;
            next[i].vx += fx;
            next[i].vy += fy;
            next[j].vx -= fx;
            next[j].vy -= fy;
          }
        }

        // 3. Link Spring Force
        links.forEach(l => {
          const s = next.find(n => n.id === l.source);
          const t = next.find(n => n.id === l.target);
          if (s && t) {
            const dx = t.x - s.x;
            const dy = t.y - s.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            // Distancia de enlace mayor para etiquetas (150 en lugar de 120)
            const strength = (dist - 150) * 0.02;
            const fx = (dx / dist) * strength;
            const fy = (dy / dist) * strength;
            s.vx += fx;
            s.vy += fy;
            t.vx -= fx;
            t.vy -= fy;
          }
        });

        // 4. Update Pos
        next.forEach(n => {
          n.vx *= 0.95;
          n.vy *= 0.95;
          n.x += n.vx;
          n.y += n.vy;
        });

        return next;
      });
      frameId = requestAnimationFrame(tick);
    };

    tick();
    return () => cancelAnimationFrame(frameId);
  }, [links]);

  return (
    <div className="w-full h-[800px] border border-geminix-accent/20 rounded-2xl bg-black/40 relative overflow-hidden group">
      {/* Background Grid */}
      <div className="absolute inset-0 bg-grid opacity-10 pointer-events-none"></div>

      {/* UI Overlay */}
      <div className="absolute top-6 left-6 z-10">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-geminix-accent animate-ping"></div>
          <h4 className="text-geminix-accent font-orbitron text-xs tracking-widest uppercase">{t('network.strategic_network')}</h4>
        </div>
        <p className="text-[9px] text-slate-500 font-mono italic">{t('network.status')}: {t('network.synchronized')}</p>
      </div>

      <svg ref={svgRef} className="w-full h-full" viewBox="0 0 1200 800">
        <defs>
          <filter id="neonGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Links */}
        {links.map((link, i) => {
          const s = nodes.find(n => n.id === link.source);
          const t = nodes.find(n => n.id === link.target);
          if (!s || !t) return null;
          return (
            <line
              key={i}
              x1={s.x} y1={s.y}
              x2={t.x} y2={t.y}
              stroke="#00f3ff"
              strokeWidth="0.5"
              strokeOpacity="0.2"
              className="transition-all duration-500"
            />
          );
        })}

        {/* Nodes */}
        {nodes.map(node => (
          <g
            key={node.id}
            transform={`translate(${node.x},${node.y})`}
            className="cursor-pointer"
            onMouseEnter={() => setHoveredNode(node.id)}
            onMouseLeave={() => setHoveredNode(null)}
          >
            {/* Node Frame (Root Only) */}
            {node.level === 0 && (
              <circle
                r="12"
                fill="none"
                stroke="#00f3ff"
                strokeWidth="0.5"
                strokeDasharray="2 2"
                className="animate-spin-slow opacity-40"
              />
            )}

            <circle
              r={node.level === 0 ? 8 : 4}
              className={`transition-all duration-300 ${node.totalVolume > 0 ? 'fill-geminix-accent' : 'fill-slate-700'}`}
              filter={node.totalVolume > 0 ? 'url(#neonGlow)' : ''}
              stroke={node.level === 0 ? "#fff" : "rgba(255,255,255,0.3)"}
              strokeWidth={node.level === 0 ? "2" : "1"}
            />
            {/* Premium Cyber-Label (Always Visible) */}
            <g transform="translate(15, -15)">
              {/* HUD Connector Line */}
              <line
                x1="-15" y1="15"
                x2="-5" y2="5"
                stroke={node.level === 0 ? "#00f3ff" : "rgba(0, 243, 255, 0.4)"}
                strokeWidth="1"
                className="opacity-60"
              />

              {/* Label Box */}
              <rect
                x="-5" y="-12"
                width={node.level === 0 ? 90 : 80}
                height="20"
                rx="2"
                fill="rgba(0,0,0,0.85)"
                stroke={node.level === 0 ? "#00f3ff" : "rgba(0, 243, 255, 0.3)"}
                strokeWidth={node.level === 0 ? "1.5" : "0.5"}
                className="backdrop-blur-sm"
              />

              {/* Scanline Effect on label */}
              <rect x="-5" y="-12" width={node.level === 0 ? 90 : 80} height="1" fill="rgba(0,243,255,0.2)" />

              {/* Text */}
              <text
                fill={node.level === 0 ? "#00f3ff" : "white"}
                fontSize={node.level === 0 ? "10" : "8"}
                fontWeight="black"
                dy="2" dx="2"
                className="font-orbitron uppercase tracking-tighter"
              >
                {node.level === 0 ? t('network.you') : (node.name.length > 12 ? node.name.substring(0, 10) + '..' : node.name)}
              </text>
            </g>

            {/* Hover Detailed Info */}
            {hoveredNode === node.id && (
              <g transform="translate(15, 15)">
                <rect x="-5" y="0" width="100" height="25" rx="4" fill="rgba(0,10,20,0.9)" stroke="#00f3ff" strokeWidth="1" />
                <text fill="#00f3ff" fontSize="7" fontWeight="bold" dy="10" dx="5" className="font-mono">
                  {t('network.vol')}: ${Number(node.totalVolume).toLocaleString('en-US')}
                </text>
                <text fill="white" fontSize="7" fontWeight="bold" dy="20" dx="5" className="font-mono">
                  {t('network.rank_label')}: {node.rank || t('profile.rank_starter')}
                </text>
              </g>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
};

// ==========================================
// HIERARCHICAL TREE CARD (Premium UI)
// ==========================================
const NodeCard: React.FC<{
  node: NetworkNode;
  isExpanded: boolean;
  onToggle: () => void;
  hasChildren: boolean;
}> = ({ node, isExpanded, onToggle, hasChildren }) => {
  const { t } = useTranslation();
  const isActive = Number(node.totalVolume) > 0;

  return (
    <div className="relative mb-6">
      {/* Connector lines handled by recursive parent */}

      <div
        onClick={onToggle}
        className={`
          relative group cursor-pointer transition-all duration-500
          flex items-center gap-5 p-4 rounded-2xl border backdrop-blur-xl
          ${isExpanded
            ? 'bg-geminix-accent/15 border-geminix-accent/40 shadow-[0_0_25px_rgba(0,243,255,0.15)]'
            : 'bg-black/40 border-slate-800/80 hover:border-geminix-accent/30 hover:bg-white/5'
          }
        `}
      >
        {/* Status Glow Bar */}
        <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-full transition-all duration-500 ${isActive ? 'bg-geminix-accent shadow-[0_0_15px_cyan]' : 'bg-slate-700'}`}></div>

        {/* Avatar Plate */}
        <div className="relative w-12 h-12 flex-shrink-0">
          <div className="absolute inset-0 rounded-full border border-geminix-accent/20 animate-spin-slow"></div>
          <div className={`
             absolute inset-1 rounded-full flex items-center justify-center font-orbitron font-bold text-lg
             ${isActive ? 'bg-geminix-accent/20 text-white' : 'bg-slate-900 text-slate-500'}
             border border-slate-700
          `}>
            {node.name.charAt(0).toUpperCase()}
          </div>
        </div>

        {/* Identity & Stats */}
        <div className="flex-grow">
          <div className="flex items-center justify-between mb-1.5">
            <h4 className="font-rajdhani font-black text-xl tracking-tight text-white group-hover:text-geminix-accent transition-colors">
              {node.name}
              {node.level === 0 && <span className="ml-3 text-[9px] bg-geminix-accent/20 text-geminix-accent border border-geminix-accent/30 px-2 py-0.5 rounded-full font-mono font-bold tracking-tighter">{t('network.orbital_id')}</span>}
            </h4>
            <div className="flex items-center gap-2">
              {node.rank && node.rank !== 'Starter' && (
                <span className="px-2 py-0.5 rounded-lg text-[7px] font-black uppercase tracking-widest bg-geminix-gold/20 text-geminix-gold border border-geminix-gold/30">
                  {node.rank}
                </span>
              )}
              <span className="font-mono text-[9px] text-slate-500 font-bold uppercase tracking-widest">{t('network.level_label', { level: node.level })}</span>
              <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-geminix-accent animate-pulse shadow-[0_0_5px_cyan]' : 'bg-slate-700'}`}></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col">
              <span className="text-[8px] text-slate-500 font-black uppercase tracking-widest leading-none mb-1">{t('network.total_vol')}</span>
              <span className="font-orbitron font-bold text-xs text-white">${Number(node.totalVolume).toLocaleString('en-US')}</span>
            </div>
            <div className="flex flex-col text-right">
              <span className="text-[8px] text-slate-500 font-black uppercase tracking-widest leading-none mb-1">{t('network.directs')}</span>
              <span className="font-orbitron font-bold text-xs text-geminix-accent">{node.directsCount || 0}_{t('network.units')}</span>
            </div>
          </div>
        </div>

        {/* Expansion Trigger */}
        {hasChildren && (
          <div className={`w-8 h-8 rounded-full border border-slate-700/50 flex items-center justify-center transition-all duration-500 ${isExpanded ? 'rotate-180 bg-geminix-accent text-slate-950 shadow-[0_0_15px_cyan]' : 'text-slate-500 hover:text-white group-hover:border-geminix-accent'}`}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
          </div>
        )}
      </div>
    </div>
  );
};

import OrgChartExplorer from './OrgChartExplorer';

// ==========================================
// MAIN COMPONENT
// ==========================================
const NetworkVisualization: React.FC<Props> = ({ data, totalVolume = 0, totalEarnings = 0, totalUsers = 0 }) => {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<'list' | 'org'>('org');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['root', data?.id]));

  useEffect(() => {
    if (data?.id) setExpandedNodes(prev => new Set(prev).add(data.id));
  }, [data]);

  const toggleNode = (id: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderTree = (node: NetworkNode) => {
    if (!node) return null;
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const isRoot = node.level === 0;

    return (
      <div key={node.id} className="relative pl-8 md:pl-16">
        {/* Branch Connectors */}
        {!isRoot && (
          <>
            {/* Horizontal Bridge */}
            <div className="absolute left-0 top-8 w-8 md:w-16 h-[1.5px] bg-gradient-to-r from-geminix-accent/40 to-transparent">
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-geminix-accent shadow-[0_0_8px_cyan]"></div>
            </div>
            {/* Vertical Stem */}
            <div className="absolute left-0 -top-8 bottom-0 w-[1.5px] bg-slate-800/50 -z-10 group-hover:bg-geminix-accent/20 transition-all"></div>
          </>
        )}

        <NodeCard
          node={node}
          isExpanded={isExpanded}
          onToggle={() => toggleNode(node.id)}
          hasChildren={!!hasChildren}
        />

        {isExpanded && hasChildren && (
          <div className="animate-tree-slide-in border-l border-slate-800/30 hover:border-geminix-accent/10 transition-colors ml-6">
            {node.children.map(child => renderTree(child))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-10 animate-fade-in mb-32">
      {/* HUD Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          { label: t('network.residuals'), val: `$${totalEarnings.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, color: 'cyan', pct: 100 },
          { label: t('network.team_volume'), val: `$${totalVolume.toLocaleString('en-US')}`, color: 'green', pct: 100 },
          { label: 'TOTAL DE USUARIOS', val: totalUsers.toLocaleString('en-US'), color: 'purple', pct: 100 },
        ].map((stat, i) => (
          <div key={i} className="holo-card p-6 border-slate-800 bg-black/40 backdrop-blur-md relative group overflow-hidden">
            <div className={`absolute -right-4 -top-4 w-20 h-20 rounded-full blur-3xl opacity-10 group-hover:opacity-20 transition-opacity ${stat.color === 'cyan' ? 'bg-geminix-accent' : stat.color === 'green' ? 'bg-geminix-green' : 'bg-purple-500'}`}></div>
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-[0.3em] font-black mb-3">{stat.label}</p>
            <h3 className="text-3xl font-orbitron font-bold text-white tracking-tight">{stat.val}</h3>
            <div className="mt-4 h-1 w-full bg-slate-900 rounded-full overflow-hidden">
              <div className={`h-full transition-all duration-1000 ${stat.color === 'cyan' ? 'bg-geminix-accent' : stat.color === 'green' ? 'bg-geminix-green' : 'bg-purple-500'}`} style={{ width: `${stat.pct}%` }}></div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Terminal Interface */}
      <div className="holo-card bg-black/50 border-slate-800 rounded-3xl overflow-hidden backdrop-blur-2xl flex flex-col min-h-[900px]">
        {/* Terminal Header */}
        <div className="flex justify-between items-center px-8 py-5 border-b border-slate-800/50 bg-white/5">
          <div className="flex items-center gap-4">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
              <div className="w-3 h-3 rounded-full bg-geminix-accent/20 border border-geminix-accent/50"></div>
            </div>
            <span className="font-orbitron text-xs font-black tracking-[0.4em] text-white/40 ml-4 uppercase">{t('network.system_visualize')}_v3.0 // <span className="text-geminix-accent">{t('network.org_mapping')}</span></span>
          </div>

          <div className="flex p-1 bg-slate-900 rounded-xl border border-slate-800">
            {[
                { id: 'org', label: t('network.org_mapping', 'Mapa Org') },
                { id: 'list', label: t('network.node_list', 'Lista Nodos') }
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setViewMode(m.id as any)}
                className={`px-6 py-2 rounded-lg text-[10px] font-mono uppercase tracking-widest transition-all ${viewMode === m.id ? 'bg-geminix-accent text-slate-950 font-black shadow-[0_0_20px_rgba(0,243,255,0.4)]' : 'text-slate-500 hover:text-white'}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Console Content */}
        <div className="flex-grow p-6 md:p-4 relative">
          <div className="absolute inset-0 bg-neural-dots opacity-20 pointer-events-none"></div>

          {viewMode === 'list' ? (
            <div className="max-w-4xl mx-auto py-10">
              {data ? renderTree(data) : (
                <div className="text-center py-32 opacity-30 font-orbitron tracking-widest">
                  {t('network.initializing_link')}
                </div>
              )}
            </div>
          ) : (
            <OrgChartExplorer data={data} />
          )}
        </div>

        {/* Status Footer */}
        <div className="px-8 py-4 border-t border-slate-800/50 bg-white/5 flex justify-between items-center text-[10px] font-mono text-slate-500">
          <div className="flex gap-6">
            <span>{t('network.status')}: <span className="text-geminix-accent text-glow-cyan">{t('network.synchronized')}</span></span>
            <span>{t('network.node_count')}: <span className="text-white">{data?.children?.length || 0} {t('network.direct_units')}</span></span>
          </div>
          <div className="animate-pulse">{t('network.decrypting')}</div>
        </div>
      </div>
    </div>
  );
};

export default NetworkVisualization;

