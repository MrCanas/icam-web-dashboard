"use client";

import type { ZoneRole } from "@/lib/auth/permissions";
import { ZONE_ORDER, type ZoneKey } from "@/registry/modules";
import { routesForZone } from "@/registry/routes";
import type { UserPermissionsInput } from "@/modules/admin/types";

const ZONE_LABELS: Record<ZoneKey, string> = {
  financiero: "Dashboard",
  corporativo: "Corporativas",
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

/**
 * Qué concede el rol Admin más allá de editar, zona por zona.
 *
 * En Financiero y Corporativas es lo que abre el botón de sincronizar y la
 * subida manual del maestro en la pestaña Datos, y ambas cosas **reemplazan la
 * tabla entera**, no añaden. Quien reparte permisos desde aquí no tiene otra
 * forma de saberlo, y es justo lo que hay que pensar dos veces antes de conceder.
 */
const ROLE_HELPER: Partial<Record<ZoneKey, string>> = {
  financiero:
    "En Dashboard, Admin permite además sincronizar y subir el maestro de vehículos, que reemplaza la tabla de proyectos entera.",
  corporativo:
    "En Corporativas, Admin permite además sincronizar y subir el maestro corporativo, que reemplaza la tabla de periodos entera.",
  pm: "En PM, Admin permite además reordenar y archivar proyectos.",
};

/**
 * Aviso de la zona, visible tenga el rol que tenga. Corporativas enseña la
 * cuenta de resultados del grupo: conviene que quien concede el acceso lo lea
 * antes de elegir rol, no después.
 */
const ZONE_AVISO: Partial<Record<ZoneKey, string>> = {
  corporativo:
    "Incluye P&G, EBITDA y cuentas depositadas del grupo. No se hereda del acceso a Dashboard.",
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

            {/* El aviso de la zona va tenga rol o no: es lo que hay que leer
                ANTES de elegir. El del rol solo cuando ya hay acceso. */}
            {ZONE_AVISO[zoneKey] ? (
              <p className="mt-1 text-xs text-text-muted">{ZONE_AVISO[zoneKey]}</p>
            ) : null}

            {role === "admin" && ROLE_HELPER[zoneKey] ? (
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
