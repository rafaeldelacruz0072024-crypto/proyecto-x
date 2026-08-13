import React, { useEffect, useState, useRef } from 'react';
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react';

interface LiveWalletProps {
    balance: number;
    label?: string;
    className?: string;
}

export default function LiveWallet({ balance, label = "Available Balance", className = "" }: LiveWalletProps) {
    const [displayBalance, setDisplayBalance] = useState(balance);
    const [status, setStatus] = useState<'IDLE' | 'UP' | 'DOWN'>('IDLE');
    const prevBalanceRef = useRef(balance);

    useEffect(() => {
        if (balance > prevBalanceRef.current) {
            setStatus('UP');
            setTimeout(() => setStatus('IDLE'), 2000);
        } else if (balance < prevBalanceRef.current) {
            setStatus('DOWN');
            setTimeout(() => setStatus('IDLE'), 2000);
        }

        // Smoothly animate the number if needed, or just set it
        setDisplayBalance(balance);
        prevBalanceRef.current = balance;
    }, [balance]);

    return (
        <div className={`relative overflow-hidden bg-black/40 backdrop-blur-xl border border-white/5 p-5 rounded-2xl transition-all duration-500 ${status === 'UP' ? 'border-proyecto-green/40 bg-proyecto-green/5' : status === 'DOWN' ? 'border-red-500/40 bg-red-500/5' : ''} ${className}`}>

            {/* Holographic background effect */}
            <div className="absolute inset-0 bg-grid opacity-10 pointer-events-none" />
            <div className={`absolute top-0 left-0 w-full h-0.5 transition-all duration-1000 ${status === 'UP' ? 'bg-proyecto-green shadow-[0_0_15px_green]' : status === 'DOWN' ? 'bg-red-500 shadow-[0_0_15px_red]' : 'bg-transparent'}`} />

            <div className="flex items-center gap-4 relative z-10">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-all duration-500 ${status === 'UP' ? 'bg-proyecto-green/20 border-proyecto-green/40 rotate-[360deg]' : status === 'DOWN' ? 'bg-red-500/20 border-red-500/40' : 'bg-proyecto-brand/10 border-white/10'}`}>
                    <Wallet size={20} className={status === 'UP' ? 'text-proyecto-green' : status === 'DOWN' ? 'text-red-500' : 'text-proyecto-accent'} />
                </div>

                <div className="flex-1">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">{label}</p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-orbitron font-black text-white leading-none">
                            {displayBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] font-mono-tech text-proyecto-accent">USDT</span>
                    </div>
                </div>

                {/* Animated status Indicators */}
                <div className="flex flex-col items-center justify-center gap-1">
                    <div className={`transition-all duration-500 ${status === 'UP' ? 'opacity-100 translate-y-0 scale-110' : 'opacity-0 translate-y-2 scale-50'}`}>
                        <TrendingUp size={16} className="text-proyecto-green" />
                    </div>
                    <div className={`transition-all duration-500 ${status === 'DOWN' ? 'opacity-100 translate-y-0 scale-110' : 'opacity-0 -translate-y-2 scale-50'}`}>
                        <TrendingDown size={16} className="text-red-500" />
                    </div>
                </div>
            </div>

            {/* Micro-sparkles or glow on update */}
            {status !== 'IDLE' && (
                <div className={`absolute -right-4 -top-4 w-24 h-24 blur-[40px] rounded-full mix-blend-screen animate-pulse ${status === 'UP' ? 'bg-proyecto-green/20' : 'bg-red-500/20'}`} />
            )}
        </div>
    );
}
