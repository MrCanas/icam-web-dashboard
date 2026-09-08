-- Corporativo 038 — el maestro corporativo entra en el portal.
--
-- Hasta ahora el portal solo contaba cómo van los ACTIVOS (tabla `proyectos`, zona
-- financiero) y su ejecución (zona pm). Cómo va el GRUPO —facturación, EBITDA,
-- márgenes, capital bajo gestión, caja y cuentas depositadas de GIIC, ICI e ICAM—
-- vivía únicamente en 20260810_MAESTRO_CORPORATIVO.xlsx, en la misma carpeta de
-- SharePoint que el maestro de vehículos.
--
-- Esta migración crea el destino de ese fichero y la zona que lo protege.
--
-- ADITIVA: no borra ninguna fila ni ninguna tabla existente. Lo único que toca de
-- lo ya existente son los `sort_order` de app_zone (para colocar la pestaña nueva
-- en segunda posición) y una columna nueva en upload_logs. Idempotente.

-- =============================================================================
-- 1. corp_periodos — una fila por fila de la hoja DATOS del maestro
-- =============================================================================
-- Formato largo: TRIMESTRE, AÑO y ACUMULADO conviven en la misma tabla, igual que
-- en el Excel. Quien consulte tiene que filtrar SIEMPRE por tipo_periodo antes de
-- sumar; mezclarlos duplica cifras (aviso 6 de la hoja NOTAS del maestro).
--
-- Los CHECK están para que un maestro mal formado reviente en la carga, con un
-- error que nombra la columna, en vez de vaciar media gráfica sin decir nada.

CREATE TABLE IF NOT EXISTS public.corp_periodos (
  -- Clave del propio Excel: «GIIC|20211T», «GRUPO|2025», «GIIC|ALLTIME».
  id                                text PRIMARY KEY,

  -- Dimensiones
  sociedad                          text     NOT NULL,
  perimetro                         text,
  es_ultima_fila                    smallint NOT NULL DEFAULT 0,
  periodo                           text     NOT NULL,
  tipo_periodo                      text     NOT NULL,
  anio                              integer,
  trimestre                         smallint,
  fecha_inicio                      date,
  fecha_fin                         date,
  meses                             smallint,
  naturaleza                        text     NOT NULL,

  -- Cuenta de resultados de gestión (cash flow de cada sociedad)
  facturacion                       double precision,
  gastos_totales                    double precision,
  gastos_variables                  double precision,
  gastos_estructura                 double precision,
  ebitda                            double precision,
  margen_ebitda_pct                 double precision,
  gastos_sobre_facturacion_pct      double precision,
  ebitda_caja                       double precision,
  ajuste_periodificacion            double precision,
  facturacion_acumulada_anio        double precision,
  var_facturacion_interanual_pct    double precision,

  -- Saldos a una fecha (STOCK: no se suman entre periodos, aviso 4 de NOTAS)
  saldo_caja_cierre                 double precision,
  saldo_banco_cierre                double precision,
  capital_bajo_gestion              double precision,
  aum_regulado_icam                 double precision,
  aum_no_regulado_ici               double precision,
  n_vehiculos                       double precision,
  fee_sobre_aum_pct                 double precision,
  facturacion_por_vehiculo          double precision,

  -- Desglose por sociedad dentro de las filas agregadas
  facturacion_icam                  double precision,
  facturacion_ici                   double precision,
  facturacion_giic                  double precision,
  ebitda_icam                       double precision,
  ebitda_ici                        double precision,
  ebitda_giic                       double precision,
  peso_sobre_facturacion_grupo_pct  double precision,

  -- Cuentas oficiales depositadas de GIIC — solo en filas de tipo AÑO
  cifra_negocio_cuentas             double precision,
  resultado_explotacion_cuentas     double precision,
  resultado_ejercicio_cuentas       double precision,
  total_activo                      double precision,
  patrimonio_neto                   double precision,
  efectivo_balance                  double precision,

  -- Solo en la fila ACUMULADO de GIIC
  volumen_intermediado              double precision,
  n_proyectos_giic                  double precision,

  CONSTRAINT corp_periodos_sociedad_check
    CHECK (sociedad IN ('GIIC', 'ICI+ICAM', 'GRUPO')),
  CONSTRAINT corp_periodos_tipo_periodo_check
    CHECK (tipo_periodo IN ('TRIMESTRE', 'AÑO', 'ACUMULADO')),
  CONSTRAINT corp_periodos_naturaleza_check
    CHECK (naturaleza IN ('REAL', 'PREVISIÓN', 'MIXTO'))
);

CREATE INDEX IF NOT EXISTS corp_periodos_sociedad_tipo_idx
  ON public.corp_periodos (sociedad, tipo_periodo);
CREATE INDEX IF NOT EXISTS corp_periodos_anio_trimestre_idx
  ON public.corp_periodos (anio, trimestre);
CREATE INDEX IF NOT EXISTS corp_periodos_ultima_fila_idx
  ON public.corp_periodos (es_ultima_fila);

COMMENT ON TABLE public.corp_periodos IS
  'Maestro corporativo (hoja DATOS de 20260810_MAESTRO_CORPORATIVO.xlsx). Formato largo: '
  'TRIMESTRE, AÑO y ACUMULADO conviven. Filtrar por tipo_periodo antes de sumar.';
COMMENT ON COLUMN public.corp_periodos.es_ultima_fila IS
  '1 marca el último trimestre con datos REALES de esa sociedad. Es el ancla de los KPI de cabecera.';
COMMENT ON COLUMN public.corp_periodos.naturaleza IS
  'REAL hasta 2026 2T · PREVISIÓN a partir de 2026 3T · MIXTO en años y acumulados que mezclan ambos.';
COMMENT ON COLUMN public.corp_periodos.ebitda IS
  'EBITDA tal y como lo define el CF de cada sociedad (cifra oficial de gestión). Difiere de '
  'ebitda_caja por la periodificación de comisiones de funding; ajuste_periodificacion la deja a la vista.';
COMMENT ON COLUMN public.corp_periodos.capital_bajo_gestion IS
  'AUM a cierre. STOCK: no se suma entre periodos; en filas de año/acumulado es el valor del último trimestre.';

-- =============================================================================
-- 2. corp_diccionario y corp_notas — las hojas DICCIONARIO y NOTAS del maestro
-- =============================================================================
-- Se cargan con los datos en vez de copiarse al código para que la metodología que
-- ve el usuario en el tab sea siempre la del fichero vigente. Copiada al código,
-- envejece en silencio en cuanto alguien edita el Excel.

CREATE TABLE IF NOT EXISTS public.corp_diccionario (
  campo       text PRIMARY KEY,
  unidad      text,
  descripcion text,
  orden       integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.corp_notas (
  id      text PRIMARY KEY,
  seccion text    NOT NULL,
  orden   integer NOT NULL DEFAULT 0,
  titulo  text,
  texto   text
);

COMMENT ON TABLE public.corp_diccionario IS
  'Hoja DICCIONARIO del maestro corporativo: qué es cada campo y de dónde sale.';
COMMENT ON TABLE public.corp_notas IS
  'Hoja NOTAS del maestro corporativo: origen de los datos y avisos metodológicos.';

-- =============================================================================
-- 3. RLS — estas tres tablas NO se publican a la sesión del navegador
-- =============================================================================
-- El resto de tablas de negocio llevan `<tabla>_auth_read TO authenticated` desde
-- la 030. Aquí no: son la cuenta de resultados del grupo, y el tab se sirve entero
-- desde Server Components con service role (que salta RLS). Sin política de
-- SELECT, ni `anon` ni `authenticated` las leen aunque alguien apunte PostgREST
-- directamente. Mismo criterio que audit_log y upload_logs en la 030 §4.

ALTER TABLE public.corp_periodos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corp_diccionario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corp_notas       ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.corp_periodos    TO service_role;
GRANT ALL ON public.corp_diccionario TO service_role;
GRANT ALL ON public.corp_notas       TO service_role;

-- =============================================================================
-- 4. RPC de reemplazo — mismo patrón que replace_proyectos (018/034)
-- =============================================================================
-- Reemplazo total del snapshot, atómico por estar dentro de una función. Es lo
-- correcto aquí: el Excel es la única fuente y nadie edita estas filas en la app,
-- así que no hay trabajo de usuario que un DELETE pueda tirar por la borda.

CREATE OR REPLACE FUNCTION public.replace_corp_periodos(p_rows jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM corp_periodos WHERE true;

  INSERT INTO corp_periodos (
    id, sociedad, perimetro, es_ultima_fila, periodo, tipo_periodo, anio, trimestre,
    fecha_inicio, fecha_fin, meses, naturaleza,
    facturacion, gastos_totales, gastos_variables, gastos_estructura, ebitda,
    margen_ebitda_pct, gastos_sobre_facturacion_pct, ebitda_caja, ajuste_periodificacion,
    facturacion_acumulada_anio, var_facturacion_interanual_pct,
    saldo_caja_cierre, saldo_banco_cierre, capital_bajo_gestion,
    aum_regulado_icam, aum_no_regulado_ici, n_vehiculos, fee_sobre_aum_pct,
    facturacion_por_vehiculo,
    facturacion_icam, facturacion_ici, facturacion_giic,
    ebitda_icam, ebitda_ici, ebitda_giic, peso_sobre_facturacion_grupo_pct,
    cifra_negocio_cuentas, resultado_explotacion_cuentas, resultado_ejercicio_cuentas,
    total_activo, patrimonio_neto, efectivo_balance,
    volumen_intermediado, n_proyectos_giic
  )
  SELECT
    (elem->>'id')::text,
    (elem->>'sociedad')::text,
    NULLIF(trim(elem->>'perimetro'), '')::text,
    COALESCE(NULLIF(trim(elem->>'es_ultima_fila'), '')::smallint, 0),
    (elem->>'periodo')::text,
    (elem->>'tipo_periodo')::text,
    NULLIF(trim(elem->>'anio'), '')::integer,
    NULLIF(trim(elem->>'trimestre'), '')::smallint,
    NULLIF(trim(elem->>'fecha_inicio'), '')::date,
    NULLIF(trim(elem->>'fecha_fin'), '')::date,
    NULLIF(trim(elem->>'meses'), '')::smallint,
    (elem->>'naturaleza')::text,
    NULLIF(trim(elem->>'facturacion'), '')::double precision,
    NULLIF(trim(elem->>'gastos_totales'), '')::double precision,
    NULLIF(trim(elem->>'gastos_variables'), '')::double precision,
    NULLIF(trim(elem->>'gastos_estructura'), '')::double precision,
    NULLIF(trim(elem->>'ebitda'), '')::double precision,
    NULLIF(trim(elem->>'margen_ebitda_pct'), '')::double precision,
    NULLIF(trim(elem->>'gastos_sobre_facturacion_pct'), '')::double precision,
    NULLIF(trim(elem->>'ebitda_caja'), '')::double precision,
    NULLIF(trim(elem->>'ajuste_periodificacion'), '')::double precision,
    NULLIF(trim(elem->>'facturacion_acumulada_anio'), '')::double precision,
    NULLIF(trim(elem->>'var_facturacion_interanual_pct'), '')::double precision,
    NULLIF(trim(elem->>'saldo_caja_cierre'), '')::double precision,
    NULLIF(trim(elem->>'saldo_banco_cierre'), '')::double precision,
    NULLIF(trim(elem->>'capital_bajo_gestion'), '')::double precision,
    NULLIF(trim(elem->>'aum_regulado_icam'), '')::double precision,
    NULLIF(trim(elem->>'aum_no_regulado_ici'), '')::double precision,
    NULLIF(trim(elem->>'n_vehiculos'), '')::double precision,
    NULLIF(trim(elem->>'fee_sobre_aum_pct'), '')::double precision,
    NULLIF(trim(elem->>'facturacion_por_vehiculo'), '')::double precision,
    NULLIF(trim(elem->>'facturacion_icam'), '')::double precision,
    NULLIF(trim(elem->>'facturacion_ici'), '')::double precision,
    NULLIF(trim(elem->>'facturacion_giic'), '')::double precision,
    NULLIF(trim(elem->>'ebitda_icam'), '')::double precision,
    NULLIF(trim(elem->>'ebitda_ici'), '')::double precision,
    NULLIF(trim(elem->>'ebitda_giic'), '')::double precision,
    NULLIF(trim(elem->>'peso_sobre_facturacion_grupo_pct'), '')::double precision,
    NULLIF(trim(elem->>'cifra_negocio_cuentas'), '')::double precision,
    NULLIF(trim(elem->>'resultado_explotacion_cuentas'), '')::double precision,
    NULLIF(trim(elem->>'resultado_ejercicio_cuentas'), '')::double precision,
    NULLIF(trim(elem->>'total_activo'), '')::double precision,
    NULLIF(trim(elem->>'patrimonio_neto'), '')::double precision,
    NULLIF(trim(elem->>'efectivo_balance'), '')::double precision,
    NULLIF(trim(elem->>'volumen_intermediado'), '')::double precision,
    NULLIF(trim(elem->>'n_proyectos_giic'), '')::double precision
  FROM jsonb_array_elements(p_rows) AS elem;
END;
$$;

CREATE OR REPLACE FUNCTION public.replace_corp_diccionario(p_rows jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM corp_diccionario WHERE true;
  INSERT INTO corp_diccionario (campo, unidad, descripcion, orden)
  SELECT
    (elem->>'campo')::text,
    NULLIF(trim(elem->>'unidad'), '')::text,
    NULLIF(trim(elem->>'descripcion'), '')::text,
    COALESCE(NULLIF(trim(elem->>'orden'), '')::integer, 0)
  FROM jsonb_array_elements(p_rows) AS elem;
END;
$$;

CREATE OR REPLACE FUNCTION public.replace_corp_notas(p_rows jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM corp_notas WHERE true;
  INSERT INTO corp_notas (id, seccion, orden, titulo, texto)
  SELECT
    (elem->>'id')::text,
    (elem->>'seccion')::text,
    COALESCE(NULLIF(trim(elem->>'orden'), '')::integer, 0),
    NULLIF(trim(elem->>'titulo'), '')::text,
    NULLIF(trim(elem->>'texto'), '')::text
  FROM jsonb_array_elements(p_rows) AS elem;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_corp_periodos(jsonb)    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_corp_diccionario(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_corp_notas(jsonb)       FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_corp_periodos(jsonb)    TO service_role;
GRANT EXECUTE ON FUNCTION public.replace_corp_diccionario(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.replace_corp_notas(jsonb)       TO service_role;

-- =============================================================================
-- 5. Zona nueva del portal
-- =============================================================================
-- «Corporativas» va en segunda posición, justo detrás de Financiero, porque es la
-- otra mitad de la foto económica. ZONE_ORDER en src/registry/modules.ts tiene que
-- quedar alineado con estos sort_order.
--
-- No se concede el rol a nadie aquí: eso va por `npm run auth:grant`, igual que en
-- las demás zonas. Hasta que alguien lo tenga, la pestaña no le aparece a nadie —
-- que es lo que se quiere para la cuenta de resultados del grupo.

INSERT INTO public.app_zone (key, label, sort_order)
VALUES ('corporativo', 'Corporativas', 2)
ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order;

UPDATE public.app_zone SET sort_order = 3 WHERE key = 'pm';
UPDATE public.app_zone SET sort_order = 4 WHERE key = 'adquisiciones';
UPDATE public.app_zone SET sort_order = 5 WHERE key = 'data';

-- =============================================================================
-- 6. upload_logs: de qué sincronización viene cada línea
-- =============================================================================
-- Sin esto los dos crones escriben en el mismo sitio sin distinguirse, y el banner
-- de la pestaña Datos daría por caído el portfolio cuando lo que falló fue el
-- corporativo. NULL = 'portfolio' (todas las filas existentes).

ALTER TABLE public.upload_logs ADD COLUMN IF NOT EXISTS fuente text;

COMMENT ON COLUMN public.upload_logs.fuente IS
  'Sincronización que escribió la línea: portfolio | corporativo. NULL = portfolio (filas anteriores a la 038).';

-- Recarga la caché de esquema de PostgREST para exponer tablas y RPC al instante.
NOTIFY pgrst, 'reload schema';
