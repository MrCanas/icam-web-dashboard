-- Comunicaciones 047 — las comunicaciones a inversores entran en el portal.
--
-- Hasta ahora los correos a inversores salían del kiosk «Emails a Fondos/Promos»
-- de Zoho CRM, que no enseña a quién va a escribir antes de hacerlo. Un intento
-- de ampliarlo dentro del CRM (2026-10-05) acabó en 60 correos enviados por
-- error: el envío era la opción por defecto y en ningún paso se veía la lista de
-- destinatarios ni la plantilla.
--
-- Esta migración crea el destino del módulo `src/modules/comunicaciones` y la
-- zona que lo protege. Las tablas llevan ya las columnas de los controles de
-- envío (revisión, prueba, confirmación), pero NADA de lo que hay aquí envía un
-- correo: en esta fase el módulo solo prepara y enseña.
--
-- ADITIVA e idempotente. Lo único que toca de lo ya existente:
--   · el `sort_order` de la zona `data`, para colocar la pestaña nueva antes;
--   · dos columnas nuevas en el espejo de Inversores (§2), con su fila en
--     `inv_campo_catalogo`. El sync las rellena solo; las demás no cambian.

-- =============================================================================
-- 1. Zona nueva del portal
-- =============================================================================
-- Zona propia y no una pestaña de Financiero, por el mismo motivo que
-- Corporativas (038): quien prepara comunicaciones (relación con inversores,
-- marketing) no tiene por qué ver el portfolio, y al revés. ZONE_ORDER en
-- src/registry/modules.ts tiene que quedar alineado con estos sort_order.
--
-- No se concede el rol a nadie aquí: va por /dashboard/admin/usuarios o
-- `npm run auth:grant`. Hasta que alguien lo tenga, la pestaña no le aparece a
-- nadie.

INSERT INTO public.app_zone (key, label, sort_order)
VALUES ('comunicaciones', 'Comunicaciones', 5)
ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order;

UPDATE public.app_zone SET sort_order = 6 WHERE key = 'data';

-- =============================================================================
-- 2. Dos campos más en el espejo de Inversores
-- =============================================================================
-- Los destinatarios salen de las tablas `inv_*` (040), no de Zoho en vivo.
-- Faltaban los dos datos que deciden a quién NO se escribe:
--
--   · `Tiene_intermediario` de la cuenta: la audiencia «Inversores directos» son
--     las cuentas que no lo tienen marcado.
--   · `Email_Opt_Out` del contacto: quien se ha dado de baja no recibe nada.
--
-- Los dos nombres API se comprobaron contra el CRM el 2026-10-06
-- (`npm run comunicaciones:zoho-descubrir`). Importa: `validarMapeo` bloquea el
-- sync entero si un campo del catálogo no existe en Zoho.

ALTER TABLE public.inv_cuentas
  ADD COLUMN IF NOT EXISTS tiene_intermediario boolean;

ALTER TABLE public.inv_contactos
  ADD COLUMN IF NOT EXISTS email_opt_out boolean;

COMMENT ON COLUMN public.inv_cuentas.tiene_intermediario IS
  'Casilla «Tiene intermediario» de la cuenta en Zoho. NULL = todavía sin sincronizar.';
COMMENT ON COLUMN public.inv_contactos.email_opt_out IS
  'Casilla de baja de correo del contacto en Zoho. NULL = todavía sin sincronizar.';

INSERT INTO public.inv_campo_catalogo
  (modulo, destino, zoho_api_name, zoho_label, tipo, obligatorio, notas)
VALUES
  ('Cuentas_de_Inversi_n', 'tiene_intermediario', 'Tiene_intermediario', 'Tiene intermediario', 'bool', false, NULL),
  ('Contacts',             'email_opt_out',       'Email_Opt_Out',       'Email Opt Out',       'bool', false, NULL)
ON CONFLICT (modulo, destino) DO NOTHING;

-- =============================================================================
-- 3. com_ajustes — una sola fila con los interruptores del módulo
-- =============================================================================
-- Nace con todo cerrado: envíos desactivados y modo pruebas. Abrirlo es una
-- decisión de una persona con rol admin en la zona, no un valor por defecto.

CREATE TABLE IF NOT EXISTS public.com_ajustes (
  -- Clave fija: la tabla no puede tener más de una fila.
  id                     boolean PRIMARY KEY DEFAULT true CHECK (id),
  -- El interruptor general. Con false no sale ningún correo, ni de prueba.
  envios_activados       boolean NOT NULL DEFAULT false,
  -- 'pruebas': todo correo se redirige a quien ha iniciado sesión.
  modo                   text NOT NULL DEFAULT 'pruebas' CHECK (modo IN ('pruebas', 'real')),
  -- Cuenta de Inversión de Zoho sobre la que se hacen los envíos de prueba.
  cuenta_pruebas_zoho_id text,
  remitentes_permitidos  text[] NOT NULL DEFAULT '{}',
  -- Una dirección de estos dominios se marca como interna en la lista.
  dominios_internos      text[] NOT NULL DEFAULT '{imparcapital.com}',
  updated_por_email      text,
  updated_at             timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.com_ajustes (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 4. com_comunicacion — una fila por comunicación preparada
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.com_comunicacion (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre               text NOT NULL,
  tipo                 text NOT NULL
    CHECK (tipo IN ('reporte', 'evento', 'newsletter', 'oportunidad', 'otro')),
  audiencia            text NOT NULL
    CHECK (audiencia IN ('promocion', 'toda_la_base', 'inversores_directos')),
  promocion_zoho_id    text,
  promocion_nombre     text,
  -- Qué papeles del contacto van en «Para» y cuáles en copia.
  roles_para           text[] NOT NULL DEFAULT '{principal}',
  roles_copia          text[] NOT NULL DEFAULT '{}',
  -- La plantilla vive en Zoho; aquí solo se recuerda cuál se eligió.
  plantilla_id         text,
  plantilla_nombre     text,
  plantilla_modulo     text,
  remitente_email      text,
  estado               text NOT NULL DEFAULT 'borrador'
    CHECK (estado IN ('borrador', 'revisada', 'probada', 'enviando', 'pausada', 'enviada', 'cancelada')),
  -- Edad del espejo de Zoho cuando se calcularon los destinatarios.
  datos_zoho_at        timestamptz,
  -- Nombre y correo tal como eran en el momento: el registro no cambia si
  -- cambia el usuario (mismo criterio que informe_exportacion, 046).
  creada_por           uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  creada_por_email     text NOT NULL DEFAULT '',
  -- Los controles previos al envío. Cada uno guarda quién lo pasó, cuándo y
  -- sobre qué: cambiar la lista o la plantilla después lo invalida.
  revisada_por_email   text,
  revisada_at          timestamptz,
  revisada_n           integer,
  probada_por_email    text,
  probada_at           timestamptz,
  probada_plantilla_id text,
  confirmada_por_email text,
  confirmada_at        timestamptz,
  confirmada_n         integer,
  enviada_at           timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT com_comunicacion_promocion_chk
    CHECK (audiencia <> 'promocion' OR promocion_zoho_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS com_comunicacion_fecha_idx ON public.com_comunicacion (created_at DESC);

-- =============================================================================
-- 5. com_destinatario — la foto fija de a quién va cada comunicación
-- =============================================================================
-- Una fila = un correo = una cuenta de inversión. Es una FOTO: se calcula al
-- preparar y no se recalcula sola, para que lo que se revisa sea exactamente lo
-- que después se envía aunque el CRM cambie entre medias.

CREATE TABLE IF NOT EXISTS public.com_destinatario (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comunicacion_id    uuid NOT NULL REFERENCES public.com_comunicacion (id) ON DELETE CASCADE,
  cuenta_zoho_id     text NOT NULL,
  cuenta_nombre      text NOT NULL,
  -- [{ email, nombre, contactoZohoId, rol }]
  para               jsonb NOT NULL DEFAULT '[]'::jsonb,
  copia              jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Claves de aviso: cuenta_de_prueba, direccion_interna, persona_repetida,
  -- sin_destinatario, dado_de_baja, sin_correo.
  avisos             text[] NOT NULL DEFAULT '{}',
  excluido           boolean NOT NULL DEFAULT false,
  excluido_motivo    text,
  excluido_por_email text,
  estado_envio       text NOT NULL DEFAULT 'pendiente'
    CHECK (estado_envio IN ('pendiente', 'sin_destinatario', 'enviando', 'enviado', 'error')),
  zoho_message_id    text,
  error              text,
  enviado_at         timestamptz,
  intentos           integer NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  -- Una cuenta no puede aparecer dos veces en la misma comunicación.
  CONSTRAINT com_destinatario_unico UNIQUE (comunicacion_id, cuenta_zoho_id)
);

CREATE INDEX IF NOT EXISTS com_destinatario_estado_idx
  ON public.com_destinatario (comunicacion_id, estado_envio);

-- =============================================================================
-- 6. Seguridad
-- =============================================================================
-- Mismo criterio que `inv_*` (040): RLS habilitada y SIN política de SELECT. Aquí
-- hay nombres y correos de inversores, y todo el módulo se sirve desde el
-- servidor con service role tras `requireRouteAccess`.

ALTER TABLE public.com_ajustes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.com_comunicacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.com_destinatario ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.com_ajustes      TO service_role;
GRANT ALL ON public.com_comunicacion TO service_role;
GRANT ALL ON public.com_destinatario TO service_role;
