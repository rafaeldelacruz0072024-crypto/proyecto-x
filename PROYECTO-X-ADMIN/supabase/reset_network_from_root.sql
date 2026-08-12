-- ============================================================
-- RESET COMPLETO DE LA RED REFERRAL - DESDE ROOT
-- ROOT = gentecash (982b42f4-dc05-4a55-b8b5-dac8b01c64f7)
-- Ejecutar TODO en Supabase SQL Editor
-- ============================================================

-- PASO 1: Asignar ROOT a todos los usuarios sin sponsor
-- (excepto el propio ROOT)
UPDATE public.profiles
SET referred_by = '982b42f4-dc05-4a55-b8b5-dac8b01c64f7'
WHERE referred_by IS NULL
  AND id != '982b42f4-dc05-4a55-b8b5-dac8b01c64f7'
  AND role = 'user';

-- PASO 2: Verificar que no quedan huérfanos
-- Debería retornar 0
SELECT COUNT(*) as huerfanos_restantes
FROM public.profiles
WHERE referred_by IS NULL
  AND id != '982b42f4-dc05-4a55-b8b5-dac8b01c64f7'
  AND role = 'user';

-- PASO 3: Recrear la función get_network_tree (versión robusta)
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
        SELECT
            p.id,
            p.email,
            p.username,
            p.referred_by,
            1 AS level,
            p.status,
            p.created_at,
            COALESCE(p.rank, 'Starter') AS rank,
            COALESCE(p.ref_code, '') AS ref_code
        FROM public.profiles p
        WHERE p.referred_by = root_id

        UNION ALL

        SELECT
            p.id,
            p.email,
            p.username,
            p.referred_by,
            nt.level + 1,
            p.status,
            p.created_at,
            COALESCE(p.rank, 'Starter'),
            COALESCE(p.ref_code, '')
        FROM public.profiles p
        INNER JOIN network_tree nt ON p.referred_by = nt.id
        WHERE nt.level < 30
    )
    SELECT
        nt.id,
        nt.email,
        nt.username,
        nt.referred_by,
        nt.level,
        nt.status,
        COALESCE((
            SELECT SUM(i.amount)
            FROM public.investments i
            WHERE i.user_id = nt.id AND i.status = 'ACTIVE'
        ), 0) AS personal_volume,
        (
            SELECT COUNT(*)
            FROM public.profiles p2
            WHERE p2.referred_by = nt.id
        ) AS direct_referrals_count,
        nt.created_at AS joined_at,
        nt.rank,
        nt.ref_code
    FROM network_tree nt;
END;
$$;

-- Dar permisos públicos
GRANT EXECUTE ON FUNCTION public.get_network_tree(UUID) TO anon, authenticated;

-- PASO 4: Prueba inmediata - ver quiénes están bajo ROOT
-- Debería mostrar todos los usuarios directos del ROOT
SELECT id, username, email, referred_by, level
FROM public.get_network_tree('982b42f4-dc05-4a55-b8b5-dac8b01c64f7')
ORDER BY level, username;
