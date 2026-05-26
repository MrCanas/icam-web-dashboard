-- Actas 007 — Origen de la entrada (Monday snapshot vs UI).

ALTER TABLE public.log_entry
  ADD COLUMN IF NOT EXISTS source text;

COMMENT ON COLUMN public.log_entry.source IS
  'Origen: snapshot (migración Monday), ui (dashboard Actas), etc.';
