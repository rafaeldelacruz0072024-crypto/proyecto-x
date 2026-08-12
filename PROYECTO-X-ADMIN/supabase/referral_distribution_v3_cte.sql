-- ============================================================
-- TRIGGER v3: Comisiones con CTE Recursiva (1 query vs 30)
-- Más eficiente, más confiable, mismo resultado
-- Ejecutar en Supabase SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION public.distribute_residual_commissions()
RETURNS TRIGGER AS $$
DECLARE
    v_config      JSONB;
    v_already_paid BOOLEAN;
    v_investor_name TEXT;
BEGIN
    -- 1. Salir si no es inversión activa
    IF NEW.status != 'ACTIVE' THEN
        RETURN NEW;
    END IF;

    -- 2. Re-leer con bloqueo de fila para prevenir doble pago
    SELECT is_referral_commission_paid INTO v_already_paid
    FROM public.investments
    WHERE id = NEW.id
    FOR UPDATE;

    IF v_already_paid = TRUE THEN
        RETURN NEW;
    END IF;

    -- 3. Marcar como procesado INMEDIATAMENTE (antes de pagar)
    UPDATE public.investments
    SET is_referral_commission_paid = TRUE
    WHERE id = NEW.id;

    -- 4. Obtener configuración de comisiones
    SELECT residual_config INTO v_config FROM system_settings LIMIT 1;
    IF v_config IS NULL OR jsonb_array_length(v_config) = 0 THEN
        RETURN NEW;
    END IF;

    -- 5. Nombre del inversor
    SELECT COALESCE(full_name, username, email) INTO v_investor_name
    FROM profiles WHERE id = NEW.user_id;

    -- 6. UNA SOLA QUERY: obtiene toda la cadena de upline (hasta 30 niveles)
    --    y calcula el porcentaje correspondiente a cada nivel
    INSERT INTO public.transactions (user_id, amount, type, status, description, reference_id, created_at)
    SELECT
        chain.upline_id,
        NEW.amount * (
            SELECT
                CASE
                    WHEN elem->>'id' IS NOT NULL
                         AND NULLIF(elem->>'id', '') IS NOT NULL
                         AND (elem->>'id')::INTEGER = chain.level
                    THEN (elem->>'percent')::DECIMAL / 100
                    WHEN elem->>'range' IS NOT NULL
                         AND NULLIF(regexp_replace(split_part(elem->>'range', '-', 1), '[^0-9]', '', 'g'), '') IS NOT NULL
                         AND NULLIF(regexp_replace(split_part(elem->>'range', '-', 2), '[^0-9]', '', 'g'), '') IS NOT NULL
                         AND chain.level >= NULLIF(regexp_replace(split_part(elem->>'range', '-', 1), '[^0-9]', '', 'g'), '')::INTEGER
                         AND chain.level <= NULLIF(regexp_replace(split_part(elem->>'range', '-', 2), '[^0-9]', '', 'g'), '')::INTEGER
                    THEN (elem->>'percent')::DECIMAL / 100
                    ELSE 0
                END
            FROM jsonb_array_elements(v_config) AS elem
            WHERE (
                (elem->>'id' IS NOT NULL AND NULLIF(elem->>'id','') IS NOT NULL AND (elem->>'id')::INTEGER = chain.level)
                OR (
                    elem->>'range' IS NOT NULL
                    AND NULLIF(regexp_replace(split_part(elem->>'range', '-', 1), '[^0-9]', '', 'g'), '') IS NOT NULL
                    AND NULLIF(regexp_replace(split_part(elem->>'range', '-', 2), '[^0-9]', '', 'g'), '') IS NOT NULL
                    AND chain.level >= NULLIF(regexp_replace(split_part(elem->>'range', '-', 1), '[^0-9]', '', 'g'), '')::INTEGER
                    AND chain.level <= NULLIF(regexp_replace(split_part(elem->>'range', '-', 2), '[^0-9]', '', 'g'), '')::INTEGER
                )
            )
            LIMIT 1
        ),
        'REFERRAL_COMMISSION',
        'COMPLETED',
        'Nivel ' || chain.level || ': Comisión por inversión de ' || COALESCE(v_investor_name, 'Usuario') || ' ($' || NEW.amount || ')',
        NEW.id,
        NOW()
    FROM (
        -- CTE recursiva: sube por la cadena de patrocinadores
        WITH RECURSIVE upline AS (
            -- Nivel 1: sponsor directo del inversor
            SELECT
                referred_by   AS upline_id,
                1             AS level
            FROM profiles
            WHERE id = NEW.user_id
              AND referred_by IS NOT NULL

            UNION ALL

            -- Niveles 2-30: sube un nivel más
            SELECT
                p.referred_by,
                u.level + 1
            FROM profiles p
            JOIN upline u ON p.id = u.upline_id
            WHERE p.referred_by IS NOT NULL
              AND u.level < 30
        )
        SELECT upline_id, level FROM upline
    ) AS chain
    WHERE chain.upline_id IS NOT NULL
      -- REGLA DE ORO: El patrocinador debe tener al menos una inversión ACTIVE
      AND EXISTS (
          SELECT 1 FROM public.investments i
          WHERE i.user_id = chain.upline_id
            AND i.status = 'ACTIVE'
      )
      AND (
        -- Solo insertar si hay porcentaje > 0 para este nivel
        SELECT COALESCE(MAX(
            CASE
                WHEN elem->>'id' IS NOT NULL
                     AND NULLIF(elem->>'id', '') IS NOT NULL
                     AND (elem->>'id')::INTEGER = chain.level
                THEN (elem->>'percent')::DECIMAL
                WHEN elem->>'range' IS NOT NULL
                     AND NULLIF(regexp_replace(split_part(elem->>'range', '-', 1), '[^0-9]', '', 'g'), '') IS NOT NULL
                     AND NULLIF(regexp_replace(split_part(elem->>'range', '-', 2), '[^0-9]', '', 'g'), '') IS NOT NULL
                     AND chain.level >= NULLIF(regexp_replace(split_part(elem->>'range', '-', 1), '[^0-9]', '', 'g'), '')::INTEGER
                     AND chain.level <= NULLIF(regexp_replace(split_part(elem->>'range', '-', 2), '[^0-9]', '', 'g'), '')::INTEGER
                THEN (elem->>'percent')::DECIMAL
                ELSE 0
            END
        ), 0) FROM jsonb_array_elements(v_config) AS elem
      ) > 0;

    -- 7. Actualizar wallet_balance de todos los uplines de una vez
    UPDATE public.profiles p
    SET wallet_balance = COALESCE(wallet_balance, 0) + t.amount
    FROM public.transactions t
    WHERE t.reference_id = NEW.id
      AND t.type = 'REFERRAL_COMMISSION'
      AND t.status = 'COMPLETED'
      AND p.id = t.user_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-crear triggers (sin cambios en triggers, solo en la función)
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
