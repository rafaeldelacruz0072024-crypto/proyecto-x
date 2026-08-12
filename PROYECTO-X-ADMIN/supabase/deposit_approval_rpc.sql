-- RPC to approve a deposit and credit the user's balance
-- This function is called from the Admin Panel terminal

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
  v_status TEXT;
  v_deposit_record RECORD;
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

  -- 3. Credit user's wallet_balance (WALLET BANK)
  UPDATE public.profiles
  SET wallet_balance = COALESCE(wallet_balance, 0) + v_amount
  WHERE id = v_user_id;

  -- 4. Mark related transaction as COMPLETED
  -- We search for the transaction by description containing the deposit ID
  UPDATE public.transactions
  SET 
    status = 'COMPLETED',
    updated_at = NOW()
  WHERE user_id = v_user_id 
    AND type = 'DEPOSIT' 
    AND description LIKE '%' || p_deposit_id || '%';

  -- 5. Return success
  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Depósito aprobado correctamente y saldo acreditado.',
    'amount', v_amount,
    'user_id', v_user_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;
