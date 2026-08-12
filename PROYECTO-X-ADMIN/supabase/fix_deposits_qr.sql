-- Este script añade la columna 'transaction_hash' a la tabla 'deposits'
-- Esto es necesario para guardar el ID de pago de NowPayments y poder generar el QR.

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'deposits' 
        AND column_name = 'transaction_hash'
    ) THEN
        ALTER TABLE public.deposits ADD COLUMN transaction_hash TEXT;
    END IF;
END $$;
