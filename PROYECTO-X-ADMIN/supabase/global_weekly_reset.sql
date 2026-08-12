-- ==============================================================================================
-- GLOBAL WEEKLY RESET: Reinicio Masivo de Rango y Volumen (Post-Salary Claim)
-- ==============================================================================================
DROP FUNCTION IF EXISTS public.reset_all_weekly_volumes();

CREATE OR REPLACE FUNCTION public.reset_all_weekly_volumes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Se resetea el Rango y el Volumen Organizacional de manera segura para todos los usuarios
    UPDATE public.profiles
    SET 
        team_volume = 0,
        rank = 'Starter'
    WHERE role = 'user';
END;
$$;
