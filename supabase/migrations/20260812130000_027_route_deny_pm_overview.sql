-- 027 — Continuidad de permisos al mover el Overview de PM.
--
-- El Overview de PM cambia de URL: /dashboard/pm/overview (route_key
-- `pm.overview`, que ahora solo redirige) pasa a /dashboard/portfolio/pm-overview
-- (route_key nueva `portfolio.pm_overview`, subpestaña «Overview PM» de la zona
-- Dashboard). Quien tenía denegada la página antigua debe seguir sin ver la nueva.
--
-- Aditiva e idempotente. Los denies antiguos `pm.overview` se conservan como
-- rescate: la key ya no existe en el registry y no tiene ningún efecto.

INSERT INTO public.app_user_route_deny (user_id, route_key)
SELECT user_id, 'portfolio.pm_overview'
FROM public.app_user_route_deny
WHERE route_key = 'pm.overview'
ON CONFLICT (user_id, route_key) DO NOTHING;
