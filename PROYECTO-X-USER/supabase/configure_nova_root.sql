-- NOVA Digital: configurar el perfil ROOT
-- Ejecutar en el SQL Editor del proyecto highecwkafvuhptqodue después de crear
-- el usuario en Authentication > Users. No crea ni cambia contraseñas.

DO $$
DECLARE
  nova_root_id uuid;
BEGIN
  SELECT id INTO nova_root_id
  FROM auth.users
  WHERE lower(email) = 'rafaeldelacruz0072024@gmail.com'
  LIMIT 1;

  IF nova_root_id IS NULL THEN
    RAISE EXCEPTION 'Primero crea el usuario Auth rafaeldelacruz0072024@gmail.com y ejecuta este script de nuevo.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE ref_code = 'GK-NOVA-ROOT' AND id <> nova_root_id
  ) THEN
    RAISE EXCEPTION 'GK-NOVA-ROOT ya pertenece a otro perfil. Resuelve esa duplicidad antes de continuar.';
  END IF;

  INSERT INTO public.profiles (id, email, ref_code, role, status)
  VALUES (nova_root_id, 'rafaeldelacruz0072024@gmail.com', 'GK-NOVA-ROOT', 'admin', 'active')
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = 'admin',
    status = 'active',
    ref_code = COALESCE(NULLIF(public.profiles.ref_code, ''), EXCLUDED.ref_code);
END
$$;
