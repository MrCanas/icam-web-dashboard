-- Actas P5 — Adjuntos (imágenes) por elemento/sub-elemento.
-- El binario vive en Storage (bucket privado 'actas-attachments'); aquí solo
-- los metadatos. Idempotente.

CREATE TABLE IF NOT EXISTS public.actas_attachment (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  element_id    uuid NOT NULL REFERENCES public.element (id) ON DELETE CASCADE,
  storage_path  text NOT NULL,
  file_name     text NOT NULL,
  mime_type     text NOT NULL,
  size_bytes    bigint NOT NULL,
  uploaded_by   uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS actas_attachment_element_id_idx
  ON public.actas_attachment (element_id);

COMMENT ON TABLE public.actas_attachment IS
  'Actas: adjuntos (imágenes) por elemento. Binario en Storage (actas-attachments), privado.';

ALTER TABLE public.actas_attachment ENABLE ROW LEVEL SECURITY;

-- Ver: quien puede acceder al elemento. Subir/borrar: idem (la edición real la
-- controla la server action vía checkWriteAccess + service-role en Storage).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'actas_attachment'
      AND policyname = 'actas_attachment_select'
  ) THEN
    CREATE POLICY actas_attachment_select ON public.actas_attachment
      FOR SELECT TO authenticated
      USING (public.user_can_access_element(element_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'actas_attachment'
      AND policyname = 'actas_attachment_insert'
  ) THEN
    CREATE POLICY actas_attachment_insert ON public.actas_attachment
      FOR INSERT TO authenticated
      WITH CHECK (
        public.user_can_access_element(element_id)
        AND uploaded_by = (SELECT auth.uid())
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'actas_attachment'
      AND policyname = 'actas_attachment_delete'
  ) THEN
    CREATE POLICY actas_attachment_delete ON public.actas_attachment
      FOR DELETE TO authenticated
      USING (public.user_can_access_element(element_id));
  END IF;
END $$;
