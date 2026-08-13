import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PLATFORM_SPECS: Record<string, string> = {
  instagram: 'Instagram: máximo 2200 caracteres en caption, usar 5-10 hashtags relevantes al final, incluir emoji estratégicos, tono visual y aspiracional. Formato: Caption + Hashtags.',
  tiktok: 'TikTok: guión de video de 30-60 segundos. Formato: HOOK (primeros 3 segundos para captar atención), CUERPO (desarrollo rápido), CTA (llamada a la acción final). Incluir sugerencias de texto en pantalla y transiciones.',
  facebook: 'Facebook: post de 100-300 palabras, conversacional y personal, una pregunta al final para generar comentarios, 1-3 hashtags máximo.',
  whatsapp: 'WhatsApp: mensaje directo de máximo 200 palabras, tono personal y cercano como si fuera de amigo a amigo, incluir emoji moderados, sin hashtags.',
  youtube: 'YouTube: guión de video de 3-5 minutos. Formato: INTRO (gancho + presentación), DESARROLLO (3 puntos principales), CONCLUSIÓN + CTA (suscribir, link en bio). Incluir sugerencias de edición y thumbnails.',
  linkedin: 'LinkedIn: post profesional de 200-400 palabras, tono ejecutivo pero humano, historia personal con lección de negocio, 3-5 hashtags profesionales al final.',
};

const STAGE_CONTEXT: Record<string, string> = {
  atraccion: 'ETAPA DE ATRACCIÓN: El objetivo es despertar CURIOSIDAD sin revelar el negocio todavía. Habla de cambios de vida, libertad financiera, estilo de vida. NO menciones el nombre de la empresa directamente. Crea intriga.',
  interes: 'ETAPA DE INTERÉS: El objetivo es EDUCAR sobre la oportunidad. Explica brevemente qué es PROYECTO X (plataforma de finanzas digitales, mercados de predicción, inversiones cripto y red de afiliados). Muestra el potencial sin presionar.',
  deseo: 'ETAPA DE DESEO: El objetivo es crear PRUEBA SOCIAL y aspiración. Usa el testimonio personal del usuario, muestra resultados reales, estilo de vida mejorado, ingresos generados. Genera FOMO (miedo a perderse la oportunidad).',
  accion: 'ETAPA DE ACCIÓN: El objetivo es generar CONVERSIÓN. CTA directo y urgente para registrarse en PROYECTO X usando el link de referido del usuario. Crea urgencia legítima (plazas limitadas, oferta de tiempo).',
  fidelizacion: 'ETAPA DE FIDELIZACIÓN: El objetivo es RETENER y activar a nuevos miembros. Contenido de comunidad, celebrar victorias del equipo, tips para crecer en la plataforma, motivar a que inviten a su red.',
};

const TONE_STYLE: Record<string, string> = {
  profesional: 'Tono PROFESIONAL: Lenguaje ejecutivo, cifras y datos, enfoque en ROI y oportunidad de negocio. Formal pero accesible.',
  casual: 'Tono CASUAL: Como si hablaras con un amigo, coloquial, natural, divertido. Usa contracciones y expresiones cotidianas.',
  emotivo: 'Tono EMOTIVO: Apela a las emociones, sueños, familia, libertad. Cuenta historias que toquen el corazón. Inspiracional y humano.',
  motivacional: 'Tono MOTIVACIONAL: Energético, empoderador, frases de impacto. Estilo coach. Usa frases cortas y poderosas. Alto voltaje emocional.',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_KEY) {
      throw new Error('ANTHROPIC_API_KEY no configurada en secrets de Supabase');
    }

    const body = await req.json();
    const {
      platform = 'instagram',
      stage = 'atraccion',
      tone = 'casual',
      userName = 'Usuario',
      testimony = '',
      targetAudience = 'emprendedores',
      referralLink = '',
      extraContext = '',
      language = 'es',
    } = body;

    const platformSpec = PLATFORM_SPECS[platform] || PLATFORM_SPECS.instagram;
    const stageCtx = STAGE_CONTEXT[stage] || STAGE_CONTEXT.atraccion;
    const toneStyle = TONE_STYLE[tone] || TONE_STYLE.casual;

    const systemPrompt = `Eres un experto en marketing digital y network marketing para PROYECTO X, una plataforma de finanzas digitales que incluye:
- Mercados de predicción (estilo Polymarket)
- Inversiones en criptomonedas
- Sistema de referidos multinivel (hasta 30 niveles de profundidad)
- Bono salarial semanal para equipos activos
- Juegos de predicción y crash

Tu misión: crear contenido de marketing VIRAL y AUTÉNTICO que ayude a los miembros de PROYECTO X a crecer su red de referidos en redes sociales.

REGLAS CRÍTICAS:
1. NUNCA hagas promesas de ingresos específicos o garantías
2. El contenido debe sentirse GENUINO, no como publicidad corporativa
3. Adapta el contenido EXACTAMENTE al formato de la plataforma indicada
4. Usa el nombre real del usuario para personalización
5. El contenido debe ser 100% listo para publicar, sin placeholders
6. Responde SOLO con el contenido generado, sin explicaciones adicionales
7. Si hay testimonio personal, úsalo de forma natural y creíble
8. Idioma: ${language === 'es' ? 'Español' : 'English'}`;

    const userPrompt = `Genera contenido de marketing con estas especificaciones:

PLATAFORMA: ${platform.toUpperCase()}
${platformSpec}

ETAPA DEL EMBUDO: ${stage.toUpperCase()}
${stageCtx}

ESTILO DE VOZ: ${tone.toUpperCase()}
${toneStyle}

DATOS DEL USUARIO:
- Nombre: ${userName}
- Audiencia objetivo: ${targetAudience}
${testimony ? `- Testimonio personal: "${testimony}"` : ''}
${referralLink ? `- Link de referido: ${referralLink}` : ''}
${extraContext ? `- Contexto adicional: ${extraContext}` : ''}

Genera el contenido ahora, listo para publicar:`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Claude API error: ${response.status} — ${err}`);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || '';

    return new Response(JSON.stringify({ content, platform, stage, tone }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
