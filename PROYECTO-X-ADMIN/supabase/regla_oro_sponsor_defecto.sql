-- ============================================================
-- REGLA DE ORO: Asignar Sponsor por Defecto
-- Si un usuario se registra sin referido, queda bajo la cuenta
-- principal del negocio (primer admin del sistema).
-- Ejecutar en Supabase SQL Editor
-- Fecha: 2026-03-03
-- ============================================================

-- 1. Agregar configuración del sponsor por defecto en system_settings
ALTER TABLE public.system_settings 
ADD COLUMN IF NOT EXISTS default_sponsor_id UUID DEFAULT NULL;

-- 2. Asignar el primer admin como sponsor por defecto
UPDATE public.system_settings 
SET default_sponsor_id = (
  SELECT id FROM profiles 
  WHERE role = 'admin' 
  ORDER BY created_at ASC 
  LIMIT 1
);

-- 3. Trigger: si un profile se crea/actualiza sin referred_by, asignar sponsor por defecto
CREATE OR REPLACE FUNCTION public.assign_default_sponsor()
RETURNS TRIGGER AS $$
DECLARE
  v_default_sponsor UUID;
BEGIN
  -- Solo actuar si referred_by es NULL
  IF NEW.referred_by IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- No asignar sponsor al propio admin principal
  SELECT default_sponsor_id INTO v_default_sponsor 
  FROM system_settings LIMIT 1;

  -- Si no hay sponsor configurado, buscar primer admin
  IF v_default_sponsor IS NULL THEN
    SELECT id INTO v_default_sponsor 
    FROM profiles 
    WHERE role = 'admin' 
    ORDER BY created_at ASC 
    LIMIT 1;
  END IF;

  -- No asignarse a sí mismo como sponsor
  IF v_default_sponsor IS NOT NULL AND v_default_sponsor != NEW.id THEN
    NEW.referred_by := v_default_sponsor;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Crear trigger BEFORE INSERT (para nuevos registros)
DROP TRIGGER IF EXISTS tr_assign_default_sponsor ON public.profiles;
CREATE TRIGGER tr_assign_default_sponsor
    BEFORE INSERT ON public.profiles
    FOR EACH ROW
    WHEN (NEW.referred_by IS NULL)
    EXECUTE FUNCTION assign_default_sponsor();

-- 5. Crear trigger BEFORE UPDATE (por si se actualiza sin sponsor)
DROP TRIGGER IF EXISTS tr_assign_default_sponsor_update ON public.profiles;
CREATE TRIGGER tr_assign_default_sponsor_update
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    WHEN (NEW.referred_by IS NULL AND OLD.referred_by IS NULL)
    EXECUTE FUNCTION assign_default_sponsor();

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- Ver quién es el sponsor por defecto
SELECT 
  ss.default_sponsor_id,
  p.username AS sponsor_username,
  p.email AS sponsor_email
FROM system_settings ss
LEFT JOIN profiles p ON p.id = ss.default_sponsor_id
LIMIT 1;

-- Confirmar triggers activos
SELECT trigger_name, event_manipulation 
FROM information_schema.triggers 
WHERE trigger_name LIKE '%default_sponsor%';
