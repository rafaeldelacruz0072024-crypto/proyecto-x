import React, { useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, BrainCircuit, Radio, TrendingUp } from 'lucide-react';
import { SocketMessage } from '../services/websocket';

interface Props {
  settings: any;
  latestEvent: SocketMessage | null;
}

interface MarketPulse {
  id: string;
  title: string;
  category: string;
  region: string;
  x: number;
  y: number;
  probability: number;
  volume: number;
  change: number;
}

const INITIAL_MARKETS: MarketPulse[] = [
  { id: 'us-rate', title: 'Decisión de tasas en EE. UU.', category: 'Economía', region: 'Norteamérica', x: 23, y: 38, probability: 64, volume: 2.4, change: 1.8 },
  { id: 'latam-election', title: 'Resultado electoral regional', category: 'Política', region: 'Latinoamérica', x: 31, y: 61, probability: 52, volume: 1.1, change: -0.7 },
  { id: 'eu-inflation', title: 'Inflación europea bajo objetivo', category: 'Economía', region: 'Europa', x: 51, y: 35, probability: 71, volume: 1.8, change: 2.1 },
  { id: 'asia-tech', title: 'Índice tecnológico cierra al alza', category: 'Tecnología', region: 'Asia', x: 77, y: 43, probability: 58, volume: 3.2, change: 0.9 },
  { id: 'global-crypto', title: 'Mercado cripto supera resistencia', category: 'Cripto', region: 'Global', x: 61, y: 58, probability: 46, volume: 4.6, change: -1.3 },
];

const clamp = (value: number) => Math.min(99, Math.max(1, value));

export default function WorldMapWidget({ settings, latestEvent }: Props) {
  const [markets, setMarkets] = useState(INITIAL_MARKETS);
  const [activeIndex, setActiveIndex] = useState(0);
  const [updatedAt, setUpdatedAt] = useState(new Date());
  const refreshSeconds = Math.max(3, Number(settings?.speed) || 5);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setMarkets((current) => current.map((market, index) => {
        const movement = Number(((Math.random() - 0.5) * 2.4).toFixed(1));
        return index === activeIndex
          ? { ...market, probability: clamp(Number((market.probability + movement).toFixed(1))), change: movement, volume: Number((market.volume + Math.random() * 0.08).toFixed(2)) }
          : market;
      }));
      setActiveIndex((current) => (current + 1) % INITIAL_MARKETS.length);
      setUpdatedAt(new Date());
    }, refreshSeconds * 1000);

    return () => window.clearInterval(interval);
  }, [activeIndex, refreshSeconds]);

  const activeMarket = markets[activeIndex];
  const totalVolume = useMemo(() => markets.reduce((sum, market) => sum + market.volume, 0), [markets]);
  const averageProbability = useMemo(() => markets.reduce((sum, market) => sum + market.probability, 0) / markets.length, [markets]);

  return (
    <section className="holo-card rounded-3xl overflow-hidden border border-cyan-400/20 bg-[#030a18]/90 p-5 md:p-7 relative">
      <div className="absolute inset-0 bg-grid opacity-[0.035] pointer-events-none" />
      <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-violet-600/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col gap-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-cyan-300">
              <Radio className="h-4 w-4 animate-pulse" />
              <span className="font-orbitron text-[10px] font-black uppercase tracking-[0.32em]">Radar predictivo global</span>
            </div>
            <h2 className="font-orbitron text-2xl font-black text-white md:text-3xl">Telemetría de mercados</h2>
            <p className="mt-2 max-w-2xl font-mono-tech text-xs leading-relaxed text-slate-400">
              Monitoreo simulado de probabilidades, liquidez y variaciones en mercados de predicción globales.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-2 text-[10px] font-orbitron font-bold uppercase tracking-widest text-emerald-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_12px_#34d399]" />
            Señal en vivo · {updatedAt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric icon={<Activity />} label="Mercados vigilados" value={String(markets.length)} accent="text-cyan-300" />
          <Metric icon={<BarChart3 />} label="Volumen observado" value={`$${totalVolume.toFixed(1)}M`} accent="text-blue-300" />
          <Metric icon={<BrainCircuit />} label="Probabilidad media" value={`${averageProbability.toFixed(1)}%`} accent="text-violet-300" />
          <Metric icon={<TrendingUp />} label="Frecuencia de análisis" value={`${refreshSeconds}s`} accent="text-emerald-300" />
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.55fr_1fr]">
          <div className="relative min-h-[320px] overflow-hidden rounded-2xl border border-cyan-400/10 bg-slate-950/70">
            <img src="/world-map-dark.png" alt="Mapa de actividad de mercados de predicción" className="absolute inset-0 h-full w-full object-cover opacity-55 brightness-75 contrast-125" draggable="false" />
            <div className="absolute inset-0 bg-gradient-to-br from-blue-950/25 via-transparent to-violet-950/30" />
            {markets.map((market, index) => (
              <button
                key={market.id}
                type="button"
                aria-label={`Ver señal: ${market.title}`}
                onClick={() => setActiveIndex(index)}
                className="group absolute z-10 -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${market.x}%`, top: `${market.y}%` }}
              >
                {index === activeIndex && <span className="absolute -left-5 -top-5 h-10 w-10 animate-ping rounded-full border border-cyan-300/70" />}
                <span className={`block h-3 w-3 rounded-full border-2 border-slate-950 transition ${index === activeIndex ? 'scale-125 bg-cyan-200 shadow-[0_0_18px_#22d3ee]' : 'bg-violet-400 shadow-[0_0_10px_#8b5cf6]'}`} />
                <span className="pointer-events-none absolute bottom-5 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-cyan-400/20 bg-slate-950/95 px-3 py-2 text-[9px] font-mono-tech text-white group-hover:block">
                  {market.region} · {market.probability}%
                </span>
              </button>
            ))}
            <div className="absolute bottom-4 left-4 right-4 z-10 rounded-xl border border-cyan-300/15 bg-[#020817]/90 p-4 backdrop-blur-xl">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-orbitron text-[9px] uppercase tracking-[0.25em] text-cyan-300">Señal destacada · {activeMarket.region}</span>
                <span className={`font-mono-tech text-xs font-bold ${activeMarket.change >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{activeMarket.change >= 0 ? '+' : ''}{activeMarket.change}%</span>
              </div>
              <p className="mt-2 font-rajdhani text-lg font-bold text-white">{activeMarket.title}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {markets.map((market, index) => (
              <button key={market.id} type="button" onClick={() => setActiveIndex(index)} className={`rounded-xl border p-3 text-left transition ${index === activeIndex ? 'border-cyan-300/40 bg-cyan-300/10 shadow-[0_0_24px_rgba(34,211,238,0.08)]' : 'border-white/5 bg-white/[0.025] hover:border-violet-400/30'}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-rajdhani text-sm font-bold text-white">{market.title}</p>
                    <p className="font-mono-tech text-[8px] uppercase tracking-widest text-slate-500">{market.category} · Vol. ${market.volume.toFixed(2)}M</p>
                  </div>
                  <span className="font-orbitron text-lg font-black text-cyan-300">{market.probability}%</span>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500 transition-all duration-700" style={{ width: `${market.probability}%` }} /></div>
              </button>
            ))}
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-4 font-mono-tech text-[9px] uppercase tracking-wider text-slate-500">
          <span>Simulación visual informativa · No ejecuta apuestas ni operaciones reales</span>
          <span>{latestEvent ? `Canal conectado · ${latestEvent.type.replaceAll('_', ' ')}` : 'Canal de datos simulado activo'}</span>
        </footer>
      </div>
    </section>
  );
}

function Metric({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.035] p-4">
      <div className={`mb-2 flex h-5 w-5 items-center ${accent}`}>{icon}</div>
      <p className="font-mono-tech text-[8px] uppercase tracking-widest text-slate-500">{label}</p>
      <p className={`mt-1 font-orbitron text-xl font-black ${accent}`}>{value}</p>
    </div>
  );
}
