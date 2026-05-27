-- Actas 010 — Reconstrucción de snapshot operativo a fecha histórica.

CREATE OR REPLACE FUNCTION public.reconstruct_project_at_date(
  p_project_id uuid,
  p_as_of_date timestamptz
)
RETURNS TABLE (
  element_id uuid,
  element_name text,
  category_id uuid,
  status_at_date text,
  last_log_content text,
  last_log_entry_date timestamptz,
  last_log_author_id uuid
)
LANGUAGE sql
STABLE
AS $$
  WITH last_entry_per_element AS (
    SELECT DISTINCT ON (le.element_id)
      le.element_id,
      le.content,
      le.entry_date,
      le.author_id,
      COALESCE(
        (
          SELECT le2.status_after
          FROM public.log_entry le2
          WHERE le2.element_id = le.element_id
            AND le2.entry_date <= p_as_of_date
            AND le2.deleted_at IS NULL
            AND le2.status_after IS NOT NULL
          ORDER BY le2.entry_date DESC
          LIMIT 1
        ),
        'not_started'
      ) AS status_at_date
    FROM public.log_entry le
    JOIN public.element e ON e.id = le.element_id
    JOIN public.category c ON c.id = e.category_id
    WHERE c.project_id = p_project_id
      AND le.entry_date <= p_as_of_date
      AND le.deleted_at IS NULL
      AND e.archived_at IS NULL
    ORDER BY le.element_id, le.entry_date DESC
  )
  SELECT
    e.id AS element_id,
    e.name AS element_name,
    c.id AS category_id,
    COALESCE(lpe.status_at_date, 'not_started') AS status_at_date,
    lpe.content AS last_log_content,
    lpe.entry_date AS last_log_entry_date,
    lpe.author_id AS last_log_author_id
  FROM public.element e
  JOIN public.category c ON c.id = e.category_id
  LEFT JOIN last_entry_per_element lpe ON lpe.element_id = e.id
  WHERE c.project_id = p_project_id
    AND e.archived_at IS NULL
    AND c.archived_at IS NULL
  ORDER BY c.order_index, e.order_index;
$$;

GRANT EXECUTE ON FUNCTION public.reconstruct_project_at_date(uuid, timestamptz) TO authenticated;

COMMENT ON FUNCTION public.reconstruct_project_at_date IS
  'Actas P9.3: status y última entrada por elemento a una fecha (snapshot histórico).';
