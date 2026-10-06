"use client";

import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { fmtFechaHora, fmtInt } from "@/lib/formatters";
import { consultarEntregaAction, prepararReenvioAction } from "@/modules/comunicaciones/actions/analitica";
import {
  abrio,
  cumpleFiltro,
  enlacesPulsados,
  ETIQUETA_FILTRO,
  FILTROS_ANALITICA,
  hizoClic,
  type ClicsDeEnlace,
  type FiltroAnalitica,
  type PuntoDeSerie,
} from "@/modules/comunicaciones/logic/analitica";
import { esFiltroDeReenvio } from "@/modules/comunicaciones/logic/reenvio";
import {
  ETIQUETA_ESTADO_ENVIO,
  type ComDestinatarioRow,
  type ComEventoRow,
} from "@/modules/comunicaciones/types";

interface Props {
  comunicacionId: string;
  nombre: string;
  destinatarios: ComDestinatarioRow[];
  eventos: ComEventoRow[];
  enlaces: ClicsDeEnlace[];
  serie: PuntoDeSerie[];
  /** Si las aperturas de esta comunicación sirven para medir algo. */
  medible: boolean;
  puedeEscribir: boolean;
  salioPorZoho: boolean;
}

const BOTON =
  "min-h-9 rounded-md border border-subtle px-3 py-1.5 text-sm text-text-body hover:border-icam-900 disabled:opacity-60";
const BOTON_PRINCIPAL =
  "min-h-9 rounded-md bg-icam-900 px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60";

function celda(valor: string): string {
  return /[";\n]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}

function situacion(d: ComDestinatarioRow): string {
  if (d.excluido) return "Excluido";
  if (d.estado_envio !== "enviado") return ETIQUETA_ESTADO_ENVIO[d.estado_envio];
  if (hizoClic(d)) return "Hizo clic";
  if (abrio(d)) return "Abrió";
  return "No consta apertura";
}

function entrega(d: ComDestinatarioRow): string {
  if (d.entrega_estado === "rebotado") return `Rebotado${d.rebote_motivo ? `: ${d.rebote_motivo}` : ""}`;
  if (d.entrega_estado === "entregado") return "Entregado";
  if (d.entrega_estado === "sin_dato") return "Zoho no da el dato";
  return "Sin consultar";
}

function aQuien(d: ComDestinatarioRow): string {
  return (d.enviado_para?.para ?? d.para.map((p) => p.email)).join(", ");
}

/**
 * La analítica de un correo: la evolución, los enlaces y, destinatario a
 * destinatario, quién abrió y quién pulsó qué. Sobre el filtro que esté puesto
 * se puede preparar un reenvío.
 *
 * Aquí no se envía nada. «Preparar reenvío» crea un borrador nuevo.
 */
export function AnaliticaPanel({
  comunicacionId,
  nombre,
  destinatarios,
  eventos,
  enlaces,
  serie,
  medible,
  puedeEscribir,
  salioPorZoho,
}: Props) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<FiltroAnalitica>("todos");
  const [enlace, setEnlace] = useState<number | null>(enlaces[0]?.posicion ?? null);
  const [busqueda, setBusqueda] = useState("");
  const [abierta, setAbierta] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pulsados = useMemo(() => enlacesPulsados(eventos), [eventos]);
  const eventosPorDestinatario = useMemo(() => {
    const mapa = new Map<string, ComEventoRow[]>();
    for (const e of eventos) {
      if (!e.destinatario_id) continue;
      const grupo = mapa.get(e.destinatario_id) ?? [];
      grupo.push(e);
      mapa.set(e.destinatario_id, grupo);
    }
    return mapa;
  }, [eventos]);

  const cumplen = (f: FiltroAnalitica) =>
    destinatarios.filter((d) => cumpleFiltro(d, f, enlace, pulsados));
  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return destinatarios.filter((d) => {
      if (!cumpleFiltro(d, filtro, enlace, pulsados)) return false;
      if (!q) return true;
      return d.cuenta_nombre.toLowerCase().includes(q) || aQuien(d).toLowerCase().includes(q);
    });
  }, [destinatarios, filtro, enlace, pulsados, busqueda]);

  const etiquetaEnlace = (posicion: number | null) => {
    const en = enlaces.find((x) => x.posicion === posicion);
    return en ? en.texto || en.url : "(enlace)";
  };

  const descargar = () => {
    const cabecera = ["Cuenta de inversión", "Enviado a", "Situación", "Aperturas", "Primera apertura", "Última apertura", "Clics", "Último clic", "Enlaces pulsados", "Entrega"];
    const filas = filtrados.map((d) => [
      d.cuenta_nombre,
      aQuien(d),
      situacion(d),
      String(d.aperturas ?? 0),
      d.primera_apertura_at ? fmtFechaHora(d.primera_apertura_at) : "",
      d.ultima_apertura_at ? fmtFechaHora(d.ultima_apertura_at) : "",
      String(d.clics ?? 0),
      d.ultimo_clic_at ? fmtFechaHora(d.ultimo_clic_at) : "",
      [...(pulsados.get(d.id) ?? [])].map(etiquetaEnlace).join(" | "),
      entrega(d),
    ]);
    // Punto y coma y BOM: es lo que abre bien Excel en español.
    const csv = "﻿" + [cabecera, ...filas].map((f) => f.map(celda).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `analitica - ${nombre.replace(/[\\/:*?"<>|]/g, "-")} - ${ETIQUETA_FILTRO[filtro]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const consultarEntrega = async () => {
    setOcupado(true);
    setError(null);
    setAviso(null);
    const r = await consultarEntregaAction(comunicacionId);
    if (r.ok) {
      setAviso(
        `Consultados ${fmtInt(r.consultados)} correos en Zoho: ${fmtInt(r.rebotados)} rebotados y ${fmtInt(r.sinDato)} sin dato.`,
      );
      router.refresh();
    } else {
      setError(r.mensaje);
    }
    setOcupado(false);
  };

  const prepararReenvio = async () => {
    setOcupado(true);
    setError(null);
    setAviso(null);
    const r = await prepararReenvioAction(comunicacionId, filtro, filtro === "pulso_enlace" ? enlace : null);
    setOcupado(false);
    if (!r.ok) {
      setError(r.mensaje);
      return;
    }
    router.push(r.path);
  };

  const hayActividad = serie.some((p) => p.aperturas > 0 || p.clics > 0);
  // Hasta la última hora con algo, para no pintar tres días de barras vacías.
  const ultimaHora = serie.reduce((max, p) => (p.aperturas > 0 || p.clics > 0 ? p.hora : max), 0);
  const serieVisible = serie.slice(0, Math.max(12, ultimaHora + 2));
  const puedeReenviar = puedeEscribir && medible && esFiltroDeReenvio(filtro) && filtrados.length > 0;

  return (
    <div className="space-y-3 sm:space-y-4">
      <section className="min-w-0 rounded-lg border border-subtle/50 bg-card p-3 sm:p-4" aria-labelledby="ana-evolucion">
        <h2 id="ana-evolucion" className="text-base font-semibold text-text-primary">
          Aperturas y clics desde el envío
        </h2>
        <p className="mb-2 text-xs text-text-muted">
          Por horas, las primeras 72. No cuenta lo que abren los filtros de correo ni la prueba.
        </p>
        {hayActividad ? (
          <div className="h-[240px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serieVisible} margin={{ top: 8, right: 8, left: -18, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EAEBEE" />
                <XAxis dataKey="hora" stroke="#8A8A8A" tick={{ fontSize: 10 }} tickFormatter={(h) => `${h} h`} />
                <YAxis stroke="#8A8A8A" tick={{ fontSize: 10 }} width={36} allowDecimals={false} />
                <Tooltip labelFormatter={(h) => `Hora ${h} tras el envío`} />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Bar dataKey="aperturas" name="Aperturas" fill="#1E2A56" />
                <Bar dataKey="clics" name="Clics" fill="#B89660" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-subtle p-4 text-center text-sm text-text-muted">
            Todavía no consta ninguna apertura ni ningún clic.
          </p>
        )}
      </section>

      <section className="space-y-2" aria-labelledby="ana-enlaces">
        <h2 id="ana-enlaces" className="text-base font-semibold text-text-primary">
          Enlaces
        </h2>
        {enlaces.length === 0 ? (
          <p className="rounded-lg border border-subtle/50 bg-card p-3 text-sm text-text-muted">
            Este correo no lleva ningún enlace.
          </p>
        ) : (
          <div className="overflow-auto rounded-lg border border-subtle/50 bg-card">
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">Enlaces del correo y cuántas veces se ha pulsado cada uno.</caption>
              <thead>
                <tr className="border-b border-subtle text-left text-text-muted">
                  <th scope="col" className="px-3 py-2 font-medium">Enlace</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Personas</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Clics</th>
                </tr>
              </thead>
              <tbody>
                {enlaces.map((en) => (
                  <tr key={en.posicion} className="border-b border-subtle/60 text-text-body last:border-b-0">
                    <th scope="row" className="px-3 py-2 text-left font-normal">
                      <span className="block font-medium text-text-primary">{en.texto || "(sin texto)"}</span>
                      <span className="block break-all text-xs text-text-muted">{en.url}</span>
                    </th>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtInt(en.personas)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtInt(en.clics)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-2" aria-labelledby="ana-destinatarios">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="ana-destinatarios" className="text-base font-semibold text-text-primary">
            Destinatarios
          </h2>
          <div className="flex flex-wrap gap-2">
            {salioPorZoho && puedeEscribir ? (
              <button type="button" disabled={ocupado} onClick={consultarEntrega} className={BOTON}>
                Consultar entrega en Zoho
              </button>
            ) : null}
            <button type="button" onClick={descargar} className={BOTON}>
              Descargar CSV
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {FILTROS_ANALITICA.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filtro === f}
              onClick={() => setFiltro(f)}
              className={`min-h-9 rounded-md border px-3 py-1.5 text-sm ${
                filtro === f
                  ? "border-icam-900 bg-icam-900 text-white"
                  : "border-subtle text-text-body hover:border-icam-900"
              }`}
            >
              {ETIQUETA_FILTRO[f]}
              {f === "pulso_enlace" ? "" : ` (${fmtInt(cumplen(f).length)})`}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {filtro === "pulso_enlace" ? (
            <label className="text-sm text-text-body">
              <span className="sr-only">Enlace</span>
              <select
                value={enlace ?? ""}
                onChange={(e) => setEnlace(e.target.value === "" ? null : Number(e.target.value))}
                className="min-h-9 max-w-[420px] rounded-md border border-subtle bg-card px-3 py-1.5 text-sm text-text-body"
              >
                {enlaces.length === 0 ? <option value="">(no hay enlaces)</option> : null}
                {enlaces.map((en) => (
                  <option key={en.posicion} value={en.posicion}>
                    {(en.texto || en.url).slice(0, 70)} ({fmtInt(en.personas)})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar cuenta o correo"
            aria-label="Buscar en los destinatarios"
            className="min-h-9 min-w-[220px] flex-1 rounded-md border border-subtle bg-card px-3 py-1.5 text-sm text-text-body"
          />
        </div>

        {esFiltroDeReenvio(filtro) ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-subtle bg-card p-3 text-sm text-text-body">
            <span className="min-w-0 flex-1">
              <strong>Reenviar a este filtro.</strong> Se prepara una comunicación nueva, en borrador, con{" "}
              {filtrados.length === 1 ? "la cuenta" : `las ${fmtInt(filtrados.length)} cuentas`} que{" "}
              {filtrados.length === 1 ? "cumple" : "cumplen"} «{ETIQUETA_FILTRO[filtro]}». No se envía nada: pasa por la
              revisión, la prueba, el ensayo y la confirmación, como cualquier otra.
              {filtro === "no_consta_apertura"
                ? " Recuerda que «no consta apertura» no significa que no lo hayan leído."
                : ""}
              {!medible ? " Solo se puede sobre una comunicación enviada de verdad y en modo real." : ""}
            </span>
            {puedeEscribir ? (
              <button type="button" disabled={ocupado || !puedeReenviar} onClick={prepararReenvio} className={BOTON_PRINCIPAL}>
                {ocupado ? "Preparando…" : `Preparar reenvío a ${filtrados.length === 1 ? "esta cuenta" : `estas ${fmtInt(filtrados.length)}`}`}
              </button>
            ) : null}
          </div>
        ) : null}

        {aviso ? (
          <p role="status" className="text-sm text-text-body">
            {aviso}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-[#9B3B3B]">
            {error}
          </p>
        ) : null}

        <div className="max-h-[640px] overflow-auto overscroll-x-contain rounded-lg border border-subtle/50 bg-card">
          <table className="w-full min-w-[980px] text-sm">
            <caption className="sr-only">
              Destinatarios del correo, con sus aperturas y sus clics. Cada fila se puede abrir para ver el detalle.
            </caption>
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-subtle text-left text-text-muted">
                <th scope="col" className="px-3 py-2 font-medium">Cuenta de inversión</th>
                <th scope="col" className="px-3 py-2 font-medium">Enviado a</th>
                <th scope="col" className="px-3 py-2 font-medium">Situación</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Aperturas</th>
                <th scope="col" className="px-3 py-2 font-medium">Última apertura</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Clics</th>
                <th scope="col" className="px-3 py-2 font-medium">Entrega</th>
                <th scope="col" className="px-3 py-2 font-medium">
                  <span className="sr-only">Detalle</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((d) => {
                const suyos = (eventosPorDestinatario.get(d.id) ?? []).filter((e) => !e.es_prueba);
                return (
                  <Fragment key={d.id}>
                    <tr className="border-b border-subtle/60 align-top text-text-body">
                      <th scope="row" className="px-3 py-2 text-left font-medium text-text-primary">
                        {d.cuenta_nombre}
                      </th>
                      <td className="px-3 py-2 break-all">{d.estado_envio === "enviado" ? aQuien(d) : "—"}</td>
                      <td className="px-3 py-2">
                        {situacion(d)}
                        {d.estado_envio === "error" && d.error ? (
                          <span className="block text-xs text-[#9B3B3B]">{d.error}</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtInt(d.aperturas ?? 0)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {d.ultima_apertura_at ? fmtFechaHora(d.ultima_apertura_at) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtInt(d.clics ?? 0)}</td>
                      <td className={`px-3 py-2 ${d.entrega_estado === "rebotado" ? "text-[#9B3B3B]" : ""}`}>
                        {d.estado_envio === "enviado" ? entrega(d) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {suyos.length > 0 ? (
                          <button
                            type="button"
                            aria-expanded={abierta === d.id}
                            onClick={() => setAbierta(abierta === d.id ? null : d.id)}
                            className="min-h-8 rounded-md border border-subtle px-2 py-1 text-xs text-text-body hover:border-icam-900"
                          >
                            {abierta === d.id ? "Ocultar" : `Ver ${fmtInt(suyos.length)}`}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                    {abierta === d.id ? (
                      <tr className="border-b border-subtle/60 bg-black/[0.02]">
                        <td colSpan={8} className="px-3 py-2">
                          <ul className="space-y-0.5 text-xs text-text-body">
                            {suyos.map((e) => (
                              <li key={e.id}>
                                <span className="tabular-nums">{fmtFechaHora(e.ocurrido_at)}</span> ·{" "}
                                {e.tipo === "apertura" ? "Abrió el correo" : `Pulsó «${etiquetaEnlace(e.enlace)}»`}
                                {e.automatico ? (
                                  <span className="text-text-muted"> · automático (un filtro de correo): no cuenta</span>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-text-muted">
                    Ningún destinatario con ese filtro.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
