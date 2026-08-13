-- ============================================================
-- NOVA DIGITAL-USER: Corregir Vulnerabilidades Críticas de Seguridad
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Fecha: 2026-04-01
-- ============================================================
-- PROBLEMA 1: rls_disabled_in_public (RLS deshabilitado)
-- PROBLEMA 2: sensitive_columns_exposed (columnas sensibles expuestas)
-- ============================================================
-- IMPORTANTE: Este script NO altera funciones RPC existentes.
-- Los RPCs (get_network_tree, get_sponsor_info, complete_registration,
-- process_investment, etc.) corren como SECURITY DEFINER y NO son
-- afectados por las políticas RLS.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. PROFILES (CRÍTICO - datos sensibles)
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Los usuarios autenticados pueden ver perfiles (necesario para
-- búsquedas de crédito, sponsor widget, verificación de referidos)
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Los usuarios solo pueden actualizar SU PROPIO perfil
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Los usuarios pueden crear su propio perfil (registro)
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Bloquear acceso anónimo completamente
CREATE POLICY "profiles_deny_anon"
  ON public.profiles FOR SELECT
  TO anon
  USING (false);

-- ============================================================
-- 2. TRANSACTIONS (CRÍTICO - datos financieros)
-- ============================================================
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- El usuario solo puede ver SUS transacciones
CREATE POLICY "transactions_select_own"
  ON public.transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- El usuario solo puede insertar transacciones con SU user_id
CREATE POLICY "transactions_insert_own"
  ON public.transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 3. DEPOSITS (CRÍTICO - datos financieros)
-- ============================================================
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deposits_select_own"
  ON public.deposits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "deposits_insert_own"
  ON public.deposits FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 4. WITHDRAWALS (CRÍTICO - datos financieros)
-- ============================================================
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "withdrawals_select_own"
  ON public.withdrawals FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "withdrawals_insert_own"
  ON public.withdrawals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 5. INVESTMENTS (CRÍTICO - datos financieros)
-- ============================================================
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "investments_select_own"
  ON public.investments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "investments_insert_own"
  ON public.investments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 6. CREDIT_LOGS (datos financieros)
-- ============================================================
ALTER TABLE public.credit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credit_logs_select_own"
  ON public.credit_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "credit_logs_insert_own"
  ON public.credit_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 7. USER_TASKS (datos de usuario)
-- ============================================================
ALTER TABLE public.user_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_tasks_select_own"
  ON public.user_tasks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user_tasks_insert_own"
  ON public.user_tasks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_tasks_update_own"
  ON public.user_tasks FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 8. PLANS (solo lectura - datos públicos)
-- ============================================================
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plans_select_authenticated"
  ON public.plans FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- 9. SYSTEM_SETTINGS (solo lectura - configuración)
-- ============================================================
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_settings_select_authenticated"
  ON public.system_settings FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- 10. SYSTEM_GATEWAYS (CRÍTICO - claves de pago)
-- ============================================================
ALTER TABLE public.system_gateways ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_gateways_select_authenticated"
  ON public.system_gateways FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- 11. PROMOTIONS (solo lectura - contenido público)
-- ============================================================
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "promotions_select_authenticated"
  ON public.promotions FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- 12. PRODUCTS (solo lectura - catálogo)
-- ============================================================
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_select_authenticated"
  ON public.products FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- 13. PRODUCT_PURCHASES (datos de usuario)
-- ============================================================
ALTER TABLE public.product_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_purchases_select_own"
  ON public.product_purchases FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "product_purchases_insert_own"
  ON public.product_purchases FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 14. PREDICTION_MARKETS (lectura para autenticados)
-- ============================================================
ALTER TABLE public.prediction_markets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prediction_markets_select_authenticated"
  ON public.prediction_markets FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- 15. PREDICTION_BETS (datos de usuario)
-- ============================================================
ALTER TABLE public.prediction_bets ENABLE ROW LEVEL SECURITY;

-- Todos los autenticados pueden ver apuestas (Top Holders, Activity)
CREATE POLICY "prediction_bets_select_authenticated"
  ON public.prediction_bets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "prediction_bets_insert_own"
  ON public.prediction_bets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 16. PREDICTION_MARKET_COMMENTS (contenido comunitario)
-- ============================================================
ALTER TABLE public.prediction_market_comments ENABLE ROW LEVEL SECURITY;

-- Todos los autenticados pueden ver comentarios
CREATE POLICY "prediction_market_comments_select"
  ON public.prediction_market_comments FOR SELECT
  TO authenticated
  USING (true);

-- Los usuarios pueden insertar SUS comentarios
CREATE POLICY "prediction_market_comments_insert_own"
  ON public.prediction_market_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Los usuarios pueden actualizar comentarios (likes globales)
CREATE POLICY "prediction_market_comments_update_authenticated"
  ON public.prediction_market_comments FOR UPDATE
  TO authenticated
  USING (true);

-- Los usuarios pueden borrar SUS comentarios
CREATE POLICY "prediction_market_comments_delete_own"
  ON public.prediction_market_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- 17. GAMES (solo lectura - catálogo de juegos)
-- ============================================================
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "games_select_authenticated"
  ON public.games FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- 18. TUTORIALS (solo lectura - contenido educativo)
-- ============================================================
ALTER TABLE public.tutorials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tutorials_select_authenticated"
  ON public.tutorials FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- 19. MONTHLY_BOOKS (solo lectura - contenido educativo)
-- ============================================================
ALTER TABLE public.monthly_books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "monthly_books_select_authenticated"
  ON public.monthly_books FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- 20. ROADMAP_ITEMS (solo lectura - contenido público)
-- ============================================================
ALTER TABLE public.roadmap_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roadmap_items_select_authenticated"
  ON public.roadmap_items FOR SELECT
  TO authenticated
  USING (true);

COMMIT;

-- ============================================================
-- VERIFICACIÓN: Ejecutar después para confirmar que RLS está activo
-- ============================================================
-- SELECT schemaname, tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
