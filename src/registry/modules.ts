import { mondayModule } from "@/modules/monday/module";
import { pmModule } from "@/modules/pm/module";
import { portfolioModule } from "@/modules/portfolio/module";

/** Módulos de negocio activos. `src/modules/_template/` es plantilla — no importar aquí. */
export const MODULES = {
  portfolio: portfolioModule,
  pm: pmModule,
  monday: mondayModule,
} as const;

export const MODULES_LIST = Object.values(MODULES);

/** Zona del portal → clave de módulo en MODULES (`data` solo en PLATFORM_NAV). */
export const ZONE_TO_MODULE = {
  financiero: "portfolio",
  pm: "pm",
  adquisiciones: "monday",
  data: null,
} as const;

export type ZoneKey = keyof typeof ZONE_TO_MODULE;

export const MODULE_TO_ZONE: Record<string, ZoneKey> = {
  portfolio: "financiero",
  pm: "pm",
  monday: "adquisiciones",
};

/** Orden de pestañas (alineado con app_zone.sort_order). */
export const ZONE_ORDER: ZoneKey[] = [
  "financiero",
  "pm",
  "adquisiciones",
  "data",
];
