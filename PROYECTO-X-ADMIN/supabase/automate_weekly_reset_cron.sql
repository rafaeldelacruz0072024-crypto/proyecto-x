-- ==============================================================================================
-- AUTOMATIZACIÓN (CRON JOB): Ejecución automática del Reinicio Semanal
-- Ejecutar en Supabase SQL Editor
-- Función requerida: public.reset_all_weekly_volumes()
-- ==============================================================================================

-- 1. Aseguramos que la extensión de PostgreSQL 'pg_cron' esté activada en el proyecto
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- (Omitimos el unschedule la primera vez porque lanza error XX000 si el trabajo no existe)
-- Si necesitas reprogramarlo a futuro, primero ejecutas manualmente:
-- SELECT cron.unschedule('reinicio-semanal-volumen-domingo');

-- 2. Programamos el Trabajo Automático (CRON JOB)
-- La sintaxis CRON '0 3 * * 0' significa: "A las 03:00 AM (minuto 0, hora 3), todos los meses, todos los días del mes, solo el Día 0 de la semana (Domingo)"
SELECT cron.schedule(
  'reinicio-semanal-volumen-domingo',    -- Nombre único e identificador de la tarea
  '0 3 * * 0',                           -- Expresión CRON: Domingos a las 3:00 AM (Hora del Servidor UTC)
  $$ SELECT public.reset_all_weekly_volumes() $$ -- El comando exacto que correrá la base de datos sola
);

-- NOTA INFORMATIVA: 
-- Para revisar si tu tarea está activa en el futuro, puedes correr este comando analítico:
-- SELECT * FROM cron.job WHERE jobname = 'reinicio-semanal-volumen-domingo';
