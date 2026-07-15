-- =============================================================================
-- [SUPERSEDED] Versionado ahora en supabase/migrations/20260715130000_018_replace_proyectos_rpc.sql
-- Se mantiene solo como referencia / ejecución manual de emergencia.
-- =============================================================================
-- MAESTRO ICAM — Reemplazo atómico de la tabla public.proyectos
-- =============================================================================
-- 1) Abre el proyecto correcto en Supabase (el de NEXT_PUBLIC_SUPABASE_URL).
-- 2) SQL Editor → pega TODO este archivo → Run (sin omitir el final).
-- 3) Database → Functions: debe aparecer replace_proyectos(p_rows jsonb).
-- 4) Si la app seguía en marcha, reinicia `npm run dev` y vuelve a confirmar
--    la subida; si PostgREST aún no ve la función, espera ~1 min o ejecuta
--    de nuevo solo la línea NOTIFY del final.
-- =============================================================================
-- Comprobar que Postgres tiene la función (opcional):
--   select p.proname, pg_get_function_identity_arguments(p.oid)
--   from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.proname = 'replace_proyectos';
-- =============================================================================

CREATE OR REPLACE FUNCTION replace_proyectos(p_rows jsonb)
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
    entry_yield,
    exit_yield,
    credito_total,
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
    NULLIF(trim(elem->>'entry_yield'), '')::double precision,
    NULLIF(trim(elem->>'exit_yield'), '')::double precision,
    NULLIF(trim(elem->>'credito_total'), '')::double precision,
    NULLIF(trim(elem->>'holding_period'), '')::integer,
    NULLIF(trim(elem->>'superficie_edificable'), '')::double precision,
    COALESCE(NULLIF(trim(elem->>'es_ultima_fila'), '')::integer, 1),
    NULLIF(trim(elem->>'fecha_inicio'), '')::date
  FROM jsonb_array_elements(p_rows) AS elem;
END;
$$;

REVOKE ALL ON FUNCTION replace_proyectos(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION replace_proyectos(jsonb) TO service_role;

-- Recarga la caché de esquema de PostgREST (Supabase) para exponer la RPC al instante.
NOTIFY pgrst, 'reload schema';
