-- Actas P1.5 — Log de entradas (trazabilidad) y sincronización de estado del elemento.

-- ---------------------------------------------------------------------------
-- log_entry
-- ---------------------------------------------------------------------------
CREATE TABLE public.log_entry (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  element_id    uuid NOT NULL
    REFERENCES public.element (id) ON DELETE RESTRICT,
  author_id     uuid NOT NULL
    REFERENCES auth.users (id) ON DELETE RESTRICT,
  content       text NOT NULL,
  status_before text,
  status_after  text,
  entry_date    timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  edited_at     timestamptz,
  deleted_at    timestamptz,
  CONSTRAINT log_entry_status_pair_check CHECK (
    (status_before IS NULL AND status_after IS NULL)
    OR (status_before IS NOT NULL AND status_after IS NOT NULL)
  ),
  CONSTRAINT log_entry_status_before_check CHECK (
    status_before IS NULL
    OR status_before IN ('not_started', 'working_on_it', 'stuck', 'done')
  ),
  CONSTRAINT log_entry_status_after_check CHECK (
    status_after IS NULL
    OR status_after IN ('not_started', 'working_on_it', 'stuck', 'done')
  )
);

-- Histórico por elemento (última entrada eficiente con element_id + entry_date DESC).
CREATE INDEX log_entry_element_entry_date_idx
  ON public.log_entry (element_id, entry_date DESC);

-- Vistas de acta por rango temporal.
CREATE INDEX log_entry_entry_date_idx
  ON public.log_entry (entry_date DESC);

CREATE INDEX log_entry_element_active_idx
  ON public.log_entry (element_id, entry_date DESC)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Sincronizar element.status cuando el log registra un cambio de estado
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_entry_sync_element_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL OR NEW.status_after IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.element
  SET
    status = NEW.status_after,
    updated_at = now()
  WHERE id = NEW.element_id
    AND status IS DISTINCT FROM NEW.status_after;

  RETURN NEW;
END;
$$;

CREATE TRIGGER log_entry_sync_element_status_trg
  AFTER INSERT ON public.log_entry
  FOR EACH ROW
  EXECUTE FUNCTION public.log_entry_sync_element_status();

-- ---------------------------------------------------------------------------
-- RLS (portal pattern — política permisiva temporal)
-- ---------------------------------------------------------------------------
ALTER TABLE public.log_entry ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'log_entry'
      AND policyname = 'temp_allow_all'
  ) THEN
    CREATE POLICY temp_allow_all ON public.log_entry
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE public.log_entry IS 'Actas: entrada de log; soft-delete con deleted_at (histórico conservado).';
COMMENT ON COLUMN public.log_entry.deleted_at IS 'Borrado lógico; la fila permanece para trazabilidad.';
COMMENT ON INDEX public.log_entry_element_entry_date_idx IS 'Última entrada por elemento: WHERE element_id = ? ORDER BY entry_date DESC LIMIT 1';
