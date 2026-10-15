-- 050 — historial de revisiones del informe trimestral.
--
-- Cada revisión con Claude o cada operación de estructura sobre las slides
-- (instrucción al informe, corrección, aplicar avisos de coherencia, desdoblar,
-- fusionar, duplicar, slide nueva) deja una fila con lo que se pidió, lo que
-- había y lo que quedó. El editor la enseña y permite deshacer la revisión
-- entera. Las rondas del análisis del paso 3 también se anotan aquí.
--
-- Aditiva e idempotente. Mismo patrón que informe_cambio (043): RLS sin
-- políticas, solo service role desde el servidor.

CREATE TABLE IF NOT EXISTS public.informe_revision (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  informe_id    text NOT NULL REFERENCES public.informe (id) ON DELETE CASCADE,
  tipo          text NOT NULL CHECK (tipo IN ('instruccion', 'correccion', 'coherencia', 'desdoblar', 'fusionar', 'duplicar', 'nueva', 'analisis')),
  instruccion   text NOT NULL DEFAULT '',
  -- Qué ha cambiado, según Claude (o la operación).
  resumen       text NOT NULL DEFAULT '',
  -- Slides afectadas antes y después de la revisión, y el orden de ids de antes.
  slides_antes   jsonb NOT NULL DEFAULT '[]'::jsonb,
  slides_despues jsonb NOT NULL DEFAULT '[]'::jsonb,
  orden_antes    jsonb NOT NULL DEFAULT '[]'::jsonb,
  deshecha      boolean NOT NULL DEFAULT false,
  user_id       uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  usuario_nombre text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS informe_revision_informe_idx ON public.informe_revision (informe_id, created_at);

ALTER TABLE public.informe_revision ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.informe_revision TO service_role;
