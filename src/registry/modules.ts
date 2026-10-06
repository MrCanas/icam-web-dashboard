import { comunicacionesModule } from "@/modules/comunicaciones/module";
import { corporativoModule } from "@/modules/corporativo/module";
import { mondayModule } from "@/modules/monday/module";
import { pmModule } from "@/modules/pm/module";
import { portfolioModule } from "@/modules/portfolio/module";

/** Módulos de negocio activos. `src/modules/_template/` es plantilla — no importar aquí. */
export const MODULES = {
  portfolio: portfolioModule,
  corporativo: corporativoModule,
  pm: pmModule,
  monday: mondayModule,
  comunicaciones: comunicacionesModule,
} as const;

export const MODULES_LIST = Object.values(MODULES);

/** Zona del portal → clave de módulo en MODULES (`data` solo en PLATFORM_NAV). */
export const ZONE_TO_MODULE = {
  financiero: "portfolio",
  corporativo: "corporativo",
  pm: "pm",
  adquisiciones: "monday",
  comunicaciones: "comunicaciones",
  data: null,
} as const;

export type ZoneKey = keyof typeof ZONE_TO_MODULE;

export const MODULE_TO_ZONE: Record<string, ZoneKey> = {
  portfolio: "financiero",
  corporativo: "corporativo",
  pm: "pm",
  monday: "adquisiciones",
  comunicaciones: "comunicaciones",
};

/** Orden de pestañas (alineado con app_zone.sort_order). */
export const ZONE_ORDER: ZoneKey[] = [
  "financiero",
  "corporativo",
  "pm",
  "adquisiciones",
  "comunicaciones",
  "data",
];

/**
 * Zonas sin pestaña en la fila primaria de la nav. Siguen en el registry
 * (permisos, guards y URL directa intactos): solo DashboardNav las filtra.
 */
export const NAV_HIDDEN_ZONES: ZoneKey[] = ["adquisiciones"];
