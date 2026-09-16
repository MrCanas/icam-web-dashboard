-- Inversores 040 — quién ha puesto el dinero entra en el portal.
--
-- Hasta ahora el portal contaba cómo van los ACTIVOS (`proyectos`), cómo va el
-- GRUPO (`corp_periodos`) y cómo va la EJECUCIÓN (zona pm). Quién ha puesto el
-- dinero, cuánto, en qué promoción y con qué flujos vivía solo en Zoho CRM,
-- repartido en cinco módulos: Cuentas_de_Inversi_n, Inversi_n_vs_Contactos,
-- Inversi_n_vs_Promoci_n, Aportes_Repartos y Promociones.
--
-- Esta migración crea el ESPEJO de esos módulos. El espejo existe porque la
-- alternativa —pedirle a Zoho los cinco módulos en cada visita— convierte cada
-- navegación en cinco lecturas paginadas, gasta crédito de API y deja la
-- pestaña a merced de que Zoho responda. Con el espejo, la página es una
-- consulta a Postgres y el drill-down a los contactos es instantáneo.
--
-- ADITIVA: no borra ni modifica ninguna tabla existente. Lo único que escribe
-- sobre lo ya existente son filas en `app_user_route_deny` (§6), para que la
-- pestaña nazca cerrada. Idempotente.

-- =============================================================================
-- 1. inv_campo_catalogo — el mapeo campo de Zoho → columna nuestra
-- =============================================================================
-- El mapeo vive en DATOS y no en código, igual que `pm_avance_fase_catalogo`
-- (028). El motivo es el mismo: los nombres API de los campos de Zoho no se
-- adivinan, se preguntan (`/settings/fields?module=`), y los de un módulo
-- personalizado son ilegibles y cambian si alguien renombra una etiqueta en el
-- CRM. Congelarlos en un `const` convierte cualquier retoque del CRM en un
-- despliegue urgente; en tabla, es un UPDATE.
--
-- Se siembra con `zoho_api_name = NULL` a propósito: el sync se NIEGA a correr
-- mientras quede un campo obligatorio sin resolver, en vez de sincronizar
-- columnas a medias y dejar KPIs a cero que parecen un dato real.
CREATE TABLE IF NOT EXISTS public.inv_campo_catalogo (
  -- Nombre API del módulo de Zoho, tal cual lo devuelve /settings/modules.
  modulo          text NOT NULL,
  -- Columna de destino en nuestra tabla espejo.
  destino         text NOT NULL,
  -- Nombre API del campo en Zoho. NULL = sin resolver todavía.
  zoho_api_name   text,
  -- La etiqueta que tenía el campo al resolverlo. Si mañana no coincide con la
  -- que devuelve Zoho, alguien ha renombrado algo en el CRM y conviene mirarlo.
  zoho_label      text,
  zoho_data_type  text,
  -- Cómo hay que leer el valor crudo.
  tipo            text NOT NULL DEFAULT 'text',
  -- Si es obligatorio y sigue a NULL, el sync aborta antes de tocar nada.
  obligatorio     boolean NOT NULL DEFAULT false,
  -- Para 'picklist' normalizadas: { "Aportación": "aporte", "Repartos": "reparto" }.
  notas           jsonb,
  confirmado_por  text,
  confirmado_at   timestamptz,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (modulo, destino),
  CONSTRAINT inv_campo_catalogo_tipo_chk
    CHECK (tipo IN ('text','number','date','datetime','email','bool','picklist','lookup_id','lookup_nombre'))
);

COMMENT ON TABLE public.inv_campo_catalogo IS
  'Mapeo campo de Zoho -> columna espejo. Lo rellena scripts/inversores/zoho-descubrir.ts.';
COMMENT ON COLUMN public.inv_campo_catalogo.zoho_api_name IS
  'LA costura, mismo papel que pm_avance_fase_catalogo.zoho_api_name (028). NULL significa «no lo '
  'sabemos»: el sync aborta si falta en una columna obligatoria, en vez de escribir NULLs.';

-- =============================================================================
-- 2. Tablas espejo
-- =============================================================================
-- Convenciones comunes a las seis:
--
--   · La PK es `zoho_id`, el id del registro en Zoho, y no un uuid nuestro.
--     Las seis tablas se relacionan ENTRE SÍ por ids de Zoho; un uuid
--     intermedio obligaría a resolver cada lookup contra la tabla padre en
--     cada upsert y convertiría un sync idempotente en uno con orden
--     obligatorio. Precedente de PK de negocio: corp_periodos.id (038).
--
--   · `raw jsonb` guarda el registro completo tal como llegó. Es lo que hace
--     que el esquema tolere no conocer todavía los api_name: si el mapeo
--     resulta estar mal, se reparan las columnas tipadas con un
--     `UPDATE ... SET col = raw->>'Api_Name'`, SIN volver a bajar nada de Zoho.
--     Ojo: `raw` es «todo lo que pedimos», no «todo lo que Zoho tiene» — la
--     API v8 exige enumerar los campos y acota cuántos caben por llamada.
--
--   · `borrado_at` es una LÁPIDA, no un DELETE. Lo que desaparece de Zoho se
--     marca y se deja: un reparto que se esfuma es una pregunta que hacer, no
--     un dato que tirar. Todas las lecturas filtran `borrado_at IS NULL`.
--
--   · `sync_id` dice qué ejecución tocó la fila por última vez. Es lo que
--     permite marcar al final lo que ya no vino, y solo se hace si la lectura
--     del módulo terminó ENTERA (ver inversoresSync.ts).
--
--   · Los importes son `numeric(18,2)`, nunca `double precision`. `corp_periodos`
--     usa float porque agrega cifras ya calculadas; aquí se SUMAN flujos
--     individuales y los céntimos se acumulan.
--
--   · Los desplegables de Zoho se guardan como texto literal y SIN CHECK (mismo
--     criterio que `pm_promociones.situacion` en la 028): un valor nuevo en el
--     CRM no puede tumbar la carga.

-- 2.1 Cuentas de inversión (módulo Cuentas_de_Inversi_n) ----------------------
-- El vehículo por el que se invierte. Es la entidad central: los contactos
-- cuelgan de ella y los flujos la referencian.
CREATE TABLE IF NOT EXISTS public.inv_cuentas (
  zoho_id                text PRIMARY KEY,
  nombre                 text NOT NULL,
  codigo                 text,
  estado                 text,
  tipo                   text,
  fecha_alta             date,
  capital_comprometido   numeric(18,2),
  moneda                 text NOT NULL DEFAULT 'EUR',
  propietario_zoho_id    text,
  propietario_nombre     text,
  zoho_modified_at       timestamptz,
  raw                    jsonb NOT NULL DEFAULT '{}'::jsonb,
  sync_id                uuid,
  sincronizado_at        timestamptz NOT NULL DEFAULT now(),
  borrado_at             timestamptz
);
CREATE INDEX IF NOT EXISTS inv_cuentas_vivas_idx  ON public.inv_cuentas (nombre) WHERE borrado_at IS NULL;
CREATE INDEX IF NOT EXISTS inv_cuentas_estado_idx ON public.inv_cuentas (estado);
CREATE INDEX IF NOT EXISTS inv_cuentas_sync_idx   ON public.inv_cuentas (sync_id);

-- 2.2 Contactos (módulo Contacts) ---------------------------------------------
-- Solo los contactos REFERENCIADOS desde el módulo de enlace, no la agenda
-- entera del CRM: es dato personal y no hay motivo para copiar de más.
--
-- Puede quedarse vacía y no pasa nada. Si el módulo de enlace ya trae el correo
-- en un campo propio, el sync no necesita bajar a Contacts y la lectura resuelve
-- con COALESCE(enlace.contacto_email, contacto.email). Cuál de los dos casos es
-- lo decide el descubrimiento, no esta migración.
CREATE TABLE IF NOT EXISTS public.inv_contactos (
  zoho_id           text PRIMARY KEY,
  nombre            text,
  apellidos         text,
  nombre_completo   text NOT NULL,
  email             text,
  email_secundario  text,
  telefono          text,
  zoho_modified_at  timestamptz,
  raw               jsonb NOT NULL DEFAULT '{}'::jsonb,
  sync_id           uuid,
  sincronizado_at   timestamptz NOT NULL DEFAULT now(),
  borrado_at        timestamptz
);
-- lower(email) y no citext: la extensión puede no estar habilitada en el
-- proyecto y no merece una dependencia nueva.
CREATE INDEX IF NOT EXISTS inv_contactos_email_idx ON public.inv_contactos (lower(email));
CREATE INDEX IF NOT EXISTS inv_contactos_sync_idx  ON public.inv_contactos (sync_id);

-- 2.3 Cuenta ↔ contacto (módulo de enlace Inversi_n_vs_Contactos) -------------
-- Sin UNIQUE(cuenta, contacto): la misma persona puede figurar dos veces en una
-- cuenta con papeles distintos (titular y apoderado). La clave es el id del
-- registro de ENLACE, que es lo que Zoho considera único.
--
-- `cuenta_nombre` / `contacto_nombre` / `contacto_email` están denormalizados
-- desde el lookup a propósito: sobreviven a un sync en el que la tabla padre
-- falló, y son justo lo que enseña el nivel 2 del drill-down.
CREATE TABLE IF NOT EXISTS public.inv_cuenta_contacto (
  zoho_id            text PRIMARY KEY,
  cuenta_zoho_id     text,
  cuenta_nombre      text,
  contacto_zoho_id   text,
  contacto_nombre    text,
  contacto_email     text,
  contacto_telefono  text,
  rol                text,
  participacion      numeric(9,6),
  zoho_modified_at   timestamptz,
  raw                jsonb NOT NULL DEFAULT '{}'::jsonb,
  sync_id            uuid,
  sincronizado_at    timestamptz NOT NULL DEFAULT now(),
  borrado_at         timestamptz
);
CREATE INDEX IF NOT EXISTS inv_cc_cuenta_idx   ON public.inv_cuenta_contacto (cuenta_zoho_id) WHERE borrado_at IS NULL;
CREATE INDEX IF NOT EXISTS inv_cc_contacto_idx ON public.inv_cuenta_contacto (contacto_zoho_id);
CREATE INDEX IF NOT EXISTS inv_cc_email_idx    ON public.inv_cuenta_contacto (lower(contacto_email));
CREATE INDEX IF NOT EXISTS inv_cc_sync_idx     ON public.inv_cuenta_contacto (sync_id);

-- 2.4 Promociones (módulo Promociones) ----------------------------------------
CREATE TABLE IF NOT EXISTS public.inv_promociones (
  zoho_id           text PRIMARY KEY,
  codigo            text,
  nombre            text NOT NULL,
  situacion         text,
  tipologia         text,
  zoho_modified_at  timestamptz,
  raw               jsonb NOT NULL DEFAULT '{}'::jsonb,
  sync_id           uuid,
  sincronizado_at   timestamptz NOT NULL DEFAULT now(),
  borrado_at        timestamptz
);
CREATE INDEX IF NOT EXISTS inv_promociones_codigo_idx ON public.inv_promociones (codigo);
CREATE INDEX IF NOT EXISTS inv_promociones_sync_idx   ON public.inv_promociones (sync_id);

COMMENT ON TABLE public.inv_promociones IS
  'Espejo del módulo Promociones de Zoho para Inversores. OJO: pm_promociones (028) espeja el MISMO '
  'módulo por otro pipeline (export manual de Excel, zona pm, y ancla de pm_activo_promocion_map). '
  'Se dejan separadas a propósito: un segundo escritor sobre pm_promociones es como se rompe Avance '
  'de obra. Se unen por inv_promociones.zoho_id = pm_promociones.zoho_record_id. Ninguna escribe en la otra.';

-- 2.5 Cuenta ↔ promoción (módulo de enlace Inversi_n_vs_Promoci_n) ------------
CREATE TABLE IF NOT EXISTS public.inv_cuenta_promocion (
  zoho_id               text PRIMARY KEY,
  cuenta_zoho_id        text,
  cuenta_nombre         text,
  promocion_zoho_id     text,
  promocion_nombre      text,
  importe_comprometido  numeric(18,2),
  importe_aportado      numeric(18,2),
  participacion         numeric(9,6),
  fecha                 date,
  zoho_modified_at      timestamptz,
  raw                   jsonb NOT NULL DEFAULT '{}'::jsonb,
  sync_id               uuid,
  sincronizado_at       timestamptz NOT NULL DEFAULT now(),
  borrado_at            timestamptz
);
CREATE INDEX IF NOT EXISTS inv_cp_cuenta_idx    ON public.inv_cuenta_promocion (cuenta_zoho_id)    WHERE borrado_at IS NULL;
CREATE INDEX IF NOT EXISTS inv_cp_promocion_idx ON public.inv_cuenta_promocion (promocion_zoho_id) WHERE borrado_at IS NULL;
CREATE INDEX IF NOT EXISTS inv_cp_sync_idx      ON public.inv_cuenta_promocion (sync_id);

-- 2.6 Flujos: aportes y repartos (módulo Aportes_Repartos) --------------------
-- `tipo` se normaliza a 'aporte' | 'reparto' con el diccionario que vive en
-- inv_campo_catalogo.notas. 'desconocido' es la válvula de escape: un valor de
-- desplegable nuevo en Zoho NO puede tumbar la carga. Esas filas se
-- sincronizan, se ven en la tabla, se cuentan en el log y no entran en los
-- KPIs — que es mejor que descartarlas en silencio y que los totales mientan.
--
-- El signo no se codifica en `importe`: la convención de Zoho es desconocida y
-- se descubrirá con --muestra. El neto se calcula en logic/, no en SQL.
CREATE TABLE IF NOT EXISTS public.inv_flujos (
  zoho_id            text PRIMARY KEY,
  cuenta_zoho_id     text,
  -- Nullable: puede haber flujos a nivel de cuenta, sin promoción.
  promocion_zoho_id  text,
  tipo               text NOT NULL DEFAULT 'desconocido',
  -- El literal de Zoho, sin tocar, para poder auditar la normalización.
  tipo_zoho          text,
  importe            numeric(18,2) NOT NULL DEFAULT 0,
  moneda             text NOT NULL DEFAULT 'EUR',
  fecha              date,
  concepto           text,
  zoho_modified_at   timestamptz,
  raw                jsonb NOT NULL DEFAULT '{}'::jsonb,
  sync_id            uuid,
  sincronizado_at    timestamptz NOT NULL DEFAULT now(),
  borrado_at         timestamptz,
  CONSTRAINT inv_flujos_tipo_chk CHECK (tipo IN ('aporte','reparto','desconocido'))
);
CREATE INDEX IF NOT EXISTS inv_flujos_cuenta_fecha_idx ON public.inv_flujos (cuenta_zoho_id, fecha) WHERE borrado_at IS NULL;
CREATE INDEX IF NOT EXISTS inv_flujos_promocion_idx    ON public.inv_flujos (promocion_zoho_id)     WHERE borrado_at IS NULL;
CREATE INDEX IF NOT EXISTS inv_flujos_tipo_idx         ON public.inv_flujos (tipo);
CREATE INDEX IF NOT EXISTS inv_flujos_sync_idx         ON public.inv_flujos (sync_id);

-- =============================================================================
-- 3. inv_sync_log — una fila por ejecución, con el detalle por módulo
-- =============================================================================
-- El detalle va por MÓDULO dentro de `modulos` porque el sync sigue adelante
-- cuando uno falla: un estado global sin desglose mentiría. Es además lo que
-- permite que la página avise «los flujos son de anteayer» en vez de callarse.
CREATE TABLE IF NOT EXISTS public.inv_sync_log (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  iniciado_at          timestamptz NOT NULL DEFAULT now(),
  terminado_at         timestamptz,
  duracion_ms          integer,
  origen               text NOT NULL,
  estado               text NOT NULL DEFAULT 'en_curso',
  disparado_por        text,
  disparado_por_email  text,
  -- [{ modulo, tabla, leidos, escritos, lapidas, huerfanos, ms, error }]
  modulos              jsonb NOT NULL DEFAULT '[]'::jsonb,
  error                text,
  CONSTRAINT inv_sync_log_origen_chk CHECK (origen IN ('cron','manual','script')),
  CONSTRAINT inv_sync_log_estado_chk CHECK (estado IN ('en_curso','ok','parcial','error'))
);
CREATE INDEX IF NOT EXISTS inv_sync_log_fecha_idx ON public.inv_sync_log (iniciado_at DESC);

-- Una sola sincronización a la vez. El cron y el botón pueden solaparse, y dos
-- ejecuciones entrelazadas se marcarían filas como borradas la una a la otra:
-- la lápida de la segunda alcanzaría a lo que la primera aún no había tocado.
CREATE UNIQUE INDEX IF NOT EXISTS inv_sync_log_una_en_curso_idx
  ON public.inv_sync_log ((true)) WHERE estado = 'en_curso';

-- =============================================================================
-- 4. RLS — cerrada, como corp_periodos (038)
-- =============================================================================
-- RLS habilitada y SIN política de SELECT: ni `anon` ni `authenticated` leen
-- estas tablas. Son nombres, correos, teléfonos y patrimonio de los inversores.
-- El único acceso es el service role desde Server Components, después de pasar
-- por `requireRouteAccess("portfolio.inversores")`.
--
-- No se crea ninguna VISTA sobre estas tablas a propósito: una vista sin
-- `security_invoker = on` se ejecuta como su dueño y publicaría por PostgREST
-- justo lo que estas políticas cierran. Las agregaciones viven en logic/.
ALTER TABLE public.inv_campo_catalogo   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inv_cuentas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inv_contactos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inv_cuenta_contacto  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inv_promociones      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inv_cuenta_promocion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inv_flujos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inv_sync_log         ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.inv_campo_catalogo   TO service_role;
GRANT ALL ON public.inv_cuentas          TO service_role;
GRANT ALL ON public.inv_contactos        TO service_role;
GRANT ALL ON public.inv_cuenta_contacto  TO service_role;
GRANT ALL ON public.inv_promociones      TO service_role;
GRANT ALL ON public.inv_cuenta_promocion TO service_role;
GRANT ALL ON public.inv_flujos           TO service_role;
GRANT ALL ON public.inv_sync_log         TO service_role;

-- =============================================================================
-- 5. Siembra del catálogo de campos
-- =============================================================================
-- Todo a NULL: es `npm run inversores:zoho-descubrir -- --aplicar` quien los
-- resuelve preguntándole a Zoho. Aquí solo se declara QUÉ hace falta y qué es
-- imprescindible. ON CONFLICT DO NOTHING para no pisar un mapeo ya resuelto si
-- la migración se vuelve a pasar.
INSERT INTO public.inv_campo_catalogo (modulo, destino, tipo, obligatorio, notas) VALUES
  ('Cuentas_de_Inversi_n', 'nombre',               'text',        true,  NULL),
  ('Cuentas_de_Inversi_n', 'codigo',               'text',        false, NULL),
  ('Cuentas_de_Inversi_n', 'estado',               'picklist',    false, NULL),
  ('Cuentas_de_Inversi_n', 'tipo',                 'picklist',    false, NULL),
  ('Cuentas_de_Inversi_n', 'fecha_alta',           'date',        false, NULL),
  ('Cuentas_de_Inversi_n', 'capital_comprometido', 'number',      false,
     '{"si_falta":"se deriva sumando inv_cuenta_promocion.importe_comprometido"}'::jsonb),
  ('Cuentas_de_Inversi_n', 'moneda',               'picklist',    false, NULL),

  ('Contacts', 'nombre',           'text',  false, NULL),
  ('Contacts', 'apellidos',        'text',  false, NULL),
  ('Contacts', 'nombre_completo',  'text',  true,  NULL),
  ('Contacts', 'email',            'email', true,  NULL),
  ('Contacts', 'email_secundario', 'email', false, NULL),
  ('Contacts', 'telefono',         'text',  false, NULL),

  ('Inversi_n_vs_Contactos', 'cuenta_zoho_id',    'lookup_id',     true,  NULL),
  ('Inversi_n_vs_Contactos', 'cuenta_nombre',     'lookup_nombre', false, NULL),
  ('Inversi_n_vs_Contactos', 'contacto_zoho_id',  'lookup_id',     true,  NULL),
  ('Inversi_n_vs_Contactos', 'contacto_nombre',   'lookup_nombre', false, NULL),
  ('Inversi_n_vs_Contactos', 'contacto_email',    'email',         false,
     '{"si_falta":"se resuelve bajando el modulo Contacts"}'::jsonb),
  ('Inversi_n_vs_Contactos', 'contacto_telefono', 'text',          false, NULL),
  ('Inversi_n_vs_Contactos', 'rol',               'picklist',      false, NULL),
  ('Inversi_n_vs_Contactos', 'participacion',     'number',        false, NULL),

  ('Promociones', 'codigo',    'text',     false, NULL),
  ('Promociones', 'nombre',    'text',     true,  NULL),
  ('Promociones', 'situacion', 'picklist', false, NULL),
  ('Promociones', 'tipologia', 'picklist', false, NULL),

  ('Inversi_n_vs_Promoci_n', 'cuenta_zoho_id',       'lookup_id',     true,  NULL),
  ('Inversi_n_vs_Promoci_n', 'cuenta_nombre',        'lookup_nombre', false, NULL),
  ('Inversi_n_vs_Promoci_n', 'promocion_zoho_id',    'lookup_id',     true,  NULL),
  ('Inversi_n_vs_Promoci_n', 'promocion_nombre',     'lookup_nombre', false, NULL),
  ('Inversi_n_vs_Promoci_n', 'importe_comprometido', 'number',        false, NULL),
  ('Inversi_n_vs_Promoci_n', 'importe_aportado',     'number',        false, NULL),
  ('Inversi_n_vs_Promoci_n', 'participacion',        'number',        false, NULL),
  ('Inversi_n_vs_Promoci_n', 'fecha',                'date',          false, NULL),

  ('Aportes_Repartos', 'cuenta_zoho_id',    'lookup_id', true,  NULL),
  ('Aportes_Repartos', 'promocion_zoho_id', 'lookup_id', false, NULL),
  ('Aportes_Repartos', 'tipo_zoho',         'picklist',  true,
     '{"normaliza":{"Aporte":"aporte","Aportación":"aporte","Reparto":"reparto","Distribución":"reparto"}}'::jsonb),
  ('Aportes_Repartos', 'importe',           'number',    true,  NULL),
  ('Aportes_Repartos', 'fecha',             'date',      true,  NULL),
  ('Aportes_Repartos', 'concepto',          'text',      false, NULL)
ON CONFLICT (modulo, destino) DO NOTHING;

-- =============================================================================
-- 6. La pestaña nace cerrada
-- =============================================================================
-- El modelo de permisos del portal es una DENYLIST: una ruta nueva la ve por
-- defecto todo el que tenga la zona. Para Corporativas bastó con crear una zona
-- que nadie tenía concedida, pero Inversores cuelga de `financiero`, que ya
-- tiene mucha gente. Así que se deniega explícitamente a TODOS los usuarios de
-- hoy y se abre uno a uno desde /dashboard/admin/usuarios.
--
-- Esto NO cubre a los usuarios de mañana: `setUserRouteDenies` escribe lo que le
-- manda el formulario de alta. Ese extremo se tapa en el código, con
-- `deniedByDefault` en el registry y la siembra en createAdminUserAction.
INSERT INTO public.app_user_route_deny (user_id, route_key)
SELECT u.id, 'portfolio.inversores'
FROM auth.users u
ON CONFLICT DO NOTHING;
