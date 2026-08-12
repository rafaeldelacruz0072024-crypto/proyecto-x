-- ==============================================================================================
-- AUTOMATED WEEKLY RESET: Programación con pg_cron
-- ==============================================================================================

-- 1. Habilitar la extensión pg_cron (si no está habilitada)
-- Nota: Esto debe hacerse en la base de datos 'postgres' en Supabase, 
-- pero usualmente ya puedes crear jobs desde el SQL Editor.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Programar el reinicio global para cada Lunes a las 00:00 UTC
-- El formato es cron: 'minutos horas día-mes mes día-semana'
-- 0 0 * * 1  significa: Minuto 0, Hora 0, Todos los días, Todos los meses, Lunes (1)
SELECT cron.schedule(
    'weekly-volume-reset-job', -- Nombre único del job
    '0 0 * * 1',               -- Cron syntax: Lunes a las 00:00
    $$ SELECT public.reset_all_weekly_volumes(); $$
);

-- 3. (Opcional) Consultar los jobs activos para verificar
-- SELECT * FROM cron.job;
