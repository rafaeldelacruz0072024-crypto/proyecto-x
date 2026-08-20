import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Logo from './Logo';
import LanguageSwitcher from './LanguageSwitcher';

interface Props {
  user: any; // Flexible to accept User from types.ts or Supabase profile
  balance: number;
  onProfileClick?: () => void;
  onMenuToggle?: () => void;
}

const DashboardHeader: React.FC<Props> = ({ user, balance, onProfileClick, onMenuToggle }) => {
  const { t } = useTranslation();
  const [isLive, setIsLive] = useState(false);

  // Simulate WebSocket heartbeat
  useEffect(() => {
    const timer = setInterval(() => {
      setIsLive(prev => !prev);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  // Extract user name
  const userName = user?.username || user?.full_name || user?.name || user?.email?.split('@')[0] || t('common.user_placeholder', { defaultValue: 'User' });
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-50 flex min-h-[64px] items-center justify-between gap-2 border-b border-proyecto-accent/30 bg-black/75 px-2.5 py-2 backdrop-blur-xl shadow-[0_4px_30px_rgba(139,92,246,0.14)] sm:min-h-[72px] sm:px-4 md:px-6">

      <div className="relative z-10 flex min-w-0 items-center gap-2 sm:gap-4">
        {/* HAMBURGER — mobile only */}
        <button
          onClick={onMenuToggle}
          className="flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 border border-proyecto-accent/30 bg-black/40 px-2.5 transition-all hover:bg-proyecto-brand/20 sm:px-3"
          aria-label="Open menu"
        >
          <div className="flex flex-col justify-center gap-1.5">
            <span className="w-5 h-[1.5px] bg-proyecto-accent"></span>
            <span className="w-5 h-[1.5px] bg-proyecto-accent"></span>
            <span className="w-3 h-[1.5px] bg-proyecto-accent self-start"></span>
          </div>
          <span className="hidden text-[9px] font-orbitron font-black uppercase tracking-[0.2em] text-proyecto-accent min-[420px]:inline md:hidden">MENU</span>
        </button>

        {/* LOGO */}
        <div className="relative group cursor-pointer" onClick={onProfileClick}>
          <div className="absolute inset-0 bg-proyecto-accent blur-2xl opacity-10 group-hover:opacity-30 transition-opacity"></div>
          <Logo size="sm" variant="icon" glow={true} className="relative z-10 transition-transform duration-700 hover:scale-105" />
        </div>

        <div className="hidden md:flex flex-col border-l border-white/10 pl-4">
          <p className="text-[10px] uppercase text-proyecto-accent font-orbitron font-bold tracking-[0.3em] text-glow-cyan">
            Nova Digital · Red segura
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className={`h-1.5 w-1.5 rounded-full ${isLive ? 'bg-green-500 shadow-[0_0_5px_#22c55e]' : 'bg-slate-600'} transition-all duration-500`}></span>
            <span className="text-[8px] text-slate-400 font-mono-tech uppercase tracking-widest">
              UPLINK: {isLive ? t('common.stable', { defaultValue: 'STABLE' }) : t('common.scanning', { defaultValue: 'SCANNING...' })}
            </span>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex shrink-0 items-center gap-2 sm:gap-4 md:gap-8">
        <div className="text-right hidden md:block">
          <p className="text-[9px] uppercase text-slate-500 font-mono-tech font-bold tracking-widest mb-1">{t('dashboard.liquidity_available')}</p>
          <div className="flex items-center justify-end gap-2 group">
            <p className="text-2xl font-orbitron font-bold text-white group-hover:text-glow-white transition-all">
              <span className="text-proyecto-green mr-1">$</span>
              {(balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {/* AVATAR */}
          <div className="relative group cursor-pointer" onClick={onProfileClick}>
            <div className="absolute -inset-1 bg-gradient-to-r from-proyecto-accent to-proyecto-brand rounded-full blur opacity-20 group-hover:opacity-75 transition duration-500"></div>
            <div className="relative flex h-9 w-9 items-center justify-center border border-proyecto-accent/50 bg-black text-xs font-bold text-white shadow-lg clip-corner-sm font-orbitron sm:h-10 sm:w-10 sm:text-sm">
              {userInitial}
            </div>

            {/* STATUS BADGE */}
            <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-black rounded-full flex items-center justify-center">
              <div className="h-2 w-2 bg-proyecto-green rounded-full animate-pulse"></div>
            </div>
          </div>

          <div className="hidden text-left min-[520px]:block md:hidden">
            <p className="text-[10px] text-white font-orbitron uppercase">{userName}</p>
            <p className="text-[8px] text-proyecto-accent font-mono-tech">ID: #{user?.id?.slice(0, 4)}</p>
          </div>
        </div>

        {/* LANGUAGE SWITCHER */}
        <LanguageSwitcher />
      </div>
    </header>
  );
};

export default DashboardHeader;
