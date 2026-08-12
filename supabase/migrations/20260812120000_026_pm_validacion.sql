-- PM 026 — Validación de discrepancias PM ↔ maestro financiero.
--
-- Cuando el Financiero reporta la línea de un (proyecto, trimestre) en el
-- maestro (migración 024), sus fechas pueden no coincidir con las reportadas en
-- Planificación. La PM resuelve cada discrepancia eligiendo la fecha correcta;
-- la elegida pasa a ser la oficial en pm_snapshot_fechas y, cuando no queda
-- ninguna pendiente, el trimestre se publica automáticamente.
--
-- La tabla guarda una FOTO de ambos lados en el momento de resolver: si el
-- maestro (o la celda de PM) cambia después, la condición «resolución vigente»
-- deja de cumplirse y la discrepancia reaparece sola. No hace falta ningún
-- proceso que invalide resoluciones.
--
-- ADITIVA: tabla nueva; nada se toca ni se borra.

CREATE TABLE IF NOT EXISTS public.pm_snapshot_validacion (
  hito_id uuid NOT NULL REFERENCES public.pm_hitos(id) ON DELETE CASCADE,
  snapshot_code text NOT NULL REFERENCES public.pm_snapshots(snapshot_code) ON DELETE CASCADE,
  -- Qué lado eligió la PM.
  fuente text NOT NULL CHECK (fuente IN ('pm', 'maestro')),
  fecha_elegida date,
  -- Foto de ambos lados al resolver (ver cabecera).
  fecha_pm date,
  fecha_maestro date,
  resuelto_por text,
  resuelto_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (hito_id, snapshot_code)
);

COMMENT ON TABLE public.pm_snapshot_validacion IS
  'PM: resolución de discrepancias de fecha entre Planificación y el maestro, por hito × trimestre. La foto (fecha_pm/fecha_maestro) decide si sigue vigente.';

ALTER TABLE public.pm_snapshot_validacion ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pm_snapshot_validacion' AND policyname = 'pm_snapshot_validacion_public_read'
  ) THEN
    CREATE POLICY "pm_snapshot_validacion_public_read"
      ON public.pm_snapshot_validacion FOR SELECT TO public USING (true);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
