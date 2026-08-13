-- ============================================================
-- ATOMIC WITHDRAWAL REQUEST RPC
-- Reemplaza las 3+ llamadas secuenciales del cliente con 1 RPC.
-- Soluciona "TypeError: Load failed" en iOS Safari.
-- Ejecutar en Supabase SQL Editor.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_withdrawal_request(
  p_user_id        UUID,
  p_amount         NUMERIC,
  p_method         TEXT,
  p_wallet_address TEXT,
  p_bypass_window  BOOLEAN DEFAULT FALSE   -- TRUE solo para pruebas internas
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance         NUMERIC;
  v_fee_percent             NUMERIC := 10;
  v_min_withdrawal          NUMERIC := 25;
  v_fee                     NUMERIC;
  v_net_amount              NUMERIC;
  v_withdrawal_id           UUID;
  v_is_blocked              BOOLEAN := FALSE;
  v_global_blocked          BOOLEAN := FALSE;
  v_window_enabled          BOOLEAN := TRUE;
  v_open_day                INTEGER;        -- NULL = todos los días
  v_open_hour               INTEGER := 9;
  v_close_hour              INTEGER := 14;
  v_current_day_utc4        INTEGER;
  v_current_hour_utc4       INTEGER;
  v_daily_count             INTEGER;
  v_max_daily_withdrawals   INTEGER := 1;   -- máximo retiros por día por usuario
BEGIN
  -- 0. Validar que p_bypass_window solo lo puede usar el sistema (service_role)
  --    Un usuario normal nunca debe poder bypassear la ventana.
  IF p_bypass_window = TRUE AND auth.uid() IS NOT NULL THEN
    -- auth.uid() IS NOT NULL significa que es un usuario autenticado normal, no service_role
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Parámetro no permitido.'
    );
  END IF;
  -- 1. Leer configuración dinámica del sistema (una sola consulta)
  SELECT
    COALESCE(withdrawal_fee,              10),
    COALESCE(min_withdrawal,              25),
    COALESCE(withdrawal_global_blocked,   FALSE),
    COALESCE(withdrawal_window_enabled,   TRUE),
    withdrawal_open_day,                        -- puede ser NULL
    COALESCE(withdrawal_open_hour,        9),
    COALESCE(withdrawal_close_hour,       14)
  INTO
    v_fee_percent, v_min_withdrawal,
    v_global_blocked, v_window_enabled,
    v_open_day, v_open_hour, v_close_hour
  FROM public.system_settings
  LIMIT 1;

  -- 2. Verificar bloqueo global de retiros
  IF v_global_blocked AND NOT p_bypass_window THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Los retiros están temporalmente suspendidos. Intenta más tarde.'
    );
  END IF;

  -- 3. Validar ventana de tiempo si está habilitada
  IF v_window_enabled AND NOT p_bypass_window THEN
    v_current_day_utc4  := EXTRACT(DOW  FROM (NOW() AT TIME ZONE 'UTC' - INTERVAL '4 hours'))::INTEGER;
    v_current_hour_utc4 := EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'UTC' - INTERVAL '4 hours'))::INTEGER;

    -- Validar día (si open_day es NULL se permite cualquier día)
    IF v_open_day IS NOT NULL AND v_current_day_utc4 <> v_open_day THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', format(
          'Los retiros solo están disponibles el %s de %s:00 a %s:00 (UTC-4).',
          CASE v_open_day
            WHEN 0 THEN 'Domingo'   WHEN 1 THEN 'Lunes'    WHEN 2 THEN 'Martes'
            WHEN 3 THEN 'Miércoles' WHEN 4 THEN 'Jueves'   WHEN 5 THEN 'Viernes'
            ELSE 'Sábado'
          END,
          LPAD(v_open_hour::TEXT, 2, '0'),
          LPAD(v_close_hour::TEXT, 2, '0')
        )
      );
    END IF;

    -- Validar hora
    IF v_current_hour_utc4 < v_open_hour OR v_current_hour_utc4 >= v_close_hour THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', format(
          'Los retiros solo están disponibles de %s:00 a %s:00 (UTC-4).',
          LPAD(v_open_hour::TEXT, 2, '0'),
          LPAD(v_close_hour::TEXT, 2, '0')
        )
      );
    END IF;
  END IF;

  -- 4. Verificar que la cuenta no está bloqueada y obtener saldo (con lock de fila)
  SELECT wallet_balance, withdrawals_blocked
  INTO v_current_balance, v_is_blocked
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuario no encontrado.');
  END IF;

  IF v_is_blocked THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tu cuenta tiene una restricción para realizar retiros. Contacta soporte.');
  END IF;

  -- 4a. Validar límite diario de retiros por usuario
  SELECT COUNT(*) INTO v_daily_count
  FROM public.withdrawals
  WHERE user_id    = p_user_id
    AND created_at >= (NOW() AT TIME ZONE 'UTC' - INTERVAL '4 hours')::DATE
    AND status NOT IN ('REJECTED');

  IF v_daily_count >= v_max_daily_withdrawals THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format(
        'Has alcanzado el límite de %s retiros por día. Intenta mañana.',
        v_max_daily_withdrawals
      )
    );
  END IF;

  -- 4. Validar monto mínimo
  IF p_amount < v_min_withdrawal THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('El monto mínimo de retiro es $%s USDT.', v_min_withdrawal)
    );
  END IF;

  -- 5. Validar saldo suficiente
  IF v_current_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Saldo insuficiente.');
  END IF;

  -- 6. Calcular comisión y neto
  IF p_method = 'PROYECTO X CARD' THEN
    v_fee_percent := 3;
  END IF;

  v_fee        := p_amount * (v_fee_percent / 100.0);
  v_net_amount := p_amount - v_fee;

  -- 7. Crear registro de retiro
  INSERT INTO public.withdrawals (
    user_id,
    amount,
    fee,
    net_amount,
    method,
    wallet_address,
    status,
    created_at
  ) VALUES (
    p_user_id,
    p_amount,
    v_fee,
    v_net_amount,
    p_method,
    p_wallet_address,
    'PENDING',
    NOW()
  )
  RETURNING id INTO v_withdrawal_id;

  -- 8. Descontar saldo del perfil
  UPDATE public.profiles
  SET wallet_balance = wallet_balance - p_amount
  WHERE id = p_user_id;

  -- 9. Registrar transacción en el ledger
  INSERT INTO public.transactions (
    user_id,
    type,
    amount,
    status,
    description,
    created_at
  ) VALUES (
    p_user_id,
    'WITHDRAWAL',
    -p_amount,
    'PENDING',
    format('Retiro Solicitado: $%s (Comisión: %s%%) vía %s (Ref: %s)',
      p_amount, v_fee_percent, p_method, v_withdrawal_id),
    NOW()
  );

  RETURN jsonb_build_object(
    'success',        true,
    'withdrawal_id',  v_withdrawal_id,
    'amount',         p_amount,
    'fee',            v_fee,
    'net_amount',     v_net_amount
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error',   SQLERRM
  );
END;
$$;

-- Permisos
GRANT EXECUTE ON FUNCTION public.create_withdrawal_request(UUID, NUMERIC, TEXT, TEXT, BOOLEAN) TO authenticated;
