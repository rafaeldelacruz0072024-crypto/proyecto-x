-- ============================================================
-- FIX: Agregar columna updated_at a deposits y transactions
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Agregar columnas faltantes
ALTER TABLE public.deposits 
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Rellenar registros existentes
UPDATE public.deposits SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE public.transactions SET updated_at = created_at WHERE updated_at IS NULL;

-- 3. Verificar
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'deposits' AND column_name = 'updated_at';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'updated_at';
