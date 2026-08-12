-- =========================================================================
-- RLS — TABLAS CRÍTICAS DEL SISTEMA
-- Ejecutar en Supabase → SQL Editor
--
-- PROBLEMA: profiles, transactions, investments, withdrawals, deposits y
-- credit_logs no tenían Row Level Security. Cualquier usuario autenticado
-- podía leer el balance, historial e inversiones de cualquier otro usuario.
-- =========================================================================

-- ── HELPER: función para verificar rol de admin ───────────────────────────
-- Usada en todas las políticas para evitar repetición.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'sub-admin')
  );
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. PROFILES
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Cada usuario ve solo su propio perfil; admins ven todos
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (
    auth.uid() = id OR public.is_admin()
  );

-- Solo el propio usuario puede actualizar su perfil (campos no financieros)
-- Los balances SOLO se modifican via RPCs SECURITY DEFINER, nunca directo
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (
    auth.uid() = id OR public.is_admin()
  );

-- Solo admins pueden insertar/eliminar perfiles
DROP POLICY IF EXISTS "profiles_insert_admin" ON public.profiles;
CREATE POLICY "profiles_insert_admin" ON public.profiles
  FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;
CREATE POLICY "profiles_delete_admin" ON public.profiles
  FOR DELETE USING (public.is_admin());

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. TRANSACTIONS
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Cada usuario ve solo sus transacciones; admins ven todas
DROP POLICY IF EXISTS "transactions_select" ON public.transactions;
CREATE POLICY "transactions_select" ON public.transactions
  FOR SELECT USING (
    auth.uid() = user_id OR public.is_admin()
  );

-- Solo RPCs SECURITY DEFINER insertan transacciones (no el cliente directo)
DROP POLICY IF EXISTS "transactions_insert_admin" ON public.transactions;
CREATE POLICY "transactions_insert_admin" ON public.transactions
  FOR INSERT WITH CHECK (public.is_admin());

-- Solo admins pueden actualizar/eliminar transacciones
DROP POLICY IF EXISTS "transactions_update_admin" ON public.transactions;
CREATE POLICY "transactions_update_admin" ON public.transactions
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "transactions_delete_admin" ON public.transactions;
CREATE POLICY "transactions_delete_admin" ON public.transactions
  FOR DELETE USING (public.is_admin());

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. INVESTMENTS
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "investments_select" ON public.investments;
CREATE POLICY "investments_select" ON public.investments
  FOR SELECT USING (
    auth.uid() = user_id OR public.is_admin()
  );

DROP POLICY IF EXISTS "investments_insert_admin" ON public.investments;
CREATE POLICY "investments_insert_admin" ON public.investments
  FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "investments_update_admin" ON public.investments;
CREATE POLICY "investments_update_admin" ON public.investments
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "investments_delete_admin" ON public.investments;
CREATE POLICY "investments_delete_admin" ON public.investments
  FOR DELETE USING (public.is_admin());

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. WITHDRAWALS
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "withdrawals_select" ON public.withdrawals;
CREATE POLICY "withdrawals_select" ON public.withdrawals
  FOR SELECT USING (
    auth.uid() = user_id OR public.is_admin()
  );

-- Usuarios crean sus propios retiros via RPC; admins pueden insertar también
DROP POLICY IF EXISTS "withdrawals_insert_own" ON public.withdrawals;
CREATE POLICY "withdrawals_insert_own" ON public.withdrawals
  FOR INSERT WITH CHECK (
    auth.uid() = user_id OR public.is_admin()
  );

-- Solo admins modifican retiros (aprobación, rechazo, completado)
DROP POLICY IF EXISTS "withdrawals_update_admin" ON public.withdrawals;
CREATE POLICY "withdrawals_update_admin" ON public.withdrawals
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "withdrawals_delete_admin" ON public.withdrawals;
CREATE POLICY "withdrawals_delete_admin" ON public.withdrawals
  FOR DELETE USING (public.is_admin());

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. DEPOSITS
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deposits_select" ON public.deposits;
CREATE POLICY "deposits_select" ON public.deposits
  FOR SELECT USING (
    auth.uid() = user_id OR public.is_admin()
  );

DROP POLICY IF EXISTS "deposits_insert_own" ON public.deposits;
CREATE POLICY "deposits_insert_own" ON public.deposits
  FOR INSERT WITH CHECK (
    auth.uid() = user_id OR public.is_admin()
  );

-- Solo admins aprueban/rechazan depósitos
DROP POLICY IF EXISTS "deposits_update_admin" ON public.deposits;
CREATE POLICY "deposits_update_admin" ON public.deposits
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "deposits_delete_admin" ON public.deposits;
CREATE POLICY "deposits_delete_admin" ON public.deposits
  FOR DELETE USING (public.is_admin());

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. CREDIT_LOGS
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.credit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "credit_logs_select" ON public.credit_logs;
CREATE POLICY "credit_logs_select" ON public.credit_logs
  FOR SELECT USING (
    auth.uid() = user_id OR public.is_admin()
  );

-- Solo RPCs SECURITY DEFINER y admins escriben logs
DROP POLICY IF EXISTS "credit_logs_insert_admin" ON public.credit_logs;
CREATE POLICY "credit_logs_insert_admin" ON public.credit_logs
  FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "credit_logs_update_admin" ON public.credit_logs;
CREATE POLICY "credit_logs_update_admin" ON public.credit_logs
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "credit_logs_delete_admin" ON public.credit_logs;
CREATE POLICY "credit_logs_delete_admin" ON public.credit_logs
  FOR DELETE USING (public.is_admin());
