-- PERF 042 — agregados de actas calculados en la base de datos.
--
-- La carga de un acta se bajaba TODO el log_entry del proyecto (con content y
-- sin límite) para quedarse con la última entrada de cada elemento, y la
-- cabecera encadenaba category → element → log_entry → count para pintar
-- «Última actividad» y «Elementos». Además, PostgREST corta a 1000 filas: en
-- proyectos con mucho histórico podía faltar la última entrada de elementos.
--
-- Solo añade funciones; no toca tablas ni datos. El código cae a las consultas
-- anteriores si esta migración no está aplicada.

-- ---------------------------------------------------------------------------
-- Última entrada (no borrada) de cada elemento pedido.
-- LATERAL + LIMIT 1 usa log_entry_element_active_idx (004): una lectura de
-- índice por elemento, independiente del tamaño del histórico.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.actas_last_log_entries(p_element_ids uuid[])
RETURNS TABLE (
  id uuid,
  element_id uuid,
  content text,
  entry_date timestamptz,
  author_id uuid,
  source text
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT l.id, l.element_id, l.content, l.entry_date, l.author_id, l.source
    FROM unnest(p_element_ids) AS e(element_id)
    CROSS JOIN LATERAL (
      SELECT le.id, le.element_id, le.content, le.entry_date, le.author_id, le.source
        FROM public.log_entry le
       WHERE le.element_id = e.element_id
         AND le.deleted_at IS NULL
       -- Desempate estable: las entradas importadas de Monday comparten fecha.
       ORDER BY le.entry_date DESC, le.created_at DESC, le.id DESC
       LIMIT 1
    ) l;
$$;

COMMENT ON FUNCTION public.actas_last_log_entries IS
  'PERF: última entrada no borrada por elemento. Sustituye a descargar todo el log del proyecto al pintar el Operativo.';

-- ---------------------------------------------------------------------------
-- Cabecera del proyecto: nº de elementos activos y fecha de la última entrada.
-- Misma semántica que la versión por pasos: solo categorías y elementos no
-- archivados; la última fecha no filtra deleted_at (como antes).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.actas_project_header_stats(p_project_id uuid)
RETURNS TABLE (element_count bigint, last_log_entry_at timestamptz)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH elementos AS (
    SELECT e.id
      FROM public.element e
      JOIN public.category c ON c.id = e.category_id
     WHERE c.project_id = p_project_id
       AND c.archived_at IS NULL
       AND e.archived_at IS NULL
  )
  SELECT
    (SELECT count(*) FROM elementos),
    (SELECT max(l.entry_date)
       FROM elementos el
       CROSS JOIN LATERAL (
         SELECT le.entry_date
           FROM public.log_entry le
          WHERE le.element_id = el.id
          ORDER BY le.entry_date DESC
          LIMIT 1
       ) l);
$$;

COMMENT ON FUNCTION public.actas_project_header_stats IS
  'PERF: nº de elementos activos y última fecha de log de un proyecto, en una llamada. Para la cabecera de actas.';

REVOKE ALL ON FUNCTION public.actas_last_log_entries(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.actas_project_header_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.actas_last_log_entries(uuid[]) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.actas_project_header_stats(uuid) TO service_role, authenticated;

NOTIFY pgrst, 'reload schema';
