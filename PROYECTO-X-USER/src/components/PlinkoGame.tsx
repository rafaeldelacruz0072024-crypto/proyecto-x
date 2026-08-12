import React, { useState, useRef, useEffect, useCallback } from 'react';
import PlinkoBoard, { PlinkoBoardRef } from './PlinkoBoard';
import { Zap, Play, Square, Coins, History, DollarSign, Trophy, Wallet, X, Plus, Minus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTranslation } from 'react-i18next';
import CreditPanel from './CreditPanel';

// Utility for concatenating classes
function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(' ');
}

interface PlinkoGameProps {
    user: any;
    walletBalance: number;
    onUpdateBalance: () => void;
    maxBet: number;
}

export default function PlinkoGame({ user, walletBalance, onUpdateBalance, maxBet }: PlinkoGameProps) {
    const { t } = useTranslation();
    const [stake, setStake] = useState(10);
    const [risk, setRisk] = useState<'Low' | 'Medium' | 'High'>('Medium');
    const [rows, setRows] = useState(8);
    const [mode, setMode] = useState<'Manual' | 'Auto'>('Manual');
    const [isAutoPlaying, setIsAutoPlaying] = useState(false);
    const [history, setHistory] = useState<{ multiplier: number; win: number }[]>([]);
    const [lastWinAmount, setLastWinAmount] = useState<number | null>(null);
    const [showWinNotification, setShowWinNotification] = useState(false);
    const [dbHistory, setDbHistory] = useState<any[]>([]);

    useEffect(() => {
        const fetchHistory = async () => {
            const { data } = await supabase
                .from('transactions')
                .select('*')
                .eq('user_id', user.id)
                .in('type', ['GAME_WIN', 'GAME_STAKE'])
                .ilike('description', '%Plinko%')
                .order('created_at', { ascending: false })
                .limit(20);
            if (data) setDbHistory(data);
        };
        if (user?.id) fetchHistory();
    }, [user?.id, walletBalance]);

    // --- UI Shell State ---
    const [activeTab, setActiveTab] = useState<'LEADERBOARD' | 'HISTORY' | 'CHAT'>('CHAT');
    const [isWalletOpen, setIsWalletOpen] = useState(false);
    const [showMobileHistory, setShowMobileHistory] = useState(false);
    const [showChipSelector, setShowChipSelector] = useState(false);
    const [chatMessages, setChatMessages] = useState([
        { id: 1, user: "System", text: "Welcome to Plinko Chat!", timestamp: Date.now() }
    ]);
    const [chatInput, setChatInput] = useState("");

    const boardRef = useRef<PlinkoBoardRef>(null);

    const handleBet = useCallback(async () => {
        if (stake > walletBalance || stake <= 0 || stake > maxBet) {
            if (stake > maxBet) alert(`La apuesta máxima es de ${maxBet}$`);
            else if (stake > walletBalance) alert('Saldo insuficiente');
            setIsAutoPlaying(false);
            return;
        }

        try {
            const { data, error } = await supabase.rpc('process_game_bet', {
                p_user_id: user.id,
                p_amount: Number(stake),
                p_game_name: 'Plinko Premium'
            });

            if (error) throw error;
            if (!data.success) {
                alert(data.message);
                setIsAutoPlaying(false);
                return;
            }

            // Launch Ball on Canvas
            boardRef.current?.dropBall(stake);
            onUpdateBalance();

        } catch (err: any) {
            console.error('Bet error:', err);
            setIsAutoPlaying(false);
        }
    }, [stake, walletBalance, user.id, onUpdateBalance]);

    const handleWin = useCallback(async (winAmount: number, multiplier: number) => {
        try {
            await supabase.rpc('process_game_result', {
                p_user_id: user.id,
                p_amount: Number(winAmount),
                p_game_name: 'Plinko Premium'
            });

            setHistory(prev => [{ multiplier, win: winAmount }, ...prev].slice(0, 10));

            if (winAmount > 0) {
                setLastWinAmount(winAmount);
                setShowWinNotification(true);
                // Auto hide after 4 seconds
                setTimeout(() => setShowWinNotification(false), 4000);
            }

            onUpdateBalance();
        } catch (err) {
            console.error('Result error:', err);
        }
    }, [user.id, onUpdateBalance]);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (mode === 'Auto' && isAutoPlaying) {
            interval = setInterval(() => {
                handleBet();
            }, 600); // Slightly slower than standalone for stability
        }
        return () => clearInterval(interval);
    }, [mode, isAutoPlaying, handleBet]);

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 2,
        }).format(val);
    };

    return (
        <div className="flex flex-col lg:flex-row h-full bg-[#0a0a0c] text-white min-h-[600px] mb-20 lg:mb-0">
            {/* 1. Main Column: Game + Local Controls */}
            <div className="flex-1 flex flex-col overflow-hidden relative border-r border-white/5">
                {/* Main Game & Controls Container */}
                <div className="flex-1 flex flex-col overflow-hidden relative">
                    {/* Win Notification Overlay */}
                    {showWinNotification && (
                        <div className="absolute inset-0 z-[150] flex items-center justify-center animate-in fade-in zoom-in duration-500 bg-black/60 backdrop-blur-sm">
                            <div className="text-center p-8 lg:p-10 rounded-[2.5rem] bg-gradient-to-b from-geminix-green/20 to-black border-2 border-geminix-green/40 shadow-neon-green relative overflow-hidden max-w-[90%] lg:max-w-md">
                                <Trophy className="mx-auto mb-4 text-geminix-green drop-shadow-neon" size={48} />
                                <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter mb-1">¡PREMIO PLINKO!</h2>
                                <div className="h-0.5 w-16 bg-geminix-green mx-auto mb-4"></div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Ganancia</p>
                                <p className="text-4xl font-black text-geminix-green shadow-neon-green">
                                    {lastWinAmount !== null ? formatCurrency(lastWinAmount) : '$0.00'}
                                </p>
                                <button
                                    onClick={() => setShowWinNotification(false)}
                                    className="mt-8 px-10 py-3 bg-geminix-green text-black font-black uppercase tracking-widest rounded-full hover:scale-105 transition-transform shadow-xl text-xs"
                                >
                                    Excelente
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Game Canvas Area */}
                    <div className="flex-1 bg-black/20 relative">
                        {/* Visual Glow Background */}
                        <div className="absolute inset-0 pointer-events-none">
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px]" />
                        </div>

                        <div className="flex-1 h-full flex flex-col justify-center pt-20">
                            <PlinkoBoard
                                ref={boardRef}
                                rows={rows}
                                risk={risk}
                                onWin={handleWin}
                            />
                        </div>
                    </div>
                </div>

                {/* Betting Controls Area */}
                <div className="bg-[#141416] p-4 lg:p-8 pb-10 lg:pb-8 space-y-4 safe-bottom border-t border-white/5">
                    {/* PC View Betting UI */}
                    <div className="hidden lg:flex items-center justify-between gap-6">
                        <div className="flex-1 flex items-center gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Inversión</label>
                                <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-2xl p-2 h-16 w-60">
                                    <button onClick={() => setStake(Math.max(1, stake - 10))} className="w-12 h-full rounded-xl bg-white/5 flex items-center justify-center text-white hover:bg-white/10 transition-colors">
                                        <Minus size={18} />
                                    </button>
                                    <div className="flex-1 text-center">
                                        <span className="text-xl font-black text-white">{stake.toFixed(2)} $</span>
                                    </div>
                                    <button onClick={() => setStake(stake + 10)} className="w-12 h-full rounded-xl bg-white/5 flex items-center justify-center text-white hover:bg-white/10 transition-colors">
                                        <Plus size={18} />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Riesgo / Filas</label>
                                <div className="flex items-center gap-3 bg-black/40 border border-white/10 rounded-2xl p-2 h-16 px-4">
                                    <div className="flex gap-1">
                                        {(['Low', 'Medium', 'High'] as const).map(r => (
                                            <button
                                                key={r}
                                                onClick={() => setRisk(r)}
                                                className={`px-3 py-1.5 rounded-lg text-[9px] font-black transition-all ${risk === r ? 'bg-blue-600 text-white' : 'bg-white/5 text-slate-500 hover:text-white'}`}
                                            >
                                                {r}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="w-px h-8 bg-white/10 mx-1" />
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black text-white">{rows}R</span>
                                        <input
                                            type="range" min="8" max="16" step="1" value={rows}
                                            onChange={(e) => setRows(Number(e.target.value))}
                                            className="w-24 accent-blue-600"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={mode === 'Manual' ? handleBet : () => setIsAutoPlaying(!isAutoPlaying)}
                            disabled={walletBalance < stake || stake <= 0}
                            className={`h-24 px-12 rounded-[2rem] flex flex-col items-center justify-center gap-2 font-black italic text-xl transition-all shadow-xl active:scale-95 ${walletBalance >= stake && stake > 0 ? 'bg-blue-600 text-white border-b-4 border-blue-800 shadow-[0_0_20px_rgba(59,130,246,0.5)] hover:brightness-110' : 'bg-white/5 text-slate-600 border-none opacity-50 grayscale pointer-events-none'}`}
                        >
                            {mode === 'Manual' ? (
                                <>
                                    <Coins size={24} />
                                    LANZAR
                                </>
                            ) : (
                                <>
                                    {isAutoPlaying ? <Square size={24} /> : <Play size={24} />}
                                    {isAutoPlaying ? 'PARAR' : 'AUTO'}
                                </>
                            )}
                        </button>
                    </div>

                    {/* Mobile View Betting UI */}
                    <div className="lg:hidden flex flex-col gap-4">
                        <div className="flex justify-between items-center gap-4">
                            <div
                                onClick={() => setIsWalletOpen(true)}
                                className="group flex-1 h-16 bg-[#1c1c1e] border border-white/5 rounded-3xl px-4 flex flex-col items-start justify-center cursor-pointer active:bg-white/5 transition-all relative overflow-hidden"
                            >
                                <div className="flex items-center gap-1.5 mb-0.5">
                                    <div className="w-4 h-4 rounded bg-blue-500/20 flex items-center justify-center text-blue-500">
                                        <Wallet size={10} />
                                    </div>
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">CARTERA</span>
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-lg font-black text-white">{walletBalance.toFixed(2)}</span>
                                    <span className="text-xs text-slate-400">$</span>
                                </div>
                            </div>

                            <div className="relative">
                                {showChipSelector && (
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 bg-[#1c1c1e] border-2 border-white/10 p-4 rounded-[2rem] shadow-2xl z-50 w-64 animate-in slide-in-from-bottom duration-300">
                                        <div className="grid grid-cols-3 gap-3">
                                            {[1, 5, 10, 25, 50, 100, 250, 500, 1000].filter(v => v <= maxBet).map(v => (
                                                <button
                                                    key={v}
                                                    onClick={() => { setStake(v); setShowChipSelector(false); }}
                                                    className={`h-11 rounded-full border-2 border-white/10 flex items-center justify-center text-[10px] font-black transition-all active:scale-90 ${stake === v ? 'bg-blue-600 border-blue-600 shadow-[0_0_15px_rgba(59,130,246,0.5)] text-white' : 'bg-black/40 text-slate-400 hover:text-white hover:bg-white/5'}`}
                                                >
                                                    {v < 1000 ? v : `${(v / 1000).toFixed(0)}K`}
                                                </button>
                                            ))}
                                            {/* Always show the max bet if it's not in the standard list */}
                                            {![1, 5, 10, 25, 50, 100, 250, 500, 1000].includes(maxBet) && (
                                                <button
                                                    onClick={() => { setStake(maxBet); setShowChipSelector(false); }}
                                                    className={`h-11 rounded-full border-2 border-white/10 flex items-center justify-center text-[10px] font-black transition-all active:scale-90 ${stake === maxBet ? 'bg-blue-600 border-blue-600 shadow-[0_0_15px_rgba(59,130,246,0.5)] text-white' : 'bg-black/40 text-slate-400 hover:text-white hover:bg-white/5'}`}
                                                >
                                                    {maxBet}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                                <button
                                    onClick={() => setShowChipSelector(!showChipSelector)}
                                    className="w-16 h-16 rounded-full bg-[#2c2c2e] border-4 border-[#3a3a3c] flex flex-col items-center justify-center shadow-2xl active:scale-95 transition-all"
                                >
                                    <span className="text-[10px] font-black text-white">{stake.toFixed(0)}</span>
                                    <div className="w-10 h-10 border-2 border-white/10 rounded-full flex items-center justify-center mt-0.5">
                                        <div className="w-6 h-6 border-2 border-dashed border-white/5 rounded-full"></div>
                                    </div>
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={handleBet}
                                className="py-5 rounded-3xl flex flex-col items-center justify-center gap-1 bg-blue-600 border border-blue-400/30 active:scale-95 shadow-lg"
                            >
                                <span className="text-xs font-black tracking-[0.3em] text-white/90 uppercase">Lanzar</span>
                                <Coins size={18} className="text-white" />
                            </button>
                            <button
                                onClick={() => { setMode(mode === 'Manual' ? 'Auto' : 'Manual'); setIsAutoPlaying(false); }}
                                className={`py-5 rounded-3xl flex flex-col items-center justify-center gap-1 border border-white/10 active:scale-95 shadow-lg ${mode === 'Auto' ? 'bg-purple-600 border-purple-400/30' : 'bg-white/5'}`}
                            >
                                <span className="text-xs font-black tracking-[0.3em] text-white/90 uppercase">{mode === 'Auto' ? 'Parar' : 'Auto'}</span>
                                {mode === 'Auto' ? <Square size={18} /> : <Play size={18} />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. Sidebar (Same as Trading) */}
            <div className={`
                lg:w-80 lg:flex lg:flex-col bg-black/40 border-l border-white/5
                ${showMobileHistory ? 'fixed inset-0 z-[120] flex flex-col bg-black/95 animate-in slide-in-from-right duration-300' : 'hidden lg:flex'}
            `}>
                <div className="flex border-b border-white/5">
                    {(['CHAT', 'HISTORY', 'LEADERBOARD'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-4 text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === tab ? 'text-blue-400 bg-blue-400/5 border-b border-blue-400' : 'text-slate-500 hover:text-white'}`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {activeTab === 'CHAT' ? (
                        <div className="space-y-4">
                            {chatMessages.map(msg => (
                                <div key={msg.id} className="space-y-1">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-bold text-blue-400">{msg.user}</span>
                                        <span className="text-[8px] text-slate-600">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <p className="text-xs text-slate-400 leading-relaxed font-bold">{msg.text}</p>
                                </div>
                            ))}
                        </div>
                    ) : activeTab === 'HISTORY' ? (
                        <div className="space-y-3">
                            {dbHistory.length > 0 ? dbHistory.map((tx) => (
                                <div key={tx.id} className="p-3 bg-white/5 border border-white/5 rounded-xl flex justify-between items-center">
                                    <div className="flex flex-col gap-1">
                                        <span className={`text-[8px] font-bold p-1 rounded w-fit ${tx.amount > 0 ? 'bg-geminix-green/20 text-geminix-green' : 'bg-red-500/20 text-red-500'}`}>
                                            {tx.amount > 0 ? 'WIN' : 'BET'}
                                        </span>
                                        <span className="text-[8px] text-slate-500">{new Date(tx.created_at).toLocaleTimeString()}</span>
                                    </div>
                                    <span className={tx.amount > 0 ? 'text-geminix-green font-bold font-mono' : 'text-slate-300 font-bold font-mono'}>
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
                        <div className="h-full flex flex-col items-center justify-center opacity-30">
                            <Trophy size={48} />
                            <p className="text-[10px] font-black uppercase mt-4">Calculando Ranking...</p>
                        </div>
                    )}
                </div>

                {activeTab === 'CHAT' && (
                    <div className="p-4 border-t border-white/5 pb-20 lg:pb-4">
                        <input
                            type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                            placeholder="Escribe un mensaje..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white outline-none"
                        />
                    </div>
                )}
            </div>

            {/* 3. Wallet Drawer (Same as Trading) */}
            <div className={`fixed inset-0 z-[200] lg:hidden transition-all duration-500 ${isWalletOpen ? 'visible' : 'invisible pointer-events-none'}`}>
                <div className={`absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-500 ${isWalletOpen ? 'opacity-100' : 'opacity-0'}`} onClick={() => setIsWalletOpen(false)} />
                <div className={`absolute bottom-0 left-0 right-0 bg-[#0a0a0c] border-t border-white/10 rounded-t-[3rem] max-h-[90vh] overflow-y-auto transition-transform duration-500 transform ${isWalletOpen ? 'translate-y-0' : 'translate-y-full'}`}>
                    <div className="sticky top-0 bg-[#0a0a0c] p-6 flex justify-between items-center border-b border-white/5 z-50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
                                <Wallet size={20} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-white uppercase tracking-tighter">GESTIÓN DE CARTERA</h3>
                                <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.2em]">Depósitos, Retiros y Envíos</p>
                            </div>
                        </div>
                        <button onClick={() => setIsWalletOpen(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400"><X /></button>
                    </div>
                    <div className="p-6">
                        <CreditPanel userId={user.id} creditBalance={walletBalance} mainBalance={0} onRefresh={onUpdateBalance} addNotification={() => { }} />
                    </div>
                </div>
            </div>

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
                .scrollbar-hide::-webkit-scrollbar { display: none; }
            `}</style>
        </div>
    );
}
