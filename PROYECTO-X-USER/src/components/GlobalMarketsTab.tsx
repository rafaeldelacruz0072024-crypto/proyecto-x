import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Globe, ExternalLink, Clock, Zap, Search, ChevronRight, TrendingUp, RefreshCw, BarChart2, Users } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────
interface PolyMarket {
    id: string;
    question: string;
    description: string;
    outcomes: string;
    outcomePrices: string;
    volume: number;
    volumeNum: number;
    endDate: string;
    category: string;
    active: boolean;
    closed: boolean;
    image: string;
    slug: string;
    tags: { label: string }[];
    priceHistory?: { t: number; p: number }[];
    dayChangePct?: number;
}

interface NovaDigitalMarket {
    id: string;
    polymarket_id: string;
    title: string;
    status: string;
    total_pool: number;
    options: { id: string; label: string; pool: number }[];
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// ─── Category config ─────────────────────────────────────────────────────────
const CAT_CONFIG: Record<string, { bg: string; text: string; border: string; emoji: string }> = {
    crypto:    { bg: 'rgba(251,191,36,0.1)',  text: '#fbbf24', border: 'rgba(251,191,36,0.25)',  emoji: '₿' },
    sports:    { bg: 'rgba(34,197,94,0.1)',   text: '#4ade80', border: 'rgba(34,197,94,0.25)',   emoji: '⚽' },
    politics:  { bg: 'rgba(168,85,247,0.1)',  text: '#c084fc', border: 'rgba(168,85,247,0.25)',  emoji: '🏛️' },
    economics: { bg: 'rgba(99,102,241,0.1)',  text: '#818cf8', border: 'rgba(99,102,241,0.25)',  emoji: '📈' },
    science:   { bg: 'rgba(0,243,255,0.1)',   text: '#00f3ff', border: 'rgba(0,243,255,0.25)',   emoji: '🔬' },
    pop:       { bg: 'rgba(251,113,133,0.1)', text: '#fb7185', border: 'rgba(251,113,133,0.25)', emoji: '🎬' },
    tech:      { bg: 'rgba(0,243,255,0.1)',   text: '#00f3ff', border: 'rgba(0,243,255,0.25)',   emoji: '💻' },
    default:   { bg: 'rgba(100,116,139,0.1)', text: '#94a3b8', border: 'rgba(100,116,139,0.25)', emoji: '🌐' },
};

function getCatConfig(cat: string) {
    const key = cat?.toLowerCase().split('/')[0].trim() || 'default';
    return CAT_CONFIG[key] || CAT_CONFIG.default;
}

function parseJSON<T>(str: string, fallback: T): T {
    try { return JSON.parse(str); } catch { return fallback; }
}

function timeLeft(endDate: string) {
    const diff = new Date(endDate).getTime() - Date.now();
    if (diff <= 0) return 'Cerrado';
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    if (d > 0) return `${d}d ${h}h`;
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h ${m}m`;
}

function fmtVol(v: number) {
    if (v > 1e6) return `$${(v / 1e6).toFixed(1)}M`;
    if (v > 1e3) return `$${(v / 1e3).toFixed(0)}K`;
    return `$${v?.toFixed(0) || '0'}`;
}

// ─── Sparkline generator ─────────────────────────────────────────────────────
function buildSparkPath(yesProb: number, marketId: string, w = 300, h = 44): { path: string; areaPath: string } {
    const seed = marketId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const N = 18;
    const pts: number[] = [];
    let cur = 40 + (seed % 30);
    for (let i = 0; i < N; i++) {
        const r = ((seed * (i + 13) * 1103515245 + 12345) & 0x7fffffff) % 1000 / 1000;
        const bias = (yesProb - cur) * 0.15;
        cur = Math.max(5, Math.min(95, cur + (r - 0.48) * 14 + bias));
        pts.push(cur);
    }
    pts.push(Math.max(5, Math.min(95, yesProb)));

    const xs = pts.map((_, i) => (i / (pts.length - 1)) * w);
    const ys = pts.map(p => h - (p / 100) * h);

    const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
    const areaPath = path + ` L${w},${h} L0,${h} Z`;

    return { path, areaPath };
}

// ─── Animated probability bar ────────────────────────────────────────────────
function ProbBar({ pct, color }: { pct: number; color: string }) {
    const [w, setW] = useState(0);
    useEffect(() => { const t = setTimeout(() => setW(pct), 120); return () => clearTimeout(t); }, [pct]);
    return (
        <div style={{ height: 10, borderRadius: 100, background: 'rgba(255,255,255,0.05)', overflow: 'hidden', position: 'relative' }}>
            <div style={{
                height: '100%', borderRadius: 100,
                width: `${Math.max(2, w)}%`,
                background: `linear-gradient(90deg, ${color}99, ${color})`,
                boxShadow: `0 0 12px ${color}60`,
                transition: 'width 1.2s cubic-bezier(0.16,1,0.3,1)',
                position: 'relative',
            }}>
                <div style={{
                    position: 'absolute', right: 0, top: 0, bottom: 0, width: 3,
                    background: '#fff', borderRadius: '0 100px 100px 0',
                    boxShadow: `0 0 10px #fff`,
                }} />
            </div>
        </div>
    );
}

// ─── Live activity feed data ─────────────────────────────────────────────────
const ACTIVITY_POOL = [
    { type: 'yes', user: 'Alpha_X', action: 'apostó $800 en YES', market: 'BTC $100K' },
    { type: 'no',  user: 'VaultKing', action: 'apostó $400 en NO', market: 'ETH Flippening' },
    { type: 'win', user: 'CryptoFox', action: 'ganó $1,240', market: 'Fed Rate Cut' },
    { type: 'yes', user: 'Nexus_MX', action: 'apostó $650 en YES', market: 'AI Regulation' },
    { type: 'no',  user: 'SignalPro', action: 'apostó $300 en NO', market: 'BTC $100K' },
    { type: 'win', user: 'AlphaNode', action: 'ganó $560', market: 'Sports Market' },
    { type: 'yes', user: 'TradeBot7', action: 'apostó $1,100 en YES', market: 'Trump Tariffs' },
    { type: 'no',  user: 'GeminiWave', action: 'apostó $200 en NO', market: 'Oil Price' },
    { type: 'win', user: 'DataMiner', action: 'ganó $890', market: 'Crypto Market' },
    { type: 'yes', user: 'SkyTrader', action: 'apostó $750 en YES', market: 'Tech Index' },
];

// ─── Activity Feed component ─────────────────────────────────────────────────
function LiveActivityFeed() {
    const [items, setItems] = useState(ACTIVITY_POOL.slice(0, 5).map((a, i) => ({ ...a, id: i, ago: (i + 1) * 2 })));
    const counterRef = useRef(5);

    useEffect(() => {
        const interval = setInterval(() => {
            const next = ACTIVITY_POOL[counterRef.current % ACTIVITY_POOL.length];
            counterRef.current++;
            setItems(prev => [
                { ...next, id: counterRef.current, ago: 0 },
                ...prev.slice(0, 4).map(a => ({ ...a, ago: a.ago + 3 })),
            ]);
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    const dotColor = (type: string) => type === 'yes' ? '#4ade80' : type === 'win' ? '#fbbf24' : '#f87171';

    return (
        <div style={{
            background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 20, padding: '20px 22px', backdropFilter: 'blur(20px)',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                <div style={{ width: 3, height: 14, borderRadius: 100, background: 'linear-gradient(#6366f1,#00f3ff)' }} />
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#00f3ff' }}>
                    Actividad en Vivo
                </span>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px #4ade80', animation: 'pulse 1.4s ease-in-out infinite', marginLeft: 'auto' }} />
            </div>
            {items.map((item, i) => (
                <div key={item.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 0',
                    borderBottom: i < items.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    animation: i === 0 ? 'slideInActivity 0.4s ease-out' : 'none',
                    opacity: 1 - i * 0.15,
                }}>
                    <div style={{
                        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                        background: dotColor(item.type), boxShadow: `0 0 8px ${dotColor(item.type)}`,
                    }} />
                    <div style={{ flex: 1, fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>
                        <strong style={{ color: '#e2e8f0' }}>@{item.user}</strong> {item.action} · <span style={{ color: '#64748b' }}>{item.market}</span>
                    </div>
                    <div style={{ fontSize: 9, color: '#475569', flexShrink: 0 }}>
                        {item.ago === 0 ? 'ahora' : `${item.ago}m`}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Sparkline card SVG ──────────────────────────────────────────────────────
function SparklineChart({ yesProb, color, marketId, history = [] }: { yesProb: number; color: string; marketId: string; history?: { t: number; p: number }[] }) {
    const svgId = `spark-${marketId.replace(/[^a-z0-9]/gi, '')}`;
    const livePoints = history.map(point => Math.max(0, Math.min(100, point.p * 100)));
    const values = livePoints.length > 1 ? livePoints : null;
    const livePath = values?.map((value, index) => {
        const x = (index / (values.length - 1)) * 280;
        const y = 44 - (value / 100) * 44;
        return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const fallback = buildSparkPath(yesProb, marketId, 280, 44);
    const path = livePath || fallback.path;
    const areaPath = livePath ? `${livePath} L280,44 L0,44 Z` : fallback.areaPath;
    const lastPct = values?.[values.length - 1] ?? yesProb;
    return (
        <svg width="100%" height="44" viewBox="0 0 280 44" style={{ overflow: 'visible', display: 'block', margin: '10px 0' }}>
            <defs>
                <linearGradient id={svgId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.28" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <path d={areaPath} fill={`url(#${svgId})`} />
            <path d={path} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
            {/* Last point dot */}
            <circle cx="280" cy={44 - (lastPct / 100) * 44} r="3" fill={color} style={{ filter: `drop-shadow(0 0 5px ${color})` }} />
        </svg>
    );
}

// ─── Market Card ─────────────────────────────────────────────────────────────
function MarketCard({ market, pcts, outcomes, catCfg, novaDigitalMkt, vol, tl, featured, onBetClick }: {
    market: PolyMarket;
    pcts: number[];
    outcomes: string[];
    catCfg: ReturnType<typeof getCatConfig>;
    novaDigitalMkt?: NovaDigitalMarket;
    vol: string;
    tl: string;
    featured?: boolean;
    onBetClick?: () => void;
}) {
    const [hovered, setHovered] = useState(false);
    const [betHover, setBetHover] = useState<'yes' | 'no' | null>(null);

    const yesPct = pcts[0] ?? 50;
    const noPct = pcts[1] ?? 50;
    const isYesLeading = yesPct >= 50;

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                background: hovered ? 'rgba(20,30,55,0.95)' : 'rgba(15,23,42,0.8)',
                border: `1px solid ${featured ? 'rgba(99,102,241,0.35)' : hovered ? 'rgba(168,85,247,0.25)' : 'rgba(255,255,255,0.07)'}`,
                borderRadius: 22,
                padding: '22px 24px',
                position: 'relative',
                overflow: 'hidden',
                backdropFilter: 'blur(20px)',
                transform: hovered ? 'translateY(-3px)' : 'none',
                boxShadow: featured
                    ? '0 0 50px rgba(99,102,241,0.12)'
                    : hovered ? '0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(168,85,247,0.06)' : '0 4px 20px rgba(0,0,0,0.25)',
                transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
                cursor: 'default',
            }}
        >
            {/* Top accent gradient */}
            <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                background: featured
                    ? 'linear-gradient(90deg, transparent, #6366f1, #00f3ff, transparent)'
                    : `linear-gradient(90deg, transparent, ${catCfg.text}70, transparent)`,
                opacity: featured ? 1 : hovered ? 1 : 0,
                transition: 'opacity 0.3s',
            }} />

            {/* Corner glow */}
            {featured && (
                <div style={{
                    position: 'absolute', top: -40, right: -40, width: 120, height: 120,
                    borderRadius: '50%', background: 'rgba(99,102,241,0.12)', filter: 'blur(30px)',
                    pointerEvents: 'none',
                }} />
            )}

            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
                <div style={{ flex: 1 }}>
                    {/* Category badge */}
                    <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase',
                        padding: '4px 10px', borderRadius: 100,
                        background: catCfg.bg, color: catCfg.text, border: `1px solid ${catCfg.border}`,
                        marginBottom: 10,
                    }}>
                        <span style={{ fontSize: 11 }}>{catCfg.emoji}</span>
                        {market.category || 'General'}
                    </span>
                    <h3 style={{ fontSize: 13, fontWeight: 800, color: '#f1f5f9', lineHeight: 1.4, margin: 0 }}>
                        {market.question}
                    </h3>
                </div>

                {/* Volume + badge */}
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    <div style={{ fontSize: 15, fontWeight: 900, color: '#fbbf24', lineHeight: 1 }}>{vol}</div>
                    <div style={{ fontSize: 8, color: '#475569', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: 3 }}>volumen</div>
                    {featured && (
                        <div style={{
                            marginTop: 6, fontSize: 8, fontWeight: 900, letterSpacing: '0.15em', padding: '2px 7px',
                            background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)',
                            borderRadius: 100, textTransform: 'uppercase',
                        }}>★ TOP</div>
                    )}
                </div>
            </div>

            {/* Big YES / NO probability display */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 26, fontWeight: 900, color: '#4ade80', lineHeight: 1, textShadow: '0 0 20px rgba(74,222,128,0.4)' }}>
                        {yesPct.toFixed(0)}%
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                        {outcomes[0] || 'YES'}
                    </div>
                </div>

                <div style={{ flex: 1, padding: '0 14px' }}>
                    <ProbBar pct={yesPct} color="#4ade80" />
                </div>

                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 26, fontWeight: 900, color: '#f87171', lineHeight: 1, textShadow: '0 0 20px rgba(248,113,113,0.4)' }}>
                        {noPct.toFixed(0)}%
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                        {outcomes[1] || 'NO'}
                    </div>
                </div>
            </div>

            {/* Additional outcomes for multi-outcome markets */}
            {outcomes.length > 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
                    {outcomes.slice(2, 5).map((label, i) => {
                        const pct = pcts[i + 2] ?? 0;
                        const colors = ['#00f3ff', '#fbbf24', '#c084fc'];
                        return (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 9, color: '#64748b', width: 80, fontWeight: 600, flexShrink: 0 }}>{label}</span>
                                <div style={{ flex: 1, height: 5, borderRadius: 100, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${pct}%`, background: colors[i], borderRadius: 100, transition: 'width 1s ease' }} />
                                </div>
                                <span style={{ fontSize: 10, fontWeight: 800, color: colors[i], width: 36, textAlign: 'right' }}>{pct.toFixed(0)}%</span>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Sparkline */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                <span style={{ fontSize: 8, color: '#475569', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Movimiento de hoy</span>
                <span style={{ fontSize: 11, fontWeight: 900, color: (market.dayChangePct || 0) >= 0 ? '#4ade80' : '#f87171' }}>
                    {(market.dayChangePct || 0) >= 0 ? '+' : ''}{(market.dayChangePct || 0).toFixed(2)}%
                </span>
            </div>
            <SparklineChart yesProb={yesPct} color={isYesLeading ? '#4ade80' : '#f87171'} marketId={market.id} history={market.priceHistory} />

            {/* Footer: time + status */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Clock size={10} style={{ color: tl === 'Cerrado' ? '#475569' : '#94a3b8' }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: tl === 'Cerrado' ? '#475569' : '#94a3b8', fontFamily: 'monospace' }}>{tl}</span>
                </div>
                {novaDigitalMkt ? (
                    <div style={{
                        fontSize: 8, fontWeight: 900, letterSpacing: '0.2em', padding: '3px 9px',
                        background: 'rgba(0,243,255,0.1)', color: '#00f3ff', border: '1px solid rgba(0,243,255,0.2)',
                        borderRadius: 100, display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                        <Zap size={8} /> Nova Digital
                    </div>
                ) : (
                    <div style={{
                        fontSize: 8, fontWeight: 900, letterSpacing: '0.2em', padding: '3px 9px',
                        background: 'rgba(168,85,247,0.1)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.2)',
                        borderRadius: 100, display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                        <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#c084fc', animation: 'pulse 1.4s infinite' }} />
                        LIVE
                    </div>
                )}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
                <button
                    onMouseEnter={() => setBetHover('yes')}
                    onMouseLeave={() => setBetHover(null)}
                    onClick={novaDigitalMkt && onBetClick ? onBetClick : undefined}
                    style={{
                        flex: 1, padding: '11px 8px',
                        background: betHover === 'yes' ? 'rgba(34,197,94,0.2)' : 'rgba(34,197,94,0.08)',
                        border: `1px solid ${betHover === 'yes' ? 'rgba(34,197,94,0.5)' : 'rgba(34,197,94,0.2)'}`,
                        borderRadius: 12, color: '#4ade80',
                        fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase',
                        cursor: novaDigitalMkt ? 'pointer' : 'default',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                        boxShadow: betHover === 'yes' ? '0 0 20px rgba(34,197,94,0.15)' : 'none',
                        transition: 'all 0.2s',
                    }}
                >
                    ▲ YES · ${(yesPct / 100).toFixed(2)}
                </button>
                <button
                    onMouseEnter={() => setBetHover('no')}
                    onMouseLeave={() => setBetHover(null)}
                    onClick={novaDigitalMkt && onBetClick ? onBetClick : undefined}
                    style={{
                        flex: 1, padding: '11px 8px',
                        background: betHover === 'no' ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.08)',
                        border: `1px solid ${betHover === 'no' ? 'rgba(239,68,68,0.5)' : 'rgba(239,68,68,0.2)'}`,
                        borderRadius: 12, color: '#f87171',
                        fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase',
                        cursor: novaDigitalMkt ? 'pointer' : 'default',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                        boxShadow: betHover === 'no' ? '0 0 20px rgba(239,68,68,0.15)' : 'none',
                        transition: 'all 0.2s',
                    }}
                >
                    ▼ NO · ${(noPct / 100).toFixed(2)}
                </button>
            </div>

            {/* NOVA Digital CTA overlay */}
            {novaDigitalMkt && onBetClick && (
                <button onClick={onBetClick} style={{
                    width: '100%', marginTop: 8, padding: '10px',
                    background: 'linear-gradient(135deg, rgba(0,243,255,0.1), rgba(99,102,241,0.1))',
                    border: '1px solid rgba(0,243,255,0.25)', borderRadius: 12,
                    color: '#00f3ff', fontSize: 10, fontWeight: 900,
                    letterSpacing: '0.2em', textTransform: 'uppercase', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    transition: 'all 0.2s',
                }}>
                    <Zap size={11} /> Apostar en Nova Digital <ChevronRight size={11} />
                </button>
            )}

            {!novaDigitalMkt && (
                <div style={{
                    marginTop: 8, fontSize: 9, color: '#1e293b', fontWeight: 600, textAlign: 'center',
                    padding: '6px 0', borderTop: '1px solid rgba(255,255,255,0.03)',
                }}>
                    Mercado de referencia · Ver en polymarket.com
                </div>
            )}
        </div>
    );
}

// ─── Top Markets mini-list ────────────────────────────────────────────────────
function TopMarketsPanel({ markets }: { markets: PolyMarket[] }) {
    const top5 = [...markets].sort((a, b) => (b.volumeNum || 0) - (a.volumeNum || 0)).slice(0, 5);
    return (
        <div style={{
            background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 20, padding: '20px 22px', backdropFilter: 'blur(20px)',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                <div style={{ width: 3, height: 14, borderRadius: 100, background: 'linear-gradient(#f59e0b,#fbbf24)' }} />
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#fbbf24' }}>
                    Top Volumen
                </span>
            </div>
            {top5.map((m, i) => {
                const prices: string[] = parseJSON(m.outcomePrices, ['0.5', '0.5']);
                const yesPct = parseFloat(prices[0]) * 100;
                const catCfg = getCatConfig(m.category);
                return (
                    <div key={m.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 0', borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    }}>
                        <div style={{
                            width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 900,
                            color: i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : i === 2 ? '#f97316' : '#334155',
                        }}>
                            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {m.question}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                <span style={{ fontSize: 9, color: catCfg.text }}>{catCfg.emoji} {m.category}</span>
                            </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 900, color: yesPct >= 50 ? '#4ade80' : '#f87171' }}>
                                {yesPct.toFixed(0)}%
                            </div>
                            <div style={{ fontSize: 9, color: '#475569', fontWeight: 600 }}>{fmtVol(m.volumeNum)}</div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function GlobalMarketsTab({ user, walletBalance, onUpdateBalance, onSelectNovaDigitalMarket }: {
    user: any;
    walletBalance: number;
    onUpdateBalance: () => void;
    onSelectNovaDigitalMarket: (market: NovaDigitalMarket) => void;
}) {
    const [markets, setMarkets] = useState<PolyMarket[]>([]);
    const [novaDigitalMarkets, setNovaDigitalMarkets] = useState<NovaDigitalMarket[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('all');
    const [categories, setCategories] = useState<string[]>([]);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const fetchPolymarket = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(
                `${SUPABASE_URL}/functions/v1/polymarket-proxy?limit=50&order=volumeNum`,
                { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } }
            );
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data: PolyMarket[] = await res.json();
            setMarkets(data);
            setLastUpdated(new Date());
            const cats = [...new Set(data.map(m => m.category).filter(Boolean))].sort();
            setCategories(cats);
        } catch (e: any) {
            setError('No se pudo conectar con Polymarket. Verifica tu conexión.');
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchNovaDigitalMarkets = useCallback(async () => {
        const { data } = await supabase
            .from('prediction_markets')
            .select('id, polymarket_id, title, status, total_pool, options')
            .not('polymarket_id', 'is', null)
            .in('status', ['OPEN', 'CLOSED']);
        setNovaDigitalMarkets(data || []);
    }, []);

    useEffect(() => {
        fetchPolymarket();
        fetchNovaDigitalMarkets();
        const interval = setInterval(() => { fetchPolymarket(); fetchNovaDigitalMarkets(); }, 120000);
        return () => clearInterval(interval);
    }, []);

    const filtered = markets.filter(m => {
        const matchSearch = search === '' || m.question.toLowerCase().includes(search.toLowerCase());
        const matchCat = category === 'all' || m.category === category;
        return matchSearch && matchCat;
    });

    function getNovaDigitalMarket(polyId: string) {
        return novaDigitalMarkets.find(g => g.polymarket_id === polyId);
    }

    const totalVol = markets.reduce((s, m) => s + (m.volumeNum || 0), 0);
    const activeCount = markets.filter(m => m.active && !m.closed).length;

    return (
        <div style={{ position: 'relative', fontFamily: "'Inter', sans-serif" }}>
            {/* CSS animations */}
            <style>{`
                @keyframes slideInActivity { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }
                @keyframes fadeInCard { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.7); } }
                @keyframes shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
            `}</style>

            {/* Ambient orbs */}
            <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)', top: -200, left: -200, pointerEvents: 'none', zIndex: 0 }} />
            <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,243,255,0.05) 0%, transparent 70%)', bottom: 0, right: -100, pointerEvents: 'none', zIndex: 0 }} />

            <div style={{ position: 'relative', zIndex: 1 }}>

                {/* ── Header ── */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '18px 24px', marginBottom: 20,
                    background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(99,102,241,0.2)',
                    borderRadius: 22, backdropFilter: 'blur(24px)',
                    position: 'relative', overflow: 'hidden',
                }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, #6366f1, #00f3ff, transparent)' }} />

                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{
                            width: 48, height: 48, borderRadius: 16,
                            background: 'linear-gradient(135deg, #6366f1, #00f3ff)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 0 28px rgba(99,102,241,0.4)',
                        }}>
                            <Globe size={22} style={{ color: '#020817' }} />
                        </div>
                        <div>
                            <div style={{ fontSize: 16, fontWeight: 900, color: '#f1f5f9', letterSpacing: '0.04em', fontFamily: "'Orbitron', sans-serif" }}>
                                MERCADOS GLOBALES
                            </div>
                            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: 2 }}>
                                Powered by Polymarket · {activeCount} mercados activos
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        {lastUpdated && (
                            <span style={{ fontSize: 9, color: '#334155', fontFamily: 'monospace' }}>
                                Act. {lastUpdated.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        )}
                        {/* Live badge */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 7,
                            background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)',
                            borderRadius: 100, padding: '7px 16px',
                            fontSize: 10, fontWeight: 800, letterSpacing: '0.2em', color: '#4ade80',
                        }}>
                            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px #4ade80', animation: 'pulse 1.4s infinite' }} />
                            LIVE
                        </div>
                        <button onClick={fetchPolymarket} disabled={loading} style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '8px 14px', borderRadius: 12,
                            background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)',
                            color: '#818cf8', fontSize: 10, fontWeight: 800, cursor: 'pointer',
                            letterSpacing: '0.1em', textTransform: 'uppercase',
                        }}>
                            <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                            ACTUALIZAR
                        </button>
                    </div>
                </div>

                {/* ── 4 Metrics ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
                    {[
                        { icon: <BarChart2 size={18} />, val: activeCount.toString(), label: 'Mercados Activos', color: '#4ade80', grad: '#4ade80' },
                        { icon: <TrendingUp size={18} />, val: `$${(totalVol / 1e6).toFixed(1)}M`, label: 'Volumen Total', color: '#fbbf24', grad: '#f59e0b' },
                        { icon: <Zap size={18} />, val: novaDigitalMarkets.length.toString(), label: 'En NOVA Digital', color: '#00f3ff', grad: '#0ea5e9' },
                        { icon: <Users size={18} />, val: categories.length.toString(), label: 'Categorías', color: '#c084fc', grad: '#a855f7' },
                    ].map((m, i) => (
                        <div key={i} style={{
                            background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: 18, padding: '18px 20px',
                            backdropFilter: 'blur(20px)', position: 'relative', overflow: 'hidden',
                        }}>
                            <div style={{
                                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                background: `linear-gradient(135deg, ${m.grad}15 0%, transparent 60%)`,
                            }} />
                            <div style={{ color: m.color, marginBottom: 10, position: 'relative' }}>{m.icon}</div>
                            <div style={{ fontSize: 24, fontWeight: 900, color: m.color, lineHeight: 1, position: 'relative' }}>{m.val}</div>
                            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#475569', marginTop: 5, position: 'relative' }}>{m.label}</div>
                        </div>
                    ))}
                </div>

                {/* ── Search & filter ── */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, position: 'relative', minWidth: 220 }}>
                        <Search size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar mercados..."
                            style={{
                                width: '100%', background: 'rgba(15,23,42,0.8)',
                                border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14,
                                padding: '11px 14px 11px 38px', color: '#fff', fontSize: 13, outline: 'none',
                                boxSizing: 'border-box', backdropFilter: 'blur(20px)',
                            }}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                        {['all', ...categories.slice(0, 6)].map(cat => {
                            const cfg = cat === 'all' ? null : getCatConfig(cat);
                            const isActive = category === cat;
                            return (
                                <button key={cat} onClick={() => setCategory(cat)} style={{
                                    padding: '9px 15px', borderRadius: 12,
                                    background: isActive ? (cfg ? cfg.bg : 'rgba(99,102,241,0.15)') : 'rgba(255,255,255,0.04)',
                                    border: `1px solid ${isActive ? (cfg ? cfg.border : 'rgba(99,102,241,0.35)') : 'rgba(255,255,255,0.07)'}`,
                                    color: isActive ? (cfg ? cfg.text : '#818cf8') : '#64748b',
                                    fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: 5,
                                }}>
                                    {cfg && <span>{cfg.emoji}</span>}
                                    {cat === 'all' ? 'TODOS' : cat}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ── Error ── */}
                {error && (
                    <div style={{
                        padding: '20px', borderRadius: 16, marginBottom: 20,
                        background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
                        color: '#f87171', fontSize: 13, fontWeight: 600, textAlign: 'center',
                    }}>
                        ⚠️ {error}
                    </div>
                )}

                {/* ── Skeleton loading ── */}
                {loading && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                        {Array(6).fill(0).map((_, i) => (
                            <div key={i} style={{
                                height: 280, borderRadius: 22,
                                background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%)',
                                backgroundSize: '800px 100%',
                                animation: 'shimmer 1.8s infinite',
                                border: '1px solid rgba(255,255,255,0.05)',
                            }} />
                        ))}
                    </div>
                )}

                {/* ── Main two-column layout ── */}
                {!loading && !error && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 20, alignItems: 'start' }}>

                        {/* Left: Market grid */}
                        <div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                                {filtered.map((market, idx) => {
                                    const outcomes: string[] = parseJSON(market.outcomes, ['Yes', 'No']);
                                    const prices: string[] = parseJSON(market.outcomePrices, ['0.5', '0.5']);
                                    const pcts = prices.map(p => parseFloat(p) * 100);
                                    const catCfg = getCatConfig(market.category);
                                    const novaDigitalMkt = getNovaDigitalMarket(market.id);
                                    const tl = timeLeft(market.endDate);
                                    const vol = fmtVol(market.volumeNum);

                                    return (
                                        <div key={market.id} style={{ animation: `fadeInCard 0.4s ease-out ${idx * 30}ms both` }}>
                                            <MarketCard
                                                market={market}
                                                pcts={pcts}
                                                outcomes={outcomes}
                                                catCfg={catCfg}
                                                novaDigitalMkt={novaDigitalMkt}
                                                vol={vol}
                                                tl={tl}
                                                featured={idx === 0}
                                                onBetClick={novaDigitalMkt ? () => onSelectNovaDigitalMarket(novaDigitalMkt) : undefined}
                                            />
                                        </div>
                                    );
                                })}
                                {filtered.length === 0 && (
                                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '80px 20px' }}>
                                        <Globe size={44} style={{ color: '#1e293b', margin: '0 auto 16px', display: 'block' }} />
                                        <p style={{ color: '#334155', fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', fontSize: 11 }}>
                                            Sin resultados para "{search}"
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right: Sidebar */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 20 }}>
                            <LiveActivityFeed />
                            {markets.length > 0 && <TopMarketsPanel markets={markets} />}
                        </div>
                    </div>
                )}

                {/* ── Attribution ── */}
                <div style={{
                    marginTop: 32, padding: '14px 20px',
                    background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
                }}>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {['Blockchain Verified', 'Real-Time Data', 'Non-Custodial', 'Polymarket Oracle'].map(tag => (
                            <span key={tag} style={{
                                fontSize: 8, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase',
                                padding: '4px 10px', borderRadius: 100, border: '1px solid rgba(255,255,255,0.07)', color: '#334155',
                            }}>{tag}</span>
                        ))}
                    </div>
                    <a href="https://polymarket.com" target="_blank" rel="noopener noreferrer" style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        fontSize: 10, color: '#334155', fontWeight: 700, textDecoration: 'none',
                    }}>
                        polymarket.com <ExternalLink size={10} />
                    </a>
                </div>
            </div>
        </div>
    );
}
