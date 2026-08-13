CREATE OR REPLACE FUNCTION public.process_product_purchase(
    p_user_id UUID,
    p_product_id UUID,
    p_amount NUMERIC,
    p_method TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wallet_balance NUMERIC;
    v_active_investment NUMERIC;
    v_is_flagship BOOLEAN;
    v_purchase_id UUID;
BEGIN
    -- 0. Verificar si el producto es NOVA DIGITAL GOLD (flagship)
    SELECT is_flagship INTO v_is_flagship
    FROM public.products
    WHERE id = p_product_id;

    -- REGLA DE ORO: Si es flagship, validar inversión mínima de $500
    IF v_is_flagship = TRUE THEN
        SELECT COALESCE(SUM(amount), 0) INTO v_active_investment
        FROM public.investments
        WHERE user_id = p_user_id AND status = 'ACTIVE';

        IF v_active_investment < 500 THEN
            RETURN jsonb_build_object(
                'success', false,
                'message', 'REGLA DE ORO: Se requiere un capital activo de al menos $500 para adquirir este activo Elite.'
            );
        END IF;
    END IF;

    -- 1. Validar fondos
    SELECT wallet_balance INTO v_wallet_balance
    FROM public.profiles
    WHERE id = p_user_id;

    IF v_wallet_balance < p_amount THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Saldo insuficiente en su Wallet Bank para completar la adquisición.'
        );
    END IF;

    -- 2. Descontar saldo
    UPDATE public.profiles
    SET wallet_balance = wallet_balance - p_amount
    WHERE id = p_user_id;

    -- 3. Insertar registro de compra
    INSERT INTO public.product_purchases (user_id, product_id, amount, payment_method, status)
    VALUES (p_user_id, p_product_id, p_amount, p_method, 'COMPLETED')
    RETURNING id INTO v_purchase_id;

    -- 4. Insertar en el historial de transacciones global
    INSERT INTO public.transactions (user_id, amount, type, status, description, reference_id)
    VALUES (
        p_user_id, 
        p_amount, 
        'PRODUCT_PURCHASE', 
        'COMPLETED', 
        (SELECT 'Compra de: ' || name FROM public.products WHERE id = p_product_id),
        v_purchase_id::TEXT
    );

    RETURN jsonb_build_object(
        'success', true,
        'purchase_id', v_purchase_id
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'message', SQLERRM
    );
END;
$$;
