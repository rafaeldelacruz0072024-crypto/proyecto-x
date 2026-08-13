import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
    CreditCard, Shield, Zap, Globe, ArrowRight, CheckCircle2, 
    ExternalLink, Smartphone, Wallet, RefreshCw, Star
} from 'lucide-react';
import { Profile } from '../types';

interface ProyectoXCardPanelProps {
    profile: Profile | null;
}

export default function ProyectoXCardPanel({ profile }: ProyectoXCardPanelProps) {
    const { t } = useTranslation();

    // Enlace oficial de la empresa
    const OFFICIAL_REFERRAL_URL = "https://go.bancus.io/?ref=PETEXAM6";

    const features = [
        {
            icon: <Shield className="text-blue-500" size={24} />,
            title: t('proyecto_x_card.benefit1_title'),
            desc: t('proyecto_x_card.benefit1_desc'),
            detail: "3% FEE"
        },
        {
            icon: <Globe className="text-cyan-500" size={24} />,
            title: t('proyecto_x_card.benefit2_title'),
            desc: t('proyecto_x_card.benefit2_desc'),
            detail: "VISA NETWORK"
        },
        {
            icon: <Zap className="text-amber-500" size={24} />,
            title: t('proyecto_x_card.benefit3_title'),
            desc: t('proyecto_x_card.benefit3_desc'),
            detail: "INSTANT LOAD"
        }
    ];

    return (
        <div className="space-y-10 animate-fade-in relative pb-10">
            {/* HUD HEADER - Estilo PROYECTO X */}
            <div className="relative group overflow-hidden">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-purple-500 to-blue-600 rounded-none blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                <div className="relative bg-[#0c0f18] border border-slate-800 p-8 rounded-none backdrop-blur-xl flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="flex-1 text-center md:text-left">
                        <div className="flex items-center gap-3 mb-2 justify-center md:justify-start">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
                            <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em]">SISTEMA DE LIQUIDEZ EXTERNA</span>
                        </div>
                        <h2 className="text-4xl font-black text-white font-orbitron tracking-tighter uppercase italic leading-none mb-3">
                            PROYECTO X <span className="text-blue-500">VISA</span> CARD
                        </h2>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest max-w-xl">
                            {t('proyecto_x_card.subtitle')}
                        </p>
                    </div>

                    <div className="hidden md:flex items-center gap-6">
                        <div className="text-right">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">PROTOCOLO</p>
                            <p className="text-sm font-black text-white italic">VISA DEBIT • ACTIVADA</p>
                        </div>
                        <div className="w-12 h-12 rounded-none bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                            <CreditCard className="text-blue-500" size={24} />
                        </div>
                    </div>
                </div>
            </div>

            {/* HERO SECTION - LA TARJETA */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
                <div className="lg:col-span-7 relative group">
                    <div className="absolute -inset-10 bg-blue-600/10 blur-[100px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
                    
                    {/* Contenedor de la Tarjeta con Efecto Flotante */}
                    <div className="relative aspect-[1.58/1] perspective-1000">
                        <div className="w-full h-full relative transform-gpu transition-all duration-700 hover:rotate-y-6 hover:rotate-x-6">
                            <img 
                                src="/proyecto_x_card.png" 
                                alt="Proyecto X Card Official" 
                                className="w-full h-full object-contain filter drop-shadow-[0_20px_50px_rgba(37,99,235,0.3)]"
                            />
                            
                            {/* Overlay de Brillo Tecnológico */}
                            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none"></div>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-5 space-y-8">
                    <div className="bg-[#0c0f18]/50 border border-slate-800 p-8 clip-corner relative overflow-hidden backdrop-blur-md">
                        <div className="absolute top-0 right-0 p-4 opacity-5">
                            <Smartphone size={120} />
                        </div>
                        
                        <h3 className="text-2xl font-black text-white mb-4 uppercase italic font-orbitron">
                            {t('proyecto_x_card.title')}
                        </h3>
                        <p className="text-slate-400 text-sm leading-relaxed mb-8">
                            {t('proyecto_x_card.description')}
                        </p>

                        <div className="space-y-4">
                            {features.map((f, i) => (
                                <div key={i} className="flex items-center gap-4 p-4 bg-slate-900/50 border border-slate-800 hover:border-blue-500/30 transition-all group/item">
                                    <div className="w-12 h-12 flex items-center justify-center bg-slate-950 border border-slate-800 group-hover/item:border-blue-500/50 transition-colors">
                                        {f.icon}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center mb-0.5">
                                            <h4 className="text-[11px] font-black text-white uppercase tracking-wider">{f.title}</h4>
                                            <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest bg-blue-500/10 px-2 py-0.5">{f.detail}</span>
                                        </div>
                                        <p className="text-[10px] text-slate-500 font-medium">{f.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* CTA SECTION - REFERRAL EMPRESA */}
                    <div className="relative group">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-none blur opacity-30 group-hover:opacity-60 transition duration-500"></div>
                        <div className="relative bg-slate-900 border border-slate-700 p-8 flex flex-col gap-6">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-blue-500 text-white flex items-center justify-center">
                                    <Star size={20} fill="currentColor" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">OFERTA INSTITUCIONAL</p>
                                    <p className="text-xs font-bold text-white uppercase">{t('proyecto_x_card.referral_note')}</p>
                                </div>
                            </div>
                            
                            <a 
                                href={OFFICIAL_REFERRAL_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm uppercase tracking-[0.4em] flex items-center justify-center gap-3 transition-all transform hover:scale-[1.02] active:scale-95 shadow-[0_0_30px_rgba(37,99,235,0.4)] clip-corner italic"
                            >
                                {t('proyecto_x_card.cta')}
                                <ArrowRight size={20} />
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            {/* STEP-BY-STEP GUIDE SECTION */}
            <div className="space-y-8 mt-20 pb-10">
                <div className="flex items-center gap-4 mb-8">
                    <h3 className="text-xl font-black text-white font-orbitron uppercase tracking-[0.2em] text-glow-cyan">
                        {t('proyecto_x_card.guide_title')}
                    </h3>
                    <div className="h-px flex-1 bg-gradient-to-r from-blue-500/50 via-blue-500/10 to-transparent"></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map((step) => (
                        <div key={step} className="relative group">
                            <div className="absolute -inset-0.5 bg-gradient-to-b from-blue-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                            <div className="relative bg-[#0c0f18]/80 border border-slate-800 p-6 flex flex-col h-full backdrop-blur-sm">
                                <div className="text-3xl font-black text-blue-500/20 font-orbitron mb-4 group-hover:text-blue-500/40 transition-colors">
                                    0{step}
                                </div>
                                <h4 className="text-xs font-black text-white uppercase tracking-widest mb-3 border-l-2 border-blue-500 pl-3">
                                    {t(`proyecto_x_card.step${step}_title`)}
                                </h4>
                                <p className="text-[10px] text-slate-500 leading-relaxed font-bold uppercase tracking-tight flex-1">
                                    {t(`proyecto_x_card.step${step}_desc`)}
                                </p>
                                
                                <div className="mt-6 flex justify-end">
                                    <div className="w-8 h-[1px] bg-slate-800 group-hover:w-full group-hover:bg-blue-500/50 transition-all duration-700"></div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ADDITIONAL INFO - HUD TILES */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
                <div className="p-6 bg-[#0c0f18] border border-slate-800 group hover:border-blue-500/30 transition-all">
                    <div className="flex items-center justify-between mb-4">
                        <Smartphone size={24} className="text-slate-600 group-hover:text-blue-500 transition-colors" />
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">APP CONTROL</span>
                    </div>
                    <h4 className="text-xs font-black text-white uppercase mb-2">GESTIÓN MÓVIL</h4>
                    <p className="text-[10px] text-slate-500 uppercase leading-relaxed font-bold tracking-tighter">Congela tu tarjeta, revisa balances y gestiona tu PIN desde la App oficial de Bancus.</p>
                </div>
                
                <div className="p-6 bg-[#0c0f18] border border-slate-800 group hover:border-blue-500/30 transition-all">
                    <div className="flex items-center justify-between mb-4">
                        <RefreshCw size={24} className="text-slate-600 group-hover:text-blue-500 transition-colors" />
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">REAL TIME SYNC</span>
                    </div>
                    <h4 className="text-xs font-black text-white uppercase mb-2">RECARGAS AL INSTANTE</h4>
                    <p className="text-[10px] text-slate-500 uppercase leading-relaxed font-bold tracking-tighter">Tus fondos llegan a la tarjeta en minutos tras la confirmación de red USDT del sistema.</p>
                </div>

                <div className="p-6 bg-[#0c0f18] border border-slate-800 group hover:border-blue-500/30 transition-all text-center flex flex-col items-center justify-center min-h-[140px]">
                    <CreditCard size={32} className="text-blue-500/20 mb-3" />
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">{t('common.secure_conn')}</p>
                </div>
            </div>
        </div>
    );
}
