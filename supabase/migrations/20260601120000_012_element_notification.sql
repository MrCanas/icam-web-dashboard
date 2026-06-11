-- Actas 8A — Recordatorios por elemento (in-app; extensible a email).

CREATE TABLE public.element_notification (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  element_id         uuid NOT NULL REFERENCES public.element (id) ON DELETE CASCADE,
  created_by         uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  recipient_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  remind_at          timestamptz NOT NULL,
  label              text,
  channels           text[] NOT NULL DEFAULT '{in_app}',
  status             text NOT NULL DEFAULT 'pending',
  seen_at            timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT element_notification_status_check CHECK (
    status IN ('pending', 'seen', 'dismissed', 'sent')
  )
);

CREATE INDEX element_notification_recipient_status_remind_idx
  ON public.element_notification (recipient_user_id, status, remind_at);

CREATE INDEX element_notification_element_id_idx
  ON public.element_notification (element_id);

COMMENT ON TABLE public.element_notification IS
  'Recordatorios Actas por elemento. Fase 1: in_app; email vía dispatcher + cron (futuro).';

ALTER TABLE public.element_notification ENABLE ROW LEVEL SECURITY;

CREATE POLICY element_notification_select_party
  ON public.element_notification
  FOR SELECT
  TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR recipient_user_id = (SELECT auth.uid())
  );

CREATE POLICY element_notification_insert_self
  ON public.element_notification
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND recipient_user_id = (SELECT auth.uid())
    AND public.user_can_access_element(element_id)
  );

CREATE POLICY element_notification_update_party
  ON public.element_notification
  FOR UPDATE
  TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR recipient_user_id = (SELECT auth.uid())
  )
  WITH CHECK (
    created_by = (SELECT auth.uid())
    OR recipient_user_id = (SELECT auth.uid())
  );

CREATE POLICY element_notification_delete_party
  ON public.element_notification
  FOR DELETE
  TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR recipient_user_id = (SELECT auth.uid())
  );
