-- ============================================================
-- FIX: Anti-Duplicación de Comisiones + process_investment
-- Ejecutar en Supabase SQL Editor (una sola vez)
-- Fecha: 2026-03-03
-- ============================================================

-- ============================================================
-- 1. RPC process_investment (con is_referral_commission_paid explícito)
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_investment(
  p_user_id UUID,
  p_amount DECIMAL,
  p_plan_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance DECIMAL;
  v_investment_id UUID;
BEGIN
  SELECT credit_balance INTO v_current_balance
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_current_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient credit balance');
  END IF;

  INSERT INTO public.investments (
    user_id, plan_id, amount, status, accumulated_earnings,
    is_referral_commission_paid, created_at
  )
  VALUES (
    p_user_id, p_plan_id, p_amount, 'ACTIVE', 0,
    FALSE, NOW()
  )
  RETURNING id INTO v_investment_id;

  INSERT INTO public.transactions (
    user_id, type, amount, status, description, reference_id, created_at
  )
  VALUES (
    p_user_id, 'INVESTMENT_COST', -p_amount, 'COMPLETED',
    'Investment Activation: $' || p_amount || ' Package (Node ID: ' || v_investment_id || ')',
    v_investment_id, NOW()
  );

  UPDATE public.profiles
  SET credit_balance = credit_balance - p_amount
  WHERE id = p_user_id;

  INSERT INTO public.credit_logs (
    user_id, amount, type, description, created_at
  )
  VALUES (
    p_user_id, -p_amount, 'TRANSFER_OUT',
    'Activación de Nodo: $' || p_amount, NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'investment', jsonb_build_object('id', v_investment_id, 'amount', p_amount)
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ============================================================
-- 2. Trigger con DOBLE CAPA anti-duplicación
-- ============================================================
CREATE OR REPLACE FUNCTION public.distribute_residual_commissions()
RETURNS TRIGGER AS $$
DECLARE
    v_investor_id UUID;
    v_amount DECIMAL;
    v_current_referrer UUID;
    v_config JSONB;
    v_level_pct DECIMAL;
    v_commission DECIMAL;
    v_level INTEGER;
    v_investor_name TEXT;
    v_existing_commissions INTEGER;
BEGIN
    -- CAPA 1: Flag de control
    IF NEW.status != 'ACTIVE' OR NEW.is_referral_commission_paid = TRUE THEN
        RETURN NEW;
    END IF;

    -- CAPA 2: Verificación directa en BD (a prueba de manipulación manual)
    SELECT COUNT(*) INTO v_existing_commissions
    FROM public.transactions
    WHERE reference_id = NEW.id
      AND type = 'REFERRAL_COMMISSION';

    IF v_existing_commissions > 0 THEN
        UPDATE public.investments SET is_referral_commission_paid = TRUE WHERE id = NEW.id;
        RETURN NEW;
    END IF;

    v_investor_id := NEW.user_id;
    v_amount := NEW.amount;

    SELECT COALESCE(full_name, username, email) INTO v_investor_name 
    FROM profiles WHERE id = v_investor_id;

    SELECT residual_config INTO v_config FROM system_settings LIMIT 1;

    IF v_config IS NULL OR jsonb_array_length(v_config) = 0 THEN
        RETURN NEW;
    END IF;

    SELECT referred_by INTO v_current_referrer FROM profiles WHERE id = v_investor_id;

    FOR v_level IN 1..30 LOOP
        EXIT WHEN v_current_referrer IS NULL;

        SELECT (elem->>'percent')::DECIMAL INTO v_level_pct
        FROM jsonb_array_elements(v_config) AS elem
        WHERE (elem->>'id')::INTEGER = v_level;

        IF v_level_pct IS NOT NULL AND v_level_pct > 0 THEN
            v_commission := v_amount * (v_level_pct / 100);

            INSERT INTO public.transactions (
                user_id, amount, type, status, description, reference_id, created_at
            )
            VALUES (
                v_current_referrer, v_commission, 'REFERRAL_COMMISSION', 'COMPLETED', 
                'Nivel ' || v_level || ': Comisión por inversión de ' || v_investor_name || ' ($' || v_amount || ')',
                NEW.id, NOW()
            );

            UPDATE public.profiles 
            SET wallet_balance = COALESCE(wallet_balance, 0) + v_commission
            WHERE id = v_current_referrer;
        END IF;

        SELECT referred_by INTO v_current_referrer FROM profiles WHERE id = v_current_referrer;
    END LOOP;

    UPDATE public.investments SET is_referral_commission_paid = TRUE WHERE id = NEW.id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-crear triggers (idempotente)
DROP TRIGGER IF EXISTS tr_distribute_referral_commissions ON public.investments;
CREATE TRIGGER tr_distribute_referral_commissions
    AFTER UPDATE OF status ON public.investments
    FOR EACH ROW
    WHEN (NEW.status = 'ACTIVE' AND OLD.status != 'ACTIVE')
    EXECUTE FUNCTION distribute_residual_commissions();

DROP TRIGGER IF EXISTS tr_distribute_referral_commissions_insert ON public.investments;
CREATE TRIGGER tr_distribute_referral_commissions_insert
    AFTER INSERT ON public.investments
    FOR EACH ROW
    WHEN (NEW.status = 'ACTIVE')
    EXECUTE FUNCTION distribute_residual_commissions();

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- SELECT proname FROM pg_proc WHERE proname IN ('process_investment', 'distribute_residual_commissions');
-- Debe retornar ambos
