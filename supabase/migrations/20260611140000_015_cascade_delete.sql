-- Actas P6 — Borrado permanente de grupos/elementos en cascada.
-- Pasa las FK relevantes de RESTRICT a CASCADE para que borrar una categoría
-- (o un elemento) arrastre sus elementos, sub-elementos, entradas, owners,
-- notificaciones y adjuntos en una sola operación atómica. Idempotente
-- (DROP IF EXISTS + ADD). Los binarios de Storage los borra la server action.

-- element.category_id → CASCADE (borrar categoría borra sus elementos).
ALTER TABLE public.element DROP CONSTRAINT IF EXISTS element_category_id_fkey;
ALTER TABLE public.element
  ADD CONSTRAINT element_category_id_fkey
  FOREIGN KEY (category_id) REFERENCES public.category (id) ON DELETE CASCADE;

-- element.parent_element_id → CASCADE (borrar elemento borra sus sub-elementos).
ALTER TABLE public.element DROP CONSTRAINT IF EXISTS element_parent_element_id_fkey;
ALTER TABLE public.element
  ADD CONSTRAINT element_parent_element_id_fkey
  FOREIGN KEY (parent_element_id) REFERENCES public.element (id) ON DELETE CASCADE;

-- element_owner.element_id → CASCADE.
ALTER TABLE public.element_owner DROP CONSTRAINT IF EXISTS element_owner_element_id_fkey;
ALTER TABLE public.element_owner
  ADD CONSTRAINT element_owner_element_id_fkey
  FOREIGN KEY (element_id) REFERENCES public.element (id) ON DELETE CASCADE;

-- log_entry.element_id → CASCADE.
ALTER TABLE public.log_entry DROP CONSTRAINT IF EXISTS log_entry_element_id_fkey;
ALTER TABLE public.log_entry
  ADD CONSTRAINT log_entry_element_id_fkey
  FOREIGN KEY (element_id) REFERENCES public.element (id) ON DELETE CASCADE;

-- element_notification.element_id y actas_attachment.element_id ya son CASCADE
-- (migraciones 012 y 014).
