import type { InformeJson } from "../slides/tipos";
import { CATEGORIAS_FOTO, type Analisis, type BaseInforme, type CategoriaFoto, type EstadoInforme, type QaInforme, type Seleccion } from "../types";
import { urlFoto } from "./paths";

/**
 * Importación de los informes hechos antes del portal (artifact de claude.ai y
 * skill), desde el paquete de migración-portal/paquete. Lo usa
 * scripts/pm/importar-informes.ts. Aquí solo la parte pura: documentos de la
 * app → filas de la migración 043 y reescritura de fotos.
 */

const BLOB = /\/_blob\/([A-Za-z0-9_-]+)/g;

/** ids de foto (`/_blob/<id>`) que usa un documento. */
export function idsDeFotos(doc: unknown): string[] {
  const ids = new Set<string>();
  for (const m of JSON.stringify(doc).matchAll(BLOB)) ids.add(m[1]!);
  return [...ids].sort();
}

function recorrer(v: unknown, fn: (s: string) => string): unknown {
  if (typeof v === "string") return fn(v);
  if (Array.isArray(v)) return v.map((x) => recorrer(x, fn));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, recorrer(x, fn)]));
  return v;
}

/** `/_blob/<id>` → `/api/informes/fotos/<id nuevo>`. Devuelve los que no tienen id nuevo. */
export function reescribirFotos<T>(doc: T, nuevos: Record<string, string>): { doc: T; sinResolver: string[] } {
  const sinResolver = new Set<string>();
  const reescrito = recorrer(doc, (s) =>
    s.replace(BLOB, (todo, id: string) => {
      const nuevo = nuevos[id];
      if (!nuevo) {
        sinResolver.add(id);
        return todo;
      }
      return urlFoto(nuevo);
    }),
  ) as T;
  return { doc: reescrito, sinResolver: [...sinResolver].sort() };
}

/** Normaliza un código para emparejar informe ↔ activo PM (SE84 ↔ «SE 84», «se-84»). */
export function normalizarCodigo(codigo: string): string {
  return codigo.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Activo PM de un proyecto: código exacto o el único con el mismo código normalizado. Ambiguo o ninguno → null. */
export function emparejarActivo(codigo: string, activos: string[]): string | null {
  if (activos.includes(codigo)) return codigo;
  const objetivo = normalizarCodigo(codigo);
  const candidatos = activos.filter((a) => normalizarCodigo(a) === objetivo);
  return candidatos.length === 1 ? candidatos[0]! : null;
}

/** Categorías de foto de la app original → las de la migración 043. */
export function categoriaFoto(c: unknown): CategoriaFoto {
  if (c === "Render o diseño") return "Render";
  return (CATEGORIAS_FOTO as readonly string[]).includes(c as string) ? (c as CategoriaFoto) : "Otra";
}

const ESTADOS: EstadoInforme[] = ["datos", "fuentes", "analizado", "generando", "borrador", "aprobado"];

type Doc = Record<string, unknown>;

export interface FilaInformeImportada {
  id: string;
  codigo: string;
  trimestre: string;
  trimestre_anterior: string;
  siguiente: string;
  estado: EstadoInforme;
  version: number;
  base: BaseInforme | null;
  analisis: Analisis | null;
  seleccion: Seleccion | null;
  contenido: InformeJson | null;
  qa: QaInforme | null;
  created_at: string;
  updated_at: string;
}

/** Documento «informes/<id>» de la app → fila de `informe` (con las fotos ya reescritas en `doc`). */
export function filaInforme(doc: Doc): FilaInformeImportada {
  const estado = ESTADOS.includes(doc.estado as EstadoInforme) ? (doc.estado as EstadoInforme) : "borrador";
  const ahora = new Date().toISOString();
  const informe = doc.informe as InformeJson | undefined;
  return {
    id: String(doc.id),
    codigo: String(doc.codigo),
    trimestre: String(doc.trimestre),
    trimestre_anterior: String(doc.trimestreAnterior),
    siguiente: String(doc.siguiente),
    estado,
    version: Number(doc.version) || 1,
    base: (doc.base as BaseInforme | undefined) ?? (informe?.slides?.length ? { tipo: "ninguno" } : null),
    analisis: (doc.analisis as Analisis | undefined) ?? null,
    seleccion: (doc.seleccion as Seleccion | undefined) ?? null,
    contenido: informe?.slides ? informe : null,
    qa: (doc.qa as QaInforme | undefined) ?? null,
    created_at: typeof doc.creado === "string" ? doc.creado : ahora,
    updated_at: typeof doc.actualizado === "string" ? doc.actualizado : ahora,
  };
}

export interface FuenteImportada {
  tipo: "notas" | "documento" | "previo";
  nombre: string;
  texto: string;
  orden: number;
}

/** Documento «fuentes/<id>» de la app → filas de `informe_fuente`. */
export function fuentesDe(doc: Doc | undefined): FuenteImportada[] {
  if (!doc) return [];
  const out: FuenteImportada[] = [];
  if (typeof doc.notas === "string" && doc.notas.trim()) out.push({ tipo: "notas", nombre: "Notas del equipo", texto: doc.notas, orden: 50 });
  if (typeof doc.previoTexto === "string" && doc.previoTexto.trim()) {
    out.push({ tipo: "previo", nombre: String(doc.previoNombre || "Informe anterior"), texto: doc.previoTexto, orden: 10 });
  }
  for (const d of Array.isArray(doc.documentos) ? (doc.documentos as Doc[]) : []) {
    if (typeof d.texto === "string" && d.texto.trim()) out.push({ tipo: "documento", nombre: String(d.nombre || "Documento"), texto: d.texto, orden: 100 });
  }
  return out;
}
