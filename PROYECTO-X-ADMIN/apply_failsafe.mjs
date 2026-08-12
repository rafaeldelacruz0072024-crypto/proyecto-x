import { createClient } from '@supabase/supabase-js';

const s = createClient('https://fejzahnvcxyxnckphcuu.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlanphaG52Y3h5eG5ja3BoY3V1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTAxNDYzNywiZXhwIjoyMDg2NTkwNjM3fQ.hcLxdLC5VUuuhcXmMllfXpAdoVcskfrdqu1oKnhb5s0');

const sql = `
CREATE OR REPLACE FUNCTION public.assign_default_sponsor()
RETURNS TRIGGER AS $$
DECLARE
  v_default_sponsor UUID;
BEGIN
  -- Solo actuar si referred_by es NULL
  IF NEW.referred_by IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Intentar obtener el sponsor por defecto
  BEGIN
    SELECT default_sponsor_id INTO v_default_sponsor 
    FROM system_settings LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_default_sponsor := NULL;
  END;

  -- Si no se encontró, intentar buscar primer admin
  IF v_default_sponsor IS NULL THEN
    BEGIN
      SELECT id INTO v_default_sponsor 
      FROM profiles 
      WHERE role = 'admin' 
      ORDER BY created_at ASC 
      LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      v_default_sponsor := NULL;
    END;
  END IF;

  -- No asignarse a sí mismo como sponsor
  IF v_default_sponsor IS NOT NULL AND v_default_sponsor != NEW.id THEN
    NEW.referred_by := v_default_sponsor;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_assign_default_sponsor ON public.profiles;
CREATE TRIGGER tr_assign_default_sponsor
    BEFORE INSERT ON public.profiles
    FOR EACH ROW
    WHEN (NEW.referred_by IS NULL)
    EXECUTE FUNCTION assign_default_sponsor();
`;

async function run() {
    const { error } = await s.rpc('exec_sql', { sql_query: sql });
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Failsafe trigger enabled successfully');
    }
}

run();
