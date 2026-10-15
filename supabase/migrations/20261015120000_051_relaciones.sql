-- =============================================================================
-- 051 · Zona «Relaciones» (ImparComm incrustado)
-- =============================================================================
-- src/registry/modules.ts tiene que quedar alineado con estos sort_order.
--
-- No se concede el rol a nadie aquí: va por /dashboard/admin/usuarios o
-- `npm run auth:grant`. Hasta que alguien lo tenga, la pestaña no le aparece a
-- nadie.

INSERT INTO public.app_zone (key, label, sort_order)
VALUES ('relaciones', 'Relaciones', 6)
ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order;

UPDATE public.app_zone SET sort_order = 7 WHERE key = 'data';
