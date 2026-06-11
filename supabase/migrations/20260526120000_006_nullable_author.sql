-- Actas 006 — author_id opcional en log_entry (ítems Monday sin Owner).

-- Estado previo (migración 004): author_id uuid NOT NULL → auth.users

DO $$
DECLARE
  col_nullable text;
BEGIN
  SELECT c.is_nullable INTO col_nullable
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'log_entry'
    AND c.column_name = 'author_id';

  IF col_nullable IS NULL THEN
    RAISE EXCEPTION 'log_entry.author_id: columna no encontrada';
  END IF;

  IF col_nullable = 'NO' THEN
    ALTER TABLE public.log_entry
      ALTER COLUMN author_id DROP NOT NULL;
    RAISE NOTICE 'log_entry.author_id: NOT NULL → nullable';
  ELSE
    RAISE NOTICE 'log_entry.author_id: ya nullable, sin ALTER';
  END IF;
END $$;

COMMENT ON COLUMN public.log_entry.author_id IS
  'Usuario autor de la entrada. NULL si el ítem Monday no tenía Owner asignado (migración histórica).';

CREATE INDEX IF NOT EXISTS log_entry_author_idx
  ON public.log_entry (author_id)
  WHERE author_id IS NOT NULL;
