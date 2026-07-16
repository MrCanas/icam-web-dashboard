"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type { AdminUserRow } from "@/modules/admin/types";
import { AdminDeleteUserModal } from "@/modules/admin/ui/components/AdminDeleteUserModal";
import { AdminPasswordModal } from "@/modules/admin/ui/components/AdminPasswordModal";
import { AdminPermissionsModal } from "@/modules/admin/ui/components/AdminPermissionsModal";
import { AdminUserFormModal } from "@/modules/admin/ui/components/AdminUserFormModal";
import { AdminUsersTable } from "@/modules/admin/ui/components/AdminUsersTable";

interface AdminUsuariosPageProps {
  currentUserId: string;
  users: AdminUserRow[];
}

export function AdminUsuariosPage({
  currentUserId,
  users,
}: AdminUsuariosPageProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [permissionsUser, setPermissionsUser] = useState<AdminUserRow | null>(
    null,
  );
  const [passwordUser, setPasswordUser] = useState<AdminUserRow | null>(null);
  const [deleteUser, setDeleteUser] = useState<AdminUserRow | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) =>
      `${user.email} ${user.displayName}`.toLowerCase().includes(q),
    );
  }, [users, search]);

  return (
    <div className="space-y-6">
      <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-icam-900">
              Administrar usuarios
            </h1>
            <p className="mt-1 text-sm text-text-muted">
              Da de alta usuarios y decide a qué zonas y páginas accede cada uno.
            </p>
          </div>
          <button
            type="button"
            className="min-h-11 px-4 rounded-md bg-icam-900 text-white text-sm font-medium hover:bg-icam-800 transition"
            onClick={() => setCreateOpen(true)}
          >
            Nuevo usuario
          </button>
        </div>

        <div className="mt-4">
          <input
            type="search"
            aria-label="Buscar usuario"
            placeholder="Buscar por nombre o email…"
            className="w-full max-w-sm min-h-11 rounded-md border border-subtle px-3 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="mt-4">
          <AdminUsersTable
            users={filtered}
            currentUserId={currentUserId}
            onEditPermissions={setPermissionsUser}
            onChangePassword={setPasswordUser}
            onDelete={setDeleteUser}
          />
        </div>
      </section>

      {/* Montaje condicional + `key`: cada apertura arranca con estado limpio
          sin necesidad de resetearlo con un efecto. */}
      {createOpen ? (
        <AdminUserFormModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            router.refresh();
          }}
        />
      ) : null}

      {permissionsUser ? (
        <AdminPermissionsModal
          key={permissionsUser.userId}
          user={permissionsUser}
          isSelf={permissionsUser.userId === currentUserId}
          onClose={() => setPermissionsUser(null)}
          onSaved={() => {
            setPermissionsUser(null);
            router.refresh();
          }}
        />
      ) : null}

      {passwordUser ? (
        <AdminPasswordModal
          key={passwordUser.userId}
          user={passwordUser}
          onClose={() => setPasswordUser(null)}
          onDone={() => {
            setPasswordUser(null);
            router.refresh();
          }}
        />
      ) : null}

      {deleteUser ? (
        <AdminDeleteUserModal
          key={deleteUser.userId}
          user={deleteUser}
          onClose={() => setDeleteUser(null)}
          onDeleted={() => {
            setDeleteUser(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
