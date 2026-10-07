"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Aviso } from "@/components/ui/Aviso";
import { Boton } from "@/components/ui/Boton";
import { Campo, claseCampo } from "@/components/ui/Campo";
import { Chip } from "@/components/ui/Chip";
import { Icono } from "@/components/ui/Icono";
import { Modal } from "@/components/ui/Modal";
import { fmtInt } from "@/lib/formatters";
import { prepararReenvioAction } from "@/modules/comunicaciones/actions/analitica";
import { listarPlantillasAction, type OpcionPlantilla } from "@/modules/comunicaciones/actions/comunicaciones";
import {
  cumpleFiltro,
  enlacesPulsados,
  ETIQUETA_FILTRO,
  necesitaSeguimiento,
  type FiltroAnalitica,
} from "@/modules/comunicaciones/logic/analitica";
import { FILTROS_DE_REENVIO } from "@/modules/comunicaciones/logic/reenvio";
import type { ComDestinatarioRow, ComEnlaceRow, ComEventoRow } from "@/modules/comunicaciones/types";
import { ListaDeDirecciones } from "@/modules/comunicaciones/ui/components/ui/ListaDeDirecciones";

export interface PropsSeguimiento {
  comunicacionId: string;
  destinatarios: ComDestinatarioRow[];
  /** Los enlaces de la plantilla y los eventos, para «pulsó un enlace concreto». Opcionales. */
  enlaces?: ComEnlaceRow[];
  eventos?: ComEventoRow[];
  /** ¿Sirven las aperturas y los clics? Si no, solo se ofrecen los filtros que no los necesitan. */
  medible: boolean;
  porQueNoEsMedible: string | null;
  plantilla: { id: string; nombre: string | null } | null;
  filtroInicial?: FiltroAnalitica;
  enlaceInicial?: number | null;
}

/** Los filtros del diálogo, en el orden en que se leen. */
const FILTROS: FiltroAnalitica[] = ["enviados", "no_consta_apertura", "no_hizo_clic", "abrio_sin_clic", "pulso_enlace", "error"];

/**
 * Preparar un seguimiento: elegir a quién (todos los que lo recibieron o un
 * filtro), ver las direcciones exactas y, si se quiere, otra plantilla. No
 * envía nada: crea un borrador que pasa por todos los controles.
 */
export function SeguimientoModal({
  open,
  onClose,
  comunicacionId,
  destinatarios,
  enlaces = [],
  eventos = [],
  medible,
  porQueNoEsMedible,
  plantilla,
  filtroInicial,
  enlaceInicial = null,
}: PropsSeguimiento & { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const inicial = filtroInicial && FILTROS.includes(filtroInicial) && (medible || !necesitaSeguimiento(filtroInicial)) ? filtroInicial : "enviados";
  const [filtro, setFiltro] = useState<FiltroAnalitica>(inicial);
  const [enlace, setEnlace] = useState<number | null>(enlaceInicial ?? enlaces[0]?.posicion ?? null);
  const [plantillas, setPlantillas] = useState<OpcionPlantilla[] | null>(null);
  const [plantillaId, setPlantillaId] = useState<string>(plantilla?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();

  const pulsados = useMemo(() => enlacesPulsados(eventos), [eventos]);
  const cuentan = (f: FiltroAnalitica, n: number | null = enlace) =>
    destinatarios.filter((d) => cumpleFiltro(d, f, n, pulsados));
  const elegidos = cuentan(filtro);
  const direcciones = useMemo(
    () => [...new Set(elegidos.flatMap((d) => [...d.para, ...d.copia].map((x) => x.email.toLowerCase())))].sort(),
    [elegidos],
  );

  const cargarPlantillas = () =>
    empezar(async () => {
      setError(null);
      const r = await listarPlantillasAction();
      if (r.ok) setPlantillas(r.plantillas);
      else setError(r.mensaje);
    });

  const preparar = () =>
    empezar(async () => {
      setError(null);
      const r = await prepararReenvioAction(
        comunicacionId,
        filtro,
        filtro === "pulso_enlace" ? enlace : null,
        plantillaId && plantillaId !== plantilla?.id ? plantillaId : null,
      );
      if (r.ok) {
        router.push(r.path);
        return;
      }
      setError(r.mensaje);
    });

  const nombreElegida =
    plantillaId === plantilla?.id ? (plantilla?.nombre ?? "la original") : (plantillas?.find((p) => p.id === plantillaId)?.nombre ?? plantillaId);

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={ocupado}
      width="lg"
      elevated
      title="Preparar un seguimiento"
      subtitle="No se envía nada: se prepara un borrador que pasa por revisión, prueba, ensayo y confirmación."
      footer={
        <>
          <Boton variante="secundario" onClick={onClose} disabled={ocupado}>
            Cancelar
          </Boton>
          <Boton
            variante="primario"
            icono={<Icono nombre="enviar" />}
            cargando={ocupado}
            disabled={elegidos.length === 0 || !FILTROS_DE_REENVIO.includes(filtro)}
            onClick={preparar}
          >
            Preparar seguimiento {elegidos.length > 0 ? `(${fmtInt(elegidos.length)})` : ""}
          </Boton>
        </>
      }
    >
      <div className="space-y-4">
        {!medible && porQueNoEsMedible ? (
          <Aviso tipo="aviso">
            {porQueNoEsMedible} Solo se puede elegir «Todos los que lo recibieron» o «Error al enviar».
          </Aviso>
        ) : null}

        <fieldset className="space-y-1.5">
          <legend className="mb-1 text-xs font-medium uppercase tracking-wider text-text-muted">A quién</legend>
          {FILTROS.map((f) => {
            const apagado = !medible && necesitaSeguimiento(f);
            const n = cuentan(f, f === "pulso_enlace" ? enlace : null).length;
            const activo = f === filtro;
            return (
              <label
                key={f}
                className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition ${
                  activo ? "border-icam-900 bg-icam-900/[0.04]" : "border-subtle hover:border-icam-900/40"
                } ${apagado ? "cursor-not-allowed opacity-50" : ""}`}
              >
                <input
                  type="radio"
                  name="filtro-seguimiento"
                  value={f}
                  checked={activo}
                  disabled={apagado}
                  onChange={() => setFiltro(f)}
                  className="accent-icam-900"
                />
                <span className="flex-1">{ETIQUETA_FILTRO[f]}</span>
                <Chip tono="neutro" className={n === 0 ? "opacity-60" : ""}>
                  {fmtInt(n)}
                </Chip>
              </label>
            );
          })}
        </fieldset>

        {filtro === "pulso_enlace" ? (
          <Campo etiqueta="Qué enlace">
            <select value={enlace ?? ""} onChange={(e) => setEnlace(e.target.value === "" ? null : Number(e.target.value))} className={claseCampo}>
              {enlaces.length === 0 ? <option value="">(sin enlaces)</option> : null}
              {enlaces.map((en) => (
                <option key={en.posicion} value={en.posicion}>
                  {(en.texto || en.url).slice(0, 80)}
                </option>
              ))}
            </select>
          </Campo>
        ) : null}

        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-text-muted">
            {elegidos.length === 1 ? "1 cuenta" : `${fmtInt(elegidos.length)} cuentas`} · direcciones del envío original
          </p>
          <ListaDeDirecciones direcciones={direcciones} vacio="Ninguna cuenta cumple ese filtro." />
          <p className="mt-1 text-xs text-text-muted">
            La lista definitiva se recalcula con los datos de Zoho de hoy; una dirección nueva nace excluida.
          </p>
        </div>

        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-text-muted">Plantilla</p>
          {plantillas === null ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium text-text-primary">{nombreElegida}</span>
              <Boton variante="texto" pequeno onClick={cargarPlantillas} disabled={ocupado}>
                Cambiar
              </Boton>
            </div>
          ) : (
            <select value={plantillaId} onChange={(e) => setPlantillaId(e.target.value)} className={claseCampo}>
              {plantilla ? <option value={plantilla.id}>{plantilla.nombre ?? plantilla.id} (la original)</option> : null}
              {plantillas
                .filter((p) => p.id !== plantilla?.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                    {p.carpeta ? ` · ${p.carpeta}` : ""}
                  </option>
                ))}
            </select>
          )}
        </div>

        {error ? <Aviso tipo="error">{error}</Aviso> : null}
      </div>
    </Modal>
  );
}

/** El botón que abre el diálogo. Lleva él mismo el estado de abierto/cerrado. */
export function SeguimientoBoton({
  etiqueta = "Seguimiento",
  variante = "secundario",
  pequeno,
  ...props
}: PropsSeguimiento & { etiqueta?: string; variante?: "primario" | "secundario"; pequeno?: boolean }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <Boton variante={variante} pequeno={pequeno} icono={<Icono nombre="enviar" />} onClick={() => setAbierto(true)}>
        {etiqueta}
      </Boton>
      {abierto ? <SeguimientoModal {...props} open onClose={() => setAbierto(false)} /> : null}
    </>
  );
}
