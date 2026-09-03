-- PM 037 — usos TERCIARIO y FONDO, LSE84 pasa a terciario, y alta de SICCII y VBARE.
--
-- Continúa la 036, que dio de alta VE1 y LSE84. Aquí se cierra el catálogo de
-- PM contra el de Actas: SICC II y VBARE eran los dos últimos proyectos con
-- actas propias que no existían en pm_activos.
--
-- La 020 dejó escrito que el CHECK de tipo_uso_activo se quedaba en dos valores
-- porque «ampliarlo exige saber qué usos reales necesita la PMO, y no se
-- inventan valores». Ya se sabe, confirmado por la PMO (2026-09-03):
--
--   LSE84  — Locales Comerciales Santa Engracia 84 → TERCIARIO
--            (la 036 lo dejó en RESIDENCIAL_LIBRE aplicando la regla del Excel
--             sobre el «tipo de activo» de Zoho; era lo único que se podía
--             deducir entonces, y era incorrecto: son locales comerciales)
--   SICCII — SICC II, el vehículo             → FONDO
--   VBARE  — el proyecto del vehículo         → FONDO
--
-- FONDO no es un uso de suelo: es lo que son estos dos, vehículos y no
-- edificios. Se admite como valor propio en vez de forzarlos a RESIDENCIAL_LIBRE
-- para que la columna no mienta. Nada en la app ramifica por tipo_uso_activo
-- —solo se pinta—, así que ampliar el dominio no cambia ningún cálculo.
--
-- El código en PM es `SICCII`, sin espacio, como en Zoho y como el resto de
-- códigos de pm_activos; en Actas el proyecto se llama «SICC II». Por eso el
-- vínculo va por pares explícitos y no por igualdad de código.
--
-- ADITIVA E IDEMPOTENTE: el CHECK se recrea con un dominio MÁS AMPLIO (ninguna
-- fila existente deja de cumplirlo), los INSERT llevan ON CONFLICT DO NOTHING y
-- los UPDATE solo tocan lo que aún no está en su sitio. No borra nada.

-- 1. Ampliar el dominio de usos. Se recrea el CHECK: no hay forma de añadirle
--    valores in situ, y el nuevo es un superconjunto del anterior.
ALTER TABLE public.pm_activos
  DROP CONSTRAINT IF EXISTS pm_activos_tipo_uso_activo_check;

ALTER TABLE public.pm_activos
  ADD CONSTRAINT pm_activos_tipo_uso_activo_check
  CHECK (tipo_uso_activo IN ('APT', 'RESIDENCIAL_LIBRE', 'TERCIARIO', 'FONDO'));

COMMENT ON COLUMN public.pm_activos.tipo_uso_activo IS
  'Uso del activo: APT (apartamentos turísticos), RESIDENCIAL_LIBRE, TERCIARIO (locales comerciales) o FONDO (vehículo, no edificio). Ampliado en la 037; la 020 lo dejó en los dos primeros a la espera de saber qué usos reales hacían falta.';

-- 2. Corregir LSE84: la 036 lo dejó en RESIDENCIAL_LIBRE y es terciario.
UPDATE public.pm_activos
   SET tipo_uso_activo = 'TERCIARIO', updated_at = now()
 WHERE id_activo = 'LSE84'
   AND tipo_uso_activo <> 'TERCIARIO';

-- 3. Alta de los dos activos que quedaban, al final del Gantt.
INSERT INTO public.pm_activos (id_activo, tipo_uso_activo, nombre_display, orden)
SELECT v.id_activo, v.tipo_uso_activo, v.nombre_display,
       (SELECT coalesce(max(orden), 0) FROM public.pm_activos) + v.offset_orden
  FROM (VALUES
    ('SICCII', 'FONDO', 'SICC II', 1),
    ('VBARE',  'FONDO', 'VBARE',   2)
  ) AS v(id_activo, tipo_uso_activo, nombre_display, offset_orden)
ON CONFLICT (id_activo) DO NOTHING;

-- 4. Vínculo explícito con su proyecto de Actas, solo donde está a NULL.
--    Por pares: «SICC II» (Actas) ↔ «SICCII» (PM) no casan por igualdad.
UPDATE public.project p
   SET pm_activo_id = a.id
  FROM (VALUES
    ('SICC II', 'SICCII'),
    ('VBARE',   'VBARE')
  ) AS v(project_code, id_activo)
  JOIN public.pm_activos a ON a.id_activo = v.id_activo
 WHERE p.code = v.project_code
   AND p.pm_activo_id IS NULL;
