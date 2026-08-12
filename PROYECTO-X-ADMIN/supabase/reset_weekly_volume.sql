-- ==============================================================================================
-- WEEKLY RESET: Reinicio Semanal de Rango y Volumen (Post-Salary Claim)
-- ==============================================================================================
DROP FUNCTION IF EXISTS public.reset_weekly_volume(uuid);

CREATE OR REPLACE FUNCTION public.reset_weekly_volume(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Se resetea el Rango y el Volumen Organizacional de manera segura y forzada
    UPDATE public.profiles
    SET 
        team_volume = 0,
        rank = 'Starter'
    WHERE id = p_user_id;
END;
$$;
