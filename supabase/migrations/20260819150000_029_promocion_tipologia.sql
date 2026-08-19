-- PM 029 — Tipología y contexto de las promociones de Zoho.
--
-- El primer export (KPI_AvanceProyectos_Promociones.xlsx) venía filtrado: traía
-- 30 promociones de las 47 que tiene el módulo, y ninguna columna que dijera de
-- qué tipo era cada una. Faltaban justo los registros que no se podían emparejar
-- con PM (CSP10, CA1, PC25, VE1…).
--
-- El export completo (Promociones_2026_08_19.csv, 139 columnas) trae el campo
-- «Tipo de proyecto», que es la tipología: Promoción / Fondo / Proyecto de un
-- fondo. Sin ella, el desplegable de emparejamiento mezcla vehículos de
-- inversión con edificios y no hay forma de distinguirlos.
--
-- Se añade también `direccion` por un motivo concreto: en Zoho hay registros
-- cuyo «Nombre Promoción» se ha sobrescrito con el nombre del vehículo (SE84
-- pasó de «Santa Engracia 84» a «Impar Prime Alternative Investment II» el
-- 05/08/2026). En esos casos «Dirección promoción» es lo único que sigue
-- diciendo de qué edificio se trata.
--
-- ADITIVA: solo añade columnas a pm_promociones. No borra ni reescribe nada.

ALTER TABLE public.pm_promociones
  ADD COLUMN IF NOT EXISTS tipo_proyecto text,
  ADD COLUMN IF NOT EXISTS tipo_activo text,
  ADD COLUMN IF NOT EXISTS direccion text,
  ADD COLUMN IF NOT EXISTS provincia text,
  ADD COLUMN IF NOT EXISTS owner_nombre text,
  ADD COLUMN IF NOT EXISTS modificado_en_zoho timestamptz,
  ADD COLUMN IF NOT EXISTS avance_actualizado_en_zoho date;

COMMENT ON COLUMN public.pm_promociones.tipo_proyecto IS
  'La «tipología» de Zoho (campo Tipo de proyecto): Promoción, Fondo o Proyecto de un fondo. SIN CHECK: Zoho puede añadir valores y un CHECK rompería la siguiente importación.';
COMMENT ON COLUMN public.pm_promociones.tipo_activo IS
  'Residencial, Apartamentos turísticos, Residencia de Estudiantes… Vacío en la mayoría de registros.';
COMMENT ON COLUMN public.pm_promociones.direccion IS
  'Campo «Dirección promoción» de Zoho. Es lo único que identifica el edificio cuando el nombre se ha sobrescrito con el del vehículo de inversión.';
COMMENT ON COLUMN public.pm_promociones.owner_nombre IS
  'Propietario del registro en Zoho. El primer export venía filtrado por este campo, así que conviene tenerlo a la vista.';
COMMENT ON COLUMN public.pm_promociones.modificado_en_zoho IS
  'Modified Time del registro. Sirve para explicar por qué un nombre o un porcentaje ha cambiado entre importaciones.';
COMMENT ON COLUMN public.pm_promociones.avance_actualizado_en_zoho IS
  'Campo «Fecha de actualización Avance de Obra». Solo 8 de 47 registros lo traen: no se puede usar como garantía de frescura del dato.';

CREATE INDEX IF NOT EXISTS idx_pm_promociones_tipo
  ON public.pm_promociones (tipo_proyecto);

NOTIFY pgrst, 'reload schema';
