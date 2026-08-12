-- migration_auto_invest.sql
-- 1. Add settings column to system_settings if it doesn't exist
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS auto_activate_investments BOOLEAN DEFAULT FALSE;

-- 2. Enable auto-activation by default (The Golden Rule)
UPDATE public.system_settings SET auto_activate_investments = TRUE WHERE id = 1;

-- 3. Redefine the process_deposit_approval RPC to support the Golden Rule
CREATE OR REPLACE FUNCTION public.process_deposit_approval(
  p_deposit_id UUID,
  p_admin_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_amount DECIMAL;
  v_deposit_record RECORD;
  v_auto_activate BOOLEAN;
  v_plan_id UUID;
  v_investment_id UUID;
BEGIN
  -- 1. Get deposit details and lock for update
  SELECT * INTO v_deposit_record
  FROM public.deposits
  WHERE id = p_deposit_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Depósito no encontrado.');
  END IF;

  IF v_deposit_record.status = 'APPROVED' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Este depósito ya fue aprobado.');
  END IF;

  v_user_id := v_deposit_record.user_id;
  v_amount := v_deposit_record.amount;

  -- 2. Update deposit status
  UPDATE public.deposits
  SET 
    status = 'APPROVED',
    updated_at = NOW()
  WHERE id = p_deposit_id;

  -- 3. Initial credit to user's wallet_balance (WALLET BANK)
  -- This ensures the ledger starts with the deposit entry
  UPDATE public.profiles
  SET wallet_balance = COALESCE(wallet_balance, 0) + v_amount
  WHERE id = v_user_id;

  -- 4. Mark the original transaction as COMPLETED
  UPDATE public.transactions
  SET 
    status = 'COMPLETED',
    updated_at = NOW()
  WHERE user_id = v_user_id 
    AND type = 'DEPOSIT' 
    AND (description LIKE '%' || p_deposit_id || '%' OR reference_id = p_deposit_id);

  -- 5. REGLA DE ORO: Check for auto-activation
  SELECT auto_activate_investments INTO v_auto_activate FROM public.system_settings LIMIT 1;
  
  IF v_auto_activate = TRUE THEN
    -- a. Convert immediately from Wallet to Credit
    UPDATE public.profiles
    SET 
      wallet_balance = wallet_balance - v_amount,
      credit_balance = COALESCE(credit_balance, 0) + v_amount
    WHERE id = v_user_id;

    -- b. Log conversion in transactions ledger
    INSERT INTO public.transactions (user_id, amount, type, status, description, created_at)
    VALUES (v_user_id, v_amount, 'CONVERSION', 'COMPLETED', 'Auto-Conversión: Depósito activado automáticamente por Regla de Oro', NOW());

    -- c. Get the default active investment plan
    SELECT id INTO v_plan_id FROM public.plans WHERE status = 'active' LIMIT 1;
    
    IF v_plan_id IS NOT NULL THEN
      -- d. Create investment node (ACTIVE)
      INSERT INTO public.investments (user_id, plan_id, amount, status, accumulated_earnings, created_at)
      VALUES (v_user_id, v_plan_id, v_amount, 'ACTIVE', 0, NOW())
      RETURNING id INTO v_investment_id;

      -- e. Deduct from credit_balance (Closing the loop)
      UPDATE public.profiles
      SET credit_balance = credit_balance - v_amount
      WHERE id = v_user_id;

      -- f. Log investment transaction in general ledger
      INSERT INTO public.transactions (user_id, type, amount, status, description, reference_id, created_at)
      VALUES (v_user_id, 'INVESTMENT_COST', -v_amount, 'COMPLETED', 'Auto-Activación de Nodo: $' || v_amount || ' (Ref: ' || v_investment_id || ')', v_investment_id, NOW());
      
      -- g. Log in dedicated credit_logs for UI history
      INSERT INTO public.credit_logs (user_id, amount, type, description, created_at)
      VALUES (v_user_id, -v_amount, 'TRANSFER_OUT', 'Activación Automática de Nodo: $' || v_amount, NOW());
    END IF;
  END IF;

  -- 6. Return comprehensive success result
  RETURN jsonb_build_object(
    'success', true, 
    'message', CASE WHEN v_auto_activate THEN 'Depósito aprobado e inversión activada automáticamente por Regla de Oro.' ELSE 'Depósito aprobado correctamente y saldo acreditado.' END,
    'amount', v_amount,
    'user_id', v_user_id,
    'auto_activated', COALESCE(v_auto_activate, FALSE)
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;
