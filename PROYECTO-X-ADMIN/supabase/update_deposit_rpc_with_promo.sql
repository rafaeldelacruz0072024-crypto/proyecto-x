-- =========================================================================
-- UPDATE: process_deposit_approval RPC con inyección de PROMOCION ACTIVA
-- Descripción: Al confirmar un depósito real de la Blockchain, el sistema 
-- busca si el usuario califica para una promoción "CASHBACK" / "BONUS"
-- aplicándola en tiempo real al balance recibido en el Credit Wallet.
-- =========================================================================

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
  v_promo_amount DECIMAL := 0;
  v_promo_title TEXT;
  v_promo_type TEXT;
  v_final_credit DECIMAL;
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

  -- 5. REGLA DE ORO / AUTO-INVEST: Verificar si auto-activación está habilitada
  SELECT auto_activate_investments INTO v_auto_activate 
  FROM public.system_settings LIMIT 1;
  
  IF v_auto_activate = TRUE THEN
    
    -- ========================================================
    -- MODULO PROMOCIONAL (NUEVO)
    -- Buscar si hay un evento activo tipo Cashback/Bonus al que el monto califique
    -- ========================================================
    SELECT reward_value, title, type INTO v_promo_amount, v_promo_title, v_promo_type
    FROM public.promotions
    WHERE is_active = true 
      AND start_date <= NOW() 
      AND end_date >= NOW()
      AND (min_investment = 0 OR min_investment <= v_amount)
      AND type IN ('CASHBACK', 'BONUS')
    ORDER BY reward_value DESC LIMIT 1;

    -- Calcular el monto de bonificación y sumarlo a la v_amount original
    IF v_promo_amount > 0 THEN
      IF v_promo_type = 'CASHBACK' OR v_promo_type = 'DISCOUNT' THEN
        -- Es porcentaje: (v_amount * % / 100)
        v_promo_amount := (v_amount * v_promo_amount) / 100;
      END IF; -- Si es BONUS, v_promo_amount es un valor fijo en USDT
    ELSE
      v_promo_amount := 0;
    END IF;

    -- Monto total en Credit Wallet
    v_final_credit := v_amount + COALESCE(v_promo_amount, 0);

    -- ============================================
    -- Convertir wallet_balance → credit_balance
    -- ============================================
    UPDATE public.profiles
    SET 
      wallet_balance = wallet_balance - v_amount,
      credit_balance = COALESCE(credit_balance, 0) + v_final_credit
    WHERE id = v_user_id;

    -- Log de conversión principal (Depósito Original)
    INSERT INTO public.transactions (user_id, amount, type, status, description, created_at)
    VALUES (v_user_id, v_amount, 'CONVERSION', 'COMPLETED', 
            'Auto-Conversión: Depósito crypto acreditado a Balance de Crédito', NOW());

    INSERT INTO public.credit_logs (user_id, amount, type, description, created_at)
    VALUES (v_user_id, v_amount, 'DEPOSIT', 
            'Depósito Crypto Acreditado: $' || v_amount, NOW());

    -- Log de la Bonificación Promocional SI APLICA
    IF v_promo_amount > 0 THEN
       INSERT INTO public.transactions (user_id, amount, type, status, description, created_at)
       VALUES (v_user_id, v_promo_amount, 'BONUS', 'COMPLETED', 
               'Promoción Aplicada: ' || v_promo_title, NOW());

       INSERT INTO public.credit_logs (user_id, amount, type, description, created_at)
       VALUES (v_user_id, v_promo_amount, 'BONUS', 
               'Promo Cashback/Bono (' || v_promo_title || ')', NOW());
    END IF;

  END IF; -- v_auto_activate = TRUE

  -- 6. Resultado
  RETURN jsonb_build_object(
    'success', true, 
    'message', CASE 
      WHEN v_auto_activate THEN 
        'Depósito aprobado' || CASE WHEN v_promo_amount > 0 THEN ' + Bonificación Promo Aplicada.' ELSE ' y acreditado al Balance de Crédito.' END
      ELSE 
        'Depósito aprobado correctamente y saldo acreditado al Wallet.' 
    END,
    'amount', v_amount,
    'bonus', v_promo_amount,
    'user_id', v_user_id,
    'auto_credited', COALESCE(v_auto_activate, FALSE)
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;
