-- NOVA ADMIN / Supabase PRODUCTION
-- Ejecutar manualmente en Supabase SQL Editor.
-- Este RPC solo permite rechazar depósitos pendientes y no acredita ni debita balances.

CREATE OR REPLACE FUNCTION public.admin_reject_deposit_atomic(
  p_deposit_id uuid,
  p_admin_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_id uuid := auth.uid();
  v_status text;
  v_user_id uuid;
  v_amount numeric;
BEGIN
  IF v_auth_id IS NULL OR p_admin_id IS NULL OR v_auth_id <> p_admin_id THEN
    RAISE EXCEPTION 'Sesión administrativa no válida';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = v_auth_id
      AND role IN ('admin', 'sub-admin')
  ) THEN
    RAISE EXCEPTION 'No autorizado para rechazar depósitos';
  END IF;

  SELECT status, user_id, amount
  INTO v_status, v_user_id, v_amount
  FROM public.deposits
  WHERE id = p_deposit_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Depósito no encontrado';
  END IF;

  IF upper(coalesce(v_status, '')) <> 'PENDING' THEN
    RAISE EXCEPTION 'Solo se pueden rechazar depósitos pendientes';
  END IF;

  UPDATE public.deposits
  SET status = 'REJECTED'
  WHERE id = p_deposit_id;

  RETURN jsonb_build_object(
    'success', true,
    'deposit_id', p_deposit_id,
    'user_id', v_user_id,
    'amount', v_amount,
    'status', 'REJECTED'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reject_deposit_atomic(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_deposit_atomic(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.admin_reject_deposit_atomic(uuid, uuid)
  IS 'NOVA ADMIN: rechazo atómico de depósitos pendientes, sin modificar balances.';
