-- =========================================================================
-- SOLUCIÓN DEFINITIVA: COMISIONES, RED Y AUTO-ACTIVACIÓN (100%)
-- Ejecutar en Supabase SQL Editor
-- =========================================================================

-- 1. FUNCIÓN RECURSIVA PARA RED REFERRAL
DROP FUNCTION IF EXISTS public.get_network_tree(UUID);
CREATE OR REPLACE FUNCTION public.get_network_tree(root_id UUID)
RETURNS TABLE (
    id UUID,
    email TEXT,
    username TEXT,
    referred_by UUID,
    level INTEGER,
    status TEXT,
    personal_volume DECIMAL,
    direct_referrals_count BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE network_tree AS (
        SELECT p.id, p.email, p.username, p.referred_by, 1 as level, p.status
        FROM public.profiles p WHERE p.referred_by = root_id
        UNION ALL
        SELECT p.id, p.email, p.username, p.referred_by, nt.level + 1, p.status
        FROM public.profiles p INNER JOIN network_tree nt ON p.referred_by = nt.id
        WHERE nt.level < 30
    )
    SELECT 
        nt.id, nt.email, nt.username, nt.referred_by, nt.level, nt.status,
        COALESCE((SELECT SUM(amount) FROM public.investments WHERE user_id = nt.id AND status = 'ACTIVE'), 0),
        (SELECT COUNT(*) FROM public.profiles WHERE referred_by = nt.id)
    FROM network_tree nt;
END;
$$;

-- 2. MEJORA DEL RPC DE APROBACIÓN DE DEPÓSITOS (CON AUTO-INVERSIÓN)
DROP FUNCTION IF EXISTS public.process_deposit_approval(UUID, UUID);
CREATE OR REPLACE FUNCTION public.process_deposit_approval(p_deposit_id UUID, p_admin_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID;
  v_amount DECIMAL;
  v_deposit_record RECORD;
  v_auto_activate BOOLEAN;
  v_plan_id UUID;
  v_investment_id UUID;
  v_promo_amount DECIMAL := 0;
  v_promo_title TEXT;
  v_promo_type TEXT;
  v_final_credit DECIMAL;
BEGIN
  -- 1. Obtener datos
  SELECT * INTO v_deposit_record FROM public.deposits WHERE id = p_deposit_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'message', 'Depósito no encontrado.'); END IF;
  IF v_deposit_record.status = 'APPROVED' THEN RETURN jsonb_build_object('success', false, 'message', 'Ya aprobado.'); END IF;

  v_user_id := v_deposit_record.user_id;
  v_amount := v_deposit_record.amount;

  -- 2. Aprobar
  UPDATE public.deposits SET status = 'APPROVED', updated_at = NOW() WHERE id = p_deposit_id;
  
  -- 3. Cargar Wallet Base
  UPDATE public.profiles SET wallet_balance = COALESCE(wallet_balance, 0) + v_amount WHERE id = v_user_id;

  -- 4. Cerrar Transacción Pendiente
  UPDATE public.transactions SET status = 'COMPLETED', updated_at = NOW() 
  WHERE user_id = v_user_id AND type = 'DEPOSIT' AND (description LIKE '%' || p_deposit_id || '%' OR reference_id = p_deposit_id);

  -- 5. AUTO-ACTIVACIÓN (REGLA DE ORO)
  SELECT auto_activate_investments INTO v_auto_activate FROM public.system_settings LIMIT 1;
  
  IF v_auto_activate = TRUE THEN
    -- Buscar Promociones
    SELECT reward_value, title, type INTO v_promo_amount, v_promo_title, v_promo_type
    FROM public.promotions WHERE is_active = true AND start_date <= NOW() AND end_date >= NOW()
    AND (min_investment = 0 OR min_investment <= v_amount) AND type IN ('CASHBACK', 'BONUS')
    ORDER BY reward_value DESC LIMIT 1;

    IF v_promo_amount > 0 THEN
      IF v_promo_type IN ('CASHBACK', 'DISCOUNT') THEN v_promo_amount := (v_amount * v_promo_amount) / 100; END IF;
    ELSE v_promo_amount := 0; END IF;

    v_final_credit := v_amount + v_promo_amount;

    -- Movimiento a Credit Balance
    UPDATE public.profiles SET wallet_balance = wallet_balance - v_amount, credit_balance = COALESCE(credit_balance, 0) + v_final_credit WHERE id = v_user_id;

    -- Logs de Crédito
    INSERT INTO public.credit_logs (user_id, amount, type, description, created_at)
    VALUES (v_user_id, v_amount, 'DEPOSIT', 'Depósito Crypto Acreditado: $' || v_amount, NOW());
    
    IF v_promo_amount > 0 THEN
       INSERT INTO public.transactions (user_id, amount, type, status, description, created_at)
       VALUES (v_user_id, v_promo_amount, 'BONUS', 'COMPLETED', 'Promoción Aplicada: ' || v_promo_title, NOW());
    END IF;

    -- CREACIÓN AUTOMÁTICA DE INVERSIÓN (Para detonar Comisiones)
    SELECT id INTO v_plan_id FROM public.plans WHERE status = 'active' ORDER BY min_amount ASC LIMIT 1;
    
    IF v_plan_id IS NOT NULL THEN
       INSERT INTO public.investments (user_id, plan_id, amount, status, accumulated_earnings, is_referral_commission_paid, created_at)
       VALUES (v_user_id, v_plan_id, v_final_credit, 'ACTIVE', 0, FALSE, NOW())
       RETURNING id INTO v_investment_id;

       UPDATE public.profiles SET credit_balance = credit_balance - v_final_credit WHERE id = v_user_id;

       INSERT INTO public.transactions (user_id, amount, type, status, description, reference_id, created_at)
       VALUES (v_user_id, -v_final_credit, 'INVESTMENT_COST', 'COMPLETED', 'Auto-Inversión: Activación automática de Nodo (' || v_investment_id || ')', v_investment_id, NOW());
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Depósito procesado al 100%.');
END;
$$;

-- 3. RE-VINCULACIÓN DE TRIGGERS DE COMISIONES
DROP TRIGGER IF EXISTS tr_distribute_referral_commissions ON public.investments;
CREATE TRIGGER tr_distribute_referral_commissions
    AFTER UPDATE OF status ON public.investments
    FOR EACH ROW WHEN (NEW.status = 'ACTIVE' AND OLD.status != 'ACTIVE')
    EXECUTE FUNCTION distribute_residual_commissions();

DROP TRIGGER IF EXISTS tr_distribute_referral_commissions_insert ON public.investments;
CREATE TRIGGER tr_distribute_referral_commissions_insert
    AFTER INSERT ON public.investments
    FOR EACH ROW WHEN (NEW.status = 'ACTIVE')
    EXECUTE FUNCTION distribute_residual_commissions();
