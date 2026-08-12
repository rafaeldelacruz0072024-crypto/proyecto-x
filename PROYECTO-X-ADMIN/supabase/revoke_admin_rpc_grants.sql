-- =========================================================================
-- REVOCAR GRANTS DE RPCs ADMIN A authenticated
-- Ejecutar en Supabase → SQL Editor
--
-- PROBLEMA: Funciones administrativas críticas estaban accesibles para
-- cualquier usuario autenticado. Cualquiera podría intentar impersonar
-- usuarios, resetear contraseñas, aprobar/rechazar retiros o borrar
-- volúmenes de toda la red.
--
-- La validación interna de rol (role = 'admin') es la única barrera —
-- y esa es insuficiente si hay algún bug en la lógica de roles.
-- La defensa correcta es eliminar el acceso en la capa de base de datos.
-- =========================================================================

-- ── admin_impersonate ────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.admin_impersonate_user(UUID, TEXT)    FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_restore_user_password(UUID, TEXT) FROM authenticated;

-- ── admin_reset_password ─────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.admin_reset_user_password(UUID, TEXT) FROM authenticated;

-- ── admin_update_email ───────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.admin_update_user_email(UUID, TEXT)   FROM authenticated;

-- ── reset_all_weekly_volumes ─────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.reset_all_weekly_volumes()            FROM authenticated;

-- ── Aprobación / rechazo / completado de retiros ─────────────────────────
-- NOTA: process_withdrawal_approval, reject_withdrawal y complete_withdrawal
-- solo deben ejecutarse desde el admin panel via service_role key,
-- nunca desde el cliente del usuario.
REVOKE EXECUTE ON FUNCTION public.process_withdrawal_approval(UUID, UUID)  FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.reject_withdrawal(UUID, TEXT, UUID)       FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_withdrawal(UUID, TEXT, UUID)     FROM authenticated;

-- ── Confirmar que service_role sigue teniendo acceso ─────────────────────
GRANT EXECUTE ON FUNCTION public.admin_impersonate_user(UUID, TEXT)       TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_restore_user_password(UUID, TEXT)  TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_password(UUID, TEXT)    TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_user_email(UUID, TEXT)      TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_all_weekly_volumes()               TO service_role;
GRANT EXECUTE ON FUNCTION public.process_withdrawal_approval(UUID, UUID)  TO service_role;
GRANT EXECUTE ON FUNCTION public.reject_withdrawal(UUID, TEXT, UUID)      TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_withdrawal(UUID, TEXT, UUID)    TO service_role;

-- ── get_user_balance sigue siendo accesible para usuarios autenticados ───
-- (solo retorna el balance del usuario solicitado, no es destructivo)
GRANT EXECUTE ON FUNCTION public.get_user_balance(UUID) TO authenticated;
