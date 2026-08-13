import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// ─── Funnel stages ────────────────────────────────────────────────────────────
const STAGES = [
  {
    id: 'atraccion',
    label: 'ATRACCIÓN',
    emoji: '🎯',
    color: '#a855f7',
    glow: 'rgba(168,85,247,0.3)',
    desc: 'Despierta curiosidad sin revelar el negocio. Habla de estilo de vida y libertad.',
    tip: 'No menciones el negocio todavía. Crea intriga con tu cambio de vida.',
  },
  {
    id: 'interes',
    label: 'INTERÉS',
    emoji: '💡',
    color: '#6366f1',
    glow: 'rgba(99,102,241,0.3)',
    desc: 'Educa sobre la oportunidad de Nova Digital. Muestra el potencial.',
    tip: 'Explica qué es Nova Digital sin presionar. Deja que la oportunidad hable sola.',
  },
  {
    id: 'deseo',
    label: 'DESEO',
    emoji: '🔥',
    color: '#f59e0b',
    glow: 'rgba(245,158,11,0.3)',
    desc: 'Genera prueba social y aspiración con tu testimonio real.',
    tip: 'Muestra resultados reales. El FOMO convierte más que cualquier argumento.',
  },
  {
    id: 'accion',
    label: 'ACCIÓN',
    emoji: '⚡',
    color: '#22c55e',
    glow: 'rgba(34,197,94,0.3)',
    desc: 'Lleva al prospecto a registrarse usando tu link de referido.',
    tip: 'CTA directo y urgente. Usa tu link de referido en todos los posts de acción.',
  },
  {
    id: 'fidelizacion',
    label: 'FIDELIZACIÓN',
    emoji: '👑',
    color: '#00f3ff',
    glow: 'rgba(0,243,255,0.3)',
    desc: 'Retén y activa a nuevos miembros. Celebra victorias del equipo.',
    tip: 'Un equipo activo multiplica tus ingresos. Motiva a tu red constantemente.',
  },
];

// ─── Platforms ────────────────────────────────────────────────────────────────
const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', icon: '📸', color: '#e1306c', bg: 'rgba(225,48,108,0.1)', border: 'rgba(225,48,108,0.3)' },
  { id: 'tiktok',    label: 'TikTok',    icon: '🎵', color: '#ff0050', bg: 'rgba(255,0,80,0.1)',   border: 'rgba(255,0,80,0.3)' },
  { id: 'facebook',  label: 'Facebook',  icon: '👥', color: '#1877f2', bg: 'rgba(24,119,242,0.1)', border: 'rgba(24,119,242,0.3)' },
  { id: 'whatsapp',  label: 'WhatsApp',  icon: '💬', color: '#25d366', bg: 'rgba(37,211,102,0.1)', border: 'rgba(37,211,102,0.3)' },
  { id: 'youtube',   label: 'YouTube',   icon: '▶️', color: '#ff0000', bg: 'rgba(255,0,0,0.1)',    border: 'rgba(255,0,0,0.3)' },
  { id: 'linkedin',  label: 'LinkedIn',  icon: '💼', color: '#0a66c2', bg: 'rgba(10,102,194,0.1)', border: 'rgba(10,102,194,0.3)' },
];

// ─── Tones ────────────────────────────────────────────────────────────────────
const TONES = [
  { id: 'casual',       label: 'Casual',       desc: 'Como con un amigo' },
  { id: 'profesional',  label: 'Profesional',  desc: 'Ejecutivo y preciso' },
  { id: 'emotivo',      label: 'Emotivo',      desc: 'Toca el corazón' },
  { id: 'motivacional', label: 'Motivacional', desc: 'Alta energía' },
];

// ─── History type ─────────────────────────────────────────────────────────────
interface GeneratedItem {
  id: string;
  platform: string;
  stage: string;
  tone: string;
  content: string;
  createdAt: string;
}

// ─── Copy button ──────────────────────────────────────────────────────────────
function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={copy} style={{
      padding: '10px 20px', borderRadius: 12, cursor: 'pointer',
      background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
      border: `1px solid ${copied ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)'}`,
      color: copied ? '#4ade80' : '#94a3b8',
      fontSize: 11, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase',
      display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s',
    }}>
      {copied ? '✓ COPIADO' : '📋 COPIAR'}
    </button>
  );
}

// ─── Platform preview mockup ──────────────────────────────────────────────────
function PlatformMockup({ platform, content, userName }: { platform: string; content: string; userName: string }) {
  const plat = PLATFORMS.find(p => p.id === platform) || PLATFORMS[0];
  const lines = content.split('\n').filter(Boolean);

  return (
    <div style={{
      background: 'rgba(5,5,15,0.9)', border: `1px solid ${plat.border}`,
      borderRadius: 20, overflow: 'hidden',
      boxShadow: `0 0 30px ${plat.bg}`,
    }}>
      {/* Platform header */}
      <div style={{
        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
        borderBottom: `1px solid rgba(255,255,255,0.05)`,
        background: plat.bg,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: `linear-gradient(135deg, ${plat.color}, ${plat.color}88)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18,
        }}>{plat.icon}</div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#f1f5f9' }}>{userName || 'Tu Perfil'}</div>
          <div style={{ fontSize: 9, color: plat.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{plat.label}</div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 10, color: '#334155' }}>ahora</div>
      </div>

      {/* Content */}
      <div style={{ padding: '16px', maxHeight: 280, overflowY: 'auto' }}>
        {lines.map((line, i) => {
          const isHashtag = line.trim().startsWith('#');
          const isHeader = line.startsWith('**') || line.toUpperCase() === line && line.length < 40;
          return (
            <p key={i} style={{
              fontSize: isHashtag ? 11 : 13,
              color: isHashtag ? plat.color : isHeader ? '#fff' : '#cbd5e1',
              fontWeight: isHeader ? 800 : 400,
              lineHeight: 1.6, marginBottom: 6,
              letterSpacing: isHeader ? '0.05em' : 'normal',
            }}>
              {line}
            </p>
          );
        })}
      </div>

      {/* Engagement row */}
      <div style={{
        padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.04)',
        display: 'flex', gap: 16,
      }}>
        {['❤️', '💬', '↗️'].map((icon, i) => (
          <span key={i} style={{ fontSize: 13, cursor: 'pointer', opacity: 0.6 }}>{icon}</span>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function MarketingFunnelPanel({ user }: { user: any }) {
  const [selectedStage, setSelectedStage] = useState(STAGES[0]);
  const [selectedPlatform, setSelectedPlatform] = useState(PLATFORMS[0]);
  const [selectedTone, setSelectedTone] = useState(TONES[0]);
  const [generating, setGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const [error, setError] = useState('');
  const [history, setHistory] = useState<GeneratedItem[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);

  // Form fields
  const [userName, setUserName] = useState(user?.user_metadata?.username || user?.email?.split('@')[0] || '');
  const [testimony, setTestimony] = useState('');
  const [targetAudience, setTargetAudience] = useState('emprendedores que buscan ingresos extra');
  const [referralLink, setReferralLink] = useState('');
  const [extraContext, setExtraContext] = useState('');

  // Load referral link and history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('nova_digital_marketing_history');
    if (saved) {
      try { setHistory(JSON.parse(saved)); } catch {}
    }
    const savedLink = localStorage.getItem('nova_digital_referral_link');
    if (savedLink) setReferralLink(savedLink);
  }, []);

  // Fetch referral link from profile
  useEffect(() => {
    if (user?.id) {
      supabase.from('profiles').select('ref_code, username').eq('id', user.id).single().then(({ data }) => {
        if (data?.ref_code && !referralLink) {
          const link = `${window.location.origin}?ref=${data.ref_code}`;
          setReferralLink(link);
          localStorage.setItem('nova_digital_referral_link', link);
        }
        if (data?.username && !userName) setUserName(data.username);
      });
    }
  }, [user?.id]);

  async function generate() {
    setGenerating(true);
    setError('');
    setGeneratedContent('');
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/marketing-ai`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON,
          Authorization: `Bearer ${SUPABASE_ANON}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform: selectedPlatform.id,
          stage: selectedStage.id,
          tone: selectedTone.id,
          userName,
          testimony,
          targetAudience,
          referralLink,
          extraContext,
          language: 'es',
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setGeneratedContent(data.content);

      // Save to history
      const item: GeneratedItem = {
        id: Date.now().toString(),
        platform: selectedPlatform.id,
        stage: selectedStage.id,
        tone: selectedTone.id,
        content: data.content,
        createdAt: new Date().toISOString(),
      };
      const newHistory = [item, ...history.slice(0, 9)];
      setHistory(newHistory);
      localStorage.setItem('nova_digital_marketing_history', JSON.stringify(newHistory));
    } catch (e: any) {
      setError(e.message || 'Error al generar contenido');
    } finally {
      setGenerating(false);
    }
  }

  const displayContent = activeHistoryId
    ? history.find(h => h.id === activeHistoryId)?.content || generatedContent
    : generatedContent;

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", color: '#fff' }}>
      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { background-position: -600px 0; } 100% { background-position: 600px 0; } }
        @keyframes typewriter { from { opacity: 0; } to { opacity: 1; } }
        .stage-btn:hover { transform: scale(1.03); }
        .plat-btn:hover { transform: translateY(-2px); }
        textarea { resize: vertical; }
        textarea:focus, input:focus { outline: none; }
      `}</style>

      {/* ── Header ── */}
      <div style={{
        background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(168,85,247,0.25)',
        borderRadius: 24, padding: '24px 28px', marginBottom: 24,
        position: 'relative', overflow: 'hidden',
        animation: 'fadeInUp 0.5s ease-out',
      }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, #a855f7, #00f3ff, #a855f7, transparent)' }} />
        <div style={{ position: 'absolute', top: -60, right: -60, width: 180, height: 180, borderRadius: '50%', background: 'rgba(168,85,247,0.08)', filter: 'blur(40px)', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 18,
              background: 'linear-gradient(135deg, #a855f7, #6366f1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, boxShadow: '0 0 30px rgba(168,85,247,0.4)',
            }}>🚀</div>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 900, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: "'Orbitron', sans-serif", margin: 0 }}>
                EMBUDO DE MARKETING IA
              </h1>
              <p style={{ fontSize: 10, color: '#64748b', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: 4 }}>
                Contenido viral generado por IA · Crece tu red en todas las plataformas
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['IA Generativa', 'Multi-Plataforma', 'Red de Referidos', 'Embudo de 5 Etapas'].map(tag => (
              <span key={tag} style={{
                fontSize: 8, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase',
                padding: '4px 10px', borderRadius: 100,
                border: '1px solid rgba(168,85,247,0.2)', color: '#64748b',
              }}>{tag}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Funnel Visualization ── */}
      <div style={{
        background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 24, padding: '24px', marginBottom: 24,
        animation: 'fadeInUp 0.5s ease-out 0.1s both',
      }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#64748b', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 3, height: 14, borderRadius: 100, background: 'linear-gradient(#a855f7, #00f3ff)' }} />
          SELECCIONA LA ETAPA DEL EMBUDO
        </div>

        {/* Funnel stages - horizontal on desktop */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
          {STAGES.map((stage, i) => {
            const isActive = selectedStage.id === stage.id;
            const width = 100 - i * 8;
            return (
              <div key={stage.id} className="stage-btn" onClick={() => setSelectedStage(stage)} style={{
                flex: 1,
                background: isActive ? `linear-gradient(135deg, ${stage.color}20, ${stage.color}08)` : 'rgba(255,255,255,0.02)',
                border: `1px solid ${isActive ? stage.color : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 16, padding: '16px 12px', cursor: 'pointer',
                textAlign: 'center', transition: 'all 0.25s cubic-bezier(0.16,1,0.3,1)',
                boxShadow: isActive ? `0 0 20px ${stage.glow}` : 'none',
                position: 'relative', overflow: 'hidden',
              }}>
                {isActive && (
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${stage.color}, transparent)` }} />
                )}
                <div style={{ fontSize: 22, marginBottom: 6 }}>{stage.emoji}</div>
                <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.15em', textTransform: 'uppercase', color: isActive ? stage.color : '#475569', marginBottom: 4 }}>
                  {stage.label}
                </div>
                <div style={{ fontSize: 9, color: isActive ? '#94a3b8' : '#334155', lineHeight: 1.4, display: i < 2 ? 'block' : 'none' }}>
                  {stage.desc}
                </div>
                {/* Funnel arrow */}
                {i < STAGES.length - 1 && (
                  <div style={{
                    position: 'absolute', right: -8, top: '50%', transform: 'translateY(-50%)',
                    color: '#334155', fontSize: 12, zIndex: 2,
                  }}>▶</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Active stage tip */}
        <div style={{
          marginTop: 12, padding: '10px 14px', borderRadius: 12,
          background: `linear-gradient(135deg, ${selectedStage.color}10, transparent)`,
          border: `1px solid ${selectedStage.color}25`,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 16 }}>💡</span>
          <span style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>
            <strong style={{ color: selectedStage.color }}>TIP {selectedStage.label}:</strong> {selectedStage.tip}
          </span>
        </div>
      </div>

      {/* ── Two column layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>

        {/* Left: Generator Form */}
        <div style={{
          background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 24, padding: '24px',
          animation: 'fadeInUp 0.5s ease-out 0.2s both',
        }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#64748b', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 3, height: 14, borderRadius: 100, background: 'linear-gradient(#6366f1, #00f3ff)' }} />
            CONFIGURAR CONTENIDO
          </div>

          {/* Platform selector */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: 10 }}>
              Plataforma
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {PLATFORMS.map(p => {
                const isActive = selectedPlatform.id === p.id;
                return (
                  <button key={p.id} className="plat-btn" onClick={() => setSelectedPlatform(p)} style={{
                    padding: '10px 8px', borderRadius: 14, cursor: 'pointer',
                    background: isActive ? p.bg : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isActive ? p.border : 'rgba(255,255,255,0.06)'}`,
                    color: isActive ? p.color : '#475569',
                    fontSize: 10, fontWeight: 800, letterSpacing: '0.1em',
                    transition: 'all 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    boxShadow: isActive ? `0 0 16px ${p.bg}` : 'none',
                  }}>
                    <span style={{ fontSize: 18 }}>{p.icon}</span>
                    <span style={{ textTransform: 'uppercase' }}>{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tone selector */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: 10 }}>
              Tono de Voz
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {TONES.map(t => {
                const isActive = selectedTone.id === t.id;
                return (
                  <button key={t.id} onClick={() => setSelectedTone(t)} style={{
                    padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
                    background: isActive ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isActive ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)'}`,
                    color: isActive ? '#818cf8' : '#475569',
                    textAlign: 'left', transition: 'all 0.2s',
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t.label}</div>
                    <div style={{ fontSize: 9, color: '#334155', marginTop: 2 }}>{t.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Personal info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Tu nombre', value: userName, setter: setUserName, placeholder: 'Tu nombre en redes', type: 'input' },
              { label: 'Audiencia objetivo', value: targetAudience, setter: setTargetAudience, placeholder: 'Ej: mamás que buscan ingresos desde casa', type: 'input' },
              { label: 'Tu link de referido', value: referralLink, setter: setReferralLink, placeholder: 'https://nova-digital.app?ref=TUCODE', type: 'input' },
              { label: 'Tu testimonio personal', value: testimony, setter: setTestimony, placeholder: 'Ej: Llevo 3 meses y ya generé mi primer $500...', type: 'textarea' },
              { label: 'Contexto adicional (opcional)', value: extraContext, setter: setExtraContext, placeholder: 'Ej: Promoción especial, evento, lanzamiento...', type: 'textarea' },
            ].map(field => (
              <div key={field.label}>
                <label style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: 6 }}>
                  {field.label}
                </label>
                {field.type === 'textarea' ? (
                  <textarea
                    value={field.value}
                    onChange={e => field.setter(e.target.value)}
                    placeholder={field.placeholder}
                    rows={2}
                    style={{
                      width: '100%', background: 'rgba(5,10,20,0.8)',
                      border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12,
                      padding: '10px 14px', color: '#e2e8f0', fontSize: 12,
                      fontFamily: 'inherit', boxSizing: 'border-box',
                    }}
                  />
                ) : (
                  <input
                    type="text"
                    value={field.value}
                    onChange={e => field.setter(e.target.value)}
                    placeholder={field.placeholder}
                    style={{
                      width: '100%', background: 'rgba(5,10,20,0.8)',
                      border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12,
                      padding: '10px 14px', color: '#e2e8f0', fontSize: 12,
                      fontFamily: 'inherit', boxSizing: 'border-box',
                    }}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Generate button */}
          <button
            onClick={generate}
            disabled={generating}
            style={{
              width: '100%', marginTop: 20, padding: '16px',
              background: generating ? 'rgba(168,85,247,0.1)' : 'linear-gradient(135deg, #a855f7, #6366f1)',
              border: generating ? '1px solid rgba(168,85,247,0.2)' : '1px solid transparent',
              borderRadius: 16, color: '#fff', fontSize: 12, fontWeight: 900,
              letterSpacing: '0.2em', textTransform: 'uppercase', cursor: generating ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              boxShadow: generating ? 'none' : '0 0 30px rgba(168,85,247,0.35)',
              transition: 'all 0.3s', fontFamily: "'Orbitron', sans-serif",
            }}
          >
            {generating ? (
              <>
                <div style={{ width: 16, height: 16, border: '2px solid rgba(168,85,247,0.3)', borderTopColor: '#a855f7', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                GENERANDO CON IA...
              </>
            ) : (
              <>🤖 GENERAR CONTENIDO CON IA</>
            )}
          </button>

          {/* Error */}
          {error && (
            <div style={{
              marginTop: 12, padding: '12px', borderRadius: 12,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              fontSize: 11, color: '#f87171',
            }}>
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* Right: Generated Content */}
        <div style={{
          background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 24, padding: '24px', display: 'flex', flexDirection: 'column',
          animation: 'fadeInUp 0.5s ease-out 0.3s both',
        }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#64748b', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 3, height: 14, borderRadius: 100, background: `linear-gradient(${selectedPlatform.color}, ${selectedPlatform.color}44)` }} />
              PREVIEW — {selectedPlatform.label}
            </div>
            {displayContent && <CopyBtn text={displayContent} />}
          </div>

          {/* Skeleton / Loading */}
          {generating && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Array(5).fill(0).map((_, i) => (
                <div key={i} style={{
                  height: i === 0 ? 48 : 16, borderRadius: 8,
                  background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.03) 75%)',
                  backgroundSize: '600px 100%', animation: 'shimmer 1.5s infinite',
                  width: i === 0 ? '100%' : `${70 + (i * 7) % 30}%`,
                }} />
              ))}
              <p style={{ textAlign: 'center', color: '#475569', fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: 20 }}>
                ✨ La IA está creando tu contenido...
              </p>
            </div>
          )}

          {/* Empty state */}
          {!generating && !displayContent && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🎨</div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8 }}>
                Tu contenido aparecerá aquí
              </p>
              <p style={{ fontSize: 11, color: '#1e293b', lineHeight: 1.6 }}>
                Selecciona la etapa del embudo, la plataforma y el tono. Luego haz click en <strong style={{ color: '#a855f7' }}>GENERAR</strong>.
              </p>
            </div>
          )}

          {/* Generated content */}
          {!generating && displayContent && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, animation: 'fadeInUp 0.4s ease-out' }}>
              <PlatformMockup
                platform={activeHistoryId ? history.find(h => h.id === activeHistoryId)?.platform || selectedPlatform.id : selectedPlatform.id}
                content={displayContent}
                userName={userName}
              />

              {/* Raw text editor */}
              <div>
                <label style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#334155', display: 'block', marginBottom: 6 }}>
                  Editar antes de publicar
                </label>
                <textarea
                  value={displayContent}
                  onChange={e => setGeneratedContent(e.target.value)}
                  rows={6}
                  style={{
                    width: '100%', background: 'rgba(5,10,20,0.9)',
                    border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12,
                    padding: '12px 14px', color: '#94a3b8', fontSize: 11,
                    fontFamily: 'monospace', boxSizing: 'border-box', lineHeight: 1.6,
                  }}
                />
              </div>

              {/* Platform tips */}
              <div style={{
                padding: '12px', borderRadius: 12,
                background: `linear-gradient(135deg, ${selectedPlatform.bg}, transparent)`,
                border: `1px solid ${selectedPlatform.border}`,
                fontSize: 10, color: '#64748b', lineHeight: 1.6,
              }}>
                <strong style={{ color: selectedPlatform.color }}>💡 {selectedPlatform.label}:</strong> {
                  selectedPlatform.id === 'instagram' ? 'Publica entre 6-9am o 6-9pm. Usa Stories para el link de referido.' :
                  selectedPlatform.id === 'tiktok' ? 'Graba en vertical. Usa trending sounds. Los primeros 3 segundos son clave.' :
                  selectedPlatform.id === 'facebook' ? 'Publica en grupos de emprendimiento. Incluye tu link en el primer comentario.' :
                  selectedPlatform.id === 'whatsapp' ? 'Envía primero a tus contactos más cercanos. Pide que lo reenvíen a 3 personas.' :
                  selectedPlatform.id === 'youtube' ? 'Optimiza el título con palabras clave. El thumbnail es el 70% de los clics.' :
                  'Conecta con profesionales. Usa el modo "creador" para mayor alcance.'
                }
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Content History ── */}
      {history.length > 0 && (
        <div style={{
          background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 24, padding: '24px',
          animation: 'fadeInUp 0.5s ease-out 0.4s both',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#64748b', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 3, height: 14, borderRadius: 100, background: 'linear-gradient(#f59e0b, #fbbf24)' }} />
              HISTORIAL DE CONTENIDO ({history.length})
            </div>
            <button onClick={() => {
              setHistory([]);
              setActiveHistoryId(null);
              localStorage.removeItem('nova_digital_marketing_history');
            }} style={{
              fontSize: 9, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase',
              padding: '5px 12px', borderRadius: 8, cursor: 'pointer',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              color: '#f87171',
            }}>
              LIMPIAR TODO
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {history.map(item => {
              const plat = PLATFORMS.find(p => p.id === item.platform) || PLATFORMS[0];
              const stage = STAGES.find(s => s.id === item.stage) || STAGES[0];
              const isActive = activeHistoryId === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setActiveHistoryId(isActive ? null : item.id);
                    if (!isActive) setGeneratedContent(item.content);
                  }}
                  style={{
                    padding: '14px', borderRadius: 16, cursor: 'pointer',
                    background: isActive ? 'rgba(168,85,247,0.08)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${isActive ? 'rgba(168,85,247,0.3)' : 'rgba(255,255,255,0.05)'}`,
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 14 }}>{plat.icon}</span>
                    <span style={{ fontSize: 9, fontWeight: 800, color: plat.color, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{plat.label}</span>
                    <span style={{ fontSize: 9, fontWeight: 800, color: stage.color, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{stage.emoji} {stage.label}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 8, color: '#334155' }}>
                      {new Date(item.createdAt).toLocaleDateString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                    {item.content.slice(0, 120)}...
                  </p>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <div onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(item.content); }} style={{
                      fontSize: 8, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
                      padding: '4px 10px', borderRadius: 8, cursor: 'pointer',
                      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#475569',
                    }}>
                      📋 COPIAR
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Strategy Guide ── */}
      <div style={{
        marginTop: 24,
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12,
        animation: 'fadeInUp 0.5s ease-out 0.5s both',
      }}>
        {[
          { icon: '📅', title: 'FRECUENCIA', desc: 'Publica 1-2 veces por día. La consistencia supera al contenido perfecto.' },
          { icon: '🎯', title: 'SEGMENTACIÓN', desc: 'No hables a todos. Define bien tu avatar de cliente ideal.' },
          { icon: '🔄', title: 'CICLO COMPLETO', desc: 'Rota las 5 etapas semanalmente. No siempre vendas, primero aporta valor.' },
          { icon: '📊', title: 'MIDE Y AJUSTA', desc: 'Revisa qué contenido genera más consultas y repite ese formato.' },
          { icon: '🤝', title: 'DUPLICA', desc: 'Comparte estos tips con tu equipo. Tu éxito depende del éxito de tu red.' },
        ].map(tip => (
          <div key={tip.icon} style={{
            background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: 16, padding: '16px',
          }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>{tip.icon}</div>
            <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#e2e8f0', marginBottom: 6 }}>{tip.title}</div>
            <div style={{ fontSize: 10, color: '#475569', lineHeight: 1.6 }}>{tip.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
