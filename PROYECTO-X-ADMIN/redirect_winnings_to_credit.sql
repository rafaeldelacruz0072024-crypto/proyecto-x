-- ============================================================
-- MIGRACIÓN: REDIRECCIÓN DE GANANCIAS A BALANCE CRÉDITO
-- ============================================================

-- 1. Actualizar la función process_game_result para depositar en credit_balance
CREATE OR REPLACE FUNCTION public.process_game_result(
    p_user_id UUID,
    p_amount DECIMAL,
    p_game_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_credit_balance DECIMAL;
BEGIN
    -- Validar monto
    IF p_amount < 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'El monto de ganancia no puede ser negativo.');
    END IF;

    -- Acreditar al BALANCE CRÉDITO (No Retirable)
    UPDATE public.profiles
    SET credit_balance = COALESCE(credit_balance, 0) + p_amount
    WHERE id = p_user_id
    RETURNING credit_balance INTO v_new_credit_balance;

    -- Registrar transacción de ganancia
    IF p_amount > 0 THEN
        INSERT INTO public.transactions (user_id, amount, type, status, description, created_at)
        VALUES (p_user_id, p_amount, 'GAME_WIN', 'COMPLETED', 'Ganancia (Crédito) en juego: ' || p_game_name, NOW());
    END IF;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Ganancias acreditadas a balance Crédito.',
        'new_credit_balance', v_new_credit_balance
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'Error interno: ' || SQLERRM);
END;
$$;

-- 2. Asegurar que process_game_bet deduzca de wallet_balance (mantiene la lógica de "Cash In -> Credit Win")
-- Esta ya está configurada, pero la reafirmamos por seguridad.
CREATE OR REPLACE FUNCTION public.process_game_bet(
    p_user_id UUID,
    p_amount DECIMAL,
    p_game_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_balance DECIMAL;
BEGIN
    IF p_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Monto inválido.');
    END IF;

    SELECT COALESCE(wallet_balance, 0) INTO v_current_balance
    FROM public.profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF v_current_balance < p_amount THEN
        RETURN jsonb_build_object('success', false, 'message', 'Saldo insuficiente para apostar.');
    END IF;

    UPDATE public.profiles
    SET wallet_balance = wallet_balance - p_amount
    WHERE id = p_user_id;

    INSERT INTO public.transactions (user_id, amount, type, status, description, created_at)
    VALUES (p_user_id, -p_amount, 'GAME_STAKE', 'COMPLETED', 'Apuesta en juego: ' || p_game_name, NOW());

    RETURN jsonb_build_object('success', true, 'new_balance', v_current_balance - p_amount);
END;
$$;
