-- ============================================================
-- SCRIPT DE LIMPIEZA: Conservar solo ROOT y gentecash@gmail.com
-- IRREVERSIBLE — Ejecutar en Supabase SQL Editor
-- PASO 1: Primero ejecuta el bloque de VERIFICACIÓN para confirmar
--         qué usuarios se eliminarán, luego ejecuta LIMPIEZA.
-- ============================================================

-- ============================================================
-- PASO 1: VERIFICACIÓN (solo SELECT — seguro de ejecutar)
-- ============================================================
SELECT
    u.id,
    u.email,
    p.username,
    p.full_name,
    p.ref_code,
    p.referred_by,
    CASE
        WHEN u.email ILIKE '%proyecto-x-root%' OR p.username ILIKE '%proyecto-x-root%' THEN '*** CONSERVAR (ROOT) ***'
        WHEN u.email = 'gentecash@gmail.com' THEN '*** CONSERVAR (ADMIN) ***'
        ELSE 'ELIMINAR'
    END AS accion
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
ORDER BY accion, u.email;


-- ============================================================
-- PASO 2: LIMPIEZA REAL (descomentar y ejecutar cuando estés listo)
-- ============================================================
/*
DO $$
DECLARE
    v_root_id   UUID;
    v_admin_id  UUID;
    v_deleted_users   INT;
    v_deleted_profiles INT;
    v_deleted_tx  INT;
    v_deleted_inv INT;
BEGIN
    -- Identificar ROOT (proyecto-x-root)
    SELECT id INTO v_root_id
    FROM auth.users
    WHERE email ILIKE '%proyecto-x-root%'
    LIMIT 1;

    -- Si no encontró por email, buscar por username en profiles
    IF v_root_id IS NULL THEN
        SELECT id INTO v_root_id
        FROM public.profiles
        WHERE username ILIKE '%proyecto-x-root%'
        LIMIT 1;
    END IF;

    -- Identificar Admin
    SELECT id INTO v_admin_id
    FROM auth.users
    WHERE email = 'gentecash@gmail.com'
    LIMIT 1;

    -- Validar que ambos existan antes de borrar nada
    IF v_root_id IS NULL THEN
        RAISE EXCEPTION 'Usuario ROOT (proyecto-x-root) no encontrado. Abortando.';
    END IF;
    IF v_admin_id IS NULL THEN
        RAISE EXCEPTION 'Usuario admin (gentecash@gmail.com) no encontrado. Abortando.';
    END IF;

    RAISE NOTICE 'ROOT ID  : %', v_root_id;
    RAISE NOTICE 'ADMIN ID : %', v_admin_id;

    -- Eliminar transacciones de otros usuarios
    DELETE FROM public.transactions
    WHERE user_id NOT IN (v_root_id, v_admin_id);
    GET DIAGNOSTICS v_deleted_tx = ROW_COUNT;

    -- Eliminar inversiones de otros usuarios
    DELETE FROM public.investments
    WHERE user_id NOT IN (v_root_id, v_admin_id);
    GET DIAGNOSTICS v_deleted_inv = ROW_COUNT;

    -- Eliminar depósitos si la tabla existe
    -- DELETE FROM public.deposits WHERE user_id NOT IN (v_root_id, v_admin_id);

    -- Eliminar retiros si la tabla existe
    -- DELETE FROM public.withdrawals WHERE user_id NOT IN (v_root_id, v_admin_id);

    -- Limpiar referred_by del admin si apunta a un usuario que se eliminará
    UPDATE public.profiles
    SET referred_by = v_root_id
    WHERE id = v_admin_id
      AND referred_by NOT IN (v_root_id, v_admin_id);

    -- Eliminar perfiles de otros usuarios
    DELETE FROM public.profiles
    WHERE id NOT IN (v_root_id, v_admin_id);
    GET DIAGNOSTICS v_deleted_profiles = ROW_COUNT;

    -- Eliminar usuarios de auth (esto puede cascadear a profiles si hay FK)
    DELETE FROM auth.users
    WHERE id NOT IN (v_root_id, v_admin_id);
    GET DIAGNOSTICS v_deleted_users = ROW_COUNT;

    RAISE NOTICE '--------------------------------------------';
    RAISE NOTICE 'Limpieza completada:';
    RAISE NOTICE '  Transacciones eliminadas : %', v_deleted_tx;
    RAISE NOTICE '  Inversiones eliminadas   : %', v_deleted_inv;
    RAISE NOTICE '  Perfiles eliminados      : %', v_deleted_profiles;
    RAISE NOTICE '  Usuarios auth eliminados : %', v_deleted_users;
    RAISE NOTICE 'Solo ROOT y gentecash@gmail.com conservados.';
END $$;
*/
