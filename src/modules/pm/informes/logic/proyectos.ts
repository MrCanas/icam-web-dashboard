import type { ProyectoInforme } from "../types";
import { limpiarCodigo } from "./trimestre";

export interface ActivoPm {
  /** pm_activos.id (uuid), al que apunta project.pm_activo_id. */
  id: string;
  id_activo: string;
  nombre_display: string | null;
}

export interface ProyectoActas {
  code: string;
  name: string | null;
  pm_activo_id: string | null;
  archived_at: string | null;
}

const normal = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

/**
 * Nombre visible de cada activo: `nombre_display` o, como casi todos lo tienen
 * vacío, el del proyecto de Actas vinculado (por pm_activo_id o, si no hay
 * vínculo, por código normalizado).
 */
export function nombresDeActivos(activos: ActivoPm[], actas: ProyectoActas[]): Record<string, string> {
  const nombres: Record<string, string> = {};
  for (const a of activos) {
    const propio = a.nombre_display?.trim();
    if (propio) {
      nombres[a.id_activo] = propio;
      continue;
    }
    const p =
      actas.find((x) => x.pm_activo_id === a.id && !x.archived_at) ??
      actas.find((x) => x.pm_activo_id == null && !x.archived_at && normal(x.code) === normal(a.id_activo));
    if (p?.name?.trim()) nombres[a.id_activo] = p.name.trim();
  }
  return nombres;
}

/**
 * Proyectos del paso 0: los configurados para informe más todos los activos de
 * pm_activos que todavía no lo están (configurado = false: se pide arquetipo y
 * pie legal, con nombre, código y vínculo ya puestos).
 */
export function proyectosParaInforme(
  configurados: ProyectoInforme[],
  activos: ActivoPm[],
  nombres: Record<string, string>,
): ProyectoInforme[] {
  const conActivo = new Set(configurados.map((p) => p.idActivo).filter(Boolean));
  const codigos = new Set(configurados.map((p) => p.codigo));
  const pendientes: ProyectoInforme[] = [];
  for (const a of activos) {
    if (conActivo.has(a.id_activo)) continue;
    const codigo = limpiarCodigo(a.id_activo);
    if (!codigo || codigos.has(codigo)) continue;
    codigos.add(codigo);
    pendientes.push({
      codigo,
      idActivo: a.id_activo,
      nombre: nombres[a.id_activo] || a.id_activo,
      arquetipo: null,
      pie: null,
      configurado: false,
    });
  }
  return [...configurados, ...pendientes].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}
