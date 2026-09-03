-- PM 036 — alta de VE1 y LSE84 en pm_activos.
--
-- Los dos existen en Actas (`project.code` = 'VE1' y 'LSE84', con su histórico
-- migrado desde Monday) y en las promociones de Zoho, pero NUNCA llegaron a
-- pm_activos: esa tabla la puebla el Excel PM vía replace_pm_portfolio, y el
-- Excel solo trae los nueve activos del Gantt histórico. Resultado: aparecían
-- en el menú de Actas y no en PM → Proyectos («Mapeo maestro»), que es la
-- pantalla desde la que se dan de alta, se mapean y se archivan.
--
--   VE1   — Velarde 1 (Zoho: «Proyecto de un fondo», Residencial)
--   LSE84 — Locales Comerciales Santa Engracia 84 (Zoho: Residencial)
--
-- ADITIVA E IDEMPOTENTE: solo INSERT ... ON CONFLICT DO NOTHING. No borra, no
-- pisa nada existente y se puede volver a ejecutar. Los activos nacen SIN
-- hitos: las fechas las pone la PMO en Planificación, no se inventan aquí.
--
-- tipo_uso_activo: el CHECK solo admite 'APT' y 'RESIDENCIAL_LIBRE' (ver nota
-- de la 020: no se inventan usos nuevos). Se aplica la misma regla que usa el
-- parser del Excel sobre el «tipo de activo» de Zoho —«Residencial» ⇒
-- RESIDENCIAL_LIBRE— para los dos. LSE84 son locales comerciales: si la PMO
-- quiere otro uso, hay que ampliar el CHECK con una migración, no forzarlo.
--
-- El vínculo con Actas se escribe explícito aunque los códigos coincidan tras
-- normalizar: `project.pm_activo_id` manda siempre sobre el emparejamiento por
-- código y aguanta un renombrado futuro. Solo se escribe donde está a NULL.
--
-- NO se mapea al maestro financiero ni a la promoción de Zoho: esos dos
-- emparejamientos son decisión editorial de la PMO y se hacen desde la propia
-- pantalla de Proyectos.

-- 1. Alta de los activos, al final del Gantt.
INSERT INTO public.pm_activos (id_activo, tipo_uso_activo, nombre_display, orden)
SELECT v.id_activo, v.tipo_uso_activo, v.nombre_display,
       (SELECT coalesce(max(orden), 0) FROM public.pm_activos) + v.offset_orden
  FROM (VALUES
    ('VE1',   'RESIDENCIAL_LIBRE', 'Velarde 1',                             1),
    ('LSE84', 'RESIDENCIAL_LIBRE', 'Locales Comerciales Santa Engracia 84', 2)
  ) AS v(id_activo, tipo_uso_activo, nombre_display, offset_orden)
ON CONFLICT (id_activo) DO NOTHING;

-- 2. Vínculo explícito con el proyecto de Actas del mismo código, si existe y
--    si aún no apunta a ningún activo. Nunca pisa un vínculo ya escrito.
UPDATE public.project p
   SET pm_activo_id = a.id
  FROM public.pm_activos a
 WHERE p.code IN ('VE1', 'LSE84')
   AND a.id_activo = p.code
   AND p.pm_activo_id IS NULL;
