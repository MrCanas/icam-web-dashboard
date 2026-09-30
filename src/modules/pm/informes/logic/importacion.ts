import type { DocumentoApp } from "../types";

/**
 * Importación de informes hechos fuera del portal (artifact de claude.ai o
 * skill): las fotos llegan referenciadas como `/_blob/<id>` y aquí pasan a
 * `/api/informes/assets/<id nuevo>`. Lo usa scripts/pm/importar-informes.ts.
 */

const BLOB = /\/_blob\/([A-Za-z0-9_-]+)/g;

export function idsDeFotos(doc: unknown): string[] {
  const ids = new Set<string>();
  for (const m of JSON.stringify(doc).matchAll(BLOB)) ids.add(m[1]!);
  return [...ids].sort();
}

function recorrer(v: unknown, fn: (s: string) => string): unknown {
  if (typeof v === "string") return fn(v);
  if (Array.isArray(v)) return v.map((x) => recorrer(x, fn));
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, recorrer(x, fn)]));
  }
  return v;
}

/**
 * Reescribe las referencias a fotos con los ids nuevos: las rutas `/_blob/<id>`
 * dentro de los slides y los `id` de la lista `fotos` del informe. Una foto sin
 * id nuevo se deja como estaba y se devuelve en `sinResolver`.
 */
export function reescribirFotos(
  doc: DocumentoApp,
  nuevos: Record<string, string>,
): { doc: DocumentoApp; sinResolver: string[] } {
  const sinResolver = new Set<string>();
  const reescrito = recorrer(doc, (s) =>
    s.replace(BLOB, (todo, id: string) => {
      const nuevo = nuevos[id];
      if (!nuevo) {
        sinResolver.add(id);
        return todo;
      }
      return `/api/informes/assets/${nuevo}`;
    }),
  ) as DocumentoApp;

  if (Array.isArray(reescrito.fotos)) {
    reescrito.fotos = (reescrito.fotos as Record<string, unknown>[]).map((f) => {
      const id = typeof f.id === "string" ? f.id : "";
      if (nuevos[id]) return { ...f, id: nuevos[id] };
      if (id && !/^[0-9a-f-]{36}$/i.test(id)) sinResolver.add(id);
      return f;
    });
  }
  return { doc: reescrito, sinResolver: [...sinResolver].sort() };
}

/** Normaliza un código para emparejar informe ↔ activo PM (SE84 ↔ «SE 84», «se-84»). */
export function normalizarCodigo(codigo: string): string {
  return codigo.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Activo PM de un proyecto de informe: el código exacto o, si no, el único
 * activo con el mismo código normalizado. Ambiguo o sin candidato → null.
 */
export function emparejarActivo(codigo: string, activos: string[]): string | null {
  if (activos.includes(codigo)) return codigo;
  const objetivo = normalizarCodigo(codigo);
  const candidatos = activos.filter((a) => normalizarCodigo(a) === objetivo);
  return candidatos.length === 1 ? candidatos[0]! : null;
}
