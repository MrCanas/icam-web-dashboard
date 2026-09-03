"use client";

import { type ReactNode } from "react";

import { Modal } from "@/components/ui/Modal";

interface AdminModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  busy?: boolean;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
}

/**
 * Esqueleto común de los modales de administración (overlay + diálogo).
 * Delega en `components/ui/Modal`, que es el mismo diálogo ya compartido con el
 * drill-down de portfolio. Se conserva como envoltorio para no tocar los cuatro
 * modales de admin que lo consumen.
 */
export function AdminModal({
  open,
  title,
  subtitle,
  busy = false,
  onClose,
  children,
  footer,
}: AdminModalProps) {
  return (
    <Modal
      open={open}
      title={title}
      subtitle={subtitle}
      busy={busy}
      width="lg"
      onClose={onClose}
      footer={footer}
    >
      {children}
    </Modal>
  );
}
