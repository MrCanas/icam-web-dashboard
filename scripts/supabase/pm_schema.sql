-- =============================================================================
-- ICAM — Project Management (hitos / snapshots)
-- Ejecutar en Supabase SQL Editor (mismo proyecto que la app).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.pm_activos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_activo text NOT NULL UNIQUE,
  tipo_uso_activo text NOT NULL CHECK (tipo_uso_activo IN ('APT', 'RESIDENCIAL_LIBRE')),
  nombre_display text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pm_hitos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activo_id uuid NOT NULL REFERENCES public.pm_activos(id) ON DELETE CASCADE,
  hito text NOT NULL,
  orden_hito int NOT NULL,
  fecha_actual date,
  desviacion_vs_anterior_dias int,
  desviacion_vs_levantamiento_dias int,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (activo_id, hito)
);

CREATE INDEX IF NOT EXISTS idx_pm_hitos_activo ON public.pm_hitos (activo_id);

CREATE TABLE IF NOT EXISTS public.pm_snapshot_fechas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hito_id uuid NOT NULL REFERENCES public.pm_hitos(id) ON DELETE CASCADE,
  snapshot_code text NOT NULL,
  fecha date,
  created_at timestamptz DEFAULT now(),
  UNIQUE (hito_id, snapshot_code)
);

CREATE INDEX IF NOT EXISTS idx_pm_snapshot_code ON public.pm_snapshot_fechas (snapshot_code);

CREATE TABLE IF NOT EXISTS public.pm_activo_proyecto_map (
  pm_activo_id uuid PRIMARY KEY REFERENCES public.pm_activos(id) ON DELETE CASCADE,
  proyecto_financiero_key text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS public.pm_import_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  archivo text,
  estado text,
  duracion_ms int,
  detalle jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.pm_activos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_hitos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_snapshot_fechas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_activo_proyecto_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_import_logs ENABLE ROW LEVEL SECURITY;

-- Lectura pública coherente con portfolio (ajustar si el modelo de seguridad cambia)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pm_activos' AND policyname = 'pm_activos_public_read'
  ) THEN
    CREATE POLICY "pm_activos_public_read" ON public.pm_activos FOR SELECT TO public USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pm_hitos' AND policyname = 'pm_hitos_public_read'
  ) THEN
    CREATE POLICY "pm_hitos_public_read" ON public.pm_hitos FOR SELECT TO public USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pm_snapshot_fechas' AND policyname = 'pm_snapshot_fechas_public_read'
  ) THEN
    CREATE POLICY "pm_snapshot_fechas_public_read" ON public.pm_snapshot_fechas FOR SELECT TO public USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pm_activo_proyecto_map' AND policyname = 'pm_map_public_read'
  ) THEN
    CREATE POLICY "pm_map_public_read" ON public.pm_activo_proyecto_map FOR SELECT TO public USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pm_import_logs' AND policyname = 'pm_import_logs_public_read'
  ) THEN
    CREATE POLICY "pm_import_logs_public_read" ON public.pm_import_logs FOR SELECT TO public USING (true);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
