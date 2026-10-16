import { ELEMENT_STATUS_LABEL } from "@/modules/pm/actas/logic/element-status";
import type { ActasActaViewData, ElementStatus } from "@/modules/pm/actas/types";

/**
 * Actas del trimestre (o del trimestre y hasta hoy) → texto para Claude.
 *
 * Las «actas» del portal no son actas de reunión: son el registro de
 * seguimiento del proyecto (categoría → elemento → anotaciones fechadas con
 * cambio de estado). Se entregan tal cual, agrupadas y con el estado de cada
 * elemento al inicio y al cierre del trimestre, para que Claude saque hitos,
 * incidencias y decisiones sin tener que adivinar el contexto.
 */

/** Tope del texto: la app reparte 62 KB por petición entre fijo y fuentes. */
export const MAX_CARACTERES_ACTAS = 40_000;
const MAX_CARACTERES_ENTRADA = 700;

export interface EstadoElemento {
  elementId: string;
  nombre: string;
  categoriaId: string;
  estado: ElementStatus | null;
}

export interface EntradaFuentesActas {
  proyecto: { code: string; name: string };
  trimestre: string;
  desde: string;
  /** Último día leído: el cierre del trimestre o, si la PM lo pide, hoy. */
  hasta: string;
  /** Cierre del trimestre, cuando `hasta` es posterior (actas «hasta hoy»). */
  cierreTrimestre?: string;
  vista: ActasActaViewData;
  /** Estado de cada elemento al empezar el trimestre (día anterior al inicio). */
  estadoInicio: EstadoElemento[];
  /** Estado de cada elemento en `hasta`. */
  estadoCierre: EstadoElemento[];
  /** Nombre visible de cada categoría (para los bloqueados sin anotaciones). */
  categorias: Record<string, string>;
}

/**
 * Qué actas se incorporan: las del trimestre natural o, si el informe se hace
 * después del cierre, también lo anotado desde el cierre hasta hoy.
 */
export type AlcanceActas = "trimestre" | "hasta_hoy";
export const ALCANCES_ACTAS: AlcanceActas[] = ["trimestre", "hasta_hoy"];

/** Hoy en Madrid (YYYY-MM-DD): el servidor corre en UTC. */
export function hoyMadrid(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/**
 * Días que se leen de las actas. «Hasta hoy» solo alarga el rango si hoy es
 * posterior al cierre; si el trimestre no ha terminado, es lo mismo que el trimestre.
 */
export function rangoActas(
  rango: { desde: string; hasta: string },
  alcance: AlcanceActas,
  hoy: string,
): { desde: string; hasta: string; cierreTrimestre?: string } {
  if (alcance === "hasta_hoy" && hoy > rango.hasta) return { desde: rango.desde, hasta: hoy, cierreTrimestre: rango.hasta };
  return { ...rango };
}

/** ¿Tiene sentido preguntar «hasta hoy»? Solo si el trimestre ya ha cerrado. */
export function hayActasTrasElCierre(cierreTrimestre: string, hoy: string): boolean {
  return hoy > cierreTrimestre;
}

/** Nombre de la fuente: el «hasta el …» es lo que distingue las actas que siguen tras el cierre. */
export function nombreFuenteActas(etiquetaTrimestre: string, codigo: string, cierreTrimestre: string | undefined, hasta: string): string {
  const periodo = cierreTrimestre ? `${etiquetaTrimestre} y hasta el ${fechaEs(hasta)}` : etiquetaTrimestre;
  return `Actas ${periodo} · ${codigo} (portal)`;
}

/** Alcance de unas actas ya cargadas, leído de su nombre (sin migración). */
export function alcanceDeNombre(nombre: string): AlcanceActas {
  return / y hasta el \d{2}\/\d{2}\/\d{4} · /.test(nombre) ? "hasta_hoy" : "trimestre";
}

export function fechaEs(ymdOIso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymdOIso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ymdOIso;
}

function etiqueta(estado: ElementStatus | null | undefined): string {
  return estado ? (ELEMENT_STATUS_LABEL[estado] ?? estado) : "—";
}

/**
 * Estado del elemento en el trimestre. Muchos proyectos no usan los estados
 * (todo queda en «Sin empezar»): entonces no se escribe nada, para no sugerir
 * a Claude que un trabajo en marcha no ha empezado.
 */
function marcaEstado(antes: ElementStatus | null, despues: ElementStatus | null): string {
  const sinUso = (s: ElementStatus | null) => s == null || s === "not_started";
  if (sinUso(antes) && sinUso(despues)) return "";
  if (antes === despues) return ` [estado ${etiqueta(despues)}]`;
  return ` [estado ${etiqueta(antes)} → ${etiqueta(despues)}]`;
}

function recortar(texto: string, max: number): string {
  const limpio = texto.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return limpio.length > max ? `${limpio.slice(0, max)}… [recortado]` : limpio;
}

export function formatearActas(e: EntradaFuentesActas): string {
  const inicio = new Map(e.estadoInicio.map((x) => [x.elementId, x.estado]));
  const cierre = new Map(e.estadoCierre.map((x) => [x.elementId, x.estado]));

  const lineas: string[] = [
    `### ACTAS DEL PROYECTO ${e.proyecto.code} (${e.proyecto.name}) · ${e.trimestre} (${fechaEs(e.desde)}–${fechaEs(e.hasta)})`,
    "Origen: módulo Actas del portal ICAM (seguimiento del equipo de proyecto). Cada línea «·» es una anotación fechada; entre corchetes, el cambio de estado que registró. Para cada elemento se indica su estado al inicio y al cierre del trimestre.",
  ];
  const tras = e.cierreTrimestre && e.hasta > e.cierreTrimestre ? e.cierreTrimestre : null;
  if (tras) {
    lineas.push(
      `Incluye también lo anotado después del cierre del trimestre (${fechaEs(tras)}) hasta el ${fechaEs(e.hasta)}, marcado «[posterior al cierre]»; el estado «al cierre» es el del ${fechaEs(e.hasta)}. Son hechos posteriores al trimestre: cuéntalos como tales («a fecha de este informe…») y no como logros del ${e.trimestre}.`,
    );
  }

  let elementosConActividad = 0;
  let pasanAHecho = 0;
  const cuerpo: string[] = [];

  for (const cat of e.vista.categories) {
    const bloque: string[] = [];
    for (const el of cat.elements) {
      if (!el.entries.length) continue;
      elementosConActividad++;
      const antes = inicio.get(el.id) ?? null;
      const despues = cierre.get(el.id) ?? null;
      if (despues === "done" && antes !== "done") pasanAHecho++;
      const sangria = "  ".repeat(el.depth);
      bloque.push(`${sangria}- ${el.name}${marcaEstado(antes, despues)}`);
      for (const en of el.entries) {
        const cambio =
          en.statusAfter && en.statusAfter !== en.statusBefore
            ? ` [${etiqueta(en.statusBefore)} → ${etiqueta(en.statusAfter)}]`
            : "";
        const autor = en.author?.label ? ` (${en.author.label})` : "";
        const posterior = tras && en.entryDate.slice(0, 10) > tras ? " [posterior al cierre]" : "";
        bloque.push(
          `${sangria}  · ${fechaEs(en.entryDate)}${autor}${posterior}: ${recortar(en.content, MAX_CARACTERES_ENTRADA)}${cambio}`,
        );
      }
    }
    if (bloque.length) cuerpo.push(`\n## ${cat.displayName}`, ...bloque);
  }

  // Lo que sigue bloqueado al cierre es materia de riesgos aunque no tenga
  // anotaciones este trimestre.
  const bloqueados = e.estadoCierre.filter((x) => x.estado === "stuck");

  lineas.push(
    `Resumen: ${e.vista.totalEntryCount} anotaciones en ${elementosConActividad} elementos; ${pasanAHecho} elementos pasan a «Hecho»; ${bloqueados.length} elementos bloqueados al cierre.`,
  );
  if (!elementosConActividad) {
    lineas.push("\n(No hay anotaciones en el trimestre.)");
  }
  lineas.push(...cuerpo);
  if (bloqueados.length) {
    lineas.push(tras ? `\n## Elementos bloqueados a ${fechaEs(e.hasta)}` : "\n## Elementos bloqueados al cierre del trimestre");
    for (const b of bloqueados) {
      const cat = e.categorias[b.categoriaId];
      lineas.push(`- ${b.nombre}${cat ? ` (${cat})` : ""}`);
    }
  }

  const texto = lineas.join("\n");
  return texto.length > MAX_CARACTERES_ACTAS
    ? `${texto.slice(0, MAX_CARACTERES_ACTAS)}\n[… actas recortadas por longitud: faltan las últimas categorías]`
    : texto;
}
