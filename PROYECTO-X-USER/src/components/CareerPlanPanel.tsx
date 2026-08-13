import React from 'react';

interface CareerReward {
  teamVolume: number;
  rank: string;
  reward: string;
  icon: string;
}

const CAREER_REWARDS: CareerReward[] = [
  { teamVolume: 10000, rank: 'Bronze', reward: 'Reconocimiento NOVA', icon: '★' },
  { teamVolume: 25000, rank: 'Silver', reward: 'Tablet', icon: '▣' },
  { teamVolume: 40000, rank: 'Gold', reward: 'Teléfono móvil', icon: '◉' },
  { teamVolume: 100000, rank: 'Platinum', reward: 'Laptop', icon: '▰' },
  { teamVolume: 200000, rank: 'Diamond', reward: 'Viaje a evento NOVA', icon: '✈' },
  { teamVolume: 400000, rank: 'Diamond II', reward: 'Viaje internacional a evento', icon: '✦' },
];

const CareerPlanPanel: React.FC<{ teamVolume: number }> = ({ teamVolume }) => {
  const unlocked = CAREER_REWARDS.filter((tier) => teamVolume >= tier.teamVolume);
  const current = unlocked[unlocked.length - 1];
  const next = CAREER_REWARDS.find((tier) => teamVolume < tier.teamVolume);
  const progress = next
    ? Math.min(100, Math.max(0, (teamVolume / next.teamVolume) * 100))
    : 100;

  return (
    <section className="holo-card rounded-none clip-corner p-6 border-slate-800 bg-black/40 backdrop-blur-md relative overflow-hidden">
      <div className="absolute -right-4 -top-4 w-28 h-28 rounded-full blur-3xl opacity-20 bg-violet-500" />
      <div className="relative z-10 flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <p className="text-[9px] font-mono-tech tracking-[0.28em] text-cyan-400 uppercase">NOVA Digital</p>
            <h3 className="text-xl font-orbitron font-black text-white uppercase tracking-[0.16em]">Plan de Carrera</h3>
            <p className="mt-2 max-w-2xl text-xs text-slate-400 leading-relaxed">
              Reconocimientos por progreso de equipo. No genera pagos en efectivo ni comisiones adicionales.
            </p>
          </div>
          <span className="w-fit px-3 py-1 border border-violet-400/40 bg-violet-500/10 text-[9px] font-black tracking-[0.18em] text-violet-300 uppercase">
            Premios no monetarios
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {CAREER_REWARDS.map((tier) => {
            const achieved = teamVolume >= tier.teamVolume;
            return (
              <div key={tier.rank} className={`border p-3 clip-corner-sm ${achieved ? 'border-cyan-400/50 bg-cyan-400/5' : 'border-slate-800 bg-slate-950/40'}`}>
                <span className={`text-lg ${achieved ? 'text-cyan-300' : 'text-slate-600'}`}>{tier.icon}</span>
                <p className="mt-2 text-[9px] font-mono-tech tracking-widest text-slate-500 uppercase">{tier.rank}</p>
                <p className="mt-1 text-xs font-bold text-white">{tier.reward}</p>
                <p className="mt-1 text-[9px] text-slate-500">Meta: ${tier.teamVolume.toLocaleString('en-US')}</p>
              </div>
            );
          })}
        </div>

        <div className="border border-slate-800 bg-slate-950/50 p-4 clip-corner-sm">
          <div className="flex justify-between gap-4 text-[10px] font-mono-tech tracking-widest uppercase">
            <span className="text-slate-500">{current ? `Rango actual: ${current.rank}` : 'Primer rango: Bronze'}</span>
            <span className="text-cyan-300">${teamVolume.toLocaleString('en-US')} de volumen</span>
          </div>
          <div className="h-1.5 mt-3 bg-slate-800 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-cyan-500 to-violet-500 transition-all duration-700" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-3 text-[10px] text-slate-500">
            {next ? `Próximo reconocimiento: ${next.reward} al alcanzar $${next.teamVolume.toLocaleString('en-US')}.` : 'Has alcanzado todos los rangos publicados.'}
          </p>
        </div>
      </div>
    </section>
  );
};

export default CareerPlanPanel;
