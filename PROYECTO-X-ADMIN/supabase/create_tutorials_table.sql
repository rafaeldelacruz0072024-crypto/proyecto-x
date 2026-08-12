-- TABLA DE TUTORIALES
CREATE TABLE IF NOT EXISTS public.tutorials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    content_type TEXT NOT NULL CHECK (content_type IN ('VIDEO', 'PDF', 'DOCUMENT')),
    url TEXT NOT NULL, -- URL de video o path en Storage para PDF
    thumbnail_url TEXT,
    category TEXT DEFAULT 'GENERAL',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.tutorials ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS
-- Todos los usuarios autenticados pueden ver tutoriales activos
CREATE POLICY "Users can view active tutorials" 
ON public.tutorials FOR SELECT 
USING (is_active = true OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'sub-admin'));

-- Solo admins pueden gestionar tutoriales
CREATE POLICY "Admins can manage tutorials" 
ON public.tutorials FOR ALL 
USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'sub-admin'));

-- Trigger para updated_at
CREATE TRIGGER update_tutorials_updated_at
    BEFORE UPDATE ON public.tutorials
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
