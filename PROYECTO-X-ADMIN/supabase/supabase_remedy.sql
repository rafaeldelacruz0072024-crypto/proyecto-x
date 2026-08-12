-- DEFINITIVE FIX FOR fk_transactions_investments
-- RUN THIS IN SUPABASE SQL EDITOR

-- 1. Make the constraint DEFERRABLE
-- This allows the record to be inserted into investments and transactions 
-- in the same transaction even if the sequencing is tricky.
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_transactions_investments' 
        AND table_name = 'transactions'
    ) THEN
        ALTER TABLE public.transactions 
        DROP CONSTRAINT fk_transactions_investments;
        
        ALTER TABLE public.transactions 
        ADD CONSTRAINT fk_transactions_investments 
        FOREIGN KEY (reference_id) 
        REFERENCES public.investments(id) 
        ON DELETE CASCADE
        DEFERRABLE INITIALLY DEFERRED;
    END IF;
END $$;

-- 2. Update the Triggers to AFTER if they were still BEFORE
-- (Note: Replace the function content with the one from the local file first if needed)

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

-- 3. Optimization: Force column check
COMMENT ON CONSTRAINT fk_transactions_investments ON public.transactions IS 'Definitive fix for node activation race conditions';
