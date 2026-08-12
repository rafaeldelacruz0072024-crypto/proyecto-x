-- ============================================================
-- RPC: complete_registration (v3 — sponsor resuelto server-side)
-- Elimina ambas firmas anteriores para evitar conflicto de tipos
-- ============================================================

-- Eliminar versión antigua con p_referred_by UUID
DROP FUNCTION IF EXISTS public.complete_registration(uuid, text, text, text, text, text, text, uuid);
-- Eliminar versión con p_sponsor_code TEXT (por si ya existe)
DROP FUNCTION IF EXISTS public.complete_registration(uuid, text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.complete_registration(
    p_user_id      UUID,
    p_username     TEXT,
    p_full_name    TEXT,
    p_email        TEXT,
    p_country      TEXT DEFAULT NULL,
    p_phone        TEXT DEFAULT NULL,
    p_ref_code     TEXT DEFAULT NULL,
    p_sponsor_code TEXT DEFAULT NULL   -- ref_code del sponsor (ej: GK-ABC123)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sponsor_id UUID;
BEGIN
    -- 1. Resolver sponsor UUID a partir del ref_code recibido
    IF p_sponsor_code IS NOT NULL AND TRIM(p_sponsor_code) != '' THEN
        SELECT id INTO v_sponsor_id
        FROM public.profiles
        WHERE ref_code = UPPER(TRIM(p_sponsor_code))
        LIMIT 1;
    END IF;

    -- 2. Si no se encontró sponsor, usar default_sponsor_id de system_settings (ROOT)
    IF v_sponsor_id IS NULL THEN
        SELECT default_sponsor_id INTO v_sponsor_id
        FROM public.system_settings
        LIMIT 1;
    END IF;

    -- 3. Upsert del perfil
    INSERT INTO public.profiles (
        id,
        username,
        full_name,
        email,
        country,
        phone,
        ref_code,
        referred_by,
        role,
        status,
        credit_balance,
        wallet_balance,
        created_at
    )
    VALUES (
        p_user_id,
        p_username,
        p_full_name,
        p_email,
        p_country,
        p_phone,
        COALESCE(p_ref_code, 'GK-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6))),
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
        country     = COALESCE(EXCLUDED.country, profiles.country),
        phone       = COALESCE(EXCLUDED.phone, profiles.phone),
        ref_code    = COALESCE(profiles.ref_code, EXCLUDED.ref_code),
        referred_by = COALESCE(EXCLUDED.referred_by, profiles.referred_by),
        updated_at  = NOW();

    RETURN jsonb_build_object('success', true, 'sponsor_id', v_sponsor_id);

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ============================================================
-- Verificar firma resultante (debe terminar en p_sponsor_code text)
-- SELECT pg_get_function_arguments(oid) FROM pg_proc WHERE proname = 'complete_registration';
-- ============================================================
