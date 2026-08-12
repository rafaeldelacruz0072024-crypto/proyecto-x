-- ==============================================================================================
-- ACTUALIZACIÓN: CONFIGURACIÓN OFICIAL DEL PLAN DE COMPENSACIÓN (SOSTENIBILIDAD 50%)
-- REQUERIMIENTO: Matriz a 30 Niveles
-- Ejecutar en Supabase SQL Editor
-- ==============================================================================================

UPDATE public.system_settings 
SET residual_config = '[
  {"id": 1, "percent": 10},
  {"id": 2, "percent": 5},
  {"id": 3, "percent": 3},
  {"id": 4, "percent": 2},
  {"id": 5, "percent": 2},
  {"id": 6, "percent": 2},
  {"id": 7, "percent": 2},
  {"id": 8, "percent": 2},
  {"id": 9, "percent": 2},
  {"id": 10, "percent": 2},
  {"id": 11, "percent": 1},
  {"id": 12, "percent": 1},
  {"id": 13, "percent": 1},
  {"id": 14, "percent": 1},
  {"id": 15, "percent": 1},
  {"id": 16, "percent": 1},
  {"id": 17, "percent": 1},
  {"id": 18, "percent": 1},
  {"id": 19, "percent": 1},
  {"id": 20, "percent": 1},
  {"id": 21, "percent": 0.8},
  {"id": 22, "percent": 0.8},
  {"id": 23, "percent": 0.8},
  {"id": 24, "percent": 0.8},
  {"id": 25, "percent": 0.8},
  {"id": 26, "percent": 0.8},
  {"id": 27, "percent": 0.8},
  {"id": 28, "percent": 0.8},
  {"id": 29, "percent": 0.8},
  {"id": 30, "percent": 0.8}
]'::JSONB
WHERE id = 1;

-- MENSAJE DE VALIDACIÓN:
-- Los niveles configurados suman exactamente 50% de la inversión inicial,
-- logrando la sostenibilidad requerida y cumpliendo con la regla de oro en el frontend.
