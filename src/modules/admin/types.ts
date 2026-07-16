import type { ZoneRole } from "@/lib/auth/permissions";
import type { ZoneKey } from "@/registry/modules";

export interface AdminUserRow {
  userId: string;
  email: string;
  displayName: string;
  initials: string;
  isPlatformAdmin: boolean;
  isActive: boolean;
  /** Zona ausente = sin acceso. */
  zones: Partial<Record<ZoneKey, ZoneRole>>;
  deniedRouteKeys: string[];
  createdAt: string;
  lastSignInAt: string | null;
}

/** Asignación de roles: zona ausente = sin cambios, null = revocar acceso. */
export type ZoneRoleAssignment = Partial<Record<ZoneKey, ZoneRole | null>>;

/** Permisos editables de un usuario, tal y como los envía la matriz. */
export interface UserPermissionsInput {
  zones: ZoneRoleAssignment;
  deniedRouteKeys: string[];
}

export type AdminResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };
