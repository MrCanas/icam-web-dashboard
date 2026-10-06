"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { fmtInt } from "@/lib/formatters";
import { cambiarExclusionAction } from "@/modules/comunicaciones/actions/comunicaciones";
import { esDireccionInterna } from "@/modules/comunicaciones/logic/destinatarios";
import {
  ETIQUETA_AVISO,
  type ComDestinatarioRow,
  type Direccion,
} from "@/modules/comunicaciones/types";

interface Props {
  comunicacionId: string;
  nombre: string;
  destinatarios: ComDestinatarioRow[];
  dominiosInternos: string[];
  editable: boolean;
}

type Filtro = "todos" | "a_enviar" | "con_avisos" | "excluidos" | "sin_destinatario";

const FILTROS: { clave: Filtro; etiqueta: string }[] = [
  { clave: "todos", etiqueta: "Todos" },
  { clave: "a_enviar", etiqueta: "Recibirían el correo" },
  { clave: "con_avisos", etiqueta: "Con avisos" },
  { clave: "excluidos", etiqueta: "Excluidos" },
  { clave: "sin_destinatario", etiqueta: "Sin destinatario" },
];

function pasa(d: ComDestinatarioRow, filtro: Filtro): boolean {
  switch (filtro) {
    case "a_enviar":
      return !d.excluido && d.para.length > 0;
    case "con_avisos":
      return d.avisos.length > 0;
    case "excluidos":
      return d.excluido;
    case "sin_destinatario":
      return d.para.length === 0;
    default:
      return true;
  }
}

function situacion(d: ComDestinatarioRow): string {
  if (d.excluido) return `Excluido: ${d.excluido_motivo ?? "a mano"}`;
  if (d.para.length === 0) return "Sin destinatario";
  return "Recibiría el correo";
}

/** Un campo de CSV: entre comillas si lleva separador, comillas o salto de línea. */
function celda(valor: string): string {
  return /[";\n]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}

function aCsv(destinatarios: readonly ComDestinatarioRow[]): string {
  const cabecera = ["Cuenta de inversión", "Situación", "Para", "Nombres", "Copia", "Avisos"];
  const filas = destinatarios.map((d) => [
    d.cuenta_nombre,
    situacion(d),
    d.para.map((p) => p.email).join(", "),
    d.para.map((p) => p.nombre).join(", "),
    d.copia.map((p) => p.email).join(", "),
    d.avisos.map((a) => ETIQUETA_AVISO[a]).join(", "),
  ]);
  // Punto y coma y BOM: es lo que abre bien Excel en español.
  return "﻿" + [cabecera, ...filas].map((f) => f.map(celda).join(";")).join("\r\n");
}

function Direcciones({ lista, dominiosInternos }: { lista: Direccion[]; dominiosInternos: string[] }) {
  if (lista.length === 0) return <span className="text-text-muted">—</span>;
  return (
    <ul className="space-y-0.5">
      {lista.map((d) => (
        <li key={d.email}>
          <span className="text-text-primary">{d.nombre}</span>{" "}
          <span className={esDireccionInterna(d.email, dominiosInternos) ? "text-[#9B3B3B]" : "text-text-muted"}>
            {d.email}
          </span>
          <span className="block text-xs text-text-muted">{d.rol}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * La lista de destinatarios, cuenta por cuenta.
 *
 * Es el control que faltaba en el kiosk: aquí se ve a quién se escribiría antes
 * de que exista la posibilidad de escribirle. Excluir a alguien es reversible y
 * no toca el CRM; solo cambia esta comunicación.
 */
export function DestinatariosPanel({ comunicacionId, nombre, destinatarios, dominiosInternos, editable }: Props) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [enCurso, setEnCurso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, empezar] = useTransition();

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return destinatarios.filter((d) => {
      if (!pasa(d, filtro)) return false;
      if (!q) return true;
      return (
        d.cuenta_nombre.toLowerCase().includes(q) ||
        [...d.para, ...d.copia].some((p) => p.email.includes(q) || p.nombre.toLowerCase().includes(q))
      );
    });
  }, [destinatarios, filtro, busqueda]);

  const descargar = () => {
    const url = URL.createObjectURL(new Blob([aCsv(destinatarios)], { type: "text/csv;charset=utf-8" }));
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = `destinatarios - ${nombre.replace(/[\\/:*?"<>|]/g, "-")}.csv`;
    enlace.click();
    URL.revokeObjectURL(url);
  };

  const alternar = (d: ComDestinatarioRow) => {
    setEnCurso(d.id);
    setError(null);
    empezar(async () => {
      const r = await cambiarExclusionAction(comunicacionId, d.id, !d.excluido);
      if (!r.ok) setError(r.mensaje);
      else router.refresh();
      setEnCurso(null);
    });
  };

  return (
    <section className="space-y-2" aria-labelledby="com-destinatarios">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="com-destinatarios" className="text-base font-semibold text-text-primary">
          Destinatarios
        </h2>
        <button
          type="button"
          onClick={descargar}
          className="min-h-9 rounded-md border border-subtle px-3 py-1.5 text-sm text-text-body hover:border-icam-900"
        >
          Descargar CSV
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.clave}
            type="button"
            aria-pressed={filtro === f.clave}
            onClick={() => setFiltro(f.clave)}
            className={`min-h-9 rounded-md border px-3 py-1.5 text-sm ${
              filtro === f.clave
                ? "border-icam-900 bg-icam-900 text-white"
                : "border-subtle text-text-body hover:border-icam-900"
            }`}
          >
            {f.etiqueta} ({fmtInt(destinatarios.filter((d) => pasa(d, f.clave)).length)})
          </button>
        ))}
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar cuenta, nombre o correo"
          aria-label="Buscar en los destinatarios"
          className="min-h-9 min-w-[220px] flex-1 rounded-md border border-subtle bg-card px-3 py-1.5 text-sm text-text-body"
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-[#9B3B3B]">
          {error}
        </p>
      ) : null}

      <div className="max-h-[640px] overflow-auto overscroll-x-contain rounded-lg border border-subtle/50 bg-card">
        <table className="w-full min-w-[900px] text-sm">
          <caption className="sr-only">
            Destinatarios de la comunicación, una fila por cuenta de inversión, con quién va en Para,
            quién en copia y los avisos de cada una.
          </caption>
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b border-subtle text-left text-text-muted">
              <th scope="col" className="px-3 py-2 font-medium">Cuenta de inversión</th>
              <th scope="col" className="px-3 py-2 font-medium">Para</th>
              <th scope="col" className="px-3 py-2 font-medium">Copia</th>
              <th scope="col" className="px-3 py-2 font-medium">Avisos</th>
              <th scope="col" className="px-3 py-2 font-medium">Situación</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((d) => (
              <tr
                key={d.id}
                className={`border-b border-subtle/60 align-top text-text-body last:border-b-0 ${
                  d.excluido || d.para.length === 0 ? "opacity-60" : ""
                }`}
              >
                <th scope="row" className="px-3 py-2 text-left font-medium text-text-primary">
                  {d.cuenta_nombre}
                </th>
                <td className="px-3 py-2">
                  <Direcciones lista={d.para} dominiosInternos={dominiosInternos} />
                </td>
                <td className="px-3 py-2">
                  <Direcciones lista={d.copia} dominiosInternos={dominiosInternos} />
                </td>
                <td className="px-3 py-2">
                  {d.avisos.length === 0 ? (
                    <span className="text-text-muted">—</span>
                  ) : (
                    <ul className="space-y-0.5">
                      {d.avisos.map((a) => (
                        <li key={a} className="text-[#9B3B3B]">
                          {ETIQUETA_AVISO[a]}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span className="block">{situacion(d)}</span>
                  {editable && d.para.length > 0 ? (
                    <button
                      type="button"
                      disabled={enCurso !== null}
                      onClick={() => alternar(d)}
                      className="mt-1 min-h-8 rounded-md border border-subtle px-2 py-1 text-xs text-text-body hover:border-icam-900 disabled:opacity-60"
                    >
                      {enCurso === d.id ? "Guardando…" : d.excluido ? "Volver a incluir" : "Excluir"}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {visibles.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-text-muted">
                  Ningún destinatario con ese filtro.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
