-- Actas P1.4 — Categorías y elementos operativos por proyecto (soft-delete vía archived_at).

-- ---------------------------------------------------------------------------
-- category
-- ---------------------------------------------------------------------------
CREATE TABLE public.category (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL
    REFERENCES public.project (id) ON DELETE RESTRICT,
  master_group_id uuid
    REFERENCES public.master_group (id) ON DELETE SET NULL,
  name            text NOT NULL,
  order_index     integer NOT NULL DEFAULT 0,
  sublot_label    text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  archived_at     timestamptz
);

CREATE INDEX category_project_id_idx ON public.category (project_id);
CREATE INDEX category_project_order_idx ON public.category (project_id, order_index);

CREATE TRIGGER category_set_updated_at
  BEFORE UPDATE ON public.category
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- element
-- ---------------------------------------------------------------------------
CREATE TABLE public.element (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id        uuid NOT NULL
    REFERENCES public.category (id) ON DELETE RESTRICT,
  master_element_id  uuid
    REFERENCES public.master_element (id) ON DELETE SET NULL,
  name               text NOT NULL,
  status             text NOT NULL DEFAULT 'not_started',
  timeline_start     date,
  timeline_end       date,
  parent_element_id  uuid
    REFERENCES public.element (id) ON DELETE RESTRICT,
  order_index        integer NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  archived_at        timestamptz,
  CONSTRAINT element_status_check CHECK (
    status IN ('not_started', 'working_on_it', 'stuck', 'done')
  ),
  CONSTRAINT element_timeline_range_check CHECK (
    timeline_start IS NULL
    OR timeline_end IS NULL
    OR timeline_end >= timeline_start
  )
);

CREATE INDEX element_category_id_idx ON public.element (category_id);
CREATE INDEX element_parent_element_id_idx ON public.element (parent_element_id);
CREATE INDEX element_category_order_idx ON public.element (category_id, order_index);

CREATE TRIGGER element_set_updated_at
  BEFORE UPDATE ON public.element
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Parent must belong to the same category (tree integrity; no CASCADE on delete).
CREATE OR REPLACE FUNCTION public.element_validate_parent_category()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  parent_category_id uuid;
BEGIN
  IF NEW.parent_element_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT category_id INTO parent_category_id
  FROM public.element
  WHERE id = NEW.parent_element_id;

  IF parent_category_id IS NULL THEN
    RAISE EXCEPTION 'parent_element_id % does not exist', NEW.parent_element_id;
  END IF;

  IF parent_category_id IS DISTINCT FROM NEW.category_id THEN
    RAISE EXCEPTION 'parent_element_id must belong to the same category_id';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER element_validate_parent_category_trg
  BEFORE INSERT OR UPDATE ON public.element
  FOR EACH ROW
  EXECUTE FUNCTION public.element_validate_parent_category();

-- ---------------------------------------------------------------------------
-- element_owner (N owners por elemento)
-- ---------------------------------------------------------------------------
CREATE TABLE public.element_owner (
  element_id uuid NOT NULL
    REFERENCES public.element (id) ON DELETE RESTRICT,
  user_id    uuid NOT NULL
    REFERENCES auth.users (id) ON DELETE RESTRICT,
  PRIMARY KEY (element_id, user_id)
);

CREATE INDEX element_owner_user_id_idx ON public.element_owner (user_id);

-- ---------------------------------------------------------------------------
-- RLS (portal pattern — política permisiva temporal)
-- ---------------------------------------------------------------------------
ALTER TABLE public.category ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.element ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.element_owner ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['category', 'element', 'element_owner']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = t
        AND policyname = 'temp_allow_all'
    ) THEN
      EXECUTE format(
        'CREATE POLICY temp_allow_all ON public.%I FOR ALL USING (true) WITH CHECK (true)',
        t
      );
    END IF;
  END LOOP;
END $$;

COMMENT ON TABLE public.category IS 'Actas: categoría instanciada en un proyecto (multi-lote vía sublot_label).';
COMMENT ON TABLE public.element IS 'Actas: elemento operativo; borrado lógico con archived_at.';
COMMENT ON TABLE public.element_owner IS 'Actas: responsables (N) por elemento.';
COMMENT ON COLUMN public.category.sublot_label IS 'Etiqueta de sub-lote (ej. PC25 East / West / Village).';
COMMENT ON COLUMN public.element.status IS 'not_started | working_on_it | stuck | done';
