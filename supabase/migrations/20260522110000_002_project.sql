-- Actas P1.3 — Proyectos y módulos opcionales activados por proyecto.

-- ---------------------------------------------------------------------------
-- project
-- ---------------------------------------------------------------------------
CREATE TABLE public.project (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL,
  name        text NOT NULL,
  status      text NOT NULL DEFAULT 'active',
  phase       text NOT NULL,
  asset_type  text NOT NULL,
  created_by  uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  CONSTRAINT project_code_unique UNIQUE (code),
  CONSTRAINT project_status_check CHECK (
    status IN ('active', 'archived', 'draft')
  ),
  CONSTRAINT project_phase_check CHECK (
    phase IN (
      'adquisicion',
      'desarrollo',
      'comercializacion',
      'operacion',
      'desinversion',
      'cierre'
    )
  ),
  CONSTRAINT project_asset_type_check CHECK (
    asset_type IN (
      'hotel',
      'residencial',
      'oficinas',
      'mixto',
      'retail',
      'logistico',
      'greenfield',
      'otro'
    )
  )
);

CREATE INDEX project_code_idx ON public.project (code);
CREATE INDEX project_phase_idx ON public.project (phase);
CREATE INDEX project_status_idx ON public.project (status);

CREATE TRIGGER project_set_updated_at
  BEFORE UPDATE ON public.project
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- project_module (módulos opcionales activos en un proyecto)
-- ---------------------------------------------------------------------------
CREATE TABLE public.project_module (
  project_id        uuid NOT NULL
    REFERENCES public.project (id) ON DELETE CASCADE,
  master_module_id  uuid NOT NULL
    REFERENCES public.master_module (id) ON DELETE RESTRICT,
  activated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, master_module_id)
);

CREATE INDEX project_module_master_module_id_idx
  ON public.project_module (master_module_id);

-- ---------------------------------------------------------------------------
-- RLS (portal pattern — política permisiva temporal)
-- ---------------------------------------------------------------------------
ALTER TABLE public.project ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_module ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['project', 'project_module']
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

COMMENT ON TABLE public.project IS 'Actas: proyecto de obra (slug en code, ej. GQ8, PC25).';
COMMENT ON TABLE public.project_module IS 'Actas: módulos opcionales del maestro activados en un proyecto.';
COMMENT ON COLUMN public.project.phase IS 'Ciclo del activo: adquisicion | desarrollo | comercializacion | operacion | desinversion | cierre';
COMMENT ON COLUMN public.project.asset_type IS 'Tipología: hotel | residencial | oficinas | mixto | retail | logistico | greenfield | otro';
