import { corporativoModule } from "@/modules/corporativo/module";

function routePath(key: string): string {
  const route = corporativoModule.routes.find((r) => r.key === key);
  if (!route) {
    throw new Error(`Corporativo route not found: ${key}`);
  }
  return route.path;
}

/** Rutas derivadas del registro del módulo — evita strings duplicadas en la UI. */
export const corporativoPaths = {
  executive: corporativoModule.defaultPath,
  detalle: routePath("corporativo.detalle"),
} as const;
