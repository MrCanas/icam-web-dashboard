-- PM 022 — Todo por proyecto: publicar, archivar hitos y congelar.
--
-- La 020/021 asumían un portfolio homogéneo y no lo es: los proyectos ni
-- empiezan a la vez ni usan los mismos hitos. En los datos reales CA1 no tiene
-- ninguna fecha en 2025 (empezó en Q4) y DC-15 no tiene ninguna en Q4 2025 ni
-- Q1 2026 (dejó de reportarse), así que la matriz proyecto × trimestre es
-- dispersa y lo global no sirve.
--
-- ADITIVA: no se borra ninguna tabla ni columna. pm_snapshots.visible_en_dashboard
-- se conserva aunque deje de leerse — lo sustituye pm_activo_snapshot.

-- =============================================================================
-- 1. Publicar por proyecto × trimestre
-- =============================================================================
-- Solo se guardan las EXCEPCIONES: ausencia de fila = publicado. Así un
-- trimestre recién congelado se publica solo (congelar es reportar) y no hay que
-- sembrar 9×5 filas ni mantenerlas al dar de alta un proyecto.
--
-- La regla efectiva combina dos cosas distintas:
--   - automático: un proyecto sin fechas en un trimestre no tiene nada que publicar;
--   - manual: publicado=false retira uno que sí las tiene.

CREATE TABLE IF NOT EXISTS public.pm_activo_snapshot (
  activo_id uuid NOT NULL REFERENCES public.pm_activos(id) ON DELETE CASCADE,
  snapshot_code text NOT NULL REFERENCES public.pm_snapshots(snapshot_code) ON DELETE CASCADE,
  publicado boolean NOT NULL DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (activo_id, snapshot_code)
);

COMMENT ON TABLE public.pm_activo_snapshot IS
  'PM: qué trimestres publica cada proyecto en el Overview. Solo excepciones: sin fila = publicado.';
COMMENT ON COLUMN public.pm_activo_snapshot.publicado IS
  'false = la PMO retira este trimestre de ESTE proyecto. No borra fechas; siguen en la rejilla.';

CREATE INDEX IF NOT EXISTS idx_pm_activo_snapshot_code
  ON public.pm_activo_snapshot (snapshot_code);

COMMENT ON COLUMN public.pm_snapshots.visible_en_dashboard IS
  'OBSOLETA desde la 022: publicar es por proyecto (pm_activo_snapshot). Se conserva sin uso.';

-- =============================================================================
-- 2. Archivar hitos por proyecto
-- =============================================================================
-- pm_hitos ya es una fila por activo×hito, así que archivar aquí es
-- intrínsecamente por proyecto: archivar «Inspeccion Turismo» en uno no toca al
-- resto.
--
-- Sustituye a borrar el hito: el DELETE se lleva por cascada sus
-- pm_snapshot_fechas, que son histórico de reportes ya emitidos.

ALTER TABLE public.pm_hitos
  ADD COLUMN IF NOT EXISTS archivado_at timestamptz;

COMMENT ON COLUMN public.pm_hitos.archivado_at IS
  'Baja lógica por proyecto: el hito no aplica a este activo. Fuera de rejilla, Gantt y detalle; sus fechas se conservan. NULL = activo.';

CREATE INDEX IF NOT EXISTS idx_pm_hitos_archivado
  ON public.pm_hitos (activo_id)
  WHERE archivado_at IS NULL;

-- =============================================================================
-- 3. Congelar selectivo
-- =============================================================================
-- La versión de la 021 copiaba fecha_actual de TODO el portfolio. Los datos
-- dicen que nunca debió ser así: si el proceso del Excel hubiera congelado en
-- bloque, DC-15 tendría fechas en Q4 2025 y Q1 2026. No las tiene → ya era
-- selectivo. Congelar a todos inventaría reportes de proyectos que ese trimestre
-- no se reportaron.
--
-- p_activo_ids NULL mantiene el comportamiento anterior (todo el portfolio).
-- Sigue siendo idempotente por el UNIQUE (hito_id, snapshot_code).

CREATE OR REPLACE FUNCTION public.congelar_pm_snapshot(
  p_snapshot_code text,
  p_activo_ids uuid[] DEFAULT NULL
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_n int;
BEGIN
  v_code := upper(trim(p_snapshot_code));

  IF v_code = 'FECHA_ACTUAL' OR v_code IS NULL OR v_code = '' THEN
    RAISE EXCEPTION 'snapshot_code inválido: %', p_snapshot_code;
  END IF;

  INSERT INTO pm_snapshots (snapshot_code, orden, congelado_at)
  VALUES (v_code, pm_snapshot_orden(v_code), now())
  ON CONFLICT (snapshot_code) DO UPDATE
    SET congelado_at = now(),
        orden = pm_snapshot_orden(EXCLUDED.snapshot_code);

  -- Los hitos archivados NO se congelan: no aplican a ese proyecto, así que no
  -- deben aparecer en el reporte del trimestre.
  INSERT INTO pm_snapshot_fechas (hito_id, snapshot_code, fecha)
  SELECT h.id, v_code, h.fecha_actual
    FROM pm_hitos h
   WHERE h.fecha_actual IS NOT NULL
     AND h.archivado_at IS NULL
     AND (p_activo_ids IS NULL OR h.activo_id = ANY(p_activo_ids))
  ON CONFLICT (hito_id, snapshot_code) DO UPDATE
    SET fecha = EXCLUDED.fecha;

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

COMMENT ON FUNCTION public.congelar_pm_snapshot(text, uuid[]) IS
  'Congela pm_hitos.fecha_actual en un snapshot_code. p_activo_ids NULL = todo el portfolio. Ignora hitos archivados. Idempotente. Devuelve nº de fechas.';

REVOKE ALL ON FUNCTION public.congelar_pm_snapshot(text, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.congelar_pm_snapshot(text, uuid[]) TO service_role;

-- La firma de 1 argumento de la 021 queda huérfana: PostgREST resolvería mal la
-- llamada con dos parámetros si conviven. Se elimina solo la sobrecarga vieja;
-- ninguna tabla ni dato se toca.
DROP FUNCTION IF EXISTS public.congelar_pm_snapshot(text);

-- =============================================================================
-- 4. RLS — lectura pública, coherente con el resto de pm_*
-- =============================================================================

ALTER TABLE public.pm_activo_snapshot ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pm_activo_snapshot' AND policyname = 'pm_activo_snapshot_public_read'
  ) THEN
    CREATE POLICY "pm_activo_snapshot_public_read"
      ON public.pm_activo_snapshot FOR SELECT TO public USING (true);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
