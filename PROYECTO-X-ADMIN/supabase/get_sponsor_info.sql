-- Función para obtener info del patrocinador sin restricciones RLS
-- Ejecutar en Supabase SQL Editor
CREATE OR REPLACE FUNCTION public.get_sponsor_info(p_sponsor_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'full_name', full_name,
    'username', username,
    'email', email
  ) INTO v_result
  FROM public.profiles
  WHERE id = p_sponsor_id;

  RETURN v_result;
END;
$$;
