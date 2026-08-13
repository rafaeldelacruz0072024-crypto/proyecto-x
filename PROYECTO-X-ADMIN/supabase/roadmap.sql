-- ============================================================
-- ROAD MAP — Tabla de fases y pasos del proyecto NOVA DIGITAL
-- ============================================================

CREATE TABLE IF NOT EXISTS public.roadmap_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phase       INT  NOT NULL DEFAULT 2,
    title       TEXT NOT NULL,
    description TEXT,
    icon        TEXT DEFAULT '🔷',
    status      TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'done')),
    sort_order  INT  DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: solo admins pueden modificar
ALTER TABLE public.roadmap_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access roadmap" ON public.roadmap_items
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Public read roadmap" ON public.roadmap_items
    FOR SELECT USING (true);

-- Fecha de inicio de la Fase 2 (contador de 60 días)
-- Guardar en system_settings
ALTER TABLE public.system_settings
    ADD COLUMN IF NOT EXISTS phase2_start_date TIMESTAMPTZ;

UPDATE public.system_settings
SET phase2_start_date = NOW()
WHERE phase2_start_date IS NULL;

-- Seed inicial — Fase 2
INSERT INTO public.roadmap_items (phase, title, description, icon, status, sort_order) VALUES
(2, 'Pasivo 1.1% Diario', 'Rendimiento diario de lunes a viernes sobre capital activo', '📈', 'planned', 1),
(2, '15 Niveles de Referidos 25%', 'Comisiones por red en 15 niveles con distribución del 25%', '🌐', 'planned', 2),
(2, 'Salario Quincenal', 'Pago de salario cada 15 días para miembros activos', '💰', 'planned', 3),
(2, 'Fee 10% Transferencia Crédito', 'Comisión del 10% en transferencias de crédito entre usuarios', '🔄', 'planned', 4),
(2, 'NOVA DIGITAL Market Predictions V2', 'Nueva versión del módulo de predicciones con más mercados', '🎯', 'planned', 5)
ON CONFLICT DO NOTHING;
