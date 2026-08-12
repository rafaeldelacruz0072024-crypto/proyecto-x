-- ============================================================
-- SQL DEFINITIVO: GARANTÍA DE CÓDIGO DE REFERIDO (ROOT CAUSE FIX)
-- ============================================================

-- 1. Función robusta para generar el código
CREATE OR REPLACE FUNCTION public.ensure_ref_code_logic()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo generar si es NULL o está vacío
    IF NEW.ref_code IS NULL OR NEW.ref_code = '' THEN
        NEW.ref_code := 'GK-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger que actúa ANTES de insertar O actualizar
-- Esto garantiza que incluso si se intenta borrar el código, se re-generará
DROP TRIGGER IF EXISTS tr_root_ensure_ref_code ON public.profiles;
CREATE TRIGGER tr_root_ensure_ref_code
    BEFORE INSERT OR UPDATE OF ref_code ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION ensure_ref_code_logic();

-- 3. Limpieza inmediata: Corregir cualquier usuario que falte
UPDATE public.profiles
SET ref_code = 'GK-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6))
WHERE ref_code IS NULL OR ref_code = '';

-- 4. Asegurar que las políticas de RLS no bloqueen la vista del perfil propio
-- (Opcional, pero recomendado si el error persiste por permisos)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' AND policyname = 'Users can view own profile'
    ) THEN
        ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Users can view own profile" ON public.profiles
            FOR SELECT USING (auth.uid() = id);
    END IF;
END $$;
