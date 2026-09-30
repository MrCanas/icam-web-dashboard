import { qCierre } from "./trimestre";

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

/** URL con la que las slides referencian una foto (mismo origen: sin CORS en la impresión ni en las capturas). */
export function urlFoto(id: string): string {
  return `/api/informes/fotos/${id}`;
}

/**
 * Nombre del PDF: YYYYMMDD_<CODIGO>_<Qn AAAA>_Informe Trimestral Inversores[ (borrador vN)].
 * Va como título de la vista de impresión: el navegador lo propone al guardar como PDF.
 */
export function nombrePdf(p: { codigo: string; trimestre: string; estado: string; version: number }): string {
  return (
    `${qCierre(p.trimestre).replace(/-/g, "")}_${p.codigo}_${p.trimestre}_Informe Trimestral Inversores` +
    (p.estado === "aprobado" ? "" : ` (borrador v${p.version})`)
  );
}
