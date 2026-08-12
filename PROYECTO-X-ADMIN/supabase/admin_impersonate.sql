-- ============================================================
-- RPCs para Impersonar Usuarios desde Admin Panel
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Función para guardar hash original y poner contraseña temporal
DROP FUNCTION IF EXISTS public.admin_impersonate_user(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.admin_impersonate_user(
  target_user_id UUID,
  temp_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  original_encrypted TEXT;
  target_email TEXT;
BEGIN
  -- Verificar permisos (service_role bypass)
  IF auth.uid() IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'super-admin')
    ) THEN
      RAISE EXCEPTION 'Acceso denegado';
    END IF;
  END IF;

  -- Obtener datos del usuario
  SELECT encrypted_password, email 
  INTO original_encrypted, target_email
  FROM auth.users 
  WHERE id = target_user_id;

  IF original_encrypted IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;

  -- Poner contraseña temporal
  UPDATE auth.users
  SET encrypted_password = crypt(temp_password, gen_salt('bf')),
      updated_at = NOW()
  WHERE id = target_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'original_hash', original_encrypted,
    'email', target_email
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_impersonate_user(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_impersonate_user(UUID, TEXT) TO service_role;

-- 2. Función para restaurar contraseña original
DROP FUNCTION IF EXISTS public.admin_restore_user_password(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.admin_restore_user_password(
  target_user_id UUID,
  original_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  -- Verificar permisos (service_role bypass)
  IF auth.uid() IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'super-admin')
    ) THEN
      RAISE EXCEPTION 'Acceso denegado';
    END IF;
  END IF;

  -- Restaurar hash original
  UPDATE auth.users
  SET encrypted_password = original_hash,
      updated_at = NOW()
  WHERE id = target_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_restore_user_password(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_restore_user_password(UUID, TEXT) TO service_role;
