-- Portal ICAM: gestión de usuarios (admin de plataforma, baja lógica, permisos por página).
-- RLS activa; políticas solo para service_role (igual que 20260527160000_app_auth_hardcoded.sql).

-- ---------------------------------------------------------------------------
-- Cuenta de portal: flags singleton por usuario
-- ---------------------------------------------------------------------------
CREATE TABLE public.app_user_account (
  user_id           uuid PRIMARY KEY
    REFERENCES auth.users (id) ON DELETE CASCADE,
  is_platform_admin boolean NOT NULL DEFAULT false,
  is_active         boolean NOT NULL DEFAULT true,
  created_by        uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Recuento barato del guardrail "debe quedar al menos un admin activo".
CREATE INDEX app_user_account_platform_admin_idx
  ON public.app_user_account (user_id)
  WHERE is_platform_admin AND is_active;

-- ---------------------------------------------------------------------------
-- Denegaciones por página (denylist sobre ModuleRoute.key del registry)
-- ---------------------------------------------------------------------------
CREATE TABLE public.app_user_route_deny (
  user_id   uuid NOT NULL
    REFERENCES auth.users (id) ON DELETE CASCADE,
  route_key text NOT NULL,
  PRIMARY KEY (user_id, route_key)
);

CREATE INDEX app_user_route_deny_user_id_idx
  ON public.app_user_route_deny (user_id);

COMMENT ON TABLE public.app_user_account IS
  'Cuenta de portal: is_platform_admin (superadmin global) e is_active (baja lógica). Fila ausente = {false, true}.';
COMMENT ON TABLE public.app_user_route_deny IS
  'Denylist de páginas: route_key = ModuleRoute.key del registry (portfolio.tendencias, pm.actas, data.upload...). Sin FK: el catálogo vive en código (src/registry/routes.ts).';

-- ---------------------------------------------------------------------------
-- RLS (solo service_role)
-- ---------------------------------------------------------------------------
ALTER TABLE public.app_user_account    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_user_route_deny ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_user_account_service_role_all
  ON public.app_user_account
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY app_user_route_deny_service_role_all
  ON public.app_user_route_deny
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.app_user_account    TO service_role;
GRANT ALL ON public.app_user_route_deny TO service_role;

-- ---------------------------------------------------------------------------
-- Bootstrap: primeros admins de plataforma por email (idempotente).
-- Si el email no existe en auth.users esto no falla: nadie quedaría como admin.
-- Verificar tras aplicar; en su defecto, npm run auth:platform-admin -- <email> on
-- ---------------------------------------------------------------------------
INSERT INTO public.app_user_account (user_id, is_platform_admin, is_active)
SELECT u.id, true, true
FROM auth.users u
WHERE lower(u.email) IN (
  'javiercanas@imparcapital.com'
)
ON CONFLICT (user_id) DO UPDATE
  SET is_platform_admin = true,
      is_active         = true,
      updated_at        = now();
