"use client";

import { useState, useTransition } from "react";

import { forcePasswordChangeAllAction } from "@/modules/admin/actions/force-password-change";
import { AdminModal } from "@/modules/admin/ui/components/AdminModal";

interface AdminForcePasswordChangeModalProps {
  onClose: () => void;
  onDone: () => void;
}

export function AdminForcePasswordChangeModal({
  onClose,
  onDone,
}: AdminForcePasswordChangeModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleConfirm = () => {
    setError(null);
    startTransition(async () => {
      const res = await forcePasswordChangeAllAction();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onDone();
    });
  };

  return (
    <AdminModal
      open
      title="Forzar cambio de contraseña"
      subtitle="Afecta a todos los usuarios, tú incluido."
      busy={pending}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="min-h-10 rounded-md border border-subtle/60 px-4 text-sm font-medium text-text-primary hover:bg-page disabled:opacity-50"
            disabled={pending}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="min-h-10 rounded-md bg-icam-900 px-5 text-sm font-medium text-white hover:bg-icam-800 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={pending}
            onClick={handleConfirm}
          >
            {pending ? "Aplicando…" : "Forzar a todos"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <p className="text-sm text-text-body">
          La próxima vez que cada usuario abra el portal tendrá que elegir una
          contraseña nueva (con su contraseña actual) antes de poder seguir. Su
          contraseña actual sigue valiendo para entrar hasta que la cambie.
        </p>
      </div>
    </AdminModal>
  );
}
