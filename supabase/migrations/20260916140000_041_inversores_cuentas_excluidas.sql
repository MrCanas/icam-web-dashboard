-- Inversores 041 — cuentas que no cuentan.
--
-- El CRM tiene cuentas de inversión que no son inversores: pruebas, cuentas
-- técnicas y alguna interna. Suman de verdad —«Impar Pruebas SL» arrastra
-- 15,9 M€ de aportes y 11,7 M€ de repartos— así que dejarlas dentro no es un
-- detalle cosmético: mueve los KPIs y el reparto por tramos.
--
-- Se marcan en DATOS y no en código a propósito, por el mismo motivo que el
-- catálogo de campos: mañana habrá otra cuenta de prueba y marcarla tiene que
-- ser un UPDATE, no un despliegue. Y no se pueden detectar por el nombre: tres
-- de las siete («Alejandro Graffe (Personal)», «CUENTA MASTER», «Skyline Grupo
-- Inmobiliario, S.L.») no dicen en ninguna parte que sean pruebas.
--
-- El sync NO pisa estas columnas: su upsert solo escribe las columnas mapeadas
-- desde Zoho, y estas dos no lo están. Como la marca queda pegada al `zoho_id`,
-- sobrevive a que alguien renombre la cuenta en el CRM.
--
-- ADITIVA e idempotente. No borra nada: las filas siguen ahí y se pueden volver
-- a contar poniendo `excluida = false`.

ALTER TABLE public.inv_cuentas
  ADD COLUMN IF NOT EXISTS excluida        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS excluida_motivo text;

COMMENT ON COLUMN public.inv_cuentas.excluida IS
  'La cuenta no entra en KPIs, gráficas ni tablas. Marcada a mano; el sync no la toca.';

CREATE INDEX IF NOT EXISTS inv_cuentas_excluida_idx
  ON public.inv_cuentas (excluida) WHERE borrado_at IS NULL;

-- Se marca por NOMBRE porque es lo que se ve en la pantalla y es como se
-- identificaron. A partir de aquí la marca vive pegada al zoho_id.
UPDATE public.inv_cuentas
   SET excluida = true,
       excluida_motivo = 'Cuenta de pruebas o técnica (revisión 2026-09-16)'
 WHERE excluida = false
   AND nombre IN (
     'TEST CUENTA JCV_Updated',
     'Impar Pruebas SL',
     'TEST_CUENTAINV2',
     'Alejandro Graffe (Personal)',
     'CUENTA MASTER',
     'Skyline Grupo Inmobiliario, S.L.',
     'TEST ISABELLA PARIS CUENTA'
   );
