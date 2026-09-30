import type { DocumentoConId } from "../types";

/** Mismo saneado de código que hace la app (limpiarCodigo). */
export function codigoInforme(texto: string): string {
  return String(texto || "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9_\-.]/g, "")
    .slice(0, 40);
}

/**
 * Proyectos configurados para informe + activos PM que todavía no lo están.
 *
 * Un activo sin configurar sale con `sinConfigurar: true`: la app pide entonces
 * el arquetipo y el pie legal, igual que para un proyecto nuevo, pero con el
 * nombre, el código y el vínculo con el activo ya puestos.
 */
export function proyectosConActivosPm(
  configurados: DocumentoConId[],
  activos: { id_activo: string; nombre_display: string | null }[],
): DocumentoConId[] {
  const activosConfigurados = new Set(
    configurados
      .map((d) => d.datos.idActivo)
      .filter((v): v is string => typeof v === "string" && v.length > 0),
  );
  const codigos = new Set(configurados.map((d) => d.id));

  const pendientes: DocumentoConId[] = [];
  for (const a of activos) {
    if (activosConfigurados.has(a.id_activo)) continue;
    const codigo = codigoInforme(a.id_activo);
    if (!codigo || codigos.has(codigo)) continue;
    codigos.add(codigo);
    pendientes.push({
      id: codigo,
      datos: {
        nombre: a.nombre_display?.trim() || a.id_activo,
        codigo,
        idActivo: a.id_activo,
        sinConfigurar: true,
      },
    });
  }
  return [...configurados, ...pendientes];
}
