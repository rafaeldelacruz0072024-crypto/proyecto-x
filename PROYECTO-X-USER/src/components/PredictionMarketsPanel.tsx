import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
    AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import CryptoPredictionWidget from './CryptoPredictionWidget';
import MarketComments from './MarketComments';
import GlobalMarketsTab from './GlobalMarketsTab';
import PredictionHowItWorks, { HowItWorksButton } from './PredictionHowItWorks';
import {
    TrendingUp, Clock, DollarSign, ChevronLeft,
    CheckCircle, AlertTriangle, RefreshCw, History,
    Trophy, Target, Zap, Users, Flame, BarChart2
} from 'lucide-react';

interface PredictionOption { id: string; label: string; pool: number; }

interface PredictionMarket {
    id: string; title: string; description: string | null;
    category: string; image_url: string | null;
    options: PredictionOption[]; total_pool: number;
    status: 'OPEN' | 'CLOSED' | 'RESOLVED' | 'CANCELLED';
    winning_option: string | null; house_fee_pct: number;
    closes_at: string; resolves_at: string | null; resolved_at: string | null;
}

interface BetRecord {
    id: string; option_id: string; amount: number;
    shares: number; price_at_bet: number; created_at: string;
}

interface MyBet {
    id: string; market_id: string; option_id: string;
    amount: number; shares: number; price_at_bet: number;
    payout: number | null; status: string; created_at: string;
    prediction_markets: { title: string; winning_option: string | null; options: PredictionOption[] } | null;
}

interface ChartPoint { time: string; [key: string]: string | number; }

// Category styles
const CATEGORY_STYLE: Record<string, { bg: string; text: string; border: string; icon: string }> = {
    CRYPTO:   { bg: 'rgba(251,191,36,0.1)',  text: '#fbbf24', border: 'rgba(251,191,36,0.25)',  icon: '₿' },
    SPORTS:   { bg: 'rgba(34,197,94,0.1)',   text: '#4ade80', border: 'rgba(34,197,94,0.25)',   icon: '⚽' },
    POLITICS: { bg: 'rgba(168,85,247,0.1)',  text: '#c084fc', border: 'rgba(168,85,247,0.25)',  icon: '🏛' },
    ECONOMY:  { bg: 'rgba(99,102,241,0.1)',  text: '#818cf8', border: 'rgba(99,102,241,0.25)',  icon: '📈' },
    TECH:     { bg: 'rgba(0,243,255,0.1)',   text: '#00f3ff', border: 'rgba(0,243,255,0.25)',   icon: '⚡' },
    OTHER:    { bg: 'rgba(100,116,139,0.1)', text: '#94a3b8', border: 'rgba(100,116,139,0.25)', icon: '◎' },
};

// Option color pairs [YES-ish, NO-ish, third, fourth...]
const OPT_COLORS = ['#4ade80', '#f87171', '#00f3ff', '#fbbf24', '#c084fc', '#fb923c'];

const CHART_COLORS = ['#00f3ff', '#2563eb', '#bc13fe', '#ffd700', '#00ff9d', '#ff0055'];

// ─── Countdown Hook ────────────────────────────────────────────────────────
function useCountdown(closesAt: string) {
    const [timeLeft, setTimeLeft] = useState('');
    useEffect(() => {
        function calc() {
            const diff = new Date(closesAt).getTime() - Date.now();
            if (diff <= 0) { setTimeLeft('Cerrado'); return; }
            const d = Math.floor(diff / 86400000);
            const h = Math.floor((diff % 86400000) / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            if (d > 0) setTimeLeft(`${d}d ${h}h ${m}m`);
            else if (h > 0) setTimeLeft(`${h}h ${m}m ${s}s`);
            else setTimeLeft(`${m}m ${s}s`);
        }
        calc();
        const id = setInterval(calc, 1000);
        return () => clearInterval(id);
    }, [closesAt]);
    return timeLeft;
}

// ─── Build chart data ──────────────────────────────────────────────────────
function buildChartData(bets: BetRecord[], options: PredictionOption[], totalPool: number): ChartPoint[] {
    if (bets.length === 0) {
        const point: ChartPoint = { time: 'Inicio' };
        const equalPct = (100 / options.length).toFixed(1);
        options.forEach(o => { point[o.label] = parseFloat(equalPct); });
        return [point];
    }
    const pools: Record<string, number> = {};
    options.forEach(o => { pools[o.id] = 0; });
    let total = 0;
    const points: ChartPoint[] = [];
    const initPt: ChartPoint = { time: 'Inicio' };
    options.forEach(o => { initPt[o.label] = parseFloat((100 / options.length).toFixed(1)); });
    points.push(initPt);
    bets.forEach((bet, i) => {
        pools[bet.option_id] = (pools[bet.option_id] || 0) + Number(bet.amount);
        total += Number(bet.amount);
        const pt: ChartPoint = {
            time: new Date(bet.created_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
        };
        options.forEach(o => {
            const pct = total > 0 ? ((pools[o.id] / total) * 100) : (100 / options.length);
            pt[o.label] = parseFloat(pct.toFixed(1));
        });
        if (i === 0 || i === bets.length - 1 || bets.length <= 10 || i % Math.ceil(bets.length / 12) === 0) {
            points.push(pt);
        }
    });
    return points;
}

// ─── Custom Tooltip ────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{ background: 'rgba(5,7,18,0.95)', border: '1px solid rgba(0,243,255,0.15)', borderRadius: 12, padding: '10px 14px', backdropFilter: 'blur(20px)' }}>
            <p style={{ color: '#475569', fontSize: 10, marginBottom: 6, fontWeight: 700 }}>{label}</p>
            {payload.map((p: any) => (
                <p key={p.dataKey} style={{ color: p.color, fontSize: 11, fontWeight: 900 }}>
                    {p.name}: {p.value}%
                </p>
            ))}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
export default function PredictionMarketsPanel({ user, walletBalance, onUpdateBalance }: {
    user: any; walletBalance: number; onUpdateBalance: () => void;
}) {
    const [view, setView] = useState<'list' | 'detail' | 'mybets' | 'global'>('list');
    const [showHowItWorks, setShowHowItWorks] = useState(false);
    const [markets, setMarkets] = useState<PredictionMarket[]>([]);
    const [selectedMarket, setSelectedMarket] = useState<PredictionMarket | null>(null);
    const [myBets, setMyBets] = useState<MyBet[]>([]);
    const [marketBets, setMarketBets] = useState<BetRecord[]>([]);
    const [betCount, setBetCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadingBets, setLoadingBets] = useState(false);
    const [selectedOption, setSelectedOption] = useState('');
    const [betAmount, setBetAmount] = useState('');
    const [placing, setPlacing] = useState(false);
    const [betResult, setBetResult] = useState<{ success: boolean; message: string } | null>(null);
    const [chartData, setChartData] = useState<ChartPoint[]>([]);
    const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
    const [sortBy, setSortBy] = useState<'volume' | 'new' | 'closing' | 'hot'>('volume');
    const [searchQuery, setSearchQuery] = useState('');
    const [recentActivity, setRecentActivity] = useState<Array<{id: string; option_id: string; amount: number; created_at: string; market_title: string}>>([]);

    const fetchMarkets = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase
            .from('prediction_markets').select('*')
            .in('status', ['OPEN', 'CLOSED', 'RESOLVED'])
            .order('created_at', { ascending: false });
        setMarkets(data || []);
        setLoading(false);
    }, []);

    const fetchMyBets = useCallback(async () => {
        setLoadingBets(true);
        const { data } = await supabase
            .from('prediction_bets')
            .select(`*, prediction_markets(title, winning_option, options)`)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false }).limit(50);
        setMyBets(data || []);
        setLoadingBets(false);
    }, [user.id]);

    const fetchMarketBets = useCallback(async (marketId: string, options: PredictionOption[], totalPool: number) => {
        const { data } = await supabase
            .from('prediction_bets')
            .select('id, option_id, amount, shares, price_at_bet, created_at')
            .eq('market_id', marketId)
            .order('created_at', { ascending: true });
        const bets = data || [];
        setMarketBets(bets);
        setBetCount(bets.length);
        setChartData(buildChartData(bets, options, totalPool));
    }, []);

    useEffect(() => { fetchMarkets(); }, [fetchMarkets]);
    useEffect(() => { if (view === 'mybets') fetchMyBets(); }, [view, fetchMyBets]);

    // ── Recent activity feed ─────────────────────────────────────────────
    const fetchRecentActivity = useCallback(async () => {
        const { data } = await supabase
            .from('prediction_bets')
            .select('id, option_id, amount, created_at, prediction_markets(title)')
            .order('created_at', { ascending: false })
            .limit(5);
        if (data) {
            setRecentActivity(data.map((b: any) => ({
                id: b.id,
                option_id: b.option_id,
                amount: b.amount,
                created_at: b.created_at,
                market_title: b.prediction_markets?.title || '—',
            })));
        }
    }, []);
    useEffect(() => {
        fetchRecentActivity();
        const id = setInterval(fetchRecentActivity, 30000);
        return () => clearInterval(id);
    }, [fetchRecentActivity]);

    useEffect(() => {
        if (!selectedMarket) return;
        fetchMarketBets(selectedMarket.id, selectedMarket.options, selectedMarket.total_pool);
        const channel = supabase.channel(`mkt_${selectedMarket.id}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'prediction_markets', filter: `id=eq.${selectedMarket.id}` },
                (payload) => {
                    const updated = payload.new as PredictionMarket;
                    setSelectedMarket(updated);
                    setMarkets(prev => prev.map(m => m.id === updated.id ? updated : m));
                    fetchMarketBets(updated.id, updated.options, updated.total_pool);
                })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'prediction_bets', filter: `market_id=eq.${selectedMarket.id}` },
                () => {
                    if (selectedMarket) fetchMarketBets(selectedMarket.id, selectedMarket.options, selectedMarket.total_pool);
                })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [selectedMarket?.id]);

    async function placeBet() {
        if (!selectedMarket || !selectedOption || !betAmount) return;
        const amount = parseFloat(betAmount);
        if (isNaN(amount) || amount < 1) { setBetResult({ success: false, message: 'Apuesta mínima: $1' }); return; }
        if (amount > walletBalance) { setBetResult({ success: false, message: 'Saldo insuficiente en wallet' }); return; }
        setPlacing(true); setBetResult(null);
        try {
            const { data, error } = await supabase.rpc('place_prediction_bet', {
                p_market_id: selectedMarket.id, p_option_id: selectedOption, p_amount: amount,
            });
            if (error) throw error;
            if (!data?.success) {
                setBetResult({ success: false, message: data?.error || 'Error al colocar apuesta' });
            } else {
                setBetResult({ success: true, message: `✅ ${data.shares.toFixed(4)} shares @ ${(data.price * 100).toFixed(1)}%` });
                setBetAmount(''); setSelectedOption('');
                onUpdateBalance();
                const { data: upd } = await supabase.from('prediction_markets').select('*').eq('id', selectedMarket.id).single();
                if (upd) { setSelectedMarket(upd); fetchMarketBets(upd.id, upd.options, upd.total_pool); }
            }
        } catch (err: any) { setBetResult({ success: false, message: err.message }); }
        finally { setPlacing(false); }
    }

    function getPrice(market: PredictionMarket, optId: string) {
        if (market.total_pool === 0) return 0.5;
        const opt = market.options.find(o => o.id === optId);
        if (!opt) return 0;
        return Math.max(0.02, Math.min(0.98, opt.pool / market.total_pool));
    }

    function openDetail(market: PredictionMarket) {
        setSelectedMarket(market); setView('detail');
        setBetResult(null); setSelectedOption(''); setBetAmount('');
    }

    // ─── Shared nav ────────────────────────────────────────────────────────
    const NavTabs = ({ active }: { active: 'list' | 'mybets' | 'global' }) => (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
            <button onClick={() => setView('list')} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 18px',
                background: active === 'list' ? 'rgba(0,243,255,0.1)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${active === 'list' ? 'rgba(0,243,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 12, color: active === 'list' ? '#00f3ff' : '#64748b',
                fontWeight: 800, fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer',
                transition: 'all 0.2s',
            }}>
                <Target size={14} /> MERCADOS
            </button>
            <button onClick={() => setView('global')} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 18px',
                background: active === 'global' ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${active === 'global' ? 'rgba(168,85,247,0.35)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 12, color: active === 'global' ? '#c084fc' : '#64748b',
                fontWeight: 800, fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer',
                transition: 'all 0.2s', position: 'relative' as const,
            }}>
                <TrendingUp size={14} /> GLOBAL
                <span style={{
                    fontSize: 7, fontWeight: 900, padding: '2px 5px', borderRadius: 100,
                    background: 'rgba(168,85,247,0.2)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.3)',
                    letterSpacing: '0.1em', marginLeft: 2,
                }}>LIVE</span>
            </button>
            <button onClick={() => setView('mybets')} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 18px',
                background: active === 'mybets' ? 'rgba(0,243,255,0.1)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${active === 'mybets' ? 'rgba(0,243,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 12, color: active === 'mybets' ? '#00f3ff' : '#64748b',
                fontWeight: 800, fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer',
                transition: 'all 0.2s',
            }}>
                <History size={14} /> MIS APUESTAS
            </button>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <HowItWorksButton onClick={() => setShowHowItWorks(true)} />
                <button onClick={fetchMarkets} style={{
                    padding: '10px 12px',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 12, color: '#64748b', cursor: 'pointer', transition: 'all 0.2s',
                    display: 'flex', alignItems: 'center',
                }}>
                    <RefreshCw size={14} />
                </button>
            </div>
        </div>
    );

    // ──────────────────────────────────── GLOBAL VIEW
    if (view === 'global') {
        return (
            <>
                {showHowItWorks && <PredictionHowItWorks onClose={() => setShowHowItWorks(false)} />}
                <div>
                    <NavTabs active="global" />
                    <GlobalMarketsTab
                        user={user}
                        walletBalance={walletBalance}
                        onUpdateBalance={onUpdateBalance}
                        onSelectGeminixMarket={(geminixMkt) => {
                            const fullMarket = markets.find(m => m.id === geminixMkt.id);
                            if (fullMarket) openDetail(fullMarket);
                            else setView('list');
                        }}
                    />
                </div>
            </>
        );
    }

    // ──────────────────────────────────── LIST VIEW
    if (view === 'list') {
        const openCount = markets.filter(m => m.status === 'OPEN').length;
        const totalVol = markets.reduce((s, m) => s + Number(m.total_pool), 0);
        const availableCategories = ['ALL', ...Array.from(new Set(markets.map(m => m.category))).sort()];
        const filteredMarkets = categoryFilter === 'ALL' ? markets : markets.filter(m => m.category === categoryFilter);

        const sortedFilteredMarkets = [...filteredMarkets].filter(m =>
            !searchQuery || m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (m.description || '').toLowerCase().includes(searchQuery.toLowerCase())
        ).sort((a, b) => {
            if (sortBy === 'volume') return Number(b.total_pool) - Number(a.total_pool);
            if (sortBy === 'new') return new Date((b as any).created_at || 0).getTime() - new Date((a as any).created_at || 0).getTime();
            if (sortBy === 'closing') return new Date(a.closes_at).getTime() - new Date(b.closes_at).getTime();
            if (sortBy === 'hot') return Number(b.total_pool) - Number(a.total_pool);
            return 0;
        });
        const featuredMarket = markets.filter(m => m.status === 'OPEN' && Number(m.total_pool) > 0).sort((a, b) => Number(b.total_pool) - Number(a.total_pool))[0] || null;

        return (
            <>
            {showHowItWorks && <PredictionHowItWorks onClose={() => setShowHowItWorks(false)} />}
            <div style={{ position: 'relative' }}>
                {/* Ambient orbs */}
                <div style={{
                    position: 'absolute', width: 400, height: 400, borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)',
                    top: -100, left: -100, pointerEvents: 'none', zIndex: 0,
                }} />
                <div style={{
                    position: 'absolute', width: 300, height: 300, borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(0,243,255,0.04) 0%, transparent 70%)',
                    bottom: 0, right: 0, pointerEvents: 'none', zIndex: 0,
                }} />

                <div style={{ position: 'relative', zIndex: 1 }}>
                    {/* Crypto Widget */}
                    <CryptoPredictionWidget user={user} walletBalance={walletBalance} onUpdateBalance={onUpdateBalance} />

                    {/* Stats bar */}
                    <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12,
                        marginTop: 20, marginBottom: 20,
                    }}>
                        {[
                            { icon: <BarChart2 size={16} />, val: markets.length, label: 'Mercados Totales', color: '#818cf8' },
                            { icon: <Flame size={16} />, val: openCount, label: 'Mercados Activos', color: '#4ade80' },
                            { icon: <DollarSign size={16} />, val: `$${totalVol.toLocaleString('en-US')}`, label: 'Volumen Total', color: '#fbbf24' },
                        ].map((s, i) => (
                            <div key={i} style={{
                                background: 'rgba(15,23,42,0.7)',
                                border: '1px solid rgba(255,255,255,0.06)',
                                borderRadius: 16, padding: '16px 18px',
                                backdropFilter: 'blur(20px)',
                                display: 'flex', alignItems: 'center', gap: 12,
                            }}>
                                <div style={{ color: s.color, flexShrink: 0 }}>{s.icon}</div>
                                <div>
                                    <div style={{ fontSize: 18, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.val}</div>
                                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#475569', marginTop: 3 }}>{s.label}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Featured Market Banner */}
                    {!loading && featuredMarket && (() => {
                        const fOpts = featuredMarket.options.slice().sort((a, b) => b.pool - a.pool).slice(0, 2);
                        return (
                            <div
                                onClick={() => openDetail(featuredMarket)}
                                style={{
                                    marginBottom: 20,
                                    background: 'rgba(10,10,30,0.9)',
                                    border: '1px solid rgba(168,85,247,0.35)',
                                    borderRadius: 20,
                                    padding: '20px 22px',
                                    cursor: 'pointer',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    boxShadow: '0 0 40px rgba(168,85,247,0.12), 0 0 0 1px rgba(0,243,255,0.06)',
                                    transition: 'box-shadow 0.3s',
                                }}
                            >
                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, #a855f7, #00f3ff, transparent)' }} />
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                    <span style={{
                                        fontSize: 8, fontWeight: 900, padding: '3px 10px', borderRadius: 100,
                                        background: 'rgba(168,85,247,0.15)', color: '#c084fc',
                                        border: '1px solid rgba(168,85,247,0.3)', letterSpacing: '0.15em',
                                        animation: 'pulse 1.5s infinite',
                                    }}>🔥 DESTACADO</span>
                                    <span style={{ fontSize: 8, fontWeight: 700, color: '#475569', letterSpacing: '0.15em', textTransform: 'uppercase' }}>MERCADO DESTACADO</span>
                                    <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 900, color: '#fbbf24', fontFamily: 'monospace' }}>${Number(featuredMarket.total_pool).toLocaleString('en-US')} pool</span>
                                </div>
                                <p style={{ fontSize: 14, fontWeight: 800, color: '#f1f5f9', lineHeight: 1.3, marginBottom: 14 }}>{featuredMarket.title}</p>
                                <div style={{ display: 'flex', gap: 10 }}>
                                    {fOpts.map((opt, idx) => {
                                        const pct = featuredMarket.total_pool > 0 ? (opt.pool / featuredMarket.total_pool * 100) : 50;
                                        const color = idx === 0 ? '#4ade80' : '#f87171';
                                        return (
                                            <div key={opt.id} style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                                    <span style={{ fontSize: 10, fontWeight: 800, color: '#cbd5e1' }}>{opt.label}</span>
                                                    <span style={{ fontSize: 13, fontWeight: 900, fontFamily: 'monospace', color }}>{pct.toFixed(1)}%</span>
                                                </div>
                                                <div style={{ height: 8, borderRadius: 100, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                                                    <div style={{ height: '100%', borderRadius: 100, width: `${Math.max(2, pct)}%`, background: `linear-gradient(90deg, ${color}99, ${color})`, boxShadow: `0 0 8px ${color}60`, transition: 'width 0.8s' }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })()}

                    <NavTabs active="list" />

                    {/* Category filter pills */}
                    {!loading && markets.length > 0 && (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                            {availableCategories.map(cat => {
                                const cs = cat === 'ALL' ? null : (CATEGORY_STYLE[cat] || CATEGORY_STYLE.OTHER);
                                const isActive = categoryFilter === cat;
                                return (
                                    <button key={cat} onClick={() => setCategoryFilter(cat)} style={{
                                        padding: '7px 14px',
                                        background: isActive ? (cs ? cs.bg : 'rgba(0,243,255,0.1)') : 'rgba(255,255,255,0.03)',
                                        border: `1px solid ${isActive ? (cs ? cs.border : 'rgba(0,243,255,0.3)') : 'rgba(255,255,255,0.07)'}`,
                                        borderRadius: 100,
                                        color: isActive ? (cs ? cs.text : '#00f3ff') : '#475569',
                                        fontSize: 9, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase',
                                        cursor: 'pointer', transition: 'all 0.2s',
                                    }}>
                                        {cs ? `${cs.icon} ` : ''}{cat === 'ALL' ? 'TODOS' : cat}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Search + Sort Controls */}
                    {!loading && markets.length > 0 && (
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                            <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
                                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569', fontSize: 12 }}>🔍</span>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Buscar mercados..."
                                    style={{
                                        width: '100%', background: 'rgba(15,23,42,0.7)',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        borderRadius: 10, padding: '8px 12px 8px 32px',
                                        color: '#f1f5f9', fontSize: 11, fontWeight: 600,
                                        outline: 'none', boxSizing: 'border-box',
                                    }}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                {(['volume', 'new', 'closing', 'hot'] as const).map(s => {
                                    const labels: Record<string, string> = { volume: 'VOLUMEN', new: 'NUEVO', closing: 'CERRANDO', hot: 'HOT 🔥' };
                                    return (
                                        <button key={s} onClick={() => setSortBy(s)} style={{
                                            padding: '7px 12px',
                                            background: sortBy === s ? 'rgba(0,243,255,0.1)' : 'rgba(255,255,255,0.03)',
                                            border: `1px solid ${sortBy === s ? 'rgba(0,243,255,0.3)' : 'rgba(255,255,255,0.07)'}`,
                                            borderRadius: 8,
                                            color: sortBy === s ? '#00f3ff' : '#475569',
                                            fontSize: 8, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase',
                                            cursor: 'pointer', transition: 'all 0.2s',
                                        }}>{labels[s]}</button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {loading ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                            {Array(4).fill(0).map((_, i) => (
                                <div key={i} style={{ height: 220, background: 'rgba(255,255,255,0.03)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.06)', animation: 'pulse 2s infinite' }} />
                            ))}
                        </div>
                    ) : sortedFilteredMarkets.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
                            <TrendingUp size={48} style={{ color: '#1e293b', margin: '0 auto 16px' }} />
                            <p style={{ color: '#475569', fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', fontSize: 12 }}>
                                {markets.length === 0 ? 'No hay mercados disponibles' : searchQuery ? 'Sin resultados para esa búsqueda' : `Sin mercados en ${categoryFilter}`}
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                            {sortedFilteredMarkets.map((m, idx) => (
                                <MarketCard key={m.id} market={m} index={idx} onOpen={() => openDetail(m)} />
                            ))}
                        </div>
                    )}

                    {/* Recent Activity Ticker */}
                    {!loading && recentActivity.length > 0 && (
                        <div style={{
                            marginTop: 24,
                            background: 'rgba(5,7,18,0.85)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: 16, padding: '16px 20px',
                        }}>
                            <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#475569', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80', animation: 'pulse 1.4s infinite' }} />
                                ACTIVIDAD RECIENTE
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {recentActivity.map(act => {
                                    const diff = Date.now() - new Date(act.created_at).getTime();
                                    const mins = Math.floor(diff / 60000);
                                    const hrs = Math.floor(diff / 3600000);
                                    const timeAgo = hrs > 0 ? `hace ${hrs}h` : mins > 0 ? `hace ${mins}m` : 'ahora';
                                    return (
                                        <div key={act.id} style={{
                                            display: 'flex', alignItems: 'center', gap: 10,
                                            padding: '8px 12px',
                                            background: 'rgba(255,255,255,0.02)',
                                            border: '1px solid rgba(255,255,255,0.05)',
                                            borderRadius: 10,
                                        }}>
                                            <span style={{ fontSize: 8, fontWeight: 700, color: '#4ade80', letterSpacing: '0.1em', textTransform: 'uppercase', flexShrink: 0 }}>${Number(act.amount).toFixed(0)}</span>
                                            <span style={{ fontSize: 10, color: '#94a3b8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{act.market_title}</span>
                                            <span style={{ fontSize: 9, color: '#334155', fontFamily: 'monospace', flexShrink: 0 }}>{timeAgo}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            </>
        );
    }

    // ──────────────────────────────────── MY BETS VIEW
    if (view === 'mybets') {
        const totalWon = myBets.filter(b => b.status === 'WON').reduce((s, b) => s + Number(b.payout || 0), 0);
        const totalBet = myBets.reduce((s, b) => s + Number(b.amount), 0);
        const winRate = myBets.length > 0 ? ((myBets.filter(b => b.status === 'WON').length / myBets.length) * 100).toFixed(0) : '0';

        return (
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                    <button onClick={() => setView('list')} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        color: '#64748b', background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 11, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase',
                    }}>
                        <ChevronLeft size={16} /> VOLVER
                    </button>
                    <h2 style={{ fontFamily: 'var(--font-orbitron, Orbitron, sans-serif)', fontSize: 16, fontWeight: 900, color: '#fff', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                        MIS APUESTAS
                    </h2>
                </div>

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
                    {[
                        { label: 'Total Apostado', value: `$${totalBet.toFixed(2)}`, color: '#fff' },
                        { label: 'Ganancias', value: `$${totalWon.toFixed(2)}`, color: '#4ade80' },
                        { label: 'Win Rate', value: `${winRate}%`, color: '#00f3ff' },
                    ].map((s, i) => (
                        <div key={i} style={{
                            background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: 16, padding: '16px', textAlign: 'center', backdropFilter: 'blur(20px)',
                        }}>
                            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#475569', marginBottom: 6 }}>{s.label}</div>
                            <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
                        </div>
                    ))}
                </div>

                {loadingBets ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {Array(4).fill(0).map((_, i) => <div key={i} style={{ height: 80, background: 'rgba(255,255,255,0.03)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.05)' }} />)}
                    </div>
                ) : myBets.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                        <History size={40} style={{ color: '#1e293b', margin: '0 auto 12px' }} />
                        <p style={{ color: '#475569', fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', fontSize: 11 }}>Sin apuestas aún</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {myBets.map(bet => {
                            const mkt = bet.prediction_markets;
                            const optLabel = mkt?.options?.find(o => o.id === bet.option_id)?.label || bet.option_id;
                            const isWon = bet.status === 'WON', isLost = bet.status === 'LOST', isActive = bet.status === 'ACTIVE';
                            const statusColor = isWon ? '#4ade80' : isLost ? '#f87171' : isActive ? '#00f3ff' : '#fbbf24';
                            const statusBg = isWon ? 'rgba(34,197,94,0.08)' : isLost ? 'rgba(239,68,68,0.08)' : isActive ? 'rgba(0,243,255,0.08)' : 'rgba(251,191,36,0.08)';
                            return (
                                <div key={bet.id} style={{
                                    background: 'rgba(15,23,42,0.7)',
                                    border: `1px solid ${isWon ? 'rgba(34,197,94,0.2)' : isLost ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)'}`,
                                    borderRadius: 16, padding: '16px 20px',
                                    backdropFilter: 'blur(20px)',
                                    display: 'flex', alignItems: 'center', gap: 16,
                                }}>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9', marginBottom: 6, lineHeight: 1.3 }}>{mkt?.title || '—'}</p>
                                        <div style={{ display: 'flex', gap: 16, fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>
                                            <span>Opción: <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{optLabel}</span></span>
                                            <span>Apostado: <span style={{ color: '#e2e8f0' }}>${Number(bet.amount).toFixed(2)}</span></span>
                                            <span>Precio: <span style={{ color: '#00f3ff' }}>{(Number(bet.price_at_bet) * 100).toFixed(1)}%</span></span>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <div style={{
                                            fontSize: 9, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase',
                                            padding: '4px 10px', borderRadius: 100,
                                            background: statusBg, color: statusColor,
                                            border: `1px solid ${statusColor}40`,
                                            marginBottom: 6, display: 'inline-block',
                                        }}>{bet.status}</div>
                                        {bet.payout != null && (
                                            <div style={{ fontSize: 18, fontWeight: 900, color: isWon ? '#4ade80' : '#475569' }}>
                                                {isWon ? '+' : ''}${Number(bet.payout).toFixed(2)}
                                            </div>
                                        )}
                                        <div style={{ fontSize: 9, color: '#334155', marginTop: 2 }}>{new Date(bet.created_at).toLocaleDateString()}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

    // ──────────────────────────────────── DETAIL VIEW
    if (!selectedMarket) return null;
    const isOpen = selectedMarket.status === 'OPEN' && new Date(selectedMarket.closes_at) > new Date();
    const amount = parseFloat(betAmount) || 0;
    const selectedPrice = selectedOption ? getPrice(selectedMarket, selectedOption) : 0;
    const potentialPayout = selectedOption && amount > 0 ? (amount / selectedPrice) * (1 - selectedMarket.house_fee_pct / 100) : 0;
    const estimatedShares = selectedOption && amount > 0 ? (amount / selectedPrice).toFixed(4) : '—';
    const catStyle = CATEGORY_STYLE[selectedMarket.category] || CATEGORY_STYLE.OTHER;

    return (
        <div style={{ position: 'relative' }}>
            {/* Back */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                <button onClick={() => { setView('list'); setSelectedMarket(null); setBetResult(null); }} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    color: '#64748b', background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 11, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase',
                }}>
                    <ChevronLeft size={16} /> MERCADOS
                </button>
                <span style={{
                    fontSize: 9, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase',
                    padding: '5px 12px', borderRadius: 100,
                    background: catStyle.bg, color: catStyle.text, border: `1px solid ${catStyle.border}`,
                }}>{catStyle.icon} {selectedMarket.category}</span>
                {selectedMarket.status !== 'OPEN' && (
                    <span style={{
                        fontSize: 9, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase',
                        padding: '5px 12px', borderRadius: 100,
                        background: 'rgba(100,116,139,0.1)', color: '#94a3b8', border: '1px solid rgba(100,116,139,0.2)',
                    }}>{selectedMarket.status}</span>
                )}
            </div>

            {/* Market header card */}
            <div style={{
                background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(99,102,241,0.2)',
                borderRadius: 24, padding: '24px 28px', marginBottom: 16,
                backdropFilter: 'blur(20px)', position: 'relative', overflow: 'hidden',
            }}>
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                    background: 'linear-gradient(90deg, transparent, #6366f1, #00f3ff, transparent)',
                }} />
                <h2 style={{ fontSize: 18, fontWeight: 900, color: '#f1f5f9', lineHeight: 1.3, marginBottom: 10 }}>
                    {selectedMarket.title}
                </h2>
                {selectedMarket.description && (
                    <p style={{ color: '#64748b', fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>{selectedMarket.description}</p>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, fontSize: 11, fontFamily: 'monospace', color: '#475569' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <DollarSign size={12} />
                        Pool: <span style={{ color: '#fbbf24', fontWeight: 900, marginLeft: 4 }}>${Number(selectedMarket.total_pool).toFixed(2)}</span>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Users size={12} />
                        <span style={{ color: '#fff', fontWeight: 900 }}>{betCount}</span> apuestas
                    </span>
                    {isOpen && <CountdownBadge closesAt={selectedMarket.closes_at} />}
                    <span style={{ color: '#334155' }}>Fee: {selectedMarket.house_fee_pct}%</span>
                </div>
            </div>

            {/* Market Stats row */}
            {(() => {
                const leadingOpt = selectedMarket.options.reduce((a, b) => a.pool > b.pool ? a : b, selectedMarket.options[0]);
                const diffMs = new Date(selectedMarket.closes_at).getTime() - Date.now();
                const closingIn = diffMs > 0
                    ? (diffMs > 3600000 ? `${Math.floor(diffMs / 3600000)}h ${Math.floor((diffMs % 3600000) / 60000)}m` : `${Math.floor(diffMs / 60000)}m`)
                    : 'Cerrado';
                return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
                        {[
                            { label: 'Pool Total', value: `$${Number(selectedMarket.total_pool).toLocaleString('en-US')}`, color: '#fbbf24' },
                            { label: 'Apuestas', value: betCount, color: '#00f3ff' },
                            { label: 'Cierre', value: closingIn, color: diffMs < 3600000 && diffMs > 0 ? '#f87171' : '#4ade80' },
                            { label: 'Lider', value: leadingOpt?.label || '—', color: '#c084fc' },
                        ].map((s, i) => (
                            <div key={i} style={{
                                background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.06)',
                                borderRadius: 14, padding: '12px 14px', textAlign: 'center',
                                backdropFilter: 'blur(20px)',
                            }}>
                                <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#475569', marginBottom: 5 }}>{s.label}</div>
                                <div style={{ fontSize: 13, fontWeight: 900, color: s.color, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(s.value)}</div>
                            </div>
                        ))}
                    </div>
                );
            })()}

            {/* Price chart */}
            <PriceChart chartData={chartData} options={selectedMarket.options} />

            {/* Options */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, margin: '16px 0' }}>
                {selectedMarket.options.map((opt, idx) => {
                    const price = getPrice(selectedMarket, opt.id);
                    const pct = price * 100;
                    const isWinner = selectedMarket.winning_option === opt.id;
                    const isSelected = selectedOption === opt.id;
                    const color = OPT_COLORS[idx % OPT_COLORS.length];
                    const borderColor = isWinner ? 'rgba(34,197,94,0.4)' : isSelected ? `${color}50` : 'rgba(255,255,255,0.08)';
                    const bgColor = isWinner ? 'rgba(34,197,94,0.06)' : isSelected ? `${color}08` : 'rgba(15,23,42,0.7)';

                    return (
                        <button key={opt.id}
                            onClick={() => isOpen ? setSelectedOption(isSelected ? '' : opt.id) : undefined}
                            disabled={!isOpen}
                            style={{
                                padding: '20px', textAlign: 'left',
                                background: bgColor,
                                border: `1px solid ${borderColor}`,
                                borderRadius: 20, cursor: isOpen ? 'pointer' : 'default',
                                position: 'relative', overflow: 'hidden',
                                transition: 'all 0.25s',
                                boxShadow: isSelected ? `0 0 24px ${color}20` : 'none',
                                opacity: !isOpen && !isWinner ? 0.7 : 1,
                            }}
                        >
                            {/* Top line accent */}
                            {(isSelected || isWinner) && (
                                <div style={{
                                    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                                    background: isWinner ? 'linear-gradient(90deg, transparent, #4ade80, transparent)' : `linear-gradient(90deg, transparent, ${color}, transparent)`,
                                }} />
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                                <span style={{
                                    fontSize: 14, fontWeight: 800, color: isWinner ? '#4ade80' : isSelected ? color : '#f1f5f9',
                                    display: 'flex', alignItems: 'center', gap: 6,
                                }}>
                                    {isWinner && <Trophy size={14} />}{opt.label}
                                </span>
                                <span style={{
                                    fontSize: 26, fontWeight: 900, fontFamily: 'monospace',
                                    color: isWinner ? '#4ade80' : color,
                                    textShadow: `0 0 20px ${isWinner ? '#4ade80' : color}60`,
                                }}>{pct.toFixed(1)}%</span>
                            </div>

                            {/* Thick probability bar */}
                            <div style={{ height: 10, borderRadius: 100, background: 'rgba(255,255,255,0.05)', marginBottom: 12, overflow: 'hidden', position: 'relative' }}>
                                <div style={{
                                    height: '100%', borderRadius: 100,
                                    width: `${Math.max(2, pct)}%`,
                                    background: isWinner ? 'linear-gradient(90deg, #22c55e, #4ade80)' : `linear-gradient(90deg, ${color}cc, ${color})`,
                                    boxShadow: `0 0 12px ${isWinner ? '#22c55e' : color}80`,
                                    transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)',
                                    position: 'relative',
                                }}>
                                    <div style={{
                                        position: 'absolute', right: 0, top: 0, bottom: 0, width: 3,
                                        background: '#fff', borderRadius: '0 100px 100px 0',
                                        boxShadow: '0 0 8px #fff',
                                    }} />
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontFamily: 'monospace', color: '#475569' }}>
                                <span>Pool: <span style={{ color: '#94a3b8' }}>${Number(opt.pool).toFixed(2)}</span></span>
                                <span>1 share ≈ <span style={{ color: '#94a3b8' }}>${(1 / price).toFixed(2)}</span></span>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Bet form */}
            {!isOpen && selectedMarket.status !== 'RESOLVED' && (
                <div style={{
                    background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(100,116,139,0.2)',
                    borderRadius: 20, padding: '20px 24px', marginBottom: 16,
                    display: 'flex', alignItems: 'center', gap: 12,
                }}>
                    <Clock size={18} style={{ color: '#475569', flexShrink: 0 }} />
                    <div>
                        <p style={{ fontSize: 12, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Mercado Cerrado</p>
                        <p style={{ fontSize: 11, color: '#334155', marginTop: 3 }}>Este mercado ya no acepta apuestas.</p>
                    </div>
                </div>
            )}
            {isOpen && (
                <div style={{
                    background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 24, padding: '24px 28px', marginBottom: 16,
                    backdropFilter: 'blur(20px)',
                }}>
                    <h3 style={{
                        fontSize: 11, fontWeight: 900, letterSpacing: '0.25em', textTransform: 'uppercase',
                        color: '#00f3ff', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                        <Target size={16} /> COLOCAR APUESTA
                    </h3>

                    {!selectedOption ? (
                        <p style={{
                            fontSize: 12, color: '#334155', textAlign: 'center', padding: '24px',
                            border: '1px dashed rgba(255,255,255,0.06)', borderRadius: 14,
                        }}>← Selecciona una opción arriba</p>
                    ) : (
                        <>
                            {/* Selected option badge */}
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '12px 16px',
                                background: 'rgba(0,243,255,0.05)', border: '1px solid rgba(0,243,255,0.2)',
                                borderRadius: 14, marginBottom: 20,
                            }}>
                                <CheckCircle size={14} style={{ color: '#00f3ff', flexShrink: 0 }} />
                                <span style={{ fontSize: 13, fontWeight: 800, color: '#00f3ff', flex: 1 }}>
                                    {selectedMarket.options.find(o => o.id === selectedOption)?.label}
                                </span>
                                <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>
                                    {(selectedPrice * 100).toFixed(1)}%
                                </span>
                            </div>

                            {/* Amount input */}
                            <div style={{ marginBottom: 16 }}>
                                <label style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: 8 }}>
                                    Monto (USDT)
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#475569', fontSize: 16, fontWeight: 700 }}>$</span>
                                    <input
                                        type="number" min={1} step={1} value={betAmount}
                                        onChange={e => { setBetAmount(e.target.value); setBetResult(null); }}
                                        style={{
                                            width: '100%', background: 'rgba(5,7,18,0.8)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: 14, padding: '16px 20px 16px 36px',
                                            color: '#fff', fontSize: 20, fontWeight: 900, fontFamily: 'monospace',
                                            outline: 'none', boxSizing: 'border-box',
                                            transition: 'border-color 0.2s',
                                        }}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                                    {[10, 25, 50, 100].map(v => (
                                        <button key={v} onClick={() => { setBetAmount(String(Math.min(v, walletBalance))); setBetResult(null); }} style={{
                                            flex: 1, padding: '8px', background: 'rgba(255,255,255,0.04)',
                                            border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10,
                                            color: '#64748b', fontSize: 10, fontWeight: 800, cursor: 'pointer',
                                            letterSpacing: '0.1em', textTransform: 'uppercase',
                                        }}>${v}</button>
                                    ))}
                                    <button onClick={() => { setBetAmount(String(walletBalance)); setBetResult(null); }} style={{
                                        flex: 1, padding: '8px', background: 'rgba(0,243,255,0.06)',
                                        border: '1px solid rgba(0,243,255,0.15)', borderRadius: 10,
                                        color: '#00f3ff', fontSize: 10, fontWeight: 800, cursor: 'pointer',
                                        letterSpacing: '0.1em', textTransform: 'uppercase',
                                    }}>MAX</button>
                                </div>
                            </div>

                            {/* Payout preview */}
                            {amount > 0 && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
                                    {[
                                        { label: 'Shares', value: estimatedShares },
                                        { label: 'Precio', value: `${(selectedPrice * 100).toFixed(1)}%` },
                                        { label: 'Pago máx', value: `$${potentialPayout.toFixed(2)}` },
                                    ].map((s, i) => (
                                        <div key={i} style={{
                                            background: 'rgba(5,7,18,0.6)', border: '1px solid rgba(255,255,255,0.05)',
                                            borderRadius: 12, padding: '12px', textAlign: 'center',
                                        }}>
                                            <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#475569', marginBottom: 4 }}>{s.label}</div>
                                            <div style={{ fontSize: 14, fontWeight: 900, color: '#00f3ff', fontFamily: 'monospace' }}>{s.value}</div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {betResult && (
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px',
                                    borderRadius: 14, marginBottom: 16, fontSize: 12, fontWeight: 700,
                                    background: betResult.success ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)',
                                    border: `1px solid ${betResult.success ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                                    color: betResult.success ? '#4ade80' : '#f87171',
                                }}>
                                    {betResult.success
                                        ? <CheckCircle size={16} style={{ flexShrink: 0 }} />
                                        : <AlertTriangle size={16} style={{ flexShrink: 0 }} />}
                                    {betResult.message}
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#475569', fontFamily: 'monospace', marginBottom: 14 }}>
                                <span>Wallet: <span style={{ color: '#fff', fontWeight: 900 }}>${walletBalance.toFixed(2)}</span></span>
                                <span>Fee: {selectedMarket.house_fee_pct}%</span>
                            </div>

                            <button onClick={placeBet}
                                disabled={placing || !betAmount || parseFloat(betAmount) < 1}
                                style={{
                                    width: '100%', padding: '18px',
                                    background: placing ? 'rgba(99,102,241,0.3)' : 'linear-gradient(135deg, #6366f1, #00f3ff)',
                                    border: 'none', borderRadius: 16,
                                    color: placing ? '#94a3b8' : '#020817',
                                    fontWeight: 900, fontSize: 13, letterSpacing: '0.2em', textTransform: 'uppercase',
                                    cursor: placing ? 'default' : 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                                    opacity: (!betAmount || parseFloat(betAmount) < 1) ? 0.4 : 1,
                                    transition: 'all 0.2s',
                                    boxShadow: placing ? 'none' : '0 8px 32px rgba(99,102,241,0.3), 0 0 0 1px rgba(0,243,255,0.1)',
                                }}
                            >
                                {placing
                                    ? <><RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> PROCESANDO...</>
                                    : <><Zap size={16} /> APOSTAR ${betAmount || '0'}</>
                                }
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* Resolved banner */}
            {selectedMarket.status === 'RESOLVED' && selectedMarket.winning_option && (
                <div style={{
                    background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)',
                    borderRadius: 20, padding: '24px', textAlign: 'center', marginBottom: 16,
                    backdropFilter: 'blur(20px)',
                }}>
                    <Trophy size={28} style={{ color: '#4ade80', margin: '0 auto 12px' }} />
                    <p style={{ fontWeight: 900, color: '#4ade80', letterSpacing: '0.2em', textTransform: 'uppercase', fontSize: 14 }}>
                        GANADOR: {selectedMarket.options.find(o => o.id === selectedMarket.winning_option)?.label}
                    </p>
                    {selectedMarket.resolved_at && (
                        <p style={{ fontSize: 10, color: '#475569', fontFamily: 'monospace', marginTop: 6 }}>
                            Resuelto {new Date(selectedMarket.resolved_at).toLocaleString('en-US')}
                        </p>
                    )}
                </div>
            )}

            <MarketComments marketId={selectedMarket.id} options={selectedMarket.options} user={user} />
        </div>
    );
}

// ─── Market Card ─────────────────────────────────────────────────────────────
function MarketCard({ market, index, onOpen }: { market: PredictionMarket; index: number; onOpen: () => void }) {
    const countdown = useCountdown(market.closes_at);
    const isOpen = market.status === 'OPEN' && new Date(market.closes_at) > new Date();
    const catStyle = CATEGORY_STYLE[market.category] || CATEGORY_STYLE.OTHER;
    const [hovered, setHovered] = useState(false);

    const sparkRef = useRef<SVGPathElement>(null);
    useEffect(() => {
        if (!sparkRef.current) return;
        const len = sparkRef.current.getTotalLength?.() || 200;
        sparkRef.current.style.strokeDasharray = `${len}`;
        sparkRef.current.style.strokeDashoffset = `${len}`;
        sparkRef.current.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.16,1,0.3,1)';
        requestAnimationFrame(() => { requestAnimationFrame(() => { if (sparkRef.current) sparkRef.current.style.strokeDashoffset = '0'; }); });
    }, [market.id]);

    // Generate a deterministic sparkline path based on market id
    const sparkPoints = React.useMemo(() => {
        const seed = market.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
        const pts: number[] = [];
        let val = 50;
        for (let i = 0; i < 12; i++) {
            val = Math.max(10, Math.min(90, val + ((seed * (i + 7)) % 20) - 10));
            pts.push(val);
        }
        return pts;
    }, [market.id]);

    const sparkPath = React.useMemo(() => {
        const w = 200, h = 40;
        return sparkPoints.map((v, i) => {
            const x = (i / (sparkPoints.length - 1)) * w;
            const y = h - (v / 100) * h;
            return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(' ');
    }, [sparkPoints]);

    const sparkFill = React.useMemo(() => {
        const w = 200, h = 40;
        const line = sparkPoints.map((v, i) => {
            const x = (i / (sparkPoints.length - 1)) * w;
            const y = h - (v / 100) * h;
            return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(' ');
        return `${line} L${w},${h} L0,${h} Z`;
    }, [sparkPoints]);

    const leadOpt = market.options.reduce((a, b) => a.pool > b.pool ? a : b, market.options[0]);
    const leadPct = market.total_pool > 0
        ? ((leadOpt?.pool / market.total_pool) * 100)
        : (100 / market.options.length);
    const leadColor = OPT_COLORS[market.options.indexOf(leadOpt) % OPT_COLORS.length];

    const isSports = market.category === 'SPORTS';
    const sportsHomeOpt = isSports ? market.options[0] : null;
    const sportsAwayOpt = isSports ? market.options[market.options.length - 1] : null;
    const sportsDrawOpt = isSports && market.options.length === 3 ? market.options[1] : null;
    const sportsHomePct = sportsHomeOpt
        ? (market.total_pool > 0 ? (sportsHomeOpt.pool / market.total_pool) * 100 : 100 / market.options.length)
        : 0;
    const sportsAwayPct = sportsAwayOpt
        ? (market.total_pool > 0 ? (sportsAwayOpt.pool / market.total_pool) * 100 : 100 / market.options.length)
        : 0;
    const sportsDrawPct = sportsDrawOpt
        ? (market.total_pool > 0 ? (sportsDrawOpt.pool / market.total_pool) * 100 : 100 / market.options.length)
        : 0;
    const sportsHomeName = sportsHomeOpt?.label.replace(/ Gana$/, '') || '';
    const sportsAwayName = sportsAwayOpt?.label.replace(/ Gana$/, '') || '';
    const sportsHomeWin = market.winning_option === sportsHomeOpt?.id;
    const sportsAwayWin = market.winning_option === sportsAwayOpt?.id;
    const sportsDrawWin = sportsDrawOpt && market.winning_option === sportsDrawOpt.id;

    return (
        <div
            onClick={onOpen}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                background: hovered
                    ? (isSports ? 'rgba(20,35,25,0.92)' : 'rgba(20,30,55,0.9)')
                    : (isSports ? 'rgba(15,25,18,0.82)' : 'rgba(15,23,42,0.75)'),
                border: `1px solid ${hovered
                    ? (isSports ? 'rgba(34,197,94,0.3)' : 'rgba(0,243,255,0.2)')
                    : (isSports ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.07)')}`,
                borderRadius: 22, padding: '22px 24px',
                cursor: 'pointer', position: 'relative', overflow: 'hidden',
                backdropFilter: 'blur(20px)',
                transform: hovered ? 'translateY(-3px)' : 'none',
                boxShadow: hovered
                    ? (isSports ? '0 24px 64px rgba(0,0,0,0.4), 0 0 40px rgba(34,197,94,0.06)' : '0 24px 64px rgba(0,0,0,0.4), 0 0 40px rgba(0,243,255,0.04)')
                    : '0 4px 24px rgba(0,0,0,0.2)',
                transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
            }}
        >
            {/* Hover glow */}
            <div style={{
                position: 'absolute', inset: 0,
                background: isSports
                    ? 'radial-gradient(circle at 50% 0%, rgba(34,197,94,0.07) 0%, transparent 60%)'
                    : 'radial-gradient(circle at 50% 0%, rgba(0,243,255,0.06) 0%, transparent 60%)',
                opacity: hovered ? 1 : 0, transition: 'opacity 0.4s', pointerEvents: 'none',
            }} />
            {/* Top slide line */}
            <div style={{
                position: 'absolute', top: 0, left: 0, height: 2,
                background: isSports
                    ? 'linear-gradient(90deg, transparent, #4ade80, transparent)'
                    : 'linear-gradient(90deg, transparent, #00f3ff, transparent)',
                width: hovered ? '100%' : '0%', transition: 'width 0.5s ease-out',
            }} />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, gap: 10, position: 'relative', zIndex: 1 }}>
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                        <span style={{
                            fontSize: 9, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase',
                            padding: '4px 10px', borderRadius: 100,
                            background: catStyle.bg, color: catStyle.text, border: `1px solid ${catStyle.border}`,
                        }}>{catStyle.icon} {market.category}</span>
                        {Number(market.total_pool) > 500 && (
                            <span style={{ fontSize: 8, fontWeight: 900, padding: '3px 8px', borderRadius: 100, background: 'rgba(251,113,133,0.15)', color: '#fb7185', border: '1px solid rgba(251,113,133,0.3)', letterSpacing: '0.15em' }}>🔥 HOT</span>
                        )}
                        {isSports && market.description && (
                            <span style={{ fontSize: 9, color: '#4ade8099', fontWeight: 700, letterSpacing: '0.1em' }}>
                                {market.description}
                            </span>
                        )}
                        {market.status === 'RESOLVED' && (
                            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 100, background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}>RESUELTO</span>
                        )}
                        {market.status === 'CLOSED' && (
                            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 100, background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}>CERRADO</span>
                        )}
                    </div>
                    {!isSports && (
                        <h3 style={{ fontSize: 13, fontWeight: 800, color: hovered ? '#00f3ff' : '#f1f5f9', lineHeight: 1.35, transition: 'color 0.2s' }}>
                            {market.title}
                        </h3>
                    )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#fbbf24' }}>${Number(market.total_pool).toLocaleString('en-US')}</div>
                    <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#475569', marginTop: 2 }}>volumen</div>
                </div>
            </div>

            {isSports ? (
                /* ── Sports VS layout ── */
                <div style={{ position: 'relative', zIndex: 1, marginBottom: 14 }}>
                    {/* Match date */}
                    {market.resolves_at && (
                        <div style={{ textAlign: 'center', fontSize: 9, color: '#475569', fontFamily: 'monospace', marginBottom: 10, fontWeight: 700, letterSpacing: '0.12em' }}>
                            <Clock size={9} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                            {new Date(market.resolves_at).toLocaleDateString('es', { weekday: 'short', month: 'short', day: 'numeric' })}
                            {' · '}
                            {new Date(market.resolves_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    )}
                    {/* Teams row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {/* Home team */}
                        <div style={{
                            flex: 1, textAlign: 'center',
                            padding: '12px 8px',
                            background: sportsHomeWin ? 'rgba(34,197,94,0.12)' : 'rgba(74,222,128,0.05)',
                            border: `1px solid ${sportsHomeWin ? 'rgba(34,197,94,0.4)' : 'rgba(74,222,128,0.12)'}`,
                            borderRadius: 14,
                        }}>
                            <div style={{ fontSize: 22 }}>🏠</div>
                            <div style={{ fontSize: 11, fontWeight: 800, color: sportsHomeWin ? '#4ade80' : '#f1f5f9', lineHeight: 1.2, marginTop: 4, marginBottom: 6 }}>
                                {sportsHomeWin && <Trophy size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3, color: '#4ade80' }} />}
                                {sportsHomeName}
                            </div>
                            <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'monospace', color: sportsHomeWin ? '#4ade80' : '#4ade80cc' }}>
                                {sportsHomePct.toFixed(0)}%
                            </div>
                        </div>

                        {/* Middle: draw or VS */}
                        <div style={{ flexShrink: 0, textAlign: 'center' }}>
                            {sportsDrawOpt ? (
                                <div style={{
                                    padding: '8px 10px',
                                    background: sportsDrawWin ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.04)',
                                    border: `1px solid ${sportsDrawWin ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.07)'}`,
                                    borderRadius: 12,
                                }}>
                                    <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.15em', color: sportsDrawWin ? '#fbbf24' : '#64748b', textTransform: 'uppercase', marginBottom: 2 }}>X</div>
                                    <div style={{ fontSize: 13, fontWeight: 900, fontFamily: 'monospace', color: sportsDrawWin ? '#fbbf24' : '#94a3b8' }}>
                                        {sportsDrawPct.toFixed(0)}%
                                    </div>
                                </div>
                            ) : (
                                <div style={{ fontSize: 13, fontWeight: 900, color: '#334155', letterSpacing: '0.1em' }}>VS</div>
                            )}
                        </div>

                        {/* Away team */}
                        <div style={{
                            flex: 1, textAlign: 'center',
                            padding: '12px 8px',
                            background: sportsAwayWin ? 'rgba(239,68,68,0.12)' : 'rgba(248,113,113,0.05)',
                            border: `1px solid ${sportsAwayWin ? 'rgba(239,68,68,0.4)' : 'rgba(248,113,113,0.12)'}`,
                            borderRadius: 14,
                        }}>
                            <div style={{ fontSize: 22 }}>✈️</div>
                            <div style={{ fontSize: 11, fontWeight: 800, color: sportsAwayWin ? '#f87171' : '#f1f5f9', lineHeight: 1.2, marginTop: 4, marginBottom: 6 }}>
                                {sportsAwayWin && <Trophy size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3, color: '#f87171' }} />}
                                {sportsAwayName}
                            </div>
                            <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'monospace', color: sportsAwayWin ? '#f87171' : '#f87171cc' }}>
                                {sportsAwayPct.toFixed(0)}%
                            </div>
                        </div>
                    </div>
                    {/* Probability bar */}
                    <div style={{ height: 6, borderRadius: 100, background: 'rgba(255,255,255,0.04)', overflow: 'hidden', marginTop: 10, display: 'flex' }}>
                        <div style={{ height: '100%', width: `${sportsHomePct}%`, background: 'linear-gradient(90deg, #22c55e, #4ade80)', transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)' }} />
                        {sportsDrawOpt && <div style={{ height: '100%', width: `${sportsDrawPct}%`, background: '#fbbf24', transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)' }} />}
                        <div style={{ height: '100%', width: `${sportsAwayPct}%`, background: 'linear-gradient(90deg, #f87171, #ef4444)', transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)' }} />
                    </div>
                </div>
            ) : (
                /* ── Regular market layout ── */
                <>
                    {/* Sparkline */}
                    <div style={{ margin: '0 0 14px', position: 'relative', zIndex: 1 }}>
                        <svg width="100%" height="40" viewBox="0 0 200 40" preserveAspectRatio="none">
                            <defs>
                                <linearGradient id={`sf_${market.id}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={leadColor} stopOpacity="0.25" />
                                    <stop offset="100%" stopColor={leadColor} stopOpacity="0" />
                                </linearGradient>
                            </defs>
                            <path d={sparkFill} fill={`url(#sf_${market.id})`} />
                            <path ref={sparkRef} d={sparkPath} fill="none" stroke={leadColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                style={{ filter: `drop-shadow(0 0 4px ${leadColor}80)` }} />
                        </svg>
                    </div>

                    {/* Probability bars */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', zIndex: 1, marginBottom: 14 }}>
                        {market.options.map((opt, idx) => {
                            const pct = market.total_pool > 0 ? (opt.pool / market.total_pool) * 100 : 100 / market.options.length;
                            const isWinner = market.winning_option === opt.id;
                            const color = isWinner ? '#4ade80' : OPT_COLORS[idx % OPT_COLORS.length];
                            return (
                                <div key={opt.id}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <span style={{ fontSize: 10, fontWeight: 700, color: isWinner ? '#4ade80' : '#cbd5e1', display: 'flex', alignItems: 'center', gap: 4 }}>
                                            {isWinner && <Trophy size={9} />}{opt.label}
                                        </span>
                                        <span style={{ fontSize: 11, fontWeight: 900, fontFamily: 'monospace', color }}>{pct.toFixed(1)}%</span>
                                    </div>
                                    <div style={{ height: 8, borderRadius: 100, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                                        <div style={{
                                            height: '100%', borderRadius: 100,
                                            width: `${Math.max(2, pct)}%`,
                                            background: `linear-gradient(90deg, ${color}cc, ${color})`,
                                            boxShadow: `0 0 8px ${color}60`,
                                            transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)',
                                        }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {/* Footer */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, position: 'relative', zIndex: 1, marginBottom: 12 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#475569' }}>
                    <Users size={10} />
                    <span style={{ color: '#94a3b8', fontFamily: 'monospace' }}></span>
                </span>
                <span style={{
                    display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'monospace',
                    color: isOpen ? '#4ade80' : '#475569',
                    fontWeight: isOpen ? 800 : 500,
                }}>
                    {isOpen ? <><div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px #4ade80', animation: 'pulse 1.4s infinite' }} /> {countdown}</> :
                     market.status === 'RESOLVED' ? <><Trophy size={10} /> Resuelto</> :
                     <><Clock size={10} /> Cerrado</>}
                </span>
            </div>

            {/* CTA Button */}
            <div style={{ position: 'relative', zIndex: 1 }}
                onClick={e => e.stopPropagation()}>
                <button
                    onClick={onOpen}
                    style={{
                        width: '100%',
                        padding: '11px',
                        background: isOpen
                            ? (isSports ? 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(74,222,128,0.08))' : 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(0,243,255,0.08))')
                            : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${isOpen ? (isSports ? 'rgba(74,222,128,0.35)' : 'rgba(0,243,255,0.3)') : 'rgba(255,255,255,0.07)'}`,
                        borderRadius: 12,
                        color: isOpen ? (isSports ? '#4ade80' : '#00f3ff') : '#475569',
                        fontSize: 10, fontWeight: 900, letterSpacing: '0.18em', textTransform: 'uppercase',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        transition: 'all 0.2s',
                        boxShadow: isOpen ? (isSports ? '0 0 16px rgba(74,222,128,0.1)' : '0 0 16px rgba(0,243,255,0.08)') : 'none',
                    }}
                >
                    {isOpen ? (
                        <><Zap size={11} /> APOSTAR AHORA</>
                    ) : market.status === 'RESOLVED' ? (
                        <><Trophy size={11} /> VER RESULTADO</>
                    ) : (
                        <><CheckCircle size={11} /> VER DETALLES</>
                    )}
                </button>
            </div>
        </div>
    );
}

// ─── Price Chart Component ────────────────────────────────────────────────────
function PriceChart({ chartData, options }: { chartData: ChartPoint[]; options: PredictionOption[] }) {
    if (chartData.length < 2) {
        return (
            <div style={{
                background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 20, padding: '20px 24px', marginBottom: 16, backdropFilter: 'blur(20px)',
            }}>
                <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#00f3ff', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ display: 'inline-block', width: 3, height: 12, background: 'linear-gradient(#6366f1,#00f3ff)', borderRadius: 100 }} />
                    PRECIO EN VIVO
                </p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 32, height: 80 }}>
                    {options.map((opt, idx) => {
                        const pct = chartData[0] ? Number(chartData[0][opt.label]) : (100 / options.length);
                        const color = OPT_COLORS[idx % OPT_COLORS.length];
                        return (
                            <div key={opt.id} style={{ textAlign: 'center' }}>
                                <p style={{ fontSize: 30, fontWeight: 900, fontFamily: 'monospace', color, textShadow: `0 0 20px ${color}60` }}>{pct.toFixed(1)}%</p>
                                <p style={{ fontSize: 9, color: '#475569', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: 6 }}>{opt.label}</p>
                            </div>
                        );
                    })}
                </div>
                <p style={{ fontSize: 9, color: '#1e293b', textAlign: 'center', fontFamily: 'monospace', marginTop: 8 }}>Sin apuestas aún · Precio inicial 50/50</p>
            </div>
        );
    }

    return (
        <div style={{
            background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 20, padding: '20px 24px', marginBottom: 16, backdropFilter: 'blur(20px)',
            position: 'relative', overflow: 'hidden',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#00f3ff', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ display: 'inline-block', width: 3, height: 12, background: 'linear-gradient(#6366f1,#00f3ff)', borderRadius: 100 }} />
                        PRECIO EN VIVO
                    </p>
                    <span style={{ position: 'relative', display: 'flex', width: 8, height: 8 }}>
                        <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#00f3ff', opacity: 0.5, animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite' }} />
                        <span style={{ position: 'relative', width: 8, height: 8, borderRadius: '50%', background: '#00f3ff' }} />
                    </span>
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                    {options.map((opt, idx) => {
                        const lastPt = chartData[chartData.length - 1];
                        const val = lastPt ? Number(lastPt[opt.label]) : 0;
                        const color = CHART_COLORS[idx % CHART_COLORS.length];
                        return (
                            <div key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}`, animation: 'pulse 1.4s infinite' }} />
                                <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8' }}>{opt.label}</span>
                                <span style={{ fontSize: 11, fontWeight: 900, fontFamily: 'monospace', color }}>{val.toFixed(1)}%</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div style={{ height: 160, position: 'relative' }}>
                {/* Scan line */}
                <div style={{
                    position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 10,
                }}>
                    <div className="animate-scan" style={{
                        width: '100%', height: 2,
                        background: 'linear-gradient(90deg, transparent, rgba(0,243,255,0.4), transparent)',
                    }} />
                </div>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <defs>
                            {options.map((opt, idx) => {
                                const color = CHART_COLORS[idx % CHART_COLORS.length];
                                return (
                                    <linearGradient key={opt.id} id={`grad_${opt.id}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                                        <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                                    </linearGradient>
                                );
                            })}
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="time" tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}%`} />
                        <Tooltip content={<ChartTooltip />} />
                        {options.map((opt, idx) => {
                            const color = CHART_COLORS[idx % CHART_COLORS.length];
                            return (
                                <Area key={opt.id} type="monotoneX" dataKey={opt.label}
                                    stroke={color} strokeWidth={2.5}
                                    fill={`url(#grad_${opt.id})`}
                                    dot={false}
                                    activeDot={{ r: 6, fill: color, stroke: '#020817', strokeWidth: 2, style: { filter: `drop-shadow(0 0 8px ${color})` } }}
                                    isAnimationActive={true}
                                    animationDuration={1200}
                                    animationEasing="ease-out"
                                    style={{ filter: `drop-shadow(0 0 6px ${color}70)` }} />
                            );
                        })}
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

// ─── Countdown Badge ─────────────────────────────────────────────────────────
function CountdownBadge({ closesAt }: { closesAt: string }) {
    const timeLeft = useCountdown(closesAt);
    const isUrgent = new Date(closesAt).getTime() - Date.now() < 3600000;
    return (
        <span style={{
            display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'monospace',
            color: isUrgent ? '#f87171' : '#4ade80', fontWeight: 800,
            animation: isUrgent ? 'pulse 1s infinite' : 'none',
        }}>
            <Zap size={11} /> {timeLeft}
        </span>
    );
}
