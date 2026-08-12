import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MIN_INVESTMENT, MAX_INVESTMENT, DAILY_RETURN_RATE } from '../constants';
import { DUPLICATION_LIMIT_FACTOR } from '../services/engine';

interface Props {
  onInvest: (amount: number, planId?: string) => void;
  investments: any[];
  addNotification: (message: string, type?: 'success' | 'error' | 'info') => void;
  balance: number;
  walletBalance: number;
  onGoToConvert: () => void;
  isLoading?: boolean;
  dynamicSettings?: any;
}

const InvestmentPanel: React.FC<Props> = ({ onInvest, investments, addNotification, balance, walletBalance, onGoToConvert, isLoading = false, dynamicSettings }) => {
  const { t } = useTranslation();
  const [amount, setAmount] = useState<string>('');
  const [expandedGroups, setExpandedGroups] = useState<Record<number, boolean>>({});

  // Valores dinámicos de system_settings con fallback a constants.ts
  const minInvestment = dynamicSettings?.min_investment ?? MIN_INVESTMENT;
  const maxInvestment = dynamicSettings?.max_investment ?? MAX_INVESTMENT;
  const dailyReturnRate = dynamicSettings?.daily_roi ? dynamicSettings.daily_roi / 100 : DAILY_RETURN_RATE;

  const activeInvestments = investments.filter(i => i.status === 'ACTIVE');

  // Grouping Logic: Cluster nodes by their investment amount
  const groupedInvestments = activeInvestments.reduce((acc, inv) => {
    const invAmount = inv.amount || inv.amountInverted || 0;
    if (!acc[invAmount]) acc[invAmount] = [];
    acc[invAmount].push(inv);
    return acc;
  }, {} as Record<number, any[]>);

  const toggleGroup = (amount: number) => {
    setExpandedGroups(prev => ({ ...prev, [amount]: !prev[amount] }));
  };

  const numAmount = parseFloat(amount) || 0;

  const handleActivate = () => {
    if (numAmount > maxInvestment) {
      addNotification(`Maximum investment limit is $${maxInvestment.toLocaleString('en-US')} USDT.`, 'error');
      return;
    }
    if (numAmount < minInvestment) {
      addNotification(t('investment.errors.min_limit', { limit: minInvestment }), 'error');
      return;
    }
    if (numAmount > balance) {
      addNotification(t('investment.protocol.desc'), 'error');
      onGoToConvert();
      return;
    }
    onInvest(numAmount);
  };

  const setMaxAmount = () => {
    const finalAmount = Math.min(balance, maxInvestment);
    setAmount(finalAmount.toFixed(2));
    addNotification(t('investment.notify_max_adjusted', { amount: finalAmount.toFixed(2) }), 'info');
  };

  const isOverLimit = numAmount > maxInvestment;
  const isOverBalance = numAmount > balance;

  return (
    <div className="space-y-6 animate-fade-in relative">

      {/* Active Packages Progress - Grouped & Collapsible (Joined Nodes) */}
      {activeInvestments.length > 0 && (
        <div className="holo-card p-0 rounded-none clip-corner border border-geminix-accent/20 relative overflow-hidden group flex flex-col transition-all duration-500 shadow-[0_0_30px_rgba(0,114,255,0.1)]">
          {/* Dashboard Scanner Effect */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-geminix-accent/5 to-transparent h-20 -translate-y-full animate-scanline pointer-events-none"></div>

          <div className="absolute top-0 right-0 p-2 opacity-10 pointer-events-none group-hover:opacity-20 transition-opacity">
            <svg className="w-16 h-16 text-geminix-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>

          <div className="p-4 border-b border-white/5 bg-black/60 flex justify-between items-center relative z-20">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-geminix-accent animate-pulse shadow-[0_0_10px_cyan]"></div>
              <h3 className="text-[11px] font-orbitron font-bold text-white uppercase tracking-[0.3em]">{t('investment.node_status.title')}</h3>
            </div>
            <div className="flex items-center gap-2 bg-geminix-accent/10 px-3 py-1 border border-geminix-accent/30 rounded-none clip-corner-sm">
              <span className="text-[9px] font-mono-tech text-geminix-accent uppercase tracking-widest leading-none">{t('investment.node_status.modules')}</span>
              <span className="text-[12px] font-orbitron font-black text-white leading-none">{activeInvestments.length}</span>
            </div>
          </div>

          <div className="max-h-[400px] overflow-y-auto custom-scrollbar relative z-10 bg-black/40 divide-y divide-white/5">
            {Object.entries(groupedInvestments).sort((a, b) => {
              const minA = Math.min(...(a[1] as any[]).map(inv => new Date(inv.created_at).getTime()));
              const minB = Math.min(...(b[1] as any[]).map(inv => new Date(inv.created_at).getTime()));
              return minA - minB;
            }).map(([invAmount, groupUntyped]) => {
              const group = groupUntyped as any[];
              const amountValue = Number(invAmount);
              const isExpanded = expandedGroups[amountValue];
              const totalAccumulated = group.reduce((sum, inv) => sum + (inv.accumulated_earnings || 0), 0);
              const totalLimit = group.length * amountValue * DUPLICATION_LIMIT_FACTOR;
              const avgProgress = (totalAccumulated / totalLimit) * 100;

              return (
                <div key={invAmount} className={`flex flex-col transition-all duration-300 ${isExpanded ? 'bg-geminix-accent/5' : ''}`}>
                  {/* Group Header (Joined Nodes) */}
                  <button
                    onClick={() => toggleGroup(amountValue)}
                    className="w-full p-5 flex items-center justify-between hover:bg-white/[0.05] transition-all group/row relative overflow-hidden"
                  >
                    <div className="flex items-center gap-4 relative z-10">
                      <div className={`transition-transform duration-700 text-geminix-accent ${isExpanded ? 'rotate-90 scale-125' : ''}`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
                      </div>
                      <div className="text-left">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-orbitron font-black text-white uppercase group-hover/row:text-glow-cyan transition-all tracking-wider">
                            {t('investment.node_status.module_label', { amount: amountValue })}
                          </span>
                          <span className="px-2 py-0.5 bg-geminix-brand border border-geminix-accent/40 text-[10px] font-orbitron font-black text-white rounded-none clip-corner-sm shadow-[0_0_15px_rgba(0,114,255,0.4)]">
                            x{group.length}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[8px] font-mono-tech text-slate-500 uppercase tracking-[0.2em] mt-2 font-bold">
                          <span className="text-geminix-green">${totalAccumulated.toFixed(2)}</span>
                          <span className="opacity-20">/</span>
                          <span className="text-slate-400">${totalLimit.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right relative z-10">
                      <div className="text-[14px] font-orbitron font-black text-white text-glow-cyan">
                        {(avgProgress * 2).toFixed(1)}%
                      </div>
                      <div className="h-1 w-20 bg-black/60 rounded-none mt-2 overflow-hidden ml-auto border border-white/10 p-[1px]">
                        <div
                          className="h-full bg-gradient-to-r from-geminix-brand to-geminix-accent shadow-[0_0_12px_cyan] transition-all duration-1000"
                          style={{ width: `${avgProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  </button>

                  {/* Individual Node Details (Collapsible Despliegue) */}
                  <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isExpanded ? 'max-h-[1000px] opacity-100 border-t border-white/5' : 'max-h-0 opacity-0 pointer-events-none'}`}>
                    <div className="p-4 space-y-3 bg-black/40">
                      {(group as any[])
                        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                        .map((inv) => {
                          const individualAccumulated = inv.accumulated_earnings || 0;
                          const individualLimit = amountValue * DUPLICATION_LIMIT_FACTOR;
                          const individualProgress = (individualAccumulated / individualLimit) * 100;

                          return (
                            <div key={inv.id} className="p-3 border border-white/5 bg-white/[0.01] flex items-center gap-4 group/item hover:bg-white/[0.03] transition-colors">
                              <div className="flex-grow">
                                <div className="flex justify-between items-end mb-1.5">
                                  <span className="text-[8px] font-mono-tech text-slate-500 font-bold uppercase tracking-tighter">UID: {String(inv.id).slice(-12).toUpperCase()}</span>
                                  <span className="text-[10px] font-orbitron font-bold text-geminix-accent">{(individualProgress * 2).toFixed(1)}%</span>
                                </div>
                                <div className="h-1 w-full bg-black/80 rounded-full overflow-hidden border border-white/5">
                                  <div
                                    className="h-full bg-geminix-brand shadow-[0_0_12px_rgba(0,114,255,0.7)] transition-all duration-1000 relative"
                                    style={{ width: `${individualProgress}%` }}
                                  >
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right min-w-[70px]">
                                <div className="text-[10px] font-orbitron font-bold text-white">${individualAccumulated.toFixed(2)}</div>
                                <div className="text-[7px] font-mono-tech text-slate-600 uppercase tracking-tighter">{t('investment.node_status.roi_output')}</div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-2 border-t border-white/5 bg-black/80 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-geminix-accent/20 to-transparent"></div>
            <span className="text-[7px] font-mono-tech text-slate-700 uppercase tracking-[0.6em] relative z-10">{t('investment.node_status.sync_secure')}</span>
          </div>
        </div>
      )}

      {/* New Investment Form */}
      <div className="holo-card p-4 sm:p-6 rounded-none clip-corner border border-white/5 flex flex-col relative group">
        <div className="absolute top-0 left-0 w-[2px] h-full bg-gradient-to-b from-geminix-brand via-geminix-accent to-geminix-brand bg-[length:100%_200%] animate-gradient-y"></div>
        <div className="absolute -inset-0.5 bg-gradient-to-r from-geminix-brand/0 via-geminix-accent/5 to-geminix-brand/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

        {/* Protocolo de Activación Banner */}
        <div className="mb-6 bg-geminix-accent/5 border border-geminix-accent/20 p-4 clip-corner-sm flex items-start gap-4">
          <div className="w-8 h-8 rounded-none bg-geminix-accent/10 border border-geminix-accent/30 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-geminix-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div className="space-y-1">
            <h4 className="text-[10px] font-orbitron font-bold text-geminix-accent uppercase tracking-widest">{t('investment.protocol.title')}</h4>
            <p className="text-[9px] font-mono-tech text-slate-400 leading-relaxed uppercase opacity-80">
              {t('investment.protocol.desc')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-none clip-corner-sm bg-geminix-brand/5 border border-geminix-brand/20 flex items-center justify-center group-hover:border-geminix-accent/40 transition-colors">
            <svg className="w-5 h-5 text-geminix-accent animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
          </div>
          <div>
            <h3 className="text-sm font-orbitron font-bold text-white uppercase tracking-[0.2em] text-glow-cyan leading-none">{t('investment.title')}</h3>
            <p className="text-[8px] text-geminix-accent font-mono-tech uppercase mt-1 tracking-widest opacity-60">{t('investment.status')}</p>
          </div>
        </div>

        <div className="space-y-6 flex-grow relative z-10">
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="block text-[9px] font-mono-tech font-bold text-slate-500 uppercase tracking-widest ml-1">{t('investment.amount_label')}</label>
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2 group/balance">
                  <span className="text-[8px] font-mono-tech font-bold text-slate-600 uppercase">{t('investment.labels.credit_wallet')}</span>
                  <span className="text-[10px] font-orbitron font-bold text-geminix-accent tracking-tighter border-b border-geminix-accent/20 transition-all">${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-geminix-accent animate-pulse shadow-[0_0_5px_cyan]"></div>
                </div>
                <div className="flex items-center gap-2 opacity-50">
                  <span className="text-[8px] font-mono-tech font-bold text-slate-600 uppercase">{t('investment.labels.wallet_bank')}</span>
                  <span className="text-[10px] font-orbitron font-bold text-white tracking-tighter opacity-50">${walletBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  <svg className="w-2.5 h-2.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002-2zM9 11V7a3 3 0 016 0v4" /></svg>
                </div>
              </div>
            </div>

            <div className="relative">
              <span className={`absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 font-orbitron font-bold text-xl sm:text-2xl transition-all duration-500 ${(isOverLimit || isOverBalance) ? 'text-red-500 shadow-red-glow' : 'text-geminix-accent text-glow-cyan'}`}>$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className={`w-full bg-black/60 border rounded-none clip-corner-sm py-3.5 sm:py-6 pl-9 sm:pl-12 pr-16 sm:pr-28 text-lg sm:text-3xl font-orbitron font-bold text-white focus:outline-none transition-all placeholder:text-slate-800 placeholder:opacity-30 ${(isOverLimit || isOverBalance) ? 'border-red-500/50 focus:border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.2)]' : 'border-white/5 focus:border-geminix-accent/40 focus:bg-black/80 shadow-inner'}`}
              />
              <button
                onClick={setMaxAmount}
                className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 bg-white/5 border border-white/10 text-[8px] sm:text-[9px] font-orbitron font-bold text-slate-400 px-3 sm:px-4 py-1.5 sm:py-2 hover:bg-geminix-accent hover:text-black hover:border-geminix-accent transition-all uppercase tracking-widest clip-corner-sm active:scale-95"
              >
                MAX
              </button>
            </div>
            {isOverLimit && (
              <div className="mt-3 flex items-center gap-2 text-[9px] font-mono-tech text-red-500 font-bold uppercase bg-red-500/5 p-2 border border-red-500/10 animate-pulse">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                {t('investment.errors.max_limit', { limit: maxInvestment.toLocaleString('en-US') })}
              </div>
            )}
            {isOverBalance && !isOverLimit && (
              <div className="mt-4 flex flex-col gap-3 p-4 bg-red-500/10 border border-red-500/20 clip-corner-sm animate-pulse-subtle">
                <div className="flex items-center gap-2 text-[9px] font-mono-tech text-red-400 font-bold uppercase tracking-widest">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  {t('investment.errors.conversion_required')}
                </div>
                <button
                  onClick={onGoToConvert}
                  className="w-full py-3 bg-geminix-accent/20 hover:bg-geminix-accent text-[9px] font-orbitron font-bold text-geminix-accent hover:text-black border border-geminix-accent/30 transition-all uppercase tracking-[0.2em] shadow-lg shadow-geminix-accent/10"
                >
                  {t('investment.buttons.go_to_conversion')}
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 relative">
            <div className="bg-black/40 p-4 rounded-none clip-corner-sm border border-white/5 space-y-1 group/yield hover:border-geminix-green/20 transition-colors">
              <span className="text-[8px] font-mono-tech font-bold text-slate-600 uppercase tracking-widest block">{t('investment.daily_profit')}</span>
              <div className="text-lg font-orbitron font-bold text-geminix-green group-hover:text-glow-green transition-all">
                +${(numAmount * dailyReturnRate).toFixed(2)}
              </div>
            </div>
            <div className="bg-black/40 p-4 rounded-none clip-corner-sm border border-white/5 space-y-1 group/limit hover:border-geminix-accent/20 transition-colors">
              <span className="text-[8px] font-mono-tech font-bold text-slate-600 uppercase tracking-widest block">{t('investment.cap_limit')}</span>
              <div className="text-lg font-orbitron font-bold text-geminix-accent group-hover:text-glow-cyan transition-all">
                ${(numAmount * DUPLICATION_LIMIT_FACTOR).toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleActivate}
          disabled={!amount || numAmount === 0 || isOverBalance || isLoading}
          className={`mt-8 w-full font-orbitron font-bold text-[10px] uppercase tracking-[0.3em] py-5 transition-all relative overflow-hidden group/btn ${isOverLimit || !amount || numAmount === 0 || isOverBalance || isLoading
            ? 'bg-slate-900/50 text-slate-600 cursor-not-allowed border border-white/5'
            : 'bg-geminix-brand text-white hover:brightness-110 shadow-[0_0_30px_rgba(0,114,255,0.3)] border border-geminix-accent/30'}`}
        >
          <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/btn:animate-shimmer p-2"></div>
          <span className="relative z-10 group-hover/btn:tracking-[0.4em] transition-all duration-500 flex items-center justify-center gap-3">
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-geminix-accent" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {t('common.processing') || 'PROCESANDO...'}
              </>
            ) : (
              !amount ? t('investment.button_empty') : t('investment.button_ready')
            )}
          </span>
        </button>
      </div>
    </div>
  );
};

export default InvestmentPanel;
