-- Actas 016 — Owner (responsable) de proyecto + traza de envío de email.
-- Idempotente: ADD COLUMN IF NOT EXISTS, FK recreada con DROP IF EXISTS, índices IF NOT EXISTS.
-- Solo metadatos/columnas nullable: no reescribe filas existentes.

-- ---------------------------------------------------------------------------
-- 1) project.owner_user_id — responsable del proyecto.
--    Nullable (los proyectos existentes quedan SIN responsable: no se asigna
--    ninguno por defecto). FK a auth.users con ON DELETE SET NULL: si se borra
--    el usuario, el proyecto queda sin responsable (no se borra el proyecto).
-- ---------------------------------------------------------------------------
ALTER TABLE public.project
  ADD COLUMN IF NOT EXISTS owner_user_id uuid;

ALTER TABLE public.project DROP CONSTRAINT IF EXISTS project_owner_user_id_fkey;
ALTER TABLE public.project
  ADD CONSTRAINT project_owner_user_id_fkey
  FOREIGN KEY (owner_user_id) REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS project_owner_user_id_idx
  ON public.project (owner_user_id);

COMMENT ON COLUMN public.project.owner_user_id IS
  'Actas: responsable (owner) del proyecto y destinatario por defecto de las alertas de sus elementos. NULL = sin responsable. FK auth.users ON DELETE SET NULL.';

-- Permisos (Bloque 1.3):
--   - LECTURA del owner: el owner_user_id es una columna de `project`, así que
--     queda cubierto por la política existente `project_select_org_member`
--     (cualquier miembro de la organización que ve el proyecto lo lee).
--   - MODIFICACIÓN: cubierta por `project_update_org_member` (RLS, defensa en
--     profundidad para clientes con JWT). El gate de rol EDITOR de la zona pm se
--     aplica además en la server action `setProjectOwner` (checkWriteAccess).
-- No se requieren políticas nuevas: la columna hereda las del propio `project`.

-- ---------------------------------------------------------------------------
-- 2) element_notification.email_sent_at — traza idempotente del envío de correo.
--    Separada de `status` (que gobierna la notificación in-app) para no perder el
--    recordatorio in-app al enviar el email. El checker procesa las alertas
--    vencidas (remind_at <= now) con email_sent_at IS NULL y lo sella tras enviar.
-- ---------------------------------------------------------------------------
ALTER TABLE public.element_notification
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS element_notification_email_due_idx
  ON public.element_notification (remind_at)
  WHERE email_sent_at IS NULL;

COMMENT ON COLUMN public.element_notification.email_sent_at IS
  'Actas: instante del envío del correo de la alerta (NULL = aún no enviado). Independiente de status para no afectar a la entrega in-app.';
