import React, { useState } from 'react';
import {
  Megaphone, Instagram, Youtube, Linkedin, Copy, Check,
  Sparkles, ChevronRight, RefreshCw, MessageCircle,
  Users, TrendingUp, Heart, Zap, Star,
} from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ─── Types ────────────────────────────────────────────────────────────────────

type Platform = 'instagram' | 'tiktok' | 'facebook' | 'whatsapp' | 'youtube' | 'linkedin';
type Stage = 'atraccion' | 'interes' | 'deseo' | 'accion' | 'fidelizacion';
type Tone = 'profesional' | 'casual' | 'emotivo' | 'motivacional';

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORMS: { id: Platform; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'instagram', label: 'Instagram', icon: <Instagram size={16} />, color: 'from-purple-500 to-pink-500' },
  { id: 'tiktok', label: 'TikTok', icon: <span className="font-black text-xs">TT</span>, color: 'from-slate-900 to-slate-700' },
  { id: 'facebook', label: 'Facebook', icon: <span className="font-black text-xs">FB</span>, color: 'from-blue-600 to-blue-500' },
  { id: 'whatsapp', label: 'WhatsApp', icon: <MessageCircle size={16} />, color: 'from-green-600 to-green-500' },
  { id: 'youtube', label: 'YouTube', icon: <Youtube size={16} />, color: 'from-red-600 to-red-500' },
  { id: 'linkedin', label: 'LinkedIn', icon: <Linkedin size={16} />, color: 'from-blue-700 to-blue-600' },
];

const STAGES: { id: Stage; label: string; emoji: string; desc: string; color: string; icon: React.ReactNode }[] = [
  { id: 'atraccion', label: 'Atracción', emoji: '🎯', desc: 'Despertar curiosidad sin revelar el negocio', color: 'border-violet-500/40 bg-violet-500/5 text-violet-400', icon: <Star size={14} /> },
  { id: 'interes', label: 'Interés', emoji: '💡', desc: 'Educar sobre la oportunidad GEMINIX', color: 'border-blue-500/40 bg-blue-500/5 text-blue-400', icon: <TrendingUp size={14} /> },
  { id: 'deseo', label: 'Deseo', emoji: '🔥', desc: 'Prueba social + crear FOMO', color: 'border-orange-500/40 bg-orange-500/5 text-orange-400', icon: <Heart size={14} /> },
  { id: 'accion', label: 'Acción', emoji: '⚡', desc: 'CTA directo para registro con referido', color: 'border-green-500/40 bg-green-500/5 text-green-400', icon: <Zap size={14} /> },
  { id: 'fidelizacion', label: 'Fidelización', emoji: '🤝', desc: 'Retener y activar nuevos miembros', color: 'border-cyan-500/40 bg-cyan-500/5 text-cyan-400', icon: <Users size={14} /> },
];

const TONES: { id: Tone; label: string; desc: string }[] = [
  { id: 'profesional', label: 'Profesional', desc: 'Ejecutivo, datos y ROI' },
  { id: 'casual', label: 'Casual', desc: 'Como hablar con un amigo' },
  { id: 'emotivo', label: 'Emotivo', desc: 'Sueños, familia, libertad' },
  { id: 'motivacional', label: 'Motivacional', desc: 'Energético, coach, impacto' },
];

// ─── Component ────────────────────────────────────────────────────────────────

const Marketing: React.FC = () => {
  const [platform, setPlatform] = useState<Platform>('instagram');
  const [stage, setStage] = useState<Stage>('atraccion');
  const [tone, setTone] = useState<Tone>('casual');
  const [userName, setUserName] = useState('');
  const [targetAudience, setTargetAudience] = useState('emprendedores');
  const [testimony, setTestimony] = useState('');
  const [referralLink, setReferralLink] = useState('');
  const [extraContext, setExtraContext] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const currentStage = STAGES.find(s => s.id === stage)!;
  const currentPlatform = PLATFORMS.find(p => p.id === platform)!;

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    setGeneratedContent('');
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/marketing-ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ platform, stage, tone, userName, targetAudience, testimony, referralLink, extraContext }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setGeneratedContent(data.content || '');
    } catch (e: any) {
      setError(e.message || 'Error al generar contenido');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!generatedContent) return;
    navigator.clipboard.writeText(generatedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
          <Megaphone size={22} className="text-purple-400" />
        </div>
        <div>
          <h1 className="text-xl font-black text-white uppercase tracking-widest">Marketing Hub</h1>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Generador de Contenido con IA · Embudo GEMINIX</p>
        </div>
      </div>

      {/* Funnel Visual */}
      <div className="bg-[#0c0c0e] border border-slate-800/50 rounded-3xl p-6">
        <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] mb-4">Etapas del Embudo</p>
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {STAGES.map((s, i) => (
            <React.Fragment key={s.id}>
              <button
                onClick={() => setStage(s.id)}
                className={`flex-shrink-0 flex flex-col items-center gap-1.5 px-4 py-3 rounded-2xl border transition-all ${
                  stage === s.id
                    ? s.color + ' shadow-lg scale-105'
                    : 'border-slate-800/50 bg-slate-900/30 text-slate-500 hover:border-slate-700 hover:text-slate-300'
                }`}
              >
                <span className="text-xl">{s.emoji}</span>
                <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">{s.label}</span>
                <span className="text-[9px] text-center leading-tight max-w-[90px] opacity-70 hidden sm:block">{s.desc}</span>
              </button>
              {i < STAGES.length - 1 && (
                <ChevronRight size={14} className="flex-shrink-0 text-slate-700" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Config Form */}
        <div className="space-y-5">
          {/* Platform */}
          <div className="bg-[#0c0c0e] border border-slate-800/50 rounded-3xl p-5">
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] mb-3">Plataforma</p>
            <div className="grid grid-cols-3 gap-2">
              {PLATFORMS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setPlatform(p.id)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all ${
                    platform === p.id
                      ? `bg-gradient-to-br ${p.color} border-transparent text-white shadow-lg`
                      : 'border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-300'
                  }`}
                >
                  {p.icon}
                  <span className="text-[10px] font-black uppercase tracking-widest">{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tone */}
          <div className="bg-[#0c0c0e] border border-slate-800/50 rounded-3xl p-5">
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] mb-3">Tono de Voz</p>
            <div className="grid grid-cols-2 gap-2">
              {TONES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTone(t.id)}
                  className={`flex flex-col gap-0.5 p-3 rounded-2xl border text-left transition-all ${
                    tone === t.id
                      ? 'border-blue-500/40 bg-blue-500/10 text-blue-400'
                      : 'border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-300'
                  }`}
                >
                  <span className="text-[10px] font-black uppercase tracking-widest">{t.label}</span>
                  <span className="text-[9px] opacity-70">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* User Data */}
          <div className="bg-[#0c0c0e] border border-slate-800/50 rounded-3xl p-5 space-y-3">
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">Datos del Usuario</p>

            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Nombre</label>
              <input
                value={userName}
                onChange={e => setUserName(e.target.value)}
                placeholder="Ej: Carlos Mendoza"
                className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50"
              />
            </div>

            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Audiencia Objetivo</label>
              <input
                value={targetAudience}
                onChange={e => setTargetAudience(e.target.value)}
                placeholder="Ej: emprendedores, amas de casa, jóvenes..."
                className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50"
              />
            </div>

            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                Testimonio Personal <span className="text-slate-700">(opcional)</span>
              </label>
              <textarea
                value={testimony}
                onChange={e => setTestimony(e.target.value)}
                placeholder="Ej: Este mes generé $500 con mis referidos sin salir de casa..."
                rows={2}
                className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 resize-none"
              />
            </div>

            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                Link de Referido <span className="text-slate-700">(opcional)</span>
              </label>
              <input
                value={referralLink}
                onChange={e => setReferralLink(e.target.value)}
                placeholder="https://geminixprotocol.com/ref/..."
                className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50"
              />
            </div>

            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                Contexto Extra <span className="text-slate-700">(opcional)</span>
              </label>
              <textarea
                value={extraContext}
                onChange={e => setExtraContext(e.target.value)}
                placeholder="Ej: Hay una promoción activa esta semana..."
                rows={2}
                className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 resize-none"
              />
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-lg shadow-purple-500/20"
          >
            {loading ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Generando con IA...
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Generar Contenido
              </>
            )}
          </button>
        </div>

        {/* Right: Generated Content */}
        <div className="space-y-4">
          {/* Stage + Platform Summary */}
          <div className="bg-[#0c0c0e] border border-slate-800/50 rounded-3xl p-4 flex items-center gap-4">
            <div className={`px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${currentStage.color}`}>
              {currentStage.emoji} {currentStage.label}
            </div>
            <ChevronRight size={14} className="text-slate-700" />
            <div className={`px-3 py-1.5 rounded-xl bg-gradient-to-r ${currentPlatform.color} text-[10px] font-black uppercase tracking-widest text-white`}>
              {currentPlatform.label}
            </div>
            <ChevronRight size={14} className="text-slate-700" />
            <div className="px-3 py-1.5 rounded-xl border border-slate-700 text-[10px] font-black uppercase tracking-widest text-slate-400">
              {TONES.find(t => t.id === tone)?.label}
            </div>
          </div>

          {/* Content Box */}
          <div className="bg-[#0c0c0e] border border-slate-800/50 rounded-3xl p-5 min-h-[400px] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">Contenido Generado</p>
              {generatedContent && (
                <button
                  onClick={handleCopy}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                    copied
                      ? 'border-green-500/40 bg-green-500/10 text-green-400'
                      : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white'
                  }`}
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? 'Copiado!' : 'Copiar'}
                </button>
              )}
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 mb-4">
                {error}
              </div>
            )}

            {loading && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-4 border-purple-500/20 border-t-purple-500 animate-spin" />
                  <Sparkles size={18} className="absolute inset-0 m-auto text-purple-400 animate-pulse" />
                </div>
                <div className="text-center">
                  <p className="text-xs font-black text-white uppercase tracking-widest">IA Generando...</p>
                  <p className="text-[10px] text-slate-500 mt-1">Creando contenido para {currentStage.label} en {currentPlatform.label}</p>
                </div>
              </div>
            )}

            {!loading && !generatedContent && !error && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
                <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center">
                  <Megaphone size={24} className="text-slate-600" />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Listo para generar</p>
                  <p className="text-[10px] text-slate-600 mt-1">
                    Configura la plataforma, etapa y tono,<br />luego pulsa "Generar Contenido"
                  </p>
                </div>
              </div>
            )}

            {!loading && generatedContent && (
              <div className="flex-1">
                <pre className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                  {generatedContent}
                </pre>
                <div className="mt-4 pt-4 border-t border-slate-800/50 flex items-center gap-2">
                  <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">
                    {generatedContent.length} caracteres
                  </span>
                  <span className="text-slate-700">·</span>
                  <span className="text-[9px] text-purple-500/70 font-bold uppercase tracking-widest flex items-center gap-1">
                    <Sparkles size={9} /> Generado por IA
                  </span>
                  <button
                    onClick={handleGenerate}
                    className="ml-auto text-[9px] font-black text-slate-500 uppercase tracking-widest hover:text-white flex items-center gap-1 transition-colors"
                  >
                    <RefreshCw size={10} /> Regenerar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Tips per stage */}
          <div className={`border rounded-2xl p-4 ${currentStage.color}`}>
            <p className="text-[9px] font-black uppercase tracking-[0.25em] mb-1.5 opacity-70">
              💡 Tip — Etapa {currentStage.label}
            </p>
            <p className="text-[10px] leading-relaxed">
              {stage === 'atraccion' && 'No menciones GEMINIX todavía. Habla de cambio de vida, libertad financiera y el estilo de vida que quieres mostrar. La curiosidad es tu herramienta.'}
              {stage === 'interes' && 'Explica brevemente qué es GEMINIX: predicciones, cripto, referidos. No presiones. El objetivo es informar y despertar interés genuino.'}
              {stage === 'deseo' && 'Usa tu testimonio real o el de tu equipo. Muestra capturas, resultados, momentos. El FOMO se crea con prueba social auténtica.'}
              {stage === 'accion' && 'CTA claro y directo. Incluye tu link de referido. Crea urgencia legítima (plazas, tiempo limitado). El CTA debe estar en el cuerpo y al final.'}
              {stage === 'fidelizacion' && 'Celebra victorias del equipo, comparte tips de la plataforma y motiva a tus referidos a invitar a su red. La comunidad retiene.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Marketing;
