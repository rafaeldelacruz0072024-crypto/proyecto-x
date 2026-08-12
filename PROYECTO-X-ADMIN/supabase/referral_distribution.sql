-- Asegurar que la columna existe en la tabla de inversiones
ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS is_referral_commission_paid BOOLEAN DEFAULT FALSE;

-- Función para distribuir comisiones en 30 niveles basada en la Regla de Oro
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
    -- 1. Si no es una inversión activa o ya se pagó la comisión, salir
    IF NEW.status != 'ACTIVE' OR NEW.is_referral_commission_paid = TRUE THEN
        RETURN NEW;
    END IF;

    v_investor_id := NEW.user_id;
    v_amount := NEW.amount;

    -- Obtener nombre del inversor para la descripción
    SELECT COALESCE(full_name, username, email) INTO v_investor_name 
    FROM profiles 
    WHERE id = v_investor_id;

    -- 2. Obtener configuración dinámica (Regla de Oro)
    SELECT residual_config INTO v_config FROM system_settings LIMIT 1;

    -- Si no hay configuración, no hay nada que distribuir
    IF v_config IS NULL OR jsonb_array_length(v_config) = 0 THEN
        RETURN NEW;
    END IF;

    -- 3. Identificar primer patrocinador
    SELECT referred_by INTO v_current_referrer FROM profiles WHERE id = v_investor_id;

    -- 4. Bucle de 30 niveles (Máximo permitido por arquitectura)
    FOR v_level IN 1..30 LOOP
        EXIT WHEN v_current_referrer IS NULL;

        -- Obtener porcentaje del nivel actual desde el JSON
        -- El JSON debe ser una lista de objetos: [{"id": 1, "percent": 10}, ...]
        SELECT (elem->>'percent')::DECIMAL INTO v_level_pct
        FROM jsonb_array_elements(v_config) AS elem
        WHERE (elem->>'id')::INTEGER = v_level;

        -- Si el porcentaje es mayor a 0, dispersar comisión
        IF v_level_pct IS NOT NULL AND v_level_pct > 0 THEN
            v_commission := v_amount * (v_level_pct / 100);

            -- A. Registrar en Transactions (Libro Mayor)
            INSERT INTO public.transactions (
                user_id, 
                amount, 
                type, 
                status, 
                description, 
                reference_id, 
                created_at
            )
            VALUES (
                v_current_referrer, 
                v_commission, 
                'REFERRAL_COMMISSION', 
                'COMPLETED', 
                'Nivel ' || v_level || ': Comisión por inversión de ' || v_investor_name || ' ($' || v_amount || ')',
                NEW.id,
                NOW()
            );

            -- B. Actualizar Balance Directamente (Wallet de Ganancias)
            UPDATE public.profiles 
            SET wallet_balance = COALESCE(wallet_balance, 0) + v_commission
            WHERE id = v_current_referrer;
        END IF;

        -- Subir un nivel en el árbol genealógico
        SELECT referred_by INTO v_current_referrer FROM profiles WHERE id = v_current_referrer;
    END LOOP;

    -- 5. Marcar la inversión como procesada para evitar duplicidad
    UPDATE public.investments 
    SET is_referral_commission_paid = TRUE 
    WHERE id = NEW.id;

    RETURN NULL; -- Return value is ignored for AFTER triggers
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para automatizar la ejecución
-- Se dispara cuando una inversión pasa a estado ACTIVE
DROP TRIGGER IF EXISTS tr_distribute_referral_commissions ON public.investments;
CREATE TRIGGER tr_distribute_referral_commissions
    AFTER UPDATE OF status ON public.investments
    FOR EACH ROW
    WHEN (NEW.status = 'ACTIVE' AND OLD.status != 'ACTIVE')
    EXECUTE FUNCTION distribute_residual_commissions();

-- También para inserciones directas en estado ACTIVE
DROP TRIGGER IF EXISTS tr_distribute_referral_commissions_insert ON public.investments;
CREATE TRIGGER tr_distribute_referral_commissions_insert
    AFTER INSERT ON public.investments
    FOR EACH ROW
    WHEN (NEW.status = 'ACTIVE')
    EXECUTE FUNCTION distribute_residual_commissions();
