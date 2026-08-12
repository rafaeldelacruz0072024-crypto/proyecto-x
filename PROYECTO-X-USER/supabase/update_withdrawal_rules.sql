-- ============================================================
-- PHYZER: Actualizar Reglas de Retiro (Regla de Oro)
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Actualizar configuración global en system_settings
--    - Ventana horaria: Todos los días (withdrawal_open_day = NULL) de 9 AM a 3 PM (15:00) UTC-4
--    - Retiro mínimo: $25.00 USDT (min_withdrawal = 25)
UPDATE public.system_settings
SET
  withdrawal_open_day = NULL,
  withdrawal_open_hour = 9,
  withdrawal_close_hour = 15,
  min_withdrawal = 25
WHERE id = 1;

-- Si por alguna razón la fila no tiene id = 1, actualizamos todas las filas de configuración (normalmente solo hay 1)
UPDATE public.system_settings
SET
  withdrawal_open_day = NULL,
  withdrawal_open_hour = 9,
  withdrawal_close_hour = 15,
  min_withdrawal = 25;

-- 2. Crear o reemplazar la función RPC para procesar las solicitudes de retiro
--    Esta función valida la ventana horaria, el retiro mínimo, el saldo del usuario
--    y limita las solicitudes de retiro a una sola por día (en la zona horaria UTC-4).
CREATE OR REPLACE FUNCTION public.create_withdrawal_request(
  p_user_id UUID,
  p_amount NUMERIC,
  p_method TEXT,
  p_wallet_address TEXT,
  p_bypass_window BOOLEAN DEFAULT false
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_settings RECORD;
  v_profile RECORD;
  v_now_utc4 TIMESTAMP;
  v_day INTEGER;
  v_hour INTEGER;
  v_fee NUMERIC;
  v_net_amount NUMERIC;
  v_withdrawal_id UUID;
  v_fee_percent NUMERIC;
BEGIN
  -- A. Obtener configuración del sistema
  SELECT * INTO v_settings FROM public.system_settings LIMIT 1;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Configuración del sistema no encontrada.');
  END IF;

  -- B. Obtener perfil de usuario
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Usuario no encontrado.');
  END IF;

  -- C. Validar si la cuenta está suspendida
  IF v_profile.status = 'suspended' THEN
    RETURN json_build_object('success', false, 'error', 'Cuenta suspendida.');
  END IF;

  -- D. Validar si el usuario tiene los retiros bloqueados administrativamente
  IF v_profile.withdrawals_blocked = true THEN
    RETURN json_build_object('success', false, 'error', 'Los retiros están suspendidos para tu cuenta. Comunícate con soporte.');
  END IF;

  -- E. Validar ventana horaria (si no se realiza bypass)
  IF NOT p_bypass_window THEN
    -- Validar bloqueo global
    IF v_settings.withdrawal_global_blocked = true THEN
      RETURN json_build_object('success', false, 'error', 'Retiros suspendidos temporalmente.');
    END IF;

    -- Validar restricción horaria activa
    IF v_settings.withdrawal_window_enabled = true THEN
      -- Obtener hora actual en zona UTC-4
      v_now_utc4 := timezone('UTC', now()) - interval '4 hours';
      v_day := extract(dow from v_now_utc4); -- 0 = Domingo, 6 = Sábado
      v_hour := extract(hour from v_now_utc4);

      -- Validar día (si está configurado un día en particular)
      IF v_settings.withdrawal_open_day IS NOT NULL AND v_day != v_settings.withdrawal_open_day THEN
        RETURN json_build_object('success', false, 'error', 'Ventana de retiro cerrada hoy.');
      END IF;

      -- Validar rango de horas (open_hour <= hora < close_hour)
      IF v_hour < v_settings.withdrawal_open_hour OR v_hour >= v_settings.withdrawal_close_hour THEN
        RETURN json_build_object('success', false, 'error', 'Ventana de retiro cerrada. Horario permitido: ' || 
          to_char(v_settings.withdrawal_open_hour, 'FM00') || ':00 a ' || 
          to_char(v_settings.withdrawal_close_hour, 'FM00') || ':00 (UTC-4).');
      END IF;
    END IF;
  END IF;

  -- F. Validar monto mínimo de retiro
  IF p_amount < v_settings.min_withdrawal THEN
    RETURN json_build_object('success', false, 'error', 'El monto mínimo de retiro es de $' || trim(to_char(v_settings.min_withdrawal, '9999990.99')) || ' USDT.');
  END IF;

  -- G. Validar saldo suficiente
  IF v_profile.wallet_balance < p_amount THEN
    RETURN json_build_object('success', false, 'error', 'Saldo insuficiente.');
  END IF;

  -- H. REGLA DE ORO: Limitar a un solo retiro de comisiones por día (en zona UTC-4)
  v_now_utc4 := timezone('UTC', now()) - interval '4 hours';
  IF EXISTS (
    SELECT 1 FROM public.withdrawals
    WHERE user_id = p_user_id
      AND status != 'REJECTED'
      AND (timezone('UTC', created_at) - interval '4 hours')::date = v_now_utc4::date
  ) THEN
    -- Retornar el código de traducción para que la UI lo traduzca e inhabilite de inmediato
    RETURN json_build_object('success', false, 'error', 'withdrawal.errors.limit_24h');
  END IF;

  -- I. Calcular comisión de retiro y monto neto
  IF p_method = 'PHYZER CARD' THEN
    v_fee := 0;
  ELSE
    v_fee_percent := COALESCE(v_settings.withdrawal_fee, 10);
    v_fee := p_amount * (v_fee_percent / 100.0);
  END IF;
  v_net_amount := p_amount - v_fee;

  -- J. Generar ID único de retiro
  v_withdrawal_id := gen_random_uuid();

  -- K. Ejecución transaccional de los movimientos
  -- 1. Descontar el saldo del perfil del usuario
  UPDATE public.profiles
  SET wallet_balance = wallet_balance - p_amount
  WHERE id = p_user_id;

  -- 2. Insertar el registro de retiro en estado PENDING
  INSERT INTO public.withdrawals (
    id,
    user_id,
    amount,
    fee,
    net_amount,
    method,
    wallet_address,
    status,
    created_at
  ) VALUES (
    v_withdrawal_id,
    p_user_id,
    p_amount,
    v_fee,
    v_net_amount,
    p_method,
    p_wallet_address,
    'PENDING',
    now()
  );

  -- 3. Insertar el registro de auditoría en la tabla de transacciones
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
    'Retiro Solicitado: $' || trim(to_char(p_amount, '999999990.00')) || 
      CASE WHEN p_method = 'PHYZER CARD' THEN ' (0% Fee)' ELSE ' (Comisión: ' || v_fee_percent || '%)' END ||
      ' vía ' || p_method || ' (Ref: ' || v_withdrawal_id || ')',
    now()
  );

  -- Retornar confirmación exitosa con detalles del retiro
  RETURN json_build_object(
    'success', true,
    'withdrawal_id', v_withdrawal_id,
    'amount', p_amount
  );
END;
$$;
