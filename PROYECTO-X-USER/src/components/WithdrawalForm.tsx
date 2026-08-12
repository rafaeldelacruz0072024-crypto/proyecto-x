import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Profile } from '../types';
import { getSystemSettings } from '../services/database';
import { supabase } from '../lib/supabase';

interface Props {
  balance: number;
  handleWithdrawal: (amount: number, method: string, address: string) => void;
  user?: Profile; // USAMOS PROFILE EN LUGAR DE USER
}

const WithdrawalForm: React.FC<Props> = ({ balance, handleWithdrawal, user }) => {
  const { t, i18n } = useTranslation();
  const [amount, setAmount] = useState<string>('');
  const [method, setMethod] = useState<string>('USDT');
  const hasPhyzerCard = !!(user?.phyzer_card_address);
  const address = method === 'PHYZER CARD'
    ? (user?.phyzer_card_address || '')
    : (user?.withdrawal_wallet || '');
  const [withdrawalFeePercent, setWithdrawalFeePercent] = useState<number>(10);
  const [minWithdrawal, setMinWithdrawal] = useState<number>(25);
  const [windowState, setWindowState] = useState<{ isOpen: boolean; timeRemaining: string; label: string }>({
    isOpen: false,
    timeRemaining: 'Calculando...',
    label: 'Próxima Ventana de Retiro'
  });
  // Configuración de ventana leída de Supabase
  const [windowConfig, setWindowConfig] = useState({
    globalBlocked: false,
    windowEnabled: true,
    openDay: null as number | null,  // null = Diario
    openHour: 9,
    closeHour: 15,
  });

  useEffect(() => {
    async function loadSettings() {
      const settings = await getSystemSettings();
      if (!settings) return;
      if (settings.withdrawal_fee)      setWithdrawalFeePercent(settings.withdrawal_fee);
      if (settings.min_withdrawal)      setMinWithdrawal(settings.min_withdrawal);
      setWindowConfig({
        globalBlocked: settings.withdrawal_global_blocked  ?? false,
        windowEnabled: settings.withdrawal_window_enabled  ?? true,
        openDay:       null, // Lunes a Domingo
        openHour:      9,    // 9 AM
        closeHour:     15,   // 3 PM (15:00)
      });
    }
    loadSettings();
  }, []);

  const [hasWithdrawalToday, setHasWithdrawalToday] = useState<boolean>(false);

  useEffect(() => {
    if (!user?.id) return;
    async function checkDailyLimit() {
      try {
        const now = new Date();
        const utc4Time = new Date(now.getTime() - (4 * 60 * 60 * 1000));
        const todayStr = utc4Time.toISOString().split('T')[0];

        const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
        const { data: recentWds, error } = await supabase
          .from('withdrawals')
          .select('created_at, status')
          .eq('user_id', user.id)
          .neq('status', 'REJECTED')
          .gte('created_at', twoDaysAgo.toISOString());

        if (error) throw error;

        const existsToday = recentWds?.some(wd => {
          const wdUtc4 = new Date(new Date(wd.created_at).getTime() - (4 * 60 * 60 * 1000));
          const wdDateStr = wdUtc4.toISOString().split('T')[0];
          return wdDateStr === todayStr;
        }) || false;

        setHasWithdrawalToday(existsToday);
      } catch (err) {
        console.error('Error checking daily withdrawal limit:', err);
      }
    }
    checkDailyLimit();
  }, [user?.id, balance]);

  useEffect(() => {
    const DAY_NAMES = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

    const checkWithdrawalWindow = () => {
      // Si está bloqueado globalmente
      if (windowConfig.globalBlocked) {
        setWindowState({ isOpen: false, timeRemaining: 'Retiros Suspendidos', label: 'Sistema Bloqueado' });
        return;
      }

      // Si no hay restricción de ventana → siempre abierto
      if (!windowConfig.windowEnabled) {
        setWindowState({ isOpen: true, timeRemaining: 'Abierto 24/7', label: 'Ventana de Retiros Abierta' });
        return;
      }

      const now = new Date();
      const utc4Time = new Date(now.getTime() - (4 * 60 * 60 * 1000));
      const day  = utc4Time.getUTCDay();
      const hour = utc4Time.getUTCHours();

      const { openDay, openHour, closeHour } = windowConfig;
      const dayMatch = openDay === null || day === openDay;
      const isOpen   = dayMatch && hour >= openHour && hour < closeHour;

      if (isOpen) {
        // Tiempo hasta el cierre
        const nextClose = new Date(utc4Time);
        nextClose.setUTCHours(closeHour, 0, 0, 0);
        const diff = nextClose.getTime() - utc4Time.getTime();
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        const dayLabel = openDay !== null
          ? `${DAY_NAMES[openDay]}s`
          : (i18n.language?.startsWith('es') ? 'Lunes a Domingo' : 'Monday to Sunday');
        setWindowState({
          isOpen: true,
          timeRemaining: `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')} para el cierre`,
          label: `${dayLabel} · ${String(openHour).padStart(2,'0')}:00 – ${String(closeHour).padStart(2,'0')}:00 (UTC-4)`
        });
        return;
      }

      // Calcular próxima apertura
      let nextOpen = new Date(utc4Time);
      nextOpen.setUTCHours(openHour, 0, 0, 0);

      if (openDay === null) {
        // Mismo día si no ha pasado la hora, si no mañana
        if (hour >= closeHour) nextOpen.setUTCDate(nextOpen.getUTCDate() + 1);
      } else {
        const daysUntil = (openDay - day + 7) % 7 || (hour >= closeHour ? 7 : 0);
        nextOpen.setUTCDate(nextOpen.getUTCDate() + daysUntil);
      }

      const diff = nextOpen.getTime() - utc4Time.getTime();
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);

      setWindowState({
        isOpen: false,
        timeRemaining: `${d}d ${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`,
        label: openDay !== null
          ? `${DAY_NAMES[openDay]}s · ${String(openHour).padStart(2,'0')}:00 – ${String(closeHour).padStart(2,'0')}:00 (UTC-4)`
          : `${i18n.language?.startsWith('es') ? 'Lunes a Domingo' : 'Monday to Sunday'} · ${String(openHour).padStart(2,'0')}:00 – ${String(closeHour).padStart(2,'0')}:00 (UTC-4)`
      });
    };

    checkWithdrawalWindow();
    const interval = setInterval(checkWithdrawalWindow, 1000);
    return () => clearInterval(interval);
  }, [windowConfig]);

  // Patrones Regex para validación de wallets
  const patterns = {
    USDT: /^0x[a-fA-F0-9]{40}$/, // BEP20 (EVM format)
  };

  const isAddressValid = useMemo(() => {
    if (!address) return true;
    return patterns.USDT.test(address);
  }, [address]);

  const numAmount = parseFloat(amount) || 0;
  const isPhyzerCard = method === 'PHYZER CARD';
  const fee = isPhyzerCard ? 0 : numAmount * (withdrawalFeePercent / 100);
  const netAmount = numAmount - fee;

  const isValid =
    windowState.isOpen &&
    !user?.withdrawals_blocked &&
    !hasWithdrawalToday &&
    numAmount >= minWithdrawal &&
    numAmount <= balance &&
    (isPhyzerCard ? address.trim().length > 0 : address.trim().length > 10 && isAddressValid);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid) {
      handleWithdrawal(numAmount, method, address);
      setAmount('');
    }
  };

  return (
    <div className="blue-glass rounded-xl p-6 shadow-2xl border border-slate-800 relative overflow-hidden group">
      {/* 2FA Status Indicator Overlay */}
      {user?.two_factor_enabled && (
        <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-phyzer-accent/10 rounded-lg border border-phyzer-accent/20">
            <svg className="w-3 h-3 text-phyzer-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            <span className="text-[8px] font-black text-phyzer-accent uppercase tracking-widest">{t('withdrawal.status_2fa')}</span>
          </div>
        </div>
      )}

      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center">
          <div className="w-10 h-10 rounded-lg bg-phyzer-gold/10 flex items-center justify-center mr-3">
            <svg className="w-6 h-6 text-phyzer-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-white uppercase tracking-tighter">{t('withdrawal.title')}</h3>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{t('withdrawal.subtitle')}</p>
          </div>
        </div>
      </div>

      {/* ⏳ CONTADOR DE VENTANA DE RETIROS (REGLA SÁBADO 9AM-2PM) */}
      <div className={`mb-6 border rounded-2xl p-5 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-4 transition-all duration-500 ${windowState.isOpen ? 'bg-phyzer-green/10 border-phyzer-green/30' : 'bg-slate-900/80 border-slate-700/50'}`}>
        <div className="flex items-center gap-4 relative z-10 w-full md:w-auto">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${windowState.isOpen ? 'bg-phyzer-green/20 text-phyzer-green animate-pulse' : 'bg-slate-800 text-slate-400'}`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1 text-center md:text-left">
            <p className={`text-xs font-black uppercase tracking-[0.2em] mb-1 ${windowState.isOpen ? 'text-phyzer-green' : 'text-slate-400'}`}>
              {windowState.label}
            </p>
            {!windowConfig.globalBlocked && windowConfig.windowEnabled && (
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-tight">
                {windowConfig.openDay !== null
                  ? ['Domingos','Lunes','Martes','Miércoles','Jueves','Viernes','Sábados'][windowConfig.openDay]
                  : (i18n.language?.startsWith('es') ? 'Lunes a Domingo' : 'Monday to Sunday')
                } · {String(windowConfig.openHour).padStart(2,'0')}:00 – {String(windowConfig.closeHour).padStart(2,'0')}:00 <span className="text-slate-400">(UTC-4)</span>
              </p>
            )}
          </div>
        </div>

        <div className="relative z-10 w-full md:w-auto text-center md:text-right">
          <div className={`inline-block px-4 py-2 rounded-xl border ${windowState.isOpen ? 'bg-phyzer-green/5 border-phyzer-green/20' : 'bg-slate-950/80 border-slate-800 shadow-inner'}`}>
            <p className={`text-xl font-black tabular-nums tracking-tighter ${windowState.isOpen ? 'text-white' : 'text-slate-300'}`}>
              {windowState.timeRemaining}
            </p>
          </div>
        </div>
      </div>

      {/* SELECTOR DE MÉTODO */}
      {hasPhyzerCard && (
        <div className="flex gap-3 mb-5">
          <button
            type="button"
            onClick={() => setMethod('USDT')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border font-black text-[10px] uppercase tracking-widest transition-all ${method === 'USDT' ? 'bg-phyzer-gold/10 border-phyzer-gold/40 text-phyzer-gold' : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'}`}
          >
            <img src="https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/usdt.png" className="w-4 h-4" alt="USDT" />
            USDT BEP-20
          </button>
          <button
            type="button"
            onClick={() => setMethod('PHYZER CARD')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border font-black text-[10px] uppercase tracking-widest transition-all ${method === 'PHYZER CARD' ? 'bg-phyzer-accent/10 border-phyzer-accent/40 text-phyzer-accent' : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
            PHYZER CARD
            <span className="px-1.5 py-0.5 bg-phyzer-green/20 text-phyzer-green text-[7px] rounded font-black border border-phyzer-green/30">0% FEE</span>
          </button>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-5">
        {user?.withdrawals_blocked && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 mb-4 animate-in slide-in-from-top-4">
            <div className="flex gap-4 items-center">
              <div className="p-3 bg-red-500/20 rounded-xl">
                <svg className="w-6 h-6 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <div>
                <p className="text-xs font-black text-red-500 uppercase tracking-widest">Retiros Suspendidos</p>
                <p className="text-[10px] text-red-400 font-bold leading-tight mt-1">
                  Tu cuenta tiene una restricción administrativa para realizar retiros. Comunícate con soporte.
                </p>
              </div>
            </div>
          </div>
        )}

        {hasWithdrawalToday && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 mb-4 animate-in slide-in-from-top-4">
            <div className="flex gap-4 items-center">
              <div className="p-3 bg-red-500/20 rounded-xl">
                <svg className="w-6 h-6 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <div>
                <p className="text-xs font-black text-red-500 uppercase tracking-widest">{t('withdrawal.errors.limit_24h')}</p>
                <p className="text-[10px] text-red-400 font-bold leading-tight mt-1">
                  Ya has realizado un retiro de comisiones el día de hoy. Por seguridad y cumplimiento del protocolo, regresa mañana.
                </p>
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">{t('withdrawal.amount_label')}</label>
          <div className="relative group">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-phyzer-gold font-black">$</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              disabled={!windowState.isOpen || user?.withdrawals_blocked}
              className={`w-full bg-slate-950 border border-slate-800 rounded-xl py-4 pl-10 pr-4 text-xl font-black text-white focus:outline-none focus:ring-1 focus:ring-phyzer-gold/30 transition-all placeholder:text-slate-800 ${(!windowState.isOpen || user?.withdrawals_blocked) && 'opacity-50 cursor-not-allowed'}`}
            />
          </div>
          <div className="flex justify-between mt-2 px-1">
            <span className={`text-[10px] font-black uppercase tracking-tighter flex items-center gap-1 ${numAmount > 0 && numAmount < minWithdrawal ? 'text-red-400 animate-pulse' : 'text-slate-500'}`}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {t('withdrawal.min_amount', { amount: minWithdrawal.toFixed(2) })}
            </span>
            <span className={`text-[10px] font-black uppercase tracking-tighter ${numAmount > balance ? 'text-red-500' : 'text-phyzer-gold'}`}>
              {t('withdrawal.available', { amount: balance.toLocaleString('en-US', { minimumFractionDigits: 2 }) })}
            </span>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">{t('withdrawal.network_protocol')}</label>
          {isPhyzerCard ? (
            <div className="bg-phyzer-accent/5 border border-phyzer-accent/20 rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-phyzer-accent/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-phyzer-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                </div>
                <div>
                  <span className="block text-[11px] font-black text-white tracking-widest">PHYZER CARD</span>
                  <span className="block text-[8px] font-black text-phyzer-accent uppercase tracking-[0.2em]">Bancus · Sin comisión de retiro</span>
                </div>
              </div>
              <div className="px-2 py-1 bg-phyzer-green/20 text-phyzer-green text-[7px] font-black rounded uppercase tracking-widest border border-phyzer-green/30">
                0% FEE
              </div>
            </div>
          ) : (
            <div className="bg-phyzer-gold/5 border border-phyzer-gold/20 rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                  <img src="https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/usdt.png" className="w-5 h-5" alt="USDT" />
                </div>
                <div>
                  <span className="block text-[11px] font-black text-white tracking-widest">USDT</span>
                  <span className="block text-[8px] font-black text-phyzer-gold uppercase tracking-[0.2em]">{t('withdrawal.network_name')}</span>
                </div>
              </div>
              <div className="px-2 py-1 bg-phyzer-gold text-slate-950 text-[7px] font-black rounded uppercase tracking-widest animate-pulse">
                {t('withdrawal.required')}
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
              {isPhyzerCard ? 'DIRECCIÓN PHYZER CARD' : t('withdrawal.address_label')}
            </label>
            {address && (
              <span className={`text-[9px] font-black uppercase tracking-tighter flex items-center gap-1 px-2 py-0.5 rounded border ${isPhyzerCard ? 'text-phyzer-accent bg-phyzer-accent/10 border-phyzer-accent/20' : 'text-phyzer-green bg-phyzer-green/10 border-phyzer-green/20'}`}>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                {isPhyzerCard ? 'TARJETA VINCULADA' : 'BÓVEDA BLOQUEADA'}
              </span>
            )}
          </div>
          {isPhyzerCard ? (
            <div className="space-y-2">
              <input
                type="text"
                value={user?.phyzer_card_user || '—'}
                readOnly
                placeholder="Sin Bancus ID"
                className="w-full bg-slate-950/50 border border-phyzer-accent/30 rounded-xl py-3 px-5 text-xs font-mono text-phyzer-accent cursor-not-allowed shadow-inner"
              />
              <input
                type="text"
                value={user?.phyzer_card_address || ''}
                readOnly
                placeholder="Sin dirección BSC vinculada"
                className="w-full bg-slate-950/50 border border-phyzer-accent/20 rounded-xl py-3 px-5 text-[10px] font-mono text-slate-400 cursor-not-allowed shadow-inner"
              />
            </div>
          ) : (
            <>
              <input
                type="text"
                value={user?.withdrawal_wallet || ''}
                readOnly
                placeholder="No se ha configurado ninguna bóveda de retiro"
                className={`w-full bg-slate-950/50 border rounded-xl py-4 px-5 text-xs font-mono transition-all shadow-inner focus:outline-none cursor-not-allowed ${!isAddressValid && (user?.withdrawal_wallet || '').length > 0
                  ? 'border-red-500 text-red-500'
                  : 'border-phyzer-green/30 text-phyzer-green focus:border-phyzer-green/50'
                  }`}
              />
              {!isAddressValid && address.length > 0 && (
                <p className="mt-2 text-[8px] text-red-500 font-black uppercase tracking-widest animate-pulse ml-1">
                  {t('withdrawal.invalid_address')}
                </p>
              )}
            </>
          )}
        </div>

        {/* Warning Banner */}
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            <p className="text-[8px] leading-relaxed text-red-400 font-bold uppercase tracking-tight">
              {t('withdrawal.warning')}
            </p>
          </div>
        </div>

        {/* Breakdown Section - Clearly Labeled */}
        <div className={`p-5 rounded-2xl border space-y-4 ${isPhyzerCard ? 'bg-phyzer-green/5 border-phyzer-green/20' : 'bg-slate-900/40 border-slate-800/60'}`}>
          <div className="flex justify-between items-center">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('withdrawal.fee_label')}</span>
              <span className={`text-[8px] uppercase font-bold ${isPhyzerCard ? 'text-phyzer-green' : 'text-slate-600'}`}>
                {isPhyzerCard ? '0% · Beneficio exclusivo Phyzer Card' : t('withdrawal.fee_desc', { percent: withdrawalFeePercent })}
              </span>
            </div>
            <span className={`text-sm font-black ${isPhyzerCard ? 'text-phyzer-green' : 'text-red-400'}`}>
              {isPhyzerCard ? 'SIN COMISIÓN' : `-$${fee.toFixed(2)} USDT`}
            </span>
          </div>

          <div className="h-px bg-slate-800/30 w-full" />

          <div className="flex justify-between items-end">
            <div className="flex flex-col">
              <span className="text-xs font-black text-white uppercase tracking-[0.1em]">{t('withdrawal.net_total')}</span>
              <span className="text-[8px] text-phyzer-accent uppercase font-black tracking-widest">{t('withdrawal.estimated')}</span>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-phyzer-green leading-none">
                ${(netAmount > 0 ? netAmount : 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
              <span className="block text-[8px] text-slate-500 font-black uppercase">USDT BEP-20</span>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={!isValid || !windowState.isOpen || user?.withdrawals_blocked}
          className={`w-full py-4 rounded-xl font-black text-xs uppercase tracking-[0.3em] transition-all transform active:scale-95 ${isValid
            ? 'gold-gradient text-slate-950 shadow-xl shadow-phyzer-gold/20'
            : 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700 opacity-60'
            }`}
        >
          {user?.withdrawals_blocked ? 'BLOQUEADO' : hasWithdrawalToday ? 'LÍMITE DIARIO ALCANZADO' : !windowState.isOpen ? 'RETIRAR COMISIONES' : (user?.two_factor_enabled ? t('withdrawal.button_2fa') : t('withdrawal.button'))}
        </button>
      </form>
      <p className="mt-6 text-[9px] text-center text-slate-600 leading-relaxed uppercase tracking-tighter font-bold">
        {user?.two_factor_enabled
          ? t('withdrawal.footer_2fa')
          : t('withdrawal.footer')}
      </p>
    </div>
  );
};

export default WithdrawalForm;
