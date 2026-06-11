-- Actas P4 — Columna de avance (%) y marca temporal de completado en elementos.
-- Additiva e idempotente: segura de re-ejecutar.

-- ---------------------------------------------------------------------------
-- progress: avance 0–100 (% ) para elementos y sub-elementos (misma tabla).
-- ---------------------------------------------------------------------------
ALTER TABLE public.element
  ADD COLUMN IF NOT EXISTS progress integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'element_progress_range_check'
      AND conrelid = 'public.element'::regclass
  ) THEN
    ALTER TABLE public.element
      ADD CONSTRAINT element_progress_range_check
      CHECK (progress >= 0 AND progress <= 100);
  END IF;
END $$;

COMMENT ON COLUMN public.element.progress IS
  'Avance 0–100 (%) del elemento/sub-elemento (Actas P4).';

-- ---------------------------------------------------------------------------
-- completed_at: instante en que el elemento pasó a estado "done" (Hecho).
-- Backfill a now() para lo ya marcado Hecho sin marca previa.
-- ---------------------------------------------------------------------------
ALTER TABLE public.element
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

UPDATE public.element
SET completed_at = now()
WHERE status = 'done'
  AND completed_at IS NULL;

COMMENT ON COLUMN public.element.completed_at IS
  'Instante en que el elemento se marcó como Hecho; NULL si está activo (Actas P4).';
