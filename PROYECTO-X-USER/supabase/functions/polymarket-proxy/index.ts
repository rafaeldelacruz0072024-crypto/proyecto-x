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
      { headers: { 'Accept': 'application/json', 'User-Agent': 'NovaDigitalProxy/1.0' } }
    )

    if (!res.ok) throw new Error(`Polymarket API error: ${res.status}`)

    const data = await res.json()
    const startTs = Math.floor(new Date().setUTCHours(0, 0, 0, 0) / 1000)
    const enriched = await Promise.all(data.map(async (market: any, index: number) => {
      if (index >= 20) return market
      try {
        const tokenIds = typeof market.clobTokenIds === 'string' ? JSON.parse(market.clobTokenIds) : market.clobTokenIds
        const yesToken = tokenIds?.[0]
        if (!yesToken) return market
        const historyRes = await fetch(
          `https://clob.polymarket.com/prices-history?market=${encodeURIComponent(yesToken)}&startTs=${startTs}&interval=1d&fidelity=30`,
          { headers: { 'Accept': 'application/json', 'User-Agent': 'NovaDigitalProxy/1.1' } }
        )
        if (!historyRes.ok) return market
        const historyJson = await historyRes.json()
        const priceHistory = (historyJson.history || [])
          .filter((point: any) => Number.isFinite(Number(point.p)) && Number.isFinite(Number(point.t)))
          .map((point: any) => ({ t: Number(point.t), p: Number(point.p) }))
        const first = priceHistory[0]?.p
        const last = priceHistory[priceHistory.length - 1]?.p
        const dayChangePct = first && last ? ((last - first) / first) * 100 : 0
        return { ...market, priceHistory, dayChangePct }
      } catch {
        return market
      }
    }))

    return new Response(JSON.stringify(enriched), {
      headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
