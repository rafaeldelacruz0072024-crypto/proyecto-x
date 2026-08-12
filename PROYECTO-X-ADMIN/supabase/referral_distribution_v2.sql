-- Asegurar que la columna existe en la tabla de inversiones
ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS is_referral_commission_paid BOOLEAN DEFAULT FALSE;

-- ============================================================
-- FUNCIÓN DEFINITIVA: Distribuir comisiones en 30 niveles
-- Regla de Oro: 10%, 5%, 3%, 2%, 1%, 0.8%
-- Soporta residual_config con formato: {"range":"Nivel X - Y","percent":Z}
-- ============================================================
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
    v_range_start INTEGER;
    v_range_end INTEGER;
    v_range_raw TEXT;
    v_start_str TEXT;
    v_end_str TEXT;
BEGIN
    -- 1. Salir si no es inversión activa o ya fue procesada
    IF NEW.status != 'ACTIVE' OR NEW.is_referral_commission_paid = TRUE THEN
        RETURN NEW;
    END IF;

    v_investor_id := NEW.user_id;
    v_amount := NEW.amount;

    -- Nombre del inversor para descripción
    SELECT COALESCE(full_name, username, email) INTO v_investor_name
    FROM profiles WHERE id = v_investor_id;

    -- 2. Obtener configuración desde system_settings
    SELECT residual_config INTO v_config FROM system_settings LIMIT 1;

    IF v_config IS NULL OR jsonb_array_length(v_config) = 0 THEN
        RETURN NEW;
    END IF;

    -- 3. Primer patrocinador
    SELECT referred_by INTO v_current_referrer FROM profiles WHERE id = v_investor_id;

    -- 4. Recorrer 30 niveles
    FOR v_level IN 1..30 LOOP
        EXIT WHEN v_current_referrer IS NULL;

        v_level_pct := NULL;

        -- Buscar porcentaje en la configuración
        -- Soporte dual: formato {"range":"Nivel X - Y","percent":Z} o {"id":N,"percent":Z}
        SELECT
            CASE
                -- Formato con campo "id" (legacy)
                WHEN elem->>'id' IS NOT NULL
                     AND NULLIF(elem->>'id', '') IS NOT NULL
                     AND (elem->>'id')::INTEGER = v_level
                THEN (elem->>'percent')::DECIMAL

                -- Formato con campo "range" (Regla de Oro)
                WHEN elem->>'range' IS NOT NULL THEN (
                    SELECT (elem->>'percent')::DECIMAL
                    WHERE
                        NULLIF(regexp_replace(split_part(elem->>'range', '-', 1), '[^0-9]', '', 'g'), '') IS NOT NULL
                    AND NULLIF(regexp_replace(split_part(elem->>'range', '-', 2), '[^0-9]', '', 'g'), '') IS NOT NULL
                    AND v_level >= NULLIF(regexp_replace(split_part(elem->>'range', '-', 1), '[^0-9]', '', 'g'), '')::INTEGER
                    AND v_level <= NULLIF(regexp_replace(split_part(elem->>'range', '-', 2), '[^0-9]', '', 'g'), '')::INTEGER
                )
                ELSE NULL
            END
        INTO v_level_pct
        FROM jsonb_array_elements(v_config) AS elem
        WHERE (
            -- Coincidencia por id
            (elem->>'id' IS NOT NULL AND NULLIF(elem->>'id','') IS NOT NULL AND (elem->>'id')::INTEGER = v_level)
            OR
            -- Coincidencia por range
            (
                elem->>'range' IS NOT NULL
                AND NULLIF(regexp_replace(split_part(elem->>'range', '-', 1), '[^0-9]', '', 'g'), '') IS NOT NULL
                AND NULLIF(regexp_replace(split_part(elem->>'range', '-', 2), '[^0-9]', '', 'g'), '') IS NOT NULL
                AND v_level >= NULLIF(regexp_replace(split_part(elem->>'range', '-', 1), '[^0-9]', '', 'g'), '')::INTEGER
                AND v_level <= NULLIF(regexp_replace(split_part(elem->>'range', '-', 2), '[^0-9]', '', 'g'), '')::INTEGER
            )
        )
        LIMIT 1;

        -- Pagar comisión si corresponde
        IF v_level_pct IS NOT NULL AND v_level_pct > 0 THEN
            v_commission := v_amount * (v_level_pct / 100);

            INSERT INTO public.transactions (
                user_id, amount, type, status, description, reference_id, created_at
            ) VALUES (
                v_current_referrer,
                v_commission,
                'REFERRAL_COMMISSION',
                'COMPLETED',
                'Nivel ' || v_level || ': Comisión por inversión de ' || COALESCE(v_investor_name, 'Usuario') || ' ($' || v_amount || ')',
                NEW.id,
                NOW()
            );

            UPDATE public.profiles
            SET wallet_balance = COALESCE(wallet_balance, 0) + v_commission
            WHERE id = v_current_referrer;
        END IF;

        -- Subir al siguiente nivel
        SELECT referred_by INTO v_current_referrer FROM profiles WHERE id = v_current_referrer;
    END LOOP;

    -- 5. Marcar como procesado (previene duplicados)
    UPDATE public.investments
    SET is_referral_commission_paid = TRUE
    WHERE id = NEW.id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-crear triggers
DROP TRIGGER IF EXISTS tr_distribute_referral_commissions ON public.investments;
CREATE TRIGGER tr_distribute_referral_commissions
    AFTER UPDATE OF status ON public.investments
    FOR EACH ROW
    WHEN (NEW.status = 'ACTIVE' AND OLD.status != 'ACTIVE')
    EXECUTE FUNCTION distribute_residual_commissions();

DROP TRIGGER IF EXISTS tr_distribute_referral_commissions_insert ON public.investments;
CREATE TRIGGER tr_distribute_referral_commissions_insert
    AFTER INSERT ON public.investments
    FOR EACH ROW
    WHEN (NEW.status = 'ACTIVE')
    EXECUTE FUNCTION distribute_residual_commissions();
