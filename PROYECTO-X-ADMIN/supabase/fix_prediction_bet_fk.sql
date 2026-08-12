-- FIX: prediction_markets bet FK violation
-- El constraint fk_transactions_investments fuerza que reference_id apunte
-- a investments.id, pero para apuestas el reference_id es un market_id.
-- Como reference_id es un campo genérico (se usa para inversiones, apuestas,
-- juegos, etc.), se elimina el FK constraint por completo.

ALTER TABLE public.transactions
DROP CONSTRAINT IF EXISTS fk_transactions_investments;

-- Verificar que quedó eliminado
SELECT constraint_name
FROM information_schema.table_constraints
WHERE table_name = 'transactions'
  AND constraint_name = 'fk_transactions_investments';
-- Si no devuelve filas, el constraint fue eliminado correctamente.
