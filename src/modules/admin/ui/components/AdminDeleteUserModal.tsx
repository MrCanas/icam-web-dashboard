"use client";

import { useState, useTransition } from "react";

import { deleteAdminUserAction } from "@/modules/admin/actions/delete-admin-user";
import type { AdminUserRow } from "@/modules/admin/types";
import { AdminModal } from "@/modules/admin/ui/components/AdminModal";

interface AdminDeleteUserModalProps {
  /** El padre lo monta con `key={user.userId}`: el estado nace limpio por usuario. */
  user: AdminUserRow;
  onClose: () => void;
  onDeleted: () => void;
}

export function AdminDeleteUserModal({
  user,
  onClose,
  onDeleted,
}: AdminDeleteUserModalProps) {
  const [confirmEmail, setConfirmEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Escribir el email evita el borrado por inercia: es irreversible.
  const confirmed =
    confirmEmail.trim().toLowerCase() === user.email.toLowerCase();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmed) return;
    setError(null);

    startTransition(async () => {
      const res = await deleteAdminUserAction({ userId: user.userId });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onDeleted();
    });
  };

  return (
    <AdminModal
      open
      title={`Eliminar a ${user.displayName}`}
      subtitle="Esta acción no se puede deshacer."
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
            type="submit"
            form="admin-delete-user-form"
            className="min-h-10 rounded-md bg-red-600 px-5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!confirmed || pending}
          >
            {pending ? "Eliminando…" : "Eliminar definitivamente"}
          </button>
        </>
      }
    >
      <form id="admin-delete-user-form" onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <p className="text-sm text-text-body">
          Se borrará la cuenta <strong>{user.email}</strong> y sus permisos. Si
          el usuario tiene actividad registrada (actas, adjuntos, elementos
          asignados) no podrá eliminarse: en ese caso desactívalo desde{" "}
          <em>Permisos</em> para cerrarle el acceso sin perder el histórico.
        </p>

        <div>
          <label
            htmlFor="admin-delete-confirm"
            className="block text-sm font-medium text-text-primary"
          >
            Escribe <span className="font-mono">{user.email}</span> para
            confirmar
          </label>
          <input
            id="admin-delete-confirm"
            className="mt-1 w-full min-h-10 rounded-md border border-subtle/60 bg-page px-3 text-sm text-text-primary focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-200"
            value={confirmEmail}
            autoComplete="off"
            disabled={pending}
            onChange={(e) => setConfirmEmail(e.target.value)}
          />
        </div>
      </form>
    </AdminModal>
  );
}
