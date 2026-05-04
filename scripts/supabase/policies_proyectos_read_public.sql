-- =============================================================================
-- Ejecutar en el proyecto que coincide con NEXT_PUBLIC_SUPABASE_URL (SQL Editor).
-- Permite SELECT con la clave pública (rol anon) sobre public.proyectos.
-- Útil si preferís que las lecturas PostgREST no dependan del service_role en servidor.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'proyectos'
      AND policyname = 'proyectos_public_read'
  ) THEN
    CREATE POLICY "proyectos_public_read"
      ON public.proyectos
      FOR SELECT
      TO public
      USING (true);
  END IF;
END $$;
