import { portfolioModule } from "@/modules/portfolio/module";

function routePath(key: string): string {
  const route = portfolioModule.routes.find((r) => r.key === key);
  if (!route) {
    throw new Error(`Portfolio route not found: ${key}`);
  }
  return route.path;
}

/** Rutas derivadas del registro del módulo — evita strings duplicadas en UI. */
export const portfolioPaths = {
  executive: portfolioModule.defaultPath,
  rentabilidad: routePath("portfolio.rentabilidad"),
  proyectos: routePath("portfolio.proyectos"),
  tendencias: routePath("portfolio.tendencias"),
} as const;
