"use server";

import { cargarFuentesAutomaticas } from "../data/fuentesAutoRepository";
import {
  actualizarFuente,
  anadirFuente,
  borrarFuente,
  guardarNotas,
  listarFuentes,
  reemplazarAutomaticas,
} from "../data/fuentesRepository";
import { actualizarFoto, borrarFoto, listarFotos } from "../data/fotosRepository";
import {
  actualizarInforme,
  anotarCambio,
  borrarInforme,
  crearInforme,
  guardarProyecto,
  guardarVersion,
  listarCambios,
  obtenerInforme,
  obtenerProyecto,
  type CambiosInforme,
} from "../data/informesRepository";
import { resumenUsoInforme } from "../data/usoRepository";
import { esIdInforme, limpiarCodigo, parseTrimestre, qSig } from "../logic/trimestre";
import type { Pie } from "../slides/tipos";
import {
  ARQUETIPOS,
  type Arquetipo,
  type CategoriaFoto,
  type Cambio,
  type Foto,
  type Fuente,
  type Resultado,
  type ResumenUso,
  type TipoFuente,
} from "../types";
import { usuarioEscritura, usuarioLectura } from "./acceso";

/**
 * Acciones de servidor del módulo de informes. Toda escritura exige editor o
 * admin de pm (usuarioEscritura) y queda en audit_log desde el repositorio.
 * Nunca lanzan: devuelven {ok:false, error} para que la UI lo enseñe.
 */

function mal(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

function limpiarPie(p: unknown): Pie | null {
  if (!p || typeof p !== "object") return null;
  const x = p as Record<string, unknown>;
  const t = (k: string) => (typeof x[k] === "string" ? (x[k] as string).trim() : "");
  if (x.variante === "cnmv") return { variante: "cnmv", tipo: t("tipo") || "fondo", fondo: t("fondo"), isin: t("isin") };
  if (x.variante === "sl") return { variante: "sl", vehiculo: t("vehiculo"), nif: t("nif"), ...(t("entidad") ? { entidad: t("entidad") } : {}) };
  return null;
}

export interface EntradaNuevoInforme {
  /** Código del proyecto elegido; vacío si es «Otro proyecto». */
  codigo: string;
  /** Solo «Otro proyecto». */
  nombre?: string;
  codigoNuevo?: string;
  /** Activo PM a vincular (proyecto sin configurar, o proyecto sin activo). */
  idActivo?: string | null;
  arquetipo?: Arquetipo;
  pie?: Pie | null;
  trimestre: string;
  trimestreAnterior: string;
  /** El proyecto elegido no está configurado todavía (activo PM). */
  configurar: boolean;
}

/** Paso 0: configura el proyecto si hace falta y crea (o encuentra) el informe del trimestre. */
export async function accionCrearInforme(e: EntradaNuevoInforme): Promise<Resultado<{ id: string; existia: boolean }>> {
  try {
    const acceso = await usuarioEscritura();
    if ("error" in acceso) return mal(acceso.error);
    const ctx = acceso.user;
    if (!parseTrimestre(e.trimestre) || !parseTrimestre(e.trimestreAnterior)) return mal("Trimestre no válido.");
    if (qSig(e.trimestreAnterior) !== e.trimestre) {
      return mal(`El trimestre nuevo debe ser el siguiente al anterior (${qSig(e.trimestreAnterior)}).`);
    }
    const arquetipo = ARQUETIPOS.some((a) => a.valor === e.arquetipo) ? (e.arquetipo as Arquetipo) : "A";

    let codigo = e.codigo;
    if (!codigo) {
      codigo = limpiarCodigo(e.codigoNuevo ?? "");
      const nombre = (e.nombre ?? "").trim();
      if (!nombre || !codigo) return mal("Indica el nombre y el código corto del proyecto.");
      const ya = await obtenerProyecto(ctx, codigo);
      if (ya.error !== null) return mal(ya.error);
      if (ya.data) return mal(`Ya existe un proyecto con el código ${codigo}: elígelo en la lista.`);
      const g = await guardarProyecto(ctx, { codigo, nombre, idActivo: e.idActivo || null, arquetipo, pie: limpiarPie(e.pie) });
      if (g.error !== null) return mal(g.error);
    } else if (e.configurar) {
      const g = await guardarProyecto(ctx, {
        codigo,
        nombre: (e.nombre ?? codigo).trim() || codigo,
        idActivo: e.idActivo || null,
        arquetipo,
        pie: limpiarPie(e.pie),
      });
      if (g.error !== null) return mal(g.error);
    } else {
      const p = await obtenerProyecto(ctx, codigo);
      if (p.error !== null) return mal(p.error);
      if (!p.data) return mal("Ese proyecto ya no existe.");
      if (!p.data.idActivo && e.idActivo) {
        const g = await guardarProyecto(ctx, { ...p.data, arquetipo: p.data.arquetipo ?? "A", idActivo: e.idActivo });
        if (g.error !== null) return mal(g.error);
      }
    }

    const r = await crearInforme(ctx, codigo, e.trimestre);
    if (r.error !== null) return mal(r.error);
    if (!r.data.existia) await anotarCambio(ctx, r.data.id, "Informe creado");
    return { ok: true, data: r.data };
  } catch (err) {
    console.error("[informes] crear", err);
    return mal(err instanceof Error ? err.message : "No se ha podido crear el informe");
  }
}

/** Guarda cambios del informe (estado, análisis, selección, contenido, QA…). */
export async function accionActualizarInforme(
  id: string,
  cambios: CambiosInforme,
  cambio?: string,
): Promise<Resultado<{ actualizado: string }>> {
  try {
    if (!esIdInforme(id)) return mal("Informe no válido.");
    const acceso = await usuarioEscritura();
    if ("error" in acceso) return mal(acceso.error);
    const r = await actualizarInforme(acceso.user, id, cambios);
    if (r.error !== null) return mal(r.error);
    if (cambio) await anotarCambio(acceso.user, id, cambio);
    return { ok: true, data: r.data };
  } catch (err) {
    console.error("[informes] actualizar", err);
    return mal(err instanceof Error ? err.message : "No se ha podido guardar");
  }
}

export async function accionBorrarInforme(id: string): Promise<Resultado> {
  if (!esIdInforme(id)) return mal("Informe no válido.");
  const acceso = await usuarioEscritura();
  if ("error" in acceso) return mal(acceso.error);
  const r = await borrarInforme(acceso.user, id);
  return r.error !== null ? mal(r.error) : { ok: true, data: undefined };
}

export async function accionGuardarVersion(id: string): Promise<Resultado<{ version: number }>> {
  const acceso = await usuarioEscritura();
  if ("error" in acceso) return mal(acceso.error);
  const inf = await obtenerInforme(acceso.user, id);
  if (inf.error !== null) return mal(inf.error);
  if (!inf.data) return mal("El informe ya no existe.");
  const r = await guardarVersion(acceso.user, inf.data);
  if (r.error !== null) return mal(r.error);
  await anotarCambio(acceso.user, id, `Versión ${inf.data.version} guardada; se trabaja sobre la ${r.data.version}`);
  return { ok: true, data: r.data };
}

export async function accionAnotarCambio(id: string, texto: string): Promise<Resultado> {
  const acceso = await usuarioEscritura();
  if ("error" in acceso) return mal(acceso.error);
  await anotarCambio(acceso.user, id, texto);
  return { ok: true, data: undefined };
}

export async function accionHistorial(id: string): Promise<Resultado<{ cambios: Cambio[]; uso: ResumenUso | null }>> {
  const acceso = await usuarioLectura();
  if ("error" in acceso) return mal(acceso.error);
  const [c, u] = await Promise.all([listarCambios(acceso.user, id), resumenUsoInforme(acceso.user, id)]);
  if (c.error !== null) return mal(c.error);
  return { ok: true, data: { cambios: c.data, uso: u.data } };
}

/* ------------------------------------------------------------------ fuentes */

export async function accionListarFuentes(id: string): Promise<Resultado<Fuente[]>> {
  const acceso = await usuarioLectura();
  if ("error" in acceso) return mal(acceso.error);
  const r = await listarFuentes(acceso.user, id);
  return r.error !== null ? mal(r.error) : { ok: true, data: r.data };
}

export async function accionGuardarNotas(id: string, texto: string): Promise<Resultado> {
  const acceso = await usuarioEscritura();
  if ("error" in acceso) return mal(acceso.error);
  const r = await guardarNotas(acceso.user, id, texto);
  return r.error !== null ? mal(r.error) : { ok: true, data: undefined };
}

export async function accionAnadirFuente(
  id: string,
  f: { tipo: TipoFuente; nombre: string; texto: string },
): Promise<Resultado<Fuente>> {
  const acceso = await usuarioEscritura();
  if ("error" in acceso) return mal(acceso.error);
  if (!["documento", "previo", "correccion"].includes(f.tipo)) return mal("Tipo de fuente no válido.");
  const r = await anadirFuente(acceso.user, id, { ...f, orden: f.tipo === "previo" ? 10 : 100 });
  return r.error !== null ? mal(r.error) : { ok: true, data: r.data };
}

export async function accionIncluirFuente(id: string, fuenteId: number, incluida: boolean): Promise<Resultado> {
  const acceso = await usuarioEscritura();
  if ("error" in acceso) return mal(acceso.error);
  const r = await actualizarFuente(acceso.user, id, fuenteId, { incluida });
  return r.error !== null ? mal(r.error) : { ok: true, data: undefined };
}

export async function accionBorrarFuente(id: string, fuenteId: number): Promise<Resultado> {
  const acceso = await usuarioEscritura();
  if ("error" in acceso) return mal(acceso.error);
  const r = await borrarFuente(acceso.user, id, fuenteId);
  return r.error !== null ? mal(r.error) : { ok: true, data: undefined };
}

/** Carga (o recarga) las actas y la planificación del trimestre como fuentes «del portal». */
export async function accionCargarFuentesAuto(id: string): Promise<Resultado<{ fuentes: Fuente[]; avisos: string[] }>> {
  try {
    const acceso = await usuarioEscritura();
    if ("error" in acceso) return mal(acceso.error);
    const ctx = acceso.user;
    const inf = await obtenerInforme(ctx, id);
    if (inf.error !== null) return mal(inf.error);
    if (!inf.data) return mal("El informe ya no existe.");
    const idActivo = inf.data.proyecto.idActivo;
    if (!idActivo) {
      return {
        ok: true,
        data: {
          fuentes: (await listarFuentes(ctx, id)).data ?? [],
          avisos: ["Este proyecto no está vinculado a un activo de Proyectos: añade las actas y la planificación a mano."],
        },
      };
    }
    const t = parseTrimestre(inf.data.trimestre)!;
    const r = await cargarFuentesAutomaticas(ctx, idActivo, t, inf.data.trimestre);
    const g = await reemplazarAutomaticas(ctx, id, r.documentos);
    if (g.error !== null) return mal(g.error);
    const fuentes = await listarFuentes(ctx, id);
    if (fuentes.error !== null) return mal(fuentes.error);
    return { ok: true, data: { fuentes: fuentes.data, avisos: r.avisos } };
  } catch (err) {
    console.error("[informes] fuentes automáticas", err);
    return mal(`No se han podido cargar las actas y la planificación (${err instanceof Error ? err.message : "error"}). Puedes añadirlas a mano.`);
  }
}

/* ------------------------------------------------------------------ fotos */

export async function accionListarFotos(id: string): Promise<Resultado<Foto[]>> {
  const acceso = await usuarioLectura();
  if ("error" in acceso) return mal(acceso.error);
  const r = await listarFotos(acceso.user, id);
  return r.error !== null ? mal(r.error) : { ok: true, data: r.data };
}

export async function accionActualizarFoto(
  id: string,
  fotoId: string,
  cambios: { categoria?: CategoriaFoto; para?: string | null; pie?: string | null },
): Promise<Resultado> {
  const acceso = await usuarioEscritura();
  if ("error" in acceso) return mal(acceso.error);
  const r = await actualizarFoto(acceso.user, id, fotoId, cambios);
  return r.error !== null ? mal(r.error) : { ok: true, data: undefined };
}

export async function accionBorrarFoto(id: string, fotoId: string): Promise<Resultado> {
  const acceso = await usuarioEscritura();
  if ("error" in acceso) return mal(acceso.error);
  const r = await borrarFoto(acceso.user, id, fotoId);
  return r.error !== null ? mal(r.error) : { ok: true, data: undefined };
}
