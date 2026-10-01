-- =============================================================================
-- 045 — Informes trimestrales: las fotos pasan a ser del proyecto
-- =============================================================================
-- Hasta ahora cada foto era del informe en el que se subió y se borraba con él
-- (ON DELETE CASCADE). Pero las slides heredadas del trimestre siguiente
-- apuntan a esas mismas fotos, y la PM quiere una biblioteca de imágenes por
-- proyecto de la que elegir al colocar una imagen.
--
--   · informe_foto.codigo: proyecto dueño de la foto (obligatorio).
--   · informe_foto.informe_id: informe en el que se subió; opcional y
--     ON DELETE SET NULL. Qué fotos se borran con un informe lo decide la
--     aplicación (las que ningún otro informe del proyecto usa).
--
-- Aditiva e idempotente: no borra ni mueve ninguna foto.

ALTER TABLE public.informe_foto
  ADD COLUMN IF NOT EXISTS codigo text REFERENCES public.informe_proyecto (codigo) ON UPDATE CASCADE;

UPDATE public.informe_foto f
   SET codigo = i.codigo
  FROM public.informe i
 WHERE i.id = f.informe_id
   AND f.codigo IS NULL;

ALTER TABLE public.informe_foto ALTER COLUMN codigo SET NOT NULL;
ALTER TABLE public.informe_foto ALTER COLUMN informe_id DROP NOT NULL;

-- La FK a informe deja de borrar en cascada. Se quita la que haya (su nombre
-- lo puso Postgres) y se crea con nombre fijo.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
      FROM pg_constraint c
     WHERE c.conrelid = 'public.informe_foto'::regclass
       AND c.contype = 'f'
       AND c.confrelid = 'public.informe'::regclass
  LOOP
    EXECUTE format('ALTER TABLE public.informe_foto DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.informe_foto
  ADD CONSTRAINT informe_foto_informe_id_fkey
  FOREIGN KEY (informe_id) REFERENCES public.informe (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS informe_foto_codigo_idx ON public.informe_foto (codigo, created_at DESC);

-- Una subida que no indica proyecto (el código anterior a esta migración) lo
-- toma de su informe: así no falla entre aplicar la migración y desplegar.
CREATE OR REPLACE FUNCTION public.informe_foto_codigo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.codigo IS NULL AND NEW.informe_id IS NOT NULL THEN
    SELECT i.codigo INTO NEW.codigo FROM public.informe i WHERE i.id = NEW.informe_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS informe_foto_codigo_trg ON public.informe_foto;
CREATE TRIGGER informe_foto_codigo_trg
  BEFORE INSERT ON public.informe_foto
  FOR EACH ROW EXECUTE FUNCTION public.informe_foto_codigo();

COMMENT ON COLUMN public.informe_foto.codigo IS 'Proyecto dueño de la foto: la biblioteca de imágenes es por proyecto.';
COMMENT ON COLUMN public.informe_foto.informe_id IS 'Informe en el que se subió la foto; NULL si ese informe se borró y otro la sigue usando.';
