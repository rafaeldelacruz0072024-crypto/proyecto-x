-- ============================================================
-- FIX: SISTEMA DE JUEGOS - REPARACIÓN DE APUESTAS
-- ============================================================

-- 1. Eliminar restricciones de tipo en transacciones (si existen) para permitir nuevos tipos
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;

-- Asegurar tipos de transacciones (si es un ENUM)
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'transaction_type' AND e.enumlabel = 'GAME_STAKE') THEN
            ALTER TYPE public.transaction_type ADD VALUE 'GAME_STAKE';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'transaction_type' AND e.enumlabel = 'GAME_WIN') THEN
            ALTER TYPE public.transaction_type ADD VALUE 'GAME_WIN';
        END IF;
    END IF;
EXCEPTION
    WHEN OTHERS THEN NULL; 
END $$;

-- 2. RPC: PROCESAR APUESTA (Bet) - Versión Mejorada
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
    -- Validar monto
    IF p_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'El monto de la apuesta debe ser mayor a 0.');
    END IF;

    -- Bloquear perfil para actualización y manejar NULL
    SELECT COALESCE(wallet_balance, 0) INTO v_current_balance
    FROM public.profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Usuario no encontrado.');
    END IF;

    IF v_current_balance < p_amount THEN
        RETURN jsonb_build_object('success', false, 'message', 'Saldo insuficiente en el wallet. Tienes $' || v_current_balance);
    END IF;

    -- Deducir saldo
    UPDATE public.profiles
    SET wallet_balance = wallet_balance - p_amount
    WHERE id = p_user_id;

    -- Registrar transacción
    -- Se asume que la tabla transactions existe y tiene los campos: user_id, amount, type, status, description
    INSERT INTO public.transactions (user_id, amount, type, status, description, created_at)
    VALUES (p_user_id, -p_amount, 'GAME_STAKE', 'COMPLETED', 'Apuesta en juego: ' || p_game_name, NOW());

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Apuesta procesada.', 
        'new_balance', v_current_balance - p_amount
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'Error interno: ' || SQLERRM);
END;
$$;

-- 3. RPC: PROCESAR RESULTADO (Win) - Versión Mejorada
CREATE OR REPLACE FUNCTION public.process_game_result(
    p_user_id  UUID,
    p_amount   DECIMAL,
    p_game_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_caller_id UUID;
BEGIN
    -- Validar que el usuario que llama es el mismo que recibe la ganancia.
    -- Esto impide que un usuario acredite ganancias a otra cuenta.
    v_caller_id := auth.uid();

    IF v_caller_id IS NULL THEN
        -- Llamada sin sesión (solo permitida desde service_role / edge functions internas)
        -- En ese caso, confiamos en el p_user_id provisto.
        NULL;
    ELSIF v_caller_id != p_user_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'No puedes acreditar ganancias a otra cuenta.'
        );
    END IF;

    -- Validar monto razonable
    IF p_amount < 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'El monto de ganancia no puede ser negativo.');
    END IF;

    -- Verificar que el juego existe y está activo
    IF NOT EXISTS (
        SELECT 1 FROM public.games
        WHERE title = p_game_name AND is_active = true
    ) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Juego no válido o inactivo.');
    END IF;

    -- Acreditar saldo
    UPDATE public.profiles
    SET wallet_balance = COALESCE(wallet_balance, 0) + p_amount
    WHERE id = p_user_id;

    IF p_amount > 0 THEN
        INSERT INTO public.transactions (user_id, amount, type, status, description, created_at)
        VALUES (p_user_id, p_amount, 'GAME_WIN', 'COMPLETED',
                'Ganancia (Crédito) en juego: ' || p_game_name, NOW());
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Resultado procesado.');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'Error interno: ' || SQLERRM);
END;
$$;

-- 4. Asegurar constraint UNIQUE y que los juegos existen correctamente
DO $$ 
BEGIN 
    -- Primero eliminamos cualquier restricción previa para evitar conflictos de nombre
    ALTER TABLE public.games DROP CONSTRAINT IF EXISTS games_title_key;
    -- Creamos la restricción de unicidad en el título
    ALTER TABLE public.games ADD CONSTRAINT games_title_key UNIQUE (title);
END $$;

-- Limpiamos y re-insertamos para asegurar que no haya duplicados o juegos inactivos
-- Crypto Trading Game
INSERT INTO public.games (title, description, category, is_active, min_bet, max_bet)
VALUES ('Crypto Trading Game', 'Predice si el precio subirá o bajará en 60 segundos y gana hasta 1.9x', 'TRADING', true, 1, 1000)
ON CONFLICT (title) DO UPDATE 
SET 
    title = TRIM(EXCLUDED.title),
    description = EXCLUDED.description,
    is_active = true, 
    max_bet = 1000;

-- Plinko Premium
INSERT INTO public.games (title, description, category, is_active, min_bet, max_bet, image_url)
VALUES ('Plinko Premium', 'Juego de casino basado en física. Deja caer la bola y multiplica tu apuesta según el riesgo.', 'CASINO', true, 1, 1000, '/plinko_thumb.png')
ON CONFLICT (title) DO UPDATE 
SET 
    title = TRIM(EXCLUDED.title),
    description = EXCLUDED.description,
    is_active = true, 
    max_bet = 1000,
    image_url = EXCLUDED.image_url;
