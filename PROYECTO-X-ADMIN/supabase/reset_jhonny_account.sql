-- ==============================================================================
-- SCRIPT DE REINICIO DE CUENTA Y GANANCIAS (SOLO PARA jhonnynavarrete91@gmail.com)
-- ==============================================================================
-- Este script realiza las siguientes acciones:
-- 1. Resetea los saldos a 0 (Wallet Balance, Credit Balance y Team Volume).
-- 2. Elimina todas las transacciones asociadas (incluyendo ganancias, retiros y depósitos) 
--    para limpiar completamente el historial financiero y las estadísticas ("Total Returns").
-- 3. (Opcional) Puedes descomentar la línea de "investments" si deseas borrar también sus inversiones activas.

DO $$
DECLARE
    v_user_email TEXT := 'jhonnynavarrete91@gmail.com';
    v_user_id UUID;
BEGIN
    -- 1. Obtener el ID del usuario
    SELECT id INTO v_user_id FROM public.profiles WHERE email = v_user_email;

    IF v_user_id IS NOT NULL THEN
        -- 2. Resetear los balances de la billetera y métricas del perfil
        UPDATE public.profiles
        SET wallet_balance = 0,
            credit_balance = 0,
            team_volume = 0
        WHERE id = v_user_id;

        -- 3. Eliminar todo el historial de transacciones (esto pondrá en $0.00 las "Ganancias Totales")
        DELETE FROM public.transactions 
        WHERE user_id = v_user_id;

        -- 4. Eliminar el historial de retiros (opcional, para limpiar el perfil por completo)
        DELETE FROM public.withdrawals 
        WHERE user_id = v_user_id;

        -- 5. Eliminar el historial de depósitos (opcional)
        DELETE FROM public.deposits 
        WHERE user_id = v_user_id;

        -- 6. Eliminar inversiones (DESCOMENTAR LA LÍNEA DE ABAJO SI DESEAS BORRAR SUS INVERSIONES ACTUALES)
        -- DELETE FROM public.investments WHERE user_id = v_user_id;
        
        RAISE NOTICE 'ÉXITO: La cuenta de % ha sido reiniciada correctamente.', v_user_email;
    ELSE
        RAISE NOTICE 'ERROR: No se encontró ningún perfil con el correo %', v_user_email;
    END IF;
END $$;
