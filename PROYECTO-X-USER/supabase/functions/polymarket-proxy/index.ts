import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const url = new URL(req.url)
    const limit = url.searchParams.get('limit') || '50'
    const order = url.searchParams.get('order') || 'volumeNum'

    const res = await fetch(
      `https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=${limit}&order=${order}&ascending=false`,
      { headers: { 'Accept': 'application/json', 'User-Agent': 'ProyectoXProxy/1.0' } }
    )

    if (!res.ok) throw new Error(`Polymarket API error: ${res.status}`)

    const data = await res.json()

    return new Response(JSON.stringify(data), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
