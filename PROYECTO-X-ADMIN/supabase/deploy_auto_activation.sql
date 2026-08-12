-- ============================================================
-- MIGRACIÓN: ACTIVACIÓN AUTOMÁTICA DE INVERSIONES
-- Ejecutar en Supabase → SQL Editor (una sola vez)
-- Fecha: 2026-03-03
-- ============================================================
-- Este script consolida: migration_auto_invest.sql + referral_distribution.sql
-- en un solo archivo atómico y listo para desplegar.
-- ============================================================

-- ============================================================
-- PASO 1: Preparar columnas necesarias
-- ============================================================
ALTER TABLE public.system_settings 
  ADD COLUMN IF NOT EXISTS auto_activate_investments BOOLEAN DEFAULT FALSE;

ALTER TABLE public.investments 
  ADD COLUMN IF NOT EXISTS is_referral_commission_paid BOOLEAN DEFAULT FALSE;

ALTER TABLE public.deposits
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Activar auto-inversión por defecto (Regla de Oro)
UPDATE public.system_settings SET auto_activate_investments = TRUE WHERE id = 1;

-- ============================================================
-- PASO 2: RPC process_deposit_approval con auto-activación
--         + distribución de comisiones integrada (atómico)
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_deposit_approval(
  p_deposit_id UUID,
  p_admin_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_amount DECIMAL;
  v_deposit_record RECORD;
  v_auto_activate BOOLEAN;
  v_plan_id UUID;
  v_investment_id UUID;
  -- Variables para comisiones
  v_current_referrer UUID;
  v_config JSONB;
  v_level_pct DECIMAL;
  v_commission DECIMAL;
  v_level INTEGER;
  v_investor_name TEXT;
BEGIN
  -- 1. Obtener depósito y bloquear para actualización
  SELECT * INTO v_deposit_record
  FROM public.deposits
  WHERE id = p_deposit_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Depósito no encontrado.');
  END IF;

  IF v_deposit_record.status = 'APPROVED' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Este depósito ya fue aprobado.');
  END IF;

  v_user_id := v_deposit_record.user_id;
  v_amount := v_deposit_record.amount;

  -- 2. Aprobar depósito
  UPDATE public.deposits
  SET 
    status = 'APPROVED',
    updated_at = NOW()
  WHERE id = p_deposit_id;

  -- 3. Acreditar wallet_balance (paso intermedio del ledger)
  UPDATE public.profiles
  SET wallet_balance = COALESCE(wallet_balance, 0) + v_amount
  WHERE id = v_user_id;

  -- 4. Completar transacción original de depósito
  UPDATE public.transactions
  SET 
    status = 'COMPLETED',
    updated_at = NOW()
  WHERE user_id = v_user_id 
    AND type = 'DEPOSIT' 
    AND (description LIKE '%' || p_deposit_id || '%' OR reference_id = p_deposit_id);

  -- 5. REGLA DE ORO: Verificar si auto-activación está habilitada
  SELECT auto_activate_investments INTO v_auto_activate 
  FROM public.system_settings LIMIT 1;
  
  IF v_auto_activate = TRUE THEN
    -- ============================================
    -- 5a. Convertir wallet_balance → credit_balance
    --     El usuario activará su inversión manualmente
    -- ============================================
    UPDATE public.profiles
    SET 
      wallet_balance = wallet_balance - v_amount,
      credit_balance = COALESCE(credit_balance, 0) + v_amount
    WHERE id = v_user_id;

    -- Log de conversión
    INSERT INTO public.transactions (user_id, amount, type, status, description, created_at)
    VALUES (v_user_id, v_amount, 'CONVERSION', 'COMPLETED', 
            'Auto-Conversión: Depósito crypto acreditado a Balance de Crédito', NOW());

    -- Log en credit_logs para UI
    INSERT INTO public.credit_logs (user_id, amount, type, description, created_at)
    VALUES (v_user_id, v_amount, 'DEPOSIT', 
            'Depósito Crypto Acreditado: $' || v_amount, NOW());

  END IF; -- v_auto_activate = TRUE

  -- 6. Resultado
  RETURN jsonb_build_object(
    'success', true, 
    'message', CASE 
      WHEN v_auto_activate THEN 
        'Depósito aprobado y acreditado al Balance de Crédito. El usuario puede activar su inversión.'
      ELSE 
        'Depósito aprobado correctamente y saldo acreditado al Wallet.' 
    END,
    'amount', v_amount,
    'user_id', v_user_id,
    'auto_credited', COALESCE(v_auto_activate, FALSE)
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- ============================================================
-- PASO 3: Trigger de respaldo para comisiones
-- (Se dispara cuando se crean inversiones manualmente)
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
    -- CAPA 1: Si ya se pagó la comisión (flag), no duplicar
    IF NEW.status != 'ACTIVE' OR NEW.is_referral_commission_paid = TRUE THEN
        RETURN NEW;
    END IF;

    -- CAPA 2: Verificación en base de datos - si ya existen comisiones para esta inversión, SALIR
    SELECT COUNT(*) INTO v_existing_commissions
    FROM public.transactions
    WHERE reference_id = NEW.id
      AND type = 'REFERRAL_COMMISSION';

    IF v_existing_commissions > 0 THEN
        -- Ya se distribuyeron comisiones para esta inversión, corregir flag y salir
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

-- Triggers para inversiones creadas manualmente (no por auto-activación)
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
-- VERIFICACIÓN: Ejecutar tras la migración para confirmar
-- ============================================================
-- SELECT auto_activate_investments FROM system_settings LIMIT 1;
-- Debe retornar: TRUE
--
-- SELECT proname FROM pg_proc WHERE proname = 'process_deposit_approval';
-- Debe retornar: process_deposit_approval
--
-- SELECT tgname FROM pg_trigger WHERE tgname LIKE 'tr_distribute%';
-- Debe retornar: tr_distribute_referral_commissions, tr_distribute_referral_commissions_insert
