-- Actas 008 — Vínculo opcional proyecto Actas ↔ activo PM (Gantt).

ALTER TABLE public.project
  ADD COLUMN IF NOT EXISTS pm_activo_id uuid
  REFERENCES public.pm_activos (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS project_pm_activo_id_idx
  ON public.project (pm_activo_id)
  WHERE pm_activo_id IS NOT NULL;

COMMENT ON COLUMN public.project.pm_activo_id IS
  'FK opcional a pm_activos (Portfolio Management / Gantt).';
