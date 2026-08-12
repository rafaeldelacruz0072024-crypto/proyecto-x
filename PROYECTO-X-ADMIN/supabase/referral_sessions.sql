-- ============================================================
-- SISTEMA DE SESIONES DE REFERIDO (Server-Side)
-- El ref_code se guarda en Supabase, no en el browser
-- El browser solo guarda un TOKEN (UUID) que apunta al registro
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Crear tabla
CREATE TABLE IF NOT EXISTS public.referral_sessions (
    token       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ref_code    TEXT NOT NULL,
    sponsor_id  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    expires_at  TIMESTAMPTZ DEFAULT NOW() + INTERVAL '90 days',
    used_at     TIMESTAMPTZ,
    used_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Índice para limpieza de sesiones expiradas
CREATE INDEX IF NOT EXISTS idx_referral_sessions_expires
    ON public.referral_sessions(expires_at);

-- Deshabilitar RLS (solo accesible via SECURITY DEFINER functions)
ALTER TABLE public.referral_sessions DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. RPC: Crear sesión de referido
--    Llamar cuando el usuario llega con ?ref=GK-XXXXX
--    Retorna el token UUID o NULL si el ref_code no existe
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_referral_session(p_ref_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sponsor_id UUID;
    v_token      UUID;
BEGIN
    -- Validar que el ref_code existe
    SELECT id INTO v_sponsor_id
    FROM public.profiles
    WHERE ref_code = UPPER(TRIM(p_ref_code))
    LIMIT 1;

    -- Si no existe, retornar NULL (se usará el default_sponsor_id)
    IF v_sponsor_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Crear sesión y retornar el token
    INSERT INTO public.referral_sessions (ref_code, sponsor_id)
    VALUES (UPPER(TRIM(p_ref_code)), v_sponsor_id)
    RETURNING token INTO v_token;

    -- Limpiar sesiones expiradas (mantenimiento automático)
    DELETE FROM public.referral_sessions
    WHERE expires_at < NOW() AND used_at IS NOT NULL;

    RETURN v_token;
END;
$$;

-- ============================================================
-- 3. RPC: Resolver sesión de referido durante el registro
--    Retorna el sponsor_id UUID o NULL si el token no es válido
-- ============================================================
CREATE OR REPLACE FUNCTION public.resolve_referral_session(
    p_token   UUID,
    p_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sponsor_id UUID;
BEGIN
    -- Buscar sesión válida: no usada, no expirada
    SELECT sponsor_id INTO v_sponsor_id
    FROM public.referral_sessions
    WHERE token     = p_token
      AND used_at   IS NULL
      AND expires_at > NOW()
    LIMIT 1;

    IF v_sponsor_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Marcar como usada
    UPDATE public.referral_sessions
    SET used_at  = NOW(),
        used_by  = p_user_id
    WHERE token = p_token;

    RETURN v_sponsor_id;
END;
$$;
