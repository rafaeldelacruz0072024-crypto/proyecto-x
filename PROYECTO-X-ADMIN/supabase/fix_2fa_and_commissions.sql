ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS two_factor_secret TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS withdrawal_wallet TEXT;

CREATE OR REPLACE FUNCTION public.distribute_residual_commissions()
RETURNS TRIGGER AS $$
DECLARE
    v_investor_id UUID;
    v_amount DECIMAL;
    v_current_referrer UUID;
    v_config JSONB;
    v_level_pct DECIMAL;
    v_commission DECIMAL;
    v_level INTEGER;
    v_investor_name TEXT;
BEGIN
    IF NEW.status != 'ACTIVE' OR NEW.is_referral_commission_paid = TRUE THEN
        RETURN NEW;
    END IF;

    v_investor_id := NEW.user_id;
    v_amount := NEW.amount;

    SELECT COALESCE(full_name, username, email) INTO v_investor_name 
    FROM profiles WHERE id = v_investor_id;

    SELECT residual_config INTO v_config FROM system_settings LIMIT 1;

    IF v_config IS NULL OR jsonb_array_length(v_config) = 0 THEN
        RETURN NEW;
    END IF;

    SELECT referred_by INTO v_current_referrer FROM profiles WHERE id = v_investor_id;

    FOR v_level IN 1..30 LOOP
        EXIT WHEN v_current_referrer IS NULL;

        SELECT (elem->>'percent')::DECIMAL INTO v_level_pct
        FROM jsonb_array_elements(v_config) AS elem
        WHERE (elem->>'id')::INTEGER = v_level;

        IF v_level_pct IS NOT NULL AND v_level_pct > 0 THEN
            v_commission := v_amount * (v_level_pct / 100);

            INSERT INTO public.transactions (
                user_id, amount, type, status, description, reference_id, created_at
            ) VALUES (
                v_current_referrer, v_commission, 'REFERRAL_COMMISSION', 'COMPLETED', 
                'Nivel ' || v_level || ': Comisión por inversión de ' || v_investor_name || ' ($' || v_amount || ')',
                NEW.id, NOW()
            );

            UPDATE public.profiles 
            SET wallet_balance = COALESCE(wallet_balance, 0) + v_commission
            WHERE id = v_current_referrer;
        END IF;

        SELECT referred_by INTO v_current_referrer FROM profiles WHERE id = v_current_referrer;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
