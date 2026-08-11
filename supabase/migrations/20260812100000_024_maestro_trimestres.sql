-- FIN 024 — Captura por (proyecto, trimestre) de lo que replace_proyectos descarta.
--
-- La hoja «Tabla madre» del maestro ya es snapshot-nativa: una fila por proyecto
-- y trimestre (columna H) con 8 pares flag+fecha de hitos en DW-EL. La ingesta
-- actual colapsa esa dimensión (solo Es Ultima fila = 1) y tira las fechas.
-- Estas dos tablas las conservan para que PM pueda:
--   1. saber si el Financiero YA reportó un trimestre (gate de publicación), y
--   2. comparar las fechas del maestro con las de Planificación (validación).
--
-- ADITIVA: no toca `proyectos` ni el RPC replace_proyectos. Aquí nunca se borra:
-- el maestro puede dejar de traer una línea y el histórico se queda como rescate.

-- =============================================================================
-- 1. Líneas vistas: existencia de fila = el Financiero reportó ese trimestre
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.maestro_lineas_trimestre (
  proyecto text NOT NULL,
  -- Normalizado al vocabulario de pm_snapshots: «2025 4T» → 2025_Q4.
  trimestre_code text NOT NULL,
  primera_vista_at timestamptz NOT NULL DEFAULT now(),
  ultima_vista_at timestamptz NOT NULL DEFAULT now(),
  ultimo_archivo text,
  PRIMARY KEY (proyecto, trimestre_code)
);

COMMENT ON TABLE public.maestro_lineas_trimestre IS
  'FIN: una fila por línea (proyecto × trimestre) vista en la Tabla madre. Existencia = trimestre reportado por el Financiero. Nunca se borra.';
COMMENT ON COLUMN public.maestro_lineas_trimestre.proyecto IS
  'Valor literal de la columna Proyecto del maestro (= proyectos.proyecto y pm_activo_proyecto_map.proyecto_financiero_key). Sin FK: proyectos se reemplaza entero en cada carga.';
COMMENT ON COLUMN public.maestro_lineas_trimestre.trimestre_code IS
  'AAAA_Qn, mismo vocabulario que pm_snapshots.snapshot_code. ALL TIME no se ingesta: no es un trimestre reportado.';

-- =============================================================================
-- 2. Fechas de hito de cada línea (los 8 pares DW-EL de la Tabla madre)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.maestro_hito_fechas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto text NOT NULL,
  trimestre_code text NOT NULL,
  -- Cabecera literal de la columna de fecha («Fecha obra»): cruza con
  -- pm_hito_catalogo.tabla_madre_columna, que decide la PMO en /pm/proyectos.
  columna text NOT NULL,
  -- NULL = celda vacía o centinela 1899-12-30 (serial 0 de Excel).
  fecha date,
  -- El booleano acompañante (Obra, LPO…): hito alcanzado sí/no. NULL si ilegible.
  flag boolean,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proyecto, trimestre_code, columna),
  FOREIGN KEY (proyecto, trimestre_code)
    REFERENCES public.maestro_lineas_trimestre (proyecto, trimestre_code)
    ON DELETE CASCADE
);

COMMENT ON TABLE public.maestro_hito_fechas IS
  'FIN: fechas de hito reportadas en cada línea del maestro (columnas DW-EL). Upsert por carga; nunca se borra.';

CREATE INDEX IF NOT EXISTS idx_maestro_hito_fechas_linea
  ON public.maestro_hito_fechas (proyecto, trimestre_code);

-- =============================================================================
-- 3. RLS — lectura pública, escritura solo por service role (como el resto)
-- =============================================================================

ALTER TABLE public.maestro_lineas_trimestre ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maestro_hito_fechas ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'maestro_lineas_trimestre' AND policyname = 'maestro_lineas_trimestre_public_read'
  ) THEN
    CREATE POLICY "maestro_lineas_trimestre_public_read"
      ON public.maestro_lineas_trimestre FOR SELECT TO public USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'maestro_hito_fechas' AND policyname = 'maestro_hito_fechas_public_read'
  ) THEN
    CREATE POLICY "maestro_hito_fechas_public_read"
      ON public.maestro_hito_fechas FOR SELECT TO public USING (true);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
