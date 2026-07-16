"use client";

import { useState, useTransition } from "react";

import { createAdminUserAction } from "@/modules/admin/actions/create-admin-user";
import { MIN_PASSWORD_LENGTH } from "@/modules/admin/logic/validate-user-input";
import type { UserPermissionsInput } from "@/modules/admin/types";
import { AdminModal } from "@/modules/admin/ui/components/AdminModal";
import { PermissionMatrix } from "@/modules/admin/ui/components/PermissionMatrix";

const inputClass =
  "w-full min-h-10 rounded-md border border-subtle/60 bg-page px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-icam-900 focus:outline-none focus:ring-1 focus:ring-icam-900/30";
const labelClass = "block text-sm font-medium text-text-primary";

const EMPTY_PERMISSIONS: UserPermissionsInput = {
  zones: {},
  deniedRouteKeys: [],
};

interface AdminUserFormModalProps {
  /** El padre solo lo monta al abrir, así que el estado nace limpio. */
  onClose: () => void;
  onCreated: () => void;
}

export function AdminUserFormModal({
  onClose,
  onCreated,
}: AdminUserFormModalProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [permissions, setPermissions] =
    useState<UserPermissionsInput>(EMPTY_PERMISSIONS);
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
      const res = await createAdminUserAction({
        email,
        name,
        password,
        zones: permissions.zones,
        deniedRouteKeys: permissions.deniedRouteKeys,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onCreated();
    });
  };

  return (
    <AdminModal
      open
      title="Nuevo usuario"
      subtitle="Se le comunicará la contraseña que definas aquí."
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
            form="admin-create-user-form"
            className="min-h-10 rounded-md bg-icam-900 px-5 text-sm font-medium text-white hover:bg-icam-800 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={pending}
          >
            {pending ? "Creando…" : "Crear usuario"}
          </button>
        </>
      }
    >
      <form
        id="admin-create-user-form"
        onSubmit={handleSubmit}
        className="space-y-5"
      >
        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div>
          <label htmlFor="admin-new-email" className={labelClass}>
            Email
          </label>
          <input
            id="admin-new-email"
            type="email"
            className={`${inputClass} mt-1`}
            value={email}
            required
            autoComplete="off"
            disabled={pending}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="admin-new-name" className={labelClass}>
            Nombre
          </label>
          <input
            id="admin-new-name"
            className={`${inputClass} mt-1`}
            value={name}
            required
            maxLength={120}
            disabled={pending}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="admin-new-password" className={labelClass}>
              Contraseña inicial
            </label>
            <input
              id="admin-new-password"
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
            <label htmlFor="admin-new-password-confirm" className={labelClass}>
              Confirmar contraseña
            </label>
            <input
              id="admin-new-password-confirm"
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
        </div>

        <label className="flex min-h-9 w-fit cursor-pointer items-center gap-2 text-sm text-text-body">
          <input
            type="checkbox"
            checked={showPassword}
            onChange={(e) => setShowPassword(e.target.checked)}
          />
          Mostrar contraseña
        </label>

        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
            Permisos
          </h3>
          <div className="mt-3">
            <PermissionMatrix
              value={permissions}
              onChange={setPermissions}
              disabled={pending}
            />
          </div>
        </section>
      </form>
    </AdminModal>
  );
}
