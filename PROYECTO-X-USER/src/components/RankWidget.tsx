import React from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
    rank: 'Starter' | 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Black Crown';
    teamVolume: number;
    directsCount: number;
}

const RANK_RULES = [
    { name: 'Starter', minVol: 0, minDirects: 0, color: 'text-slate-400', icon: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> },
    { name: 'Bronze', minVol: 5000, minDirects: 3, color: 'text-amber-600', icon: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg> },
    { name: 'Silver', minVol: 15000, minDirects: 5, color: 'text-slate-300', icon: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-7.714 2.143L11 21l-2.286-6.857L1 12l7.714-2.143L11 3z" /></svg> },
    { name: 'Gold', minVol: 50000, minDirects: 10, color: 'text-yellow-400', icon: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l2.07 6.36h6.704c.969 0 1.371 1.24.588 1.81l-5.423 3.94 2.07 6.36c.3.921-.755 1.688-1.54 1.11L12 14.717l-5.424 3.94c-.785.578-1.84-.189-1.54-1.11l2.07-6.36-5.422-3.94c-.783-.57-.381-1.81.588-1.81h6.704l2.07-6.36z" /></svg> },
    { name: 'Platinum', minVol: 150000, minDirects: 12, color: 'text-indigo-400', icon: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg> },
    { name: 'Diamond', minVol: 500000, minDirects: 15, color: 'text-cyan-400', icon: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> },
    { name: 'Black Crown', minVol: 1500000, minDirects: 20, color: 'text-purple-500', icon: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg> },
];

const RankWidget: React.FC<Props> = ({ rank, teamVolume, directsCount }) => {
    const { t } = useTranslation();

    const currentIndex = RANK_RULES.findIndex(r => r.name === rank);
    const currentRankInfo = RANK_RULES[currentIndex] || RANK_RULES[0];
    const nextRankInfo = RANK_RULES[currentIndex + 1];

    const volProgress = nextRankInfo ? Math.min(100, (teamVolume / nextRankInfo.minVol) * 100) : 100;
    const directsProgress = nextRankInfo ? Math.min(100, (directsCount / nextRankInfo.minDirects) * 100) : 100;
    const totalProgress = (volProgress + directsProgress) / 2;

    const RankIcon = currentRankInfo.icon;
    const isMaxRank = !nextRankInfo;

    return (
        <div className="holo-card p-6 rounded-none clip-corner border border-geminix-accent/20 relative overflow-hidden group shadow-[0_0_30px_rgba(0,114,255,0.05)]">
            {/* HUD Background Decorations */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-geminix-accent/5 rounded-full blur-3xl opacity-20 pointer-events-none"></div>

            <div className="flex items-center justify-between mb-6 relative z-10">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-1.5 h-1.5 rounded-none rotate-45 bg-geminix-accent animate-pulse shadow-[0_0_5px_cyan]"></div>
                        <h3 className="text-[10px] font-orbitron font-black text-slate-500 uppercase tracking-[0.3em]">{t('ranks.elite_standing')}</h3>
                    </div>
                    <p className={`text-2xl font-orbitron font-black uppercase tracking-tighter text-glow-cyan ${currentRankInfo.color}`}>
                        {t(`ranks.${rank}`)}
                    </p>
                </div>
                <div className="w-14 h-14 bg-black/40 border border-geminix-accent/30 flex items-center justify-center rounded-none clip-corner relative group-hover:border-geminix-accent transition-colors shadow-[0_0_15px_rgba(0,114,255,0.1)]">
                    <RankIcon className="w-8 h-8 text-geminix-accent drop-shadow-[0_0_8px_rgba(0,243,255,0.5)]" />
                </div>
            </div>

            {!isMaxRank ? (
                <div className="space-y-6 relative z-10">
                    <div className="flex justify-between items-end">
                        <p className="text-[9px] font-mono-tech font-bold text-slate-500 uppercase tracking-widest">{t('ranks.next_level')}: {t(`ranks.${nextRankInfo.name}`)}</p>
                        <p className="text-sm font-orbitron font-black text-white text-glow-cyan tracking-widest">{Math.floor(totalProgress)}%</p>
                    </div>

                    <div className="space-y-4">
                        {/* Team Progress */}
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-[8px] font-mono-tech uppercase tracking-widest">
                                <span className="text-slate-400">{t('ranks.team_req')}</span>
                                <span className="text-white">${teamVolume.toLocaleString('en-US')} / ${nextRankInfo.minVol.toLocaleString('en-US')}</span>
                            </div>
                            <div className="h-1 w-full bg-black/60 border border-white/5 rounded-none overflow-hidden p-[1px]">
                                <div
                                    className="h-full bg-geminix-accent shadow-[0_0_10px_#00f3ff] transition-all duration-1000"
                                    style={{ width: `${volProgress}%` }}
                                ></div>
                            </div>
                        </div>

                        {/* Directs Progress */}
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-[8px] font-mono-tech uppercase tracking-widest">
                                <span className="text-slate-400">{t('ranks.direct_req')}</span>
                                <span className="text-white">{directsCount} / {nextRankInfo.minDirects}</span>
                            </div>
                            <div className="h-1 w-full bg-black/60 border border-white/5 rounded-none overflow-hidden p-[1px]">
                                <div
                                    className="h-full bg-geminix-neon-purple shadow-[0_0_10px_purple] transition-all duration-1000"
                                    style={{ width: `${directsProgress}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-white/5 flex items-center gap-3">
                        <div className="p-2 bg-geminix-gold/10 rounded-none border border-geminix-gold/30">
                            <svg className="w-3.5 h-3.5 text-geminix-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </div>
                        <p
                            className="text-[9px] text-slate-400 font-medium leading-relaxed uppercase tracking-tighter"
                            dangerouslySetInnerHTML={{ __html: t('ranks.bonus_desc', { amount: (nextRankInfo.minVol * 0.005).toLocaleString('en-US') }) }}
                        />
                    </div>
                </div>
            ) : (
                <div className="py-10 text-center space-y-4 bg-geminix-accent/5 border border-dashed border-geminix-accent/20 rounded-none">
                    <svg className="w-12 h-12 mx-auto text-geminix-gold animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    <h4 className="text-xl font-orbitron font-black text-white italic tracking-widest">{t('ranks.max_rank')}</h4>
                    <p className="text-[9px] text-slate-500 font-mono-tech uppercase">{t('ranks.zenith_desc')}</p>
                </div>
            )}
        </div>
    );
};

export default RankWidget;
