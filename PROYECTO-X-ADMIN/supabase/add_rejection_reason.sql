ALTER TABLE public.withdrawals
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
