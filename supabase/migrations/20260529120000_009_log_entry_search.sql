-- Actas 009 — Búsqueda full-text en log_entry (español + GIN).

ALTER TABLE public.log_entry
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('spanish', coalesce(content, ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS log_entry_search_idx
  ON public.log_entry USING GIN (search_vector);

CREATE OR REPLACE FUNCTION public.search_log_entries(
  p_project_id uuid,
  p_query text,
  p_limit int DEFAULT 50
)
RETURNS TABLE (
  log_entry_id uuid,
  element_id uuid,
  element_name text,
  category_id uuid,
  category_name text,
  content text,
  entry_date timestamptz,
  author_id uuid,
  headline text,
  rank real
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    le.id AS log_entry_id,
    e.id AS element_id,
    e.name AS element_name,
    c.id AS category_id,
    c.name AS category_name,
    le.content,
    le.entry_date,
    le.author_id,
    ts_headline(
      'spanish',
      le.content,
      plainto_tsquery('spanish', p_query),
      'StartSel=<<mark>>, StopSel=<</mark>>, MaxWords=30, MinWords=10'
    ) AS headline,
    ts_rank(le.search_vector, plainto_tsquery('spanish', p_query)) AS rank
  FROM public.log_entry le
  JOIN public.element e ON e.id = le.element_id
  JOIN public.category c ON c.id = e.category_id
  WHERE c.project_id = p_project_id
    AND le.deleted_at IS NULL
    AND e.archived_at IS NULL
    AND le.search_vector @@ plainto_tsquery('spanish', p_query)
  ORDER BY rank DESC, le.entry_date DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.search_log_entries(uuid, text, int) TO authenticated;

COMMENT ON FUNCTION public.search_log_entries IS
  'Actas P9.2: búsqueda full-text de log_entry por proyecto (config spanish, highlights ts_headline).';

COMMENT ON COLUMN public.log_entry.search_vector IS
  'Vector ts para búsqueda full-text (GENERATED, español).';
