-- Actas P1.1 — Catálogo maestro reutilizable (grupos, elementos, módulos opcionales).

-- ---------------------------------------------------------------------------
-- updated_at helper (shared; safe to replace if already exists elsewhere)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- master_group
-- ---------------------------------------------------------------------------
CREATE TABLE public.master_group (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  is_core     boolean NOT NULL DEFAULT false,
  order_index integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT master_group_name_unique UNIQUE (name)
);

CREATE INDEX master_group_order_idx ON public.master_group (order_index);

CREATE TRIGGER master_group_set_updated_at
  BEFORE UPDATE ON public.master_group
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- master_module (módulos opcionales: Operador Hotelero, Desinversión, …)
-- ---------------------------------------------------------------------------
CREATE TABLE public.master_module (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT master_module_name_unique UNIQUE (name)
);

-- ---------------------------------------------------------------------------
-- master_element
-- ---------------------------------------------------------------------------
CREATE TABLE public.master_element (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_group_id    uuid NOT NULL REFERENCES public.master_group (id) ON DELETE CASCADE,
  name               text NOT NULL,
  default_owner      text,
  is_subitem         boolean NOT NULL DEFAULT false,
  parent_element_id  uuid REFERENCES public.master_element (id) ON DELETE CASCADE,
  applies_when       text,
  order_index        integer NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT master_element_group_name_parent_unique
    UNIQUE NULLS NOT DISTINCT (master_group_id, name, parent_element_id)
);

CREATE INDEX master_element_master_group_id_idx
  ON public.master_element (master_group_id);

CREATE INDEX master_element_parent_element_id_idx
  ON public.master_element (parent_element_id);

CREATE INDEX master_element_order_idx
  ON public.master_element (master_group_id, order_index);

CREATE TRIGGER master_element_set_updated_at
  BEFORE UPDATE ON public.master_element
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Parent must belong to the same master_group (tree integrity).
CREATE OR REPLACE FUNCTION public.master_element_validate_parent_group()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  parent_group_id uuid;
BEGIN
  IF NEW.parent_element_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT master_group_id INTO parent_group_id
  FROM public.master_element
  WHERE id = NEW.parent_element_id;

  IF parent_group_id IS NULL THEN
    RAISE EXCEPTION 'parent_element_id % does not exist', NEW.parent_element_id;
  END IF;

  IF parent_group_id IS DISTINCT FROM NEW.master_group_id THEN
    RAISE EXCEPTION 'parent_element_id must belong to the same master_group_id';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER master_element_validate_parent_group_trg
  BEFORE INSERT OR UPDATE ON public.master_element
  FOR EACH ROW
  EXECUTE FUNCTION public.master_element_validate_parent_group();

-- ---------------------------------------------------------------------------
-- master_element_module (N:M elemento ↔ módulo opcional)
-- ---------------------------------------------------------------------------
CREATE TABLE public.master_element_module (
  master_element_id uuid NOT NULL
    REFERENCES public.master_element (id) ON DELETE CASCADE,
  master_module_id  uuid NOT NULL
    REFERENCES public.master_module (id) ON DELETE CASCADE,
  PRIMARY KEY (master_element_id, master_module_id)
);

CREATE INDEX master_element_module_module_id_idx
  ON public.master_element_module (master_module_id);

-- ---------------------------------------------------------------------------
-- RLS (portal pattern — política permisiva temporal)
-- ---------------------------------------------------------------------------
ALTER TABLE public.master_group ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_element ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_module ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_element_module ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'master_group',
    'master_element',
    'master_module',
    'master_element_module'
  ]
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

COMMENT ON TABLE public.master_group IS 'Actas: grupos del catálogo maestro (reutilizable entre proyectos).';
COMMENT ON TABLE public.master_element IS 'Actas: elementos del catálogo; árbol vía parent_element_id.';
COMMENT ON TABLE public.master_module IS 'Actas: módulos opcionales del catálogo (ej. Operador Hotelero).';
COMMENT ON TABLE public.master_element_module IS 'Actas: qué elementos aplican a qué módulos opcionales.';
