-- 051 — Cambio de contraseña obligatorio en el siguiente acceso.
--
-- Aditiva: una columna con default false, nadie queda marcado al aplicarla.
-- Con el flag a true, el layout de /dashboard manda al usuario a
-- /cambiar-contrasena hasta que la cambie; /api/account/password lo limpia.

ALTER TABLE public.app_user_password
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.app_user_password.must_change_password IS
  'true = el usuario debe cambiar la contraseña antes de seguir usando el portal.';
