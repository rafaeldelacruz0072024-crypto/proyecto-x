-- ============================================================
-- BLINDAJE DEL SISTEMA DE REFERIDOS — GEMINIX
-- Ejecutar en Supabase SQL Editor
-- ============================================================


-- ============================================================
-- 1. REPARACIÓN AUTOMÁTICA: Asigna ROOT a usuarios huérfanos
--    Llamar manualmente o desde un cron si es necesario
-- ============================================================

CREATE OR REPLACE FUNCTION public.repair_orphaned_referrals()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_root_id  UUID;
    v_count    INT;
BEGIN
    -- Obtener ROOT
    SELECT default_sponsor_id INTO v_root_id
    FROM public.system_settings
    LIMIT 1;

    IF v_root_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'default_sponsor_id no configurado en system_settings');
    END IF;

    -- Reparar perfiles con referred_by NULL (excepto el propio ROOT)
    UPDATE public.profiles
    SET referred_by = v_root_id,
        updated_at  = NOW()
    WHERE referred_by IS NULL
      AND id <> v_root_id;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'success',   true,
        'repaired',  v_count,
        'root_id',   v_root_id
    );
END;
$$;


-- ============================================================
-- 2. DIAGNÓSTICO: Verificar integridad del sistema de referidos
-- ============================================================

CREATE OR REPLACE FUNCTION public.verify_referral_integrity()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total          INT;
    v_orphaned       INT;
    v_no_ref_code    INT;
    v_root_id        UUID;
    v_root_ok        BOOLEAN;
BEGIN
    SELECT COUNT(*)        INTO v_total       FROM public.profiles;
    SELECT COUNT(*)        INTO v_orphaned    FROM public.profiles WHERE referred_by IS NULL;
    SELECT COUNT(*)        INTO v_no_ref_code FROM public.profiles WHERE ref_code IS NULL OR TRIM(ref_code) = '';
    SELECT default_sponsor_id INTO v_root_id FROM public.system_settings LIMIT 1;
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = v_root_id) INTO v_root_ok;

    RETURN jsonb_build_object(
        'total_profiles',       v_total,
        'orphaned_no_sponsor',  v_orphaned,
        'missing_ref_code',     v_no_ref_code,
        'root_id',              v_root_id,
        'root_profile_exists',  v_root_ok,
        'status',               CASE
                                    WHEN v_orphaned = 0 AND v_no_ref_code = 0 AND v_root_ok
                                    THEN 'OK'
                                    ELSE 'ISSUES_FOUND'
                                END
    );
END;
$$;


-- ============================================================
-- 3. BLINDAJE handle_new_user — versión reforzada
--    Lee sponsor_code del metadata, valida formato GK-XXXXXX,
--    resuelve UUID, asigna ROOT como fallback triple
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_sponsor_id   UUID;
    v_sponsor_code TEXT;
    v_username     TEXT;
    v_full_name    TEXT;
BEGIN
    -- Leer metadata con validación de formato GK-XXXXXX
    v_sponsor_code := UPPER(TRIM(COALESCE(NEW.raw_user_meta_data->>'sponsor_code', '')));
    v_username     := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'username', '')), '');
    v_full_name    := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'full_name', '')), '');

    -- Validar formato GK- antes de buscar
    IF v_sponsor_code ~ '^GK-[A-Z0-9]{4,8}$' THEN
        SELECT id INTO v_sponsor_id
        FROM public.profiles
        WHERE ref_code = v_sponsor_code
          AND id <> NEW.id  -- no auto-referido
        LIMIT 1;
    END IF;

    -- Fallback 1: ROOT desde system_settings
    IF v_sponsor_id IS NULL THEN
        SELECT default_sponsor_id INTO v_sponsor_id
        FROM public.system_settings
        LIMIT 1;
    END IF;

    -- Fallback 2: primer admin creado (si system_settings no tiene ROOT)
    IF v_sponsor_id IS NULL THEN
        SELECT id INTO v_sponsor_id
        FROM public.profiles
        WHERE role = 'admin'
          AND id <> NEW.id
        ORDER BY created_at ASC
        LIMIT 1;
    END IF;

    -- Insertar perfil
    INSERT INTO public.profiles (
        id, email, full_name, username,
        role, status, user_tag,
        ref_code, referred_by,
        credit_balance, wallet_balance,
        created_at, updated_at
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(v_full_name, ''),
        v_username,
        'user',
        'active',
        'REAL_CRYPTO',
        'GK-' || UPPER(SUBSTRING(MD5(NEW.id::text) FROM 1 FOR 6)),
        v_sponsor_id,
        0, 0,
        NOW(), NOW()
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;

EXCEPTION WHEN OTHERS THEN
    -- NUNCA bloquear el registro — registrar el error en logs
    RAISE LOG 'handle_new_user error para %: %', NEW.email, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 4. BLINDAJE tr_assign_default_sponsor — versión reforzada
--    Triple fallback: system_settings → primer admin → skip
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_assign_default_sponsor()
RETURNS TRIGGER AS $$
DECLARE
    v_root_id UUID;
BEGIN
    IF NEW.referred_by IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Fallback 1: system_settings
    SELECT default_sponsor_id INTO v_root_id
    FROM public.system_settings
    LIMIT 1;

    -- Fallback 2: primer admin
    IF v_root_id IS NULL THEN
        SELECT id INTO v_root_id
        FROM public.profiles
        WHERE role = 'admin' AND id <> NEW.id
        ORDER BY created_at ASC
        LIMIT 1;
    END IF;

    IF v_root_id IS NOT NULL AND v_root_id <> NEW.id THEN
        NEW.referred_by := v_root_id;
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RETURN NEW; -- nunca bloquear
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 5. VERIFICACIÓN INMEDIATA
-- ============================================================

-- Ver estado del sistema:
SELECT public.verify_referral_integrity();

-- Si hay huérfanos, repararlos:
-- SELECT public.repair_orphaned_referrals();
