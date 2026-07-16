"use client";

import { useState, useTransition } from "react";

import { setUserActiveAction } from "@/modules/admin/actions/set-user-active";
import { togglePlatformAdminAction } from "@/modules/admin/actions/toggle-platform-admin";
import { updateUserPermissionsAction } from "@/modules/admin/actions/update-user-permissions";
import type { AdminUserRow, UserPermissionsInput } from "@/modules/admin/types";
import { AdminModal } from "@/modules/admin/ui/components/AdminModal";
import { PermissionMatrix } from "@/modules/admin/ui/components/PermissionMatrix";
import { ZONE_ORDER } from "@/registry/modules";

interface AdminPermissionsModalProps {
  /** El padre lo monta con `key={user.userId}`: el estado nace limpio por usuario. */
  user: AdminUserRow;
  isSelf: boolean;
  onClose: () => void;
  onSaved: () => void;
}

/** La matriz envía siempre las 4 zonas: ausente ⇒ revocar. */
function permissionsFromUser(user: AdminUserRow): UserPermissionsInput {
  const zones: UserPermissionsInput["zones"] = {};
  for (const zoneKey of ZONE_ORDER) {
    zones[zoneKey] = user.zones[zoneKey] ?? null;
  }
  return { zones, deniedRouteKeys: [...user.deniedRouteKeys] };
}

export function AdminPermissionsModal({
  user,
  isSelf,
  onClose,
  onSaved,
}: AdminPermissionsModalProps) {
  const [permissions, setPermissions] = useState<UserPermissionsInput>(() =>
    permissionsFromUser(user),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const runAction =(action: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        setError(res.error ?? "No se pudo completar la acción.");
        return;
      }
      onSaved();
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    runAction(() =>
      updateUserPermissionsAction({
        userId: user.userId,
        zones: permissions.zones,
        deniedRouteKeys: permissions.deniedRouteKeys,
      }),
    );
  };

  return (
    <AdminModal
      open
      title={`Permisos de ${user.displayName}`}
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
            form="admin-permissions-form"
            className="min-h-10 rounded-md bg-icam-900 px-5 text-sm font-medium text-white hover:bg-icam-800 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={pending}
          >
            {pending ? "Guardando…" : "Guardar"}
          </button>
        </>
      }
    >
      {error ? (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <form id="admin-permissions-form" onSubmit={handleSave}>
        <PermissionMatrix
          value={permissions}
          onChange={setPermissions}
          disabled={pending}
        />
      </form>

      <section className="mt-6 space-y-3 border-t border-subtle/40 pt-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Cuenta
        </h3>

        <label
          className={`flex items-start gap-3 text-sm ${
            isSelf ? "opacity-50" : "cursor-pointer"
          }`}
          title={
            isSelf ? "No puedes cambiar tu propio rol de administrador." : undefined
          }
        >
          <input
            type="checkbox"
            className="mt-1"
            checked={user.isPlatformAdmin}
            disabled={isSelf || pending}
            onChange={(e) =>
              runAction(() =>
                togglePlatformAdminAction({
                  userId: user.userId,
                  value: e.target.checked,
                }),
              )
            }
          />
          <span>
            <span className="font-medium text-text-primary">
              Administrador de plataforma
            </span>
            <span className="mt-0.5 block text-xs text-text-muted">
              Puede dar de alta usuarios y cambiar permisos. No concede acceso a
              zonas por sí solo.
            </span>
          </span>
        </label>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-text-body">
            Estado:{" "}
            <span className="font-medium text-text-primary">
              {user.isActive ? "Activo" : "Inactivo"}
            </span>
          </span>
          <button
            type="button"
            className="min-h-10 rounded-md border border-subtle/60 px-4 text-sm font-medium text-text-primary hover:bg-page disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSelf || pending}
            title={isSelf ? "No puedes desactivar tu propia cuenta." : undefined}
            onClick={() =>
              runAction(() =>
                setUserActiveAction({
                  userId: user.userId,
                  value: !user.isActive,
                }),
              )
            }
          >
            {user.isActive ? "Desactivar" : "Reactivar"}
          </button>
        </div>
        <p className="text-xs text-text-muted">
          Desactivar cierra su acceso al portal sin borrar nada: conserva sus
          permisos y su rastro en los históricos.
        </p>
      </section>
    </AdminModal>
  );
}
