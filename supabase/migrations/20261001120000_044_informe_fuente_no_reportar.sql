-- =============================================================================
-- 044 — Informes trimestrales: apartado «No reportar»
-- =============================================================================
-- La PM indica en el paso 2 lo que no debe aparecer en el informe aunque esté
-- en la información aportada (actas, planificación, documentos, informe
-- anterior). Se guarda como una fila más de informe_fuente, de tipo
-- «no_reportar» (una por informe, como las notas), y se envía a Claude como
-- instrucción, no como fuente.
--
-- Solo amplía la restricción de tipos. Aditiva e idempotente: no toca filas.

ALTER TABLE public.informe_fuente DROP CONSTRAINT IF EXISTS informe_fuente_tipo_chk;

ALTER TABLE public.informe_fuente
  ADD CONSTRAINT informe_fuente_tipo_chk
  CHECK (tipo IN ('notas', 'documento', 'actas', 'planificacion', 'previo', 'correccion', 'no_reportar'));
