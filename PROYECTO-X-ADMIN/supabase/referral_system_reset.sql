-- ============================================================
-- REFERRAL SYSTEM RESET — V3 CLEAN
-- Ejecutar TODO en Supabase SQL Editor de una vez
-- rootnew@gmail.com es el nuevo ROOT del sistema
-- ============================================================


-- ============================================================
-- PASO 1: LIMPIAR TODO LO VIEJO
-- ============================================================

-- Triggers
DROP TRIGGER IF EXISTS tr_assign_default_sponsor      ON public.profiles;
DROP TRIGGER IF EXISTS tr_ensure_ref_code             ON public.profiles;
DROP TRIGGER IF EXISTS tr_root_ensure_ref_code        ON public.profiles;
DROP TRIGGER IF EXISTS tr_distribute_referral_commissions ON public.investments;

-- Funciones
DROP FUNCTION IF EXISTS public.complete_registration(uuid,text,text,text,text,text,text,uuid);
DROP FUNCTION IF EXISTS public.complete_registration(uuid,text,text,text,text,text,text,text);
DROP FUNCTION IF EXISTS public.assign_default_sponsor();
DROP FUNCTION IF EXISTS public.ensure_ref_code();
DROP FUNCTION IF EXISTS public.ensure_ref_code_logic();
DROP FUNCTION IF EXISTS public.resolve_sponsor_by_ref_code(text);
DROP FUNCTION IF EXISTS public.create_referral_session(text);
DROP FUNCTION IF EXISTS public.resolve_referral_session(uuid,uuid);


-- ============================================================
-- PASO 2: TRIGGER — Generar ref_code automático
-- Garantiza que ningún perfil quede sin ref_code
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_ensure_ref_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.ref_code IS NULL OR TRIM(NEW.ref_code) = '' THEN
        NEW.ref_code := 'GK-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_ensure_ref_code
    BEFORE INSERT OR UPDATE OF ref_code ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_ensure_ref_code();


-- ============================================================
-- PASO 3: TRIGGER — Asignar ROOT como sponsor por defecto
-- Solo se activa si referred_by llegó NULL al INSERT
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_assign_default_sponsor()
RETURNS TRIGGER AS $$
DECLARE
    v_root_id UUID;
BEGIN
    -- Si ya viene con sponsor asignado, no tocar nada
    IF NEW.referred_by IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Obtener ROOT desde system_settings
    SELECT default_sponsor_id INTO v_root_id
    FROM public.system_settings
    LIMIT 1;

    -- Aplicar solo si existe y no es el mismo usuario
    IF v_root_id IS NOT NULL AND v_root_id <> NEW.id THEN
        NEW.referred_by := v_root_id;
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RETURN NEW; -- nunca bloquear el registro
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_assign_default_sponsor
    BEFORE INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_assign_default_sponsor();


-- ============================================================
-- PASO 4: RPC complete_registration
-- Llamada desde el frontend tras supabase.auth.signUp()
-- p_sponsor_code = ref_code del sponsor (ej: GK-ABC123)
-- Resuelve el UUID internamente — nada de UUIDs en el frontend
-- ============================================================

CREATE OR REPLACE FUNCTION public.complete_registration(
    p_user_id      UUID,
    p_username     TEXT,
    p_full_name    TEXT,
    p_email        TEXT,
    p_country      TEXT DEFAULT NULL,
    p_phone        TEXT DEFAULT NULL,
    p_ref_code     TEXT DEFAULT NULL,
    p_sponsor_code TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sponsor_id UUID;
BEGIN
    -- 1. Resolver UUID del sponsor a partir del ref_code
    IF p_sponsor_code IS NOT NULL AND TRIM(p_sponsor_code) != '' THEN
        SELECT id INTO v_sponsor_id
        FROM public.profiles
        WHERE ref_code = UPPER(TRIM(p_sponsor_code))
        LIMIT 1;
    END IF;

    -- 2. Fallback: usar ROOT de system_settings si no se encontró sponsor
    IF v_sponsor_id IS NULL THEN
        SELECT default_sponsor_id INTO v_sponsor_id
        FROM public.system_settings
        LIMIT 1;
    END IF;

    -- 3. Upsert del perfil
    INSERT INTO public.profiles (
        id, username, full_name, email, country, phone,
        ref_code, referred_by, role, status,
        credit_balance, wallet_balance, created_at
    )
    VALUES (
        p_user_id,
        p_username,
        p_full_name,
        p_email,
        p_country,
        p_phone,
        COALESCE(NULLIF(TRIM(p_ref_code), ''), 'GK-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6))),
        v_sponsor_id,
        'user',
        'active',
        0,
        0,
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        username    = EXCLUDED.username,
        full_name   = EXCLUDED.full_name,
        country     = COALESCE(EXCLUDED.country,   profiles.country),
        phone       = COALESCE(EXCLUDED.phone,     profiles.phone),
        ref_code    = COALESCE(profiles.ref_code,  EXCLUDED.ref_code),
        referred_by = COALESCE(EXCLUDED.referred_by, profiles.referred_by),
        updated_at  = NOW();

    RETURN jsonb_build_object('success', true, 'sponsor_id', v_sponsor_id);

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;


-- ============================================================
-- PASO 5: APUNTAR ROOT a rootnew@gmail.com
-- ============================================================

UPDATE public.system_settings
SET default_sponsor_id = (
    SELECT p.id
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE u.email = 'rootnew@gmail.com'
    LIMIT 1
);


-- ============================================================
-- PASO 6: Reparar usuarios que no tienen ref_code
-- ============================================================

UPDATE public.profiles
SET ref_code = 'GK-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6))
WHERE ref_code IS NULL OR TRIM(ref_code) = '';


-- ============================================================
-- VERIFICACION FINAL
-- ============================================================

-- Debe mostrar el ID de rootnew@gmail.com:
-- SELECT default_sponsor_id FROM public.system_settings LIMIT 1;

-- Debe terminar en: p_sponsor_code text DEFAULT NULL::text
-- SELECT pg_get_function_arguments(oid) FROM pg_proc WHERE proname = 'complete_registration';

-- Triggers activos en profiles:
-- SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'profiles';
