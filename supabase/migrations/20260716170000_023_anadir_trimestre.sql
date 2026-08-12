-- PM 023 — «Congelar» pasa a llamarse «Añadir».
--
-- Cambio de vocabulario, no de comportamiento: lo que hace la operación es
-- añadir un trimestre al histórico, y «congelar» describía el mecanismo
-- (copiar fecha_actual) en vez del resultado.
--
-- Se renombra también aquí para que la base de datos hable el mismo idioma que
-- la UI: dejar el RPC como congelar_pm_snapshot mientras el botón dice «Añadir
-- trimestre» obliga a traducir mentalmente en cada lectura.
--
-- Sin tildes ni eñes en los identificadores, como el resto del esquema
-- (desviacion_vs_levantamiento_dias, pm_hito_catalogo). En pantalla sí: «Añadir».

-- =============================================================================
-- 1. pm_snapshots.congelado_at → anadido_at
-- =============================================================================
-- RENAME conserva los datos: no es un borrado, es el mismo valor con otro nombre.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'pm_snapshots'
       AND column_name = 'congelado_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'pm_snapshots'
       AND column_name = 'anadido_at'
  ) THEN
    ALTER TABLE public.pm_snapshots RENAME COLUMN congelado_at TO anadido_at;
  END IF;
END $$;

COMMENT ON COLUMN public.pm_snapshots.anadido_at IS
  'Cuándo se añadió el trimestre al histórico (antes congelado_at). NULL = registrado pero sin datos aún.';

-- =============================================================================
-- 2. congelar_pm_snapshot() → anadir_pm_snapshot()
-- =============================================================================
-- Mismo cuerpo que la 022, solo cambia el nombre y la columna que escribe.

CREATE OR REPLACE FUNCTION public.anadir_pm_snapshot(
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

  INSERT INTO pm_snapshots (snapshot_code, orden, anadido_at)
  VALUES (v_code, pm_snapshot_orden(v_code), now())
  ON CONFLICT (snapshot_code) DO UPDATE
    SET anadido_at = now(),
        orden = pm_snapshot_orden(EXCLUDED.snapshot_code);

  -- Los hitos archivados NO entran: no aplican a ese proyecto, así que no deben
  -- aparecer en el reporte del trimestre.
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

COMMENT ON FUNCTION public.anadir_pm_snapshot(text, uuid[]) IS
  'Añade un trimestre al histórico copiando pm_hitos.fecha_actual. p_activo_ids NULL = todo el portfolio. Ignora hitos archivados. Idempotente. Devuelve nº de fechas.';

REVOKE ALL ON FUNCTION public.anadir_pm_snapshot(text, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.anadir_pm_snapshot(text, uuid[]) TO service_role;

-- La versión con el nombre viejo se retira: nadie debe poder llamarla ya, y
-- dejarla viva invitaría a escribir en anadido_at por dos caminos distintos.
DROP FUNCTION IF EXISTS public.congelar_pm_snapshot(text, uuid[]);
DROP FUNCTION IF EXISTS public.congelar_pm_snapshot(text);

NOTIFY pgrst, 'reload schema';
