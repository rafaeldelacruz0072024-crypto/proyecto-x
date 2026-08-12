import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, CheckCircle, Clock, Percent, Ticket, Zap, Gift } from 'lucide-react';
import { Promotion } from '../types';

interface FlashOfferModalProps {
    promotion: Promotion;
    onClose: () => void;
}

export default function FlashOfferModal({ promotion, onClose }: FlashOfferModalProps) {
    const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number } | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const calculateTimeLeft = () => {
            const difference = new Date(promotion.end_date).getTime() - new Date().getTime();

            if (difference <= 0) {
                return null;
            }

            return {
                hours: Math.floor((difference / (1000 * 60 * 60))),
                minutes: Math.floor((difference / 1000 / 60) % 60),
                seconds: Math.floor((difference / 1000) % 60)
            };
        };

        const timer = setInterval(() => {
            const remaining = calculateTimeLeft();
            setTimeLeft(remaining);
            if (!remaining) onClose();
        }, 1000);

        setTimeLeft(calculateTimeLeft());

        return () => clearInterval(timer);
    }, [promotion.end_date, onClose]);

    const copyToClipboard = () => {
        if (promotion.coupon_code) {
            navigator.clipboard.writeText(promotion.coupon_code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    if (!timeLeft) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="relative w-full max-w-xl bg-[#0f1219] border border-slate-700/50 rounded-[2.5rem] shadow-[0_0_50px_rgba(37,99,235,0.2)] overflow-hidden"
                >
                    {/* Background Decorative Elements */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
                    <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-blue-600/10 rounded-full blur-[100px]" />
                    <div className="absolute bottom-[-10%] left-[-10%] w-48 h-48 bg-purple-600/10 rounded-full blur-[80px]" />

                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-6 right-6 p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-full transition-all z-10"
                    >
                        <X size={20} />
                    </button>

                    <div className="p-8 md:p-12">
                        {/* Header Content */}
                        <div className="flex flex-col items-center text-center mb-8">
                            <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center mb-4 relative">
                                <Zap className="text-blue-400 fill-blue-400/20" size={32} />
                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full animate-ping" />
                            </div>
                            <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight font-orbitron mb-2">
                                {promotion.title}
                            </h2>
                            <p className="text-slate-400 text-sm md:text-base leading-relaxed max-w-md">
                                {promotion.description}
                            </p>
                        </div>

                        {/* Main Offer Card (The "Coupon" component) */}
                        <div className="relative bg-[#161b26] border border-slate-700/50 rounded-3xl p-6 mb-8 overflow-hidden group">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />

                            <div className="flex flex-col md:flex-row items-center gap-6">
                                <div className="flex flex-col items-center md:items-start text-center md:text-left gap-1 border-b md:border-b-0 md:border-r border-slate-700/50 pb-4 md:pb-0 md:pr-8 w-full md:w-auto">
                                    <div className="text-4xl font-black text-white flex items-baseline gap-1">
                                        {promotion.reward_value}
                                        <span className="text-xl text-blue-400">
                                            {promotion.type === 'CASHBACK' || promotion.type === 'DISCOUNT' ? '%' : 'USDT'}
                                        </span>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Benefit Reward</span>
                                </div>

                                <div className="flex-1 w-full">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Ticket className="text-blue-500" size={16} />
                                        <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">{promotion.coupon_code ? 'Flash Coupon Code' : 'Offer Activated'}</span>
                                    </div>

                                    {promotion.coupon_code ? (
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 font-mono text-lg font-black text-white tracking-widest select-all">
                                                {promotion.coupon_code}
                                            </div>
                                            <button
                                                onClick={copyToClipboard}
                                                className={`p-3 rounded-xl border transition-all ${copied
                                                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                                        : 'bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20'
                                                    }`}
                                            >
                                                {copied ? <CheckCircle size={24} /> : <Copy size={24} />}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="text-emerald-400 font-bold flex items-center gap-2 animate-pulse">
                                            <CheckCircle size={18} />
                                            BENEFICIO APLICADO AUTOMÁTICAMENTE
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Decorative dots for a ticket feel */}
                            <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-[#0f1219] rounded-full border border-slate-700/50" />
                            <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-[#0f1219] rounded-full border border-slate-700/50" />
                        </div>

                        {/* Footer: Timer & Action */}
                        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="flex items-center gap-4 bg-slate-900/50 px-6 py-3 rounded-2xl border border-slate-800/50">
                                <Clock className="text-amber-400 animate-pulse" size={20} />
                                <div className="flex items-center gap-2 font-mono text-lg font-black text-white letter-spacing-wider">
                                    <span>{timeLeft.hours.toString().padStart(2, '0')}</span>
                                    <span className="text-slate-600 font-normal">:</span>
                                    <span>{timeLeft.minutes.toString().padStart(2, '0')}</span>
                                    <span className="text-slate-600 font-normal">:</span>
                                    <span>{timeLeft.seconds.toString().padStart(2, '0')}</span>
                                </div>
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Expires In</span>
                            </div>

                            <button
                                onClick={onClose}
                                className="w-full md:w-auto px-10 py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-black text-sm uppercase tracking-[0.2em] rounded-2xl shadow-lg shadow-blue-500/20 transition-all active:scale-95 flex items-center justify-center gap-3"
                            >
                                <Gift size={18} />
                                Collect All
                            </button>
                        </div>

                        <p className="mt-6 text-center text-[10px] text-slate-600 font-medium uppercase tracking-[0.2em]">
                            {promotion.min_investment ? `* Valid on purchases from $${promotion.min_investment}` : '* Valid for all acquisitions'}
                        </p>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
