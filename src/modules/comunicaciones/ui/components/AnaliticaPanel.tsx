"use client";

import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { BloqueGrafica, SinDatos } from "@/components/charts/BloqueGrafica";
import { EJE, GRID, SERIE } from "@/components/charts/tokens";
import { Aviso } from "@/components/ui/Aviso";
import { Boton } from "@/components/ui/Boton";
import { Chip, type TonoChip } from "@/components/ui/Chip";
import { claseCampo } from "@/components/ui/Campo";
import { Icono } from "@/components/ui/Icono";
import { Tarjeta } from "@/components/ui/Tarjeta";
import { TABLA } from "@/components/ui/tabla";
import { fmtFechaHora, fmtInt } from "@/lib/formatters";
import { consultarEntregaAction } from "@/modules/comunicaciones/actions/analitica";
import {
  abrio,
  cumpleFiltro,
  enlacesPulsados,
  ETIQUETA_FILTRO,
  hizoClic,
  necesitaSeguimiento,
  type ClicsDeEnlace,
  type FiltroAnalitica,
  type PuntoDeSerie,
} from "@/modules/comunicaciones/logic/analitica";
import { esFiltroDeReenvio } from "@/modules/comunicaciones/logic/reenvio";
import type { ComDestinatarioRow, ComEnlaceRow, ComEventoRow } from "@/modules/comunicaciones/types";
import { SeguimientoBoton } from "@/modules/comunicaciones/ui/components/SeguimientoModal";
import { BarraDeFiltros } from "@/modules/comunicaciones/ui/components/ui/BarraDeFiltros";
import { ChipEstadoEnvio } from "@/modules/comunicaciones/ui/components/ui/ChipEstado";

interface Props {
  comunicacionId: string;
  nombre: string;
  destinatarios: ComDestinatarioRow[];
  eventos: ComEventoRow[];
  enlaces: ClicsDeEnlace[];
  enlacesDePlantilla: ComEnlaceRow[];
  serie: PuntoDeSerie[];
  /** Si las aperturas de esta comunicación sirven para medir algo. */
  medible: boolean;
  porQueNoEsMedible: string | null;
  plantilla: { id: string; nombre: string | null } | null;
  puedeEscribir: boolean;
  salioPorZoho: boolean;
}

/** Los filtros de la tabla, en el orden en que se leen. */
const FILTROS_TABLA: FiltroAnalitica[] = [
  "todos",
  "no_consta_apertura",
  "abrio",
  "hizo_clic",
  "abrio_sin_clic",
  "pulso_enlace",
  "error",
  "rebotado",
];

function celda(valor: string): string {
  return /[";\n]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}

function situacion(d: ComDestinatarioRow): { texto: string; tono: TonoChip } {
  if (d.excluido) return { texto: "Excluido", tono: "neutro" };
  if (d.estado_envio !== "enviado") return { texto: "", tono: "neutro" };
  if (hizoClic(d)) return { texto: "Hizo clic", tono: "ok" };
  if (abrio(d)) return { texto: "Abrió", tono: "marca" };
  return { texto: "No consta apertura", tono: "neutro" };
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

function TooltipSerie({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: number }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border border-subtle bg-card px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-text-primary">Hora {label} tras el envío</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-1.5 text-text-body">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: p.color }} />
          {p.name}: <strong className="tabular-nums">{fmtInt(p.value)}</strong>
        </p>
      ))}
    </div>
  );
}

/**
 * La analítica de un correo: la evolución, los enlaces y, destinatario a
 * destinatario, quién abrió y quién pulsó qué. Sobre el filtro que esté puesto
 * se puede preparar un seguimiento.
 *
 * Aquí no se envía nada. «Preparar seguimiento» crea un borrador nuevo.
 */
export function AnaliticaPanel({
  comunicacionId,
  nombre,
  destinatarios,
  eventos,
  enlaces,
  enlacesDePlantilla,
  serie,
  medible,
  porQueNoEsMedible,
  plantilla,
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

  const cumplen = (f: FiltroAnalitica) => destinatarios.filter((d) => cumpleFiltro(d, f, enlace, pulsados));
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
      situacion(d).texto || d.estado_envio,
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
      setAviso(`Consultados ${fmtInt(r.consultados)} correos en Zoho: ${fmtInt(r.rebotados)} rebotados y ${fmtInt(r.sinDato)} sin dato.`);
      router.refresh();
    } else {
      setError(r.mensaje);
    }
    setOcupado(false);
  };

  const hayActividad = serie.some((p) => p.aperturas > 0 || p.clics > 0);
  // Hasta la última hora con algo, para no pintar tres días de barras vacías.
  const ultimaHora = serie.reduce((max, p) => (p.aperturas > 0 || p.clics > 0 ? p.hora : max), 0);
  const serieVisible = serie.slice(0, Math.max(12, ultimaHora + 2));
  const filtroParaSeguimiento = esFiltroDeReenvio(filtro) && (medible || !necesitaSeguimiento(filtro)) ? filtro : undefined;

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-[3fr_2fr]">
        <BloqueGrafica
          titulo="Aperturas y clics desde el envío"
          subtitulo="Por horas, las primeras 72. No cuenta lo que abren los filtros de correo ni la prueba."
        >
          {hayActividad ? (
            <div className="h-[240px] w-full min-w-0 sm:h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={serieVisible} margin={{ top: 8, right: 8, left: -18, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                  <XAxis dataKey="hora" stroke={EJE} tick={{ fontSize: 10 }} tickFormatter={(h) => `${h} h`} />
                  <YAxis stroke={EJE} tick={{ fontSize: 10 }} width={36} allowDecimals={false} />
                  <Tooltip content={<TooltipSerie />} cursor={{ fill: GRID, opacity: 0.5 }} />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Bar dataKey="aperturas" name="Aperturas" fill={SERIE.uno} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="clics" name="Clics" fill={SERIE.dos} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <SinDatos mensaje="Todavía no consta ninguna apertura ni ningún clic." alto={240} />
          )}
        </BloqueGrafica>

        <Tarjeta titulo="Enlaces" subtitulo="Cuántas personas han pulsado cada uno, y cuántas veces." sinRelleno>
          {enlaces.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-text-muted sm:px-5">Este correo no lleva ningún enlace.</p>
          ) : (
            <div className={TABLA.marco}>
              <table className={TABLA.tabla}>
                <caption className="sr-only">Enlaces del correo y cuántas veces se ha pulsado cada uno.</caption>
                <thead className={TABLA.thead}>
                  <tr>
                    <th scope="col" className={TABLA.th}>Enlace</th>
                    <th scope="col" className={TABLA.thNum}>Personas</th>
                    <th scope="col" className={TABLA.thNum}>Clics</th>
                  </tr>
                </thead>
                <tbody>
                  {enlaces.map((en) => (
                    <tr key={en.posicion} className={TABLA.tr}>
                      <th scope="row" className={`${TABLA.td} max-w-[320px] text-left font-normal`}>
                        <span className="block truncate font-medium text-text-primary">{en.texto || "(sin texto)"}</span>
                        <span className="block truncate text-xs text-text-muted" title={en.url}>
                          {en.url}
                        </span>
                      </th>
                      <td className={TABLA.tdNum}>{fmtInt(en.personas)}</td>
                      <td className={TABLA.tdNum}>{fmtInt(en.clics)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Tarjeta>
      </div>

      <Tarjeta
        id="ana-destinatarios"
        titulo="Destinatarios"
        subtitulo="Quién abrió y quién pulsó qué. Con un filtro puesto se puede preparar un seguimiento a esas cuentas."
        acciones={
          <>
            {salioPorZoho && puedeEscribir ? (
              <Boton variante="secundario" pequeno cargando={ocupado} onClick={consultarEntrega} icono={<Icono nombre="actualizar" />}>
                Consultar entrega en Zoho
              </Boton>
            ) : null}
            <Boton variante="secundario" pequeno icono={<Icono nombre="descargar" />} onClick={descargar}>
              Descargar CSV
            </Boton>
          </>
        }
        sinRelleno
      >
        <div className="space-y-3 px-4 pb-3 sm:px-5">
          <BarraDeFiltros
            opciones={FILTROS_TABLA.map((f) => ({
              clave: f,
              etiqueta: ETIQUETA_FILTRO[f],
              n: f === "pulso_enlace" ? undefined : cumplen(f).length,
            }))}
            valor={filtro}
            onChange={setFiltro}
            busqueda={busqueda}
            onBusqueda={setBusqueda}
            placeholder="Buscar cuenta o correo"
            extra={
              puedeEscribir ? (
                <SeguimientoBoton
                  comunicacionId={comunicacionId}
                  destinatarios={destinatarios}
                  enlaces={enlacesDePlantilla}
                  eventos={eventos}
                  medible={medible}
                  porQueNoEsMedible={porQueNoEsMedible}
                  plantilla={plantilla}
                  filtroInicial={filtroParaSeguimiento}
                  enlaceInicial={enlace}
                  etiqueta={
                    filtroParaSeguimiento && filtro !== "todos"
                      ? `Seguimiento a ${filtrados.length === 1 ? "esta cuenta" : `estas ${fmtInt(filtrados.length)}`}`
                      : "Seguimiento"
                  }
                  variante="primario"
                  pequeno
                />
              ) : null
            }
          />
          {filtro === "pulso_enlace" ? (
            <label className="block max-w-md text-sm">
              <span className="sr-only">Enlace</span>
              <select
                value={enlace ?? ""}
                onChange={(e) => setEnlace(e.target.value === "" ? null : Number(e.target.value))}
                className={claseCampo}
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
          {aviso ? <Aviso tipo="ok">{aviso}</Aviso> : null}
          {error ? <Aviso tipo="error">{error}</Aviso> : null}
        </div>

        <div className={`${TABLA.marcoFijo} border-t border-subtle/60`}>
          <table className={`${TABLA.tabla} min-w-[980px]`}>
            <caption className="sr-only">
              Destinatarios del correo, con sus aperturas y sus clics. Cada fila se puede abrir para ver el detalle.
            </caption>
            <thead className={TABLA.theadFija}>
              <tr>
                <th scope="col" className={TABLA.th}>Cuenta de inversión</th>
                <th scope="col" className={TABLA.th}>Enviado a</th>
                <th scope="col" className={TABLA.th}>Situación</th>
                <th scope="col" className={TABLA.thNum}>Aperturas</th>
                <th scope="col" className={TABLA.th}>Última apertura</th>
                <th scope="col" className={TABLA.thNum}>Clics</th>
                <th scope="col" className={TABLA.th}>Entrega</th>
                <th scope="col" className={TABLA.th}>
                  <span className="sr-only">Detalle</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((d) => {
                const suyos = (eventosPorDestinatario.get(d.id) ?? []).filter((e) => !e.es_prueba);
                const sit = situacion(d);
                return (
                  <Fragment key={d.id}>
                    <tr className={d.excluido || d.estado_envio !== "enviado" ? TABLA.trApagada : TABLA.tr}>
                      <th scope="row" className={`${TABLA.td} text-left font-medium text-text-primary`}>
                        {d.cuenta_nombre}
                      </th>
                      <td className={`${TABLA.td} break-all font-mono text-xs`}>{d.estado_envio === "enviado" ? aQuien(d) : "—"}</td>
                      <td className={TABLA.td}>
                        {sit.texto ? <Chip tono={sit.tono}>{sit.texto}</Chip> : <ChipEstadoEnvio estado={d.estado_envio} />}
                        {d.estado_envio === "error" && d.error ? <span className="block text-xs text-red-700">{d.error}</span> : null}
                      </td>
                      <td className={TABLA.tdNum}>{fmtInt(d.aperturas ?? 0)}</td>
                      <td className={`${TABLA.td} whitespace-nowrap`}>{d.ultima_apertura_at ? fmtFechaHora(d.ultima_apertura_at) : "—"}</td>
                      <td className={TABLA.tdNum}>{fmtInt(d.clics ?? 0)}</td>
                      <td className={TABLA.td}>
                        {d.estado_envio !== "enviado" ? (
                          "—"
                        ) : d.entrega_estado === "rebotado" ? (
                          <Chip tono="error" title={d.rebote_motivo ?? undefined}>
                            Rebotado
                          </Chip>
                        ) : d.entrega_estado === "entregado" ? (
                          <Chip tono="ok">Entregado</Chip>
                        ) : (
                          <span className="text-text-muted">{entrega(d)}</span>
                        )}
                      </td>
                      <td className={`${TABLA.td} text-right`}>
                        {suyos.length > 0 ? (
                          <Boton variante="texto" pequeno aria-expanded={abierta === d.id} onClick={() => setAbierta(abierta === d.id ? null : d.id)}>
                            {abierta === d.id ? "Ocultar" : `Ver ${fmtInt(suyos.length)}`}
                          </Boton>
                        ) : null}
                      </td>
                    </tr>
                    {abierta === d.id ? (
                      <tr className="border-t border-subtle/60 bg-page/60">
                        <td colSpan={8} className="px-4 py-2">
                          <ul className="space-y-0.5 text-xs text-text-body">
                            {suyos.map((e) => (
                              <li key={e.id} className="flex flex-wrap items-center gap-1.5">
                                <span className="tabular-nums text-text-muted">{fmtFechaHora(e.ocurrido_at)}</span>
                                <span>·</span>
                                <span>{e.tipo === "apertura" ? "Abrió el correo" : `Pulsó «${etiquetaEnlace(e.enlace)}»`}</span>
                                {e.automatico ? (
                                  <Chip tono="neutro" title="Lo hizo un filtro de correo al recibirlo: no cuenta">
                                    automático
                                  </Chip>
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
                  <td colSpan={8} className={TABLA.vacio}>
                    Ningún destinatario con ese filtro.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Tarjeta>
    </div>
  );
}
