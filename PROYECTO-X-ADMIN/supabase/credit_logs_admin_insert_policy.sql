-- NOVA Digital / RLS patch for admin balance adjustments
-- Ejecutar manualmente en Supabase SQL Editor.
-- No modifica balances ni crea usuarios.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'credit_logs'
      AND policyname = 'credit_logs_admin_insert'
  ) THEN
    CREATE POLICY credit_logs_admin_insert
      ON public.credit_logs FOR INSERT TO authenticated
      WITH CHECK (
        performed_by = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'sub-admin')
        )
      );
  END IF;
END $$;
