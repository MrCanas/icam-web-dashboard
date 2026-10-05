-- 046 — registro de exportaciones del informe trimestral.
--
-- Cada vez que alguien saca el PDF (descarga hecha en el servidor o impresión
-- desde la vista de impresión) queda una fila: quién, cuándo, con qué versión y
-- estado, qué incidencias listó el validador y si tuvo que marcar «Estoy
-- seguro» para seguir. El editor lo enseña al final del informe.
--
-- Aditiva e idempotente. Mismo patrón que informe_cambio (043): RLS sin
-- políticas, solo service role desde el servidor.

CREATE TABLE IF NOT EXISTS public.informe_exportacion (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  informe_id     text NOT NULL REFERENCES public.informe (id) ON DELETE CASCADE,
  user_id        uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  -- Nombre y correo tal como eran al exportar: el registro no cambia si cambia el usuario.
  usuario_nombre text NOT NULL DEFAULT '',
  usuario_email  text NOT NULL DEFAULT '',
  -- 'pdf' (descarga hecha en el servidor) o 'impresion' (diálogo de impresión del navegador).
  medio          text NOT NULL CHECK (medio IN ('pdf', 'impresion')),
  version        integer NOT NULL,
  estado         text NOT NULL,
  -- Lo que listó el validador antes de exportar: [{nivel, slide, texto}].
  incidencias    jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- true si había incidencias y la persona marcó «Estoy seguro» para seguir.
  confirmado     boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS informe_exportacion_informe_idx ON public.informe_exportacion (informe_id, created_at);

ALTER TABLE public.informe_exportacion ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.informe_exportacion TO service_role;
