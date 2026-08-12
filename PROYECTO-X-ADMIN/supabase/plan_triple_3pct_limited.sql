-- ============================================================
-- PLAN "TRIPLE ELITE 3%" — 3% diario / 300% cap / 50 cupos
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

-- 1. Agregar columna max_units a la tabla plans (si no existe)
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS max_units INT DEFAULT NULL;

-- 2. Insertar el nuevo plan (o actualizar si ya existe por nombre)
INSERT INTO public.plans (
  name,
  min_amount,
  max_amount,
  daily_roi_percent,
  max_return_percent,
  duration_days,
  is_active,
  status,
  roi_percentage,
  max_units
)
VALUES (
  'Triple Elite 3%',
  100,       -- mínimo $100 USDT
  100000,
  3.0,       -- 3% diario
  300,       -- cap 300% (triplica)
  100,       -- ~100 días hasta el cap
  true,
  'active',
  300,       -- roi_percentage = 300% total
  50         -- máximo 50 cupos
)
ON CONFLICT (name) DO UPDATE SET
  daily_roi_percent  = EXCLUDED.daily_roi_percent,
  max_return_percent = EXCLUDED.max_return_percent,
  duration_days      = EXCLUDED.duration_days,
  max_units          = EXCLUDED.max_units,
  is_active          = true,
  status             = 'active';

-- 3. Actualizar process_investment para validar cupos disponibles
CREATE OR REPLACE FUNCTION public.process_investment(
  p_user_id UUID,
  p_amount  DECIMAL,
  p_plan_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance DECIMAL;
  v_investment_id   UUID;
  v_plan_max_units  INT;
  v_plan_units_used INT;
BEGIN
  -- 0. Verificar que el plan existe y está activo
  SELECT max_units INTO v_plan_max_units
  FROM public.plans
  WHERE id = p_plan_id AND (is_active = true OR status = 'active');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Plan no válido o inactivo.');
  END IF;

  -- 1. Verificar cupos disponibles (solo si el plan tiene límite)
  IF v_plan_max_units IS NOT NULL THEN
    SELECT COUNT(*) INTO v_plan_units_used
    FROM public.investments
    WHERE plan_id = p_plan_id
      AND status NOT IN ('CANCELLED', 'EXPIRED');

    IF v_plan_units_used >= v_plan_max_units THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Este plan exclusivo ha alcanzado su límite de cupos disponibles.'
      );
    END IF;
  END IF;

  -- 2. Bloquear fila de perfil y verificar saldo
  SELECT credit_balance INTO v_current_balance
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuario no encontrado.');
  END IF;

  IF v_current_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Saldo de crédito insuficiente.');
  END IF;

  -- 3. Crear registro de inversión
  INSERT INTO public.investments (
    user_id,
    plan_id,
    amount,
    status,
    accumulated_earnings,
    is_referral_commission_paid,
    created_at
  )
  VALUES (
    p_user_id,
    p_plan_id,
    p_amount,
    'ACTIVE',
    0,
    FALSE,
    NOW()
  )
  RETURNING id INTO v_investment_id;

  -- 4. Registrar transacción en el ledger
  INSERT INTO public.transactions (
    user_id,
    type,
    amount,
    status,
    description,
    reference_id,
    created_at
  )
  VALUES (
    p_user_id,
    'INVESTMENT_COST',
    -p_amount,
    'COMPLETED',
    'Activación de Nodo: $' || p_amount || ' (ID: ' || v_investment_id || ')',
    v_investment_id,
    NOW()
  );

  -- 5. Descontar saldo del perfil
  UPDATE public.profiles
  SET credit_balance = credit_balance - p_amount
  WHERE id = p_user_id;

  -- 6. Registrar en credit_logs
  INSERT INTO public.credit_logs (
    user_id,
    amount,
    type,
    description,
    created_at
  )
  VALUES (
    p_user_id,
    -p_amount,
    'TRANSFER_OUT',
    'Activación de Nodo: $' || p_amount,
    NOW()
  );

  RETURN jsonb_build_object(
    'success',    true,
    'investment', jsonb_build_object('id', v_investment_id, 'amount', p_amount)
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 4. Vista auxiliar: cupos usados por plan (útil para el admin panel)
CREATE OR REPLACE VIEW public.plan_unit_usage AS
SELECT
  p.id              AS plan_id,
  p.name            AS plan_name,
  p.max_units,
  COUNT(i.id)       AS units_used,
  GREATEST(COALESCE(p.max_units, 0) - COUNT(i.id)::INT, 0) AS units_remaining
FROM public.plans p
LEFT JOIN public.investments i
  ON i.plan_id = p.id AND i.status NOT IN ('CANCELLED', 'EXPIRED')
GROUP BY p.id, p.name, p.max_units;

-- Acceso de lectura para authenticated
GRANT SELECT ON public.plan_unit_usage TO authenticated;
