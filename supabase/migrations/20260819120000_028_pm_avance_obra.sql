-- PM 028 — Avance de obra por promoción (fuente: Zoho CRM).
--
-- Planificación responde «cuándo» (fechas de hito); no responde «cuánto llevamos
-- construido». Ese dato vive en el módulo Promociones de Zoho y hasta ahora solo
-- se consultaba exportándolo a Excel (KPI_AvanceProyectos_Promociones.xlsx:
-- «Avance general» + 6 fases de obra por promoción).
--
-- Tres cosas que este esquema respeta a propósito:
--
--   1. NULL ≠ 0. En el export conviven celdas vacías (Zoho no tiene valor) y
--      ceros reportados. GA91 trae las 6 fases vacías; DC15 las trae a 0. Si se
--      colapsan, el día que se comunique a Zoho se sobrescriben campos vacíos
--      con ceros. Toda comparación usa IS DISTINCT FROM.
--
--   2. «Avance general» lo calcula Zoho y NO es la media de las fases: SE84 va
--      al 1,35 % general con «Actuaciones previas» al 45,38 %; PS7 al 0 % con la
--      estructura al 75 %. Aquí no se recalcula nada, se guarda como una fase más.
--
--   3. Los códigos no coinciden entre sistemas. Zoho usa T123/FC149 donde el
--      maestro financiero usa TO123/FU149, y PM usa DC-15 donde Zoho usa DC15.
--      El emparejamiento activo↔promoción es DATO (pm_activo_promocion_map), y
--      lo completa la PMO a mano igual que pm_activo_proyecto_map.
--
-- CONTRATO CON ZOHO: aquí NO se envía nada. Las ediciones de la app quedan en
-- pm_avance_zoho_outbox y solo salen de ahí por decisión humana explícita.
--
-- ADITIVA: 6 tablas y 2 funciones nuevas. No toca ninguna tabla existente y
-- aquí nunca se borra: el histórico es la serie temporal del futuro gráfico de
-- evolución y la bandeja de salida es el registro de lo comunicado (o no).

-- =============================================================================
-- 1. Catálogo de fases
-- =============================================================================
-- Vocabulario cerrado, espejo de pm_hito_catalogo. El «Avance general» entra
-- como fase (es_general) para no duplicar la mecánica de edición e histórico.

CREATE TABLE IF NOT EXISTS public.pm_avance_fase_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  orden int NOT NULL DEFAULT 0,
  es_general boolean NOT NULL DEFAULT false,
  zoho_columna text,
  zoho_api_name text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pm_avance_fase_catalogo IS
  'PM: fases de obra del módulo Promociones de Zoho. Vocabulario fijo; se siembra en esta migración.';
COMMENT ON COLUMN public.pm_avance_fase_catalogo.es_general IS
  'true SOLO en «Avance general». Zoho lo calcula por su cuenta y no es la media de las fases; nunca se recalcula aquí.';
COMMENT ON COLUMN public.pm_avance_fase_catalogo.zoho_columna IS
  'Cabecera literal de la columna en el export de Zoho. Es la que se emite al exportar cambios para una actualización masiva.';
COMMENT ON COLUMN public.pm_avance_fase_catalogo.zoho_api_name IS
  'Nombre API del campo en Zoho CRM. NULL hoy: no hay integración ni credenciales. Es la costura — sin él no se puede escribir por API, y la exportación JSON lo señala en vez de inventárselo.';

INSERT INTO public.pm_avance_fase_catalogo (nombre, orden, es_general, zoho_columna)
VALUES
  ('Avance general',                               0, true,  'Avance general'),
  ('Actuaciones previas y demoliciones',           1, false, 'Actuaciones previas y demoliciones'),
  ('Movimiento tierras, cimentación y estructura', 2, false, 'Movimiento tierras, cimentación y estructura'),
  ('Instalaciones',                                3, false, 'Instalaciones'),
  ('Obra gris',                                    4, false, 'Obra gris'),
  ('Acabados',                                     5, false, 'Acabados'),
  ('Recuperación elementos protegidos',            6, false, 'Recuperación elementos protegidos')
ON CONFLICT (nombre) DO NOTHING;

-- =============================================================================
-- 2. Promociones de Zoho
-- =============================================================================
-- Las 30 filas del export, no solo las que casan con un activo de PM: el
-- desplegable de emparejamiento necesita la lista completa.

CREATE TABLE IF NOT EXISTS public.pm_promociones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zoho_record_id text NOT NULL UNIQUE,
  zoho_analytics_id text,
  codigo_promocion text NOT NULL UNIQUE,
  nombre text,
  owner_zoho_id text,
  situacion text,
  fuente_archivo text,
  importado_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pm_promociones IS
  'PM: promociones del módulo Promociones de Zoho CRM. Origen: export KPI_AvanceProyectos_Promociones.';
COMMENT ON COLUMN public.pm_promociones.zoho_record_id IS
  'Id del registro en Zoho CRM: la parte numérica. Es la clave para actualizarlo por API.';
COMMENT ON COLUMN public.pm_promociones.zoho_analytics_id IS
  'El mismo id tal cual lo escribe Zoho Analytics, con prefijo «zcrm_». Se guarda crudo para poder reimportar el CSV en Analytics sin volver a adivinar el formato.';
COMMENT ON COLUMN public.pm_promociones.codigo_promocion IS
  'Código de Promoción de Zoho (GA91, DC15, SE84…). No coincide con pm_activos.id_activo ni con proyectos.proyecto: son tres nomenclaturas distintas por diseño.';
COMMENT ON COLUMN public.pm_promociones.situacion IS
  'Situación literal de Zoho («En Marcha», «Culminado»). SIN CHECK a propósito: Zoho puede añadir estados y un CHECK rompería la siguiente importación.';

-- =============================================================================
-- 3. Emparejamiento activo de PM ↔ promoción de Zoho
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.pm_activo_promocion_map (
  pm_activo_id uuid PRIMARY KEY REFERENCES public.pm_activos (id) ON DELETE CASCADE,
  promocion_id uuid NOT NULL REFERENCES public.pm_promociones (id) ON DELETE RESTRICT,
  origen text NOT NULL DEFAULT 'manual' CHECK (origen IN ('auto', 'manual')),
  mapeado_por text,
  mapeado_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pm_activo_promocion_map IS
  'PM: qué promoción de Zoho corresponde a cada activo. Sin UNIQUE en promocion_id a propósito: PM separa PC25 en dos activos por uso y podrían compartir promoción (igual que pm_activo_proyecto_map desde la 020).';
COMMENT ON COLUMN public.pm_activo_promocion_map.origen IS
  'auto = sembrado por el script de carga desde una lista de pares escrita a mano (4 casos). manual = lo decidió la PMO en /dashboard/pm/proyectos. En runtime NO se infiere ningún emparejamiento.';

CREATE INDEX IF NOT EXISTS idx_pm_activo_promocion_map_promocion
  ON public.pm_activo_promocion_map (promocion_id);

-- =============================================================================
-- 4. Avance vigente
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.pm_avance_obra (
  promocion_id uuid NOT NULL REFERENCES public.pm_promociones (id) ON DELETE CASCADE,
  fase_id uuid NOT NULL REFERENCES public.pm_avance_fase_catalogo (id) ON DELETE RESTRICT,
  porcentaje numeric(5,2) CHECK (porcentaje >= 0 AND porcentaje <= 100),
  porcentaje_zoho numeric(5,2) CHECK (porcentaje_zoho >= 0 AND porcentaje_zoho <= 100),
  origen text NOT NULL DEFAULT 'zoho_import' CHECK (origen IN ('zoho_import', 'app')),
  actualizado_por text,
  actualizado_por_email text,
  actualizado_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (promocion_id, fase_id)
);

COMMENT ON TABLE public.pm_avance_obra IS
  'PM: porcentaje vigente de cada fase de obra por promoción, incluido el «Avance general».';
COMMENT ON COLUMN public.pm_avance_obra.porcentaje IS
  'Valor vigente en el portal. NULL = sin dato; 0 = medido y a cero. El export trae ambos casos y no deben confundirse.';
COMMENT ON COLUMN public.pm_avance_obra.porcentaje_zoho IS
  'Última lectura importada de Zoho: la línea base. Sin ella, tras dos ediciones la bandeja de salida diría «45 → 60» cuando Zoho sigue en 45,38. porcentaje ≠ porcentaje_zoho es exactamente «pendiente de comunicar».';
COMMENT ON COLUMN public.pm_avance_obra.origen IS
  'zoho_import = el valor vigente es el importado; app = lo editó la PMO. Una reimportación NO pisa las filas con origen=app: solo refresca porcentaje_zoho.';

-- =============================================================================
-- 5. Histórico (append-only)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.pm_avance_obra_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promocion_id uuid NOT NULL REFERENCES public.pm_promociones (id) ON DELETE CASCADE,
  fase_id uuid NOT NULL REFERENCES public.pm_avance_fase_catalogo (id) ON DELETE RESTRICT,
  porcentaje_anterior numeric(5,2),
  porcentaje_nuevo numeric(5,2),
  origen text NOT NULL CHECK (origen IN ('zoho_import', 'app')),
  cambiado_por text,
  cambiado_por_email text,
  cambiado_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pm_avance_obra_historico IS
  'PM: una fila por cambio de porcentaje. Append-only, nunca se borra: es la serie temporal con la que se pintará la evolución del avance.';

CREATE INDEX IF NOT EXISTS idx_pm_avance_historico_promocion
  ON public.pm_avance_obra_historico (promocion_id, cambiado_at DESC);

-- =============================================================================
-- 6. Bandeja de salida hacia Zoho
-- =============================================================================
-- Es ESTADO DESEADO por (promoción, fase), no un log: el log ya es el histórico.
-- Así tres ediciones seguidas de la misma celda colapsan en una sola fila que
-- aprobar, y volver al valor de Zoho borra la fila en vez de encolar un no-op.

CREATE TABLE IF NOT EXISTS public.pm_avance_zoho_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promocion_id uuid NOT NULL REFERENCES public.pm_promociones (id) ON DELETE CASCADE,
  fase_id uuid NOT NULL REFERENCES public.pm_avance_fase_catalogo (id) ON DELETE RESTRICT,
  porcentaje_zoho numeric(5,2),
  porcentaje_nuevo numeric(5,2),
  estado text NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'aprobado', 'exportado', 'enviado', 'descartado')),
  creado_por text,
  creado_por_email text,
  creado_at timestamptz NOT NULL DEFAULT now(),
  aprobado_por text,
  aprobado_por_email text,
  aprobado_at timestamptz,
  exportado_at timestamptz,
  enviado_at timestamptz,
  motivo text,
  error text
);

COMMENT ON TABLE public.pm_avance_zoho_outbox IS
  'PM: cambios de avance pendientes de comunicar a Zoho. NADA SE ENVÍA AUTOMÁTICAMENTE: aprobar es un acto humano explícito y sin aprobación la fila se queda en pendiente indefinidamente.';
COMMENT ON COLUMN public.pm_avance_zoho_outbox.estado IS
  'pendiente → aprobado → exportado (CSV/JSON descargado y subido a mano). «enviado» lo reserva el futuro cliente de API y hoy no lo escribe nadie. descartado = se decide no comunicarlo, sin revertir la edición.';
COMMENT ON COLUMN public.pm_avance_zoho_outbox.porcentaje_zoho IS
  'Lo que Zoho tenía cuando se propuso el cambio. Se refresca si llega una reimportación mientras la fila sigue pendiente, para que el diff mostrado nunca mienta.';
COMMENT ON COLUMN public.pm_avance_zoho_outbox.motivo IS
  'Por qué se descartó. Lo rellena la reimportación cuando Zoho ya trae el valor propuesto.';

-- Como mucho un cambio pendiente por (promoción, fase): es el que colapsa.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pm_avance_outbox_pendiente
  ON public.pm_avance_zoho_outbox (promocion_id, fase_id)
  WHERE estado = 'pendiente';

CREATE INDEX IF NOT EXISTS idx_pm_avance_outbox_estado
  ON public.pm_avance_zoho_outbox (estado)
  WHERE estado IN ('pendiente', 'aprobado');

-- =============================================================================
-- 7. RPC: editar un porcentaje desde la app
-- =============================================================================
-- Son tres escrituras que no pueden quedar a medias (vigente + histórico +
-- bandeja de salida) y tres round-trips desde Vercel que sí importan: el propio
-- writeClient.ts documenta que la latencia es crítica. Hay precedente de RPC
-- (replace_pm_portfolio, replace_proyectos, anadir_pm_snapshot).
--
-- SECURITY INVOKER a propósito: las tablas pm_* solo tienen policy de SELECT, así
-- que un SECURITY DEFINER regalaría escritura a quien pudiera invocar la función.
-- Solo service_role la ejecuta, y service_role ya salta RLS por sí mismo.

CREATE OR REPLACE FUNCTION public.pm_avance_registrar_cambio(
  p_promocion_id uuid,
  p_fase_id uuid,
  p_porcentaje numeric,
  p_usuario_id text DEFAULT NULL,
  p_usuario_email text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_actual numeric(5,2);
  v_zoho numeric(5,2);
  v_existe boolean := false;
  v_nuevo numeric(5,2) := p_porcentaje;
  v_pendiente boolean := false;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pm_avance_fase_catalogo WHERE id = p_fase_id) THEN
    RAISE EXCEPTION 'fase inexistente: %', p_fase_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pm_promociones WHERE id = p_promocion_id) THEN
    RAISE EXCEPTION 'promoción inexistente: %', p_promocion_id;
  END IF;

  SELECT porcentaje, porcentaje_zoho
    INTO v_actual, v_zoho
    FROM pm_avance_obra
   WHERE promocion_id = p_promocion_id AND fase_id = p_fase_id;
  -- Con FOUND, no metiendo `true` en el INTO: cuando SELECT INTO no encuentra
  -- fila deja TODOS los destinos en NULL, y `IF v_existe` con NULL no es false,
  -- es desconocido — la rama no se ejecuta y el fallo pasa desapercibido.
  v_existe := FOUND;

  -- Guardar el mismo valor no escribe nada. El editor dispara al salir del
  -- input, así que este caso ocurre constantemente.
  IF v_existe AND v_actual IS NOT DISTINCT FROM v_nuevo THEN
    RETURN jsonb_build_object('cambiado', false, 'porcentaje', v_nuevo,
                              'porcentajeZoho', v_zoho, 'pendiente', v_nuevo IS DISTINCT FROM v_zoho);
  END IF;

  INSERT INTO pm_avance_obra
    (promocion_id, fase_id, porcentaje, porcentaje_zoho, origen,
     actualizado_por, actualizado_por_email, actualizado_at)
  VALUES
    (p_promocion_id, p_fase_id, v_nuevo, v_zoho, 'app',
     p_usuario_id, p_usuario_email, now())
  ON CONFLICT (promocion_id, fase_id) DO UPDATE SET
    porcentaje = EXCLUDED.porcentaje,
    origen = 'app',
    actualizado_por = EXCLUDED.actualizado_por,
    actualizado_por_email = EXCLUDED.actualizado_por_email,
    actualizado_at = now();

  INSERT INTO pm_avance_obra_historico
    (promocion_id, fase_id, porcentaje_anterior, porcentaje_nuevo, origen,
     cambiado_por, cambiado_por_email)
  VALUES
    (p_promocion_id, p_fase_id, v_actual, v_nuevo, 'app',
     p_usuario_id, p_usuario_email);

  IF v_nuevo IS NOT DISTINCT FROM v_zoho THEN
    -- Vuelta al valor que Zoho ya tiene: no hay nada que comunicar.
    DELETE FROM pm_avance_zoho_outbox
     WHERE promocion_id = p_promocion_id AND fase_id = p_fase_id AND estado = 'pendiente';
  ELSE
    INSERT INTO pm_avance_zoho_outbox
      (promocion_id, fase_id, porcentaje_zoho, porcentaje_nuevo, estado,
       creado_por, creado_por_email)
    VALUES
      (p_promocion_id, p_fase_id, v_zoho, v_nuevo, 'pendiente',
       p_usuario_id, p_usuario_email)
    ON CONFLICT (promocion_id, fase_id) WHERE estado = 'pendiente' DO UPDATE SET
      porcentaje_nuevo = EXCLUDED.porcentaje_nuevo,
      creado_por = EXCLUDED.creado_por,
      creado_por_email = EXCLUDED.creado_por_email,
      creado_at = now();
    v_pendiente := true;
  END IF;

  RETURN jsonb_build_object('cambiado', true, 'porcentaje', v_nuevo,
                            'porcentajeZoho', v_zoho, 'pendiente', v_pendiente);
END;
$fn$;

COMMENT ON FUNCTION public.pm_avance_registrar_cambio IS
  'PM: edición de un porcentaje desde el portal (vigente + histórico + bandeja de salida) en una sola transacción. No envía nada a Zoho.';

-- =============================================================================
-- 8. RPC: importar un valor desde el export de Zoho
-- =============================================================================
-- La regla que impide que reimportar el Excel borre el trabajo de la PMO:
-- porcentaje_zoho se refresca SIEMPRE; porcentaje solo si el vigente venía del
-- propio Zoho. Y si Zoho ya trae el valor que la PMO había propuesto, el cambio
-- pendiente se cierra como descartado en vez de quedarse encallado.

CREATE OR REPLACE FUNCTION public.pm_avance_importar_zoho(
  p_promocion_id uuid,
  p_fase_id uuid,
  p_porcentaje numeric
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_actual numeric(5,2);
  v_zoho numeric(5,2);
  v_origen text;
  v_existe boolean := false;
  v_nuevo numeric(5,2) := p_porcentaje;
  v_pisa boolean;
  v_historico boolean := false;
BEGIN
  SELECT porcentaje, porcentaje_zoho, origen
    INTO v_actual, v_zoho, v_origen
    FROM pm_avance_obra
   WHERE promocion_id = p_promocion_id AND fase_id = p_fase_id;
  v_existe := FOUND;   -- ver la nota de pm_avance_registrar_cambio

  v_pisa := (NOT v_existe) OR v_origen = 'zoho_import';

  INSERT INTO pm_avance_obra
    (promocion_id, fase_id, porcentaje, porcentaje_zoho, origen, actualizado_at)
  VALUES
    (p_promocion_id, p_fase_id, v_nuevo, v_nuevo, 'zoho_import', now())
  ON CONFLICT (promocion_id, fase_id) DO UPDATE SET
    porcentaje_zoho = EXCLUDED.porcentaje_zoho,
    porcentaje = CASE WHEN pm_avance_obra.origen = 'zoho_import'
                      THEN EXCLUDED.porcentaje ELSE pm_avance_obra.porcentaje END,
    actualizado_at = CASE WHEN pm_avance_obra.origen = 'zoho_import'
                      THEN now() ELSE pm_avance_obra.actualizado_at END;

  -- Histórico solo cuando el valor vigente cambia de verdad. Un valor que nace
  -- (no existía la fila) también es un cambio: viene de la nada.
  IF v_pisa AND (NOT v_existe OR v_actual IS DISTINCT FROM v_nuevo)
     AND NOT (NOT v_existe AND v_nuevo IS NULL) THEN
    INSERT INTO pm_avance_obra_historico
      (promocion_id, fase_id, porcentaje_anterior, porcentaje_nuevo, origen, cambiado_por_email)
    VALUES
      (p_promocion_id, p_fase_id, v_actual, v_nuevo, 'zoho_import', 'import');
    v_historico := true;
  END IF;

  -- Un cambio pendiente que Zoho ya trae deja de tener sentido.
  UPDATE pm_avance_zoho_outbox
     SET estado = 'descartado',
         motivo = 'Zoho ya trae este valor (reimportación)',
         porcentaje_zoho = v_nuevo
   WHERE promocion_id = p_promocion_id AND fase_id = p_fase_id
     AND estado = 'pendiente'
     AND porcentaje_nuevo IS NOT DISTINCT FROM v_nuevo;

  -- El resto de pendientes se quedan, pero con la línea base actualizada para
  -- que el diff que ve la PMO sea el real.
  UPDATE pm_avance_zoho_outbox
     SET porcentaje_zoho = v_nuevo
   WHERE promocion_id = p_promocion_id AND fase_id = p_fase_id
     AND estado = 'pendiente';

  RETURN jsonb_build_object('pisado', v_pisa, 'historico', v_historico, 'porcentajeZoho', v_nuevo);
END;
$fn$;

COMMENT ON FUNCTION public.pm_avance_importar_zoho IS
  'PM: carga un valor del export de Zoho sin pisar las ediciones de la PMO (solo actualiza porcentaje si el vigente venía de Zoho). Idempotente.';

REVOKE ALL ON FUNCTION public.pm_avance_registrar_cambio(uuid, uuid, numeric, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pm_avance_importar_zoho(uuid, uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_avance_registrar_cambio(uuid, uuid, numeric, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.pm_avance_importar_zoho(uuid, uuid, numeric) TO service_role;

-- =============================================================================
-- 9. RLS — lectura pública, escritura solo por service role (como el resto)
-- =============================================================================

ALTER TABLE public.pm_avance_fase_catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_promociones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_activo_promocion_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_avance_obra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_avance_obra_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_avance_zoho_outbox ENABLE ROW LEVEL SECURITY;

DO $policies$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'pm_avance_fase_catalogo',
    'pm_promociones',
    'pm_activo_promocion_map',
    'pm_avance_obra',
    'pm_avance_obra_historico',
    'pm_avance_zoho_outbox'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t AND policyname = t || '_public_read'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO public USING (true)',
        t || '_public_read', t);
    END IF;
  END LOOP;
END $policies$;

NOTIFY pgrst, 'reload schema';
