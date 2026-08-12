import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Users, Activity, Radio, Cpu } from 'lucide-react';
import { SocketMessage } from '../services/websocket';

interface Props {
  settings: any;
  latestEvent: SocketMessage | null;
}

interface Coordinate {
  x: number;
  y: number;
  flag: string;
  code: string;
}

const COUNTRY_COORDINATES: Record<string, Coordinate> = {
  'Estados Unidos': { x: 23, y: 37, flag: '🇺🇸', code: 'US' },
  'United States': { x: 23, y: 37, flag: '🇺🇸', code: 'US' },
  'US': { x: 23, y: 37, flag: '🇺🇸', code: 'US' },
  'España': { x: 49, y: 36, flag: '🇪🇸', code: 'ES' },
  'Spain': { x: 49, y: 36, flag: '🇪🇸', code: 'ES' },
  'ES': { x: 49, y: 36, flag: '🇪🇸', code: 'ES' },
  'México': { x: 20, y: 46, flag: '🇲🇽', code: 'MX' },
  'Mexico': { x: 20, y: 46, flag: '🇲🇽', code: 'MX' },
  'MX': { x: 20, y: 46, flag: '🇲🇽', code: 'MX' },
  'Colombia': { x: 28, y: 56, flag: '🇨🇴', code: 'CO' },
  'CO': { x: 28, y: 56, flag: '🇨🇴', code: 'CO' },
  'Venezuela': { x: 32, y: 53, flag: '🇻🇪', code: 'VE' },
  'VE': { x: 32, y: 53, flag: '🇻🇪', code: 'VE' },
  'Alemania': { x: 51, y: 29, flag: '🇩🇪', code: 'DE' },
  'Germany': { x: 51, y: 29, flag: '🇩🇪', code: 'DE' },
  'DE': { x: 51, y: 29, flag: '🇩🇪', code: 'DE' },
  'Francia': { x: 48, y: 32, flag: '🇫🇷', code: 'FR' },
  'France': { x: 48, y: 32, flag: '🇫🇷', code: 'FR' },
  'FR': { x: 48, y: 32, flag: '🇫🇷', code: 'FR' },
  'Italia': { x: 51, y: 35, flag: '🇮🇹', code: 'IT' },
  'Italy': { x: 51, y: 35, flag: '🇮🇹', code: 'IT' },
  'IT': { x: 51, y: 35, flag: '🇮🇹', code: 'IT' },
  'India': { x: 71, y: 47, flag: '🇮🇳', code: 'IN' },
  'IN': { x: 71, y: 47, flag: '🇮🇳', code: 'IN' },
  'Brasil': { x: 36, y: 65, flag: '🇧🇷', code: 'BR' },
  'Brazil': { x: 36, y: 65, flag: '🇧🇷', code: 'BR' },
  'BR': { x: 36, y: 65, flag: '🇧🇷', code: 'BR' },
  'Perú': { x: 27, y: 61, flag: '🇵🇪', code: 'PE' },
  'Peru': { x: 27, y: 61, flag: '🇵🇪', code: 'PE' },
  'PE': { x: 27, y: 61, flag: '🇵🇪', code: 'PE' },
  'República Dominicana': { x: 31, y: 47, flag: '🇩🇴', code: 'DO' },
  'Dominican Republic': { x: 31, y: 47, flag: '🇩🇴', code: 'DO' },
  'DO': { x: 31, y: 47, flag: '🇩🇴', code: 'DO' }
};

export default function WorldMapWidget({ settings, latestEvent }: Props) {
  const { t } = useTranslation();
  const [activePulses, setActivePulses] = useState<Record<string, boolean>>({});
  const [usersOnline, setUsersOnline] = useState(500);

  // Dynamic Online Users animation (Base users +/- variance)
  useEffect(() => {
    const base = settings?.base_users || 500;
    const variance = settings?.variance || 80;
    setUsersOnline(base);

    const interval = setInterval(() => {
      const offset = Math.floor((Math.random() - 0.5) * variance);
      setUsersOnline(Math.max(10, base + offset));
    }, 4000);

    return () => clearInterval(interval);
  }, [settings]);

  // Listen to new events and trigger pulse rings on coordinates
  useEffect(() => {
    if (!latestEvent?.payload?.country) return;

    const countryName = latestEvent.payload.country;
    if (COUNTRY_COORDINATES[countryName]) {
      setActivePulses((prev) => ({ ...prev, [countryName]: true }));

      // Clear pulse after animation ends (2s)
      const timer = setTimeout(() => {
        setActivePulses((prev) => ({ ...prev, [countryName]: false }));
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [latestEvent]);

  // Extract list of active countries from settings
  const activeCountriesList = settings?.active_countries || [];

  return (
    <div className="holo-card p-6 bg-black/50 border-slate-800 rounded-3xl overflow-hidden backdrop-blur-2xl flex flex-col md:grid md:grid-cols-4 gap-6 min-h-[450px] relative group">
      {/* Glow Effects */}
      <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full blur-3xl opacity-10 bg-geminix-accent group-hover:opacity-20 transition-all pointer-events-none" />
      <div className="absolute -left-10 -bottom-10 w-40 h-40 rounded-full blur-3xl opacity-10 bg-geminix-brand group-hover:opacity-20 transition-all pointer-events-none" />

      {/* Cyber Grid Pattern */}
      <div className="absolute inset-0 bg-grid opacity-[0.03] pointer-events-none z-0"></div>

      {/* Left panel: Telemetry stats */}
      <div className="md:col-span-1 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-800/60 pb-4 md:pb-0 md:pr-6 z-10">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Radio className="w-4 h-4 text-geminix-accent animate-pulse" />
            <span className="font-orbitron text-xs font-black tracking-[0.2em] text-white">TELEMETRÍA GLOBAL</span>
          </div>
          <p className="text-[10px] text-slate-500 font-mono-tech uppercase tracking-wider mb-6">Red de Nodos y Arbitraje de IA</p>

          <div className="space-y-5">
            {/* Stat: Online Users */}
            <div className="bg-white/5 border border-white/5 rounded-xl p-3 backdrop-blur-md">
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <Users className="w-3.5 h-3.5" />
                <span className="text-[9px] font-mono-tech font-bold uppercase tracking-wider">{t('network.active_node', 'Nodos Activos')}</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-orbitron font-bold text-white tabular-nums">{usersOnline.toLocaleString()}</span>
                <span className="text-[8px] font-mono-tech text-geminix-green font-bold uppercase tracking-wider animate-pulse">ONLINE</span>
              </div>
            </div>

            {/* Stat: Network Status */}
            <div className="bg-white/5 border border-white/5 rounded-xl p-3 backdrop-blur-md">
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <Activity className="w-3.5 h-3.5" />
                <span className="text-[9px] font-mono-tech font-bold uppercase tracking-wider">Estado de Simulación</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${settings?.is_active ? 'bg-geminix-green animate-pulse shadow-[0_0_8px_#10b981]' : 'bg-red-500'}`} />
                <span className={`text-[10px] font-orbitron font-black uppercase tracking-widest ${settings?.is_active ? 'text-geminix-green' : 'text-red-400'}`}>
                  {settings?.is_active ? 'ACTIVO' : 'PAUSADO'}
                </span>
              </div>
            </div>

            {/* Stat: Average Yield speed */}
            <div className="bg-white/5 border border-white/5 rounded-xl p-3 backdrop-blur-md">
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <Cpu className="w-3.5 h-3.5" />
                <span className="text-[9px] font-mono-tech font-bold uppercase tracking-wider">Intervalo IA Feed</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-orbitron font-bold text-geminix-accent tabular-nums">{settings?.speed || 5}</span>
                <span className="text-[8px] font-mono-tech text-slate-500 font-bold uppercase tracking-wider">segundos</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sync telemetry text footer */}
        <div className="text-[9px] font-mono-tech text-slate-500 uppercase tracking-widest mt-6">
          <span>LATENCY: </span>
          <span className="text-geminix-green font-bold">12ms</span>
          <span className="mx-2">|</span>
          <span>THROUGHPUT: </span>
          <span className="text-white">1.04 Gb/s</span>
        </div>
      </div>

      {/* Right panel: Map Display */}
      <div className="md:col-span-3 flex flex-col justify-center relative select-none z-10">
        <div className="relative w-full aspect-[2/1] bg-slate-950/40 rounded-2xl overflow-hidden border border-slate-900 shadow-inner">
          {/* Grid Background Effect */}
          <div className="absolute inset-0 bg-grid opacity-10 pointer-events-none z-0" />

          {/* Dark World Map Image Background */}
          <img
            src="/world-map-dark.png"
            alt="World Map"
            className="w-full h-full object-cover opacity-60 filter brightness-[0.7] contrast-[1.1] z-0"
            draggable="false"
          />

          {/* Active Overlay Pulse Points */}
          {activeCountriesList.map((countryName: string) => {
            const coord = COUNTRY_COORDINATES[countryName];
            if (!coord) return null;

            const isPulsing = activePulses[countryName];

            return (
              <div
                key={countryName}
                className="absolute z-20 -translate-x-1/2 -translate-y-1/2 group/marker"
                style={{ left: `${coord.x}%`, top: `${coord.y}%` }}
              >
                {/* Active pulse ripple ring */}
                {isPulsing && (
                  <>
                    <div className="absolute w-12 h-12 -left-6 -top-6 rounded-full border border-geminix-accent/50 animate-ping opacity-75" />
                    <div className="absolute w-8 h-8 -left-4 -top-4 rounded-full border-2 border-geminix-brand/60 animate-ping opacity-50 animation-delay-500" />
                    <div className="absolute w-4 h-4 -left-2 -top-2 rounded-full bg-white animate-pulse" />
                  </>
                )}

                {/* Constant small marker dot */}
                <div className={`w-2 h-2 rounded-full transition-all duration-300 border border-black shadow-lg ${
                  isPulsing
                    ? 'bg-white scale-125 shadow-[0_0_15px_#00f3ff]'
                    : 'bg-geminix-accent/80 hover:bg-white hover:scale-125'
                }`} />

                {/* Country Tooltip Hover */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/90 border border-slate-800 px-2.5 py-1 rounded-lg text-[9px] font-mono-tech text-white flex items-center gap-1.5 opacity-0 group-hover/marker:opacity-100 transition-opacity whitespace-nowrap shadow-xl z-30 pointer-events-none">
                  <span>{coord.flag}</span>
                  <span className="font-bold tracking-wider">{coord.code}</span>
                  <span className="text-slate-500">•</span>
                  <span>{countryName}</span>
                </div>
              </div>
            );
          })}

          {/* Floating Event Overlay Display */}
          {latestEvent && latestEvent.payload?.country && (
            <div className="absolute bottom-4 right-4 max-w-xs bg-slate-950/90 border border-geminix-accent/30 rounded-2xl p-4 shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur-md animate-fade-in z-30 flex items-start gap-3">
              {/* Event Badge Glow */}
              <div className={`w-1.5 h-10 rounded-full flex-shrink-0 ${
                latestEvent.type === 'PROFIT_TICK' ? 'bg-geminix-green shadow-[0_0_8px_#10b981]' : 'bg-geminix-accent shadow-[0_0_8px_cyan]'
              }`} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                  {COUNTRY_COORDINATES[latestEvent.payload.country] && (
                    <span className="text-xs">{COUNTRY_COORDINATES[latestEvent.payload.country].flag}</span>
                  )}
                  <span className="text-[8px] font-black font-orbitron text-geminix-accent uppercase tracking-wider">
                    {latestEvent.payload.country}
                  </span>
                  <span className="text-[8px] text-slate-500 font-mono">•</span>
                  <span className="text-[8px] text-slate-400 font-mono uppercase tracking-widest">
                    {latestEvent.type.replace('_', ' ')}
                  </span>
                </div>

                <p className="text-[10px] text-slate-300 font-medium font-rajdhani line-clamp-2 leading-tight">
                  {latestEvent.payload.description}
                </p>

                {latestEvent.payload.amount && (
                  <p className="text-xs font-orbitron font-black text-geminix-green mt-1">
                    +${latestEvent.payload.amount.toFixed(2)} USD
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
