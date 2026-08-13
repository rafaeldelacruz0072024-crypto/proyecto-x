import React, { useState, useEffect, useCallback, useRef } from "react";
import TradingChart from "./TradingChart";
import {
    TrendingUp,
    TrendingDown,
    Clock,
    User,
    Trophy,
    History,
    Settings,
    MessageSquare,
    Plus,
    Minus,
    AlertTriangle,
    LayoutGrid,
    Play,
    Wallet,
    X
} from "lucide-react";
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { Game } from '../types';
import PlinkoGame from "./PlinkoGame";
import NovaDigitalCrash from "./NovaDigitalCrash";
import LiveWallet from './LiveWallet';
import CreditPanel from './CreditPanel';


// --- Types ---
type Phase = "BETTING" | "LOCKED";
type Direction = "UP" | "DOWN";
type Bet = { amount: number; direction: Direction };
type PricePoint = { time: number; price: number; label: string };
type RoundHistory = {
    id: number;
    startPrice: number;
    strikePrice: number;
    closePrice: number;
    bet: Bet | null;
    won: boolean | null;
    payout: number | null;
    timestamp: number;
};
type ChatMessage = {
    id: number;
    user: string;
    text: string;
    timestamp: number;
};
type SidebarTab = "LEADERBOARD" | "HISTORY" | "CHAT";

// --- Constants ---
const ROUND_DURATION = 30; // 15s betting + 15s locked
const BETTING_DURATION = 15; // Time allowed for betting
const INITIAL_PRICE = 96450.50; // Use a more realistic BTC price maybe?
const VOLATILITY = 20; // Max price change per tick

export default function GamesPanel({ user, walletBalance, onUpdateBalance }: { user: any, walletBalance: number, onUpdateBalance: () => void }) {
    const { t } = useTranslation();
    const [selectedGame, setSelectedGame] = useState<Game | null>(null);
    const [games, setGames] = useState<Game[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchGames();
    }, []);

    async function fetchGames() {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('games')
                .select('*')
                .eq('is_active', true);

            if (error) throw error;
            console.log("Fetched games:", data);
            setGames(data || []);
        } catch (err) {
            console.error('Error fetching games:', err);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
                <div className="w-12 h-12 border-4 border-proyecto-accent border-t-transparent rounded-full animate-spin"></div>
                <p className="text-proyecto-accent font-mono-tech animate-pulse uppercase tracking-[0.3em]">{t('common.loading')}</p>
            </div>
        );
    }

    if (!selectedGame) {
        return (
            <>
                <div className="flex justify-between items-center mb-6">
                    <p className="text-[8px] font-mono-tech text-proyecto-accent/40 uppercase tracking-[0.4em]">SYSTEM_MOD_GAMES_V2.0.1</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {games.map(game => (
                        <div key={game.id} className="bg-black/40 backdrop-blur-xl border border-white/5 p-6 clip-corner group hover:border-proyecto-accent/30 transition-all cursor-pointer" onClick={() => setSelectedGame(game)}>
                            <div className="h-40 bg-slate-900/50 mb-4 clip-corner-sm relative overflow-hidden">
                                {game.image_url || (game.title?.toLowerCase().includes('trading') ? 'https://bzyfubrqlnyvymzquuzv.supabase.co/storage/v1/object/public/games/trading_game_thumb.png' : '') ? (
                                    <img
                                        src={game.image_url || (game.title?.toLowerCase().includes('trading') ? 'https://bzyfubrqlnyvymzquuzv.supabase.co/storage/v1/object/public/games/trading_game_thumb.png' : '')}
                                        alt={game.title}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-proyecto-accent/20">
                                        <LayoutGrid size={48} />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-4">
                                    <span className="text-[10px] bg-proyecto-accent/20 text-proyecto-accent px-2 py-0.5 rounded uppercase font-bold tracking-widest">{game.category}</span>
                                </div>
                            </div>
                            <h3 className="text-xl font-orbitron font-bold text-white mb-1 uppercase group-hover:text-proyecto-accent transition-colors">{game.title}</h3>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-3 font-bold">{game.category}</p>
                            <p className="text-xs text-slate-400 mb-6 line-clamp-2 leading-relaxed">
                                {game.title?.toLowerCase().includes('plinko')
                                    ? "Lanza la bola y deja que el azar decida tu premio según el multiplicador donde caiga. Ajusta el riesgo para mayores ganancias."
                                    : game.title?.toLowerCase().includes('crash')
                                        ? "Maximiza tu capital en segundos. Un juego de alta velocidad donde el objetivo es retirar tus ganancias antes de que el multiplicador explote."
                                        : "Predice si el precio del Bitcoin subirá o bajará en los próximos 10 segundos. ¡Gana el 90% de tu apuesta al instante!"}
                            </p>
                            <button className="w-full py-3 bg-proyecto-brand text-white font-bold uppercase tracking-widest text-[10px] clip-corner-sm flex items-center justify-center gap-2 group-hover:shadow-neon-cyan transition-all">
                                <Play size={14} fill="currentColor" /> {t('games.play_now')}
                            </button>
                        </div>
                    ))}
                </div>
            </>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <button
                onClick={() => setSelectedGame(null)}
                className="text-xs text-slate-500 hover:text-white flex items-center gap-2 uppercase tracking-widest mb-2 w-fit transition-colors"
            >
                <LayoutGrid size={14} /> Back to Games
            </button>

            {selectedGame.title?.trim().toLowerCase() === 'crypto trading game' ? (
                <TradingGameEngine
                    user={user}
                    walletBalance={walletBalance}
                    onUpdateBalance={onUpdateBalance}
                    maxBet={selectedGame.max_bet || 100}
                />
            ) : selectedGame.title?.trim().toLowerCase() === 'plinko premium' ? (
                <PlinkoGame
                    user={user}
                    walletBalance={walletBalance}
                    onUpdateBalance={onUpdateBalance}
                    maxBet={selectedGame.max_bet || 100}
                />
            ) : selectedGame.title?.trim().toLowerCase() === 'nova-digital crash' ? (
                <NovaDigitalCrash
                    user={user}
                    walletBalance={walletBalance}
                    onUpdateBalance={onUpdateBalance}
                    maxBet={selectedGame.max_bet || 100}
                />
            ) : (
                <div className="p-12 text-center bg-black/40 border border-white/5 clip-corner">
                    <h2 className="text-2xl font-orbitron font-bold text-white mb-4 uppercase">{selectedGame.title}</h2>
                    <p className="text-slate-400 mb-8">This game type is coming soon or handled externally.</p>
                    <p className="text-[8px] text-slate-600 font-mono">DEBUG_TITLE: "{selectedGame.title}"</p>
                    {selectedGame.game_url && (
                        <a href={selectedGame.game_url} target="_blank" rel="noopener noreferrer" className="px-8 py-3 bg-proyecto-accent text-white font-bold uppercase tracking-widest clip-corner-sm">
                            Open Project
                        </a>
                    )}
                </div>
            )}
        </div>
    );
}

function TradingGameEngine({ user, walletBalance, onUpdateBalance, maxBet }: { user: any, walletBalance: number, onUpdateBalance: () => void, maxBet: number }) {
    const { t } = useTranslation();

    // --- Game State ---
    const [balance, setBalance] = useState(walletBalance);
    const [stake, setStake] = useState(10);
    const [selectedChip, setSelectedChip] = useState<number>(10);
    const [currentBet, setCurrentBet] = useState<Bet | null>(null);

    // --- Market State ---
    const [currentPrice, setCurrentPrice] = useState(INITIAL_PRICE);
    const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);

    // --- Round State ---
    const [timeLeft, setTimeLeft] = useState(ROUND_DURATION);
    const [phase, setPhase] = useState<Phase>("BETTING");
    const [startPrice, setStartPrice] = useState<number>(INITIAL_PRICE);
    const [strikePrice, setStrikePrice] = useState<number | null>(null);
    const [history, setHistory] = useState<RoundHistory[]>([]);
    const [showChipSelector, setShowChipSelector] = useState(false);
    const [showMobileHistory, setShowMobileHistory] = useState(false);
    const [lastWinAmount, setLastWinAmount] = useState<number | null>(null);
    const [showWinNotification, setShowWinNotification] = useState(false);
    const [isWalletOpen, setIsWalletOpen] = useState(false);
    const [dbHistory, setDbHistory] = useState<any[]>([]);

    // --- Sidebar State ---
    const [activeTab, setActiveTab] = useState<SidebarTab>("CHAT");
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
        { id: 1, user: "System", text: "Welcome to the trading chat!", timestamp: Date.now() }
    ]);
    const [chatInput, setChatInput] = useState("");

    // Update local balance when prop changes
    useEffect(() => {
        setBalance(walletBalance);
    }, [walletBalance]);

    useEffect(() => {
        const fetchHistory = async () => {
            const { data } = await supabase
                .from('transactions')
                .select('*')
                .eq('user_id', user.id)
                .in('type', ['GAME_WIN', 'GAME_STAKE'])
                .ilike('description', '%Trading%')
                .order('created_at', { ascending: false })
                .limit(20);
            if (data) setDbHistory(data);
        };
        if (user?.id) fetchHistory();
    }, [user?.id, walletBalance]);

    // --- Helper: Generate Random Walk ---
    const generateNextPrice = useCallback((current: number) => {
        const change = (Math.random() - 0.5) * 2 * VOLATILITY;
        return Number((current + change).toFixed(2));
    }, []);

    // --- Refs for intervals ---
    const tickRef = useRef<NodeJS.Timeout | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // --- Initialize History ---
    useEffect(() => {
        const initialHistory: PricePoint[] = [];
        let p = INITIAL_PRICE;
        const now = Date.now();
        for (let i = 60; i >= 0; i--) {
            p = generateNextPrice(p);
            initialHistory.push({
                time: now - i * 1000,
                price: p,
                label: new Date(now - i * 1000).toLocaleTimeString([], {
                    minute: "2-digit",
                    second: "2-digit",
                }),
            });
        }
        setPriceHistory(initialHistory);
        setCurrentPrice(p);
        setStartPrice(p);
    }, [generateNextPrice]);

    // --- Game Loop ---
    useEffect(() => {
        tickRef.current = setInterval(() => {
            setCurrentPrice((prev) => {
                const next = generateNextPrice(prev);
                setPriceHistory((history) => {
                    const now = Date.now();
                    const newPoint = {
                        time: now,
                        price: next,
                        label: new Date(now).toLocaleTimeString([], {
                            minute: "2-digit",
                            second: "2-digit",
                        }),
                    };
                    return [...history.slice(-60), newPoint];
                });
                return next;
            });
        }, 1000);

        timerRef.current = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) return ROUND_DURATION;
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (tickRef.current) clearInterval(tickRef.current);
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [generateNextPrice]);

    const handleChipClick = (val: number) => {
        if (phase !== 'BETTING' || currentBet) return;
        setStake(prev => {
            const next = Number((prev + val).toFixed(2));
            return next > maxBet ? maxBet : next;
        });
    };

    const handleDouble = () => {
        if (currentBet) return;
        setStake(prev => {
            const next = Number((prev * 2).toFixed(2));
            return next > maxBet ? maxBet : next;
        });
    };

    const handleUndo = () => {
        if (currentBet) return;
        setStake(0);
    };

    // --- Round Logic ---
    useEffect(() => {
        if (timeLeft === ROUND_DURATION - BETTING_DURATION) {
            setPhase("LOCKED");
            setStrikePrice(currentPrice);
        } else if (timeLeft === ROUND_DURATION) {
            setPhase("BETTING");
            setStartPrice(currentPrice);

            // Resolve bet
            if (currentBet && strikePrice !== null) {
                const win = (currentBet.direction === "UP" && currentPrice > strikePrice) ||
                    (currentBet.direction === "DOWN" && currentPrice < strikePrice);

                if (win) {
                    const winAmount = currentBet.amount * 1.84;
                    handleWin(winAmount);
                    setLastWinAmount(winAmount);
                    setShowWinNotification(true);
                    setTimeout(() => setShowWinNotification(false), 5000);
                }

                setHistory(prev => [{
                    id: Date.now(),
                    startPrice,
                    strikePrice,
                    closePrice: currentPrice,
                    bet: currentBet,
                    won: win,
                    payout: win ? currentBet.amount * 1.84 : 0,
                    timestamp: Date.now()
                }, ...prev]);
            } else if (strikePrice !== null) {
                // Just record history if no bet
                setHistory(prev => [{
                    id: Date.now(),
                    startPrice,
                    strikePrice,
                    closePrice: currentPrice,
                    bet: null,
                    won: null,
                    payout: null,
                    timestamp: Date.now()
                }, ...prev]);
            }

            setCurrentBet(null);
            setStrikePrice(null);
        }
    }, [timeLeft]);

    async function handlePlaceBet(direction: Direction) {
        if (phase !== "BETTING" || currentBet || stake > balance || stake <= 0 || stake > maxBet) {
            if (stake > maxBet) alert(`La apuesta máxima es de ${maxBet}$`);
            return;
        }

        try {
            const { data, error } = await supabase.rpc('process_game_bet', {
                p_user_id: user.id,
                p_amount: Number(stake),
                p_game_name: 'Crypto Trading Game'
            });

            if (error) throw error;
            if (data.success) {
                // Optimistic update
                setBalance(prev => prev - Number(stake));
                setCurrentBet({ amount: Number(stake), direction });
                onUpdateBalance(); // Refresh parent balance
            } else {
                alert(data.message || 'Error placing bet');
            }
        } catch (err: any) {
            console.error('Bet error:', err);
            alert(`Error placing bet: ${err.message || 'Network error'}`);
        }
    }

    async function handleWin(payout: number) {
        try {
            const { data, error } = await supabase.rpc('process_game_result', {
                p_user_id: user.id,
                p_amount: Number(payout),
                p_game_name: 'Crypto Trading Game'
            });
            if (error) throw error;
            if (data && !data.success) {
                console.error('Win processing failed:', data.message);
            } else {
                // Optimistic update
                setBalance(prev => prev + Number(payout));
            }
            onUpdateBalance();
        } catch (err: any) {
            console.error('Payout error:', err);
        }
    }

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 2,
        }).format(val);
    };

    const isUp = currentPrice >= (phase === "LOCKED" && strikePrice !== null ? strikePrice : startPrice);

    return (
        <div className="flex flex-col lg:flex-row h-full bg-[#0a0a0c] text-white min-h-[600px] mb-20 lg:mb-0">
            {/* 1. Main Column: Game + Local Controls */}
            <div className="flex-1 flex flex-col overflow-hidden relative border-r border-white/5">
                {/* Main Game & Controls Container */}
                <div className="flex-1 flex flex-col overflow-hidden relative">
                    {/* Header Controls */}
                    <div className="absolute top-0 left-0 right-0 z-[60] p-4 lg:p-6 flex justify-center items-start pointer-events-none">
                        <div className="bg-black/60 backdrop-blur-md p-3 px-5 rounded-2xl border border-white/10 shadow-2xl pointer-events-auto">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-proyecto-accent/20 flex items-center justify-center border border-proyecto-accent/30 shadow-neon-cyan">
                                    <TrendingUp className="text-proyecto-accent" size={16} />
                                </div>
                                <div>
                                    <h3 className="text-[10px] font-black text-proyecto-accent uppercase tracking-widest leading-none mb-1">Mercado Live</h3>
                                    <p className="text-lg font-black text-white italic tracking-tighter leading-none">BTC / USD</p>
                                </div>
                                <div className="ml-4 pl-4 border-l border-white/10">
                                    <p className="text-xl font-black text-white font-mono tracking-tighter">
                                        {currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Winners Overlay (Top Left) */}
                    <div className="absolute top-4 left-4 z-40 bg-black/40 backdrop-blur-md rounded-xl border border-white/5 p-3 w-48 space-y-2 hidden lg:block">
                        <p className="text-[9px] font-black text-yellow-500 uppercase tracking-widest mb-2 border-b border-white/5 pb-1">VENDIDAS</p>
                        {[
                            { name: "mathiasmor**", win: "+90%", amount: "0,05 $" },
                            { name: "zByObsessi**", win: "+90%", amount: "0,05 $" },
                            { name: "93913590", win: "+84%", amount: "1,88 $" }
                        ].map((winner, i) => (
                            <div key={i} className="flex justify-between items-center text-[8px] font-bold">
                                <span className="text-slate-400 capitalize">{winner.name}</span>
                                <div className="flex items-center gap-1">
                                    <span className="text-proyecto-green">{winner.win}</span>
                                    <span className="text-white/80">{winner.amount}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Win Notification Overlay */}
                    {showWinNotification && (
                        <div className="absolute inset-0 z-[150] flex items-center justify-center animate-in fade-in zoom-in duration-500 bg-black/60 backdrop-blur-sm">
                            <div className="text-center p-8 lg:p-10 rounded-[2.5rem] bg-gradient-to-b from-proyecto-green/20 to-black border-2 border-proyecto-green/40 shadow-neon-green relative overflow-hidden max-w-[90%] lg:max-w-md">
                                {/* Celebration Effect */}
                                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                                    {Array.from({ length: 15 }).map((_, i) => (
                                        <div
                                            key={i}
                                            className="absolute w-1.5 h-1.5 rounded-full bg-proyecto-green animate-ping opacity-20"
                                            style={{
                                                top: `${Math.random() * 100}%`,
                                                left: `${Math.random() * 100}%`,
                                                animationDelay: `${Math.random() * 2}s`
                                            }}
                                        />
                                    ))}
                                </div>

                                <Trophy className="mx-auto mb-4 text-proyecto-green drop-shadow-neon" size={56} />
                                <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter mb-1">¡APUESTA GANADA!</h2>
                                <div className="h-0.5 w-16 bg-proyecto-green mx-auto mb-4"></div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Pago Total</p>
                                <p className="text-4xl font-black text-proyecto-green shadow-neon-green">
                                    {lastWinAmount !== null ? formatCurrency(lastWinAmount) : '$0.00'}
                                </p>
                                <button
                                    onClick={() => setShowWinNotification(false)}
                                    className="mt-8 px-10 py-3 bg-proyecto-green text-black font-black uppercase tracking-widest rounded-full hover:scale-105 transition-transform shadow-xl text-xs"
                                >
                                    Excelente
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Active Bet Indicator (New) */}
                    {currentBet && (
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] animate-in zoom-in duration-300">
                            <div className={`px-6 py-3 rounded-full backdrop-blur-xl border-2 flex items-center gap-3 shadow-2xl ${currentBet.direction === 'UP' ? 'bg-proyecto-green/20 border-proyecto-green/50' : 'bg-red-500/20 border-red-500/50'}`}>
                                <div className={`w-3 h-3 rounded-full animate-pulse ${currentBet.direction === 'UP' ? 'bg-proyecto-green shadow-neon-green' : 'bg-red-500 shadow-neon-red'}`}></div>
                                <span className="text-sm font-black uppercase tracking-tighter text-white">
                                    POSICIÓN {currentBet.direction === 'UP' ? 'ALZA' : 'BAJA'} ACTIVA
                                </span>
                                <span className="bg-white/10 px-2 py-0.5 rounded text-[10px] font-mono text-white">${currentBet.amount.toFixed(2)}</span>
                            </div>
                        </div>
                    )}

                    {/* Main Chart */}
                    <div className="flex-1 bg-black/20">
                        <TradingChart
                            data={priceHistory}
                            isUp={isUp}
                            currentPrice={currentPrice}
                            timeLeft={timeLeft}
                            phase={phase}
                            startPrice={startPrice}
                            strikePrice={strikePrice}
                        />

                        {/* Phase Overlay (Floating Circular Timer) */}
                        <div className="absolute top-4 right-4 z-[60]">
                            <div className="relative w-20 h-20 bg-black/60 backdrop-blur-md rounded-full border border-white/10 flex items-center justify-center shadow-2xl overflow-hidden group">
                                {/* SVG Timer Progress */}
                                <svg className="absolute inset-0 w-full h-full -rotate-90">
                                    <circle
                                        cx="40"
                                        cy="40"
                                        r="36"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                        fill="transparent"
                                        className="text-white/5"
                                    />
                                    <circle
                                        cx="40"
                                        cy="40"
                                        r="36"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                        fill="transparent"
                                        strokeDasharray="226"
                                        strokeDashoffset={226 - (226 * (phase === 'BETTING' ? (timeLeft - 15) / 15 : timeLeft / 15))}
                                        className={`transition-all duration-1000 ease-linear ${phase === 'BETTING' ? 'text-proyecto-accent shadow-neon-cyan' : 'text-red-500 shadow-neon-red'}`}
                                        strokeLinecap="round"
                                    />
                                </svg>

                                <div className="text-center z-10">
                                    <p className={`text-[10px] font-black uppercase tracking-tighter leading-none mb-1 ${phase === 'BETTING' ? 'text-proyecto-accent' : 'text-red-500'}`}>
                                        {phase === 'BETTING' ? 'Apuesta' : 'Cierre'}
                                    </p>
                                    <p className="text-2xl font-black text-white font-mono leading-none">
                                        {phase === 'BETTING' ? timeLeft - 15 : timeLeft}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Mobile Sentiment Bar (Right under chart) */}
                <div className="lg:hidden h-10 w-full flex items-center px-4 bg-black/40 border-y border-white/5">
                    <div className="flex-1 flex items-center gap-2 text-proyecto-green text-[10px] font-black">
                        <TrendingUp size={10} />
                        <span>MERCADO EN ALZA (+2.4%)</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-proyecto-green shadow-neon-green"></div>
                        <span className="text-[9px] text-slate-500 font-bold">LIVE</span>
                    </div>
                </div>

                {/* Betting Controls Area */}
                <div className="bg-[#141416] p-4 lg:p-8 pb-10 lg:pb-8 space-y-4 safe-bottom">
                    {/* PC View Betting UI (Visible on LG up) */}
                    <div className="hidden lg:flex items-center justify-between gap-6">
                        <div className="flex-1 space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Inversión por operación</label>
                            <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-2xl p-2 h-16">
                                <button onClick={() => setStake(Math.max(1, stake - 10))} className="w-12 h-full rounded-xl bg-white/5 flex items-center justify-center text-white hover:bg-white/10 transition-colors">
                                    <Minus size={18} />
                                </button>
                                <div className="flex-1 text-center">
                                    <span className="text-2xl font-black text-white">{stake.toFixed(2)} $</span>
                                </div>
                                <button onClick={() => setStake(stake + 10)} className="w-12 h-full rounded-xl bg-white/5 flex items-center justify-center text-white hover:bg-white/10 transition-colors">
                                    <Plus size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => handlePlaceBet('UP')}
                                disabled={phase !== 'BETTING' || !!currentBet || balance < stake || stake <= 0}
                                className={`h-24 px-12 rounded-[2rem] flex flex-col items-center justify-center gap-2 font-black italic text-xl transition-all shadow-xl active:scale-95 ${phase === 'BETTING' && !currentBet && balance >= stake && stake > 0 ? 'bg-[#3d6e53] text-white border-b-4 border-green-700 shadow-neon-green hover:brightness-110' : 'bg-white/5 text-slate-600 border-none opacity-50 grayscale pointer-events-none'}`}
                            >
                                <TrendingUp size={24} />
                                ALZA
                            </button>
                            <button
                                onClick={() => handlePlaceBet('DOWN')}
                                disabled={phase !== 'BETTING' || !!currentBet || balance < stake || stake <= 0}
                                className={`h-24 px-12 rounded-[2rem] flex flex-col items-center justify-center gap-2 font-black italic text-xl transition-all shadow-xl active:scale-95 ${phase === 'BETTING' && !currentBet && balance >= stake && stake > 0 ? 'bg-[#924b4b] text-white border-b-4 border-red-800 shadow-neon-red hover:brightness-110' : 'bg-white/5 text-slate-600 border-none opacity-50 grayscale pointer-events-none'}`}
                            >
                                <TrendingDown size={24} />
                                BAJA
                            </button>
                        </div>
                    </div>

                    {/* Mobile View Betting UI (Visible under LG) */}
                    <div className="lg:hidden flex flex-col gap-4">
                        {/* Row 1: Wallet & Stake Selection */}
                        <div className="flex justify-between items-center gap-4">
                            {/* Wallet Display */}
                            <div
                                onClick={() => setIsWalletOpen(true)}
                                className="group flex-1 h-16 bg-[#1c1c1e] border border-white/5 rounded-3xl px-4 flex flex-col items-start justify-center cursor-pointer active:bg-white/5 transition-all relative overflow-hidden"
                            >
                                <div className="flex items-center gap-1.5 mb-0.5">
                                    <div className="w-4 h-4 rounded bg-proyecto-accent/20 flex items-center justify-center text-proyecto-accent">
                                        <Wallet size={10} />
                                    </div>
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">CARTERA</span>
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-lg font-black text-white group-active:text-proyecto-accent">{formatCurrency(balance).replace('$', '')}</span>
                                    <span className="text-xs text-slate-400">$</span>
                                </div>
                                <span className="text-[7px] text-slate-600 italic mt-1 font-bold uppercase">Tap to refresh</span>
                            </div>

                            {/* Stake Display/Toggle */}
                            <div className="relative">
                                {showChipSelector && (
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 bg-[#1c1c1e] border-2 border-white/10 p-4 rounded-[2rem] shadow-2xl z-50 w-64 animate-in slide-in-from-bottom duration-300">
                                        <div className="grid grid-cols-3 gap-3">
                                            {[1, 5, 10, 25, 50, 100, 250, 500, 1000].filter(v => v <= maxBet).map(v => (
                                                <button
                                                    key={v}
                                                    onClick={() => { setStake(v); setShowChipSelector(false); }}
                                                    className={`h-11 rounded-full border-2 border-white/10 flex items-center justify-center text-[10px] font-black transition-all active:scale-90 ${stake === v ? 'bg-proyecto-accent border-proyecto-accent shadow-neon-cyan text-white' : 'bg-black/40 text-slate-400 hover:text-white hover:bg-white/5'}`}
                                                >
                                                    {v < 1000 ? v : `${(v / 1000).toFixed(0)}K`}
                                                </button>
                                            ))}
                                            {/* Always show the max bet if it's not in the standard list */}
                                            {![1, 5, 10, 25, 50, 100, 250, 500, 1000].includes(maxBet) && (
                                                <button
                                                    onClick={() => { setStake(maxBet); setShowChipSelector(false); }}
                                                    className={`h-11 rounded-full border-2 border-white/10 flex items-center justify-center text-[10px] font-black transition-all active:scale-90 ${stake === maxBet ? 'bg-proyecto-accent border-proyecto-accent shadow-neon-cyan text-white' : 'bg-black/40 text-slate-400 hover:text-white hover:bg-white/5'}`}
                                                >
                                                    {maxBet}
                                                </button>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => setShowChipSelector(false)}
                                            className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-2 hover:text-white"
                                        >
                                            Cerrar
                                        </button>
                                    </div>
                                )}

                                <button
                                    onClick={() => setShowChipSelector(!showChipSelector)}
                                    className={`w-16 h-16 rounded-full bg-[#2c2c2e] border-4 border-[#3a3a3c] flex flex-col items-center justify-center shadow-2xl active:scale-95 transition-all relative ${showChipSelector ? 'ring-2 ring-proyecto-accent/50' : ''}`}
                                >
                                    <span className="text-[10px] font-black text-white">{stake.toFixed(2)}</span>
                                    <div className="w-10 h-10 border-2 border-white/10 rounded-full flex items-center justify-center mt-0.5">
                                        <div className="w-6 h-6 border-2 border-dashed border-white/5 rounded-full"></div>
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* Row 2: ALZA & BAJA Side-by-Side */}
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => handlePlaceBet('UP')}
                                disabled={phase !== 'BETTING' || !!currentBet || balance < stake || stake <= 0}
                                className={`py-5 rounded-3xl flex flex-col items-center justify-center gap-1 transition-all relative overflow-hidden active:scale-95 shadow-lg ${phase === 'BETTING' && !currentBet && balance >= stake && stake > 0 ? 'bg-[#3d6e53] border border-green-400/30 hover:brightness-110' : 'bg-white/5 opacity-40 grayscale pointer-events-none'}`}
                            >
                                <span className="text-xs font-black tracking-[0.3em] text-white/90">ALZA</span>
                                <TrendingUp size={18} className="text-white animate-bounce-short" />
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border border-white/20 bg-black/20 flex items-center justify-center">
                                    <div className="w-4 h-4 rounded-full border-2 border-dashed border-white/10"></div>
                                </div>
                            </button>

                            <button
                                onClick={() => handlePlaceBet('DOWN')}
                                disabled={phase !== 'BETTING' || !!currentBet || balance < stake || stake <= 0}
                                className={`py-5 rounded-3xl flex flex-col items-center justify-center gap-1 transition-all relative overflow-hidden active:scale-95 shadow-lg ${phase === 'BETTING' && !currentBet && balance >= stake && stake > 0 ? 'bg-[#924b4b] border border-red-400/30 hover:brightness-110' : 'bg-white/5 opacity-40 grayscale pointer-events-none'}`}
                            >
                                <span className="text-xs font-black tracking-[0.3em] text-white/90">BAJA</span>
                                <TrendingDown size={18} className="text-white" />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border border-white/20 bg-black/20 flex items-center justify-center">
                                    <div className="w-4 h-4 rounded-full border-2 border-dashed border-white/10"></div>
                                </div>
                            </button>
                        </div>

                        {/* Row 3: Action Bar (Floating circular buttons) */}
                        <div className="flex items-center justify-between px-2 pt-2 relative z-[60]">
                            {/* Undo */}
                            <button onClick={handleUndo} className="w-12 h-12 rounded-full bg-[#1c1c1e] border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all active:scale-95 hover:bg-white/5">
                                <Plus size={16} className="rotate-45" />
                            </button>

                            {/* Focus Chip Toggle (Center) */}
                            <button className="w-14 h-14 rounded-full bg-proyecto-accent/20 border-2 border-proyecto-accent/40 flex items-center justify-center text-proyecto-accent shadow-neon-cyan animate-pulse">
                                <Plus size={24} />
                            </button>

                            {/* Double */}
                            <button onClick={handleDouble} className="w-12 h-12 rounded-full bg-[#1c1c1e] border border-white/10 flex items-center justify-center text-white/80 font-black text-xs hover:text-white transition-all active:scale-95 hover:bg-white/5">
                                ×2
                            </button>

                            {/* Menu/History toggle */}
                            <button
                                onClick={() => setShowMobileHistory(true)}
                                className={`w-12 h-12 rounded-full border border-white/10 flex items-center justify-center transition-all active:scale-95 ${showMobileHistory ? 'bg-proyecto-accent text-white' : 'bg-[#1c1c1e] text-slate-400'}`}
                            >
                                <div className="flex flex-col gap-1 items-center">
                                    <div className="w-4 h-0.5 bg-current"></div>
                                    <div className="w-4 h-0.5 bg-current"></div>
                                    <div className="w-4 h-0.5 bg-current"></div>
                                </div>
                            </button>
                        </div>

                        {/* Information Footer */}
                        <div className="flex flex-col gap-1 pt-2">
                            <div className="flex justify-between items-center text-[9px] font-black tracking-widest text-[#76b852]">
                                <p>Daniel: Hola, Gentecash. Te damos la bienvenida a ...</p>
                            </div>
                            <div className="flex justify-between items-end">
                                <div className="flex flex-col">
                                    <p className="text-[10px] text-white font-black uppercase">Apuesta total <span className="text-yellow-500">{stake.toFixed(2)} $</span></p>
                                    <p className="text-[10px] text-white font-black uppercase">Saldo <span className="text-proyecto-green">{balance.toFixed(2)} $</span></p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[8px] text-slate-500 font-mono tracking-tighter">00:16 | # 04:16:22</p>
                                    <p className="text-[10px] text-yellow-500 font-black uppercase">Stock Market <span className="text-white">0,10 - 5000 $</span></p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. Sidebar (History/Chat) - Desktop: Column, Mobile: Targetable Overlay */}
            <div className={`
                lg:w-80 lg:flex lg:flex-col bg-black/40 border-l border-white/5
                ${showMobileHistory ? 'fixed inset-0 z-[120] flex flex-col bg-black/95 animate-in slide-in-from-right duration-300' : 'hidden lg:flex'}
            `}>
                {/* Header for Mobile Overlay */}
                <div className="lg:hidden flex justify-between items-center p-4 border-b border-white/10">
                    <h3 className="font-orbitron font-black text-sm uppercase tracking-widest text-proyecto-accent">Panel de Control</h3>
                    <button onClick={() => { setShowMobileHistory(false); setActiveTab('CHAT'); }} className="text-slate-400">
                        <History size={20} className="rotate-180" />
                    </button>
                </div>

                <div className="flex border-b border-white/5">
                    <button
                        onClick={() => setActiveTab('CHAT')}
                        className={`flex-1 py-4 text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'CHAT' ? 'text-proyecto-accent bg-proyecto-accent/5 border-b border-proyecto-accent' : 'text-slate-500 hover:text-white'}`}
                    >
                        Chat
                    </button>
                    <button
                        onClick={() => setActiveTab('HISTORY')}
                        className={`flex-1 py-4 text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'HISTORY' ? 'text-proyecto-accent bg-proyecto-accent/5 border-b border-proyecto-accent' : 'text-slate-500 hover:text-white'}`}
                    >
                        Historial
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {activeTab === 'CHAT' ? (
                        <div className="space-y-4">
                            {chatMessages.map(msg => (
                                <div key={msg.id} className="space-y-1">
                                    <div className="flex justify-between items-center">
                                        <span className={`text-[10px] font-bold ${msg.user === 'System' ? 'text-proyecto-brand' : 'text-slate-300'}`}>{msg.user}</span>
                                        <span className="text-[8px] text-slate-600">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <p className="text-xs text-slate-400 leading-relaxed font-bold">{msg.text}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {dbHistory.length > 0 ? dbHistory.map((tx) => (
                                <div key={tx.id} className="p-3 bg-white/5 border border-white/5 rounded-xl flex justify-between items-center group hover:bg-white/10 transition-all">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[8px] font-bold p-1 rounded ${tx.amount > 0 ? 'bg-proyecto-green/20 text-proyecto-green' : 'bg-red-500/20 text-red-500'}`}>
                                                {tx.amount > 0 ? 'WIN' : 'BET'}
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-mono-tech">{new Date(tx.created_at).toLocaleTimeString()}</span>
                                        </div>
                                    </div>
                                    <p className={`text-[10px] font-bold ${tx.amount > 0 ? 'text-proyecto-green font-mono' : 'text-slate-300 font-mono'}`}>
                                        {tx.amount > 0 ? `+$${tx.amount.toFixed(2)}` : `-$${Math.abs(tx.amount).toFixed(2)}`}
                                    </p>
                                </div>
                            )) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-2 opacity-50 py-10">
                                    <History size={24} />
                                    <span className="text-[10px] font-black uppercase">Sin historial</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {activeTab === 'CHAT' && (
                    <div className="p-4 border-t border-white/5 pb-20 lg:pb-4">
                        <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder="Escribe un mensaje..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-proyecto-accent/50 transition-all font-bold"
                        />
                    </div>
                )}
            </div>

            {/* 3. Wallet Drawer (Mobile Overlay) */}
            <div className={`fixed inset-0 z-[200] lg:hidden transition-all duration-500 ${isWalletOpen ? 'visible' : 'invisible pointer-events-none'}`}>
                {/* Backdrop */}
                <div
                    className={`absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-500 ${isWalletOpen ? 'opacity-100' : 'opacity-0'}`}
                    onClick={() => setIsWalletOpen(false)}
                />

                {/* Drawer Content */}
                <div className={`absolute bottom-0 left-0 right-0 bg-[#0a0a0c] border-t border-white/10 rounded-t-[3rem] max-h-[90vh] overflow-y-auto transition-transform duration-500 transform ${isWalletOpen ? 'translate-y-0' : 'translate-y-full'}`}>
                    <div className="sticky top-0 bg-[#0a0a0c] p-6 flex justify-between items-center border-b border-white/5 z-50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-proyecto-accent/10 border border-proyecto-accent/20 flex items-center justify-center text-proyecto-accent">
                                <Wallet size={20} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-white uppercase tracking-tighter">GESTIÓN DE CARTERA</h3>
                                <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.2em]">Depósitos, Retiros y Envíos</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsWalletOpen(false)}
                            className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="p-6">
                        <CreditPanel
                            userId={user.id}
                            creditBalance={balance}
                            mainBalance={0}
                            onRefresh={() => {
                                onUpdateBalance();
                            }}
                            addNotification={() => { }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
