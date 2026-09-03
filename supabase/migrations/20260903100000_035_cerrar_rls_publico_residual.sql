-- SEGURIDAD 035 — cerrar lo que la 030 dejó abierto.
--
-- La 030 cerró `temp_allow_all` en las ocho tablas de su lista y les creó su
-- política `_auth_read`, pero su sección 2 —la que retira las lecturas públicas
-- deliberadas— solo nombraba las tablas de `maestro_*`, `pm_snapshot*` y el
-- bloque de avance de obra. Cinco `*_public_read` sobrevivieron:
--
--   pm_activos              (9 filas)    pm_activos_public_read
--   pm_hitos                (131 filas)  pm_hitos_public_read
--   pm_snapshot_fechas      (416 filas)  pm_snapshot_fechas_public_read
--   pm_import_logs          (1 fila)     pm_import_logs_public_read
--   pm_activo_proyecto_map  (0 filas)    pm_map_public_read   ← nombre fuera de convención
--
-- Las políticas de RLS se combinan con OR: tener `_auth_read` al lado no cierra
-- nada mientras exista una `_public_read` con USING(true) sobre el rol `public`.
-- Comprobado con la anon key real tras aplicar la 030: `pm_hitos` seguía
-- devolviendo sus 131 filas y `pm_snapshot_fechas` sus 416 — es decir, el
-- cronograma completo de PM, que es justo lo que la PMO edita.
--
-- Además `log_entry_entrydate_backup_20260528` (770 filas, copia de seguridad de
-- las fechas de actas del 28-05) es la única tabla del esquema `public` que nunca
-- tuvo RLS habilitada, así que PostgREST la servía entera a cualquiera.
--
-- ADITIVA sobre datos: no toca ni una fila. Solo retira políticas permisivas y
-- habilita RLS. Idempotente.
--
-- Por qué el fallo pasó desapercibido: `scripts/pm/apply-migration-030.ts` contaba
-- las políticas restantes por patrón de nombre y probaba con la anon key solo
-- cinco tablas, ninguna de las cinco que quedaban. Su script hermano (036 no
-- existe: es `apply-migration-035.ts`) verifica sin depender del nombre.

-- =============================================================================
-- 1. Retirar las cinco lecturas públicas residuales
-- =============================================================================

DROP POLICY IF EXISTS pm_activos_public_read         ON public.pm_activos;
DROP POLICY IF EXISTS pm_hitos_public_read           ON public.pm_hitos;
DROP POLICY IF EXISTS pm_snapshot_fechas_public_read ON public.pm_snapshot_fechas;
DROP POLICY IF EXISTS pm_import_logs_public_read     ON public.pm_import_logs;
DROP POLICY IF EXISTS pm_map_public_read             ON public.pm_activo_proyecto_map;

-- =============================================================================
-- 2. La tabla de backup: RLS habilitada y sin política → solo service_role
-- =============================================================================
-- No la lee la interfaz; es una copia de rescate de `log_entry.entry_date`.
-- Se conserva tal cual (norma de la casa: no se borra nada sin validar), pero
-- deja de estar publicada.

ALTER TABLE IF EXISTS public.log_entry_entrydate_backup_20260528
  ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 3. Red de seguridad: que no vuelva a colarse una política pública
-- =============================================================================
-- Barrido agnóstico al nombre. Si al terminar queda cualquier política del
-- esquema `public` que alcance a los roles `public` o `anon`, la migración falla
-- en vez de dar por bueno un cierre a medias — que es exactamente lo que hizo
-- la 030.

DO $$
DECLARE
  restantes text;
BEGIN
  SELECT string_agg(format('%s.%s (%s)', tablename, policyname, cmd), ', ' ORDER BY tablename)
    INTO restantes
    FROM pg_policies
   WHERE schemaname = 'public'
     AND roles::text[] && ARRAY['public', 'anon'];

  IF restantes IS NOT NULL THEN
    RAISE EXCEPTION 'Siguen existiendo políticas abiertas a public/anon: %', restantes;
  END IF;
END $$;

-- Y que ninguna tabla del esquema se quede sin RLS, que es la otra forma de
-- estar expuesto sin tener ninguna política.

DO $$
DECLARE
  sin_rls text;
BEGIN
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname)
    INTO sin_rls
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relkind = 'r'
     AND NOT c.relrowsecurity;

  IF sin_rls IS NOT NULL THEN
    RAISE EXCEPTION 'Tablas sin RLS habilitada: %', sin_rls;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
