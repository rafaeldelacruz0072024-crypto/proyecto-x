-- Migración para el Sistema de Ofertas Flash y Cupones Semanales
-- Tabla: promotions (Extensión)

-- Añadir campos para cupones y ofertas flash
ALTER TABLE public.promotions 
ADD COLUMN IF NOT EXISTS coupon_code TEXT,
ADD COLUMN IF NOT EXISTS is_flash_offer BOOLEAN DEFAULT false;

-- Comentario para documentación
COMMENT ON COLUMN public.promotions.coupon_code IS 'Código alfanumérico que el usuario debe copiar para obtener el beneficio.';
COMMENT ON COLUMN public.promotions.is_flash_offer IS 'Si es true, disparará un modal de alto impacto al usuario en el Dashboard.';
