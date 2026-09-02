-- Financiero (portfolio) 034 — el RPC deja de tirar cuatro columnas por el camino.
--
-- La versión de la migración 018 lista columnas explícitas en el INSERT y se
-- dejó fuera tres que el parser SÍ lee del maestro:
--   · entry_yield / exit_yield  (columnas «Entry Yield» / «Exit Yield»)
--   · credito_total             (columna «Credito Total»)
-- El gemelo manual (scripts/supabase/replace_proyectos.sql) sí las insertaba, así
-- que el comportamiento dependía de por dónde se hubiera aplicado. Resultado en
-- producción: las gráficas «Yield entrada vs Yield salida» y «Crédito» del
-- dashboard salían vacías porque las tres columnas quedaban a NULL en cada carga.
--
-- Además se añade fecha_fin, que nunca ha existido en la tabla pese a que la hoja
-- «Tabla madre» trae la columna EndQuarter. Sin ella no se puede proyectar el
-- vencimiento del pipeline.
--
-- Migración ADITIVA e idempotente: no borra datos ni recrea la tabla. Las cuatro
-- columnas se rellenan en la SIGUIENTE carga del maestro, no retroactivamente.
-- Rollback: volver a ejecutar el cuerpo de 20260715130000_018_replace_proyectos_rpc.sql.

ALTER TABLE public.proyectos ADD COLUMN IF NOT EXISTS fecha_fin date;

COMMENT ON COLUMN public.proyectos.fecha_fin IS
  'Fin del proyecto, de la columna EndQuarter del maestro (último día del trimestre). '
  'Nullable: si falta, la fecha de fin efectiva se estima como fecha_inicio + holding_period meses.';

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
    entry_yield,
    exit_yield,
    credito_total,
    holding_period,
    superficie_edificable,
    es_ultima_fila,
    fecha_inicio,
    fecha_fin
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
    NULLIF(trim(elem->>'fecha_inicio'), '')::date,
    NULLIF(trim(elem->>'fecha_fin'), '')::date
  FROM jsonb_array_elements(p_rows) AS elem;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_proyectos(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_proyectos(jsonb) TO service_role;

-- Recarga la caché de esquema de PostgREST para exponer la RPC al instante.
NOTIFY pgrst, 'reload schema';
