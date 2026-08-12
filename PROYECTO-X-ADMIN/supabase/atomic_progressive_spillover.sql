-- ============================================================
-- SQL RPC: Cierre Atómico y Distribución Progresiva
-- ============================================================
-- Función diseñada para ser llamada desde el cliente (TypeScript).
-- Usa SELECT ... FOR UPDATE para garantizar que si dos llamadas
-- llegan en el mismo milisegundo, PostgreSQL las formateará en 
-- fila de espera india, previniendo sobrepasar el 200%.
-- ============================================================

CREATE OR REPLACE FUNCTION public.atomic_progressive_spillover(
    p_user_id UUID,
    p_amount DECIMAL
)
RETURNS DECIMAL AS $$
DECLARE
    v_remaining_amount DECIMAL := p_amount;
    v_absorbed_total DECIMAL := 0;
    v_inv RECORD;
    v_cap_limit DECIMAL;
    v_remaining_cap DECIMAL;
    v_actual_absorption DECIMAL;
BEGIN
    -- Bloquear los nodos activos usando FOR UPDATE para evitar race conditions
    FOR v_inv IN (
        SELECT id, amount, accumulated_earnings 
        FROM public.investments
        WHERE user_id = p_user_id AND status = 'ACTIVE'
        ORDER BY created_at ASC
        FOR UPDATE
    ) LOOP
        v_cap_limit := v_inv.amount * 2;
        v_remaining_cap := GREATEST(0, v_cap_limit - COALESCE(v_inv.accumulated_earnings, 0));
        
        IF v_remaining_cap > 0 THEN
            v_actual_absorption := LEAST(v_remaining_amount, v_remaining_cap);
            
            -- Aplicamos la actualización
            IF v_actual_absorption >= v_remaining_cap THEN
                -- El nodo se llenó al 200%
                UPDATE public.investments
                SET accumulated_earnings = v_cap_limit,
                    status = 'COMPLETED',
                    completed_at = NOW()
                WHERE id = v_inv.id;
            ELSE
                -- El nodo aún tiene espacio
                UPDATE public.investments
                SET accumulated_earnings = COALESCE(accumulated_earnings, 0) + v_actual_absorption
                WHERE id = v_inv.id;
            END IF;
            
            v_remaining_amount := v_remaining_amount - v_actual_absorption;
            v_absorbed_total := v_absorbed_total + v_actual_absorption;
        END IF;
        
        -- Si nos quedamos sin dinero para distribuir, salimos del bucle
        EXIT WHEN v_remaining_amount <= 0;
    END LOOP;

    -- Devolvemos la cantidad real de dinero que logró penetrar en la red
    -- (si todos los nodos estaban llenos, esto podría retornar menos de p_amount)
    RETURN v_absorbed_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
