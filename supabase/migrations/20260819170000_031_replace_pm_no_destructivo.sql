-- PM 031 — replace_pm_portfolio deja de destruir el trabajo manual de la PMO.
--
-- La versión anterior (scripts/supabase/replace_pm_portfolio.sql) empezaba con
--   DELETE FROM pm_snapshot_fechas; DELETE FROM pm_hitos; DELETE FROM pm_activos;
-- y reinsertaba pm_activos con UUIDs NUEVOS. Como estas FKs apuntan a
-- pm_activos.id / pm_hitos.id con ON DELETE CASCADE, cada subida del Excel PM
-- (/api/upload-pm-excel?confirm=true) borraba en silencio:
--   · pm_activo_proyecto_map   — mapeo PM ↔ maestro financiero (a mano)
--   · pm_activo_promocion_map  — emparejamiento con las promociones de Zoho
--   · pm_activo_snapshot       — flags publicado/visible por trimestre
--   · pm_snapshot_validacion   — resolución de discrepancias PM ↔ maestro
-- y ponía a NULL project.pm_activo_id (enlace de Actas).
--
-- Esta versión conserva las identidades:
--   1. UPSERT de pm_activos por id_activo    → los UUID no cambian
--   2. UPSERT de pm_hitos  por (activo_id, hito) → los UUID no cambian
--   3. Solo se reconstruyen las FECHAS de snapshot, que es lo único derivado del
--      Excel: se borran las del hito y se reinsertan. pm_snapshot_validacion
--      referencia pm_hitos.id (no las fechas), así que sobrevive.
-- Resultado: los cuatro mapeos y las validaciones aguantan un reemplazo.
--
-- El UPSERT de hitos NO toca catalogo_id ni archivado_at: replace no los conoce
-- (el catálogo se puebla con pm:backfill-planificacion), así que preservarlos es
-- justo lo que evita desincronizarlos.
--
-- CONSERVA LO VIEJO POR DISEÑO: un activo o un hito que desaparezca del Excel NO
-- se borra (queda como rescate, coherente con la política aditiva del proyecto).
-- Si en el futuro hace falta dar de baja algo, se hace explícito, no por omisión
-- en una carga de Excel.

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
  -- 1. Activos: upsert por id_activo (UUID estable). NO se borra la tabla.
  FOR elem IN SELECT value FROM jsonb_array_elements(p_rows) AS t(value)
  LOOP
    INSERT INTO pm_activos (id_activo, tipo_uso_activo)
    VALUES (trim(elem->>'id_activo'), trim(elem->>'tipo_uso_activo'))
    ON CONFLICT (id_activo) DO UPDATE SET
      tipo_uso_activo = EXCLUDED.tipo_uso_activo,
      updated_at = now();
  END LOOP;

  -- 2. Hitos: upsert por (activo_id, hito) (UUID estable). catalogo_id y
  --    archivado_at NO se tocan.
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
    ON CONFLICT (activo_id, hito) DO UPDATE SET
      orden_hito = EXCLUDED.orden_hito,
      fecha_actual = EXCLUDED.fecha_actual,
      desviacion_vs_anterior_dias = EXCLUDED.desviacion_vs_anterior_dias,
      desviacion_vs_levantamiento_dias = EXCLUDED.desviacion_vs_levantamiento_dias,
      updated_at = now()
    RETURNING id INTO v_hito_id;

    -- 3. Fechas de snapshot: se reconstruyen solo las de este hito. El id del
    --    hito no ha cambiado, así que pm_snapshot_validacion (que lo referencia)
    --    no se entera.
    DELETE FROM pm_snapshot_fechas WHERE hito_id = v_hito_id;

    snap_json := elem->'snapshots';
    IF snap_json IS NOT NULL AND jsonb_typeof(snap_json) = 'object' THEN
      FOR snap_rec IN SELECT key AS k, value AS v FROM jsonb_each(snap_json)
      LOOP
        IF snap_rec.v IS NULL OR jsonb_typeof(snap_rec.v) = 'null' THEN CONTINUE; END IF;
        IF jsonb_typeof(snap_rec.v) = 'string' THEN
          IF trim(snap_rec.v #>> '{}') = '' THEN CONTINUE; END IF;
          v_fecha := trim(snap_rec.v #>> '{}')::date;
        ELSE
          CONTINUE;
        END IF;

        INSERT INTO pm_snapshot_fechas (hito_id, snapshot_code, fecha)
        VALUES (v_hito_id, snap_rec.k, v_fecha)
        ON CONFLICT (hito_id, snapshot_code) DO UPDATE SET fecha = EXCLUDED.fecha;
      END LOOP;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION replace_pm_portfolio(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION replace_pm_portfolio(jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';
