/** Rutas del módulo de informes trimestrales. */

export function rutaListaInformes(): string {
  return "/dashboard/pm/informes";
}

export function rutaNuevoInforme(idActivo?: string): string {
  return idActivo ? `/dashboard/pm/informes/nuevo?activo=${encodeURIComponent(idActivo)}` : "/dashboard/pm/informes/nuevo";
}

export function rutaInforme(id: string): string {
  return `/dashboard/pm/informes/${encodeURIComponent(id)}`;
}

export function rutaImprimir(id: string): string {
  return `/dashboard/pm/informes/${encodeURIComponent(id)}/imprimir`;
}

export function rutaInformesProyecto(idActivo: string): string {
  return `/dashboard/pm/proyecto/${encodeURIComponent(idActivo)}/informe`;
}
