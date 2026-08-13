-- ==========================================================
-- TABLA DE CONFIGURACIÓN DE SIMULACIÓN EN VIVO (PROYECTO X)
-- ==========================================================
-- Ejecuta este script en el editor SQL de Supabase para habilitar
-- el control centralizado de la simulación en el panel admin.

CREATE TABLE IF NOT EXISTS public.simulation_settings (
    id SERIAL PRIMARY KEY,
    is_active BOOLEAN DEFAULT TRUE,
    base_users INTEGER DEFAULT 500,
    variance INTEGER DEFAULT 100,
    speed INTEGER DEFAULT 5, -- segundos entre actualizaciones
    active_countries TEXT[] DEFAULT ARRAY['Estados Unidos', 'España', 'México', 'Colombia', 'Venezuela', 'Alemania', 'Francia', 'Italia', 'India', 'Brasil', 'Perú', 'República Dominicana'],
    selected_models TEXT[] DEFAULT ARRAY['AI Arbitrage Node', 'Baccarat AI Agent', 'Crypto Prediction Bot', 'Plinko Gaming Node', 'GMX Liquidity Node'],
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Fila por defecto para configuración maestra
INSERT INTO public.simulation_settings (id, is_active, base_users, variance, speed)
VALUES (1, TRUE, 597, 80, 5)
ON CONFLICT (id) DO NOTHING;

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.simulation_settings ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad
DROP POLICY IF EXISTS "Permitir lectura publica a simulation_settings" ON public.simulation_settings;
CREATE POLICY "Permitir lectura publica a simulation_settings" ON public.simulation_settings
    FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Permitir escritura admin a simulation_settings" ON public.simulation_settings;
CREATE POLICY "Permitir escritura admin a simulation_settings" ON public.simulation_settings
    FOR ALL TO public USING (true) WITH CHECK (true); -- Permitimos acceso directo con service_role o autenticado para simplificar
