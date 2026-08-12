-- PM 020 — Planificación: catálogo global de hitos + registro de snapshots.
--
-- Habilita que la PMO edite los hitos desde /dashboard/pm/planificacion en vez
-- de subir la hoja OVERVIEW del Excel. El esquema pm_hitos + pm_snapshot_fechas
-- (scripts/supabase/pm_schema.sql) ya es snapshot-nativo; esta migración solo
-- añade los metadatos que faltaban.
--
-- ADITIVA POR DISEÑO: no borra ninguna tabla ni columna. Lo que deja de leerse
-- (pm_hitos.hito, desviacion_*_dias) se conserva porque la ruta de rescate
-- (RPC replace_pm_portfolio ← Excel) las sigue escribiendo.
--
-- Depende de que scripts/supabase/pm_schema.sql se haya ejecutado antes, igual
-- que la migración 008 (project.pm_activo_id → pm_activos).

-- =============================================================================
-- 1. Catálogo global de hitos
-- =============================================================================
-- Absorbe tres listas hoy hardcodeadas en código:
--   - color        ← paleta por nombre de src/modules/pm/logic/pm-hito-palette.ts
--   - es_puntual   ← isPmPuntoHito() de src/modules/pm/logic/pm-viz.ts
--   - el mapeo a la hoja "Tabla madre" del maestro financiero (antes inexistente)

CREATE TABLE IF NOT EXISTS public.pm_hito_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  orden_default int NOT NULL DEFAULT 0,
  color text,
  es_puntual boolean NOT NULL DEFAULT false,
  tabla_madre_columna text,
  tabla_madre_existe boolean NOT NULL DEFAULT false,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.pm_hito_catalogo IS
  'PM: lista maestra de hitos. Cada proyecto activa los que le aplican vía pm_hitos.catalogo_id.';
COMMENT ON COLUMN public.pm_hito_catalogo.es_puntual IS
  'Hito sin duración: el Gantt le dibuja siempre una barra de un trimestre exacto.';
COMMENT ON COLUMN public.pm_hito_catalogo.tabla_madre_columna IS
  'Cabecera en la hoja "Tabla madre" del maestro. REAL si tabla_madre_existe, PROPUESTA si no: documenta qué columna crear el día que se añada.';
COMMENT ON COLUMN public.pm_hito_catalogo.tabla_madre_existe IS
  'true = la columna ya existe hoy en la hoja (los 8 hitos de DW-EL). false = hito solo de PM.';

-- =============================================================================
-- 2. Registro de snapshots
-- =============================================================================
-- Hasta ahora snapshot_code solo existía como texto suelto dentro de
-- pm_snapshot_fechas, sin metadatos. Esta tabla es lo que permite decidir qué
-- snapshot se publica en el dashboard (el check por columna de la rejilla).

CREATE TABLE IF NOT EXISTS public.pm_snapshots (
  snapshot_code text PRIMARY KEY,
  label text,
  visible_en_dashboard boolean NOT NULL DEFAULT true,
  orden int NOT NULL DEFAULT 0,
  congelado_at timestamptz,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.pm_snapshots IS
  'PM: un snapshot = un trimestre reportado por la PMO. Congelar copia pm_hitos.fecha_actual a pm_snapshot_fechas.';
COMMENT ON COLUMN public.pm_snapshots.visible_en_dashboard IS
  'Publica el snapshot en Overview y detalle. Distinto de ocultar la columna en la rejilla, que es preferencia local del usuario.';
COMMENT ON COLUMN public.pm_snapshots.label IS
  'Override opcional de formatSnapshotLabel() (pm-viz.ts). NULL = etiqueta calculada.';

-- =============================================================================
-- 3. pm_activos: orden propio y archivado
-- =============================================================================
-- El orden del Gantt está hoy hardcodeado en PM_PROJECT_ORDER
-- (src/modules/pm/ui/PmGanttOverview.tsx): cualquier proyecto dado de alta por
-- la PMO quedaría fuera del gráfico. La columna lo sustituye.

ALTER TABLE public.pm_activos
  ADD COLUMN IF NOT EXISTS orden int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS archivado_at timestamptz;

COMMENT ON COLUMN public.pm_activos.orden IS
  'Orden en el Gantt del Overview. Sustituye a PM_PROJECT_ORDER (antes hardcodeado).';
COMMENT ON COLUMN public.pm_activos.archivado_at IS
  'Baja lógica: nunca se borran activos. NULL = activo.';

CREATE INDEX IF NOT EXISTS idx_pm_activos_orden
  ON public.pm_activos (orden);

-- NOTA: pm_activos.tipo_uso_activo mantiene su CHECK IN ('APT','RESIDENCIAL_LIBRE').
-- Limita el alta de proyectos a esos dos usos. Se deja intacto a propósito: ampliarlo
-- exige saber qué usos reales necesita la PMO, y no se inventan valores.

-- =============================================================================
-- 4. pm_hitos → catálogo
-- =============================================================================
-- La columna `hito` (texto) y su UNIQUE (activo_id, hito) SE CONSERVAN: el RPC
-- replace_pm_portfolio las sigue escribiendo. catalogo_id se puebla en el
-- backfill (scripts/pm/backfill-planificacion.ts), por eso nace nullable.

ALTER TABLE public.pm_hitos
  ADD COLUMN IF NOT EXISTS catalogo_id uuid
  REFERENCES public.pm_hito_catalogo (id) ON DELETE RESTRICT;

COMMENT ON COLUMN public.pm_hitos.catalogo_id IS
  'FK al catálogo global. Nullable durante la transición: replace_pm_portfolio (Excel) no lo rellena, hay que reejecutar el backfill tras un reemplazo.';

CREATE INDEX IF NOT EXISTS idx_pm_hitos_catalogo
  ON public.pm_hitos (catalogo_id)
  WHERE catalogo_id IS NOT NULL;

-- Un proyecto no puede activar dos veces el mismo hito del catálogo.
-- Los NULL son distintos entre sí en Postgres, así que no estorba antes del backfill.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pm_hitos_activo_catalogo
  ON public.pm_hitos (activo_id, catalogo_id)
  WHERE catalogo_id IS NOT NULL;

-- =============================================================================
-- 5. pm_activo_proyecto_map: permitir N:1 (el caso PC25)
-- =============================================================================
-- PM separa PC25 en PC25-CP6 y PC25-26-RESIDENCIAL (mismo edificio, dos usos);
-- el maestro financiero lo mantiene unido como PC25. El UNIQUE original sobre
-- proyecto_financiero_key impedía que ambos activos apuntasen al mismo proyecto.
-- La PK sobre pm_activo_id se mantiene: un activo de PM → como mucho un proyecto
-- financiero. Es N:1, no N:M.

DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    WHERE ns.nspname = 'public'
      AND rel.relname = 'pm_activo_proyecto_map'
      AND con.contype = 'u'
      AND (
        SELECT array_agg(att.attname::text ORDER BY att.attname::text)
        FROM unnest(con.conkey) AS k
        JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = k
      ) = ARRAY['proyecto_financiero_key']::text[]
  LOOP
    EXECUTE format(
      'ALTER TABLE public.pm_activo_proyecto_map DROP CONSTRAINT %I', c.conname
    );
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_pm_map_proyecto_financiero
  ON public.pm_activo_proyecto_map (proyecto_financiero_key);

COMMENT ON COLUMN public.pm_activo_proyecto_map.proyecto_financiero_key IS
  'Valor de proyectos.proyecto (hoja "Tabla madre"). NO es único: varios activos de PM pueden mapear al mismo proyecto financiero (PC25). Se rellena a mano en /dashboard/pm/proyectos.';

-- =============================================================================
-- 6. RLS — lectura pública, coherente con pm_schema.sql
-- =============================================================================
-- La escritura va por service role desde Server Actions (igual que Actas), así
-- que no se crean policies de INSERT/UPDATE/DELETE.

ALTER TABLE public.pm_hito_catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_snapshots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pm_hito_catalogo' AND policyname = 'pm_hito_catalogo_public_read'
  ) THEN
    CREATE POLICY "pm_hito_catalogo_public_read"
      ON public.pm_hito_catalogo FOR SELECT TO public USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pm_snapshots' AND policyname = 'pm_snapshots_public_read'
  ) THEN
    CREATE POLICY "pm_snapshots_public_read"
      ON public.pm_snapshots FOR SELECT TO public USING (true);
  END IF;
END $$;

-- Recarga la caché de esquema de PostgREST para exponer lo nuevo al instante.
NOTIFY pgrst, 'reload schema';
