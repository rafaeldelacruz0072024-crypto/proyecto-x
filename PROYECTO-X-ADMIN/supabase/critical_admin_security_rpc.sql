-- NOVA Digital: correcciones críticas del panel administrativo
-- Ejecutar manualmente en Supabase SQL Editor.
-- No ejecutar desde el frontend ni desde este repositorio.
-- Este script no crea usuarios y no modifica balances al instalarse.

BEGIN;

-- ============================================================
-- 1) RESET SEGURO DE INVERSIÓN
--    Reinicia solo el contrato seleccionado. Nunca toca balances.
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_reset_investment(
  p_investment_id UUID,
  p_admin_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_role TEXT;
  v_inv RECORD;
BEGIN
  IF auth.uid() IS NULL OR p_admin_id IS NULL OR auth.uid() <> p_admin_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Actor administrativo inválido.');
  END IF;

  SELECT role INTO v_admin_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_admin_role NOT IN ('admin', 'sub-admin') THEN
    RETURN jsonb_build_object('success', false, 'message', 'No tienes permisos administrativos.');
  END IF;

  SELECT id, user_id, amount, status
  INTO v_inv
  FROM public.investments
  WHERE id = p_investment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Inversión no encontrada.');
  END IF;

  UPDATE public.investments
  SET accumulated_earnings = 0,
      status = 'ACTIVE',
      is_referral_commission_paid = false,
      created_at = NOW(),
      completed_at = NULL
  WHERE id = p_investment_id;

  INSERT INTO public.credit_logs (user_id, amount, type, description, performed_by, created_at)
  VALUES (
    v_inv.user_id,
    0,
    'ADMIN_ADJUSTMENT',
    'Reset seguro de inversión ' || p_investment_id::TEXT || ' por administrador ' || auth.uid()::TEXT,
    auth.uid(),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Inversión reiniciada sin modificar Wallet Bank ni Credit Balance.',
    'investment_id', p_investment_id,
    'user_id', v_inv.user_id
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reset_investment(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_reset_investment(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_reset_investment(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_investment(UUID, UUID) TO service_role;

-- ============================================================
-- 2) COMPLETAR RETIRO DE FORMA ATÓMICA
--    Solo permite APPROVED -> COMPLETED, exige TXID real,
--    cierra/crea el ledger y registra actor administrativo.
-- ============================================================
CREATE OR REPLACE FUNCTION public.complete_withdrawal_atomic(
  p_withdrawal_id UUID,
  p_tx_hash TEXT,
  p_admin_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_role TEXT;
  v_w RECORD;
  v_tx_id UUID;
BEGIN
  IF auth.uid() IS NULL OR p_admin_id IS NULL OR auth.uid() <> p_admin_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Actor administrativo inválido.');
  END IF;

  SELECT role INTO v_admin_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_admin_role NOT IN ('admin', 'sub-admin') THEN
    RETURN jsonb_build_object('success', false, 'message', 'No tienes permisos administrativos.');
  END IF;

  IF NULLIF(BTRIM(p_tx_hash), '') IS NULL OR UPPER(BTRIM(p_tx_hash)) = 'MANUAL_PAYMENT_BY_ADMIN' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Debes proporcionar un TXID blockchain válido.');
  END IF;

  SELECT * INTO v_w
  FROM public.withdrawals
  WHERE id = p_withdrawal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Retiro no encontrado.');
  END IF;

  IF UPPER(v_w.status) <> 'APPROVED' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Solo se puede completar un retiro APPROVED. Estado actual: ' || v_w.status
    );
  END IF;

  UPDATE public.withdrawals
  SET status = 'COMPLETED',
      approved_at = COALESCE(approved_at, NOW()),
      completed_at = NOW(),
      blockchain_tx_hash = BTRIM(p_tx_hash)
  WHERE id = p_withdrawal_id;

  SELECT id INTO v_tx_id
  FROM public.transactions
  WHERE user_id = v_w.user_id
    AND type = 'WITHDRAWAL'
    AND status = 'PENDING'
    AND (description LIKE '%' || p_withdrawal_id::TEXT || '%' OR reference_id = p_withdrawal_id::TEXT)
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_tx_id IS NULL THEN
    INSERT INTO public.transactions (user_id, amount, type, status, description, reference_id, created_at, updated_at)
    VALUES (
      v_w.user_id,
      -ABS(v_w.amount),
      'WITHDRAWAL',
      'COMPLETED',
      'Retiro completado por administrador. TXID: ' || BTRIM(p_tx_hash),
      p_withdrawal_id::TEXT,
      NOW(),
      NOW()
    )
    RETURNING id INTO v_tx_id;
  ELSE
    UPDATE public.transactions
    SET status = 'COMPLETED',
        description = COALESCE(description, '') || ' · Completado por admin. TXID: ' || BTRIM(p_tx_hash),
        updated_at = NOW()
    WHERE id = v_tx_id;
  END IF;

  INSERT INTO public.credit_logs (user_id, amount, type, description, performed_by, created_at)
  VALUES (
    v_w.user_id,
    0,
    'ADMIN_ADJUSTMENT',
    'Retiro completado ' || p_withdrawal_id::TEXT || ' por administrador ' || auth.uid()::TEXT || '. TXID: ' || BTRIM(p_tx_hash),
    auth.uid(),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Retiro completado y ledger conciliado atómicamente.',
    'withdrawal_id', p_withdrawal_id,
    'transaction_id', v_tx_id,
    'tx_hash', BTRIM(p_tx_hash)
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_withdrawal_atomic(UUID, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_withdrawal_atomic(UUID, TEXT, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.complete_withdrawal_atomic(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_withdrawal_atomic(UUID, TEXT, UUID) TO service_role;

-- Mantener las funciones antiguas fuera del alcance directo del cliente.
REVOKE EXECUTE ON FUNCTION public.complete_withdrawal(UUID, TEXT, UUID) FROM anon, authenticated;

COMMIT;
