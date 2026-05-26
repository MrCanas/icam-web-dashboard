-- Health check for scripts/actas/check-supabase.ts (select now() via RPC).
CREATE OR REPLACE FUNCTION public.actas_check_supabase_health()
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT now();
$$;

GRANT EXECUTE ON FUNCTION public.actas_check_supabase_health() TO anon, authenticated, service_role;
