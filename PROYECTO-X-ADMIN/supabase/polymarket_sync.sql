-- Add Polymarket integration columns to prediction_markets
ALTER TABLE public.prediction_markets
  ADD COLUMN IF NOT EXISTS polymarket_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS external_source TEXT DEFAULT 'INTERNAL',
  ADD COLUMN IF NOT EXISTS external_url TEXT,
  ADD COLUMN IF NOT EXISTS last_price_sync TIMESTAMPTZ;

-- Index for fast polymarket lookups
CREATE INDEX IF NOT EXISTS idx_prediction_markets_polymarket_id
  ON public.prediction_markets(polymarket_id)
  WHERE polymarket_id IS NOT NULL;
