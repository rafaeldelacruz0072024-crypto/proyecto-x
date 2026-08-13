import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SALARY_TABLE } from '../constants';

interface Props {
  teamVolume: number;
  onClaim: (amount: number) => void;
  canClaim: boolean;
  dynamicSettings?: any;
}

const SalaryPanel: React.FC<Props> = ({ teamVolume, onClaim, canClaim, dynamicSettings }) => {
  const { t } = useTranslation();
  const [windowState, setWindowState] = useState<{ isOpen: boolean; timeRemaining: string }>({
    isOpen: false,
    timeRemaining: 'Calculando...'
  });

  useEffect(() => {
    const checkWindow = () => {
      const now = new Date();
      const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
      const utc4Time = new Date(utcTime - (4 * 60 * 60 * 1000));

      const day  = utc4Time.getDay();  // 0 = Domingo
      const hour = utc4Time.getHours();

      // Ventana: Domingos 09:00 AM – 14:00 PM UTC-4
      const isOpen = day === 0 && hour >= 9 && hour < 14;

      let nextOpen = new Date(utc4Time);
      nextOpen.setHours(9, 0, 0, 0);

      if (day === 0 && hour >= 14) {
        nextOpen.setDate(nextOpen.getDate() + 7);
      } else if (day !== 0) {
        const daysUntilSunday = (7 - day) % 7 || 7;
        nextOpen.setDate(nextOpen.getDate() + daysUntilSunday);
      } else if (isOpen) {
        let nextClose = new Date(utc4Time);
        nextClose.setHours(14, 0, 0, 0);
        const diff = nextClose.getTime() - utc4Time.getTime();
        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        setWindowState({
          isOpen: true,
          timeRemaining: `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')} para el cierre`
        });
        return;
      }

      const diff = nextOpen.getTime() - utc4Time.getTime();
      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      setWindowState({
        isOpen: false,
        timeRemaining: `${d}d ${h.toString().padStart(2,'0')}h ${m.toString().padStart(2,'0')}m ${s.toString().padStart(2,'0')}s`
      });
    };

    checkWindow();
    const id = setInterval(checkWindow, 1000);
    return () => clearInterval(id);
  }, []);

  const isSunday = windowState.isOpen;

  // Usar salary_config dinámico con fallback a constants.ts
  const salaryTable = (dynamicSettings?.salary_config && Array.isArray(dynamicSettings.salary_config))
    ? dynamicSettings.salary_config
    : SALARY_TABLE;

  // Encontrar el bono actual y el siguiente
  const currentTier = [...salaryTable]
    .reverse()
    .find(s => teamVolume >= s.teamVolume) || { teamVolume: 0, bonus: 0 };

  const nextTier = salaryTable.find(s => s.teamVolume > teamVolume);

  const progress = nextTier
    ? ((teamVolume - currentTier.teamVolume) / (nextTier.teamVolume - currentTier.teamVolume)) * 100
    : 100;

  return (
    <div className="holo-card rounded-none clip-corner p-6 border-slate-800 bg-black/40 backdrop-blur-md relative overflow-hidden group">
      {/* HUD Accent Glow */}
      <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full blur-3xl opacity-10 transition-all duration-700 ${isSunday ? 'bg-proyecto-green' : 'bg-proyecto-gold'}`}></div>

      <div className="flex justify-between items-start mb-8 relative z-10">
        <div>
          <h3 className="text-xl font-orbitron font-black text-white uppercase tracking-[0.2em]">{t('dashboard.weekly_salary')}</h3>
          <p className="text-[9px] text-slate-500 font-mono-tech uppercase tracking-widest">{t('dashboard.team_bonus')}</p>
        </div>
        <div className={`px-4 py-1.5 rounded-full border transition-all duration-500 ${isSunday ? 'bg-proyecto-green/10 border-proyecto-green shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-proyecto-gold/10 border-proyecto-gold/30'}`}>
          <span className={`text-[9px] font-black uppercase tracking-widest ${isSunday ? 'text-proyecto-green animate-pulse' : 'text-proyecto-gold opacity-60'}`}>
            {isSunday ? t('salary.open_payout') : t('salary.sunday_payout')}
          </span>
        </div>
      </div>

      {/* VENTANA DE PAGO */}
      <div className={`mb-6 border clip-corner p-4 flex flex-col md:flex-row items-center justify-between gap-3 transition-all duration-500 relative z-10 ${windowState.isOpen ? 'bg-proyecto-green/10 border-proyecto-green/30' : 'bg-slate-900/80 border-slate-700/50'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 clip-corner flex items-center justify-center shrink-0 ${windowState.isOpen ? 'bg-proyecto-green/20 text-proyecto-green animate-pulse' : 'bg-slate-800 text-slate-400'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${windowState.isOpen ? 'text-proyecto-green' : 'text-slate-400'}`}>
              {windowState.isOpen ? 'Ventana de Pago Abierta' : 'Próxima Ventana de Pago'}
            </p>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">
              Domingos 09:00 AM – 02:00 PM <span className="text-slate-400">(UTC-4)</span>
            </p>
          </div>
        </div>
        <div className={`px-3 py-2 border clip-corner ${windowState.isOpen ? 'bg-proyecto-green/5 border-proyecto-green/20' : 'bg-slate-950/80 border-slate-800'}`}>
          <p className={`text-sm font-orbitron font-black tabular-nums tracking-tighter ${windowState.isOpen ? 'text-white' : 'text-slate-300'}`}>
            {windowState.timeRemaining}
          </p>
        </div>
      </div>

      <div className="text-center mb-8 relative z-10">
        <p className="text-[10px] text-slate-500 uppercase font-mono-tech tracking-[0.2em] mb-2">{t('salary.current_bonus')}</p>
        <div className="flex items-center justify-center gap-2">
          <span className="text-proyecto-gold font-orbitron text-2xl font-bold">$</span>
          <p className="text-6xl font-orbitron font-black text-white text-glow-white">
            {(currentTier.bonus || 0).toLocaleString('en-US')}
          </p>
        </div>

        {!isSunday && (
          <div className="flex items-center justify-center gap-2 mt-4 opacity-70">
            <svg className="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            <p className="text-[8px] text-red-400 font-mono-tech uppercase tracking-widest">{t('salary.locked_until')}</p>
          </div>
        )}
        {isSunday && canClaim && currentTier.bonus > 0 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <div className="w-2 h-2 rounded-full bg-proyecto-green animate-ping shadow-[0_0_10px_#10b981]"></div>
            <p className="text-[9px] text-proyecto-green font-black uppercase tracking-widest">{t('salary.ready_to_claim')}</p>
          </div>
        )}
      </div>

      {/* PROGRESS HUD */}
      {teamVolume > 0 ? (
        <div className="space-y-4 relative z-10 mb-8 px-2">
          <div className="flex justify-between items-end text-[9px] font-mono-tech uppercase tracking-widest">
            <span className="text-slate-500">{t('salary.tier_progress')}: {nextTier?.bonus ? `$${nextTier.bonus}` : t('salary.max')}</span>
            <span className="text-white">${teamVolume.toLocaleString('en-US')} / ${nextTier?.teamVolume.toLocaleString('en-US') || t('salary.max')}</span>
          </div>

          <div className="h-1.5 w-full bg-slate-900/80 rounded-none border border-slate-800 overflow-hidden relative">
            <div
              className="h-full bg-gradient-to-r from-proyecto-gold/20 via-proyecto-gold to-proyecto-gold shadow-[0_0_15px_rgba(255,215,0,0.5)] transition-all duration-1000"
              style={{ width: `${progress}%` }}
            ></div>
          </div>

          {nextTier && (
            <p className="text-center text-[8px] font-mono-tech text-slate-500 uppercase tracking-tighter">
              {t('salary.upgrade_hint', { amount: (nextTier.teamVolume - teamVolume).toLocaleString('en-US') })}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3 relative z-10 text-center py-6 border border-dashed border-slate-800/50 mb-8">
          <div className="text-slate-500 text-xs font-orbitron font-bold uppercase tracking-[0.2em] opacity-40">
            {t('salary.no_volume')}
          </div>
          <p className="text-[9px] text-slate-600 font-mono-tech uppercase leading-relaxed max-w-[200px] mx-auto">
            {t('salary.no_volume_desc')}
          </p>
        </div>
      )}

      <button
        onClick={() => onClaim(currentTier.bonus)}
        disabled={!canClaim || currentTier.bonus <= 0 || !isSunday}
        className={`w-full py-4 clip-corner-sm font-orbitron font-black text-[10px] uppercase tracking-[0.3em] transition-all transform active:scale-95 flex items-center justify-center gap-3 ${canClaim && currentTier.bonus > 0 && isSunday
          ? 'bg-proyecto-green text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:shadow-[0_0_30px_rgba(16,185,129,0.6)]'
          : 'bg-slate-900/50 text-white/10 cursor-not-allowed border border-slate-800/50'
          }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>
          {isSunday
            ? !canClaim
              ? t('salary.button_pending')
              : currentTier.bonus > 0
                ? t('salary.button_claim', { amount: currentTier.bonus.toLocaleString('en-US') })
                : t('salary.button_none')
            : t('salary.button_locked')}
        </span>
      </button>

      <div className="mt-6 pt-6 border-t border-slate-800/30 flex justify-between items-center relative z-10">
        <span className="text-[8px] font-mono-tech text-slate-600 uppercase tracking-widest leading-none">{t('salary.claim_window')}</span>
        <span className={`text-[9px] font-mono-tech uppercase tracking-widest ${isSunday ? 'text-proyecto-green font-bold' : 'text-slate-500'}`}>
          {t('salary.window_time')}
        </span>
      </div>
    </div>
  );
};

export default SalaryPanel;
