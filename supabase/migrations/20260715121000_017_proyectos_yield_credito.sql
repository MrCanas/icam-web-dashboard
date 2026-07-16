-- Financiero 017 — Campos entry_yield / exit_yield / credito_total en proyectos.
-- Alimentan las gráficas de la subpágina Overview (Resumen Global del maestro):
--   - entry_yield  → col DD "Entry Yield"      (fracción, p.ej. 0.048)
--   - exit_yield   → col DE "Exit Yield"       (fracción)
--   - credito_total→ col DN "Crédito total"    (€)
-- Idempotente (ADD COLUMN IF NOT EXISTS) y solo columnas nullable: no reescribe
-- filas existentes. Los valores se pueblan al re-cargar el Excel (RPC
-- replace_proyectos, ver scripts/supabase/replace_proyectos.sql).

ALTER TABLE public.proyectos
  ADD COLUMN IF NOT EXISTS entry_yield double precision,
  ADD COLUMN IF NOT EXISTS exit_yield double precision,
  ADD COLUMN IF NOT EXISTS credito_total double precision;

COMMENT ON COLUMN public.proyectos.entry_yield IS
  'Financiero: yield de entrada (Entry Yield, col DD del maestro). Fracción. NULL = sin dato.';
COMMENT ON COLUMN public.proyectos.exit_yield IS
  'Financiero: yield de salida (Exit Yield, col DE del maestro). Fracción. NULL = sin dato.';
COMMENT ON COLUMN public.proyectos.credito_total IS
  'Financiero: crédito total del vehículo (col DN del maestro), en euros. NULL = sin dato.';

-- Recarga la caché de esquema de PostgREST para exponer las columnas al instante.
NOTIFY pgrst, 'reload schema';
