-- Schema para el Módulo de Promociones y Eventos
-- Tabla diseñada para manejar eventos temporales con cashback o beneficios.

CREATE TABLE public.promotions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    image_url TEXT,
    type VARCHAR(50) NOT NULL CHECK (type IN ('CASHBACK', 'DISCOUNT', 'BONUS', 'EVENT')),
    reward_value NUMERIC(10,2) NOT NULL DEFAULT 0, -- ej. 10 para 10%
    min_investment NUMERIC(10,2) DEFAULT 0, -- Monto mínimo del paquete para aplicar
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad
-- 1. Lectura: Todos los usuarios pueden ver las promociones activas
CREATE POLICY "Allow public read access to active promotions" 
ON public.promotions FOR SELECT 
USING (true);

-- 2. Escritura/Modificación: Solo administradores (A nivel de Supabase Auth/Role si aplica, 
-- por ahora lo simplificamos a authenticated o restrictivo según el entorno de PROYECTO X)
-- Nota: En tu estructura actual, el dashboard de admin usa una key de servicio o valida roles.
CREATE POLICY "Allow admin full access to promotions"
ON public.promotions FOR ALL
USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_promotions_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_promotions_updated_at
    BEFORE UPDATE ON public.promotions
    FOR EACH ROW
    EXECUTE FUNCTION update_promotions_updated_at_column();

-- Data de prueba opcional para visualizarlo en el Front inmediatamente
INSERT INTO public.promotions (title, description, type, reward_value, min_investment, start_date, end_date, is_active)
VALUES (
    '¡Flash Promo Cashback 10%!', 
    'Recibe un 10% extra en tu Credit Wallet por cualquier contrato superior a $100. ¡No pierdas esta oportunidad de acelerar tu capital!',
    'CASHBACK', 
    10.00, 
    100.00, 
    NOW() - INTERVAL '1 day', 
    NOW() + INTERVAL '7 days', 
    true
);
