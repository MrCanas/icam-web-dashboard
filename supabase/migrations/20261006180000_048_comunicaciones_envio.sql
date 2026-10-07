-- Comunicaciones 048 — lo que le faltaba a las tablas para poder enviar.
--
-- La 047 dejó las columnas de los controles (revisión, prueba, confirmación).
-- Al construir el envío hacen falta cuatro cosas más, todas para poder responder
-- después a «¿qué salió exactamente, a quién y por dónde?»:
--
--   · que la prueba ENVIADA y la prueba VISTA sean dos hechos distintos: sin
--     esto, «la he visto bien» se podría marcar sin haber enviado ninguna;
--   · a qué direcciones salió de verdad cada correo, que en modo pruebas no son
--     las de la lista sino la de quien envía;
--   · por qué pasarela salió (la real de Zoho o la simulada);
--   · un estado más para el destinatario al que no se escribe porque todas sus
--     direcciones ya recibieron ese mismo correo por otra cuenta.
--
-- ADITIVA e idempotente. Lo único que toca de lo ya existente es el CHECK de
-- `com_destinatario.estado_envio`, que se ensancha con `omitido`: ningún valor
-- que hoy sea válido deja de serlo.

-- =============================================================================
-- 1. com_comunicacion — la prueba enviada y la pasarela
-- =============================================================================
ALTER TABLE public.com_comunicacion
  ADD COLUMN IF NOT EXISTS prueba_enviada_at           timestamptz,
  ADD COLUMN IF NOT EXISTS prueba_enviada_por_email    text,
  ADD COLUMN IF NOT EXISTS prueba_enviada_plantilla_id text,
  ADD COLUMN IF NOT EXISTS prueba_message_id           text,
  ADD COLUMN IF NOT EXISTS pasarela                    text;

COMMENT ON COLUMN public.com_comunicacion.prueba_enviada_plantilla_id IS
  'Plantilla con la que se envió la última prueba. «Probada» solo vale si coincide con la elegida.';
COMMENT ON COLUMN public.com_comunicacion.pasarela IS
  'Por dónde salió: zoho (correos reales) o simulada (no salió nada).';

-- =============================================================================
-- 2. com_destinatario — a quién salió de verdad, y el estado «omitido»
-- =============================================================================
ALTER TABLE public.com_destinatario
  ADD COLUMN IF NOT EXISTS enviado_para jsonb,
  ADD COLUMN IF NOT EXISTS pasarela     text;

COMMENT ON COLUMN public.com_destinatario.enviado_para IS
  '{ para, copia, copiaOculta, remitente } tal como salió. En modo pruebas no coincide con `para`.';

ALTER TABLE public.com_destinatario
  DROP CONSTRAINT IF EXISTS com_destinatario_estado_envio_check;

ALTER TABLE public.com_destinatario
  ADD CONSTRAINT com_destinatario_estado_envio_check
  CHECK (estado_envio IN ('pendiente', 'sin_destinatario', 'enviando', 'enviado', 'error', 'omitido'));
