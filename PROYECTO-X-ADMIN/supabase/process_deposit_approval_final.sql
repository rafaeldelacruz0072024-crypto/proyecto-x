-- =========================================================================
-- process_deposit_approval — VERSIÓN FINAL UNIFICADA
-- Combina: promociones (update_deposit_rpc_with_promo.sql)
--        + auto-conversión (deploy_auto_activation.sql)
--        + auto-creación de inversión (FIX #5 — antes no ocurría)
--
-- EJECUTAR EN: Supabase → SQL Editor
-- REEMPLAZA: deploy_auto_activation.sql y update_deposit_rpc_with_promo.sql
-- =========================================================================

CREATE OR REPLACE FUNCTION public.process_deposit_approval(
  p_deposit_id UUID,
  p_admin_id   UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deposit_record  RECORD;
  v_user_id         UUID;
  v_amount          DECIMAL;
  v_auto_activate   BOOLEAN;

  -- Módulo Promocional
  v_promo_amount    DECIMAL := 0;
  v_promo_title     TEXT;
  v_promo_type      TEXT;
  v_final_credit    DECIMAL;

  -- Auto-inversión
  v_plan_id         UUID;
  v_investment_id   UUID;
BEGIN
  -- ── 1. Obtener depósito con lock de fila ──────────────────────────────
  SELECT * INTO v_deposit_record
  FROM public.deposits
  WHERE id = p_deposit_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Depósito no encontrado.');
  END IF;

  -- Idempotencia: no procesar dos veces
  IF v_deposit_record.status = 'APPROVED' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Este depósito ya fue aprobado.');
  END IF;

  v_user_id := v_deposit_record.user_id;
  v_amount  := v_deposit_record.amount;

  -- ── 2. Marcar depósito como APPROVED ─────────────────────────────────
  UPDATE public.deposits
  SET status = 'APPROVED', updated_at = NOW()
  WHERE id = p_deposit_id;

  -- ── 3. Acreditar wallet_balance (paso intermedio del ledger) ──────────
  UPDATE public.profiles
  SET wallet_balance = COALESCE(wallet_balance, 0) + v_amount
  WHERE id = v_user_id;

  -- ── 4. Marcar transacción DEPOSIT original como COMPLETED ─────────────
  UPDATE public.transactions
  SET status = 'COMPLETED', updated_at = NOW()
  WHERE user_id = v_user_id
    AND type    = 'DEPOSIT'
    AND (description LIKE '%' || p_deposit_id || '%'
         OR reference_id = p_deposit_id::TEXT);

  -- ── 5. REGLA DE ORO: Auto-activación ─────────────────────────────────
  SELECT COALESCE(auto_activate_investments, FALSE)
  INTO v_auto_activate
  FROM public.system_settings
  LIMIT 1;

  IF v_auto_activate = TRUE THEN

    -- ── 5a. Módulo Promocional ────────────────────────────────────────
    SELECT reward_value, title, type
    INTO v_promo_amount, v_promo_title, v_promo_type
    FROM public.promotions
    WHERE is_active     = true
      AND start_date   <= NOW()
      AND end_date     >= NOW()
      AND (min_investment = 0 OR min_investment <= v_amount)
      AND type IN ('CASHBACK', 'BONUS')
    ORDER BY reward_value DESC
    LIMIT 1;

    -- Calcular bono
    IF COALESCE(v_promo_amount, 0) > 0 THEN
      IF v_promo_type IN ('CASHBACK', 'DISCOUNT') THEN
        -- Porcentaje sobre el depósito
        v_promo_amount := (v_amount * v_promo_amount) / 100;
      END IF;
      -- Si es BONUS, v_promo_amount ya es monto fijo en USDT
    ELSE
      v_promo_amount := 0;
    END IF;

    v_final_credit := v_amount + v_promo_amount;

    -- ── 5b. Convertir wallet → credit ─────────────────────────────────
    UPDATE public.profiles
    SET wallet_balance = wallet_balance - v_amount,
        credit_balance = COALESCE(credit_balance, 0) + v_final_credit
    WHERE id = v_user_id;

    -- Log conversión base
    INSERT INTO public.transactions (user_id, amount, type, status, description, created_at)
    VALUES (v_user_id, v_amount, 'CONVERSION', 'COMPLETED',
            'Auto-Conversión: Depósito crypto acreditado a Balance de Crédito', NOW());

    INSERT INTO public.credit_logs (user_id, amount, type, description, created_at)
    VALUES (v_user_id, v_amount, 'DEPOSIT',
            'Depósito Crypto Acreditado: $' || v_amount, NOW());

    -- Log bono promocional (si aplica)
    IF v_promo_amount > 0 THEN
      INSERT INTO public.transactions (user_id, amount, type, status, description, created_at)
      VALUES (v_user_id, v_promo_amount, 'BONUS', 'COMPLETED',
              'Promoción Aplicada: ' || v_promo_title, NOW());

      INSERT INTO public.credit_logs (user_id, amount, type, description, created_at)
      VALUES (v_user_id, v_promo_amount, 'BONUS',
              'Promo Cashback/Bono (' || v_promo_title || ')', NOW());
    END IF;

    -- ── 5c. Auto-creación de inversión ───────────────────────────────
    -- Busca el plan activo con el mayor min_amount que no supere v_final_credit
    SELECT id INTO v_plan_id
    FROM public.plans
    WHERE is_active   = true
      AND min_amount <= v_final_credit
    ORDER BY min_amount DESC
    LIMIT 1;

    IF v_plan_id IS NOT NULL THEN
      -- Deducir el crédito recién acreditado
      UPDATE public.profiles
      SET credit_balance = credit_balance - v_final_credit
      WHERE id = v_user_id;

      -- Crear la inversión (el trigger distribuye comisiones automáticamente)
      INSERT INTO public.investments (
        user_id, plan_id, amount, status,
        accumulated_earnings, is_referral_commission_paid, created_at
      ) VALUES (
        v_user_id, v_plan_id, v_final_credit, 'ACTIVE',
        0, FALSE, NOW()
      )
      RETURNING id INTO v_investment_id;

      -- Log costo de inversión
      INSERT INTO public.transactions (user_id, amount, type, status, description, reference_id, created_at)
      VALUES (v_user_id, -v_final_credit, 'INVESTMENT_COST', 'COMPLETED',
              'Activación Automática de Nodo: $' || v_final_credit,
              v_investment_id::TEXT, NOW());

      INSERT INTO public.credit_logs (user_id, amount, type, description, created_at)
      VALUES (v_user_id, -v_final_credit, 'TRANSFER_OUT',
              'Activación de Nodo (Auto): $' || v_final_credit, NOW());
    END IF;
    -- Si no hay plan compatible, el crédito queda en credit_balance
    -- para que el usuario active manualmente.

  END IF; -- v_auto_activate

  -- ── 6. Retornar resultado ─────────────────────────────────────────────
  RETURN jsonb_build_object(
    'success',        true,
    'message',        CASE
                        WHEN v_auto_activate AND v_investment_id IS NOT NULL THEN
                          'Depósito aprobado, crédito acreditado'
                          || CASE WHEN v_promo_amount > 0 THEN ' con bono promocional' ELSE '' END
                          || ' e inversión activada automáticamente.'
                        WHEN v_auto_activate THEN
                          'Depósito aprobado y crédito acreditado. Sin plan disponible para auto-activar.'
                        ELSE
                          'Depósito aprobado y saldo acreditado al Wallet.'
                      END,
    'amount',         v_amount,
    'bonus',          v_promo_amount,
    'final_credit',   v_final_credit,
    'investment_id',  v_investment_id,
    'auto_credited',  v_auto_activate,
    'auto_invested',  (v_investment_id IS NOT NULL),
    'user_id',        v_user_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;
