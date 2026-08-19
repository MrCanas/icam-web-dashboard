"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import type { PmPortfolioRow } from "@/modules/pm/data/pmRepository";
import { archiveActivo, createActivo } from "@/modules/pm/planificacion/actions/crud-activo";
import type { PromocionesYMapeo } from "@/modules/pm/avance/data/avanceRepository";
import { MapeoPromocionCell } from "@/modules/pm/avance/ui/components/MapeoPromocionCell";
import type { ProyectoFinancieroOption } from "@/modules/pm/planificacion/data/planificacionRepository";
import { TIPOS_USO } from "@/modules/pm/planificacion/logic/planificacion-validation";

import { MapeoProyectoCell } from "./MapeoProyectoCell";

interface ProyectosTableProps {
  rows: PmPortfolioRow[];
  proyectosFinancieros: ProyectoFinancieroOption[];
  mapeo: Record<string, string>;
  /** Promociones de Zoho y su emparejamiento. Vacío si falta la migración 028. */
  promociones: PromocionesYMapeo["promociones"];
  mapeoPromociones: PromocionesYMapeo["mapeo"];
  hasWriteAccess: boolean;
}

export function ProyectosTable({
  rows,
  proyectosFinancieros,
  mapeo,
  promociones,
  mapeoPromociones,
  hasWriteAccess,
}: ProyectosTableProps) {
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [nuevoCodigo, setNuevoCodigo] = useState("");
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoTipo, setNuevoTipo] = useState<string>(TIPOS_USO[0]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mostrarToast = (msg: string) => {
    setToast(msg);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 4000);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // Cuántos activos comparten cada proyecto financiero: permite señalar el
  // caso PC25 en vez de que parezca un error de mapeo.
  const compartidos = useMemo(() => {
    const c: Record<string, number> = {};
    for (const key of Object.values(mapeo)) c[key] = (c[key] ?? 0) + 1;
    return c;
  }, [mapeo]);

  const sinMapear = rows.filter((r) => !mapeo[r.activo.id]).length;
  const sinPromocion = rows.filter((r) => !mapeoPromociones[r.activo.id]).length;

  const crear = () => {
    setError(null);
    startTransition(async () => {
      const r = await createActivo({
        idActivo: nuevoCodigo,
        tipoUso: nuevoTipo,
        nombreDisplay: nuevoNombre || null,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      mostrarToast(
        `Proyecto «${nuevoCodigo}» creado sin hitos. Añádeselos desde Planificación.`,
      );
      setCreando(false);
      setNuevoCodigo("");
      setNuevoNombre("");
      router.refresh();
    });
  };

  const archivar = (id: string, idActivo: string) => {
    startTransition(async () => {
      const r = await archiveActivo(id, true);
      if (!r.ok) {
        mostrarToast(r.error);
        return;
      }
      mostrarToast(`«${idActivo}» archivado. No se ha borrado nada.`);
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {sinMapear > 0 ? (
          <span className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700">
            {sinMapear} {sinMapear === 1 ? "activo sin mapear" : "activos sin mapear"} al maestro financiero
          </span>
        ) : (
          <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
            Todos los activos están mapeados
          </span>
        )}
        {promociones.length > 0 ? (
          sinPromocion > 0 ? (
            <span className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700">
              {sinPromocion}{" "}
              {sinPromocion === 1 ? "activo sin promoción" : "activos sin promoción"} de Zoho
            </span>
          ) : (
            <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
              Todos los activos tienen promoción de Zoho
            </span>
          )
        ) : null}
        {hasWriteAccess && !creando ? (
          <button
            type="button"
            onClick={() => setCreando(true)}
            className="ml-auto rounded-md bg-icam-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-icam-800"
          >
            Nuevo proyecto
          </button>
        ) : null}
      </div>

      {creando ? (
        <div className="rounded-lg border border-icam-900/20 bg-icam-900/[0.03] p-3">
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-[10px] font-medium text-text-muted">Código</label>
              <input
                autoFocus
                value={nuevoCodigo}
                onChange={(e) => setNuevoCodigo(e.target.value)}
                placeholder="PC25-CP6"
                className="mt-0.5 w-36 rounded border border-icam-900/30 bg-page px-1.5 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-icam-900/20"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-text-muted">Nombre</label>
              <input
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                placeholder="Padre Claret 25 — CP6"
                className="mt-0.5 w-52 rounded border border-icam-900/30 bg-page px-1.5 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-icam-900/20"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-text-muted">Uso</label>
              <select
                value={nuevoTipo}
                onChange={(e) => setNuevoTipo(e.target.value)}
                className="mt-0.5 rounded border border-icam-900/30 bg-page px-1.5 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-icam-900/20"
              >
                {TIPOS_USO.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              disabled={pending || !nuevoCodigo.trim()}
              onClick={crear}
              className="rounded-md bg-icam-900 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-icam-800 disabled:opacity-50"
            >
              {pending ? "Creando…" : "Crear"}
            </button>
            <button
              type="button"
              onClick={() => {
                setCreando(false);
                setError(null);
              }}
              className="rounded-md border border-subtle px-2.5 py-1 text-[11px] text-text-body hover:bg-page"
            >
              Cancelar
            </button>
          </div>
          {error ? (
            <p className="mt-2 text-[11px] text-red-600" role="alert">
              {error}
            </p>
          ) : null}
          <p className="mt-2 text-[10px] text-text-muted">
            Solo se admiten los usos {TIPOS_USO.join(" y ")}: son los que acepta la
            base de datos hoy. Si necesitas otro, hay que ampliarlo con una migración.
          </p>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-subtle/50 bg-card">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-subtle bg-subtle/30 text-left">
              <th className="p-3 font-semibold text-[#1E2A56]">PM</th>
              <th className="p-3 font-semibold text-[#1E2A56]">Nombre</th>
              <th className="p-3 font-semibold text-[#1E2A56]">Uso</th>
              <th className="p-3 font-semibold text-[#1E2A56]">Hitos</th>
              <th className="p-3 font-semibold text-[#1E2A56]">Financiero / Tabla madre</th>
              <th className="p-3 font-semibold text-[#1E2A56]">Promoción (Zoho)</th>
              <th className="p-3 font-semibold text-[#1E2A56]">Actas</th>
              <th className="p-3 font-semibold text-[#1E2A56]" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const key = mapeo[r.activo.id] ?? null;
              return (
                <tr key={r.activo.id} className="border-b border-subtle/70">
                  <td className="p-3 font-medium text-text-body">{r.activo.id_activo}</td>
                  <td className="p-3 text-text-muted">{r.activo.nombre_display ?? "—"}</td>
                  <td className="p-3 text-text-muted">{r.activo.tipo_uso_activo}</td>
                  <td className="p-3 tabular-nums text-text-muted">{r.hitos.length}</td>
                  <td className="p-3">
                    <MapeoProyectoCell
                      pmActivoId={r.activo.id}
                      valor={key}
                      opciones={proyectosFinancieros}
                      compartidoCon={key ? (compartidos[key] ?? 1) : 1}
                      hasWriteAccess={hasWriteAccess}
                      onError={mostrarToast}
                    />
                  </td>
                  <td className="p-3">
                    <MapeoPromocionCell
                      pmActivoId={r.activo.id}
                      valor={mapeoPromociones[r.activo.id]?.promocionId ?? null}
                      origen={mapeoPromociones[r.activo.id]?.origen ?? null}
                      opciones={promociones}
                      hasWriteAccess={hasWriteAccess}
                      onError={mostrarToast}
                    />
                  </td>
                  <td className="p-3 text-xs text-text-muted">—</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href="/dashboard/pm/planificacion"
                        className="text-xs font-medium text-icam-900 underline"
                      >
                        Planificar
                      </Link>
                      {hasWriteAccess ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => archivar(r.activo.id, r.activo.id_activo)}
                          className="text-xs text-text-muted underline hover:text-text-body disabled:opacity-50"
                          title="Baja lógica: no se borra nada, se puede revertir"
                        >
                          Archivar
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {toast ? (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 z-[80] -translate-x-1/2 rounded-lg border border-subtle/60 bg-card px-3 py-2 text-xs text-text-body shadow-lg"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}
