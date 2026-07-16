"use client";

import { ZONE_ORDER, type ZoneKey } from "@/registry/modules";
import type { AdminUserRow } from "@/modules/admin/types";

const ZONE_LABELS: Record<ZoneKey, string> = {
  financiero: "Financiero",
  pm: "PM",
  adquisiciones: "Adquisiciones",
  data: "Data",
};

interface AdminUsersTableProps {
  users: AdminUserRow[];
  currentUserId: string;
  onEditPermissions: (user: AdminUserRow) => void;
  onChangePassword: (user: AdminUserRow) => void;
  onDelete: (user: AdminUserRow) => void;
}

function ZoneChips({ user }: { user: AdminUserRow }) {
  const entries = ZONE_ORDER.filter((zoneKey) => user.zones[zoneKey]);

  if (entries.length === 0) {
    return <span className="text-xs text-text-muted">Sin zonas</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {entries.map((zoneKey) => (
        <span
          key={zoneKey}
          className="rounded-full border border-subtle/60 bg-page px-2 py-0.5 text-xs text-text-body"
        >
          {ZONE_LABELS[zoneKey]}:{" "}
          <span className="capitalize">{user.zones[zoneKey]}</span>
        </span>
      ))}
    </div>
  );
}

function UserIdentity({ user }: { user: AdminUserRow }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-icam-900/10 text-xs font-medium text-icam-900">
        {user.initials}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-text-primary">
          {user.displayName}
        </span>
        <span className="block truncate text-xs text-text-muted">
          {user.email}
        </span>
      </span>
    </div>
  );
}

function Badges({ user }: { user: AdminUserRow }) {
  return (
    <>
      {user.isPlatformAdmin ? (
        <span className="rounded-full bg-icam-gold/15 px-2 py-0.5 text-xs font-medium text-icam-900">
          Admin
        </span>
      ) : null}
      {!user.isActive ? (
        <span className="rounded-full border border-subtle/60 px-2 py-0.5 text-xs text-text-muted">
          Inactivo
        </span>
      ) : null}
    </>
  );
}

export function AdminUsersTable({
  users,
  currentUserId,
  onEditPermissions,
  onChangePassword,
  onDelete,
}: AdminUsersTableProps) {
  if (users.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-text-muted">
        No hay usuarios que coincidan con la búsqueda.
      </p>
    );
  }

  const actionClass =
    "min-h-9 rounded-md border border-subtle/60 px-3 text-xs font-medium text-text-primary hover:bg-page";
  const dangerActionClass =
    "min-h-9 rounded-md border border-red-200 px-3 text-xs font-medium text-red-700 hover:bg-red-50";

  return (
    <>
      {/* Móvil: tarjetas apiladas */}
      <ul className="space-y-3 sm:hidden">
        {users.map((user) => (
          <li
            key={user.userId}
            className={`rounded-md border border-subtle/40 p-3 ${
              user.isActive ? "" : "opacity-60"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <UserIdentity user={user} />
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Badges user={user} />
              </div>
            </div>
            <div className="mt-3">
              <ZoneChips user={user} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className={actionClass}
                onClick={() => onEditPermissions(user)}
              >
                Permisos
              </button>
              <button
                type="button"
                className={actionClass}
                onClick={() => onChangePassword(user)}
              >
                Contraseña
              </button>
              {user.userId === currentUserId ? (
                <span className="self-center text-xs text-text-muted">
                  (tú)
                </span>
              ) : (
                <button
                  type="button"
                  className={dangerActionClass}
                  onClick={() => onDelete(user)}
                >
                  Eliminar
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* Escritorio: tabla */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-subtle/60 text-xs uppercase tracking-wide text-text-muted">
              <th scope="col" className="py-2 pr-3 font-medium">
                Usuario
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Zonas
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Estado
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr
                key={user.userId}
                className={`border-b border-subtle/30 last:border-0 ${
                  user.isActive ? "" : "opacity-60"
                }`}
              >
                <td className="py-3 pr-3">
                  <UserIdentity user={user} />
                </td>
                <td className="py-3 pr-3">
                  <ZoneChips user={user} />
                </td>
                <td className="py-3 pr-3">
                  <div className="flex flex-wrap items-center gap-1">
                    <Badges user={user} />
                    {user.userId === currentUserId ? (
                      <span className="text-xs text-text-muted">(tú)</span>
                    ) : null}
                  </div>
                </td>
                <td className="py-3">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      className={actionClass}
                      onClick={() => onEditPermissions(user)}
                    >
                      Permisos
                    </button>
                    <button
                      type="button"
                      className={actionClass}
                      onClick={() => onChangePassword(user)}
                    >
                      Contraseña
                    </button>
                    {user.userId === currentUserId ? null : (
                      <button
                        type="button"
                        className={dangerActionClass}
                        onClick={() => onDelete(user)}
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
