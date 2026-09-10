-- Actas — el icono de papelera no borraba de verdad.
--
-- La 015 (cascade_delete) puso `category.id`/`element.id` en cascada para que
-- borrar un grupo arrastrase sus elementos, entradas y adjuntos. Pero la 005
-- (rls), que ya existía, solo dio a `category` y `element` políticas de
-- SELECT/INSERT/UPDATE — nunca una de DELETE. Con RLS activo (003) y sin
-- política de DELETE, un `.delete().eq("id", id)` desde el cliente
-- autenticado (no el de service-role) no falla: PostgREST devuelve
-- `error: null` y cero filas afectadas, porque RLS filtra la fila antes del
-- borrado. `deleteCategory`/`deleteElement` (src/modules/pm/actas/actions/)
-- interpretan "sin error" como éxito y el frontend lo confirma de forma
-- optimista — de ahí que el grupo reapareciera tras refrescar aunque el botón
-- "funcionara".
--
-- Mismo alcance que las políticas de UPDATE ya existentes: acceso por
-- organización vía `user_can_access_project` / `user_can_access_category`.
-- La autorización de negocio (rol PM con permiso de escritura) ya la aplica
-- `checkWriteAccess` en la server action; esto solo cierra el hueco de RLS
-- que la dejaba sin efecto.
--
-- Aditiva e idempotente: solo añade políticas (DROP IF EXISTS + CREATE), no
-- toca filas ni cambia las FK de cascada de la 015.

DROP POLICY IF EXISTS category_delete_org_member ON public.category;
CREATE POLICY category_delete_org_member
  ON public.category FOR DELETE TO authenticated
  USING (public.user_can_access_project(project_id));

DROP POLICY IF EXISTS element_delete_org_member ON public.element;
CREATE POLICY element_delete_org_member
  ON public.element FOR DELETE TO authenticated
  USING (public.user_can_access_category(category_id));
