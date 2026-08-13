import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
    AreaChart, Area, XAxis, YAxis, Tooltip,
    ResponsiveContainer, ReferenceLine,
} from 'recharts';
import {
    TrendingUp, TrendingDown, Zap, Clock,
    CheckCircle, AlertTriangle, RefreshCw, Activity,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────
interface Kline {
    time: string;
    price: number;
    open: number;
    high: number;
    low: number;
}

interface PredictionOption { id: string; label: string; pool: number; }

interface PredictionMarket {
    id: string; title: string;
    options: PredictionOption[];
    total_pool: number; status: string;
    closes_at: string; house_fee_pct: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────
const PAIRS = [
    { symbol: 'BTCUSDT', label: 'BTC', icon: '₿', color: '#f7931a' },
    { symbol: 'ETHUSDT', label: 'ETH', icon: 'Ξ', color: '#627eea' },
    { symbol: 'SOLUSDT', label: 'SOL', icon: '◎', color: '#9945ff' },
    { symbol: 'BNBUSDT', label: 'BNB', icon: '◈', color: '#f0b90b' },
];

const COINGECKO_IDS: Record<string, string> = {
    BTCUSDT: 'bitcoin',
    ETHUSDT: 'ethereum',
    SOLUSDT: 'solana',
    BNBUSDT: 'binancecoin',
};

// ─── Countdown ──────────────────────────────────────────────────────────────
function useCountdown(target: string) {
    const [timeLeft, setTimeLeft] = useState('');
    const [urgent, setUrgent] = useState(false);
    useEffect(() => {
        const calc = () => {
            const diff = new Date(target).getTime() - Date.now();
            if (diff <= 0) { setTimeLeft('CERRADO'); setUrgent(false); return; }
            setUrgent(diff < 300000);
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            if (h > 0) setTimeLeft(`${h}h ${m}m ${s.toString().padStart(2,'0')}s`);
            else setTimeLeft(`${m}m ${s.toString().padStart(2,'0')}s`);
        };
        calc();
        const id = setInterval(calc, 1000);
        return () => clearInterval(id);
    }, [target]);
    return { timeLeft, urgent };
}

// ─── Custom tooltip ─────────────────────────────────────────────────────────
const PriceTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-[#050507] border border-white/10 px-3 py-2 text-[10px] font-mono shadow-2xl">
            <p className="text-slate-500 mb-0.5">{label}</p>
            <p className="text-white font-black">
                ${Number(payload[0]?.value).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
export default function CryptoPredictionWidget({
    user, walletBalance, onUpdateBalance,
}: {
    user: any; walletBalance: number; onUpdateBalance: () => void;
}) {
    const [pair, setPair] = useState(PAIRS[0]);
    const [klines, setKlines] = useState<Kline[]>([]);
    const [currentPrice, setCurrentPrice] = useState(0);
    const [change24h, setChange24h] = useState(0);
    const [wsStatus, setWsStatus] = useState<'connecting' | 'live' | 'error'>('connecting');
    const [priceFlash, setPriceFlash] = useState<'up' | 'down' | null>(null);
    const [loading, setLoading] = useState(true);
    const [dataSource, setDataSource] = useState<'binance' | 'coingecko' | 'none'>('binance');
    const [market, setMarket] = useState<PredictionMarket | null>(null);
    const [selectedOption, setSelectedOption] = useState('');
    const [betAmount, setBetAmount] = useState('');
    const [placing, setPlacing] = useState(false);
    const [betResult, setBetResult] = useState<{ success: boolean; message: string } | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const prevRef = useRef(0);

    // ── REST: historical klines ──────────────────────────────────────────
    const fetchKlines = useCallback(async () => {
        // Try Binance first with 4s timeout
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 4000);
            const res = await fetch(
                `https://api.binance.com/api/v3/klines?symbol=${pair.symbol}&interval=1m&limit=90`,
                { signal: controller.signal }
            );
            clearTimeout(timeout);
            const raw: any[][] = await res.json();
            const fmt: Kline[] = raw.map(k => ({
                time: new Date(k[0]).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }),
                price: parseFloat(k[4]),
                open: parseFloat(k[1]),
                high: parseFloat(k[2]),
                low: parseFloat(k[3]),
            }));
            setKlines(fmt);
            const last = fmt[fmt.length - 1];
            if (last) { setCurrentPrice(last.price); prevRef.current = last.price; }
            setDataSource('binance');
            setLoading(false);
            return;
        } catch { /* fall through to CoinGecko */ }

        // CoinGecko fallback
        try {
            const cgId = COINGECKO_IDS[pair.symbol];
            if (!cgId) { setLoading(false); return; }
            const res = await fetch(
                `https://api.coingecko.com/api/v3/coins/${cgId}/market_chart?vs_currency=usd&days=1&interval=hourly`
            );
            const data: { prices: [number, number][] } = await res.json();
            const fmt: Kline[] = data.prices.map(([ts, price]) => ({
                time: new Date(ts).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }),
                price, open: price, high: price, low: price,
            }));
            setKlines(fmt);
            const last = fmt[fmt.length - 1];
            if (last) { setCurrentPrice(last.price); prevRef.current = last.price; }
            setDataSource('coingecko');
            setLoading(false);
        } catch { setDataSource('none'); setLoading(false); }
    }, [pair.symbol]);

    // ── REST: 24h ticker ────────────────────────────────────────────────
    useEffect(() => {
        fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${pair.symbol}`)
            .then(r => r.json())
            .then(d => setChange24h(parseFloat(d.priceChangePercent)))
            .catch(() => {});
    }, [pair.symbol]);

    // ── WebSocket live feed ──────────────────────────────────────────────
    useEffect(() => {
        setLoading(true); setKlines([]); setCurrentPrice(0);
        setDataSource('binance');
        fetchKlines();
        wsRef.current?.close();
        setWsStatus('connecting');

        const ws = new WebSocket(
            `wss://stream.binance.com/ws/${pair.symbol.toLowerCase()}@kline_1m`
        );
        wsRef.current = ws;
        ws.onopen = () => { setWsStatus('live'); setDataSource('binance'); };
        ws.onerror = () => setWsStatus('error');
        ws.onclose = () => setWsStatus('error');

        ws.onmessage = (evt) => {
            const { k } = JSON.parse(evt.data);
            const np = parseFloat(k.c);
            if (np > prevRef.current) { setPriceFlash('up'); }
            else if (np < prevRef.current) { setPriceFlash('down'); }
            prevRef.current = np;
            setTimeout(() => setPriceFlash(null), 500);
            setCurrentPrice(np);
            const nk: Kline = {
                time: new Date(k.t).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }),
                price: np, open: parseFloat(k.o),
                high: parseFloat(k.h), low: parseFloat(k.l),
            };
            setKlines(prev => {
                if (!prev.length) return [nk];
                const upd = [...prev];
                if (upd[upd.length - 1].time === nk.time) { upd[upd.length - 1] = nk; }
                else { upd.push(nk); if (upd.length > 90) upd.shift(); }
                return upd;
            });
        };
        return () => ws.close();
    }, [pair.symbol, fetchKlines]);

    // ── CoinGecko polling (when Binance WS is unavailable) ───────────────
    useEffect(() => {
        if (dataSource !== 'coingecko') return;
        const cgId = COINGECKO_IDS[pair.symbol];
        if (!cgId) return;
        setWsStatus('live'); // Show LIVE indicator for CoinGecko too
        const poll = async () => {
            try {
                const res = await fetch(
                    `https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd&include_24hr_change=true&include_1h_change=true`
                );
                const data = await res.json();
                const np: number = data[cgId]?.usd;
                if (!np) return;
                if (np > prevRef.current) { setPriceFlash('up'); }
                else if (np < prevRef.current) { setPriceFlash('down'); }
                prevRef.current = np;
                setTimeout(() => setPriceFlash(null), 500);
                setCurrentPrice(np);
                const change = data[cgId]?.usd_24h_change;
                if (change != null) setChange24h(change);
                const nk: Kline = {
                    time: new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }),
                    price: np, open: np, high: np, low: np,
                };
                setKlines(prev => {
                    if (!prev.length) return [nk];
                    const upd = [...prev];
                    if (upd[upd.length - 1].time === nk.time) { upd[upd.length - 1] = { ...upd[upd.length - 1], price: np }; }
                    else { upd.push(nk); if (upd.length > 90) upd.shift(); }
                    return upd;
                });
            } catch { /* silent */ }
        };
        poll();
        const id = setInterval(poll, 15000);
        return () => clearInterval(id);
    }, [dataSource, pair.symbol]);

    // ── Fetch active CRYPTO market ───────────────────────────────────────
    useEffect(() => {
        supabase.from('prediction_markets').select('*')
            .eq('status', 'OPEN').eq('category', 'CRYPTO')
            .gt('closes_at', new Date().toISOString())
            .order('closes_at', { ascending: true })
            .limit(1).maybeSingle()
            .then(({ data }) => setMarket(data || null));
    }, []);

    // ── Place bet ────────────────────────────────────────────────────────
    async function placeBet() {
        if (!market || !selectedOption || !betAmount) return;
        const amount = parseFloat(betAmount);
        if (isNaN(amount) || amount < 1) { setBetResult({ success: false, message: 'Mínimo $1' }); return; }
        if (amount > walletBalance) { setBetResult({ success: false, message: 'Saldo insuficiente' }); return; }
        setPlacing(true); setBetResult(null);
        try {
            const { data, error } = await supabase.rpc('place_prediction_bet', {
                p_market_id: market.id, p_option_id: selectedOption, p_amount: amount,
            });
            if (error) throw error;
            if (!data?.success) {
                setBetResult({ success: false, message: data?.error || 'Error al apostar' });
            } else {
                setBetResult({ success: true, message: `✅ ${data.shares.toFixed(4)} shares @ ${(data.price * 100).toFixed(1)}%` });
                setBetAmount(''); setSelectedOption('');
                onUpdateBalance();
                const { data: upd } = await supabase.from('prediction_markets').select('*').eq('id', market.id).single();
                if (upd) setMarket(upd);
            }
        } catch (err: any) { setBetResult({ success: false, message: err.message }); }
        finally { setPlacing(false); }
    }

    // ── Derived values ───────────────────────────────────────────────────
    const firstPrice = klines[0]?.price || currentPrice;
    const isUp = currentPrice >= firstPrice;
    const chartColor = isUp ? '#00ff9d' : '#ff4455';
    const changePct1h = firstPrice > 0 ? ((currentPrice - firstPrice) / firstPrice * 100) : 0;
    const changeAbs1h = currentPrice - firstPrice;

    const priceColorClass =
        priceFlash === 'up' ? 'text-green-300' :
        priceFlash === 'down' ? 'text-rose-300' :
        isUp ? 'text-green-400' : 'text-rose-400';

    const glowStyle = priceFlash
        ? { textShadow: `0 0 30px ${priceFlash === 'up' ? '#00ff9d' : '#ff4455'}` }
        : {};

    // High/Low of visible window
    const visibleKlines = klines.slice(-60);
    const high = visibleKlines.length ? Math.max(...visibleKlines.map(k => k.high)) : 0;
    const low = visibleKlines.length ? Math.min(...visibleKlines.map(k => k.low)) : 0;

    return (
        <div className="bg-[#050507] border border-white/8 clip-corner overflow-hidden animate-slide-up">
            {/* ── Pair selector + status bar ──────────────────────── */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-black/40">
                <div className="flex items-center gap-1">
                    {PAIRS.map(p => (
                        <button
                            key={p.symbol}
                            onClick={() => { setPair(p); setBetResult(null); setSelectedOption(''); setBetAmount(''); }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest clip-corner-sm transition-all ${
                                pair.symbol === p.symbol
                                    ? 'text-white border border-white/20'
                                    : 'text-slate-600 hover:text-slate-300'
                            }`}
                            style={pair.symbol === p.symbol ? {
                                background: `${p.color}18`,
                                borderColor: `${p.color}50`,
                                boxShadow: `0 0 10px ${p.color}30`,
                            } : {}}
                        >
                            <span style={{ color: pair.symbol === p.symbol ? p.color : undefined }}>{p.icon}</span>
                            {p.label}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2">
                    {wsStatus === 'live' ? (
                        <span className="flex items-center gap-2 text-[9px] font-black text-green-400">
                            {/* Enhanced ring ping LIVE indicator */}
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ring-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-400" style={{ boxShadow: '0 0 6px #4ade80' }} />
                            </span>
                            LIVE
                        </span>
                    ) : wsStatus === 'connecting' ? (
                        <span className="flex items-center gap-1.5 text-[9px] text-yellow-500">
                            <RefreshCw size={9} className="animate-spin" /> SYNC
                        </span>
                    ) : (
                        <span className="flex items-center gap-1.5 text-[9px] text-rose-500">
                            <Activity size={9} /> OFFLINE
                        </span>
                    )}
                </div>
            </div>

            {/* ── Price display ────────────────────────────────────── */}
            <div className="px-5 pt-4 pb-3">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <p className="text-[9px] text-slate-600 font-black uppercase tracking-[0.25em] mb-1.5">
                            {pair.label}/USDT · {dataSource === 'coingecko' ? 'COINGECKO' : 'BINANCE'}
                        </p>
                        <div className="flex items-baseline gap-3 flex-wrap">
                            <span
                                key={priceFlash ?? 'idle'}
                                className={`text-[2.6rem] font-black font-mono leading-none transition-colors duration-200 ${priceColorClass} ${priceFlash ? 'animate-price-pop' : ''}`}
                                style={glowStyle}
                            >
                                ${currentPrice > 0
                                    ? currentPrice.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                    : '—'}
                            </span>
                            {currentPrice > 0 && (
                                <div className={`flex items-center gap-1.5 text-sm font-black ${isUp ? 'text-green-400' : 'text-rose-400'}`}>
                                    {isUp ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                                    {isUp ? '+' : ''}{changePct1h.toFixed(3)}%
                                </div>
                            )}
                        </div>
                        <div className="flex gap-4 mt-1.5 text-[9px] font-mono text-slate-600">
                            <span>1h <span className={isUp ? 'text-green-500/80' : 'text-rose-500/80'}>
                                {isUp ? '+' : '-'}${Math.abs(changeAbs1h).toLocaleString('en', { maximumFractionDigits: 2 })}
                            </span></span>
                            <span>24h <span className={change24h >= 0 ? 'text-green-500/80' : 'text-rose-500/80'}>
                                {change24h >= 0 ? '+' : ''}{change24h.toFixed(2)}%
                            </span></span>
                        </div>
                    </div>
                    {/* High / Low */}
                    {high > 0 && (
                        <div className="text-right text-[9px] font-mono space-y-1">
                            <p className="text-slate-600">H <span className="text-green-500/70">
                                ${high.toLocaleString('en', { maximumFractionDigits: 2 })}
                            </span></p>
                            <p className="text-slate-600">L <span className="text-rose-500/70">
                                ${low.toLocaleString('en', { maximumFractionDigits: 2 })}
                            </span></p>
                            <p className="text-slate-700">{klines.length} velas · 1m</p>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Live chart ───────────────────────────────────────── */}
            <div className="px-1 pb-1 relative" style={{ height: 230 }}>
                {/* Scan line overlay on chart */}
                {!loading && (
                    <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
                        <div className="animate-scan w-full h-[1px]"
                            style={{ background: `linear-gradient(90deg, transparent, ${chartColor}50, transparent)` }} />
                    </div>
                )}
                {loading ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="text-center">
                            <Activity size={28} className="text-slate-700 mx-auto mb-2 animate-pulse" />
                            <p className="text-[9px] text-slate-600 font-mono">Conectando a Binance...</p>
                        </div>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={klines.slice(-60)} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                            <defs>
                                {/* Main gradient */}
                                <linearGradient id={`cg_${pair.symbol}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={chartColor} stopOpacity={0.45} />
                                    <stop offset="60%" stopColor={chartColor} stopOpacity={0.08} />
                                    <stop offset="100%" stopColor={chartColor} stopOpacity={0.01} />
                                </linearGradient>
                                {/* Glow layer gradient */}
                                <linearGradient id={`cgg_${pair.symbol}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={chartColor} stopOpacity={0.15} />
                                    <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
                                </linearGradient>
                                {/* SVG glow filter */}
                                <filter id="glow-line" x="-20%" y="-20%" width="140%" height="140%">
                                    <feGaussianBlur stdDeviation="3" result="blur" />
                                    <feMerge>
                                        <feMergeNode in="blur" />
                                        <feMergeNode in="SourceGraphic" />
                                    </feMerge>
                                </filter>
                            </defs>

                            <XAxis
                                dataKey="time"
                                tick={{ fill: '#1e293b', fontSize: 8 }}
                                axisLine={false} tickLine={false}
                                interval={11}
                            />
                            <YAxis
                                domain={['auto', 'auto']}
                                tick={{ fill: '#1e293b', fontSize: 8 }}
                                axisLine={false} tickLine={false}
                                tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(1)}k` : `${v.toFixed(0)}`}
                            />

                            {/* Opening price reference line */}
                            {firstPrice > 0 && (
                                <ReferenceLine
                                    y={firstPrice}
                                    stroke="rgba(255,255,255,0.12)"
                                    strokeDasharray="5 5"
                                    label={{
                                        value: `APERTURA`,
                                        fill: '#334155', fontSize: 8,
                                        position: 'insideTopLeft',
                                    }}
                                />
                            )}

                            {/* Current price reference */}
                            {currentPrice > 0 && (
                                <ReferenceLine
                                    y={currentPrice}
                                    stroke={chartColor}
                                    strokeOpacity={0.3}
                                    strokeWidth={1}
                                    strokeDasharray="2 4"
                                />
                            )}

                            <Tooltip content={<PriceTooltip />} />

                            {/* Glow layer (wide, transparent) */}
                            <Area
                                type="monotone"
                                dataKey="price"
                                stroke={chartColor}
                                strokeWidth={6}
                                strokeOpacity={0.15}
                                fill={`url(#cgg_${pair.symbol})`}
                                dot={false}
                                isAnimationActive={false}
                            />

                            {/* Main line */}
                            <Area
                                type="monotone"
                                dataKey="price"
                                stroke={chartColor}
                                strokeWidth={2.5}
                                fill={`url(#cg_${pair.symbol})`}
                                dot={false}
                                activeDot={{ r: 5, fill: chartColor, stroke: '#000', strokeWidth: 2 }}
                                isAnimationActive={false}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* ── Betting section ──────────────────────────────────── */}
            {market ? (
                <BettingSection
                    market={market}
                    walletBalance={walletBalance}
                    selectedOption={selectedOption}
                    setSelectedOption={setSelectedOption}
                    betAmount={betAmount}
                    setBetAmount={setBetAmount}
                    placing={placing}
                    betResult={betResult}
                    setBetResult={setBetResult}
                    onPlaceBet={placeBet}
                />
            ) : (
                <div className="border-t border-white/5 px-5 py-4 flex items-center justify-center gap-2">
                    <Activity size={12} className="text-slate-700" />
                    <p className="text-[9px] font-black text-slate-700 uppercase tracking-widest">
                        Sin mercado activo · Crea uno desde el panel admin
                    </p>
                </div>
            )}
        </div>
    );
}

// ─── Betting Section ────────────────────────────────────────────────────────
function BettingSection({
    market, walletBalance,
    selectedOption, setSelectedOption,
    betAmount, setBetAmount,
    placing, betResult, setBetResult,
    onPlaceBet,
}: {
    market: PredictionMarket;
    walletBalance: number;
    selectedOption: string;
    setSelectedOption: (v: string) => void;
    betAmount: string;
    setBetAmount: (v: string) => void;
    placing: boolean;
    betResult: { success: boolean; message: string } | null;
    setBetResult: (v: any) => void;
    onPlaceBet: () => void;
}) {
    const { timeLeft, urgent } = useCountdown(market.closes_at);

    function getPrice(optId: string) {
        if (market.total_pool === 0) return 1 / market.options.length;
        const opt = market.options.find(o => o.id === optId);
        if (!opt) return 0;
        return Math.max(0.02, Math.min(0.98, opt.pool / market.total_pool));
    }

    const amount = parseFloat(betAmount) || 0;
    const selPrice = selectedOption ? getPrice(selectedOption) : 0;
    const potentialPayout = selPrice > 0 && amount > 0
        ? (amount / selPrice) * (1 - market.house_fee_pct / 100)
        : 0;

    const OPTION_STYLES = [
        // UP: green
        {
            bg: 'bg-green-500/5 border-green-500/20 hover:border-green-400/50 hover:bg-green-500/10',
            selected: 'border-green-400 bg-green-500/10 shadow-[0_0_25px_rgba(0,255,157,0.12)]',
            bar: '#00ff9d', text: 'text-green-400', accent: '#00ff9d',
            glow: '0 0 20px rgba(0,255,157,0.2)',
            Icon: TrendingUp,
        },
        // DOWN: red
        {
            bg: 'bg-rose-500/5 border-rose-500/20 hover:border-rose-400/50 hover:bg-rose-500/10',
            selected: 'border-rose-400 bg-rose-500/10 shadow-[0_0_25px_rgba(255,68,85,0.12)]',
            bar: '#ff4455', text: 'text-rose-400', accent: '#ff4455',
            glow: '0 0 20px rgba(255,68,85,0.2)',
            Icon: TrendingDown,
        },
    ];

    return (
        <div className="border-t border-white/8 p-5 space-y-4 bg-black/20">
            {/* Market title + timer */}
            <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-wider leading-snug flex-1 line-clamp-2">
                    {market.title}
                </p>
                <div className={`flex items-center gap-1.5 text-[10px] font-black font-mono whitespace-nowrap px-3 py-1.5 clip-corner-sm border ${
                    urgent
                        ? 'text-rose-400 border-rose-500/30 bg-rose-500/5 animate-pulse'
                        : 'text-yellow-400 border-yellow-500/20 bg-yellow-500/5'
                }`}>
                    <Clock size={10} />
                    {timeLeft}
                </div>
            </div>

            {/* Pool bar */}
            <div className="flex gap-0.5 h-2 clip-corner-sm overflow-hidden">
                {market.options.map((opt, idx) => {
                    const pct = market.total_pool > 0 ? (opt.pool / market.total_pool) * 100 : 50;
                    const s = OPTION_STYLES[idx] || OPTION_STYLES[0];
                    return (
                        <div
                            key={opt.id}
                            className="animate-bar-grow transition-[width] duration-700 h-full"
                            style={{ width: `${pct}%`, background: s.bar, opacity: 0.8, boxShadow: `0 0 8px ${s.bar}60` }}
                        />
                    );
                })}
            </div>

            {/* UP / DOWN option buttons */}
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(market.options.length, 3)}, 1fr)` }}>
                {market.options.map((opt, idx) => {
                    const price = getPrice(opt.id);
                    const pct = (price * 100).toFixed(1);
                    const isSelected = selectedOption === opt.id;
                    const s = OPTION_STYLES[idx] || OPTION_STYLES[0];
                    const { Icon } = s;
                    return (
                        <button
                            key={opt.id}
                            onClick={() => { setSelectedOption(isSelected ? '' : opt.id); setBetResult(null); }}
                            className={`relative p-4 clip-corner border transition-all text-left overflow-hidden ${
                                isSelected ? `${s.selected} animate-neon-pulse` : `${s.bg} cursor-pointer hover:scale-[1.02]`
                            }`}
                            style={isSelected ? { boxShadow: s.glow } : {}}
                        >
                            {/* Top accent bar — animates in when selected */}
                            <div className="absolute top-0 left-0 h-[2px] transition-all duration-400"
                                style={{
                                    width: isSelected ? '100%' : '0%',
                                    background: s.bar,
                                    boxShadow: isSelected ? `0 0 10px ${s.bar}` : 'none',
                                }} />
                            <div className="flex items-center gap-2 mb-2">
                                <Icon size={15} className={`${s.text} ${isSelected ? 'animate-pulse' : ''}`} />
                                <span className={`text-[9px] font-black uppercase tracking-widest ${s.text}`}>
                                    {opt.label}
                                </span>
                            </div>
                            <p className="text-3xl font-black font-mono leading-none transition-all duration-300"
                                style={{ color: s.bar, textShadow: isSelected ? `0 0 20px ${s.bar}` : 'none' }}>
                                {pct}%
                            </p>
                            <div className="flex justify-between mt-2 text-[8px] font-mono text-slate-600">
                                <span>${Number(opt.pool).toFixed(0)}</span>
                                <span>×{(1/price).toFixed(2)}</span>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Bet input */}
            <div className="space-y-2.5">
                <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">$</span>
                    <input
                        type="number" min={1} value={betAmount}
                        onChange={e => { setBetAmount(e.target.value); setBetResult(null); }}
                        placeholder={selectedOption ? '0.00' : 'Selecciona opción ↑'}
                        disabled={!selectedOption}
                        className="w-full bg-black/60 border border-white/8 clip-corner-sm py-4 pl-9 pr-4 text-white text-xl font-black font-mono outline-none focus:border-proyecto-accent/40 transition-all disabled:opacity-30 placeholder:text-slate-700"
                    />
                </div>

                <div className="grid grid-cols-5 gap-1.5">
                    {[5, 10, 25, 50, 100].map(v => (
                        <button
                            key={v}
                            disabled={!selectedOption}
                            onClick={() => { setBetAmount(String(Math.min(v, walletBalance))); setBetResult(null); }}
                            className="py-2 bg-white/5 hover:bg-white/10 text-slate-500 hover:text-white border border-white/5 clip-corner-sm text-[9px] font-black transition-all disabled:opacity-30"
                        >
                            ${v}
                        </button>
                    ))}
                </div>

                {/* Payout estimate */}
                {amount > 0 && selectedOption && (
                    <div className="flex items-center justify-between px-1 text-[9px] font-mono">
                        <span className="text-slate-600">
                            Pago máx: <span className="text-green-400 font-black">${potentialPayout.toFixed(2)}</span>
                        </span>
                        <span className="text-slate-700">
                            ×{(1/selPrice).toFixed(2)} · Fee {market.house_fee_pct}%
                        </span>
                    </div>
                )}

                {/* Result message */}
                {betResult && (
                    <div className={`flex items-center gap-2 p-3 clip-corner-sm border text-xs font-bold animate-bet-success ${
                        betResult.success
                            ? 'bg-green-500/5 border-green-500/30 text-green-400 animate-border-glow-green'
                            : 'bg-rose-500/5 border-rose-500/30 text-rose-400 animate-border-glow-red'
                    }`}>
                        {betResult.success ? <CheckCircle size={14} className="animate-pulse flex-shrink-0" /> : <AlertTriangle size={14} className="flex-shrink-0" />}
                        {betResult.message}
                    </div>
                )}

                {/* Bet button */}
                <button
                    onClick={onPlaceBet}
                    disabled={placing || !selectedOption || !betAmount || parseFloat(betAmount) < 1}
                    className="w-full py-4 blue-brand-gradient text-white font-orbitron font-black uppercase tracking-[0.15em] clip-corner shadow-neon-cyan disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2 animate-shimmer"
                >
                    {placing
                        ? <><RefreshCw size={14} className="animate-spin" /> PROCESANDO...</>
                        : <><Zap size={14} className="animate-pulse" /> APOSTAR ${betAmount || '0'}</>
                    }
                </button>

                {/* Footer info */}
                <div className="flex items-center justify-between text-[8px] font-mono text-slate-700 pt-1">
                    <span>Wallet: <span className="text-slate-500">${walletBalance.toFixed(2)}</span></span>
                    <span>Pool: <span className="text-slate-500">${Number(market.total_pool).toFixed(0)}</span></span>
                </div>
            </div>
        </div>
    );
}
