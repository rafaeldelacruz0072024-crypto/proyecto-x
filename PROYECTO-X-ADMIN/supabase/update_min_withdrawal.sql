-- Actualizar el monto mínimo de retiro en las configuraciones globales del sistema
UPDATE public.system_settings 
SET min_withdrawal = 25.00 
WHERE id = 1;

-- Verificar la actualización
-- SELECT min_withdrawal FROM system_settings LIMIT 1;
