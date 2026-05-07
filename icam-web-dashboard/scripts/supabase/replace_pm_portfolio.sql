-- =============================================================================
-- RPC atómico: reemplazo completo del portfolio PM desde JSON (post-parse Excel).
-- Cada elemento de p_rows debe incluir:
--   id_activo, tipo_uso_activo (APT | RESIDENCIAL_LIBRE),
--   hito, orden_hito,
--   fecha_actual (YYYY-MM-DD o null),
--   desviacion_vs_anterior_dias, desviacion_vs_levantamiento_dias (enteros o null),
--   snapshots: objeto { "levantamiento": "2023-11-01", "2025_Q2": null, ... }
-- =============================================================================

CREATE OR REPLACE FUNCTION replace_pm_portfolio(p_rows jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  elem jsonb;
  v_activo_id uuid;
  v_hito_id uuid;
  snap_rec record;
  v_fecha date;
  snap_json jsonb;
BEGIN
  DELETE FROM pm_snapshot_fechas WHERE true;
  DELETE FROM pm_hitos WHERE true;
  DELETE FROM pm_activos WHERE true;

  FOR elem IN SELECT value FROM jsonb_array_elements(p_rows) AS t(value)
  LOOP
    INSERT INTO pm_activos (id_activo, tipo_uso_activo)
    VALUES (
      trim(elem->>'id_activo'),
      trim(elem->>'tipo_uso_activo')
    )
    ON CONFLICT (id_activo) DO UPDATE SET
      tipo_uso_activo = EXCLUDED.tipo_uso_activo,
      updated_at = now();
  END LOOP;

  FOR elem IN SELECT value FROM jsonb_array_elements(p_rows) AS t(value)
  LOOP
    SELECT id INTO v_activo_id FROM pm_activos WHERE id_activo = trim(elem->>'id_activo');

    INSERT INTO pm_hitos (
      activo_id, hito, orden_hito, fecha_actual,
      desviacion_vs_anterior_dias, desviacion_vs_levantamiento_dias
    )
    VALUES (
      v_activo_id,
      trim(elem->>'hito'),
      NULLIF(trim(elem->>'orden_hito'), '')::int,
      CASE WHEN trim(coalesce(elem->>'fecha_actual','')) = '' THEN NULL ELSE trim(elem->>'fecha_actual')::date END,
      CASE WHEN trim(coalesce(elem->>'desviacion_vs_anterior_dias','')) = '' THEN NULL ELSE trim(elem->>'desviacion_vs_anterior_dias')::int END,
      CASE WHEN trim(coalesce(elem->>'desviacion_vs_levantamiento_dias','')) = '' THEN NULL ELSE trim(elem->>'desviacion_vs_levantamiento_dias')::int END
    )
    RETURNING id INTO v_hito_id;

    snap_json := elem->'snapshots';
    IF snap_json IS NOT NULL AND jsonb_typeof(snap_json) = 'object' THEN
      FOR snap_rec IN SELECT key AS k, value AS v FROM jsonb_each(snap_json)
      LOOP
        IF snap_rec.v IS NULL OR jsonb_typeof(snap_rec.v) = 'null' THEN
          CONTINUE;
        END IF;
        IF jsonb_typeof(snap_rec.v) = 'string' THEN
          IF trim(snap_rec.v #>> '{}') = '' THEN
            CONTINUE;
          END IF;
          v_fecha := trim(snap_rec.v #>> '{}')::date;
        ELSIF jsonb_typeof(snap_rec.v) = 'number' THEN
          CONTINUE;
        ELSE
          CONTINUE;
        END IF;

        INSERT INTO pm_snapshot_fechas (hito_id, snapshot_code, fecha)
        VALUES (v_hito_id, snap_rec.k, v_fecha);
      END LOOP;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION replace_pm_portfolio(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION replace_pm_portfolio(jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';
