import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const url = new URL(req.url);
    const limit = url.searchParams.get('limit') || '100';
    const order = url.searchParams.get('order') || 'volumeNum';
    const offset = url.searchParams.get('offset') || '0';
    const tag = url.searchParams.get('tag') || '';

    let apiUrl = `https://gamma-api.polymarket.com/markets?limit=${limit}&offset=${offset}&order=${order}&ascending=false&active=true&closed=false`;
    if (tag) apiUrl += `&tag=${encodeURIComponent(tag)}`;

    const res = await fetch(apiUrl,
      { headers: { 'Accept': 'application/json' } }
    );

    if (!res.ok) {
      throw new Error(`Polymarket API error: ${res.status}`);
    }

    const data = await res.json();

    return new Response(JSON.stringify(data), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
