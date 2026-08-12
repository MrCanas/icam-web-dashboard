"use client";

import type { ZoneRole } from "@/lib/auth/permissions";
import { ZONE_ORDER, type ZoneKey } from "@/registry/modules";
import { routesForZone } from "@/registry/routes";
import type { UserPermissionsInput } from "@/modules/admin/types";

const ZONE_LABELS: Record<ZoneKey, string> = {
  financiero: "Dashboard",
  pm: "Proyectos",
  adquisiciones: "Adquisiciones",
  data: "Data",
};

const ROLE_OPTIONS: { value: "" | ZoneRole; label: string }[] = [
  { value: "", label: "Sin acceso" },
  { value: "lector", label: "Lector" },
  { value: "editor", label: "Editor" },
  { value: "admin", label: "Admin" },
];

/** Hoy solo la zona PM da capacidades extra al rol admin (ver ActasOperativoTab). */
const ROLE_HELPER: Partial<Record<ZoneKey, string>> = {
  pm: "En PM, Admin permite además reordenar y archivar proyectos.",
};

interface PermissionMatrixProps {
  value: UserPermissionsInput;
  onChange: (next: UserPermissionsInput) => void;
  disabled?: boolean;
}

export function PermissionMatrix({
  value,
  onChange,
  disabled = false,
}: PermissionMatrixProps) {
  const setZoneRole = (zoneKey: ZoneKey, role: ZoneRole | null) => {
    const nextDenied = role
      ? value.deniedRouteKeys
      : // Sin acceso a la zona, sus denies son ruido inaccesible.
        value.deniedRouteKeys.filter(
          (key) => !routesForZone(zoneKey).some((r) => r.key === key),
        );

    onChange({
      zones: { ...value.zones, [zoneKey]: role },
      deniedRouteKeys: nextDenied,
    });
  };

  const toggleRoute = (routeKey: string, visible: boolean) => {
    onChange({
      zones: value.zones,
      deniedRouteKeys: visible
        ? value.deniedRouteKeys.filter((key) => key !== routeKey)
        : [...value.deniedRouteKeys, routeKey],
    });
  };

  return (
    <div className="space-y-3">
      {ZONE_ORDER.map((zoneKey) => {
        const role = value.zones[zoneKey] ?? null;
        const routes = routesForZone(zoneKey);
        const visibleCount = routes.filter(
          (route) => !value.deniedRouteKeys.includes(route.key),
        ).length;

        return (
          <div
            key={zoneKey}
            className="rounded-md border border-subtle/40 p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-text-primary">
                {ZONE_LABELS[zoneKey]}
              </span>
              <select
                aria-label={`Rol en ${ZONE_LABELS[zoneKey]}`}
                className="min-h-10 rounded-md border border-subtle/60 bg-page px-2 text-sm text-text-primary focus:border-icam-900 focus:outline-none focus:ring-1 focus:ring-icam-900/30 disabled:opacity-50"
                value={role ?? ""}
                disabled={disabled}
                onChange={(e) =>
                  setZoneRole(
                    zoneKey,
                    e.target.value === "" ? null : (e.target.value as ZoneRole),
                  )
                }
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {role && ROLE_HELPER[zoneKey] ? (
              <p className="mt-1 text-xs text-text-muted">
                {ROLE_HELPER[zoneKey]}
              </p>
            ) : null}

            {role ? (
              <div className="mt-3">
                <p className="text-xs font-medium text-text-muted">
                  Páginas visibles
                </p>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5">
                  {routes.map((route) => {
                    const visible = !value.deniedRouteKeys.includes(route.key);
                    return (
                      <label
                        key={route.key}
                        className="flex min-h-9 cursor-pointer items-center gap-2 text-sm text-text-body"
                      >
                        <input
                          type="checkbox"
                          checked={visible}
                          disabled={disabled}
                          onChange={(e) =>
                            toggleRoute(route.key, e.target.checked)
                          }
                        />
                        {route.label}
                      </label>
                    );
                  })}
                </div>
                {visibleCount === 0 ? (
                  <p className="mt-2 text-xs text-amber-700">
                    Sin páginas visibles esta zona no será accesible.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}

      <p className="text-xs text-text-muted">
        El rol controla si puede editar. Las páginas controlan lo que ve en el
        menú.
      </p>
    </div>
  );
}
