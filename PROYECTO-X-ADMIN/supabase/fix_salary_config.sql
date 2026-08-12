-- ============================================================
-- MIGRACIÓN: salary_config dinámico en system_settings
-- Ejecutar en Supabase SQL Editor
-- Fecha: 2026-03-03
-- ============================================================

-- 1. Agregar columna salary_config (JSONB)
ALTER TABLE public.system_settings 
ADD COLUMN IF NOT EXISTS salary_config JSONB DEFAULT '[
  {"teamVolume": 10000, "bonus": 100},
  {"teamVolume": 25000, "bonus": 300},
  {"teamVolume": 40000, "bonus": 500},
  {"teamVolume": 65000, "bonus": 800},
  {"teamVolume": 100000, "bonus": 1500},
  {"teamVolume": 200000, "bonus": 4000},
  {"teamVolume": 400000, "bonus": 7500},
  {"teamVolume": 800000, "bonus": 20000},
  {"teamVolume": 1000000, "bonus": 30000}
]'::JSONB;

-- 2. Verificación
-- SELECT salary_config FROM system_settings LIMIT 1;
