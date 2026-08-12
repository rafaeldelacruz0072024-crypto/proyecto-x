-- ============================================================
-- MIGRACIÓN: Paquetes de Software Baccarat AI
-- Agrega columnas a la tabla plans para soportar paquetes
-- de inversión con membresía de software incluida.
-- ============================================================

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS is_software_package BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS software_url         TEXT,
  ADD COLUMN IF NOT EXISTS membership_days      INTEGER,
  ADD COLUMN IF NOT EXISTS fixed_amount         NUMERIC;

-- Índice para consultar rápido solo los paquetes de software
CREATE INDEX IF NOT EXISTS idx_plans_software
  ON public.plans (is_software_package)
  WHERE is_software_package = true;

-- ============================================================
-- INSERTAR LOS 5 PAQUETES BACCARAT AI
-- Ajusta software_url al enlace real antes de ejecutar.
-- ============================================================
-- software_url queda NULL por ahora.
-- Agrégalo después desde el Admin Panel → Investment Strategy → Paquetes Baccarat AI → Editar.
INSERT INTO public.plans
  (name, roi_percentage, duration_days, daily_roi_percent, min_amount,
   status, is_software_package, software_url, membership_days, fixed_amount)
VALUES
  ('Baccarat AI — Starter',  200, 91, 2.2, 500,   'active', true, NULL, 15,  500),
  ('Baccarat AI — Basic',    200, 91, 2.2, 1000,  'active', true, NULL, 30,  1000),
  ('Baccarat AI — Advanced', 200, 91, 2.2, 3000,  'active', true, NULL, 90,  3000),
  ('Baccarat AI — Pro',      200, 91, 2.2, 5000,  'active', true, NULL, 180, 5000),
  ('Baccarat AI — Elite',    200, 91, 2.2, 10000, 'active', true, NULL, 365, 10000)
ON CONFLICT DO NOTHING;
