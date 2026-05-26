-- Actas P1.6 (aux) — Organización mínima para RLS por membresía.

CREATE TABLE public.organization (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text NOT NULL,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_slug_unique UNIQUE (slug)
);

CREATE TABLE public.org_member (
  organization_id uuid NOT NULL
    REFERENCES public.organization (id) ON DELETE CASCADE,
  user_id         uuid NOT NULL
    REFERENCES auth.users (id) ON DELETE CASCADE,
  role            text NOT NULL DEFAULT 'member',
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id),
  CONSTRAINT org_member_role_check CHECK (role IN ('member', 'admin'))
);

CREATE INDEX org_member_user_id_idx ON public.org_member (user_id);

ALTER TABLE public.project
  ADD COLUMN organization_id uuid
  REFERENCES public.organization (id) ON DELETE RESTRICT;

INSERT INTO public.organization (id, slug, name)
VALUES (
  'a0000000-0000-4000-8000-000000000001',
  'icam',
  'ICAM Capital'
)
ON CONFLICT (slug) DO NOTHING;

UPDATE public.project
SET organization_id = (
  SELECT id FROM public.organization WHERE slug = 'icam' LIMIT 1
)
WHERE organization_id IS NULL;

ALTER TABLE public.project
  ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX project_organization_id_idx ON public.project (organization_id);

ALTER TABLE public.organization ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_member ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.organization IS 'Actas: tenant / organización (portal ICAM = slug icam).';
COMMENT ON TABLE public.org_member IS 'Actas: usuarios Supabase Auth miembros de una organización.';
COMMENT ON COLUMN public.org_member.role IS 'member | admin (admin puede editar/borrar log ajeno).';
