import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_KEY) throw new Error('ANTHROPIC_API_KEY no configurada');

    const { texts } = await req.json();
    if (!Array.isArray(texts) || texts.length === 0) throw new Error('texts array requerido');

    const nonEmpty = texts.filter((t: string) => t && t.trim());
    if (nonEmpty.length === 0) return new Response(JSON.stringify({ translations: texts }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });

    const numbered = texts.map((t: string, i: number) => `${i + 1}. ${t || ''}`).join('\n');

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `Traduce al español las siguientes preguntas o textos de mercados de predicción financiera. Mantén el significado exacto y el tono de pregunta. Si el texto ya está en español, devuélvelo igual. Responde SOLO con las traducciones numeradas en el mismo formato, sin explicaciones adicionales:\n\n${numbered}`,
        }],
      }),
    });

    if (!res.ok) throw new Error(`Claude API error: ${res.status}`);

    const data = await res.json();
    const rawText: string = data.content?.[0]?.text || '';

    const translations = texts.map((_: string, i: number) => {
      const regex = new RegExp(`^${i + 1}[.)\\s]+(.+)$`, 'm');
      const match = rawText.match(regex);
      return match ? match[1].trim() : texts[i];
    });

    return new Response(JSON.stringify({ translations }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
