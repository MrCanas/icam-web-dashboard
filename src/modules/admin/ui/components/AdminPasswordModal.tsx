"use client";

import { useState, useTransition } from "react";

import { setUserPasswordAction } from "@/modules/admin/actions/set-user-password";
import { MIN_PASSWORD_LENGTH } from "@/modules/admin/logic/validate-user-input";
import type { AdminUserRow } from "@/modules/admin/types";
import { AdminModal } from "@/modules/admin/ui/components/AdminModal";

const inputClass =
  "w-full min-h-10 rounded-md border border-subtle/60 bg-page px-3 text-sm text-text-primary focus:border-icam-900 focus:outline-none focus:ring-1 focus:ring-icam-900/30";
const labelClass = "block text-sm font-medium text-text-primary";

interface AdminPasswordModalProps {
  /** El padre lo monta con `key={user.userId}`: el estado nace limpio por usuario. */
  user: AdminUserRow;
  onClose: () => void;
  onDone: () => void;
}

export function AdminPasswordModal({
  user,
  onClose,
  onDone,
}: AdminPasswordModalProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(
        `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
      );
      return;
    }
    if (password !== confirmPassword) {
      setError("La confirmación no coincide con la contraseña.");
      return;
    }

    startTransition(async () => {
      const res = await setUserPasswordAction({
        userId: user.userId,
        newPassword: password,
      });
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
      title={`Cambiar contraseña de ${user.displayName}`}
      subtitle={user.email}
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
            form="admin-password-form"
            className="min-h-10 rounded-md bg-icam-900 px-5 text-sm font-medium text-white hover:bg-icam-800 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={pending}
          >
            {pending ? "Guardando…" : "Cambiar contraseña"}
          </button>
        </>
      }
    >
      <form id="admin-password-form" onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div>
          <label htmlFor="admin-reset-password" className={labelClass}>
            Nueva contraseña
          </label>
          <input
            id="admin-reset-password"
            type={showPassword ? "text" : "password"}
            className={`${inputClass} mt-1`}
            value={password}
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            disabled={pending}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="admin-reset-password-confirm" className={labelClass}>
            Confirmar contraseña
          </label>
          <input
            id="admin-reset-password-confirm"
            type={showPassword ? "text" : "password"}
            className={`${inputClass} mt-1`}
            value={confirmPassword}
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            disabled={pending}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        <label className="flex min-h-9 w-fit cursor-pointer items-center gap-2 text-sm text-text-body">
          <input
            type="checkbox"
            checked={showPassword}
            onChange={(e) => setShowPassword(e.target.checked)}
          />
          Mostrar contraseña
        </label>

        <p className="text-xs text-text-muted">
          El usuario deberá usar esta contraseña en su próximo inicio de sesión.
        </p>
      </form>
    </AdminModal>
  );
}
