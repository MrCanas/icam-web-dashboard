-- Comunicaciones 049 — seguimiento de aperturas y clics, ensayo general y reenvío.
--
-- Zoho no sirve como fuente de analítica: su API no expone los correos de 102
-- de las 164 cuentas de inversión, y en las que sí, desde agosto de 2026 no
-- registra una sola apertura. Así que el seguimiento lo hace el portal: monta
-- él el correo, le pone una imagen de apertura y unos enlaces propios de cada
-- destinatario, y anota cada vez que alguien los carga.
--
-- Esta migración crea dónde se guarda eso, más lo que necesitan las
-- validaciones nuevas (el ensayo general antes de confirmar, el tope diario) y
-- el reenvío de una comunicación a parte de sus destinatarios.
--
-- ADITIVA e idempotente. Lo único que toca de lo ya existente es el CHECK de
-- `com_comunicacion.audiencia`, que se ensancha con `reenvio`: ningún valor que
-- hoy sea válido deja de serlo. NO se guarda la IP de nadie.

-- =============================================================================
-- 1. com_ajustes — el tope diario
-- =============================================================================
-- Zoho limita a 100 correos al día por usuario. El tope del portal no puede ser
-- mayor: pasarse es que Zoho empiece a rechazar correos a mitad de un envío.
ALTER TABLE public.com_ajustes
  ADD COLUMN IF NOT EXISTS limite_diario integer NOT NULL DEFAULT 100;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'com_ajustes_limite_diario_chk') THEN
    ALTER TABLE public.com_ajustes
      ADD CONSTRAINT com_ajustes_limite_diario_chk CHECK (limite_diario BETWEEN 1 AND 100);
  END IF;
END $$;

-- =============================================================================
-- 2. com_comunicacion — cómo salió, el ensayo y de qué envío viene
-- =============================================================================
ALTER TABLE public.com_comunicacion
  -- 'pruebas' o 'real', fijado al confirmar. Una comunicación enviada en pruebas
  -- no entra en la analítica: sus aperturas son de quien la envió.
  ADD COLUMN IF NOT EXISTS modo_envio             text,
  ADD COLUMN IF NOT EXISTS asunto_enviado         text,
  -- 'pixel' (la plantilla ya traía imágenes) o 'logo' (no traía ninguna).
  ADD COLUMN IF NOT EXISTS imagen_apertura        text,
  -- El seguimiento de la prueba obligatoria, que no cuenta en las cifras.
  ADD COLUMN IF NOT EXISTS prueba_token           text,
  ADD COLUMN IF NOT EXISTS prueba_enlaces         jsonb,
  -- El ensayo general: todos los correos montados y validados sin enviar.
  ADD COLUMN IF NOT EXISTS ensayo_at              timestamptz,
  ADD COLUMN IF NOT EXISTS ensayo_por_email       text,
  ADD COLUMN IF NOT EXISTS ensayo_resumen         jsonb,
  -- Reenvío: la comunicación de la que sale esta y el filtro que se aplicó.
  ADD COLUMN IF NOT EXISTS origen_comunicacion_id uuid REFERENCES public.com_comunicacion (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reenvio_filtro         jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS com_comunicacion_prueba_token_idx
  ON public.com_comunicacion (prueba_token) WHERE prueba_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS com_comunicacion_origen_idx
  ON public.com_comunicacion (origen_comunicacion_id) WHERE origen_comunicacion_id IS NOT NULL;

ALTER TABLE public.com_comunicacion DROP CONSTRAINT IF EXISTS com_comunicacion_audiencia_check;
ALTER TABLE public.com_comunicacion
  ADD CONSTRAINT com_comunicacion_audiencia_check
  CHECK (audiencia IN ('promocion', 'toda_la_base', 'inversores_directos', 'reenvio'));

-- =============================================================================
-- 3. com_destinatario — su seguimiento, y lo que se ensayó
-- =============================================================================
ALTER TABLE public.com_destinatario
  -- Identificador aleatorio de ESTE correo. Cada envío tiene el suyo: la misma
  -- plantilla enviada dos veces se cuenta por separado.
  ADD COLUMN IF NOT EXISTS seguimiento_token     text,
  -- Los destinos finales de los enlaces de este correo, por posición. El clic
  -- redirige a lo que hay aquí, nunca a lo que diga la URL.
  ADD COLUMN IF NOT EXISTS enlaces               jsonb,
  -- Huella del correo tal como se ensayó. Si al enviar no coincide, no sale.
  ADD COLUMN IF NOT EXISTS huella                text,
  ADD COLUMN IF NOT EXISTS aperturas             integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS primera_apertura_at   timestamptz,
  ADD COLUMN IF NOT EXISTS ultima_apertura_at    timestamptz,
  ADD COLUMN IF NOT EXISTS clics                 integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS primer_clic_at        timestamptz,
  ADD COLUMN IF NOT EXISTS ultimo_clic_at        timestamptz,
  -- Lo que dice Zoho, donde lo expone: 'entregado', 'rebotado' o 'sin_dato'.
  ADD COLUMN IF NOT EXISTS entrega_estado        text,
  ADD COLUMN IF NOT EXISTS rebote_motivo         text,
  ADD COLUMN IF NOT EXISTS entrega_consultada_at timestamptz,
  -- Comprobación tras el envío de a quién dice Zoho que fue:
  -- 'coincide', 'no_coincide' o 'sin_dato'.
  ADD COLUMN IF NOT EXISTS verificado_zoho       text;

CREATE UNIQUE INDEX IF NOT EXISTS com_destinatario_token_idx
  ON public.com_destinatario (seguimiento_token) WHERE seguimiento_token IS NOT NULL;

-- =============================================================================
-- 4. com_enlace — los enlaces de cada comunicación
-- =============================================================================
-- Uno por enlace de la plantilla, para agrupar los clics. El destino de cada
-- destinatario (que puede llevar sus propios datos) está en com_destinatario.
CREATE TABLE IF NOT EXISTS public.com_enlace (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comunicacion_id uuid NOT NULL REFERENCES public.com_comunicacion (id) ON DELETE CASCADE,
  posicion        integer NOT NULL,
  url             text NOT NULL,
  texto           text,
  CONSTRAINT com_enlace_unico UNIQUE (comunicacion_id, posicion)
);

-- =============================================================================
-- 5. com_evento — cada apertura y cada clic
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.com_evento (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  comunicacion_id uuid NOT NULL REFERENCES public.com_comunicacion (id) ON DELETE CASCADE,
  -- NULL en los eventos de la prueba obligatoria.
  destinatario_id uuid REFERENCES public.com_destinatario (id) ON DELETE CASCADE,
  token           text NOT NULL,
  tipo            text NOT NULL CHECK (tipo IN ('apertura', 'clic')),
  enlace          integer,
  -- Lo abrió o lo pulsó un filtro de correo, no una persona. Se guarda, pero
  -- no cuenta en las cifras.
  automatico      boolean NOT NULL DEFAULT false,
  es_prueba       boolean NOT NULL DEFAULT false,
  agente          text,
  ocurrido_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS com_evento_comunicacion_idx ON public.com_evento (comunicacion_id, ocurrido_at);
CREATE INDEX IF NOT EXISTS com_evento_token_idx ON public.com_evento (token, ocurrido_at);

-- =============================================================================
-- 6. com_registrar_evento — anotar una apertura o un clic, de una vez
-- =============================================================================
-- La llaman las dos rutas públicas de seguimiento. Lo hace todo en una sola
-- llamada y dentro de la base para que dos aperturas a la vez no se pisen al
-- sumar, y para que la ruta del clic conteste con un solo viaje.
--
-- Devuelve `encontrado = false` si el identificador no existe o el enlace está
-- fuera de rango: la ruta contesta 404 y no se escribe nada.
CREATE OR REPLACE FUNCTION public.com_registrar_evento(
  p_token      text,
  p_tipo       text,
  p_enlace     integer,
  p_agente     text,
  p_automatico boolean
)
RETURNS TABLE (encontrado boolean, destino text, imagen text)
LANGUAGE plpgsql
AS $$
DECLARE
  v_dest      public.com_destinatario%ROWTYPE;
  v_com       public.com_comunicacion%ROWTYPE;
  v_es_prueba boolean := false;
  v_enlaces   jsonb;
  v_destino   text := NULL;
  v_auto      boolean := COALESCE(p_automatico, false);
  v_anotar    boolean := true;
  v_recientes integer;
BEGIN
  IF p_tipo NOT IN ('apertura', 'clic') OR p_token IS NULL THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text;
    RETURN;
  END IF;

  SELECT * INTO v_dest FROM public.com_destinatario WHERE seguimiento_token = p_token;
  IF FOUND THEN
    SELECT * INTO v_com FROM public.com_comunicacion WHERE id = v_dest.comunicacion_id;
    v_enlaces := v_dest.enlaces;
    -- Un correo que todavía no ha salido no puede haberse abierto.
    v_anotar := v_dest.estado_envio = 'enviado';
    -- En los primeros segundos tras el envío, quien abre es un filtro de correo.
    IF v_dest.enviado_at IS NOT NULL AND now() - v_dest.enviado_at < interval '10 seconds' THEN
      v_auto := true;
    END IF;
  ELSE
    SELECT * INTO v_com FROM public.com_comunicacion WHERE prueba_token = p_token;
    IF NOT FOUND THEN
      RETURN QUERY SELECT false, NULL::text, NULL::text;
      RETURN;
    END IF;
    v_es_prueba := true;
    v_enlaces := v_com.prueba_enlaces;
  END IF;

  IF p_tipo = 'clic' THEN
    IF p_enlace IS NULL OR p_enlace < 0 OR v_enlaces IS NULL
       OR jsonb_typeof(v_enlaces) <> 'array' OR p_enlace >= jsonb_array_length(v_enlaces) THEN
      RETURN QUERY SELECT false, NULL::text, NULL::text;
      RETURN;
    END IF;
    v_destino := v_enlaces ->> p_enlace;
  END IF;

  -- Como mucho 30 anotaciones por identificador y minuto: recargar una imagen
  -- en bucle no infla las cifras ni llena la tabla.
  IF v_anotar THEN
    SELECT count(*) INTO v_recientes
      FROM public.com_evento
     WHERE token = p_token AND ocurrido_at > now() - interval '1 minute';
    IF v_recientes >= 30 THEN v_anotar := false; END IF;
  END IF;

  IF v_anotar THEN
    INSERT INTO public.com_evento
      (comunicacion_id, destinatario_id, token, tipo, enlace, automatico, es_prueba, agente)
    VALUES
      (v_com.id, CASE WHEN v_es_prueba THEN NULL ELSE v_dest.id END, p_token, p_tipo,
       CASE WHEN p_tipo = 'clic' THEN p_enlace ELSE NULL END, v_auto, v_es_prueba, left(p_agente, 300));

    IF NOT v_es_prueba AND NOT v_auto THEN
      IF p_tipo = 'apertura' THEN
        UPDATE public.com_destinatario
           SET aperturas = aperturas + 1,
               primera_apertura_at = COALESCE(primera_apertura_at, now()),
               ultima_apertura_at = now()
         WHERE id = v_dest.id;
      ELSE
        UPDATE public.com_destinatario
           SET clics = clics + 1,
               primer_clic_at = COALESCE(primer_clic_at, now()),
               ultimo_clic_at = now()
         WHERE id = v_dest.id;
      END IF;
    END IF;
  END IF;

  RETURN QUERY SELECT true, v_destino, COALESCE(v_com.imagen_apertura, 'pixel');
END;
$$;

-- Solo la llama el servidor. Una función es ejecutable por cualquiera salvo que
-- se diga lo contrario.
REVOKE ALL ON FUNCTION public.com_registrar_evento(text, text, integer, text, boolean) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.com_registrar_evento(text, text, integer, text, boolean) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.com_registrar_evento(text, text, integer, text, boolean) FROM authenticated;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.com_registrar_evento(text, text, integer, text, boolean) TO service_role;

-- =============================================================================
-- 7. Seguridad
-- =============================================================================
-- Como el resto de `com_*`: RLS habilitada y SIN políticas. Las rutas públicas
-- de seguimiento no leen estas tablas: llaman a la función con service role.
ALTER TABLE public.com_enlace ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.com_evento ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.com_enlace TO service_role;
GRANT ALL ON public.com_evento TO service_role;
