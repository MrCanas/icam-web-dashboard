import type { SlideJson } from "../slides/tipos";
import type { IncidenciaCoherencia, IncidenciaExportacion } from "../types";
import { desplegar, gruposDeImagenes, srcDeImagen } from "./edicion";
import { qaMecanico, tituloDe, type MedidaQa, type PeriodoInforme } from "./informe";

/**
 * Validador de exportación: lo que debería estar resuelto antes de sacar el
 * PDF. Reúne la revisión mecánica del editor (bloqueantes y avisos), las
 * incoherencias que señaló Claude, las páginas de Finanzas sin aportar y los
 * huecos de imagen sin foto. Si devuelve algo, quien exporta tiene que marcar
 * «Estoy seguro» y eso queda en el registro de exportaciones.
 */
export function incidenciasExportacion(
  slides: SlideJson[],
  medidas: Record<string, MedidaQa>,
  periodo: PeriodoInforme,
  coherencia: IncidenciaCoherencia[] = [],
): IncidenciaExportacion[] {
  const out: IncidenciaExportacion[] = qaMecanico(slides, medidas, periodo).map((x) => ({ nivel: x.nivel, slide: x.slide, texto: x.texto }));
  const visibles = slides.filter((s) => !s.oculto);
  const ids = new Set(visibles.map((s) => s.id));
  coherencia.forEach((c) => {
    if (c.slide && !ids.has(c.slide)) return;
    out.push({ nivel: "aviso", slide: c.slide, texto: `Incoherencia señalada en la revisión: ${c.problema}${c.sugerencia ? ` (${c.sugerencia})` : ""}` });
  });
  visibles.forEach((s) => {
    if (s.c === "SlideBloqueado" && !s.hijos?.length) {
      const props = (s.props ?? {}) as Record<string, unknown>;
      if (!props.vista) out.push({ nivel: "aviso", slide: s.id, texto: `«${tituloDe(s)}»: la página de Finanzas no se ha aportado; saldría «Pendiente de Finanzas».` });
      return;
    }
    const abierta = desplegar(s);
    const huecos = gruposDeImagenes(abierta)
      .filter((g) => g.tipo !== "SlideBloqueado")
      .reduce((n, g) => n + g.imagenes.filter((im) => !srcDeImagen(abierta, g, im)).length, 0);
    if (huecos) out.push({ nivel: "aviso", slide: s.id, texto: `${huecos} hueco(s) de imagen sin foto: saldría el recuadro «Foto aportada por el PM».` });
  });
  return out;
}

/** Texto corto para el registro: «sin incidencias», «3 incidencias (1 bloqueante)». */
export function resumenIncidencias(incidencias: IncidenciaExportacion[]): string {
  if (!incidencias.length) return "sin incidencias";
  const errores = incidencias.filter((x) => x.nivel === "error").length;
  return `${incidencias.length} incidencia${incidencias.length > 1 ? "s" : ""}${errores ? ` (${errores} bloqueante${errores > 1 ? "s" : ""})` : ""}`;
}
