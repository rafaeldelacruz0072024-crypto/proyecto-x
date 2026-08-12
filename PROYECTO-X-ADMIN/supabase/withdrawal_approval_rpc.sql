-- ============================================================
-- WITHDRAWAL MANAGEMENT RPCs
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. get_user_balance: Retorna el saldo actual del usuario
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_balance(p_user_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN COALESCE(
    (SELECT wallet_balance FROM public.profiles WHERE id = p_user_id),
    0
  );
END;
$$;


-- 2. process_withdrawal_approval: Aprueba un retiro PENDING → APPROVED
-- El saldo ya fue debitado al momento de la solicitud por el usuario,
-- esta función solo cambia el estado para que el admin sepa que debe enviar el pago.
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_withdrawal_approval(
  p_withdrawal_id UUID,
  p_admin_id      UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_w RECORD;
BEGIN
  SELECT * INTO v_w FROM public.withdrawals WHERE id = p_withdrawal_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Retiro no encontrado');
  END IF;

  IF upper(v_w.status) != 'PENDING' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'El retiro ya fue procesado (estado: ' || v_w.status || ')'
    );
  END IF;

  UPDATE public.withdrawals
  SET
    status      = 'APPROVED',
    approved_at = NOW()
  WHERE id = p_withdrawal_id;

  -- Registrar en transactions que el pago fue aprobado
  INSERT INTO public.transactions (user_id, amount, type, status, description, created_at)
  VALUES (
    v_w.user_id,
    0,   -- monto 0 porque ya se descontó al crear el retiro
    'WITHDRAWAL_APPROVED',
    'COMPLETED',
    'Retiro aprobado por admin — pendiente de envío blockchain',
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Retiro aprobado. Procede a enviar el pago en blockchain.',
    'net_amount', v_w.net_amount,
    'wallet_address', v_w.wallet_address
  );
END;
$$;


-- 3. reject_withdrawal: Rechaza un retiro y RESTAURA el saldo al usuario
-- ============================================================
CREATE OR REPLACE FUNCTION public.reject_withdrawal(
  p_withdrawal_id  UUID,
  p_reason         TEXT,
  p_admin_id       UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_w RECORD;
BEGIN
  SELECT * INTO v_w FROM public.withdrawals WHERE id = p_withdrawal_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Retiro no encontrado');
  END IF;

  IF upper(v_w.status) NOT IN ('PENDING', 'APPROVED') THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'No se puede rechazar un retiro en estado ' || v_w.status
    );
  END IF;

  -- Actualizar estado del retiro
  UPDATE public.withdrawals
  SET
    status           = 'REJECTED',
    rejection_reason = p_reason
  WHERE id = p_withdrawal_id;

  -- Restaurar el saldo al usuario (el monto bruto que se descontó)
  UPDATE public.profiles
  SET wallet_balance = wallet_balance + v_w.amount
  WHERE id = v_w.user_id;

  -- Registrar la devolución en transactions
  INSERT INTO public.transactions (user_id, amount, type, status, description, created_at)
  VALUES (
    v_w.user_id,
    v_w.amount,
    'WITHDRAWAL_REJECTED',
    'COMPLETED',
    'Retiro rechazado — saldo restaurado. Motivo: ' || COALESCE(p_reason, 'Sin motivo'),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Retiro rechazado y saldo restaurado al usuario.',
    'amount_restored', v_w.amount
  );
END;
$$;


-- 4. complete_withdrawal: Marca como COMPLETADO con hash blockchain
-- ============================================================
CREATE OR REPLACE FUNCTION public.complete_withdrawal(
  p_withdrawal_id UUID,
  p_tx_hash       TEXT,
  p_admin_id      UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_w      RECORD;
  v_tx_id  UUID;
BEGIN
  SELECT * INTO v_w FROM public.withdrawals WHERE id = p_withdrawal_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Retiro no encontrado');
  END IF;

  IF upper(v_w.status) NOT IN ('PENDING', 'APPROVED') THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'El retiro ya está en estado ' || v_w.status
    );
  END IF;

  -- Marcar retiro como COMPLETADO
  UPDATE public.withdrawals
  SET
    status             = 'COMPLETED',
    approved_at        = COALESCE(approved_at, NOW()),
    completed_at       = NOW(),
    blockchain_tx_hash = p_tx_hash
  WHERE id = p_withdrawal_id;

  -- Buscar la transaction pendiente asociada
  SELECT id INTO v_tx_id
  FROM public.transactions
  WHERE user_id = v_w.user_id
    AND type    = 'WITHDRAWAL'
    AND status  = 'PENDING'
    AND ABS(amount) = v_w.amount
  ORDER BY created_at DESC
  LIMIT 1;

  -- Actualizarla si existe
  IF v_tx_id IS NOT NULL THEN
    UPDATE public.transactions
    SET status = 'COMPLETED'
    WHERE id = v_tx_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Retiro marcado como COMPLETADO.',
    'tx_hash', p_tx_hash
  );
END;
$$;


-- 5. Permisos
-- ============================================================
GRANT EXECUTE ON FUNCTION public.get_user_balance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_withdrawal_approval(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_withdrawal(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_withdrawal(UUID, TEXT, UUID) TO authenticated;
