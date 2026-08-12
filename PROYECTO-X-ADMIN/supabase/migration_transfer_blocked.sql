-- ============================================================
-- MIGRACIÓN: Bloqueo de transferencia de créditos por usuario
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Agregar columna transfer_blocked a profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS transfer_blocked boolean NOT NULL DEFAULT false;

-- 2. Actualizar función transfer_credits para respetar el bloqueo
DROP FUNCTION IF EXISTS public.transfer_credits(uuid, text, numeric);

CREATE OR REPLACE FUNCTION public.transfer_credits(
    sender_id UUID,
    receiver_email TEXT,
    amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_receiver_id       UUID;
    v_sender_balance    NUMERIC;
    v_sender_blocked    BOOLEAN;
    v_receiver_blocked  BOOLEAN;
    v_fee_pct           NUMERIC;
    v_net_amount        NUMERIC;
BEGIN
    IF amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Monto inválido para transferir.');
    END IF;

    -- Obtener receptor
    SELECT id, transfer_blocked INTO v_receiver_id, v_receiver_blocked
    FROM public.profiles WHERE email = receiver_email;

    IF v_receiver_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Usuario receptor no encontrado.');
    END IF;

    IF sender_id = v_receiver_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'No puedes transferirte a ti mismo.');
    END IF;

    -- Verificar bloqueo del emisor
    SELECT credit_balance, transfer_blocked INTO v_sender_balance, v_sender_blocked
    FROM public.profiles WHERE id = sender_id FOR UPDATE;

    IF v_sender_blocked THEN
        RETURN jsonb_build_object('success', false, 'message', 'Tu cuenta tiene las transferencias de crédito bloqueadas. Contacta al soporte.');
    END IF;

    IF v_receiver_blocked THEN
        RETURN jsonb_build_object('success', false, 'message', 'La cuenta receptora tiene las transferencias bloqueadas.');
    END IF;

    IF v_sender_balance < amount THEN
        RETURN jsonb_build_object('success', false, 'message', 'Balance de Crédito Insuficiente.');
    END IF;

    SELECT COALESCE(credit_transfer_fee, 5) INTO v_fee_pct FROM public.system_settings LIMIT 1;
    v_net_amount := amount * (1.0 - (v_fee_pct / 100.0));

    UPDATE public.profiles SET credit_balance = credit_balance - amount WHERE id = sender_id;
    UPDATE public.profiles SET credit_balance = credit_balance + v_net_amount WHERE id = v_receiver_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Transferencia exitosa',
        'net_amount', v_net_amount,
        'fee_burned', amount - v_net_amount
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;
