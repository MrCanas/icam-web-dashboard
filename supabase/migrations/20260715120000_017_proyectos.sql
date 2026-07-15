-- Financiero (portfolio) — tabla maestra de proyectos del portfolio inmobiliario.
-- Antes vivía solo en scripts/supabase/*.sql de ejecución manual; se versiona aquí
-- para que el esquema sea reproducible. `if not exists` porque la tabla ya existe
-- en remoto (allí esta migración es no-op).
-- Tipos alineados con la RPC replace_proyectos (migración 018): métricas en
-- double precision, holding_period / es_ultima_fila en integer, fecha_inicio en date.

-- ---------------------------------------------------------------------------
-- proyectos
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.proyectos (
  id                      serial PRIMARY KEY,
  proyecto                text NOT NULL,
  situacion               text NOT NULL,
  tipo_proyecto           text NOT NULL,
  inversion_total         double precision,
  total_ingresos_venta    double precision,
  beneficios              double precision,
  unidades_totales        double precision,
  tir_desp_is             double precision,
  roe_desp_is             double precision,
  multiplo                double precision,
  project_irr             double precision,
  bcr                     double precision,
  ubicacion               text,
  equity                  double precision,
  holding_period          integer,
  superficie_edificable   double precision,
  es_ultima_fila          integer NOT NULL DEFAULT 1,
  fecha_inicio            date,
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS proyectos_situacion_idx ON public.proyectos (situacion);
CREATE INDEX IF NOT EXISTS proyectos_tipo_proyecto_idx ON public.proyectos (tipo_proyecto);
CREATE INDEX IF NOT EXISTS proyectos_es_ultima_fila_idx ON public.proyectos (es_ultima_fila);

-- ---------------------------------------------------------------------------
-- RLS — lectura pública (dashboards). Escrituras solo vía service_role (RPC).
-- ---------------------------------------------------------------------------
ALTER TABLE public.proyectos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
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

COMMENT ON TABLE public.proyectos IS 'Financiero: snapshot del portfolio inmobiliario (una fila por proyecto). El dashboard filtra es_ultima_fila = 1.';
COMMENT ON COLUMN public.proyectos.es_ultima_fila IS 'Marca la fila vigente del proyecto (1 = última). El dashboard solo lee es_ultima_fila = 1.';
COMMENT ON COLUMN public.proyectos.tir_desp_is IS 'TIR después de Impuesto de Sociedades (fracción, p. ej. 0.168 = 16,8%).';
COMMENT ON COLUMN public.proyectos.roe_desp_is IS 'ROE después de Impuesto de Sociedades (fracción).';
