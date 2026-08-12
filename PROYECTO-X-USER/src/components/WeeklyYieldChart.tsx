import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DAILY_RETURN_RATE } from '../constants';

interface Props {
  activeInvestment: number;
}

interface DataPoint {
  label: string;
  percentage: number;
  amount: number;
  isProjection: boolean;
}

const WeeklyYieldChart: React.FC<Props> = ({ activeInvestment }) => {
  const { t } = useTranslation();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const data: DataPoint[] = useMemo(() => {
    const points: DataPoint[] = [];
    const today = new Date();

    // 7 Días Pasados (Histórico)
    for (let i = 7; i > 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      // Variación realista alrededor de 2.2% (2.1% a 2.4%)
      const variance = (Math.random() * 0.3 + 2.1) / 100;
      points.push({
        label: date.toLocaleDateString(undefined, { weekday: 'short' }),
        percentage: variance * 100,
        amount: activeInvestment * variance,
        isProjection: false
      });
    }

    // 7 Días Futuros (Proyección)
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      points.push({
        label: date.toLocaleDateString(undefined, { weekday: 'short' }),
        percentage: DAILY_RETURN_RATE * 100,
        amount: activeInvestment * DAILY_RETURN_RATE,
        isProjection: true
      });
    }

    return points;
  }, [activeInvestment]);

  const totalWeeklyProjection = data.filter(d => d.isProjection).reduce((acc, curr) => acc + curr.amount, 0);
  const avgYield = data.reduce((acc, curr) => acc + curr.percentage, 0) / data.length;

  return (
    <div className="w-full h-full flex flex-col relative z-10">
      {/* Header Estadístico */}
      {/* Header Estadístico */}
      <div className="flex justify-between items-start pt-2 mb-8 px-2"> {/* Added pt-2 to avoid overlap with absolute badge */}
        <div>
          <h3 className="text-[10px] font-mono-tech font-bold text-slate-500 uppercase tracking-[0.2em] mb-1.5">{t('charts.weekly_yield')}</h3>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-orbitron font-bold text-white text-glow-white tracking-tight">${totalWeeklyProjection.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            <span className="text-[9px] font-mono-tech text-geminix-green uppercase tracking-wide border border-geminix-green/20 px-2 py-0.5 rounded-full bg-geminix-green/5">{t('charts.est_7_days')}</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[9px] font-mono-tech font-bold text-slate-500 uppercase tracking-widest mb-1">{t('charts.daily_avg')}</p>
          <div className="bg-geminix-accent/5 px-3 py-1 rounded-lg border border-geminix-accent/10 inline-block backdrop-blur-sm">
            <p className="text-xl font-orbitron font-bold text-geminix-accent text-glow-cyan leading-none">{avgYield.toFixed(2)}%</p>
          </div>
        </div>
      </div>

      {/* Gráfico de Barras */}
      <div className="flex-grow flex items-end justify-between px-2 pb-6 gap-2 relative">
        {data.map((point, i) => {
          // Normalizamos la altura: 2.2% es aprox 75% de altura
          const height = Math.min((point.percentage / 3) * 100, 100);

          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center gap-2 group relative h-full justify-end"
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {/* Tooltip */}
              {hoveredIndex === i && (
                <div className="absolute bottom-full mb-2 z-20 bg-black/90 backdrop-blur-xl border border-geminix-accent/40 p-3 clip-corner-sm shadow-[0_0_20px_rgba(0,243,255,0.2)] animate-fade-in min-w-[120px] pointer-events-none">
                  <p className="text-[8px] font-mono-tech text-slate-400 uppercase tracking-widest mb-1">
                    {point.isProjection ? 'PROJECTION' : 'REALIZED'}
                  </p>
                  <p className="text-sm font-orbitron font-bold text-white">{point.percentage.toFixed(2)}% Yield</p>
                  <p className="text-[10px] font-mono-tech text-geminix-accent">+${point.amount.toFixed(2)} USDT</p>
                </div>
              )}

              {/* Barra */}
              <div className="w-full relative flex items-end h-[60%]">
                <div
                  className={`w-full transition-all duration-700 ease-out relative ${point.isProjection
                    ? 'bg-[url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNCIgaGVpZ2h0PSI0IiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxwYXRoIGQ9Ik0wIDBoNHY0SDB6IiBmaWxsPSIjMWUyOTNiIiBmaWxsLW9wYWNpdHk9IjAuNSIvPjwvc3ZnPg==")] border-x border-t border-slate-700/50 grayscale opacity-50'
                    : 'bg-geminix-brand border-x border-t border-geminix-accent/50 shadow-[0_0_10px_rgba(0,243,255,0.3)]'
                    }`}
                  style={{
                    height: `${height}%`,
                    transitionDelay: `${i * 30}ms`
                  }}
                >
                  {/* Top Glow Line */}
                  {!point.isProjection && (
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-geminix-accent shadow-[0_0_5px_#fff]"></div>
                  )}
                </div>
              </div>

              {/* Label */}
              <span className={`text-[8px] font-mono-tech uppercase tracking-tighter ${point.isProjection ? 'text-slate-600' : 'text-slate-400 group-hover:text-white'}`}>
                {point.label}
              </span>
            </div>
          );
        })}

        {/* Indicador de "Hoy" */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-px h-[80%] border-l border-geminix-gold/50 border-dashed pointer-events-none z-0">
          <div className="absolute -top-4 -translate-x-1/2 bg-geminix-gold/20 text-[7px] font-mono-tech font-bold px-1.5 py-0.5 rounded text-geminix-gold uppercase tracking-widest border border-geminix-gold/30">
            {t('charts.now')}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeeklyYieldChart;
