-- Informes trimestrales 043 — el generador de informes para inversores entra en el portal.
--
-- Hasta ahora el informe trimestral se generaba en un artifact de claude.ai: el
-- estado vivía en la base de datos del artifact y cada petición a Claude salía
-- de la cuenta de quien lo usaba. Esta migración crea el ESPEJO de aquella base
-- de datos (proyectos, informes, fuentes, versiones), el registro de consumo de
-- la API de Anthropic y el bucket de fotos, para que las PMs generen el informe
-- desde /dashboard/pm con las actas y la planificación del trimestre como
-- entrada automática.
--
-- Las cuatro primeras tablas guardan el documento completo en `datos` (jsonb):
-- la app del informe (public/informes-app) es la dueña de su forma y la
-- comparte con el artifact, que sigue funcionando. Solo se sacan a columna los
-- campos por los que se filtra o se lista.
--
-- ADITIVA: no toca ninguna tabla existente. Idempotente.

-- =============================================================================
-- 1. informe_proyecto — configuración del informe por proyecto
-- =============================================================================
-- La clave es el código corto del informe (SE84, SA31-33…), no id_activo: un
-- informe puede ser de un fondo o de una cartera sin activo PM, y los códigos
-- de ambos dominios no coinciden (PM «SA-33-31» ↔ informe «SA31-33»).
-- `id_activo` es el puente con actas y planificación; sin él el informe se
-- puede hacer igual, pero sin entradas automáticas.
CREATE TABLE IF NOT EXISTS public.informe_proyecto (
  codigo       text PRIMARY KEY,
  id_activo    text REFERENCES public.pm_activos (id_activo) ON UPDATE CASCADE ON DELETE SET NULL,
  -- { nombre, codigo, arquetipo, pie: { variante, fondo, isin | vehiculo, nif }, idActivo }
  datos        jsonb NOT NULL,
  updated_by   uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS informe_proyecto_id_activo_uq
  ON public.informe_proyecto (id_activo) WHERE id_activo IS NOT NULL;

COMMENT ON TABLE public.informe_proyecto IS
  'Informes trimestrales: arquetipo y pie legal (fondo/ISIN o sociedad/NIF) por proyecto. id_activo enlaza con actas y planificación.';

-- =============================================================================
-- 2. informe — un informe por proyecto y trimestre
-- =============================================================================
-- id = <codigo>_Qn-AAAA, el mismo que usa la app: así un informe importado del
-- artifact conserva su id y el del trimestre siguiente lo encuentra como
-- «informe anterior».
CREATE TABLE IF NOT EXISTS public.informe (
  id           text PRIMARY KEY,
  codigo       text NOT NULL,
  trimestre    text NOT NULL,
  estado       text NOT NULL DEFAULT 'datos',
  version      integer NOT NULL DEFAULT 1,
  id_activo    text,
  -- Documento completo de la app: analisis, seleccion, informe {meta, slides}, qa, fotos, cambios…
  datos        jsonb NOT NULL,
  created_by   uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_by   uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT informe_trimestre_chk CHECK (trimestre ~ '^Q[1-4] [0-9]{4}$')
);

CREATE INDEX IF NOT EXISTS informe_codigo_idx ON public.informe (codigo);

COMMENT ON TABLE public.informe IS
  'Informes trimestrales para inversores. datos = documento de public/informes-app (misma forma que el artifact).';

-- =============================================================================
-- 3. informe_fuente — lo que se le da a Claude para redactar
-- =============================================================================
-- Separado de `informe` porque pesa (texto de documentos, informe anterior) y la
-- lista de informes no lo necesita. Sin FK: la app escribe informe y fuentes a
-- la vez y el orden de llegada no está garantizado.
CREATE TABLE IF NOT EXISTS public.informe_fuente (
  informe_id   text PRIMARY KEY,
  -- { notas, documentos: [{ nombre, texto, auto? }], previoTexto, previoNombre }
  datos        jsonb NOT NULL,
  updated_by   uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 4. informe_version — instantáneas al guardar versión
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.informe_version (
  id           text PRIMARY KEY,           -- <informe_id>_v<n>
  informe_id   text NOT NULL,
  version      integer NOT NULL,
  datos        jsonb NOT NULL,             -- { informeId, version, fecha, estado, informe }
  created_by   uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS informe_version_informe_idx ON public.informe_version (informe_id);

-- =============================================================================
-- 5. informe_asset — fotos subidas (binario en Storage, bucket informes-fotos)
-- =============================================================================
-- La app referencia cada foto por su id dentro del JSON de los slides
-- (/api/informes/assets/<id>); por eso el id es estable y no la ruta.
CREATE TABLE IF NOT EXISTS public.informe_asset (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path  text NOT NULL,
  mime_type     text NOT NULL,
  size_bytes    bigint NOT NULL,
  created_by    uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 6. informe_uso — consumo de la API de Anthropic
-- =============================================================================
-- Una fila por petición a Claude. Es lo que permite saber cuánto cuesta cada
-- informe y ajustar el esfuerzo del modelo sin mirar la consola de Anthropic.
CREATE TABLE IF NOT EXISTS public.informe_uso (
  id                     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  informe_id             text,
  user_id                uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  tipo                   text,              -- analisis | slide | ajuste | resumen | correccion | coherencia | otra
  modelo                 text NOT NULL,
  input_tokens           integer NOT NULL DEFAULT 0,
  output_tokens          integer NOT NULL DEFAULT 0,
  cache_creation_tokens  integer NOT NULL DEFAULT 0,
  cache_read_tokens      integer NOT NULL DEFAULT 0,
  coste_usd              numeric(10, 4) NOT NULL DEFAULT 0,
  stop_reason            text,
  duracion_ms            integer,
  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS informe_uso_informe_idx ON public.informe_uso (informe_id);
CREATE INDEX IF NOT EXISTS informe_uso_created_idx ON public.informe_uso (created_at);

-- =============================================================================
-- 7. RLS — como corp_* (038): habilitada y SIN políticas
-- =============================================================================
-- Todo se sirve desde route handlers con service role después de comprobar la
-- zona pm; no hay motivo para publicar estas tablas a `authenticated`.
ALTER TABLE public.informe_proyecto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.informe          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.informe_fuente   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.informe_version  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.informe_asset    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.informe_uso      ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 8. Bucket privado de fotos
-- =============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('informes-fotos', 'informes-fotos', false, 10485760,
        ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;
