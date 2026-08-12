import React, { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Zap, Crown, Star, MessageCircle, Sparkles, Clock, Calendar, DollarSign } from 'lucide-react';
import { supabase } from '../lib/supabase';

const FALLBACK_WHATSAPP = '18093011632';

const DEFAULT_PRICES: Record<string, number> = {
  prueba_0: 0,
  estandar_0: 49,
  tres_meses_0: 129,
  seis_meses_0: 249,
  premium_0: 449,
  vip_0: 999,
};

interface Plan {
  id: string;
  name: string;
  subtitle: string;
  durationLabel: string;
  durationNote: string;
  priceKey: string;
  highlight?: string;
  features: { text: string; available: boolean }[];
  popular?: boolean;
  buttonColor: string;
  borderColor: string;
  glowColor: string;
  priceColor: string;
  icon: React.ReactNode;
}

const PLANS: Plan[] = [
  {
    id: 'prueba',
    name: '1 Semana',
    subtitle: 'Paquete de Prueba',
    durationLabel: '2 Horas GRATIS',
    durationNote: 'Sin costo',
    priceKey: 'prueba_0',
    features: [
      { text: 'Todas las características básicas', available: true },
      { text: 'Sin modo AI', available: false },
      { text: 'Notificaciones Telegram', available: false },
      { text: 'Creador de Estrategias Personalizadas', available: false },
      { text: 'Soporte por Telegram', available: true },
      { text: 'Soporte Pragmatic Play', available: true },
    ],
    buttonColor: 'from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500',
    borderColor: 'border-slate-700/50',
    glowColor: 'shadow-slate-500/10',
    priceColor: 'text-emerald-400',
    icon: <Clock size={20} className="text-slate-400" />,
  },
  {
    id: 'estandar',
    name: '1 Mes',
    subtitle: 'Paquete Estándar',
    durationLabel: '1 Mes',
    durationNote: 'Mensual',
    priceKey: 'estandar_0',
    features: [
      { text: 'Todas las características básicas', available: true },
      { text: 'Sin modo AI', available: false },
      { text: 'Notificaciones Telegram', available: true },
      { text: 'Creador de Estrategias Personalizadas', available: true },
      { text: 'Soporte por Telegram', available: true },
      { text: 'Evolution + Pragmatic Play', available: true },
    ],
    buttonColor: 'from-blue-700 to-blue-600 hover:from-blue-600 hover:to-blue-500',
    borderColor: 'border-blue-700/40',
    glowColor: 'shadow-blue-500/10',
    priceColor: 'text-blue-300',
    icon: <Calendar size={20} className="text-blue-400" />,
  },
  {
    id: 'tres_meses',
    name: '3 Meses',
    subtitle: 'Paquete Trimestral',
    durationLabel: '3 Meses',
    durationNote: 'Trimestral',
    priceKey: 'tres_meses_0',
    features: [
      { text: 'Todas las características básicas', available: true },
      { text: 'Sin modo AI', available: false },
      { text: 'Notificaciones Telegram', available: true },
      { text: 'Creador de Estrategias Personalizadas', available: true },
      { text: 'Mesas ilimitadas', available: true },
      { text: 'Soporte por Telegram', available: true },
      { text: 'Evolution + Pragmatic Play', available: true },
    ],
    buttonColor: 'from-indigo-700 to-indigo-600 hover:from-indigo-600 hover:to-indigo-500',
    borderColor: 'border-indigo-600/40',
    glowColor: 'shadow-indigo-500/10',
    priceColor: 'text-indigo-300',
    icon: <Calendar size={20} className="text-indigo-400" />,
  },
  {
    id: 'seis_meses',
    name: '6 Meses',
    subtitle: 'Paquete Semestral',
    durationLabel: '6 Meses',
    durationNote: 'Semestral',
    priceKey: 'seis_meses_0',
    features: [
      { text: 'Todas las características', available: true },
      { text: 'Sin modo AI', available: false },
      { text: 'Notificaciones Telegram', available: true },
      { text: 'Creador de Estrategias Personalizadas', available: true },
      { text: 'Mesas ilimitadas', available: true },
      { text: 'Soporte VIP 24/7', available: true },
      { text: 'Evolution + Pragmatic Play', available: true },
    ],
    buttonColor: 'from-violet-700 to-violet-600 hover:from-violet-600 hover:to-violet-500',
    borderColor: 'border-violet-600/40',
    glowColor: 'shadow-violet-500/10',
    priceColor: 'text-violet-300',
    icon: <Zap size={20} className="text-violet-400" />,
  },
  {
    id: 'premium',
    name: '1 Año',
    subtitle: 'Paquete Premium',
    durationLabel: '1 Año',
    durationNote: 'Anual',
    priceKey: 'premium_0',
    highlight: '✨ ¡MODO AI DESBLOQUEADO!',
    popular: true,
    features: [
      { text: 'Todas las características', available: true },
      { text: 'Modo AI activo', available: true },
      { text: 'Creador de Estrategias Personalizadas', available: true },
      { text: 'Mesas ilimitadas', available: true },
      { text: 'Soporte VIP 24/7', available: true },
      { text: 'Evolution + Pragmatic Play', available: true },
    ],
    buttonColor: 'from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500',
    borderColor: 'border-cyan-500/50',
    glowColor: 'shadow-cyan-500/20',
    priceColor: 'text-cyan-300',
    icon: <Zap size={20} className="text-cyan-400" />,
  },
  {
    id: 'vip',
    name: 'De Por Vida',
    subtitle: 'Paquete VIP',
    durationLabel: 'LIFE TIME',
    durationNote: 'Pago único',
    priceKey: 'vip_0',
    features: [
      { text: 'Todas las características', available: true },
      { text: 'Modo AI activo', available: true },
      { text: 'Creador de Estrategias Personalizadas', available: true },
      { text: 'Actualizaciones de por vida', available: true },
      { text: 'Nuevas características primero', available: true },
      { text: 'Evolution + Pragmatic Play', available: true },
      { text: 'Múltiples sesiones simultáneas', available: true },
      { text: 'Contacto VIP directo', available: true },
      { text: 'Asesoría de Estrategia', available: true },
    ],
    buttonColor: 'from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500',
    borderColor: 'border-amber-500/40',
    glowColor: 'shadow-amber-500/20',
    priceColor: 'text-amber-300',
    icon: <Crown size={20} className="text-amber-400" />,
  },
];

const formatPrice = (prices: Record<string, number>, key: string): string => {
  const p = prices[key] ?? DEFAULT_PRICES[key] ?? 0;
  return p === 0 ? 'GRATIS' : `$${p.toLocaleString('en-US')} USD`;
};

export default function BaccaratPanel() {
  const [prices, setPrices] = useState<Record<string, number>>(DEFAULT_PRICES);
  const [whatsappNumber, setWhatsappNumber] = useState(FALLBACK_WHATSAPP);

  useEffect(() => {
    supabase
      .from('system_settings')
      .select('baccarat_prices, support_whatsapp')
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data?.baccarat_prices && Object.keys(data.baccarat_prices).length > 0) {
          setPrices({ ...DEFAULT_PRICES, ...data.baccarat_prices });
        }
        if (data?.support_whatsapp) {
          setWhatsappNumber(data.support_whatsapp);
        }
      });
  }, []);

  const handleSelect = (plan: Plan) => {
    const price = formatPrice(prices, plan.priceKey);
    const message = encodeURIComponent(
      `Hola! Me interesa adquirir GEMINIX BACCARAT.\n\n📦 Plan: ${plan.subtitle} (${plan.name})\n⏱ Duración: ${plan.durationLabel}\n💰 Precio: ${price}\n\n¿Cómo puedo obtener mi licencia?`
    );
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, '_blank');
  };

  return (
    <div className="space-y-8 animate-slide-in">
      {/* Header */}
      <div className="holo-card p-6 clip-corner text-center space-y-3 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-blue-600/5 pointer-events-none" />
        <div className="flex items-center justify-center gap-3 relative z-10">
          <div className="w-10 h-10 clip-corner bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center">
            <Sparkles size={20} className="text-cyan-400" />
          </div>
          <div className="text-left">
            <h1 className="text-xl font-orbitron font-black text-white uppercase tracking-widest text-glow-cyan">
              GEMINIX BACCARAT
            </h1>
            <p className="text-[10px] font-mono-tech text-slate-500 uppercase tracking-[0.3em]">
              Software de Estrategia Profesional · Licencias Oficiales
            </p>
          </div>
        </div>
        <p className="text-xs text-slate-400 font-rajdhani max-w-xl mx-auto relative z-10">
          El sistema de predicción más avanzado para mesas de Baccarat. Elige el plan que mejor se adapte a tu estilo de juego y contacta a nuestro equipo para adquirir tu licencia.
        </p>
        <div className="flex items-center justify-center gap-2 relative z-10">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-mono-tech text-emerald-400 uppercase tracking-widest">Sistema activo · Soporte 24/7</span>
        </div>
      </div>

      {/* Pricing grid — 3 cols */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`relative flex flex-col border rounded-none clip-corner transition-all duration-300 hover:scale-[1.02] ${plan.borderColor} ${plan.glowColor} shadow-xl bg-[#0a0f1a]`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                <span className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-[9px] font-black uppercase tracking-widest rounded-full shadow-[0_0_12px_rgba(0,243,255,0.5)]">
                  <Star size={9} fill="white" />
                  MÁS POPULAR
                </span>
              </div>
            )}

            <div className="p-5 flex flex-col flex-1 space-y-4">
              {/* Title */}
              <div className="flex items-center gap-2 pt-2">
                <div className={`w-8 h-8 clip-corner-sm flex items-center justify-center bg-slate-900/80 border ${plan.borderColor}`}>
                  {plan.icon}
                </div>
                <div>
                  <h2 className="text-base font-orbitron font-black text-white uppercase leading-none">{plan.name}</h2>
                  <p className="text-[10px] font-mono-tech text-slate-500 uppercase tracking-widest">{plan.subtitle}</p>
                </div>
              </div>

              {/* AI Highlight */}
              {plan.highlight && (
                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded px-3 py-2 text-center">
                  <p className="text-[11px] font-orbitron font-black text-cyan-400 tracking-widest">{plan.highlight}</p>
                </div>
              )}

              {/* Price block */}
              <div className={`rounded border ${plan.borderColor} bg-black/30 p-3 text-center space-y-1`}>
                <p className="text-[10px] font-mono-tech text-slate-500 uppercase tracking-widest">{plan.durationLabel} · {plan.durationNote}</p>
                <p className={`text-2xl font-orbitron font-black ${plan.priceColor} flex items-center justify-center gap-1`}>
                  {prices[plan.priceKey] !== 0 && <DollarSign size={16} />}
                  {formatPrice(prices, plan.priceKey)}
                </p>
              </div>

              {/* Features */}
              <ul className="space-y-2 flex-1">
                {plan.features.map((f) => (
                  <li key={f.text} className="flex items-start gap-2">
                    {f.available
                      ? <CheckCircle2 size={13} className="text-emerald-400 shrink-0 mt-0.5" />
                      : <XCircle size={13} className="text-rose-500/60 shrink-0 mt-0.5" />
                    }
                    <span className={`text-[11px] font-rajdhani leading-tight ${f.available ? 'text-slate-300' : 'text-slate-600'}`}>
                      {f.text}
                    </span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <button
                disabled
                className="w-full py-3 clip-corner-sm bg-slate-800/60 border border-slate-700/50 text-slate-500 text-[11px] font-orbitron font-black uppercase tracking-widest cursor-not-allowed flex items-center justify-center gap-2 select-none"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                PRÓXIMAMENTE
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom note */}
      <div className="holo-card p-4 clip-corner flex items-center gap-3">
        <div className="w-8 h-8 clip-corner-sm bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
          <MessageCircle size={16} className="text-emerald-400" />
        </div>
        <div>
          <p className="text-xs font-orbitron font-black text-white uppercase tracking-widest">¿Necesitas ayuda para elegir?</p>
          <p className="text-[10px] text-slate-500 font-mono-tech mt-0.5">
            Nuestro equipo de soporte está disponible 24/7 por WhatsApp. Al hacer clic en "Seleccionar Paquete" serás redirigido automáticamente con el plan y precio seleccionado.
          </p>
        </div>
      </div>
    </div>
  );
}
