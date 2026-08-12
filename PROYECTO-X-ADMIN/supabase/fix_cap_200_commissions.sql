-- ============================================================
-- FIX: Regla de Oro 200% Progresiva en Distribución de Comisiones
-- ============================================================
-- Ejecutar en Supabase SQL Editor
--
-- FIX: Distribuir las comisiones progresivamente entre todos los 
-- nodos activos del referente (comenzando por el más antiguo).
-- Si un nodo llega a su 200%, el excedente fluye al siguiente nodo.
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
    
    -- Variables para CAP Progresivo
    v_commission_remaining DECIMAL;
    v_commission_absorbed_total DECIMAL;
    v_inv RECORD;
    v_ref_cap_limit DECIMAL;
    v_ref_remaining_cap DECIMAL;
    v_actual_commission DECIMAL;
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
            
            -- ============================================================
            -- REGLA DE ORO PROGRESIVA 200%: Spillover a multiples nodos
            -- ============================================================
            v_commission_remaining := v_commission;
            v_commission_absorbed_total := 0;

            -- Iterar sobre TODOS los nodos activos del referente, desde el más antiguo
            FOR v_inv IN (
                SELECT id, amount, accumulated_earnings 
                FROM public.investments
                WHERE user_id = v_current_referrer AND status = 'ACTIVE'
                ORDER BY created_at ASC
                FOR UPDATE
            ) LOOP
                v_ref_cap_limit := v_inv.amount * 2;
                
                -- Si por alguna razón accumulated_earnings es nulo, lo tratamos como 0
                -- PERO para estar extra seguros del ledger, calculamos las ganancias reales:
                -- (Opcionalmente podríamos recalcular aquí, pero confiaremos en accumulated_earnings para velocidad y ciclo controlado)
                
                v_ref_remaining_cap := GREATEST(0, v_ref_cap_limit - COALESCE(v_inv.accumulated_earnings, 0));
                
                IF v_ref_remaining_cap > 0 THEN
                    -- El nodo absorbe comisión hasta llegar a su límite
                    v_actual_commission := LEAST(v_commission_remaining, v_ref_remaining_cap);
                    
                    -- Actualizamos este nodo individual
                    IF v_actual_commission >= v_ref_remaining_cap THEN
                        -- El nodo se llenó completamente
                        UPDATE public.investments
                        SET accumulated_earnings = v_ref_cap_limit,
                            status = 'COMPLETED',
                            completed_at = NOW()
                        WHERE id = v_inv.id;
                    ELSE
                        -- El nodo aún tiene espacio
                        UPDATE public.investments
                        SET accumulated_earnings = COALESCE(accumulated_earnings, 0) + v_actual_commission
                        WHERE id = v_inv.id;
                    END IF;
                    
                    v_commission_remaining := v_commission_remaining - v_actual_commission;
                    v_commission_absorbed_total := v_commission_absorbed_total + v_actual_commission;
                END IF;
                
                -- Si la comisión se agotó, podemos salir del bucle de nodos
                EXIT WHEN v_commission_remaining <= 0;
            END LOOP;

            -- Si el referente logró absorber algo de la comisión
            IF v_commission_absorbed_total > 0 THEN
                -- Insertar transacción consolidada de ganancias
                INSERT INTO public.transactions (
                    user_id, amount, type, status, description, reference_id, created_at
                ) VALUES (
                    v_current_referrer, v_commission_absorbed_total, 'REFERRAL_COMMISSION', 'COMPLETED', 
                    'Nivel ' || v_level || ': Comisión por inversión de ' || v_investor_name || ' ($' || v_amount || ')' ||
                        CASE WHEN v_commission_absorbed_total < v_commission THEN ' (LIMITADO POR CAP 200% GLOBAL)' ELSE '' END,
                    NEW.id, NOW()
                );

                -- Depositar sumatoria final en WALLET BANK
                UPDATE public.profiles 
                SET wallet_balance = COALESCE(wallet_balance, 0) + v_commission_absorbed_total
                WHERE id = v_current_referrer;
            END IF;
            
        END IF;

        -- Subir al siguiente nivel en la red
        SELECT referred_by INTO v_current_referrer FROM profiles WHERE id = v_current_referrer;
    END LOOP;

    -- Finalmente, marcar la inversión original como pagadora de referencias
    UPDATE public.investments 
    SET is_referral_commission_paid = TRUE 
    WHERE id = NEW.id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
