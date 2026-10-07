"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Aviso } from "@/components/ui/Aviso";
import { Ayuda } from "@/components/ui/Ayuda";
import { Boton } from "@/components/ui/Boton";
import { Chip } from "@/components/ui/Chip";
import { Icono } from "@/components/ui/Icono";
import { Tarjeta } from "@/components/ui/Tarjeta";
import { TABLA } from "@/components/ui/tabla";
import { fmtInt } from "@/lib/formatters";
import { cambiarExclusionAction } from "@/modules/comunicaciones/actions/comunicaciones";
import { esDireccionInterna } from "@/modules/comunicaciones/logic/destinatarios";
import { ETIQUETA_AVISO, type ComDestinatarioRow, type Direccion } from "@/modules/comunicaciones/types";
import { BarraDeFiltros } from "@/modules/comunicaciones/ui/components/ui/BarraDeFiltros";
import { ChipAviso, ChipEstadoEnvio } from "@/modules/comunicaciones/ui/components/ui/ChipEstado";

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
  // Una vez empezado el envío, lo que cuenta es qué pasó con cada uno y a qué
  // dirección salió de verdad, que en modo pruebas no es la de la lista.
  switch (d.estado_envio) {
    case "enviado": {
      const a = d.enviado_para?.para.join(", ");
      return `${d.pasarela === "simulada" ? "Enviado (simulado)" : "Enviado"}${a ? ` a ${a}` : ""}`;
    }
    case "error":
      return `Error: ${d.error ?? "sin detalle"}`;
    case "omitido":
      return `Omitido: ${d.error ?? "sin detalle"}`;
    case "enviando":
      return "Enviando…";
    default:
      return "Recibiría el correo";
  }
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
    <ul className="space-y-1">
      {lista.map((d) => (
        <li key={d.email} className="leading-snug">
          <span className="text-text-primary">{d.nombre}</span>
          <span className="block font-mono text-xs text-text-muted">
            {d.email}
            {esDireccionInterna(d.email, dominiosInternos) ? (
              <Chip tono="neutro" className="ml-1.5 align-middle">
                interna
              </Chip>
            ) : null}
          </span>
          <span className="block text-[11px] text-text-muted">{d.rol}</span>
        </li>
      ))}
    </ul>
  );
}

/** El chip de situación de una fila, y el texto que lo acompaña. */
function Situacion({ d }: { d: ComDestinatarioRow }) {
  const texto = situacion(d);
  if (d.excluido) {
    return (
      <>
        <Chip tono="neutro">Excluido</Chip>
        <span className={TABLA.sub}>{d.excluido_motivo ?? "a mano"}</span>
      </>
    );
  }
  if (d.para.length === 0) return <Chip tono="aviso">Sin destinatario</Chip>;
  if (d.estado_envio === "pendiente") return <Chip tono="marca">Recibiría el correo</Chip>;
  return (
    <>
      <ChipEstadoEnvio estado={d.estado_envio} texto={d.estado_envio === "enviado" && d.pasarela === "simulada" ? "Enviado (simulado)" : undefined} />
      <span className={TABLA.sub}>{texto.replace(/^(Enviado( \(simulado\))?|Error|Omitido): ?/, "").replace(/^a /, "a ")}</span>
    </>
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
    <Tarjeta
      id="com-destinatarios"
      titulo="Destinatarios"
      subtitulo="Una fila por cuenta de inversión. Excluir a alguien no toca el CRM: solo cambia esta comunicación."
      acciones={
        <Boton variante="secundario" pequeno icono={<Icono nombre="descargar" />} onClick={descargar}>
          Descargar CSV
        </Boton>
      }
      sinRelleno
    >
      <div className="space-y-3 px-4 pb-3 sm:px-5">
        <BarraDeFiltros
          opciones={FILTROS.map((f) => ({ ...f, n: destinatarios.filter((d) => pasa(d, f.clave)).length }))}
          valor={filtro}
          onChange={setFiltro}
          busqueda={busqueda}
          onBusqueda={setBusqueda}
          placeholder="Buscar cuenta, nombre o correo"
        />
        {error ? <Aviso tipo="error">{error}</Aviso> : null}
      </div>

      <div className={`${TABLA.marcoFijo} border-t border-subtle/60`}>
        <table className={`${TABLA.tabla} min-w-[900px]`}>
          <caption className="sr-only">
            Destinatarios de la comunicación, una fila por cuenta de inversión, con quién va en Para, quién en copia y
            los avisos de cada una.
          </caption>
          <thead className={TABLA.theadFija}>
            <tr>
              <th scope="col" className={TABLA.th}>Cuenta de inversión</th>
              <th scope="col" className={TABLA.th}>Para</th>
              <th scope="col" className={TABLA.th}>Copia</th>
              <th scope="col" className={TABLA.th}>
                <span className="inline-flex items-center gap-1">
                  Avisos
                  <Ayuda etiqueta="Qué significa cada aviso">
                    <strong>Cuenta de prueba</strong>: del CRM; nace excluida. <strong>Dirección interna</strong>: de
                    Impar Capital; si lo son todas, la cuenta nace excluida. <strong>Persona en varias cuentas</strong>:
                    recibirá un solo correo. <strong>Sin destinatario</strong>: falta el contacto con el papel elegido.{" "}
                    <strong>Dado de baja</strong> y <strong>sin correo</strong>: no se le escribe.{" "}
                    <strong>Dirección mal escrita</strong> y <strong>dominio que no recibe correo</strong>: no entra en
                    «Para». <strong>Posible errata</strong>: míralo. <strong>Dirección nueva</strong>: no estaba en el
                    envío original de este seguimiento; la cuenta nace excluida.
                  </Ayuda>
                </span>
              </th>
              <th scope="col" className={TABLA.th}>Situación</th>
              {editable ? <th scope="col" className={TABLA.th}><span className="sr-only">Acciones</span></th> : null}
            </tr>
          </thead>
          <tbody>
            {visibles.map((d) => (
              <tr key={d.id} className={d.excluido || d.para.length === 0 ? TABLA.trApagada : TABLA.tr}>
                <th scope="row" className={`${TABLA.td} text-left font-medium text-text-primary`}>
                  {d.cuenta_nombre}
                </th>
                <td className={TABLA.td}>
                  <Direcciones lista={d.para} dominiosInternos={dominiosInternos} />
                </td>
                <td className={TABLA.td}>
                  <Direcciones lista={d.copia} dominiosInternos={dominiosInternos} />
                </td>
                <td className={TABLA.td}>
                  {d.avisos.length === 0 ? (
                    <span className="text-text-muted">—</span>
                  ) : (
                    <span className="flex flex-wrap gap-1">
                      {d.avisos.map((a) => (
                        <ChipAviso key={a} aviso={a} />
                      ))}
                    </span>
                  )}
                </td>
                <td className={`${TABLA.td} max-w-[280px]`}>
                  <Situacion d={d} />
                </td>
                {editable ? (
                  <td className={`${TABLA.td} whitespace-nowrap text-right`}>
                    {d.para.length > 0 ? (
                      <Boton variante="texto" pequeno disabled={enCurso !== null} cargando={enCurso === d.id} onClick={() => alternar(d)}>
                        {d.excluido ? "Volver a incluir" : "Excluir"}
                      </Boton>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            ))}
            {visibles.length === 0 ? (
              <tr>
                <td colSpan={editable ? 6 : 5} className={TABLA.vacio}>
                  Ningún destinatario con ese filtro.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-2 text-xs text-text-muted sm:px-5">
        {fmtInt(visibles.length)} de {fmtInt(destinatarios.length)} cuentas · la lista es una foto del momento en que
        se preparó.
      </p>
    </Tarjeta>
  );
}
