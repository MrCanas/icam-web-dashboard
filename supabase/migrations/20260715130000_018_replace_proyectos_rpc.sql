-- Financiero (portfolio) — RPC de reemplazo atómico del snapshot de proyectos.
-- Se ejecuta tras cargar el Excel maestro (manual o cron): borra e inserta en una
-- sola transacción. Versiona lo que antes era scripts/supabase/replace_proyectos.sql.
-- SECURITY DEFINER + GRANT solo a service_role (el cliente de escritura de la app).

CREATE OR REPLACE FUNCTION public.replace_proyectos(p_rows jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM proyectos WHERE true;

  INSERT INTO proyectos (
    proyecto,
    situacion,
    tipo_proyecto,
    inversion_total,
    total_ingresos_venta,
    beneficios,
    unidades_totales,
    tir_desp_is,
    roe_desp_is,
    multiplo,
    project_irr,
    bcr,
    ubicacion,
    equity,
    holding_period,
    superficie_edificable,
    es_ultima_fila,
    fecha_inicio
  )
  SELECT
    (elem->>'proyecto')::text,
    (elem->>'situacion')::text,
    (elem->>'tipo_proyecto')::text,
    NULLIF(trim(elem->>'inversion_total'), '')::double precision,
    NULLIF(trim(elem->>'total_ingresos_venta'), '')::double precision,
    NULLIF(trim(elem->>'beneficios'), '')::double precision,
    NULLIF(trim(elem->>'unidades_totales'), '')::double precision,
    NULLIF(trim(elem->>'tir_desp_is'), '')::double precision,
    NULLIF(trim(elem->>'roe_desp_is'), '')::double precision,
    NULLIF(trim(elem->>'multiplo'), '')::double precision,
    NULLIF(trim(elem->>'project_irr'), '')::double precision,
    NULLIF(trim(elem->>'bcr'), '')::double precision,
    NULLIF(trim(elem->>'ubicacion'), '')::text,
    NULLIF(trim(elem->>'equity'), '')::double precision,
    NULLIF(trim(elem->>'holding_period'), '')::integer,
    NULLIF(trim(elem->>'superficie_edificable'), '')::double precision,
    COALESCE(NULLIF(trim(elem->>'es_ultima_fila'), '')::integer, 1),
    NULLIF(trim(elem->>'fecha_inicio'), '')::date
  FROM jsonb_array_elements(p_rows) AS elem;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_proyectos(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_proyectos(jsonb) TO service_role;

-- Recarga la caché de esquema de PostgREST para exponer la RPC al instante.
NOTIFY pgrst, 'reload schema';
