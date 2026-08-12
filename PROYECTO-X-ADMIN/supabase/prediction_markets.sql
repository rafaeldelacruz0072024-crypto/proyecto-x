-- ============================================================
-- MÓDULO: MERCADOS DE PREDICCIÓN (estilo Polymarket)
-- AMM simple: precio fluctúa según volumen apostado
-- Resolución manual por admin
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Tabla principal de mercados
CREATE TABLE IF NOT EXISTS public.prediction_markets (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title        TEXT NOT NULL,
    description  TEXT,
    category     TEXT DEFAULT 'CRYPTO',          -- CRYPTO, SPORTS, POLITICS, ECONOMY
    image_url    TEXT,
    options      JSONB NOT NULL,                 -- [{"id":"A","label":"Sí","pool":0},{"id":"B","label":"No","pool":0}]
    total_pool   DECIMAL(18,2) DEFAULT 0,        -- Total USDT apostado en el mercado
    status       TEXT DEFAULT 'OPEN',            -- OPEN | CLOSED | RESOLVED | CANCELLED
    winning_option TEXT,                         -- id de la opción ganadora al resolver
    house_fee_pct DECIMAL(5,2) DEFAULT 2.0,      -- % que toma la casa (2%)
    closes_at    TIMESTAMPTZ NOT NULL,           -- Fecha de cierre de apuestas
    resolves_at  TIMESTAMPTZ,                    -- Fecha estimada de resolución
    resolved_at  TIMESTAMPTZ,                    -- Cuando fue resuelto realmente
    resolved_by  UUID REFERENCES auth.users(id),
    created_by   UUID REFERENCES auth.users(id),
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabla de apuestas individuales
CREATE TABLE IF NOT EXISTS public.prediction_bets (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id    UUID NOT NULL REFERENCES public.prediction_markets(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    option_id    TEXT NOT NULL,                  -- id de la opción elegida (ej: "A" o "B")
    amount       DECIMAL(18,2) NOT NULL,         -- USDT apostado
    shares       DECIMAL(18,6) NOT NULL,         -- shares recibidos (según AMM al momento de apostar)
    price_at_bet DECIMAL(10,6) NOT NULL,         -- precio de la opción al momento de apostar
    payout       DECIMAL(18,2),                  -- ganancia pagada (NULL hasta resolver)
    status       TEXT DEFAULT 'ACTIVE',          -- ACTIVE | WON | LOST | REFUNDED
    created_at   TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT min_bet CHECK (amount >= 1)       -- Mínimo $1
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_pred_bets_market   ON public.prediction_bets(market_id);
CREATE INDEX IF NOT EXISTS idx_pred_bets_user     ON public.prediction_bets(user_id);
CREATE INDEX IF NOT EXISTS idx_pred_markets_status ON public.prediction_markets(status);

-- RLS
ALTER TABLE public.prediction_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prediction_bets    ENABLE ROW LEVEL SECURITY;

-- Políticas: todos pueden ver mercados abiertos
CREATE POLICY "anyone can view markets" ON public.prediction_markets
    FOR SELECT USING (true);

-- Políticas: usuarios ven sus propias apuestas
CREATE POLICY "users view own bets" ON public.prediction_bets
    FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- 3. RPC: Colocar apuesta (SECURITY DEFINER — maneja wallet)
-- ============================================================
CREATE OR REPLACE FUNCTION public.place_prediction_bet(
    p_market_id  UUID,
    p_option_id  TEXT,
    p_amount     DECIMAL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id       UUID := auth.uid();
    v_market        RECORD;
    v_wallet        DECIMAL;
    v_option_pool   DECIMAL;
    v_total_pool    DECIMAL;
    v_price         DECIMAL;
    v_shares        DECIMAL;
    v_updated_opts  JSONB;
    v_bet_id        UUID;
BEGIN
    -- Validaciones básicas
    IF p_amount < 1 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Apuesta mínima: $1');
    END IF;

    -- Obtener mercado con bloqueo
    SELECT * INTO v_market FROM public.prediction_markets
    WHERE id = p_market_id FOR UPDATE;

    IF v_market IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Mercado no encontrado');
    END IF;

    IF v_market.status != 'OPEN' THEN
        RETURN jsonb_build_object('success', false, 'error', 'El mercado no está abierto');
    END IF;

    IF v_market.closes_at < NOW() THEN
        -- Auto-cerrar si venció
        UPDATE public.prediction_markets SET status = 'CLOSED' WHERE id = p_market_id;
        RETURN jsonb_build_object('success', false, 'error', 'El mercado ya cerró');
    END IF;

    -- Verificar que la opción existe
    IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_market.options) AS opt
        WHERE opt->>'id' = p_option_id
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Opción inválida');
    END IF;

    -- Verificar saldo del usuario
    SELECT wallet_balance INTO v_wallet FROM public.profiles
    WHERE id = v_user_id FOR UPDATE;

    IF v_wallet < p_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Saldo insuficiente');
    END IF;

    -- === AMM: Calcular precio y shares ===
    -- Precio de la opción = pool_opcion / total_pool (si hay pool)
    -- Si es el primer depósito, precio inicial = 0.5 (50/50)
    v_total_pool := v_market.total_pool;

    SELECT (opt->>'pool')::DECIMAL INTO v_option_pool
    FROM jsonb_array_elements(v_market.options) AS opt
    WHERE opt->>'id' = p_option_id;

    IF v_total_pool = 0 THEN
        v_price := 0.5;  -- Precio inicial 50%
    ELSE
        v_price := v_option_pool / v_total_pool;
        -- Clamp entre 0.02 y 0.98
        v_price := GREATEST(0.02, LEAST(0.98, v_price));
    END IF;

    -- Shares = amount / price
    v_shares := p_amount / v_price;

    -- === Actualizar pools en options JSONB ===
    SELECT jsonb_agg(
        CASE WHEN opt->>'id' = p_option_id
        THEN jsonb_set(opt, '{pool}', to_jsonb(COALESCE((opt->>'pool')::DECIMAL, 0) + p_amount))
        ELSE opt END
    )
    INTO v_updated_opts
    FROM jsonb_array_elements(v_market.options) AS opt;

    -- Actualizar mercado
    UPDATE public.prediction_markets
    SET total_pool = total_pool + p_amount,
        options    = v_updated_opts
    WHERE id = p_market_id;

    -- Debitar wallet del usuario
    UPDATE public.profiles
    SET wallet_balance = wallet_balance - p_amount
    WHERE id = v_user_id;

    -- Registrar transacción de débito
    INSERT INTO public.transactions (user_id, amount, type, status, description, reference_id, created_at)
    VALUES (v_user_id, -p_amount, 'PREDICTION_BET', 'COMPLETED',
            'Apuesta en mercado de predicción: ' || v_market.title || ' → Opción ' || p_option_id,
            p_market_id, NOW());

    -- Registrar apuesta
    INSERT INTO public.prediction_bets (market_id, user_id, option_id, amount, shares, price_at_bet)
    VALUES (p_market_id, v_user_id, p_option_id, p_amount, v_shares, v_price)
    RETURNING id INTO v_bet_id;

    RETURN jsonb_build_object(
        'success', true,
        'bet_id', v_bet_id,
        'shares', v_shares,
        'price', v_price,
        'amount', p_amount
    );
END;
$$;

-- ============================================================
-- 4. RPC: Resolver mercado (solo admin)
-- Distribuye ganancias automáticamente
-- ============================================================
CREATE OR REPLACE FUNCTION public.resolve_prediction_market(
    p_market_id    UUID,
    p_winning_option TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_market         RECORD;
    v_winning_pool   DECIMAL;
    v_total_pool     DECIMAL;
    v_house_fee      DECIMAL;
    v_payout_pool    DECIMAL;
    v_bet            RECORD;
    v_payout         DECIMAL;
    v_winners        INTEGER := 0;
    v_total_paid     DECIMAL := 0;
BEGIN
    SELECT * INTO v_market FROM public.prediction_markets
    WHERE id = p_market_id FOR UPDATE;

    IF v_market IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Mercado no encontrado');
    END IF;

    IF v_market.status = 'RESOLVED' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Ya fue resuelto');
    END IF;

    -- Pool de la opción ganadora
    SELECT (opt->>'pool')::DECIMAL INTO v_winning_pool
    FROM jsonb_array_elements(v_market.options) AS opt
    WHERE opt->>'id' = p_winning_option;

    IF v_winning_pool IS NULL OR v_winning_pool = 0 THEN
        -- Nadie apostó por el ganador → reembolsar todo
        FOR v_bet IN
            SELECT * FROM public.prediction_bets
            WHERE market_id = p_market_id AND status = 'ACTIVE'
        LOOP
            UPDATE public.profiles
            SET wallet_balance = wallet_balance + v_bet.amount
            WHERE id = v_bet.user_id;

            UPDATE public.prediction_bets
            SET status = 'REFUNDED', payout = v_bet.amount
            WHERE id = v_bet.id;

            INSERT INTO public.transactions (user_id, amount, type, status, description, reference_id, created_at)
            VALUES (v_bet.user_id, v_bet.amount, 'PREDICTION_REFUND', 'COMPLETED',
                    'Reembolso: nadie apostó por el resultado ganador', p_market_id, NOW());
        END LOOP;

        UPDATE public.prediction_markets
        SET status = 'RESOLVED', winning_option = p_winning_option,
            resolved_at = NOW(), resolved_by = auth.uid()
        WHERE id = p_market_id;

        RETURN jsonb_build_object('success', true, 'message', 'Reembolso total procesado');
    END IF;

    v_total_pool := v_market.total_pool;
    v_house_fee  := v_total_pool * (v_market.house_fee_pct / 100);
    v_payout_pool := v_total_pool - v_house_fee;

    -- Pagar a cada ganador proporcional a sus shares
    FOR v_bet IN
        SELECT * FROM public.prediction_bets
        WHERE market_id = p_market_id AND status = 'ACTIVE'
    LOOP
        IF v_bet.option_id = p_winning_option THEN
            -- Payout proporcional: (shares_usuario / total_shares_ganadores) * payout_pool
            v_payout := (v_bet.shares / (
                SELECT SUM(shares) FROM public.prediction_bets
                WHERE market_id = p_market_id AND option_id = p_winning_option AND status = 'ACTIVE'
            )) * v_payout_pool;

            UPDATE public.profiles
            SET wallet_balance = wallet_balance + v_payout
            WHERE id = v_bet.user_id;

            UPDATE public.prediction_bets
            SET status = 'WON', payout = v_payout
            WHERE id = v_bet.id;

            INSERT INTO public.transactions (user_id, amount, type, status, description, reference_id, created_at)
            VALUES (v_bet.user_id, v_payout, 'PREDICTION_WIN', 'COMPLETED',
                    'Ganancia mercado: ' || v_market.title || ' ($' || v_bet.amount || ' apostado)',
                    p_market_id, NOW());

            v_winners := v_winners + 1;
            v_total_paid := v_total_paid + v_payout;
        ELSE
            UPDATE public.prediction_bets SET status = 'LOST' WHERE id = v_bet.id;
        END IF;
    END LOOP;

    -- Marcar mercado como resuelto
    UPDATE public.prediction_markets
    SET status         = 'RESOLVED',
        winning_option = p_winning_option,
        resolved_at    = NOW(),
        resolved_by    = auth.uid()
    WHERE id = p_market_id;

    RETURN jsonb_build_object(
        'success', true,
        'winners', v_winners,
        'total_paid', v_total_paid,
        'house_fee', v_house_fee
    );
END;
$$;
