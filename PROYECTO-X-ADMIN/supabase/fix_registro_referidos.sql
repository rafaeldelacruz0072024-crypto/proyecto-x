-- ============================================================
-- FIX DEFINITIVO: Trigger de Sponsor por Defecto (Regla de Oro)
-- Garantiza que NADIE quede huérfano en el sistema.
-- Si un usuario se registra sin código, el sistema le asigna
-- automáticamente al ROOT (configurado en system_settings).
-- ============================================================

-- 1. Crear o reemplazar la función de asignación
CREATE OR REPLACE FUNCTION public.assign_default_sponsor()
RETURNS TRIGGER AS $$
DECLARE
  v_default_sponsor UUID;
BEGIN
  -- Solo actuar si referred_by es NULL (registro directo sin link)
  IF NEW.referred_by IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- A. Intentar obtener el ROOT desde system_settings
  BEGIN
    SELECT default_sponsor_id INTO v_default_sponsor 
    FROM system_settings LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_default_sponsor := NULL;
  END;

  -- B. Si no hay ROOT en settings, usar el primer admin como respaldo
  IF v_default_sponsor IS NULL THEN
    BEGIN
      SELECT id INTO v_default_sponsor 
      FROM profiles 
      WHERE role = 'admin' 
      ORDER BY created_at ASC 
      LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      v_default_sponsor := NULL;
    END;
  END IF;

  -- C. Aplicar el sponsor si se encontró y no es el mismo usuario
  IF v_default_sponsor IS NOT NULL AND v_default_sponsor != NEW.id THEN
    NEW.referred_by := v_default_sponsor;
    RAISE NOTICE 'Sponsor por defecto asignado: %', v_default_sponsor;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- En caso de error crítico, dejar pasar para no bloquear el registro
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Vincular el trigger a la tabla profiles
DROP TRIGGER IF EXISTS tr_assign_default_sponsor ON public.profiles;
CREATE TRIGGER tr_assign_default_sponsor
    BEFORE INSERT ON public.profiles
    FOR EACH ROW
    WHEN (NEW.referred_by IS NULL)
    EXECUTE FUNCTION assign_default_sponsor();

-- 3. Verificación inmediata
-- SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'profiles';
