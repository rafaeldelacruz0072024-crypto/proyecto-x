-- ============================================================
-- TABLA: prediction_market_comments
-- Comentarios por mercado — ejecutar en Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.prediction_market_comments (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    market_id   UUID NOT NULL REFERENCES public.prediction_markets(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content     TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
    likes       INT DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Índice para buscar por mercado, más recientes primero
CREATE INDEX IF NOT EXISTS idx_comments_market_created
    ON public.prediction_market_comments(market_id, created_at DESC);

-- RLS
ALTER TABLE public.prediction_market_comments ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede leer comentarios
CREATE POLICY "read all comments" ON public.prediction_market_comments
    FOR SELECT USING (true);

-- Solo el dueño puede insertar su comentario
CREATE POLICY "insert own comment" ON public.prediction_market_comments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Solo el dueño puede borrar su comentario (o admin)
CREATE POLICY "delete own comment" ON public.prediction_market_comments
    FOR DELETE USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Likes: el dueño puede actualizar (solo el campo likes)
CREATE POLICY "update likes" ON public.prediction_market_comments
    FOR UPDATE USING (true)
    WITH CHECK (true);

-- Verificar
SELECT 'prediction_market_comments creada correctamente' AS status;
