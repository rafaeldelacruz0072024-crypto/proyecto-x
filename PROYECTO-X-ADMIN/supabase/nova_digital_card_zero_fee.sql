-- ============================================================
-- NOVA DIGITAL CARD: Fee 0% en retiros con método NOVA DIGITAL CARD
-- Actualiza create_withdrawal_request para eximir de comisión
-- a los retiros procesados vía tarjeta corporativa NOVA Digital.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_withdrawal_request(
  p_user_id UUID,
  p_amount NUMERIC,
  p_method TEXT,
  p_wallet_address TEXT,
  p_bypass_window BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_settings RECORD;
  v_fee_amount NUMERIC;
  v_net_amount NUMERIC;
  v_withdrawal_id UUID;
  v_current_time TIMESTAMPTZ;
  v_current_hour INTEGER;
  v_current_day INTEGER;
  v_wallet_balance NUMERIC;
  v_withdrawals_blocked BOOLEAN;
  v_daily_count INTEGER;
  v_is_override_active BOOLEAN := FALSE;
BEGIN
  -- 1. Solo service_role puede usar bypass
  IF p_bypass_window = TRUE AND current_setting('role') != 'service_role' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Parámetro no permitido para usuarios autenticados.');
  END IF;

  -- 2. Leer configuración del sistema
  SELECT
    withdrawal_fee,
    min_withdrawal,
    withdrawal_global_blocked,
    withdrawal_window_enabled,
    withdrawal_open_day,
    withdrawal_open_hour,
    withdrawal_close_hour,
    withdrawal_override_until
  INTO v_settings
  FROM public.system_settings
  LIMIT 1;

  -- 3. Verificar bloqueo global (kill switch — anula todo, incluyendo override)
  IF v_settings.withdrawal_global_blocked = TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', 'Los retiros están temporalmente suspendidos. Contacta a soporte.');
  END IF;

  -- 4. Verificar si hay override activo (desbloqueo manual temporal)
  IF v_settings.withdrawal_override_until IS NOT NULL AND v_settings.withdrawal_override_until > NOW() THEN
    v_is_override_active := TRUE;
  END IF;

  -- 5. Si no hay override, verificar ventana horaria
  IF NOT v_is_override_active AND NOT p_bypass_window AND v_settings.withdrawal_window_enabled = TRUE THEN
    v_current_time := NOW() AT TIME ZONE 'America/Caracas';
    v_current_hour := EXTRACT(HOUR FROM v_current_time);
    v_current_day  := EXTRACT(DOW FROM v_current_time);

    IF v_settings.withdrawal_open_day IS NOT NULL AND v_current_day != v_settings.withdrawal_open_day THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Los retiros solo están disponibles el ' ||
          CASE v_settings.withdrawal_open_day
            WHEN 0 THEN 'domingo'
            WHEN 1 THEN 'lunes'
            WHEN 2 THEN 'martes'
            WHEN 3 THEN 'miércoles'
            WHEN 4 THEN 'jueves'
            WHEN 5 THEN 'viernes'
            WHEN 6 THEN 'sábado'
          END || '.'
      );
    END IF;

    IF v_current_hour < v_settings.withdrawal_open_hour OR v_current_hour >= v_settings.withdrawal_close_hour THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Fuera de la ventana de retiros. Horario: ' ||
          LPAD(v_settings.withdrawal_open_hour::TEXT, 2, '0') || ':00 – ' ||
          LPAD(v_settings.withdrawal_close_hour::TEXT, 2, '0') || ':00 UTC-4.'
      );
    END IF;
  END IF;

  -- 6. Verificar bloqueo individual del usuario
  SELECT withdrawals_blocked, wallet_balance
  INTO v_withdrawals_blocked, v_wallet_balance
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_withdrawals_blocked = TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tu cuenta tiene una restricción para realizar retiros. Contacta a soporte.');
  END IF;

  -- 7. Validar límite diario (máx 1 retiro por día)
  SELECT COUNT(*) INTO v_daily_count
  FROM public.withdrawals
  WHERE user_id = p_user_id
    AND created_at >= (NOW() AT TIME ZONE 'America/Caracas')::DATE
    AND status NOT IN ('REJECTED', 'CANCELLED');

  IF v_daily_count >= 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Has alcanzado el límite de 1 retiro por día.');
  END IF;

  -- 8. Validar monto mínimo
  IF p_amount < v_settings.min_withdrawal THEN
    RETURN jsonb_build_object('success', false, 'error', 'El monto mínimo de retiro es $' || v_settings.min_withdrawal || ' USDT.');
  END IF;

  -- 9. Validar saldo suficiente
  IF v_wallet_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Saldo insuficiente en el wallet.');
  END IF;

  -- 10. Calcular fee — NOVA DIGITAL CARD tiene 0% durante 30 días (hasta 2026-05-22)
  IF p_method = 'NOVA DIGITAL CARD' AND NOW() <= TIMESTAMPTZ '2026-05-22 23:59:59-04:00' THEN
    v_fee_amount := 0;
    v_net_amount := p_amount;
  ELSE
    v_fee_amount := ROUND((p_amount * v_settings.withdrawal_fee / 100), 2);
    v_net_amount := p_amount - v_fee_amount;
  END IF;

  -- 11. Crear el registro de retiro
  INSERT INTO public.withdrawals (
    user_id, amount, fee_amount, net_amount, method, wallet_address, status, created_at
  )
  VALUES (
    p_user_id, p_amount, v_fee_amount, v_net_amount, p_method, p_wallet_address, 'PENDING', NOW()
  )
  RETURNING id INTO v_withdrawal_id;

  -- 12. Debitar wallet
  UPDATE public.profiles
  SET wallet_balance = wallet_balance - p_amount
  WHERE id = p_user_id;

  -- 13. Registrar transacción en el ledger
  INSERT INTO public.transactions (user_id, type, amount, description, created_at)
  VALUES (p_user_id, 'WITHDRAWAL', -p_amount, 'Retiro solicitado #' || v_withdrawal_id::TEXT, NOW());

  RETURN jsonb_build_object(
    'success', true,
    'withdrawal_id', v_withdrawal_id,
    'net_amount', v_net_amount,
    'fee_amount', v_fee_amount,
    'override_active', v_is_override_active,
    'card_withdrawal', (p_method = 'NOVA DIGITAL CARD')
  );
END;
$$;
