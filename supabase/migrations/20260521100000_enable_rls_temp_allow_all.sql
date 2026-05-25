-- TEMPORAL — sustituir cuando se active RBAC real (políticas por rol / Entra ID).
-- Habilita RLS en todas las tablas usadas por la app con una política permisiva.

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'proyectos',
    'upload_logs',
    'pm_activos',
    'pm_hitos',
    'pm_snapshot_fechas',
    'pm_activo_proyecto_map',
    'pm_import_logs',
    'monday_sync_logs'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_tables
      WHERE schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = t
          AND policyname = 'temp_allow_all'
      ) THEN
        EXECUTE format(
          'CREATE POLICY temp_allow_all ON public.%I FOR ALL USING (true) WITH CHECK (true)',
          t
        );
      END IF;
    END IF;
  END LOOP;
END $$;
