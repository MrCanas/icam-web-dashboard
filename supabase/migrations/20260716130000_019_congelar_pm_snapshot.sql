-- PM 019 — Congelar el trimestre reportado por la PMO.
--
-- Sustituye a "añadir a mano una columna de trimestre a la hoja OVERVIEW":
-- copia la previsión vigente de cada hito (pm_hitos.fecha_actual) a
-- pm_snapshot_fechas bajo un snapshot_code nuevo.

-- =============================================================================
-- Orden cronológico de un snapshot_code
-- =============================================================================
-- Única fuente de verdad del orden, usada por el RPC y por el backfill
-- (scripts/pm/backfill-planificacion.ts). La fórmula (año-2000)*4+trimestre
-- es estable: un trimestre insertado a posteriori cae en su sitio. Numerar
-- correlativamente (1,2,3…) según lo ya existente sí se rompería al añadir,
-- por ejemplo, un 2025_Q1 después de haber registrado 2025_Q2.
-- levantamiento = 0 → siempre el primero (es el plan original).

CREATE OR REPLACE FUNCTION public.pm_snapshot_orden(p_code text)
RETURNS int
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  m text[];
BEGIN
  IF p_code = 'levantamiento' THEN
    RETURN 0;
  END IF;
  m := regexp_match(upper(trim(p_code)), '^(\d{4})_Q([1-4])$');
  IF m IS NULL THEN
    RETURN 900;  -- códigos no reconocidos, al final pero sin romper nada
  END IF;
  RETURN (m[1]::int - 2000) * 4 + m[2]::int;
END;
$$;

COMMENT ON FUNCTION public.pm_snapshot_orden(text) IS
  'Orden cronológico de un snapshot_code. levantamiento=0; AAAA_Qn=(año-2000)*4+n.';

-- =============================================================================
-- RPC: congelar snapshot
-- =============================================================================
-- Idempotente gracias al UNIQUE (hito_id, snapshot_code) de pm_schema.sql:
-- volver a congelar el mismo código actualiza las fechas en vez de duplicarlas.
-- Global al portfolio: un snapshot = un trimestre reportado para todos los
-- proyectos, que es como lo trata el selector del Overview.
--
-- Solo copia hitos CON fecha_actual: un hito sin previsión vigente no debe
-- quedar registrado en el reporte del trimestre.

CREATE OR REPLACE FUNCTION public.congelar_pm_snapshot(p_snapshot_code text)
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

  INSERT INTO pm_snapshot_fechas (hito_id, snapshot_code, fecha)
  SELECT h.id, v_code, h.fecha_actual
    FROM pm_hitos h
   WHERE h.fecha_actual IS NOT NULL
  ON CONFLICT (hito_id, snapshot_code) DO UPDATE
    SET fecha = EXCLUDED.fecha;

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

COMMENT ON FUNCTION public.congelar_pm_snapshot(text) IS
  'Congela pm_hitos.fecha_actual en un snapshot_code. Idempotente. Devuelve nº de fechas.';

REVOKE ALL ON FUNCTION public.congelar_pm_snapshot(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.congelar_pm_snapshot(text) TO service_role;

-- Realinea el orden de los snapshots ya registrados con la fórmula definitiva
-- (el backfill inicial los numeró 1,2,3,4). No toca visible_en_dashboard ni label.
UPDATE public.pm_snapshots SET orden = pm_snapshot_orden(snapshot_code);

NOTIFY pgrst, 'reload schema';
