-- Actas P1.6 — Row Level Security (sustituye temp_allow_all en tablas del módulo).

-- ---------------------------------------------------------------------------
-- Helpers (evalúan auth.uid() del JWT Supabase Auth)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.actas_auth_uid()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.user_belongs_to_org(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    p_org_id IS NOT NULL
    AND (SELECT auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.org_member om
      WHERE om.organization_id = p_org_id
        AND om.user_id = (SELECT auth.uid())
    );
$$;

CREATE OR REPLACE FUNCTION public.user_is_org_admin(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    p_org_id IS NOT NULL
    AND (SELECT auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.org_member om
      WHERE om.organization_id = p_org_id
        AND om.user_id = (SELECT auth.uid())
        AND om.role = 'admin'
    );
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_project(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project p
    WHERE p.id = p_project_id
      AND public.user_belongs_to_org(p.organization_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_category(p_category_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.category c
    WHERE c.id = p_category_id
      AND public.user_can_access_project(c.project_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_element(p_element_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.element e
    INNER JOIN public.category c ON c.id = e.category_id
    WHERE e.id = p_element_id
      AND public.user_can_access_project(c.project_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_modify_log_entry(p_log_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.log_entry le
    INNER JOIN public.element e ON e.id = le.element_id
    INNER JOIN public.category c ON c.id = e.category_id
    INNER JOIN public.project p ON p.id = c.project_id
    WHERE le.id = p_log_id
      AND public.user_can_access_element(le.element_id)
      AND (
        le.author_id = (SELECT auth.uid())
        OR public.user_is_org_admin(p.organization_id)
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.actas_auth_uid() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.user_belongs_to_org(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_org_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_access_project(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_access_category(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_access_element(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_modify_log_entry(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Quitar políticas temporales del módulo Actas
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname = 'temp_allow_all'
      AND tablename IN (
        'master_group',
        'master_element',
        'master_module',
        'master_element_module',
        'project',
        'project_module',
        'category',
        'element',
        'element_owner',
        'log_entry',
        'organization',
        'org_member'
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      r.policyname,
      r.tablename
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- organization / org_member (ver membresía propia)
-- ---------------------------------------------------------------------------
CREATE POLICY organization_select_member
  ON public.organization
  FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_org(id));

CREATE POLICY org_member_select_self
  ON public.org_member
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- Catálogo maestro: lectura authenticated; sin políticas de escritura (solo service_role)
-- ---------------------------------------------------------------------------
CREATE POLICY master_group_select_authenticated
  ON public.master_group FOR SELECT TO authenticated USING (true);

CREATE POLICY master_element_select_authenticated
  ON public.master_element FOR SELECT TO authenticated USING (true);

CREATE POLICY master_module_select_authenticated
  ON public.master_module FOR SELECT TO authenticated USING (true);

CREATE POLICY master_element_module_select_authenticated
  ON public.master_element_module FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- project & project_module
-- ---------------------------------------------------------------------------
CREATE POLICY project_select_org_member
  ON public.project FOR SELECT TO authenticated
  USING (public.user_belongs_to_org(organization_id));

CREATE POLICY project_insert_org_member
  ON public.project FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_org(organization_id));

CREATE POLICY project_update_org_member
  ON public.project FOR UPDATE TO authenticated
  USING (public.user_belongs_to_org(organization_id))
  WITH CHECK (public.user_belongs_to_org(organization_id));

CREATE POLICY project_module_select_org_member
  ON public.project_module FOR SELECT TO authenticated
  USING (public.user_can_access_project(project_id));

CREATE POLICY project_module_insert_org_member
  ON public.project_module FOR INSERT TO authenticated
  WITH CHECK (public.user_can_access_project(project_id));

CREATE POLICY project_module_delete_org_member
  ON public.project_module FOR DELETE TO authenticated
  USING (public.user_can_access_project(project_id));

-- ---------------------------------------------------------------------------
-- category & element & element_owner
-- ---------------------------------------------------------------------------
CREATE POLICY category_select_org_member
  ON public.category FOR SELECT TO authenticated
  USING (public.user_can_access_project(project_id));

CREATE POLICY category_insert_org_member
  ON public.category FOR INSERT TO authenticated
  WITH CHECK (public.user_can_access_project(project_id));

CREATE POLICY category_update_org_member
  ON public.category FOR UPDATE TO authenticated
  USING (public.user_can_access_project(project_id))
  WITH CHECK (public.user_can_access_project(project_id));

CREATE POLICY element_select_org_member
  ON public.element FOR SELECT TO authenticated
  USING (public.user_can_access_category(category_id));

CREATE POLICY element_insert_org_member
  ON public.element FOR INSERT TO authenticated
  WITH CHECK (public.user_can_access_category(category_id));

CREATE POLICY element_update_org_member
  ON public.element FOR UPDATE TO authenticated
  USING (public.user_can_access_category(category_id))
  WITH CHECK (public.user_can_access_category(category_id));

CREATE POLICY element_owner_select_org_member
  ON public.element_owner FOR SELECT TO authenticated
  USING (public.user_can_access_element(element_id));

CREATE POLICY element_owner_insert_org_member
  ON public.element_owner FOR INSERT TO authenticated
  WITH CHECK (public.user_can_access_element(element_id));

CREATE POLICY element_owner_delete_org_member
  ON public.element_owner FOR DELETE TO authenticated
  USING (public.user_can_access_element(element_id));

-- ---------------------------------------------------------------------------
-- log_entry
-- ---------------------------------------------------------------------------
CREATE POLICY log_entry_select_org_member
  ON public.log_entry FOR SELECT TO authenticated
  USING (public.user_can_access_element(element_id));

CREATE POLICY log_entry_insert_org_member
  ON public.log_entry FOR INSERT TO authenticated
  WITH CHECK (
    author_id = (SELECT auth.uid())
    AND public.user_can_access_element(element_id)
  );

CREATE POLICY log_entry_update_author_or_admin
  ON public.log_entry FOR UPDATE TO authenticated
  USING (public.user_can_modify_log_entry(id))
  WITH CHECK (public.user_can_modify_log_entry(id));

-- Sin política DELETE: borrado lógico vía UPDATE de deleted_at.
