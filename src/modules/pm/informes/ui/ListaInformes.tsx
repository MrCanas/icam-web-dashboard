"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { accionBorrarInforme } from "../actions/informes";
import { rutaInforme, rutaNuevoInforme } from "../logic/paths";
import type { InformeResumen } from "../types";
import { Aviso, Boton, ChipEstado, fechaCorta, Tarjeta } from "./componentes";

interface Props {
  informes: InformeResumen[];
  puedeEditar: boolean;
  /** En la subpestaña de un proyecto: «Nuevo informe» ya lleva el activo elegido. */
  idActivo?: string;
  error?: string | null;
}

export function ListaInformes({ informes, puedeEditar, idActivo, error }: Props) {
  const router = useRouter();
  const [confirmar, setConfirmar] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [pendiente, empezar] = useTransition();

  function borrar(id: string) {
    empezar(async () => {
      const r = await accionBorrarInforme(id);
      setConfirmar(null);
      if (!r.ok) setMensaje({ tipo: "error", texto: `No se ha podido eliminar el informe: ${r.error}` });
      else {
        setMensaje({ tipo: "ok", texto: "Informe eliminado." });
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4 min-w-0">
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      {mensaje ? <Aviso tipo={mensaje.tipo}>{mensaje.texto}</Aviso> : null}
      {!puedeEditar ? (
        <Aviso>Tu acceso a Proyectos es de lectura: puedes consultar los informes, pero no generarlos ni modificarlos.</Aviso>
      ) : null}
      <Tarjeta>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-text-primary">Informes trimestrales para inversores</h2>
          {puedeEditar ? (
            <Link href={rutaNuevoInforme(idActivo)} className="rounded-md bg-icam-900 px-4 py-2 text-sm font-medium text-white hover:bg-icam-800">
              Nuevo informe
            </Link>
          ) : null}
        </div>
        {informes.length ? (
          <div className="overflow-x-auto rounded-lg border border-subtle/60">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-subtle/30">
                <tr>
                  <th className="p-3 font-semibold text-icam-900">Proyecto</th>
                  <th className="p-3 font-semibold text-icam-900">Trimestre</th>
                  <th className="p-3 font-semibold text-icam-900">Estado</th>
                  <th className="p-3 font-semibold text-icam-900">Versión</th>
                  <th className="p-3 font-semibold text-icam-900">Actualizado</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {informes.map((d) => (
                  <tr key={d.id} className="border-t border-subtle/60 align-top">
                    <td className="p-3">
                      <b className="font-semibold text-text-primary">{d.proyecto}</b>
                      <br />
                      <span className="text-xs text-text-muted">{d.codigo}</span>
                    </td>
                    <td className="p-3 tabular-nums">{d.trimestre}</td>
                    <td className="p-3">
                      <ChipEstado estado={d.estado} />
                    </td>
                    <td className="p-3 tabular-nums">v{d.version}</td>
                    <td className="p-3 tabular-nums whitespace-nowrap">{fechaCorta(d.actualizado)}</td>
                    <td className="p-3">
                      {confirmar === d.id ? (
                        <span className="inline-flex flex-wrap items-center gap-2 text-sm">
                          <span>
                            ¿Eliminar <b>{d.proyecto} {d.trimestre}</b> con sus fuentes, fotos y versiones? No se puede deshacer.
                          </span>
                          <button
                            type="button"
                            disabled={pendiente}
                            onClick={() => borrar(d.id)}
                            className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            Sí, eliminar
                          </button>
                          <Boton pequeno onClick={() => setConfirmar(null)}>
                            Cancelar
                          </Boton>
                        </span>
                      ) : (
                        <span className="inline-flex gap-2">
                          <Link
                            href={rutaInforme(d.id)}
                            className="rounded-md border border-subtle bg-card px-2.5 py-1 text-xs font-medium text-text-primary hover:bg-page"
                          >
                            Abrir
                          </Link>
                          {puedeEditar ? (
                            <Boton variante="peligro" pequeno onClick={() => setConfirmar(d.id)}>
                              Eliminar
                            </Boton>
                          ) : null}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-text-muted">
            {idActivo ? "Este proyecto todavía no tiene informes." : "Todavía no hay informes."}
            {puedeEditar ? " Empieza con «Nuevo informe»." : ""}
          </p>
        )}
      </Tarjeta>
      <p className="text-sm text-text-muted">
        Flujo: datos del informe → informe anterior → información del trimestre → biblioteca y GO → revisión y correcciones → PDF.
        Las actas y la planificación del trimestre se cargan solas.
      </p>
    </div>
  );
}
