import type { ColeccionInforme, DocumentoApp } from "../types";

/**
 * Cómo se guarda cada colección de la app en Postgres.
 *
 * `datos` lleva el documento completo; `columnas` saca a columna los campos por
 * los que se lista o se filtra. Vive aquí, y no en el repositorio, para poder
 * probarlo sin base de datos.
 */
export interface DefinicionColeccion {
  tabla: string;
  clave: string;
  /** Campos del documento que además se guardan en columna. */
  columnas: (doc: DocumentoApp) => Record<string, unknown>;
  /** Filtros `where(campo, '==', valor)` admitidos: campo del doc → columna. */
  filtros: Record<string, string>;
  /** Columnas de usuario que hay que rellenar al escribir. */
  autor: { alta?: string; cambio?: string };
}

function texto(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function entero(v: unknown, porDefecto: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : porDefecto;
}

export const COLECCIONES: Record<ColeccionInforme, DefinicionColeccion> = {
  proyectos: {
    tabla: "informe_proyecto",
    clave: "codigo",
    columnas: (doc) => ({ id_activo: texto(doc.idActivo) }),
    filtros: {},
    autor: { cambio: "updated_by" },
  },
  informes: {
    tabla: "informe",
    clave: "id",
    columnas: (doc) => ({
      codigo: texto(doc.codigo) ?? "",
      trimestre: texto(doc.trimestre) ?? "",
      estado: texto(doc.estado) ?? "datos",
      version: entero(doc.version, 1),
      id_activo: texto(doc.idActivo),
    }),
    filtros: { codigo: "codigo", trimestre: "trimestre" },
    autor: { alta: "created_by", cambio: "updated_by" },
  },
  fuentes: {
    tabla: "informe_fuente",
    clave: "informe_id",
    columnas: () => ({}),
    filtros: {},
    autor: { cambio: "updated_by" },
  },
  versiones: {
    tabla: "informe_version",
    clave: "id",
    columnas: (doc) => ({
      informe_id: texto(doc.informeId) ?? "",
      version: entero(doc.version, 1),
    }),
    filtros: { informeId: "informe_id" },
    autor: { alta: "created_by" },
  },
};

export function esColeccion(v: string): v is ColeccionInforme {
  return Object.prototype.hasOwnProperty.call(COLECCIONES, v);
}

/** Ids que genera la app: códigos, `<codigo>_Qn-AAAA`, `<id>_v<n>`. */
const ID_VALIDO = /^[A-Za-z0-9_\-.]{1,120}$/;

export function esIdValido(id: string): boolean {
  return ID_VALIDO.test(id);
}

/** Tope por documento; la app ya se limita a 250 000 bytes. */
export const MAX_BYTES_DOCUMENTO = 300_000;

/**
 * Valida lo que llega de la app antes de escribirlo. Devuelve un mensaje de
 * error o null si se puede guardar.
 */
export function validarDocumento(
  coleccion: ColeccionInforme,
  id: string,
  doc: unknown,
): string | null {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    return "El documento debe ser un objeto JSON";
  }
  if (!esIdValido(id)) return "Id no válido";
  const bytes = Buffer.byteLength(JSON.stringify(doc), "utf8");
  if (bytes > MAX_BYTES_DOCUMENTO) {
    return `El documento ocupa ${bytes} bytes (máximo ${MAX_BYTES_DOCUMENTO})`;
  }
  if (coleccion === "informes") {
    const d = doc as DocumentoApp;
    if (typeof d.trimestre !== "string" || !/^Q[1-4] \d{4}$/.test(d.trimestre)) {
      return "trimestre debe tener la forma «Qn AAAA»";
    }
    if (typeof d.codigo !== "string" || !d.codigo.trim()) return "Falta el código del proyecto";
  }
  return null;
}
