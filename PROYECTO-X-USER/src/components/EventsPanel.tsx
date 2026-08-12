import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Promotion, Profile } from '../types';
import { getActivePromotions } from '../services/database';
import { Gift, Percent, Zap, Clock, Info, ArrowRight } from 'lucide-react';
import BootCampEvent from './BootCampEvent';

interface Props {
    onNavigateToDeposit: () => void;
    onSelectPromo?: (promo: Promotion) => void;
    profile?: Profile | null;
}

const EventsPanel: React.FC<Props> = ({ onNavigateToDeposit, onSelectPromo, profile }) => {
    const { t } = useTranslation();
    const [promos, setPromos] = useState<Promotion[]>([]);
    const [loading, setLoading] = useState(true);
    const [timeRemaining, setTimeRemaining] = useState<Record<string, string>>({});

    useEffect(() => {
        async function loadPromos() {
            const data = await getActivePromotions();
            setPromos(data);
            setLoading(false);
        }
        loadPromos();
    }, []);

    useEffect(() => {
        if (promos.length === 0) return;

        const interval = setInterval(() => {
            const newTimes: Record<string, string> = {};
            const now = new Date().getTime();

            promos.forEach((promo) => {
                const endDate = new Date(promo.end_date).getTime();
                const diff = endDate - now;

                if (diff <= 0) {
                    newTimes[promo.id] = 'Expirado';
                } else {
                    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
                    const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                    const s = Math.floor((diff % (1000 * 60)) / 1000);

                    if (d > 0) {
                        newTimes[promo.id] = `${d}d ${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m`;
                    } else {
                        newTimes[promo.id] = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                    }
                }
            });

            setTimeRemaining(newTimes);
        }, 1000);

        return () => clearInterval(interval);
    }, [promos]);

    const getIcon = (type: string) => {
        switch (type) {
            case 'CASHBACK': return <Percent className="w-6 h-6 text-geminix-accent" />;
            case 'BONUS': return <Gift className="w-6 h-6 text-geminix-gold" />;
            case 'DISCOUNT': return <Zap className="w-6 h-6 text-geminix-accent" />;
            default: return <Gift className="w-6 h-6 text-geminix-gold" />;
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'CASHBACK': return 'CASHBACK REWARD';
            case 'BONUS': return 'BONUS EXCLUSIVO';
            case 'DISCOUNT': return 'DESCUENTO FLASH';
            default: return 'EVENTO ESPECIAL';
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <div className="w-12 h-12 border-4 border-geminix-accent border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-400 font-medium tracking-widest text-sm uppercase">Cargando Eventos...</p>
            </div>
        );
    }

    if (promos.length === 0) {
        return (
            <div className="space-y-6">
                <BootCampEvent profile={profile ?? null} />
                <div className="blue-glass rounded-xl p-12 text-center border border-slate-800/50 relative overflow-hidden">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-slate-800/20 blur-3xl rounded-full"></div>
                    <div className="relative z-10 flex flex-col items-center">
                        <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mb-6 shadow-inner">
                            <Gift className="w-10 h-10 text-slate-500" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">No hay promociones activas</h3>
                        <p className="text-slate-400 max-w-md mx-auto">
                            Mantente alerta. Constantemente lanzamos nuevos bonos de liquidez y cashbacks para premiar a nuestra comunidad.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* ═══ BOOTCAMP PUNTA CANA 2026 ═══ */}
            <BootCampEvent profile={profile ?? null} />

            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 mb-1">
                        PROMO / EVENTOS
                    </h2>
                    <p className="text-slate-400 text-sm">
                        Multiplica tu capital con estas condiciones por tiempo limitado.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {promos.map((promo) => (
                    <div key={promo.id} className="group relative rounded-2xl overflow-hidden border border-slate-800/80 hover:border-geminix-accent/40 transition-all duration-500 bg-[#0a0f1a] flex flex-col">

                        {/* === THUMBNAIL BANNER === */}
                        <div className="relative w-full h-44 overflow-hidden shrink-0">
                            {promo.image_url ? (
                                <img
                                    src={promo.image_url}
                                    alt={promo.title}
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                />
                            ) : (
                                /* Fallback visual por tipo */
                                <div className={`w-full h-full flex items-center justify-center relative overflow-hidden
                                    ${promo.type === 'CASHBACK' ? 'bg-gradient-to-br from-[#0a2a1a] via-[#0d1f2d] to-[#0a0f1a]' :
                                      promo.type === 'BONUS'    ? 'bg-gradient-to-br from-[#1a1200] via-[#1a0f00] to-[#0a0f1a]' :
                                                                  'bg-gradient-to-br from-[#0d0a2a] via-[#0a1228] to-[#0a0f1a]'}`}>
                                    {/* Glow circles */}
                                    <div className={`absolute w-48 h-48 rounded-full blur-3xl opacity-30
                                        ${promo.type === 'CASHBACK' ? 'bg-emerald-500' :
                                          promo.type === 'BONUS'    ? 'bg-yellow-500' : 'bg-blue-500'}`} />
                                    <div className={`absolute bottom-0 right-0 w-32 h-32 rounded-full blur-2xl opacity-20
                                        ${promo.type === 'CASHBACK' ? 'bg-cyan-400' :
                                          promo.type === 'BONUS'    ? 'bg-orange-400' : 'bg-purple-400'}`} />
                                    {/* Reward value big */}
                                    <div className="relative z-10 flex flex-col items-center">
                                        <span className={`text-7xl font-black tracking-tighter leading-none
                                            ${promo.type === 'CASHBACK' ? 'text-emerald-400' :
                                              promo.type === 'BONUS'    ? 'text-yellow-400' : 'text-blue-400'}`}>
                                            {promo.type === 'CASHBACK' || promo.type === 'DISCOUNT'
                                                ? `${promo.reward_value}%`
                                                : `$${promo.reward_value}`}
                                        </span>
                                        <span className="text-white/40 text-xs font-bold uppercase tracking-widest mt-1">
                                            {getTypeLabel(promo.type)}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Gradient overlay bottom */}
                            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#0a0f1a] to-transparent" />

                            {/* LIVE badge over image */}
                            <div className="absolute top-3 left-3 px-3 py-1 bg-black/60 backdrop-blur-sm border border-geminix-gold/30 rounded-full flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 bg-geminix-gold rounded-full animate-pulse"></span>
                                <span className="text-xs font-bold text-geminix-gold">LIVE</span>
                            </div>

                            {/* Type badge over image */}
                            <div className="absolute top-3 right-3 px-2.5 py-1 bg-black/60 backdrop-blur-sm border border-geminix-accent/30 rounded-full">
                                <span className="text-[10px] font-black text-geminix-accent tracking-widest uppercase">
                                    {getTypeLabel(promo.type)}
                                </span>
                            </div>
                        </div>

                        {/* === CARD CONTENT === */}
                        <div className="p-6 flex flex-col flex-grow">
                            {/* Title + icon */}
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-xl bg-slate-800/80 flex items-center justify-center border border-slate-700/50 shrink-0">
                                    {getIcon(promo.type)}
                                </div>
                                <h3 className="text-lg font-bold text-white leading-tight">{promo.title}</h3>
                            </div>

                            {/* Description */}
                            <p className="text-slate-400 text-sm mb-5 leading-relaxed flex-grow">
                                {promo.description}
                            </p>

                            {/* Info Bar */}
                            <div className="grid grid-cols-2 gap-3 mb-5 bg-slate-800/30 p-3 rounded-xl border border-slate-700/30">
                                <div>
                                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Mínimo Invertido</div>
                                    <div className="text-white font-medium text-sm">
                                        {promo.min_investment > 0 ? `$${promo.min_investment.toLocaleString('en-US')}` : 'Cualquier monto'}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Beneficio</div>
                                    <div className="text-geminix-accent font-bold text-lg leading-none">
                                        {promo.type === 'CASHBACK' || promo.type === 'DISCOUNT' ? `${promo.reward_value}%` : `$${promo.reward_value}`}
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-between pt-4 border-t border-slate-800 mt-auto">
                                <div className="flex items-center gap-2 text-geminix-gold">
                                    <Clock className="w-4 h-4" />
                                    <span className="text-sm font-bold font-mono tracking-wider">
                                        {timeRemaining[promo.id] || 'Calculando...'}
                                    </span>
                                </div>
                                <button
                                    onClick={() => {
                                        if (onSelectPromo) onSelectPromo(promo);
                                        else onNavigateToDeposit();
                                    }}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-geminix-accent hover:bg-geminix-accent-hover text-white rounded-lg font-bold text-sm transition-all shadow-[0_0_20px_rgba(26,115,232,0.3)] hover:shadow-[0_0_30px_rgba(26,115,232,0.5)] transform hover:-translate-y-0.5"
                                >
                                    Aplicar Promoción
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default EventsPanel;
