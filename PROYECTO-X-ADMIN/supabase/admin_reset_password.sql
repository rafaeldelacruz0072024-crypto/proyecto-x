-- ============================================================
-- RPC: admin_reset_user_password
-- Permite a un admin cambiar la contraseña de cualquier usuario
-- Ejecutar en Supabase SQL Editor
-- Fecha: 2026-03-03 (v2 - fix service_role auth)
-- ============================================================

-- IMPORTANTE: Esta función requiere que el esquema 'auth' esté accesible.
-- En Supabase, las funciones con SECURITY DEFINER ejecutan con permisos del owner (postgres).

-- Eliminar versión anterior si existe (puede tener tipo de retorno diferente)
DROP FUNCTION IF EXISTS public.admin_reset_user_password(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.admin_reset_user_password(
  target_user_id UUID,
  new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  calling_user_role TEXT;
  target_user_email TEXT;
BEGIN
  -- 1. Verificar permisos del llamante
  -- Si auth.uid() es NULL → llamada con service_role key (permisos admin totales, bypass)
  -- Si auth.uid() NO es NULL → verificar que sea admin en profiles
  IF auth.uid() IS NOT NULL THEN
    SELECT role INTO calling_user_role
    FROM public.profiles
    WHERE id = auth.uid();

    IF calling_user_role IS NULL OR calling_user_role NOT IN ('admin', 'super-admin') THEN
      RAISE EXCEPTION 'Acceso denegado: solo administradores pueden cambiar contraseñas.';
    END IF;
  END IF;
  -- service_role key bypasa esta verificación (ya tiene permisos de postgres)

  -- 2. Verificar que el usuario objetivo existe
  SELECT email INTO target_user_email
  FROM auth.users
  WHERE id = target_user_id;

  IF target_user_email IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado en auth.users';
  END IF;

  -- 3. Validar longitud mínima de contraseña
  IF LENGTH(new_password) < 6 THEN
    RAISE EXCEPTION 'La contraseña debe tener al menos 6 caracteres.';
  END IF;

  -- 4. Actualizar la contraseña usando la función interna de Supabase
  UPDATE auth.users
  SET 
    encrypted_password = crypt(new_password, gen_salt('bf')),
    updated_at = NOW()
  WHERE id = target_user_id;

  -- 5. Log de auditoría (la acción queda registrada en auth.users.updated_at)

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Contraseña actualizada para ' || target_user_email
  );
END;
$$;

-- Permisos: service_role ya tiene acceso total
-- Para usuarios autenticados (anon key), verificación interna de admin
GRANT EXECUTE ON FUNCTION public.admin_reset_user_password(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_password(UUID, TEXT) TO service_role;
