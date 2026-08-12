-- ==============================================================================================
-- GLOBAL WEEKLY RESET: Reinicio Masivo de Rango y Volumen (Domingos Post-Salary Claim)
-- Ejecutar en Supabase SQL Editor
-- ==============================================================================================
DROP FUNCTION IF EXISTS public.reset_all_weekly_volumes();

CREATE OR REPLACE FUNCTION public.reset_all_weekly_volumes()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  calling_user_role TEXT;
  updated_count INT;
BEGIN
    -- 1. Verificación de Seguridad (Solo Administradores O System)
    IF auth.uid() IS NOT NULL THEN
        SELECT role INTO calling_user_role FROM public.profiles WHERE id = auth.uid();
        IF calling_user_role IS NULL OR calling_user_role NOT IN ('admin', 'super-admin') THEN
            RAISE EXCEPTION 'Acceso denegado: Solo el personal administrativo puede reiniciar los ciclos semanales globales.';
        END IF;
    END IF;

    -- 2. Reiniciar el Rango y el Volumen Organizacional ('team_volume') de manera segura
    UPDATE public.profiles
    SET 
        team_volume = 0,
        rank = 'Starter'
    WHERE role = 'user' AND (team_volume > 0 OR rank != 'Starter');

    GET DIAGNOSTICS updated_count = ROW_COUNT;

    -- 3. Retornar mensaje de éxito
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Ciclo semanal reiniciado exitosamente. ' || updated_count || ' inversores fueron reseteados a Starter y volumen cero.',
        'updated_users', updated_count
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_all_weekly_volumes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_all_weekly_volumes() TO service_role;
