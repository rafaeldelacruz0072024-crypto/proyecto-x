-- ============================================================
-- RPC: admin_update_user_email
-- Permite a un admin cambiar el correo de cualquier usuario
-- Ejecutar en Supabase SQL Editor
-- ============================================================

DROP FUNCTION IF EXISTS public.admin_update_user_email(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.admin_update_user_email(
  target_user_id UUID,
  new_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  calling_user_role TEXT;
  existing_email UUID;
BEGIN
  -- 1. Verificar permisos del llamante
  IF auth.uid() IS NOT NULL THEN
    SELECT role INTO calling_user_role
    FROM public.profiles
    WHERE id = auth.uid();

    IF calling_user_role IS NULL OR calling_user_role NOT IN ('admin', 'super-admin') THEN
      RAISE EXCEPTION 'Acceso denegado: solo administradores pueden cambiar correos.';
    END IF;
  END IF;

  -- 2. Verificar si el correo ya existe en otro usuario
  SELECT id INTO existing_email FROM auth.users WHERE email = new_email AND id != target_user_id;
  IF existing_email IS NOT NULL THEN
     RAISE EXCEPTION 'El correo % ya está en uso por otra cuenta.', new_email;
  END IF;

  -- 3. Actualizar la tabla auth.users (la tabla maestra)
  UPDATE auth.users
  SET 
    email = new_email,
    -- Auto confirmar para evitar bloqueos si tienen confirmación de email activada
    email_confirmed_at = COALESCE(email_confirmed_at, NOW()), 
    updated_at = NOW()
  WHERE id = target_user_id;

  -- 4. Actualizar la tabla profiles (la tabla pública/espejo)
  UPDATE public.profiles
  SET email = new_email
  WHERE id = target_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Correo actualizado exitosamente a ' || new_email
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_user_email(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_email(UUID, TEXT) TO service_role;
