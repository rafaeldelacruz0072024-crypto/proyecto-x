import React, { useMemo, useState } from 'react';
import type { Investment } from '../types';

interface Props { investments: Investment[]; }

const WeeklyYieldChart: React.FC<Props> = ({ investments }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const data = useMemo(() => {
    const active = investments.filter(item => item.status === 'ACTIVE');
    const dailyAmount = active.reduce((sum, item) => sum + Number(item.amount) * Number(item.assigned_roi_percentage || 0) / 100, 0);
    const capital = active.reduce((sum, item) => sum + Number(item.amount), 0);
    const percentage = capital > 0 ? dailyAmount / capital * 100 : 0;
    const points: Array<{ label: string; percentage: number; amount: number }> = [];
    const date = new Date();
    while (points.length < 7) {
      if (date.getDay() !== 0 && date.getDay() !== 6) {
        points.push({ label: date.toLocaleDateString(undefined, { weekday: 'short' }), percentage, amount: dailyAmount });
      }
      date.setDate(date.getDate() + 1);
    }
    return points;
  }, [investments]);

  const totalProjection = data.reduce((sum, point) => sum + point.amount, 0);
  const average = data[0]?.percentage || 0;

  return (
    <div className="relative z-10 flex h-full w-full flex-col">
      <div className="mb-8 flex items-start justify-between px-2 pt-2">
        <div>
          <h3 className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Proyección de 7 días hábiles</h3>
          <span className="text-3xl font-bold tracking-tight text-white">${totalProjection.toFixed(2)}</span>
        </div>
        <div className="text-right">
          <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-slate-500">Promedio diario</p>
          <p className="rounded-lg border border-cyan-400/10 bg-cyan-400/5 px-3 py-1 text-xl font-bold text-cyan-400">{average.toFixed(3)}%</p>
        </div>
      </div>
      <div className="flex flex-grow items-end justify-between gap-2 px-2 pb-6">
        {data.map((point, index) => {
          const height = Math.max(4, Math.min(point.percentage / 2 * 100, 100));
          return (
            <div key={`${point.label}-${index}`} className="relative flex h-full flex-1 flex-col items-center justify-end gap-2" onMouseEnter={() => setHoveredIndex(index)} onMouseLeave={() => setHoveredIndex(null)}>
              {hoveredIndex === index && <div className="absolute bottom-full z-20 mb-2 min-w-28 rounded-lg border border-cyan-400/30 bg-black/90 p-3 text-center"><p className="text-sm font-bold text-white">{point.percentage.toFixed(3)}%</p><p className="text-xs text-cyan-400">+${point.amount.toFixed(2)}</p></div>}
              <div className="flex h-[60%] w-full items-end"><div className="w-full border-x border-t border-cyan-400/20 bg-blue-600 shadow-[0_0_10px_rgba(0,243,255,0.25)] transition-all" style={{ height: `${height}%` }} /></div>
              <span className="text-[8px] uppercase text-slate-500">{point.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WeeklyYieldChart;
