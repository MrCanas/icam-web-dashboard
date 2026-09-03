-- AUTH 032 — resolver auth.users.id por email en una sola consulta.
--
-- El login (y requireLogEntryAuthor) resolvía el id paginando
-- auth.admin.listUsers de 200 en 200 hasta encontrar el email. Dos problemas:
--   · coste fijo caro por intento de login (varias páginas), y
--   · oráculo de enumeración: un email inexistente recorre TODAS las páginas
--     antes de fallar, uno existente corta antes → el tiempo delata cuáles hay.
--
-- Esta función lo hace en un SELECT indexado. SECURITY DEFINER porque auth.users
-- no es accesible desde el rol de la aplicación; solo service_role la ejecuta,
-- que es como corre el login.

CREATE OR REPLACE FUNCTION public.auth_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT id
    FROM auth.users
   WHERE lower(email) = lower(trim(p_email))
   LIMIT 1;
$$;

COMMENT ON FUNCTION public.auth_user_id_by_email IS
  'AUTH: id de auth.users por email (case-insensitive), en una consulta. Sustituye a la paginación de listUsers en el login. Solo service_role.';

REVOKE ALL ON FUNCTION public.auth_user_id_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_user_id_by_email(text) TO service_role;

NOTIFY pgrst, 'reload schema';
