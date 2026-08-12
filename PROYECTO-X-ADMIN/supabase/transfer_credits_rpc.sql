-- ==============================================================================================
-- REGLA DE ORO: Fee de Transferencia (5%)
-- ==============================================================================================
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
    v_receiver_id UUID;
    v_sender_balance NUMERIC;
    v_fee_pct NUMERIC;
    v_net_amount NUMERIC;
    v_result JSONB;
BEGIN
    -- 1. Validaciones iniciales de monto nulo o negativo
    IF amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Monto inválido para transferir.');
    END IF;

    -- 2. Obtener el ID del receptor
    SELECT id INTO v_receiver_id FROM public.profiles WHERE email = receiver_email;
    IF v_receiver_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Usuario receptor no encontrado.');
    END IF;

    -- Prevenir auto-transferencias erróneas
    IF sender_id = v_receiver_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'No puedes transferirte a ti mismo.');
    END IF;

    -- 3. Iniciar entorno transaccional aislado contra el sender
    SELECT credit_balance INTO v_sender_balance
    FROM public.profiles
    WHERE id = sender_id
    FOR UPDATE; -- Bloqueo de fila para evitar recargas paralelas falsas y fallos de balance

    IF v_sender_balance < amount THEN
        RETURN jsonb_build_object('success', false, 'message', 'Balance de Crédito Insuficiente.');
    END IF;

    -- 4. Obtener Fee del Sistema (Por defecto 5 si no se encuentra)
    SELECT COALESCE(credit_transfer_fee, 5) INTO v_fee_pct FROM public.system_settings LIMIT 1;
    v_net_amount := amount * (1.0 - (v_fee_pct / 100.0));

    -- 5. Disminuir el saldo completo (Bruto) del emisor
    UPDATE public.profiles
    SET credit_balance = credit_balance - amount
    WHERE id = sender_id;

    -- 6. Aumentar el saldo neto (Bruto - 5% Fee) del receptor
    UPDATE public.profiles
    SET credit_balance = credit_balance + v_net_amount
    WHERE id = v_receiver_id;

    -- 7. Éxito
    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Transferencia éxitosa', 
        'net_amount', v_net_amount, 
        'fee_burned', amount - v_net_amount
    );

EXCEPTION WHEN OTHERS THEN
    -- Ante cualquier colapso, revertir
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;
