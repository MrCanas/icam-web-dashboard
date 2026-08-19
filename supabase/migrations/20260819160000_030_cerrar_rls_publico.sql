-- SEGURIDAD 030 — cerrar el acceso anónimo que dejó abierto la RLS temporal.
--
-- La migración base (20260521100000) creó `temp_allow_all` con FOR ALL
-- USING(true) WITH CHECK(true) y SIN cláusula TO: aplica a TODOS los roles,
-- incluido `anon`, y cubre lectura Y escritura. La 005 solo la retiró de las
-- tablas de Actas. El resto quedó legible —y borrable— desde internet con la
-- anon key del navegador: proyectos (equity, TIR, beneficios), audit_log
-- (emails de usuarios), pm_*, y los logs de carga.
--
-- Además, doce tablas de PM/avance se crearon con SELECT TO public a propósito
-- (020, 022, 024, 026, 028). En su momento se asumió que la lectura pública era
-- inocua; expone cronograma de obra, promociones de Zoho y porcentajes de
-- avance. Se reaprieta todo al rol `authenticated`.
--
-- Cómo lee la app (verificado): el servidor usa service_role, que IGNORA la RLS,
-- así que nada del lado servidor se ve afectado. El navegador lee con el bridge
-- JWT (/api/auth/supabase-token), que emite rol `authenticated`. No hay ninguna
-- lectura de cliente con anon puro. Por tanto:
--   · tablas de negocio → SELECT TO authenticated (la app sigue igual, anon pierde)
--   · logs y auditoría  → sin política de SELECT (solo service_role, que salta RLS)
-- Las escrituras siguen yendo por service_role: no se crea ninguna política de
-- INSERT/UPDATE/DELETE, así que `anon` y `authenticated` no pueden escribir.
--
-- ADITIVA sobre políticas: no toca ni una fila de datos. Idempotente.

-- =============================================================================
-- 1. Retirar las políticas permisivas temporales
-- =============================================================================

DO $$
DECLARE
  t text;
  tablas text[] := ARRAY[
    'proyectos', 'upload_logs', 'pm_activos', 'pm_hitos', 'pm_snapshot_fechas',
    'pm_activo_proyecto_map', 'pm_import_logs', 'monday_sync_logs'
  ];
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('DROP POLICY IF EXISTS temp_allow_all ON public.%I', t);
    END IF;
  END LOOP;
END $$;

DROP POLICY IF EXISTS temp_allow_all_audit ON public.audit_log;

-- =============================================================================
-- 2. Retirar las lecturas públicas deliberadas (se recrean como authenticated)
-- =============================================================================
-- proyectos tenía DOS políticas (temp_allow_all + proyectos_public_read); la
-- segunda no restringía nada porque las permisivas se combinan con OR.

DROP POLICY IF EXISTS proyectos_public_read              ON public.proyectos;
DROP POLICY IF EXISTS pm_hito_catalogo_public_read       ON public.pm_hito_catalogo;
DROP POLICY IF EXISTS pm_snapshots_public_read           ON public.pm_snapshots;
DROP POLICY IF EXISTS pm_activo_snapshot_public_read     ON public.pm_activo_snapshot;
DROP POLICY IF EXISTS maestro_lineas_trimestre_public_read ON public.maestro_lineas_trimestre;
DROP POLICY IF EXISTS maestro_hito_fechas_public_read    ON public.maestro_hito_fechas;
DROP POLICY IF EXISTS pm_snapshot_validacion_public_read ON public.pm_snapshot_validacion;

DO $$
DECLARE
  t text;
  tablas_avance text[] := ARRAY[
    'pm_avance_fase_catalogo', 'pm_promociones', 'pm_activo_promocion_map',
    'pm_avance_obra', 'pm_avance_obra_historico', 'pm_avance_zoho_outbox'
  ];
BEGIN
  FOREACH t IN ARRAY tablas_avance LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_public_read', t);
  END LOOP;
END $$;

-- =============================================================================
-- 3. Lectura solo para sesión (rol authenticated) en las tablas de negocio
-- =============================================================================
-- RLS ya está habilitada en todas (la 020/022/024/026/028 lo hicieron; las de la
-- base también). ENABLE es idempotente por si alguna llegara sin él.

DO $$
DECLARE
  t text;
  tablas_negocio text[] := ARRAY[
    'proyectos',
    'pm_activos', 'pm_hitos', 'pm_snapshot_fechas', 'pm_activo_proyecto_map',
    'pm_hito_catalogo', 'pm_snapshots', 'pm_activo_snapshot',
    'maestro_lineas_trimestre', 'maestro_hito_fechas', 'pm_snapshot_validacion',
    'pm_avance_fase_catalogo', 'pm_promociones', 'pm_activo_promocion_map',
    'pm_avance_obra', 'pm_avance_obra_historico', 'pm_avance_zoho_outbox'
  ];
BEGIN
  FOREACH t IN ARRAY tablas_negocio LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = t AND policyname = t || '_auth_read'
      ) THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',
          t || '_auth_read', t
        );
      END IF;
    END IF;
  END LOOP;
END $$;

-- =============================================================================
-- 4. Logs y auditoría: sin política de SELECT → solo service_role los lee
-- =============================================================================
-- RLS habilitada + ninguna política = ni anon ni authenticated leen; service_role
-- salta RLS y sigue funcionando (es como lee el servidor). No llevan datos que la
-- interfaz muestre al navegador.

DO $$
DECLARE
  t text;
  tablas_log text[] := ARRAY['audit_log', 'upload_logs', 'pm_import_logs', 'monday_sync_logs'];
BEGIN
  FOREACH t IN ARRAY tablas_log LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
