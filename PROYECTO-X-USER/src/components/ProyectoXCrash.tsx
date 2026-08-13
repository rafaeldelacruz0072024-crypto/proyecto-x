import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Rocket, Wallet, History, Trophy, ShieldCheck, X, TrendingUp, Users, DollarSign, Plus, Minus, Zap, Play, Square } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CryptoJS from 'crypto-js';
import { supabase } from '../lib/supabase';
import CrashBoard from './CrashBoard';
import CreditPanel from './CreditPanel';

// --- Types ---
type GameState = 'idle' | 'starting' | 'playing' | 'crashed';
type BetState = 'idle' | 'betting' | 'cashed_out';

interface Player {
    id: string;
    name: string;
    bet: number;
    cashOutTarget?: number;
    cashedOutAt?: number;
    profit?: number;
}

interface RoundHistory {
    crashPoint: number;
    serverSeed: string;
    clientSeed: string;
    nonce: number;
}

interface ProyectoXCrashProps {
    user: any;
    walletBalance: number;
    onUpdateBalance: () => void;
    maxBet: number;
}

// --- Constants ---
const HOUSE_EDGE = 0.07; // 7% house edge (93% RTP)
const GROWTH_RATE = 0.0693; // Takes ~10s to reach 2x
const CRASH_GAME_ID = '578b5122-2f02-431e-9986-5d81688cd3bc';

const ProyectoXCrash: React.FC<ProyectoXCrashProps> = ({ user, walletBalance, onUpdateBalance, maxBet }) => {
    // --- Game Logic State ---
    const [gameState, setGameState] = useState<GameState>('idle');
    const [currentMultiplier, setCurrentMultiplier] = useState(1.0);
    const [crashPoint, setCrashPoint] = useState(1.0);
    const [startTime, setStartTime] = useState(0);

    // --- Betting State ---
    const [betAmount, setBetAmount] = useState(10);
    const [betState, setBetState] = useState<BetState>('idle');
    const [autoCashOut, setAutoCashOut] = useState(2.0);
    const [lastWinAmount, setLastWinAmount] = useState<number | null>(null);
    const [showWinNotification, setShowWinNotification] = useState(false);

    // --- Auto Mode ---
    const [isAutoMode, setIsAutoMode] = useState(false);
    const [isAutoRunning, setIsAutoRunning] = useState(false);
    const [sessionProfit, setSessionProfit] = useState(0);

    // --- Provably Fair ---
    const serverSeedRef = useRef(CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex));
    const clientSeedRef = useRef('client_seed_' + user.id.slice(0, 8));
    const nonceRef = useRef(1);
    const [showProvablyFair, setShowProvablyFair] = useState(false);

    // --- UI State ---
    const [activeTab, setActiveTab] = useState<'CHAT' | 'HISTORY' | 'LEADERBOARD'>('CHAT');
    const [history, setHistory] = useState<RoundHistory[]>([]);
    const [players, setPlayers] = useState<Player[]>([]);
    const [isWalletOpen, setIsWalletOpen] = useState(false);
    const [dbHistory, setDbHistory] = useState<any[]>([]);

    useEffect(() => {
        const fetchHistory = async () => {
            const { data } = await supabase
                .from('transactions')
                .select('*')
                .eq('user_id', user.id)
                .in('type', ['GAME_WIN', 'GAME_STAKE'])
                .ilike('description', '%Crash%')
                .order('created_at', { ascending: false })
                .limit(20);
            if (data) setDbHistory(data);
        };
        if (user?.id) fetchHistory();
    }, [user?.id, walletBalance]);

    // --- Utils ---
    const generateCrashPoint = (serverSeed: string, clientSeed: string, nonce: number) => {
        const hash = CryptoJS.HmacSHA256(`${clientSeed}-${nonce}`, serverSeed).toString(CryptoJS.enc.Hex);
        const h = parseInt(hash.slice(0, 8), 16);
        const e = 2 ** 32;
        if (h % 100 === 0) return 1.00; // Instant crash 1% of the time (approx)
        const p = (e - h) / e;
        const result = (1 - HOUSE_EDGE) / p;
        return Math.max(1.00, Math.min(result, 1000000));
    };

    const calcMultiplier = (timeMs: number) => Math.max(1.00, Math.exp(GROWTH_RATE * (timeMs / 1000)));

    const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

    // --- Audio ---
    const playEffect = (type: 'tick' | 'start' | 'crash' | 'cashout') => {
        // Placeholder for sound logic if needed
    };

    // --- Main Game Loop ---
    useEffect(() => {
        let animationFrame: number;
        let lastTickSec = -1;

        const tick = () => {
            if (gameState === 'starting') {
                const elapsed = (Date.now() - startTime) / 1000;
                const currentSec = Math.floor(elapsed);
                if (currentSec > lastTickSec) {
                    playEffect('tick');
                    lastTickSec = currentSec;
                }

                if (elapsed >= 5) {
                    setGameState('playing');
                    playEffect('start');
                    setStartTime(Date.now());
                    setCurrentMultiplier(1.0);
                } else {
                    setCurrentMultiplier(elapsed); // Reuse state for countdown
                }
            } else if (gameState === 'playing') {
                const elapsed = Date.now() - startTime;
                const currentM = calcMultiplier(elapsed);

                if (currentM >= crashPoint) {
                    setGameState('crashed');
                    playEffect('crash');
                    setCurrentMultiplier(crashPoint);

                    const roundRecord: RoundHistory = {
                        crashPoint,
                        serverSeed: serverSeedRef.current,
                        clientSeed: clientSeedRef.current,
                        nonce: nonceRef.current
                    };

                    setHistory(prev => [roundRecord, ...prev].slice(0, 20));

                    // Reset and Prep next round
                    serverSeedRef.current = CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex);
                    nonceRef.current += 1;

                    // startRound siempre resetea betState — no hacer nada aquí

                    setTimeout(() => startRound(), 3000);
                } else {
                    setCurrentMultiplier(currentM);

                    // Auto Cashout
                    if (betState === 'betting' && autoCashOut > 1.0 && currentM >= autoCashOut) {
                        handleCashOut(autoCashOut);
                    }

                    // Simulated Players
                    setPlayers(prev => prev.map(p => {
                        if (!p.cashedOutAt && p.cashOutTarget && currentM >= p.cashOutTarget) {
                            return { ...p, cashedOutAt: p.cashOutTarget, profit: p.bet * p.cashOutTarget };
                        }
                        return p;
                    }));
                }
            }
            animationFrame = requestAnimationFrame(tick);
        };

        if (gameState === 'starting' || gameState === 'playing') {
            animationFrame = requestAnimationFrame(tick);
        }
        return () => cancelAnimationFrame(animationFrame);
    }, [gameState, startTime, crashPoint, betState, autoCashOut]);

    const startRound = useCallback(() => {
        const newCrashPoint = generateCrashPoint(serverSeedRef.current, clientSeedRef.current, nonceRef.current);
        setCrashPoint(newCrashPoint);
        setGameState('starting');
        setStartTime(Date.now());
        setCurrentMultiplier(0);

        // Fake Players
        const fakePlayers: Player[] = Array.from({ length: 12 }).map((_, i) => {
            const target = 1.1 + Math.random() * 8;
            return {
                id: `p-${i}`,
                name: `User${Math.floor(Math.random() * 9999)}`,
                bet: Math.floor(Math.random() * 50) + 1,
                cashOutTarget: Math.random() > 0.4 ? target : undefined,
            };
        });
        setPlayers(fakePlayers.sort((a, b) => b.bet - a.bet));

        // Siempre resetear betState al iniciar nueva ronda (evita stale closure bug)
        setBetState('idle');

        // Auto bet trigger
        if (isAutoRunning) {
            setTimeout(() => handlePlaceBet(), 100);
        }
    }, [isAutoRunning]);

    useEffect(() => {
        if (gameState === 'idle') startRound();
    }, [gameState, startRound]);

    // --- Actions ---
    const handlePlaceBet = async () => {
        if (walletBalance < betAmount) return;
        if (gameState === 'playing' || gameState === 'crashed') return;

        setBetState('betting');

        try {
            const { data, error } = await supabase.rpc('process_game_bet', {
                p_user_id: user.id,
                p_amount: Number(betAmount),
                p_game_name: 'Proyecto X Crash'
            });

            if (error) {
                console.error('Bet error:', error);
                setBetState('idle');
                return;
            }

            if (data && data.success) {
                onUpdateBalance();
                setSessionProfit(prev => prev - betAmount);
            } else {
                console.error('Bet failed:', data?.message);
                setBetState('idle');
            }
        } catch (err) {
            console.error('Bet exception:', err);
            setBetState('idle');
        }
    };

    const handleCancelBet = async () => {
        if (betState !== 'betting' || gameState !== 'starting') return;
        setBetState('idle');
        try {
            const { data, error } = await supabase.rpc('process_game_result', {
                p_user_id: user.id,
                p_amount: Number(betAmount),
                p_game_name: 'Proyecto X Crash'
            });
            if (error) console.error('Cancel bet DB error:', error);
            onUpdateBalance();
            setSessionProfit(prev => prev + betAmount);
        } catch (err) {
            console.error('Cancel bet exception:', err);
        }
    };

    const handleCashOut = async (multiplierToUse = currentMultiplier) => {
        if (betState !== 'betting' || gameState !== 'playing') return;

        const winAmount = betAmount * multiplierToUse;
        setBetState('cashed_out');
        setLastWinAmount(winAmount);
        setShowWinNotification(true);
        setTimeout(() => setShowWinNotification(false), 4000);

        try {
            const { data, error } = await supabase.rpc('process_game_result', {
                p_user_id: user.id,
                p_amount: Number(winAmount),
                p_game_name: 'Proyecto X Crash'
            });

            if (error) console.error('Cashout DB error:', error);
            if (data && !data.success) {
                console.error('Win processing failed:', data.message);
            }
            onUpdateBalance();
            setSessionProfit(prev => prev + winAmount);
            playEffect('cashout');
        } catch (err) {
            console.error('Cashout exception:', err);
        }
    };

    return (
        <div className="flex flex-col lg:flex-row h-full bg-[#0a0a0c] text-white min-h-[700px] pb-20 lg:pb-0">
            {/* 1. Main Column: Game + Local Controls */}
            <div className="flex-1 flex flex-col relative border-r border-white/5 bg-gradient-to-b from-[#0e0e12] to-[#0a0a0c]">
                <div className="flex-1 flex flex-col relative p-4 lg:p-6">

                    {/* Header Info */}
                    <div className="flex justify-between items-center mb-4 px-2">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10">
                                <Rocket className="w-4 h-4 text-purple-500" />
                                <span className="text-xs font-black uppercase tracking-widest italic">PROYECTO X CRASH</span>
                            </div>
                            {/* Round History Chips */}
                            <div className="hidden md:flex items-center gap-2 overflow-hidden">
                                {history.slice(0, 5).map((h, i) => (
                                    <div key={i} className={`px-2 py-0.5 rounded text-[10px] font-bold ${h.crashPoint >= 2 ? 'text-proyecto-green bg-proyecto-green/10' : 'text-red-400 bg-red-400/10'}`}>
                                        {h.crashPoint.toFixed(2)}x
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={() => setShowProvablyFair(true)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                                <ShieldCheck className="w-4 h-4 text-proyecto-green" />
                            </button>
                            <div className="px-4 py-2 bg-proyecto-brand/20 border border-proyecto-brand/30 rounded-xl flex items-center gap-2 shadow-[0_0_15px_rgba(var(--proyecto-brand-rgb),0.1)]">
                                <Wallet className="w-4 h-4 text-proyecto-brand" />
                                <span className="font-black font-mono text-sm tracking-tighter text-white">{formatCurrency(walletBalance)}</span>
                                <Plus className="w-3 h-3 text-proyecto-brand cursor-pointer hover:scale-125 transition-transform" onClick={() => setIsWalletOpen(true)} />
                            </div>
                        </div>
                    </div>

                    {/* Game area */}
                    <div className="flex-1 min-h-[300px] mb-4">
                        <CrashBoard gameState={gameState} currentMultiplier={currentMultiplier} crashPoint={crashPoint} />
                    </div>

                    {/* Win Notification Overlay */}
                    <AnimatePresence>
                        {showWinNotification && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                className="absolute inset-0 z-[100] flex items-center justify-center pointer-events-none"
                            >
                                <div className="p-10 rounded-[2.5rem] bg-black/80 backdrop-blur-xl border-2 border-proyecto-green/50 shadow-neon-green text-center">
                                    <Trophy className="mx-auto mb-4 text-proyecto-green" size={64} />
                                    <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white mb-2">¡HAS GANADO!</h2>
                                    <p className="text-6xl font-black text-proyecto-green drop-shadow-[0_0_20px_rgba(16,185,129,0.5)] animate-pulse">
                                        {lastWinAmount ? formatCurrency(lastWinAmount) : '$0.00'}
                                    </p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Local Controls (Mobile & Desktop) */}
                    <div className="bg-white/5 rounded-3xl p-6 border border-white/10 backdrop-blur-md">
                        <div className="flex flex-col md:flex-row gap-6 items-end">
                            {/* Bet Input */}
                            <div className="flex-1 space-y-2">
                                <div className="flex justify-between px-1">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cantidad</span>
                                    <span className="text-[10px] font-black text-proyecto-brand uppercase tracking-widest italic">Max Bet: $100</span>
                                </div>
                                <div className="flex items-center bg-black/60 border border-white/10 rounded-2xl p-1 group focus-within:border-proyecto-brand/50 transition-all shadow-inner">
                                    <DollarSign className="w-4 h-4 text-slate-500 ml-3" />
                                    <input
                                        type="number"
                                        value={betAmount}
                                        onChange={(e) => setBetAmount(Math.min(maxBet, Number(e.target.value)))}
                                        className="flex-1 bg-transparent border-none outline-none font-black font-mono text-xl p-3 tracking-tighter text-white"
                                    />
                                    <div className="flex gap-1 mr-1">
                                        <button onClick={() => setBetAmount(prev => Math.max(0.1, prev / 2))} className="px-3 py-2 bg-white/5 rounded-xl text-[10px] font-black hover:bg-proyecto-brand/20 hover:text-proyecto-brand transition-all border border-transparent hover:border-proyecto-brand/30">1/2</button>
                                        <button onClick={() => setBetAmount(prev => Math.min(maxBet, prev * 2))} className="px-3 py-2 bg-white/5 rounded-xl text-[10px] font-black hover:bg-proyecto-brand/20 hover:text-proyecto-brand transition-all border border-transparent hover:border-proyecto-brand/30">x2</button>
                                    </div>
                                </div>
                            </div>

                            {/* Auto Cashout */}
                            <div className="flex-1 space-y-2">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Retiro Automático</span>
                                <div className="flex items-center bg-black/60 border border-white/10 rounded-2xl p-1 group focus-within:border-proyecto-green/50 transition-all shadow-inner">
                                    <TrendingUp className="w-4 h-4 text-slate-500 ml-3" />
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={autoCashOut}
                                        onChange={(e) => setAutoCashOut(Number(e.target.value))}
                                        className="flex-1 bg-transparent border-none outline-none font-black font-mono text-xl p-3 tracking-tighter text-white"
                                        placeholder="Min 1.1x"
                                    />
                                    <div className="mr-3 text-proyecto-green font-black tracking-widest italic drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]">X</div>
                                </div>
                            </div>

                            {/* Main CTA */}
                            <div className="w-full md:w-auto min-w-[220px] flex-shrink-0">
                                {betState === 'idle' ? (
                                    <button
                                        onClick={handlePlaceBet}
                                        disabled={gameState === 'playing' || walletBalance < betAmount}
                                        className="w-full h-16 bg-gradient-to-r from-proyecto-brand to-[#00b4d8] text-white font-black italic uppercase tracking-[0.2em] rounded-2xl shadow-[0_0_20px_rgba(0,243,255,0.3)] hover:shadow-[0_0_30px_rgba(0,243,255,0.5)] hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100 transition-all flex items-center justify-center gap-3 group border border-white/10"
                                    >
                                        <Zap className="w-5 h-5 fill-white group-hover:animate-pulse" />
                                        APOSTAR
                                    </button>
                                ) : betState === 'betting' ? (
                                    gameState === 'starting' ? (
                                        <button
                                            onClick={handleCancelBet}
                                            className="w-full h-16 bg-gradient-to-r from-slate-600 to-slate-700 text-white font-black italic uppercase tracking-widest rounded-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center border border-white/10"
                                        >
                                            CANCELAR APUESTA
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleCashOut()}
                                            disabled={gameState === 'crashed'}
                                            className="w-full h-16 bg-gradient-to-r from-proyecto-green to-[#059669] text-black font-black italic uppercase tracking-widest rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100 transition-all flex flex-col items-center justify-center leading-none border border-white/10"
                                        >
                                            <span className="text-[10px] mb-1 font-bold">RETIRAR</span>
                                            <span className="text-xl tracking-tighter font-mono">{formatCurrency(betAmount * currentMultiplier)}</span>
                                        </button>
                                    )
                                ) : (
                                    <div className="w-full h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-proyecto-green font-black italic uppercase tracking-widest opacity-80 backdrop-blur-sm shadow-inner">
                                        RETIRADO ✅
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. Global Sidebar (Shared Shell) */}
            <div className="w-full lg:w-[400px] flex flex-col bg-[#0f0f11]/80 backdrop-blur-3xl border-l border-white/5">
                <div className="p-4 border-b border-white/10 bg-white/5">
                    <div className="flex gap-2 p-1.5 bg-black/60 rounded-2xl border border-white/5 shadow-inner">
                        {['CHAT', 'HISTORY', 'LEADERBOARD'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab as any)}
                                className={cn(
                                    "flex-1 py-2.5 text-[9px] font-black uppercase tracking-[0.2em] rounded-xl transition-all duration-300",
                                    activeTab === tab 
                                        ? "bg-proyecto-brand text-white shadow-[0_0_15px_rgba(0,243,255,0.3)] border border-white/10 scale-[1.02]"
                                        : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                                )}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
                    {activeTab === 'LEADERBOARD' ? (
                        <div className="space-y-3">
                            {players.map((p, i) => (
                                <motion.div 
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    key={i} 
                                    className="flex justify-between items-center bg-black/40 p-4 rounded-2xl border border-white/5 hover:border-white/10 transition-all group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-proyecto-brand/20 to-purple-500/10 flex items-center justify-center border border-white/10 group-hover:border-proyecto-brand/50 transition-colors">
                                            <Users className="w-4 h-4 text-proyecto-brand" />
                                        </div>
                                        <span className="text-xs font-bold text-slate-300 group-hover:text-white transition-colors">{p.name}</span>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-black font-mono leading-none tracking-tighter mb-1 text-white">{formatCurrency(p.bet)}</p>
                                        {p.cashedOutAt && (
                                            <p className="text-[9px] font-black text-proyecto-green italic drop-shadow-[0_0_5px_rgba(16,185,129,0.3)]">+{p.cashedOutAt.toFixed(2)}x</p>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    ) : activeTab === 'HISTORY' ? (
                        <div className="space-y-3">
                            {dbHistory.length > 0 ? dbHistory.map((tx) => (
                                <div key={tx.id} className="p-3 bg-white/5 border border-white/5 rounded-xl flex justify-between items-center">
                                    <div className="flex flex-col gap-1">
                                        <span className={`text-[8px] font-bold p-1 rounded w-fit ${tx.amount > 0 ? 'bg-proyecto-green/20 text-proyecto-green' : 'bg-red-500/20 text-red-500'}`}>
                                            {tx.amount > 0 ? 'WIN' : 'BET'}
                                        </span>
                                        <span className="text-[8px] text-slate-500">{new Date(tx.created_at).toLocaleTimeString()}</span>
                                    </div>
                                    <span className={tx.amount > 0 ? 'text-proyecto-green font-bold font-mono' : 'text-slate-300 font-bold font-mono'}>
                                        {tx.amount > 0 ? `+$${tx.amount.toFixed(2)}` : `-$${Math.abs(tx.amount).toFixed(2)}`}
                                    </span>
                                </div>
                            )) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-2 opacity-50 py-10">
                                    <History size={24} />
                                    <span className="text-[10px] font-black uppercase">Sin historial</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full opacity-30">
                            <p className="text-xs font-black uppercase tracking-[0.2em]">Contenido de {activeTab}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Modals & Overlays */}
            <AnimatePresence>
                {isWalletOpen && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/80 backdrop-blur-md"
                            onClick={() => setIsWalletOpen(false)}
                        />
                        <motion.div
                            initial={{ y: 50, scale: 0.9 }} animate={{ y: 0, scale: 1 }} exit={{ y: 50, scale: 0.9 }}
                            className="w-full max-w-lg bg-[#111114] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl z-10"
                        >
                            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                                <h3 className="text-lg font-black italic tracking-tighter uppercase text-proyecto-brand">Gestion de Cartera</h3>
                                <X className="w-6 h-6 text-slate-500 cursor-pointer" onClick={() => setIsWalletOpen(false)} />
                            </div>
                            <div className="p-8">
                                <CreditPanel />
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Provably Fair Modal */}
            <AnimatePresence>
                {showProvablyFair && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/80 backdrop-blur-md"
                            onClick={() => setShowProvablyFair(false)}
                        />
                        <motion.div
                            initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                            className="w-full max-w-2xl bg-[#111114] border border-white/10 rounded-[2rem] overflow-hidden z-10"
                        >
                            <div className="p-6 border-b border-white/10 flex justify-between items-center">
                                <h3 className="text-sm font-black italic tracking-tighter uppercase text-proyecto-green flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4" /> PROVABLY FAIR
                                </h3>
                                <X className="w-5 h-5 text-slate-500 cursor-pointer" onClick={() => setShowProvablyFair(false)} />
                            </div>
                            <div className="p-8 space-y-6">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Server Seed Hash</label>
                                    <div className="bg-black p-4 rounded-xl border border-white/5 font-mono text-xs break-all text-proyecto-green/80">
                                        {CryptoJS.SHA256(serverSeedRef.current).toString(CryptoJS.enc.Hex)}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Client Seed</label>
                                    <input type="text" value={clientSeedRef.current} readOnly className="w-full bg-black p-4 rounded-xl border border-white/5 font-mono text-xs text-white outline-none" />
                                </div>
                                <p className="text-[10px] text-slate-500 font-bold leading-relaxed">
                                    PROYECTO X utiliza un sistema de justicia demostrable. El resultado de cada ronda se genera combinando el Server Seed (oculto) y tu Client Seed mediante HMAC-SHA256. Esto garantiza que ni la casa ni el jugador puedan manipular el punto de explosión.
                                </p>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

// Utility
function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(' ');
}

export default ProyectoXCrash;
