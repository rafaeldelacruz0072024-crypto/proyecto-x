-- ATOMIC INVESTMENT RPC
-- Ensures that checking balance, creating investment, and deducting balance
-- occurs in a single transaction to prevent double-spending or race conditions.

CREATE OR REPLACE FUNCTION public.process_investment(
  p_user_id UUID,
  p_amount DECIMAL,
  p_plan_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance DECIMAL;
  v_investment_id UUID;
  v_result JSONB;
BEGIN
  -- 1. Check current credit balance with Row-Level Lock (FOR UPDATE)
  SELECT credit_balance INTO v_current_balance
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  -- 2. Validate sufficient funds
  IF v_current_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient credit balance');
  END IF;

  -- 3. Create the investment record (is_referral_commission_paid explícito)
  INSERT INTO public.investments (
    user_id,
    plan_id,
    amount,
    status,
    accumulated_earnings,
    is_referral_commission_paid,
    created_at
  )
  VALUES (
    p_user_id,
    p_plan_id,
    p_amount,
    'ACTIVE',
    0,
    FALSE,
    NOW()
  )
  RETURNING id INTO v_investment_id;

  -- 4. Create the transaction record (Main Ledger)
  INSERT INTO public.transactions (
    user_id,
    type,
    amount,
    status,
    description,
    reference_id,
    created_at
  )
  VALUES (
    p_user_id,
    'INVESTMENT_COST',
    -p_amount,
    'COMPLETED',
    'Investment Activation: $' || p_amount || ' Package (Node ID: ' || v_investment_id || ')',
    v_investment_id,
    NOW()
  );

  -- 5. Deduct from profile balance
  UPDATE public.profiles
  SET credit_balance = credit_balance - p_amount
  WHERE id = p_user_id;

  -- 6. Log in credit_logs (Credit Ledger)
  INSERT INTO public.credit_logs (
    user_id,
    amount,
    type,
    description,
    created_at
  )
  VALUES (
    p_user_id,
    -p_amount,
    'TRANSFER_OUT',
    'Activación de Nodo: $' || p_amount,
    NOW()
  );

  -- 7. Return success result
  RETURN jsonb_build_object(
    'success', true,
    'investment', jsonb_build_object('id', v_investment_id, 'amount', p_amount)
  );

EXCEPTION WHEN OTHERS THEN
  -- PostgreSQL automatically rolls back if an error occurs
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
