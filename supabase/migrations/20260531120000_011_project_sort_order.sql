-- Orden global de proyectos activos en el panel lateral de Actas.

ALTER TABLE public.project
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.project.sort_order IS
  'Orden global en el panel lateral de Actas (compartido entre usuarios).';

WITH ranked AS (
  SELECT
    id,
    (ROW_NUMBER() OVER (ORDER BY name ASC, code ASC) - 1)::integer AS rn
  FROM public.project
  WHERE archived_at IS NULL
)
UPDATE public.project AS p
SET sort_order = ranked.rn
FROM ranked
WHERE p.id = ranked.id;

CREATE INDEX IF NOT EXISTS project_active_sort_order_idx
  ON public.project (sort_order)
  WHERE archived_at IS NULL;
