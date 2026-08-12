-- Función para resolver el sponsor por ref_code durante el registro
-- SECURITY DEFINER bypasea RLS — permite buscar perfiles de otros usuarios
-- Ejecutar en Supabase SQL Editor
CREATE OR REPLACE FUNCTION public.resolve_sponsor_by_ref_code(p_ref_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sponsor_id UUID;
BEGIN
  -- Buscar por ref_code exacto (formato GK-XXXXXX)
  SELECT id INTO v_sponsor_id
  FROM public.profiles
  WHERE ref_code = UPPER(TRIM(p_ref_code))
  LIMIT 1;

  -- Si no encontró, retorna NULL (se usará el default_sponsor_id)
  RETURN v_sponsor_id;
END;
$$;
