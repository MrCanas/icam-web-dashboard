-- PM 025 — Gate de publicación: un trimestre recién añadido nace SIN publicar.
--
-- Hasta ahora «añadir» publicaba solo (sin fila en pm_activo_snapshot =
-- publicado). Con el flujo de validación contra el maestro financiero eso se
-- invierte: el trimestre no debe salir en el Overview hasta que el Financiero
-- haya reportado su línea (maestro_lineas_trimestre, migración 024) y la PM
-- haya resuelto las discrepancias de fechas.
--
-- El modelo «solo excepciones» NO cambia: se siembra la excepción
-- publicado=false en la misma transacción del añadido. Los trimestres
-- históricos no se tocan (sin backfill): siguen publicados como estaban.
--
-- ADITIVA: solo se reemplaza el cuerpo del RPC; ninguna tabla ni dato se toca.

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

  -- Nace sin publicar SOLO a partir del corte del flujo de validación
  -- (2026_Q2, orden 106 = (2026-2000)*4+2). Los trimestres anteriores son
  -- historia consolidada: si se añaden o re-añaden tarde, se publican solos
  -- como siempre — nada de lo que ya existe cambia de comportamiento.
  --
  -- DO NOTHING a propósito: re-añadir con «sobrescribir» un trimestre que la PM
  -- ya validó y publicó (su fila de excepción se borró al publicar) sí vuelve a
  -- despublicarlo (no hay fila → se inserta), pero si la fila existe con
  -- publicado=true o false se respeta el estado que decidió la PM.
  IF pm_snapshot_orden(v_code) >= pm_snapshot_orden('2026_Q2') THEN
    INSERT INTO pm_activo_snapshot (activo_id, snapshot_code, publicado)
    SELECT DISTINCT h.activo_id, v_code, false
      FROM pm_hitos h
     WHERE h.fecha_actual IS NOT NULL
       AND h.archivado_at IS NULL
       AND (p_activo_ids IS NULL OR h.activo_id = ANY(p_activo_ids))
    ON CONFLICT (activo_id, snapshot_code) DO NOTHING;
  END IF;

  RETURN v_n;
END;
$$;

COMMENT ON FUNCTION public.anadir_pm_snapshot(text, uuid[]) IS
  'Añade un trimestre al histórico copiando pm_hitos.fecha_actual. Desde 2026_Q2 lo deja SIN publicar (siembra publicado=false); los anteriores al corte se publican solos como siempre. p_activo_ids NULL = todo el portfolio. Ignora hitos archivados. Idempotente. Devuelve nº de fechas.';

REVOKE ALL ON FUNCTION public.anadir_pm_snapshot(text, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.anadir_pm_snapshot(text, uuid[]) TO service_role;

NOTIFY pgrst, 'reload schema';
