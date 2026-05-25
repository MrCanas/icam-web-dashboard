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
