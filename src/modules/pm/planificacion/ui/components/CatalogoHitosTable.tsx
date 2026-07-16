"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { PmHitoCatalogo } from "@/modules/pm/types";
import { updateHitoCatalogo } from "@/modules/pm/planificacion/actions/upsert-hito-catalogo";
import {
  ETIQUETA_MAPEO,
  estadoMapeo,
  TABLA_MADRE_COLUMNAS_HITO,
  type EstadoMapeoTablaMadre,
} from "@/modules/pm/planificacion/logic/tabla-madre-columnas";

const BADGE: Record<EstadoMapeoTablaMadre, string> = {
  en_tabla_madre: "bg-emerald-50 text-emerald-700 border-emerald-200",
  propuesto: "bg-amber-50 text-amber-700 border-amber-200",
  sin_mapear: "bg-subtle/40 text-text-muted border-subtle",
};

interface CatalogoHitosTableProps {
  catalogo: PmHitoCatalogo[];
  hasWriteAccess: boolean;
}

/**
 * Mapeo hito de PM ↔ columna de la Tabla madre.
 *
 * Dos estados a propósito:
 *   - Una de las 8 columnas que YA existen (DW-EL) → «En Tabla madre».
 *   - Texto libre → «Propuesto»: deja documentado qué columna habría que crear
 *     en el Excel el día que se quieran llevar también estos hitos.
 */
export function CatalogoHitosTable({ catalogo, hasWriteAccess }: CatalogoHitosTableProps) {
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [optimista, setOptimista] = useState<Record<string, string | null>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mostrarToast = (msg: string) => {
    setToast(msg);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 4000);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const columnaDe = (c: PmHitoCatalogo) =>
    optimista[c.id] !== undefined ? optimista[c.id] : c.tabla_madre_columna;

  const guardar = (c: PmHitoCatalogo, columna: string | null) => {
    const previo = columnaDe(c);
    setOptimista((o) => ({ ...o, [c.id]: columna }));
    startTransition(async () => {
      const r = await updateHitoCatalogo({ id: c.id, tablaMadreColumna: columna });
      if (!r.ok) {
        setOptimista((o) => ({ ...o, [c.id]: previo }));
        mostrarToast(r.error);
        return;
      }
      router.refresh();
    });
  };

  const enTablaMadre = catalogo.filter((c) => c.tabla_madre_existe).length;
  const propuestos = catalogo.filter((c) => c.tabla_madre_columna && !c.tabla_madre_existe).length;
  const sinMapear = catalogo.length - enTablaMadre - propuestos;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700">
          {enTablaMadre} en Tabla madre
        </span>
        <span className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700">
          {propuestos} propuestos
        </span>
        <span className="rounded border border-subtle bg-subtle/30 px-2 py-1 text-text-muted">
          {sinMapear} sin mapear
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-subtle/50 bg-card">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-subtle bg-subtle/30 text-left">
              <th className="p-3 font-semibold text-[#1E2A56]">Hito PM</th>
              <th className="p-3 font-semibold text-[#1E2A56]">Estado</th>
              <th className="p-3 font-semibold text-[#1E2A56]">Columna en Tabla madre</th>
            </tr>
          </thead>
          <tbody>
            {catalogo.map((c) => {
              const columna = columnaDe(c);
              const existe = TABLA_MADRE_COLUMNAS_HITO.some(
                (t) => t.cabecera.toLowerCase() === (columna ?? "").toLowerCase(),
              );
              const estado = estadoMapeo(columna, existe);
              return (
                <tr key={c.id} className="border-b border-subtle/70">
                  <td className="p-3">
                    <span className="flex items-center gap-1.5 font-medium text-text-body">
                      {c.color ? (
                        <span
                          aria-hidden
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: c.color }}
                        />
                      ) : null}
                      {c.nombre}
                    </span>
                  </td>
                  <td className="p-3">
                    <span
                      className={`inline-flex w-fit items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${BADGE[estado]}`}
                    >
                      {ETIQUETA_MAPEO[estado]}
                    </span>
                  </td>
                  <td className="p-3">
                    {hasWriteAccess ? (
                      <select
                        value={columna ?? ""}
                        disabled={pending}
                        className={`w-full max-w-xs rounded border bg-page px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-icam-900/20 disabled:opacity-60 ${
                          columna ? "border-subtle text-text-body" : "border-subtle text-text-muted"
                        }`}
                        onChange={(e) => guardar(c, e.target.value || null)}
                      >
                        <option value="">— sin mapear —</option>
                        {TABLA_MADRE_COLUMNAS_HITO.map((t) => (
                          <option key={t.cabecera} value={t.cabecera}>
                            {t.cabecera} ({t.letra})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-text-body">{columna ?? "—"}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs leading-snug text-text-muted">
        La Tabla madre solo tiene 8 columnas de hito (DW–EL), así que los otros{" "}
        {catalogo.length - TABLA_MADRE_COLUMNAS_HITO.length} hitos de PM no caben hoy.
        Mapearlos aquí no cambia el Excel: deja registrado a qué columna
        corresponderían el día que se decida ampliarlo.
      </p>

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
