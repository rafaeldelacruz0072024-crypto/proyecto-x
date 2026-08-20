import React, { useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, Radio, ShieldCheck, TrendingUp } from 'lucide-react';

type SimulatedMarket = {
  id: string;
  title: string;
  category: string;
  yes: number;
  volume: number;
  liquidity: number;
  change: number;
  signal: number;
  history: number[];
};

const INITIAL_MARKETS: SimulatedMarket[] = [
  { id: 'fed', title: '¿La tasa de la Fed se mantendrá este trimestre?', category: 'Economía', yes: 64, volume: 128400, liquidity: 43800, change: 2.4, signal: 87, history: [51, 53, 49, 56, 58, 61, 60, 64] },
  { id: 'btc', title: '¿BTC cerrará el mes sobre US$100,000?', category: 'Cripto', yes: 42, volume: 96400, liquidity: 32100, change: -1.8, signal: 74, history: [49, 47, 45, 43, 44, 40, 41, 42] },
  { id: 'ai', title: '¿La IA liderará el gasto tecnológico en 2026?', category: 'Tecnología', yes: 71, volume: 187200, liquidity: 61900, change: 4.1, signal: 91, history: [58, 61, 63, 60, 66, 67, 69, 71] },
  { id: 'energy', title: '¿El petróleo superará US$90 este trimestre?', category: 'Mercados', yes: 37, volume: 78200, liquidity: 26700, change: -3.2, signal: 69, history: [45, 44, 42, 40, 39, 38, 40, 37] },
];

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const compactUsd = (value: number) => value >= 100000
  ? `US$${(value / 1000).toFixed(0)}k`
  : `US$${(value / 1000).toFixed(1)}k`;

const linePoints = (values: number[]) => values.map((value, index) => {
  const x = (index / Math.max(values.length - 1, 1)) * 100;
  const y = 100 - value;
  return `${x},${y}`;
}).join(' ');

const LivePredictionMarketSimulation: React.FC = () => {
  const [markets, setMarkets] = useState<SimulatedMarket[]>(INITIAL_MARKETS);
  const [selectedId, setSelectedId] = useState(INITIAL_MARKETS[0].id);
  const [updatedAt, setUpdatedAt] = useState(new Date());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setMarkets(current => current.map(market => {
        const drift = (Math.random() - 0.48) * 2.2;
        const yes = Number(clamp(market.yes + drift, 3, 97).toFixed(1));
        const change = Number((market.change + drift * 0.45).toFixed(1));
        const volume = Math.round(market.volume + 180 + Math.random() * 1100);
        const liquidity = Math.round(Math.max(12000, market.liquidity + (Math.random() - 0.35) * 900));
        const history = [...market.history.slice(-15), yes];

        return { ...market, yes, change, volume, liquidity, history };
      }));
      setUpdatedAt(new Date());
    }, 1800);

    return () => window.clearInterval(interval);
  }, []);

  const selected = useMemo(
    () => markets.find(market => market.id === selectedId) ?? markets[0],
    [markets, selectedId]
  );
  const no = Number((100 - selected.yes).toFixed(1));
  const chartArea = `0,100 ${linePoints(selected.history)} 100,100`;

  return (
    <section className="holo-card rounded-none clip-corner overflow-hidden border border-proyecto-accent/20 bg-slate-950/70">
      <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-proyecto-accent">
            <Radio className="h-4 w-4 animate-pulse" />
            <span className="text-[10px] font-mono-tech font-bold uppercase tracking-[0.24em]">Simulación en vivo</span>
          </div>
          <h2 className="mt-1 text-base font-orbitron font-black uppercase tracking-wider text-white">Pulso de mercados de predicción</h2>
        </div>
        <div className="flex items-center gap-2 text-[9px] font-mono-tech uppercase tracking-widest text-slate-400">
          <span className="h-2 w-2 rounded-full bg-proyecto-green shadow-[0_0_10px_#10b981]" />
          Actualizado {updatedAt.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="border-b border-white/10 xl:border-b-0 xl:border-r">
          <div className="hidden grid-cols-[minmax(180px,1.8fr)_0.55fr_0.55fr_0.8fr_0.5fr] gap-2 border-b border-white/5 bg-black/30 px-5 py-3 text-[8px] font-mono-tech uppercase tracking-widest text-slate-500 sm:grid">
            <span>Mercado</span><span>Sí</span><span>No</span><span>Vol. sim.</span><span>Mov.</span>
          </div>
          <div>
            {markets.map(market => {
              const marketNo = Number((100 - market.yes).toFixed(1));
              const positive = market.change >= 0;
              const active = market.id === selected.id;
              return (
                <button
                  key={market.id}
                  type="button"
                  onClick={() => setSelectedId(market.id)}
                  className={`w-full border-b border-white/5 px-4 py-4 text-left transition-colors sm:grid sm:grid-cols-[minmax(180px,1.8fr)_0.55fr_0.55fr_0.8fr_0.5fr] sm:gap-2 sm:px-5 ${active ? 'bg-proyecto-accent/10 shadow-[inset_3px_0_0_#22d3ee]' : 'hover:bg-white/[0.035]'}`}
                >
                  <span className="min-w-0">
                    <span className="block text-[11px] font-orbitron font-bold leading-relaxed text-white sm:truncate">{market.title}</span>
                    <span className="mt-1 block text-[9px] font-mono-tech uppercase tracking-widest text-slate-500">{market.category} · simulación</span>
                  </span>
                  <span className="mt-3 grid grid-cols-4 gap-2 sm:contents">
                    <span className="self-center"><span className="block text-[7px] uppercase tracking-widest text-slate-600 sm:hidden">Sí</span><span className="text-sm font-orbitron font-bold text-proyecto-green">{market.yes}%</span></span>
                    <span className="self-center"><span className="block text-[7px] uppercase tracking-widest text-slate-600 sm:hidden">No</span><span className="text-sm font-orbitron font-bold text-rose-400">{marketNo}%</span></span>
                    <span className="self-center"><span className="block text-[7px] uppercase tracking-widest text-slate-600 sm:hidden">Vol.</span><span className="text-[11px] font-mono-tech text-slate-300">{compactUsd(market.volume)}</span></span>
                    <span className="self-center"><span className="block text-[7px] uppercase tracking-widest text-slate-600 sm:hidden">Mov.</span><span className={`text-[11px] font-orbitron font-bold ${positive ? 'text-proyecto-green' : 'text-rose-400'}`}>{positive ? '+' : ''}{market.change}%</span></span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[9px] font-mono-tech uppercase tracking-[0.2em] text-slate-500">{selected.category} · mercado seleccionado</p>
              <h3 className="mt-2 text-sm font-orbitron font-bold leading-relaxed text-white">{selected.title}</h3>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-proyecto-accent/30 bg-proyecto-accent/10 text-proyecto-accent clip-corner-sm">
              <BarChart3 className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 border border-white/10 bg-black/30">
            <div className="border-r border-white/10 p-3">
              <p className="text-[8px] font-mono-tech uppercase tracking-widest text-slate-500">Probabilidad sí</p>
              <p className="mt-1 text-2xl font-orbitron font-black text-proyecto-green">{selected.yes}%</p>
            </div>
            <div className="p-3">
              <p className="text-[8px] font-mono-tech uppercase tracking-widest text-slate-500">Liquidez sim.</p>
              <p className="mt-1 text-xl font-orbitron font-black text-white">{compactUsd(selected.liquidity)}</p>
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-[9px] font-mono-tech uppercase tracking-widest text-slate-400">
              <span>Evolución de probabilidad</span>
              <span className="text-proyecto-green">Sí {selected.yes}%</span>
            </div>
            <div className="relative h-36 overflow-hidden border border-white/10 bg-black/25">
              <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Gráfica simulada de probabilidad">
                <defs>
                  <linearGradient id="nova-market-area" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0 25 H100 M0 50 H100 M0 75 H100" stroke="rgba(148,163,184,0.18)" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
                <polygon points={chartArea} fill="url(#nova-market-area)" />
                <polyline points={linePoints(selected.history)} fill="none" stroke="#22d3ee" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
              </svg>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
            <div className="border border-proyecto-green/20 bg-proyecto-green/5 p-3">
              <div className="flex items-center gap-2 text-proyecto-green"><TrendingUp className="h-3.5 w-3.5" /><span className="text-[8px] font-mono-tech uppercase tracking-widest">Señal</span></div>
              <p className="mt-2 text-xl font-orbitron font-black text-white">{selected.signal}<span className="text-[10px] text-slate-500">/100</span></p>
            </div>
            <div className="border border-violet-400/20 bg-violet-500/5 p-3">
              <div className="flex items-center gap-2 text-violet-300"><Activity className="h-3.5 w-3.5" /><span className="text-[8px] font-mono-tech uppercase tracking-widest">Volatilidad</span></div>
              <p className="mt-2 text-[11px] font-orbitron font-bold text-white">Controlada</p>
            </div>
          </div>

          <div className="mt-5 flex items-start gap-2 border-t border-white/10 pt-4 text-[9px] font-mono-tech leading-relaxed text-slate-500">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-proyecto-accent" />
            Datos simulados para visualización. No representan precios, recomendaciones ni operaciones reales.
          </div>
        </aside>
      </div>
    </section>
  );
};

export default LivePredictionMarketSimulation;
