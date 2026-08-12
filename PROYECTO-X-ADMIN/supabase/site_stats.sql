-- Create site_stats table for landing page dynamic stats
CREATE TABLE IF NOT EXISTS public.site_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  active_investors INTEGER NOT NULL DEFAULT 0,
  countries INTEGER NOT NULL DEFAULT 0,
  total_payouts BIGINT NOT NULL DEFAULT 0,
  years_in_market INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed with initial row
INSERT INTO public.site_stats (active_investors, countries, total_payouts, years_in_market)
VALUES (1200, 45, 850000, 3)
ON CONFLICT DO NOTHING;

-- Allow public read (anon role)
ALTER TABLE public.site_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read site_stats" ON public.site_stats;
CREATE POLICY "Public read site_stats"
  ON public.site_stats FOR SELECT
  USING (true);

-- Allow authenticated admin writes (service role bypasses RLS anyway)
DROP POLICY IF EXISTS "Admin write site_stats" ON public.site_stats;
CREATE POLICY "Admin write site_stats"
  ON public.site_stats FOR ALL
  USING (auth.role() = 'authenticated');
