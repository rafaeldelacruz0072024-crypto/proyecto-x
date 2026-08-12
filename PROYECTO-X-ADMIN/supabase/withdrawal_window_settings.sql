-- ============================================================
-- WITHDRAWAL WINDOW & GLOBAL BLOCK SETTINGS
-- Agrega control dinámico de ventana horaria y bloqueo global.
-- Ejecutar en Supabase SQL Editor.
-- ============================================================

ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS withdrawal_global_blocked  BOOLEAN  NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS withdrawal_window_enabled  BOOLEAN  NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS withdrawal_open_day        INTEGER  DEFAULT 6,   -- 0=Dom 1=Lun ... 6=Sab, NULL=todos los días
  ADD COLUMN IF NOT EXISTS withdrawal_open_hour       INTEGER  NOT NULL DEFAULT 9,
  ADD COLUMN IF NOT EXISTS withdrawal_close_hour      INTEGER  NOT NULL DEFAULT 14;

-- Comentarios para documentación
COMMENT ON COLUMN public.system_settings.withdrawal_global_blocked IS 'TRUE = bloquea TODOS los retiros independientemente de cualquier otra config';
COMMENT ON COLUMN public.system_settings.withdrawal_window_enabled IS 'TRUE = aplica restricción de día/hora. FALSE = abierto 24/7';
COMMENT ON COLUMN public.system_settings.withdrawal_open_day      IS '0=Dom 1=Lun 2=Mar 3=Mié 4=Jue 5=Vie 6=Sáb NULL=todos los días';
COMMENT ON COLUMN public.system_settings.withdrawal_open_hour     IS 'Hora de apertura UTC-4 (0-23)';
COMMENT ON COLUMN public.system_settings.withdrawal_close_hour    IS 'Hora de cierre UTC-4 (1-24)';
