-- Portal ICAM: auth multi-usuario hardcoded (Fase 1 — esquema + seed de zonas).
-- RLS activa; políticas solo para service_role (Prompt 3 cerrará authenticated).

-- ---------------------------------------------------------------------------
-- Zonas del portal
-- ---------------------------------------------------------------------------
CREATE TABLE public.app_zone (
  key        text PRIMARY KEY,
  label      text NOT NULL,
  sort_order int  NOT NULL
);

INSERT INTO public.app_zone (key, label, sort_order) VALUES
  ('financiero',    'Financiero',    1),
  ('pm',            'PM',            2),
  ('adquisiciones', 'Adquisiciones', 3),
  ('data',          'Data',          4);

-- ---------------------------------------------------------------------------
-- Contraseñas locales (portal hardcoded; no sustituye auth.users)
-- ---------------------------------------------------------------------------
CREATE TABLE public.app_user_password (
  user_id       uuid PRIMARY KEY
    REFERENCES auth.users (id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Roles por zona
-- ---------------------------------------------------------------------------
CREATE TABLE public.app_user_zone_role (
  user_id  uuid NOT NULL
    REFERENCES auth.users (id) ON DELETE CASCADE,
  zone_key text NOT NULL,
  role     text NOT NULL,
  PRIMARY KEY (user_id, zone_key),
  CONSTRAINT app_user_zone_role_role_check
    CHECK (role IN ('admin', 'editor', 'lector'))
);

CREATE INDEX app_user_zone_role_zone_key_idx ON public.app_user_zone_role (zone_key);

COMMENT ON TABLE public.app_zone IS 'Zonas del portal ICAM (Portfolio/PM/Monday/Data).';
COMMENT ON TABLE public.app_user_password IS 'Hash bcrypt de contraseña portal; independiente de Supabase Auth password.';
COMMENT ON TABLE public.app_user_zone_role IS 'RBAC por zona: admin | editor | lector.';

-- ---------------------------------------------------------------------------
-- RLS (solo service_role por ahora)
-- ---------------------------------------------------------------------------
ALTER TABLE public.app_zone ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_user_password ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_user_zone_role ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_zone_service_role_all
  ON public.app_zone
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY app_user_password_service_role_all
  ON public.app_user_password
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY app_user_zone_role_service_role_all
  ON public.app_user_zone_role
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.app_zone TO service_role;
GRANT ALL ON public.app_user_password TO service_role;
GRANT ALL ON public.app_user_zone_role TO service_role;
