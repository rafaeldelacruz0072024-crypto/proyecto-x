-- NOVA Digital / ADMIN
-- Corrección manual para ajustes atómicos de wallet_balance y credit_balance.
-- Ejecutar completo en Supabase SQL Editor. Este script NO crea usuarios ni
-- ejecuta ningún ajuste por sí mismo.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.credit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric(18,2) NOT NULL DEFAULT 0,
  type text NOT NULL DEFAULT 'ADMIN_ADJUSTMENT',
  description text,
  performed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS credit_logs_user_id_created_at_idx
  ON public.credit_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS credit_logs_created_at_idx
  ON public.credit_logs (created_at DESC);

ALTER TABLE public.credit_logs ENABLE ROW LEVEL SECURITY;

-- Solo lectura directa; los INSERT de ajustes pasan por el RPC SECURITY DEFINER.
GRANT SELECT ON public.credit_logs TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'credit_logs'
      AND policyname = 'credit_logs_admin_select'
  ) THEN
    CREATE POLICY credit_logs_admin_select
      ON public.credit_logs FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role IN ('admin', 'sub-admin')
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'credit_logs'
      AND policyname = 'credit_logs_user_select_own'
  ) THEN
    CREATE POLICY credit_logs_user_select_own
      ON public.credit_logs FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'credit_logs'
      AND policyname = 'credit_logs_admin_insert'
  ) THEN
    CREATE POLICY credit_logs_admin_insert
      ON public.credit_logs FOR INSERT TO authenticated
      WITH CHECK (
        performed_by = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'sub-admin')
        )
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_adjust_balance(
  p_user_id uuid,
  p_balance_column text,
  p_amount numeric,
  p_description text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_current numeric := 0;
  v_new numeric := 0;
  v_description text := COALESCE(NULLIF(trim(p_description), ''), 'Ajuste admin');
  v_transaction_type text;
  v_reference_id text := 'admin_balance_' || gen_random_uuid()::text;
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Sesión no autenticada';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_admin_id
      AND role IN ('admin', 'sub-admin')
  ) THEN
    RAISE EXCEPTION 'No autorizado para ajustar balances';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario objetivo requerido';
  END IF;

  IF p_balance_column NOT IN ('wallet_balance', 'credit_balance') THEN
    RAISE EXCEPTION 'Cuenta de balance no permitida';
  END IF;

  IF p_amount IS NULL OR p_amount = 0 THEN
    RAISE EXCEPTION 'El monto debe ser distinto de cero';
  END IF;

  IF abs(p_amount) > 5000 THEN
    RAISE EXCEPTION 'El monto máximo por ajuste es 5000';
  END IF;

  -- Bloquea el perfil para evitar carreras entre ajustes concurrentes.
  IF p_balance_column = 'wallet_balance' THEN
    SELECT COALESCE(wallet_balance, 0) INTO v_current
    FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  ELSE
    SELECT COALESCE(credit_balance, 0) INTO v_current
    FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario objetivo no encontrado';
  END IF;

  v_new := v_current + p_amount;
  IF v_new < 0 THEN
    RAISE EXCEPTION 'Fondos insuficientes';
  END IF;

  IF p_balance_column = 'wallet_balance' THEN
    UPDATE public.profiles SET wallet_balance = v_new WHERE id = p_user_id;
  ELSE
    UPDATE public.profiles SET credit_balance = v_new WHERE id = p_user_id;
  END IF;

  v_transaction_type := CASE WHEN p_amount > 0 THEN 'BONUS' ELSE 'WITHDRAWAL' END;

  INSERT INTO public.credit_logs (user_id, amount, type, description, performed_by)
  VALUES (p_user_id, p_amount, 'ADMIN_ADJUSTMENT', v_description, v_admin_id);

  INSERT INTO public.transactions
    (user_id, amount, type, status, description, reference_id, created_at)
  VALUES
    (p_user_id, p_amount, v_transaction_type, 'COMPLETED', v_description, v_reference_id, now());

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'balance_column', p_balance_column,
    'previous_balance', v_current,
    'new_balance', v_new,
    'amount', p_amount,
    'reference_id', v_reference_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_adjust_balance(uuid, text, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_balance(uuid, text, numeric, text) TO authenticated;

