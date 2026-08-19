-- NOVA USER / Supabase PRODUCTION
-- Ejecutar manualmente en Supabase SQL Editor.
-- No se ejecuta desde el repositorio ni desde el navegador.

CREATE OR REPLACE FUNCTION public.create_deposit_request_atomic(
  p_user_id uuid,
  p_amount numeric,
  p_method text,
  p_transaction_hash text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_id uuid := auth.uid();
  v_deposit_id uuid;
BEGIN
  IF v_auth_id IS NULL OR v_auth_id <> p_user_id THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF p_amount IS NULL OR p_amount < 25 OR p_amount > 50000 THEN
    RAISE EXCEPTION 'El monto debe estar entre 25 y 50000 USD';
  END IF;

  IF upper(coalesce(p_method, '')) <> 'CRYPTOP' THEN
    RAISE EXCEPTION 'El único método permitido es CRYPTOP';
  END IF;

  INSERT INTO public.deposits (
    user_id,
    amount,
    method,
    transaction_hash,
    status
  )
  VALUES (
    p_user_id,
    round(p_amount, 2),
    'CRYPTOP',
    NULLIF(trim(p_transaction_hash), ''),
    'PENDING'
  )
  RETURNING id INTO v_deposit_id;

  INSERT INTO public.transactions (
    user_id,
    type,
    amount,
    status,
    description,
    created_at
  )
  VALUES (
    p_user_id,
    'DEPOSIT',
    round(p_amount, 2),
    'PENDING',
    'Depósito CRYPTOP · BEP20 BNB · Ref: ' || v_deposit_id,
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'deposit_id', v_deposit_id,
    'amount', round(p_amount, 2),
    'method', 'CRYPTOP',
    'status', 'PENDING'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_deposit_request_atomic(uuid, numeric, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_deposit_request_atomic(uuid, numeric, text, text) TO authenticated;

COMMENT ON FUNCTION public.create_deposit_request_atomic(uuid, numeric, text, text)
  IS 'NOVA: creación atómica de solicitud CRYPTOP y transacción pendiente, sin reference_id en transactions.';
