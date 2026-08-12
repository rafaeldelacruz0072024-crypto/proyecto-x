-- ============================================================
-- SQL: FUNCIÓN RECURSIVA PARA RED REFERRAL (v2 - fixed)
-- Ejecutar en el Editor SQL de Supabase
-- ============================================================

DROP FUNCTION IF EXISTS public.get_network_tree(UUID);
CREATE OR REPLACE FUNCTION public.get_network_tree(root_id UUID)
RETURNS TABLE (
    id UUID,
    email TEXT,
    username TEXT,
    referred_by UUID,
    level INTEGER,
    status TEXT,
    personal_volume DECIMAL,
    direct_referrals_count BIGINT,
    joined_at TIMESTAMPTZ,
    rank TEXT,
    ref_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE network_tree AS (
        -- Miembros directos (Nivel 1)
        SELECT
            p.id,
            p.email,
            p.username,
            p.referred_by,
            1 as level,
            p.status,
            p.created_at,
            p.rank,
            p.ref_code
        FROM public.profiles p
        WHERE p.referred_by = root_id

        UNION ALL

        -- Miembros indirectos (Niveles subsiguientes)
        SELECT
            p.id,
            p.email,
            p.username,
            p.referred_by,
            nt.level + 1,
            p.status,
            p.created_at,
            p.rank,
            p.ref_code
        FROM public.profiles p
        INNER JOIN network_tree nt ON p.referred_by = nt.id
        WHERE nt.level < 30 -- Límite de seguridad
    )
    SELECT
        nt.id,
        nt.email,
        nt.username,
        nt.referred_by,
        nt.level,
        nt.status,
        COALESCE((
            SELECT SUM(amount)
            FROM public.investments
            WHERE user_id = nt.id AND status = 'ACTIVE'
        ), 0) as personal_volume,
        (
            SELECT COUNT(*)
            FROM public.profiles
            WHERE referred_by = nt.id
        ) as direct_referrals_count,
        nt.created_at as joined_at,
        nt.rank,
        nt.ref_code
    FROM network_tree nt;
END;
$$;

-- ============================================================
-- SCRIPT DE REPARACIÓN: Asignar referred_by a usuarios huérfanos
-- Ejecutar DESPUÉS de re-deployar la función de arriba
-- ============================================================
-- Este script asigna el default_sponsor_id a todos los usuarios
-- que tienen referred_by = NULL (excepto el propio sponsor).
--
-- INSTRUCCIONES:
-- 1. Primero consulta cuál es tu default_sponsor_id:
--    SELECT default_sponsor_id FROM system_settings LIMIT 1;
-- 2. Reemplaza 'TU-DEFAULT-SPONSOR-UUID' abajo con ese valor
-- 3. Ejecuta el UPDATE
--
-- UPDATE public.profiles
-- SET referred_by = 'TU-DEFAULT-SPONSOR-UUID'
-- WHERE referred_by IS NULL
--   AND id != 'TU-DEFAULT-SPONSOR-UUID'
--   AND role = 'user';
--
-- Verifica cuántos usuarios huérfanos tienes:
-- SELECT COUNT(*) FROM profiles WHERE referred_by IS NULL AND role = 'user';
