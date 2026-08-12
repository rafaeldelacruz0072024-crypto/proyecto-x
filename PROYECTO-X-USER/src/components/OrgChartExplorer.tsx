import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import * as d3 from 'd3';
import { NetworkNode } from '../types';

interface OrgNode extends d3.HierarchyPointNode<NetworkNode> {
  x: number;
  y: number;
}

interface Props {
  data: NetworkNode;
}

const OrgChartExplorer: React.FC<Props> = ({ data }) => {
  const { t } = useTranslation();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomState, setZoomState] = useState({ x: 0, y: 0, k: 1 });
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());

  // Node Dimensions
  const nodeRadius = 32;
  const nodeSpacingX = 180;
  const nodeSpacingY = 160;

  // D3 Tree Layout calculation
  const { nodes, links } = useMemo(() => {
    if (!data) return { nodes: [], links: [], width: 0, height: 0 };

    // Create hierarchy
    const root = d3.hierarchy(data, d => {
      // If node is collapsed, return no children for the layout calculation
      return collapsedNodes.has(d.id) ? null : d.children;
    });

    const treeLayout = d3.tree<NetworkNode>().nodeSize([nodeSpacingX, nodeSpacingY]);
    const treeData = treeLayout(root);

    const nodes = treeData.descendants() as OrgNode[];
    const links = treeData.links();

    return { nodes, links };
  }, [data, collapsedNodes]);

  // Handle Zoom and Pan
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 3])
      .on('zoom', (event) => {
        setZoomState(event.transform);
      });

    svg.call(zoom);

    // Initial positioning: Center the root at the top
    const initialScale = 0.8;
    const initialX = svgRef.current.clientWidth / 2;
    const initialY = 100;

    svg.call(zoom.transform, d3.zoomIdentity.translate(initialX, initialY).scale(initialScale));
  }, [nodes.length === 1]); // Re-center only if it's the first load or reset

  const toggleNode = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCollapsedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandToLevel = (level: number) => {
    const toCollapse = new Set<string>();
    const traverse = (node: NetworkNode) => {
      if (node.level >= level && node.children && node.children.length > 0) {
        toCollapse.add(node.id);
      }
      if (node.children) node.children.forEach(traverse);
    };
    traverse(data);
    setCollapsedNodes(toCollapse);
  };

  return (
    <div ref={containerRef} className="w-full h-[800px] border border-geminix-accent/20 rounded-3xl bg-black/60 relative overflow-hidden group cursor-grab active:cursor-grabbing">
      {/* Background HUD Grid */}
      <div className="absolute inset-0 bg-grid opacity-10 pointer-events-none"></div>

      {/* Terminal Title Overlay */}
      <div className="absolute top-6 left-6 z-10 pointer-events-none">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-2 h-2 rounded-full bg-geminix-accent animate-ping shadow-[0_0_10px_cyan]"></div>
          <h4 className="text-geminix-accent font-orbitron text-[10px] tracking-widest uppercase font-black">{t('network.strategic_network')}</h4>
        </div>
        <p className="text-[8px] text-slate-500 font-mono-tech italic">{t('network.status')}: {t('network.synchronized')} // DEPLOYMENT_LEVEL_ACTIVE</p>
      </div>

      {/* Controls Overlay (Level Expansion) */}
      <div className="absolute top-6 right-6 z-20 flex flex-col gap-3">
        <div className="bg-black/80 backdrop-blur-md border border-geminix-accent/30 p-2 rounded-xl flex flex-col gap-2 shadow-[0_0_20px_rgba(0,243,255,0.1)]">
           <span className="text-[8px] font-black font-orbitron text-geminix-accent/60 px-2 uppercase tracking-widest">Deployment Range</span>
           <div className="flex gap-1">
             {[1, 2, 3, 5].map(lvl => (
               <button 
                 key={lvl}
                 onClick={() => expandToLevel(lvl)}
                 className="w-10 h-8 flex items-center justify-center rounded-lg border border-white/5 hover:border-geminix-accent/50 hover:bg-geminix-accent/10 transition-all text-[10px] font-bold font-mono text-white"
               >
                 L{lvl}
               </button>
             ))}
             <button 
               onClick={() => setCollapsedNodes(new Set())}
               className="px-3 h-8 flex items-center justify-center rounded-lg border border-geminix-accent/20 bg-geminix-accent/10 hover:bg-geminix-accent/20 transition-all text-[9px] font-black font-orbitron text-geminix-accent uppercase"
             >
               Max
             </button>
           </div>
        </div>
      </div>

      {/* Legend Overlay */}
      <div className="absolute bottom-6 left-6 z-10 flex gap-2">
         <div className="bg-black/60 backdrop-blur-md border border-white/10 px-4 py-2 rounded-xl flex items-center gap-4 text-[10px] font-mono-tech text-slate-400">
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-geminix-accent"></div>
                <span>{t('network.active_node')}</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-slate-700"></div>
                <span>{t('network.inactive_node')}</span>
            </div>
         </div>
      </div>

      <svg ref={svgRef} className="w-full h-full">
        <defs>
          <filter id="glowNode" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <linearGradient id="linkGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(0, 243, 255, 0.4)" />
            <stop offset="100%" stopColor="rgba(0, 243, 255, 0.05)" />
          </linearGradient>
        </defs>

        <g transform={`translate(${zoomState.x},${zoomState.y}) scale(${zoomState.k})`}>
          {/* Orthogonal Connections */}
          {links.map((link, i) => {
            const sourceX = link.source.x;
            const sourceY = link.source.y;
            const targetX = link.target.x;
            const targetY = link.target.y;

            const midY = (sourceY + targetY) / 2;
            const pathData = `M ${sourceX} ${sourceY} L ${sourceX} ${midY} L ${targetX} ${midY} L ${targetX} ${targetY}`;

            return (
              <path
                key={`link-${i}`}
                d={pathData}
                fill="none"
                stroke="url(#linkGradient)"
                strokeWidth="2"
                className="transition-all duration-1000 opacity-60"
              />
            );
          })}

          {/* Nodes */}
          {nodes.map((node, i) => {
            const isActive = node.data.totalVolume > 0 || node.data.level === 0;
            const isRoot = node.data.level === 0;
            const isCollapsed = collapsedNodes.has(node.data.id);
            const hasChildren = node.data.children && node.data.children.length > 0;

            return (
              <g
                key={`node-${node.data.id}-${i}`}
                transform={`translate(${node.x},${node.y})`}
                className="group/node"
              >
                {/* Node Outer Ring */}
                {(isActive || isRoot) && (
                  <circle
                    r={nodeRadius + 6}
                    fill="none"
                    stroke={isRoot ? "#00f3ff" : "rgba(0, 243, 255, 0.3)"}
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                    className="animate-spin-slow opacity-60"
                  />
                )}

                {/* Main Node Circle */}
                <circle
                  r={nodeRadius}
                  onClick={(e) => hasChildren && toggleNode(node.data.id, e as any)}
                  className={`
                    transition-all duration-500 ease-out fill-slate-950 border-2 cursor-pointer
                    ${isActive ? 'stroke-geminix-accent' : 'stroke-slate-800'}
                    ${hasChildren ? 'hover:stroke-white' : ''}
                  `}
                  strokeWidth="2.5"
                />

                {/* expansion Indicator (+) (-) */}
                {hasChildren && (
                  <g 
                    onClick={(e) => toggleNode(node.data.id, e as any)}
                    transform={`translate(${nodeRadius - 4}, ${nodeRadius - 4})`}
                    className="cursor-pointer"
                  >
                    <circle r="10" className={`${isCollapsed ? 'fill-geminix-accent' : 'fill-slate-800'} stroke-black stroke-2 shadow-lg`} />
                    <path 
                      d={isCollapsed ? "M -4 0 L 4 0 M 0 -4 L 0 4" : "M -4 0 L 4 0"} 
                      stroke={isCollapsed ? "black" : "white"} 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                    />
                  </g>
                )}

                {/* Avatar Placeholder / Initials */}
                <circle
                  r={nodeRadius - 4}
                  className={isActive ? 'fill-geminix-accent/10' : 'fill-slate-900'}
                  pointerEvents="none"
                />

                <text
                  textAnchor="middle"
                  dy="0.35em"
                  className={`
                    font-orbitron font-bold text-xl pointer-events-none select-none
                    ${isActive ? 'fill-geminix-accent text-glow-cyan' : 'fill-slate-700'}
                  `}
                >
                  {node.data.name.charAt(0).toUpperCase()}
                </text>

                {/* Identity Labels */}
                <g transform={`translate(0, ${nodeRadius + 22})`}>
                  <rect
                    x="-60" y="-12" width="120" height="32" rx="6"
                    className="fill-black/80 stroke-white/5 backdrop-blur-md"
                  />
                  <text
                    textAnchor="middle"
                    className="font-orbitron font-black text-[10px] fill-white uppercase tracking-tighter"
                  >
                    {isRoot ? t('network.you') : (node.data.name.length > 15 ? node.data.name.substring(0, 13) + '..' : node.data.name)}
                  </text>
                  <text
                    y="12"
                    textAnchor="middle"
                    className="font-mono-tech text-[7px] font-black fill-geminix-accent uppercase tracking-widest opacity-80"
                  >
                    {node.data.rank || 'STARTER'}
                  </text>
                </g>

                {/* Stats Badge */}
                <g transform={`translate(0, -${nodeRadius + 12})`}>
                  <rect
                    x="-35" y="-8" width="70" height="16" rx="8"
                    className={`${isActive ? 'fill-geminix-accent/20 stroke-geminix-accent/40' : 'fill-slate-900 stroke-slate-800'} stroke-[0.5px]`}
                  />
                  <text
                    textAnchor="middle"
                    dy="3"
                    className={`font-mono-tech text-[7px] font-bold ${isActive ? 'fill-geminix-accent' : 'fill-slate-500'}`}
                  >
                    ${Number(node.data.totalVolume).toLocaleString('en-US')}
                  </text>
                </g>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
};

export default OrgChartExplorer;
