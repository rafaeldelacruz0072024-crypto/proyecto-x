-- ============================================================
-- MÓDULO DE JUEGOS Y ENTRETENIMIENTO
-- ============================================================

-- 1. Tabla de Juegos
CREATE TABLE IF NOT EXISTS public.games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'TRADING',
    image_url TEXT,
    game_url TEXT, -- Para juegos externos
    game_code TEXT, -- Para juegos embebidos/locales
    is_active BOOLEAN DEFAULT true,
    min_bet DECIMAL DEFAULT 1,
    max_bet DECIMAL DEFAULT 1000,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view active games" ON public.games
    FOR SELECT USING (is_active = true OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'sub-admin'));

CREATE POLICY "Admins can manage games" ON public.games
    FOR ALL USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'sub-admin'));

-- 2. Registro de Sesiones de Juego (Opcional, para auditoría)
CREATE TABLE IF NOT EXISTS public.game_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    game_id UUID REFERENCES public.games(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'OPEN', -- OPEN, CLOSED
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. RPC: PROCESAR APUESTA (Bet)
-- Deduce del wallet_balance de forma atómica
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
    -- Bloquear perfil para actualización
    SELECT wallet_balance INTO v_current_balance
    FROM public.profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF v_current_balance < p_amount THEN
        RETURN jsonb_build_object('success', false, 'message', 'Saldo insuficiente en el wallet.');
    END IF;

    -- Deducir saldo
    UPDATE public.profiles
    SET wallet_balance = wallet_balance - p_amount
    WHERE id = p_user_id;

    -- Registrar transacción
    INSERT INTO public.transactions (user_id, amount, type, status, description, created_at)
    VALUES (p_user_id, -p_amount, 'GAME_STAKE', 'COMPLETED', 'Apuesta en juego: ' || p_game_name, NOW());

    RETURN jsonb_build_object('success', true, 'new_balance', v_current_balance - p_amount);
END;
$$;

-- 4. RPC: PROCESAR RESULTADO (Win)
-- Acredita al wallet_balance
CREATE OR REPLACE FUNCTION public.process_game_result(
    p_user_id UUID,
    p_amount DECIMAL, -- El monto ganado (payout total)
    p_game_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Acreditar saldo
    UPDATE public.profiles
    SET wallet_balance = COALESCE(wallet_balance, 0) + p_amount
    WHERE id = p_user_id;

    -- Registrar transacción
    INSERT INTO public.transactions (user_id, amount, type, status, description, created_at)
    VALUES (p_user_id, p_amount, 'GAME_WIN', 'COMPLETED', 'Ganancia en juego: ' || p_game_name, NOW());

    RETURN jsonb_build_object('success', true);
END;
$$;

-- Insertar juego inicial (Trading Game)
INSERT INTO public.games (title, description, category, is_active, min_bet, max_bet)
VALUES ('Crypto Trading Game', 'Predice si el precio subirá o bajará en 60 segundos y gana hasta 1.9x', 'TRADING', true, 1, 500)
ON CONFLICT DO NOTHING;
