-- 🚨 SCRIPT DE LIMPIEZA TOTAL (INICIO DESDE CERO)
-- Ejecuta esto en el SQL Editor de Supabase para borrar todos los datos de prueba.

-- 1. Deshabilitar temporalmente los triggers (opcional pero recomendado para velocidad)
SET session_replication_role = 'replica';

-- 2. Limpiar tablas de transacciones y registros (hijos)
TRUNCATE TABLE public.credit_logs CASCADE;
TRUNCATE TABLE public.transactions CASCADE;
TRUNCATE TABLE public.product_purchases CASCADE;
TRUNCATE TABLE public.user_tasks CASCADE;

-- 3. Limpiar tablas de operaciones financieras
TRUNCATE TABLE public.investments CASCADE;
TRUNCATE TABLE public.deposits CASCADE;
TRUNCATE TABLE public.withdrawals CASCADE;

-- 4. Limpiar perfiles de usuario
TRUNCATE TABLE public.profiles CASCADE;

-- 5. Habilitar triggers de nuevo
SET session_replication_role = 'origin';

-- ✅ Base de datos lista para el lanzamiento oficial.
