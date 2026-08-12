-- ============================================================
-- MIGRACIÓN: Bloqueo de retiros de comisiones por usuario
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Agregar columna withdrawals_blocked a profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS withdrawals_blocked boolean NOT NULL DEFAULT false;

-- 2. Función para validar si el usuario tiene bloqueados los retiros al intentar insertar en `withdrawals`
CREATE OR REPLACE FUNCTION public.check_withdrawal_blocked()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_blocked BOOLEAN;
BEGIN
    -- Obtener el estado del usuario antes de crear el retiro
    SELECT withdrawals_blocked INTO v_blocked
    FROM public.profiles
    WHERE id = NEW.user_id;

    -- Si el estado es verdadero, lanzar una excepción y abortar el INSERT
    IF v_blocked = true THEN
        RAISE EXCEPTION 'USER_WITHDRAWALS_BLOCKED: No puedes crear retiros, por favor contacta a soporte.';
    END IF;

    RETURN NEW;
END;
$$;

-- 3. Crear o reemplazar el Trigger en la tabla withdrawals
DROP TRIGGER IF EXISTS enforce_withdrawal_block ON public.withdrawals;

CREATE TRIGGER enforce_withdrawal_block
BEFORE INSERT ON public.withdrawals
FOR EACH ROW
EXECUTE FUNCTION public.check_withdrawal_blocked();
