-- PERF 033 — resolver nombres de avatar sin paginar auth.users entero.
--
-- resolveUserDisplayMap (actas) paginaba auth.admin.listUsers de 200 en 200 en
-- CADA render de un tablero, sin caché: es el mayor coste por carga de actas.
-- Esta función devuelve solo los usuarios pedidos (por sus ids) en una consulta
-- indexada. SECURITY DEFINER porque auth.users no es accesible desde el rol de
-- la app; solo service_role la ejecuta.

CREATE OR REPLACE FUNCTION public.auth_users_display(p_ids uuid[])
RETURNS TABLE (id uuid, email text, meta jsonb)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT u.id, u.email::text, u.raw_user_meta_data
    FROM auth.users u
   WHERE u.id = ANY(p_ids);
$$;

COMMENT ON FUNCTION public.auth_users_display IS
  'PERF: id, email y metadata de los usuarios de auth.users pedidos por id. Sustituye a paginar listUsers al pintar avatares. Solo service_role.';

REVOKE ALL ON FUNCTION public.auth_users_display(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_users_display(uuid[]) TO service_role;

NOTIFY pgrst, 'reload schema';
