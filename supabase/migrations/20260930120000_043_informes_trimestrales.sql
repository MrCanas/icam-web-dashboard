-- Informes trimestrales 043 — los informes para inversores se hacen en el portal.
--
-- Hasta ahora el informe trimestral se generaba en un artifact de claude.ai y
-- con un skill de Claude Code (carpeta ImparOS-InformesTrimestrales). Pasa a ser
-- un módulo nativo de /dashboard/pm: las PMs lo generan desde la subpestaña
-- «Informe» de cada proyecto, con las actas y la planificación del trimestre
-- como entrada automática y Claude (API de Anthropic) como redactor.
--
-- `informe.contenido` guarda el informe en el formato de informe.json del skill
-- ({meta, slides}): así los informes ya hechos se importan tal cual y el del
-- trimestre siguiente los usa como «informe anterior».
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
  codigo      text PRIMARY KEY,
  id_activo   text REFERENCES public.pm_activos (id_activo) ON UPDATE CASCADE ON DELETE SET NULL,
  nombre      text NOT NULL,
  arquetipo   text NOT NULL DEFAULT 'A',
  -- {variante:'cnmv', tipo, fondo, isin} | {variante:'sl', vehiculo, nif, entidad?}
  pie         jsonb,
  updated_by  uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT informe_proyecto_arquetipo_chk CHECK (arquetipo IN ('A', 'B', 'C', 'D', 'E'))
);

CREATE UNIQUE INDEX IF NOT EXISTS informe_proyecto_id_activo_uq
  ON public.informe_proyecto (id_activo) WHERE id_activo IS NOT NULL;

COMMENT ON TABLE public.informe_proyecto IS
  'Informes trimestrales: nombre, arquetipo (A–E) y pie legal por proyecto. id_activo enlaza con actas y planificación.';

-- =============================================================================
-- 2. informe — un informe por proyecto y trimestre
-- =============================================================================
-- id = <codigo>_Qn-AAAA (SE84_Q3-2026): el del trimestre siguiente encuentra
-- este como «informe anterior» sin consultas.
CREATE TABLE IF NOT EXISTS public.informe (
  id                  text PRIMARY KEY,
  codigo              text NOT NULL REFERENCES public.informe_proyecto (codigo) ON UPDATE CASCADE,
  trimestre           text NOT NULL,
  trimestre_anterior  text NOT NULL,
  siguiente           text NOT NULL,
  estado              text NOT NULL DEFAULT 'datos',
  version             integer NOT NULL DEFAULT 1,
  -- De dónde sale el informe anterior: {tipo:'estructurado', id} | {tipo:'texto', nombre} | {tipo:'ninguno'}
  base                jsonb,
  -- Análisis de Claude: {resumen, objetivosPrevios, hechos, estructura, sugeridas, faltan, contradicciones}
  analisis            jsonb,
  -- Estructura elegida en el paso 3: {estructura:[{id,titulo,accion,motivo}], anadir:[nº biblioteca]}
  seleccion           jsonb,
  -- El informe: {meta, slides} (formato informe.json)
  contenido           jsonb,
  -- Última revisión de coherencia: {coherencia:[{slide,problema,sugerencia}], fecha}
  qa                  jsonb,
  created_by          uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_by          uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT informe_trimestre_chk CHECK (trimestre ~ '^Q[1-4] [0-9]{4}$'),
  CONSTRAINT informe_trimestre_anterior_chk CHECK (trimestre_anterior ~ '^Q[1-4] [0-9]{4}$'),
  CONSTRAINT informe_siguiente_chk CHECK (siguiente ~ '^Q[1-4] [0-9]{4}$'),
  CONSTRAINT informe_estado_chk CHECK (estado IN ('datos', 'fuentes', 'analizado', 'generando', 'borrador', 'aprobado')),
  CONSTRAINT informe_codigo_trimestre_uq UNIQUE (codigo, trimestre)
);

COMMENT ON TABLE public.informe IS
  'Informes trimestrales para inversores. contenido = {meta, slides}, el formato informe.json del skill informe-trimestral.';

-- =============================================================================
-- 3. informe_fuente — lo que se le da a Claude para redactar
-- =============================================================================
-- Una fila por fuente. Las de actas y planificación las carga el portal
-- (auto = true) y se pueden quitar (incluida = false) o recargar.
CREATE TABLE IF NOT EXISTS public.informe_fuente (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  informe_id  text NOT NULL REFERENCES public.informe (id) ON DELETE CASCADE,
  tipo        text NOT NULL,
  nombre      text NOT NULL,
  texto       text NOT NULL DEFAULT '',
  auto        boolean NOT NULL DEFAULT false,
  orden       integer NOT NULL DEFAULT 0,
  incluida    boolean NOT NULL DEFAULT true,
  created_by  uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT informe_fuente_tipo_chk
    CHECK (tipo IN ('notas', 'documento', 'actas', 'planificacion', 'previo', 'correccion'))
);

CREATE INDEX IF NOT EXISTS informe_fuente_informe_idx ON public.informe_fuente (informe_id, orden);

-- =============================================================================
-- 4. informe_foto — fotos del informe (binario en Storage, bucket informes-fotos)
-- =============================================================================
-- Las slides las referencian por id (/api/informes/fotos/<id>), que las sirve
-- desde el mismo origen: la vista de impresión y las capturas no tienen CORS.
CREATE TABLE IF NOT EXISTS public.informe_foto (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  informe_id    text NOT NULL REFERENCES public.informe (id) ON DELETE CASCADE,
  storage_path  text NOT NULL,
  mime          text NOT NULL,
  ancho         integer,
  alto          integer,
  categoria     text NOT NULL DEFAULT 'Obra',
  -- Solo para «Página de Finanzas»: a qué slide bloqueada va.
  para          text,
  pie           text,
  nombre        text,
  created_by    uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT informe_foto_categoria_chk
    CHECK (categoria IN ('Obra', 'Portada', 'Render', 'Página de Finanzas', 'Otra'))
);

CREATE INDEX IF NOT EXISTS informe_foto_informe_idx ON public.informe_foto (informe_id);

-- =============================================================================
-- 5. informe_version — instantáneas al guardar versión
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.informe_version (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  informe_id  text NOT NULL REFERENCES public.informe (id) ON DELETE CASCADE,
  version     integer NOT NULL,
  contenido   jsonb NOT NULL,
  estado      text NOT NULL,
  created_by  uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT informe_version_uq UNIQUE (informe_id, version)
);

-- =============================================================================
-- 6. informe_cambio — historial de cambios del informe
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.informe_cambio (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  informe_id  text NOT NULL REFERENCES public.informe (id) ON DELETE CASCADE,
  texto       text NOT NULL,
  user_id     uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS informe_cambio_informe_idx ON public.informe_cambio (informe_id, created_at);

-- =============================================================================
-- 7. informe_uso — consumo de la API de Anthropic
-- =============================================================================
-- Una fila por petición a Claude, también si termina en refusal o max_tokens
-- (se factura igual). Sin FK a informe: el coste se conserva aunque el informe
-- se borre.
CREATE TABLE IF NOT EXISTS public.informe_uso (
  id                     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  informe_id             text,
  user_id                uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  tipo                   text NOT NULL,
  modelo                 text NOT NULL,
  input_tokens           integer NOT NULL DEFAULT 0,
  output_tokens          integer NOT NULL DEFAULT 0,
  cache_creation_tokens  integer NOT NULL DEFAULT 0,
  cache_read_tokens      integer NOT NULL DEFAULT 0,
  coste_usd              numeric(10, 4) NOT NULL DEFAULT 0,
  stop_reason            text,
  duracion_ms            integer,
  created_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT informe_uso_tipo_chk
    CHECK (tipo IN ('analisis', 'slide', 'ajuste', 'resumen', 'correccion', 'coherencia'))
);

CREATE INDEX IF NOT EXISTS informe_uso_informe_idx ON public.informe_uso (informe_id);
CREATE INDEX IF NOT EXISTS informe_uso_created_idx ON public.informe_uso (created_at);

-- =============================================================================
-- 8. RLS — como corp_* (038): habilitada y SIN políticas
-- =============================================================================
-- Todo se sirve desde el servidor con service role después de comprobar la
-- zona pm. Los informes son confidenciales hasta que se envían: no se publican
-- a `authenticated` ni a `anon`.
ALTER TABLE public.informe_proyecto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.informe          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.informe_fuente   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.informe_foto     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.informe_version  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.informe_cambio   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.informe_uso      ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.informe_proyecto TO service_role;
GRANT ALL ON public.informe          TO service_role;
GRANT ALL ON public.informe_fuente   TO service_role;
GRANT ALL ON public.informe_foto     TO service_role;
GRANT ALL ON public.informe_version  TO service_role;
GRANT ALL ON public.informe_cambio   TO service_role;
GRANT ALL ON public.informe_uso      TO service_role;

-- =============================================================================
-- 9. Bucket privado de fotos
-- =============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('informes-fotos', 'informes-fotos', false, 10485760,
        ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;
