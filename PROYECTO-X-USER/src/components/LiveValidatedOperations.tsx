import React, { useEffect, useMemo, useState } from 'react';
import { Activity, CheckCircle2, Radio, ShieldCheck } from 'lucide-react';

type ValidatedOperation = {
  id: string;
  market: string;
  signal: string;
  validations: number;
  result: number;
  createdAt: Date;
};

const MARKET_SOURCES = [
  ['Política global', 'Probabilidad calibrada'],
  ['Economía', 'Liquidez contrastada'],
  ['Tecnología', 'Señal confirmada'],
  ['Cripto', 'Volatilidad validada'],
  ['Deportes', 'Consenso procesado'],
  ['Eventos globales', 'Pronóstico verificado'],
] as const;

const createCode = () => Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, 'X');

const createOperation = (offset = 0): ValidatedOperation => {
  const [market, signal] = MARKET_SOURCES[(Math.floor(Math.random() * MARKET_SOURCES.length) + offset) % MARKET_SOURCES.length];
  return {
    id: `NV-${createCode()}`,
    market,
    signal,
    validations: Math.floor(900 + Math.random() * 3900),
    result: Number((0.04 + Math.random() * 0.46).toFixed(4)),
    createdAt: new Date(Date.now() - offset * 4200),
  };
};

const INITIAL_OPERATIONS = Array.from({ length: 7 }, (_, index) => createOperation(index));

const LiveValidatedOperations: React.FC = () => {
  const [operations, setOperations] = useState<ValidatedOperation[]>(INITIAL_OPERATIONS);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setOperations(current => [createOperation(), ...current].slice(0, 8));
      setLastUpdate(new Date());
      setCycle(current => current + 1);
    }, 3200);

    return () => window.clearInterval(interval);
  }, []);

  const totalValidations = useMemo(
    () => operations.reduce((total, operation) => total + operation.validations, 0),
    [operations]
  );

  return (
    <section className="holo-card overflow-hidden rounded-none border border-proyecto-accent/20 bg-slate-950/75 clip-corner">
      <div className="flex flex-col gap-4 border-b border-white/10 px-4 py-5 sm:px-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-proyecto-accent">
            <Radio className="h-4 w-4 animate-pulse" />
            <span className="text-[9px] font-mono-tech font-bold uppercase tracking-[0.24em] sm:text-[10px]">Motor algorítmico NOVA</span>
          </div>
          <h2 className="mt-2 text-xl font-orbitron font-black tracking-tight text-white sm:text-2xl md:text-3xl">Operaciones validadas, en directo</h2>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-slate-400 sm:text-sm">Flujo visual de señales procesadas por el motor de mercados de predicción.</p>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono-tech text-[9px] uppercase tracking-widest text-slate-400">
          <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-proyecto-green shadow-[0_0_10px_#10b981]" />Actualiza cada 3s</span>
          <span>{totalValidations.toLocaleString('es-DO')} validaciones</span>
          <span>{lastUpdate.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-[170px_minmax(250px,1fr)_140px_150px] border-b border-white/10 bg-black/25 px-5 py-3 font-mono-tech text-[8px] uppercase tracking-[0.2em] text-slate-500 sm:px-6">
            <span>Nodo</span>
            <span>Mercado / señal</span>
            <span className="text-right">Validaciones</span>
            <span className="text-right">Resultado sim.</span>
          </div>

          <div aria-live="polite">
            {operations.map((operation, index) => (
              <div
                key={`${operation.id}-${operation.createdAt.getTime()}`}
                className={`grid grid-cols-[170px_minmax(250px,1fr)_140px_150px] items-center border-b border-white/[0.07] px-5 py-4 transition-colors hover:bg-proyecto-accent/[0.04] sm:px-6 ${index === 0 && cycle > 0 ? 'animate-fade-in bg-proyecto-green/[0.035]' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-proyecto-green opacity-50" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  <span className="font-mono-tech text-xs font-bold tracking-wider text-white">{operation.id}</span>
                </div>
                <div className="min-w-0">
                  <p className="truncate font-mono-tech text-xs text-slate-300">{operation.market}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-slate-500"><CheckCircle2 className="h-3 w-3 text-proyecto-green" />{operation.signal}</p>
                </div>
                <div className="text-right font-mono-tech text-xs text-slate-400">{operation.validations.toLocaleString('es-DO')} ops</div>
                <div className="text-right font-mono-tech text-sm font-black text-proyecto-green">+{operation.result.toFixed(4)}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-white/10 bg-black/20 px-4 py-3 text-[9px] font-mono-tech leading-relaxed text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <span className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-proyecto-accent" />Simulación visual informativa. No representa operaciones, rendimientos ni comisiones reales.</span>
        <span className="flex items-center gap-2 uppercase tracking-widest"><Activity className="h-3.5 w-3.5 text-violet-300" />Sistema activo</span>
      </div>
    </section>
  );
};

export default LiveValidatedOperations;
