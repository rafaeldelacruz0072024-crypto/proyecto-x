import React, { useState } from 'react';
import {
    X, ChevronRight, ChevronLeft, Target, TrendingUp, DollarSign,
    CheckCircle, Trophy, Zap, AlertTriangle, BarChart2, Users,
    ArrowRight, Percent, Clock, Shield, HelpCircle, BookOpen
} from 'lucide-react';

interface Step {
    id: number;
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    color: string;
    content: React.ReactNode;
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const S = {
    card: {
        background: 'rgba(15,23,42,0.8)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
        padding: 'clamp(12px, 2.5vw, 18px) clamp(14px, 3vw, 20px)',
        backdropFilter: 'blur(20px)',
    } as React.CSSProperties,
    label: {
        fontSize: 9, fontWeight: 800, letterSpacing: '0.2em',
        textTransform: 'uppercase' as const, color: '#475569',
    },
    h3: {
        fontSize: 15, fontWeight: 900, color: '#f1f5f9', marginBottom: 8,
    },
    p: {
        fontSize: 13, color: '#94a3b8', lineHeight: 1.65,
    },
    highlight: (color: string) => ({
        background: `${color}15`,
        border: `1px solid ${color}30`,
        borderRadius: 10,
        padding: '12px 16px',
        color,
        fontSize: 13,
        fontWeight: 700,
    } as React.CSSProperties),
    exampleBox: {
        background: 'rgba(5,7,18,0.8)',
        border: '1px solid rgba(0,243,255,0.15)',
        borderRadius: 16,
        padding: '20px',
    } as React.CSSProperties,
};

// ─── Mini animated bar ────────────────────────────────────────────────────────
function MiniBar({ pct, color, label, value }: { pct: number; color: string; label: string; value: string }) {
    return (
        <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#cbd5e1' }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 900, color, fontFamily: 'monospace' }}>{value}</span>
            </div>
            <div style={{ height: 10, borderRadius: 100, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                <div style={{
                    height: '100%', borderRadius: 100,
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, ${color}bb, ${color})`,
                    boxShadow: `0 0 10px ${color}50`,
                }} />
            </div>
        </div>
    );
}

// ─── Step content definitions ─────────────────────────────────────────────────
const STEPS: Step[] = [
    {
        id: 1,
        icon: <BookOpen size={22} />,
        title: '¿Qué es un Mercado de Predicción?',
        subtitle: 'El concepto básico',
        color: '#00f3ff',
        content: (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <p style={S.p}>
                    Un <strong style={{ color: '#f1f5f9' }}>mercado de predicción</strong> es un lugar donde apuestas sobre el resultado de eventos del mundo real — política, deportes, economía, crypto — usando dinero real.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                    {[
                        { icon: '🌍', title: 'Eventos reales', desc: '¿Subirá Bitcoin a $120K? ¿Quién gana las elecciones? ¿Habrá recesión?' },
                        { icon: '📊', title: 'Probabilidades vivas', desc: 'Los precios se mueven en tiempo real según lo que apuestan los traders.' },
                        { icon: '💵', title: 'Dinero real', desc: 'Apuestas con tu saldo USDT. Si aciertas, cobras. Simple.' },
                        { icon: '⚖️', title: 'Mercado justo', desc: 'Los precios los fija el mercado, no la casa. 100% transparente.' },
                    ].map((c, i) => (
                        <div key={i} style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <span style={{ fontSize: 22 }}>{c.icon}</span>
                            <div style={{ fontSize: 12, fontWeight: 800, color: '#f1f5f9' }}>{c.title}</div>
                            <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>{c.desc}</div>
                        </div>
                    ))}
                </div>

                <div style={{ ...S.highlight('#00f3ff'), display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <Zap size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>En NOVA DIGITAL tienes acceso a <strong>mercados propios</strong> creados por el equipo Y a <strong>mercados globales de Polymarket</strong> — el mayor exchange de predicciones del mundo.</span>
                </div>
            </div>
        ),
    },
    {
        id: 2,
        icon: <Percent size={22} />,
        title: '¿Cómo funcionan los precios?',
        subtitle: 'Entendiendo las probabilidades',
        color: '#a855f7',
        content: (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <p style={S.p}>
                    Cada opción tiene un <strong style={{ color: '#f1f5f9' }}>precio entre 0% y 100%</strong>. Ese precio representa la probabilidad que el mercado le asigna a ese resultado.
                </p>

                <div style={S.exampleBox}>
                    <div style={{ ...S.label, marginBottom: 12 }}>📌 EJEMPLO REAL</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', marginBottom: 14 }}>
                        "¿Bitcoin superará $120,000 antes del Q3 2025?"
                    </div>
                    <MiniBar pct={73} color="#4ade80" label="SÍ" value="73%" />
                    <MiniBar pct={27} color="#f87171" label="NO" value="27%" />
                    <div style={{ fontSize: 11, color: '#475569', marginTop: 8 }}>
                        El mercado cree que hay un <span style={{ color: '#4ade80', fontWeight: 800 }}>73% de probabilidad</span> de que BTC supere $120K.
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                    <div style={S.card}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#4ade80', marginBottom: 6 }}>💚 Si el precio es ALTO (70%+)</div>
                        <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>El mercado cree que ES muy probable que pase. Apostar SÍ es más caro, pero si aciertas, ganas menos.</div>
                    </div>
                    <div style={S.card}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#f87171', marginBottom: 6 }}>❤️ Si el precio es BAJO (20%-)</div>
                        <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>El mercado cree que NO pasará. Apostar SÍ es barato. Si aciertas, la ganancia es ENORME.</div>
                    </div>
                </div>

                <div style={{ ...S.highlight('#a855f7'), display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <BarChart2 size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>Los precios <strong>cambian en tiempo real</strong> cada vez que alguien apuesta. Si mucha gente apuesta SÍ, el precio de SÍ sube y el de NO baja automáticamente.</span>
                </div>
            </div>
        ),
    },
    {
        id: 3,
        icon: <Target size={22} />,
        title: '¿Cómo hacer una apuesta?',
        subtitle: 'Paso a paso con ejemplo',
        color: '#6366f1',
        content: (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                    {
                        num: '1',
                        color: '#6366f1',
                        title: 'Elige un mercado',
                        desc: 'Busca un evento sobre el que tengas una opinión. Puede ser crypto, deportes, política, economía...',
                        example: '"¿La Fed reducirá tasas en Junio 2025?" — Precio actual: SÍ al 61%',
                    },
                    {
                        num: '2',
                        color: '#00f3ff',
                        title: 'Selecciona tu opción',
                        desc: 'Haz clic en "SÍ" si crees que va a pasar, o "NO" si crees que no. El precio que ves es tu costo por share.',
                        example: 'Seleccionas SÍ → precio 0.61 USDT por share',
                    },
                    {
                        num: '3',
                        color: '#4ade80',
                        title: 'Ingresa tu monto',
                        desc: 'Escribe cuánto quieres apostar en USDT. El sistema te calcula cuántos shares recibes y cuánto ganarías.',
                        example: 'Apuestas $50 → recibes 81.9 shares',
                    },
                    {
                        num: '4',
                        color: '#fbbf24',
                        title: 'Confirma y listo',
                        desc: 'Haz clic en APOSTAR. El monto se descuenta de tu wallet instantáneamente. Tu posición queda registrada.',
                        example: 'Tu wallet: -$50 · Shares en posición: 81.9',
                    },
                ].map((step, i) => (
                    <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                            background: `${step.color}20`, border: `2px solid ${step.color}40`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 13, fontWeight: 900, color: step.color,
                        }}>{step.num}</div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: '#f1f5f9', marginBottom: 4 }}>{step.title}</div>
                            <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5, marginBottom: 6 }}>{step.desc}</div>
                            <div style={{
                                fontSize: 11, color: step.color, fontFamily: 'monospace', fontWeight: 700,
                                background: `${step.color}08`, padding: '6px 10px', borderRadius: 8,
                                border: `1px solid ${step.color}20`,
                            }}>→ {step.example}</div>
                        </div>
                    </div>
                ))}
            </div>
        ),
    },
    {
        id: 4,
        icon: <DollarSign size={22} />,
        title: '¿Cuánto gano si acierto?',
        subtitle: 'Cálculo de pagos con ejemplo real',
        color: '#4ade80',
        content: (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={S.exampleBox}>
                    <div style={{ ...S.label, marginBottom: 14 }}>🧮 EJEMPLO COMPLETO</div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 16 }}>
                        {[
                            { label: 'Tu apuesta', value: '$100', color: '#f1f5f9' },
                            { label: 'Precio del SÍ', value: '40%', color: '#00f3ff' },
                            { label: 'Shares recibidos', value: '250', color: '#a855f7' },
                            { label: 'Fee de la casa', value: '2%', color: '#fbbf24' },
                        ].map((d, i) => (
                            <div key={i} style={{ textAlign: 'center', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#475569', marginBottom: 4 }}>{d.label}</div>
                                <div style={{ fontSize: 18, fontWeight: 900, color: d.color, fontFamily: 'monospace' }}>{d.value}</div>
                            </div>
                        ))}
                    </div>

                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {[
                                { label: '→ Si aciertas (SÍ gana):', calc: '250 shares × $1 × (1 - 2%) = $245', color: '#4ade80', big: true },
                                { label: '→ Ganancia neta:', calc: '$245 - $100 invertido = +$145', color: '#4ade80', big: false },
                                { label: '→ Si fallas (NO gana):', calc: 'Pierdes los $100 apostados', color: '#f87171', big: false },
                            ].map((r, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: 10, background: `${r.color}08` }}>
                                    <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{r.label}</span>
                                    <span style={{ fontSize: r.big ? 16 : 12, fontWeight: 900, color: r.color, fontFamily: 'monospace' }}>{r.calc}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div style={S.card}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#fbbf24', marginBottom: 8 }}>📐 La fórmula es simple:</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#e2e8f0', lineHeight: 2 }}>
                        <div>Shares = Monto ÷ Precio de la opción</div>
                        <div>Pago = Shares × $1 × (1 - fee%)</div>
                        <div style={{ color: '#4ade80' }}>ROI = (Pago - Monto) ÷ Monto × 100%</div>
                    </div>
                </div>

                <div style={{ ...S.highlight('#4ade80'), display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <TrendingUp size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>Cuanto <strong>más baja la probabilidad</strong> de la opción que eliges, mayor es el ROI potencial. Un evento al 10% te puede pagar <strong>9x tu inversión</strong> si aciertas.</span>
                </div>
            </div>
        ),
    },
    {
        id: 5,
        icon: <Trophy size={22} />,
        title: '¿Cómo se resuelven los mercados?',
        subtitle: 'Cierre, resolución y cobro',
        color: '#fbbf24',
        content: (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                        {
                            phase: 'ABIERTO',
                            color: '#4ade80',
                            icon: '🟢',
                            title: 'Mercado activo',
                            desc: 'Puedes apostar libremente. Las probabilidades se mueven con cada apuesta. El pool crece.',
                        },
                        {
                            phase: 'CERRADO',
                            color: '#fbbf24',
                            icon: '🟡',
                            title: 'Apuestas cerradas',
                            desc: 'Ya no se aceptan nuevas apuestas. Las posiciones están fijas. Se espera el resultado.',
                        },
                        {
                            phase: 'RESUELTO',
                            color: '#00f3ff',
                            icon: '🔵',
                            title: 'Resultado confirmado',
                            desc: 'El equipo confirma el resultado (o el oráculo de Polymarket). Se calculan los pagos automáticamente.',
                        },
                        {
                            phase: 'PAGO',
                            color: '#a855f7',
                            icon: '💜',
                            title: 'Cobro instantáneo',
                            desc: 'Si apostaste al ganador, tu pago aparece en tu wallet en segundos. Sin demoras, sin formularios.',
                        },
                    ].map((ph, i) => (
                        <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', ...S.card }}>
                            <span style={{ fontSize: 20, flexShrink: 0 }}>{ph.icon}</span>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                    <span style={{
                                        fontSize: 8, fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase',
                                        padding: '2px 8px', borderRadius: 100,
                                        background: `${ph.color}15`, color: ph.color, border: `1px solid ${ph.color}30`,
                                    }}>{ph.phase}</span>
                                    <span style={{ fontSize: 12, fontWeight: 800, color: '#f1f5f9' }}>{ph.title}</span>
                                </div>
                                <p style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5, margin: 0 }}>{ph.desc}</p>
                            </div>
                            {i < 3 && (
                                <ArrowRight size={14} style={{ color: '#334155', flexShrink: 0, alignSelf: 'center' }} />
                            )}
                        </div>
                    ))}
                </div>

                <div style={{ ...S.highlight('#fbbf24'), display: 'flex', gap: 10 }}>
                    <Clock size={16} style={{ flexShrink: 0 }} />
                    <span>Para mercados de <strong>Polymarket</strong>, la resolución se basa en el resultado oficial del oráculo de Polymarket. Para mercados propios de NOVA DIGITAL, el equipo confirma el resultado.</span>
                </div>
            </div>
        ),
    },
    {
        id: 6,
        icon: <Shield size={22} />,
        title: 'Reglas y riesgos importantes',
        subtitle: 'Lee esto antes de apostar',
        color: '#f87171',
        content: (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ ...S.highlight('#f87171'), display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span><strong>Los mercados de predicción implican riesgo real.</strong> Puedes perder el dinero que apuestas si el resultado no es el que elegiste.</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                        {
                            icon: '✅',
                            color: '#4ade80',
                            title: 'Apuesta mínima: $1 USDT',
                            desc: 'Puedes empezar con poco para entender cómo funciona sin arriesgar mucho.',
                        },
                        {
                            icon: '💧',
                            color: '#00f3ff',
                            title: 'No hay "retiro parcial" de apuestas',
                            desc: 'Una vez que confirmas tu apuesta, no puedes cancelarla. Asegúrate antes de hacer clic en APOSTAR.',
                        },
                        {
                            icon: '⚖️',
                            color: '#a855f7',
                            title: 'Fee de la casa: 2%',
                            desc: 'NOVA DIGITAL cobra un 2% sobre el pago final solo si ganas. Si pierdes, no se cobra nada adicional.',
                        },
                        {
                            icon: '🔒',
                            color: '#fbbf24',
                            title: 'Mercados cancelados = reembolso',
                            desc: 'Si un mercado se cancela por cualquier razón, todas las apuestas se reembolsan automáticamente.',
                        },
                        {
                            icon: '📡',
                            color: '#818cf8',
                            title: 'Precios en tiempo real',
                            desc: 'El precio que ves puede cambiar entre que lo ves y que apuestas. El precio final es el del momento de confirmar.',
                        },
                        {
                            icon: '🚫',
                            color: '#f87171',
                            title: 'Solo para mayores de edad',
                            desc: 'Al apostar en NOVA DIGITAL confirmas que eres mayor de edad y que el juego está permitido en tu jurisdicción.',
                        },
                    ].map((rule, i) => (
                        <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: `1px solid ${rule.color}15` }}>
                            <span style={{ fontSize: 16, flexShrink: 0 }}>{rule.icon}</span>
                            <div>
                                <div style={{ fontSize: 12, fontWeight: 800, color: rule.color, marginBottom: 3 }}>{rule.title}</div>
                                <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>{rule.desc}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        ),
    },
    {
        id: 7,
        icon: <HelpCircle size={22} />,
        title: 'Preguntas frecuentes',
        subtitle: 'FAQ rápido',
        color: '#818cf8',
        content: (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                    {
                        q: '¿Puedo apostar a múltiples opciones del mismo mercado?',
                        a: 'Sí. Puedes apostar $X a SÍ y $Y a NO en el mismo mercado para cubrir ambos lados (hedging).',
                    },
                    {
                        q: '¿Qué pasa si dos personas apuestan lo mismo en el mismo mercado?',
                        a: 'El precio se ajusta según el volumen total del pool. Más gente apostando SÍ = precio de SÍ sube.',
                    },
                    {
                        q: '¿Por qué el precio cambió desde que lo vi hasta que aposté?',
                        a: 'Los precios son dinámicos. Mientras tú estás viendo el mercado, otras personas también están apostando. El precio final es el del bloque donde se procesa tu apuesta.',
                    },
                    {
                        q: '¿Cuánto tiempo tarda en llegarse el pago?',
                        a: 'Instantáneo. En el momento que el admin resuelve el mercado, el pago aparece en tu wallet automáticamente.',
                    },
                    {
                        q: '¿Qué es un mercado de Polymarket vs. uno de NOVA DIGITAL?',
                        a: 'Los mercados de Polymarket son eventos globales (política, macro, crypto) con millones en volumen. Los de NOVA DIGITAL son creados por el equipo y pueden incluir eventos locales o temáticos.',
                    },
                    {
                        q: '¿Cómo sé que el resultado es justo?',
                        a: 'Para mercados globales usamos el oráculo de Polymarket (verificado públicamente en blockchain). Para mercados propios, el equipo de NOVA DIGITAL confirma basándose en fuentes públicas verificables.',
                    },
                    {
                        q: '¿Puedo ver el historial de mis apuestas?',
                        a: 'Sí. Haz clic en "MIS APUESTAS" en la navegación del panel para ver todas tus posiciones activas, ganadas y perdidas.',
                    },
                ].map((faq, i) => (
                    <FAQItem key={i} q={faq.q} a={faq.a} />
                ))}
            </div>
        ),
    },
];

// ─── FAQ accordion item ───────────────────────────────────────────────────────
function FAQItem({ q, a }: { q: string; a: string }) {
    const [open, setOpen] = useState(false);
    return (
        <div style={{
            borderRadius: 12,
            border: `1px solid ${open ? 'rgba(129,140,248,0.25)' : 'rgba(255,255,255,0.06)'}`,
            background: open ? 'rgba(99,102,241,0.05)' : 'rgba(255,255,255,0.02)',
            overflow: 'hidden',
            transition: 'all 0.2s',
        }}>
            <button
                onClick={() => setOpen(!open)}
                style={{
                    width: '100%', padding: '14px 16px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                    background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                }}
            >
                <span style={{ fontSize: 12, fontWeight: 700, color: open ? '#818cf8' : '#cbd5e1', lineHeight: 1.4 }}>{q}</span>
                <ChevronRight size={14} style={{
                    color: '#475569', flexShrink: 0,
                    transform: open ? 'rotate(90deg)' : 'none',
                    transition: 'transform 0.2s',
                }} />
            </button>
            {open && (
                <div style={{ padding: '0 16px 14px', fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
                    {a}
                </div>
            )}
        </div>
    );
}

// ─── Main modal component ─────────────────────────────────────────────────────
export default function PredictionHowItWorks({ onClose }: { onClose: () => void }) {
    const [step, setStep] = useState(0);
    const current = STEPS[step];
    const isFirst = step === 0;
    const isLast = step === STEPS.length - 1;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 'clamp(8px, 3vw, 20px)',
            boxSizing: 'border-box',
        }}>
            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{
                    position: 'absolute', inset: 0,
                    background: 'rgba(2,8,23,0.92)',
                    backdropFilter: 'blur(12px)',
                }}
            />

            {/* Modal */}
            <div style={{
                position: 'relative', zIndex: 1,
                width: '100%', maxWidth: 'min(580px, 100%)',
                height: 'auto',
                maxHeight: 'calc(100dvh - 32px)',
                background: 'rgba(10,15,30,0.98)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 'clamp(16px, 4vw, 28px)',
                overflow: 'hidden',
                display: 'flex', flexDirection: 'column',
                boxShadow: '0 40px 120px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)',
            }}>
                {/* Top accent line */}
                <div style={{
                    height: 2,
                    background: `linear-gradient(90deg, transparent, ${current.color}, transparent)`,
                    transition: 'background 0.4s',
                }} />

                {/* Header */}
                <div style={{
                    padding: 'clamp(14px, 3vw, 20px) clamp(16px, 4vw, 24px) clamp(12px, 2vw, 16px)',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10,
                    flexShrink: 0,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                        <div style={{
                            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                            background: `${current.color}15`,
                            border: `1px solid ${current.color}30`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: current.color,
                            transition: 'all 0.3s',
                        }}>
                            {current.icon}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#475569', marginBottom: 3 }}>
                                ¿Cómo Funciona? · {step + 1} / {STEPS.length}
                            </div>
                            <div style={{ fontSize: 'clamp(13px, 3vw, 16px)', fontWeight: 900, color: '#f1f5f9', lineHeight: 1.3 }}>{current.title}</div>
                            <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{current.subtitle}</div>
                        </div>
                    </div>
                    <button onClick={onClose} style={{
                        width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#64748b', cursor: 'pointer',
                    }}>
                        <X size={16} />
                    </button>
                </div>

                {/* Progress dots */}
                <div style={{ display: 'flex', gap: 6, padding: '12px 24px 0', justifyContent: 'center' }}>
                    {STEPS.map((s, i) => (
                        <button
                            key={i}
                            onClick={() => setStep(i)}
                            style={{
                                height: 4, borderRadius: 100,
                                width: i === step ? 24 : 8,
                                background: i === step ? current.color : i < step ? `${current.color}40` : 'rgba(255,255,255,0.1)',
                                border: 'none', cursor: 'pointer', padding: 0,
                                transition: 'all 0.3s',
                                boxShadow: i === step ? `0 0 8px ${current.color}60` : 'none',
                            }}
                        />
                    ))}
                </div>

                {/* Content */}
                <div style={{
                    flex: 1, overflowY: 'auto', overflowX: 'hidden',
                    padding: 'clamp(14px, 3vw, 20px) clamp(14px, 4vw, 24px)',
                    WebkitOverflowScrolling: 'touch',
                }}>
                    {current.content}
                </div>

                {/* Footer nav */}
                <div style={{
                    padding: 'clamp(12px, 2vw, 16px) clamp(14px, 4vw, 24px)',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex', gap: 8, alignItems: 'center',
                    flexShrink: 0,
                }}>
                    <button
                        onClick={() => setStep(s => Math.max(0, s - 1))}
                        disabled={isFirst}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            padding: 'clamp(10px, 2vw, 12px) clamp(12px, 3vw, 20px)', borderRadius: 12,
                            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                            color: isFirst ? '#1e293b' : '#64748b',
                            fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
                            cursor: isFirst ? 'default' : 'pointer', whiteSpace: 'nowrap',
                        }}
                    >
                        <ChevronLeft size={13} /> ANTERIOR
                    </button>

                    <div style={{ flex: 1, textAlign: 'center', fontSize: 10, color: '#334155', fontWeight: 600 }}>
                        {step + 1} de {STEPS.length}
                    </div>

                    {isLast ? (
                        <button
                            onClick={onClose}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: 'clamp(10px, 2vw, 12px) clamp(14px, 3vw, 24px)', borderRadius: 12,
                                background: `linear-gradient(135deg, #6366f1, #00f3ff)`,
                                border: 'none', color: '#020817',
                                fontSize: 11, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase',
                                cursor: 'pointer', whiteSpace: 'nowrap',
                                boxShadow: '0 8px 24px rgba(99,102,241,0.3)',
                            }}
                        >
                            <CheckCircle size={13} /> ¡ENTENDIDO!
                        </button>
                    ) : (
                        <button
                            onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 5,
                                padding: 'clamp(10px, 2vw, 12px) clamp(14px, 3vw, 24px)', borderRadius: 12,
                                background: `${current.color}15`,
                                border: `1px solid ${current.color}30`,
                                color: current.color,
                                fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
                                cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap',
                            }}
                        >
                            SIGUIENTE <ChevronRight size={13} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Trigger button (to embed anywhere) ──────────────────────────────────────
export function HowItWorksButton({ onClick }: { onClick: () => void }) {
    return (
        <button onClick={onClick} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 16px', borderRadius: 12,
            background: 'rgba(129,140,248,0.08)',
            border: '1px solid rgba(129,140,248,0.2)',
            color: '#818cf8', fontSize: 11, fontWeight: 800,
            letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer',
            transition: 'all 0.2s',
        }}>
            <HelpCircle size={13} /> ¿Cómo Funciona?
        </button>
    );
}
