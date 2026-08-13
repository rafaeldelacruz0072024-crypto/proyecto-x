-- TABLA DE PRODUCTOS
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    price NUMERIC NOT NULL CHECK (price >= 0),
    image_url TEXT,
    stock INTEGER, -- NULL significa ilimitado
    myfxbook_url TEXT,
    category TEXT DEFAULT 'SOFTWARE',
    is_active BOOLEAN DEFAULT true,
    is_flagship BOOLEAN DEFAULT false, -- Para identificar NOVA DIGITAL GOLD
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- TABLA DE COMPRAS DE PRODUCTOS
CREATE TABLE IF NOT EXISTS public.product_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    amount NUMERIC NOT NULL CHECK (amount >= 0),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('BALANCE', 'USDT')),
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
    details JSONB, -- Para guardar info extra de la compra
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_purchases ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS DE PRODUCTOS
-- Todos pueden ver productos activos
CREATE POLICY "Users can view active products" 
ON public.products FOR SELECT 
USING (is_active = true OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'sub-admin'));

-- Solo admins pueden insertar/actualizar/borrar
CREATE POLICY "Admins can manage products" 
ON public.products FOR ALL 
USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'sub-admin'));

-- POLÍTICAS DE COMPRAS
-- Los usuarios pueden ver sus propias compras
CREATE POLICY "Users can view own purchases" 
ON public.product_purchases FOR SELECT 
USING (user_id = auth.uid() OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'sub-admin'));

-- Los usuarios pueden insertar sus compras (la lógica se validará en el cliente o RPC)
CREATE POLICY "Users can insert own purchases" 
ON public.product_purchases FOR INSERT 
WITH CHECK (user_id = auth.uid());

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
