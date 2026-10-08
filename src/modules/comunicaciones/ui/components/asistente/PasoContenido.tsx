"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";

import { Aviso } from "@/components/ui/Aviso";
import { Ayuda } from "@/components/ui/Ayuda";
import { Boton } from "@/components/ui/Boton";
import { claseCampo } from "@/components/ui/Campo";
import { Chip } from "@/components/ui/Chip";
import { Icono } from "@/components/ui/Icono";
import {
  elegirPlantillaAction,
  listarPlantillasAction,
  vistaPreviaAction,
  type OpcionPlantilla,
  type VistaPreviaDeDestinatario,
} from "@/modules/comunicaciones/actions/comunicaciones";
import { motivoParaContinuar } from "@/modules/comunicaciones/logic/asistente";
import type { ContextoControles } from "@/modules/comunicaciones/logic/controles";

import { BarraDeAcciones, PasoDelAsistente } from "./marco";

const ETIQUETA_MODULO: Record<string, string> = {
  Cuentas_de_Inversi_n: "Cuentas de Inversión",
  Contacts: "Contactos",
};

const SIN_RESOLVER = "Esta plantilla usa campos que el portal no sabe resolver: elige otra.";

/**
 * Paso 3: qué se envía. Las plantillas siguen en Zoho CRM: aquí se eligen y se
 * ve cómo le llega el correo a cada destinatario; no se editan.
 */
export function PasoContenido({
  ctx,
  destinatarios,
  editable,
  atras,
  onContinuar,
}: {
  ctx: ContextoControles;
  /** Solo los que recibirían el correo: son los únicos con algo que previsualizar. */
  destinatarios: { id: string; nombre: string }[];
  editable: boolean;
  atras: ReactNode;
  onContinuar: () => void;
}) {
  const router = useRouter();
  const { comunicacion } = ctx;
  const plantillaId = comunicacion.plantilla_id;
  const [plantillas, setPlantillas] = useState<OpcionPlantilla[] | null>(null);
  const [eligiendo, setEligiendo] = useState(editable && !plantillaId);
  const [busqueda, setBusqueda] = useState("");
  const [elegidoId, setDestinatarioId] = useState(destinatarios[0]?.id ?? "");
  const destinatarioId = destinatarios.some((d) => d.id === elegidoId) ? elegidoId : (destinatarios[0]?.id ?? "");
  const [vista, setVista] = useState<{ clave: string; datos: VistaPreviaDeDestinatario } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargandoLista, empezarLista] = useTransition();
  const [guardando, empezarGuardar] = useTransition();
  const [previsualizando, empezarVista] = useTransition();

  const claveVista = plantillaId && destinatarioId ? `${plantillaId}:${destinatarioId}` : null;
  const vistaActual = vista && vista.clave === claveVista ? vista.datos : null;

  // La lista de plantillas se lee de Zoho al abrir el selector, una vez.
  useEffect(() => {
    if (!eligiendo || plantillas !== null) return;
    empezarLista(async () => {
      const r = await listarPlantillasAction();
      if (r.ok) setPlantillas(r.plantillas);
      else setError(r.mensaje);
    });
  }, [eligiendo, plantillas]);

  // La vista previa se pide sola al elegir plantilla o destinatario.
  useEffect(() => {
    if (!claveVista || !plantillaId) return;
    empezarVista(async () => {
      const r = await vistaPreviaAction(comunicacion.id, destinatarioId);
      if (r.ok) setVista({ clave: claveVista, datos: r.vista });
      else setError(r.mensaje);
    });
  }, [claveVista, plantillaId, comunicacion.id, destinatarioId]);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!plantillas) return [];
    if (!q) return plantillas;
    return plantillas.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        (p.carpeta ?? "").toLowerCase().includes(q) ||
        (p.asunto ?? "").toLowerCase().includes(q),
    );
  }, [plantillas, busqueda]);

  const elegir = (id: string) =>
    empezarGuardar(async () => {
      setError(null);
      if (id === plantillaId) {
        setEligiendo(false);
        return;
      }
      const r = await elegirPlantillaAction(comunicacion.id, id);
      if (!r.ok) {
        setError(r.mensaje);
        return;
      }
      setEligiendo(false);
      router.refresh();
    });

  const bloqueaPorCampos = Boolean(vistaActual && vistaActual.sinResolver.length > 0);
  const motivo = motivoParaContinuar("contenido", ctx) ?? (bloqueaPorCampos ? SIN_RESOLVER : null);
  const elegida = plantillas?.find((p) => p.id === plantillaId);

  return (
    <PasoDelAsistente
      ancho="ancho"
      titulo="Elige qué vas a enviar"
      subtitulo="Escoge una plantilla de Zoho CRM y mira cómo le llega a cada destinatario."
      ayuda={
        <>
          Las plantillas se editan en Zoho CRM; aquí solo se eligen. La vista previa es el correo tal como lo monta el
          portal con los datos de cada destinatario. Las imágenes de la plantilla solo se ven aquí si tienes abierta la
          sesión de Zoho; al enviar, Zoho las incrusta en el correo. La comprobación fiel es la prueba del paso
          siguiente.
        </>
      }
      pie={
        <BarraDeAcciones
          atras={atras}
          motivo={motivo}
          principal={
            <Boton variante="primario" disabled={motivo !== null || guardando} onClick={onContinuar}>
              Continuar a Prueba
              <Icono nombre="chevron" className="h-3.5 w-3.5" />
            </Boton>
          }
        />
      }
    >
      {error ? <Aviso tipo="error">{error}</Aviso> : null}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Izquierda: la plantilla elegida o el selector. */}
        <div className="space-y-3 rounded-xl border border-subtle/60 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-text-primary">Plantilla</h2>
            {editable && plantillaId && !eligiendo ? (
              <Boton variante="secundario" pequeno onClick={() => setEligiendo(true)}>
                Cambiar
              </Boton>
            ) : null}
            {eligiendo && plantillaId ? (
              <Boton variante="texto" pequeno onClick={() => setEligiendo(false)}>
                Cancelar
              </Boton>
            ) : null}
          </div>

          {!eligiendo ? (
            plantillaId ? (
              <div className="flex items-start gap-3 rounded-lg border border-icam-900/15 bg-icam-900/[0.04] p-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-icam-900 text-white">
                  <Icono nombre="correo" className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-text-primary">{comunicacion.plantilla_nombre ?? elegida?.nombre}</p>
                  <p className="text-xs text-text-muted">
                    {vistaActual ? <>Asunto: {vistaActual.asunto || "(sin asunto)"}</> : (ETIQUETA_MODULO[comunicacion.plantilla_modulo ?? ""] ?? "")}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-text-muted">Todavía no hay plantilla.</p>
            )
          ) : (
            <div className="space-y-2">
              <label className="relative block">
                <span className="sr-only">Buscar plantilla</span>
                <Icono nombre="buscar" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
                <input
                  type="search"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre, carpeta o asunto"
                  className={`${claseCampo} pl-8`}
                  autoFocus
                />
              </label>
              {cargandoLista ? (
                <p className="flex items-center gap-2 px-1 py-6 text-sm text-text-muted">
                  <Icono nombre="actualizar" className="h-3.5 w-3.5 animate-spin" />
                  Leyendo las plantillas de Zoho…
                </p>
              ) : (
                <ul className="max-h-[50vh] space-y-1.5 overflow-auto">
                  {filtradas.map((p) => {
                    const actual = p.id === plantillaId;
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          disabled={guardando}
                          onClick={() => elegir(p.id)}
                          className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-icam-900/40 disabled:opacity-50 ${
                            actual ? "border-icam-900 bg-icam-900/[0.04]" : "border-subtle hover:border-icam-900/40 hover:bg-page"
                          }`}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="font-medium text-text-primary">{p.nombre}</span>
                            {actual ? <Chip tono="ok">elegida</Chip> : null}
                          </span>
                          <span className="block truncate text-xs text-text-muted">
                            {ETIQUETA_MODULO[p.modulo ?? ""] ?? p.modulo ?? "—"}
                            {p.carpeta ? ` · ${p.carpeta}` : ""}
                            {p.asunto ? ` · ${p.asunto}` : ""}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                  {plantillas !== null && filtradas.length === 0 ? (
                    <li className="px-3 py-4 text-center text-sm text-text-muted">Ninguna plantilla con ese texto.</li>
                  ) : null}
                </ul>
              )}
            </div>
          )}

          {vistaActual ? (
            <dl className="grid gap-x-4 gap-y-1 border-t border-subtle/60 pt-3 text-xs sm:grid-cols-[auto_1fr]">
              <dt className="text-text-muted">Para</dt>
              <dd className="text-text-body">{vistaActual.para.join(", ")}</dd>
              {vistaActual.copia.length > 0 ? (
                <>
                  <dt className="text-text-muted">Copia</dt>
                  <dd className="text-text-body">{vistaActual.copia.join(", ")}</dd>
                </>
              ) : null}
              <dt className="text-text-muted">Datos de</dt>
              <dd className="text-text-body">{vistaActual.registroNombre}</dd>
              <dt className="text-text-muted">Adjuntos</dt>
              <dd className="text-text-body">{vistaActual.adjuntos.length > 0 ? vistaActual.adjuntos.join(", ") : "Ninguno"}</dd>
              <dt className="text-text-muted">Seguimiento</dt>
              <dd className="flex flex-wrap items-center gap-1 text-text-body">
                {vistaActual.imagen === "logo" ? "logotipo al pie" : "imagen invisible"} · enlaces por go.imparcapital.com
                <Ayuda>
                  {vistaActual.imagen === "logo"
                    ? "La plantilla no trae imágenes: se le añade el logotipo de Impar Capital al pie, para poder saber si se abre."
                    : "Se le añade una imagen invisible para saber si se abre."}{" "}
                  Al enviar, cada enlace pasa por go.imparcapital.com y vuelve a su destino; así se sabe quién pulsa.
                </Ayuda>
              </dd>
            </dl>
          ) : null}
        </div>

        {/* Derecha: cómo le llega a un destinatario. */}
        <div className="space-y-3 rounded-xl border border-subtle/60 bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-text-primary">Vista previa</h2>
            {plantillaId && destinatarios.length > 0 ? (
              <label className="flex min-w-0 items-center gap-2 whitespace-nowrap text-xs text-text-muted">
                Cómo le llega a
                <select
                  value={destinatarioId}
                  onChange={(e) => setDestinatarioId(e.target.value)}
                  className={`${claseCampo} max-w-[240px] py-1 text-xs`}
                >
                  {destinatarios.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nombre}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          {!plantillaId ? (
            <div className="flex h-[420px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-subtle text-center text-sm text-text-muted">
              <Icono nombre="correo" className="h-6 w-6" />
              Elige una plantilla para ver aquí el correo.
            </div>
          ) : destinatarios.length === 0 ? (
            <p className="text-sm text-text-muted">No hay ningún destinatario que fuera a recibir el correo, así que no hay nada que previsualizar.</p>
          ) : previsualizando && !vistaActual ? (
            <div className="flex h-[420px] items-center justify-center gap-2 rounded-lg bg-page text-sm text-text-muted">
              <Icono nombre="actualizar" className="h-3.5 w-3.5 animate-spin" />
              Montando el correo…
            </div>
          ) : vistaActual ? (
            <>
              {vistaActual.sinResolver.length > 0 ? (
                <Aviso tipo="error" titulo="Con esta plantilla el correo no saldría">
                  Usa campos que el portal no sabe resolver (marcados en rojo): {vistaActual.sinResolver.join(", ")}. Son
                  campos de otro módulo, la firma del usuario, o importes y fechas, que Zoho escribe a su manera.
                </Aviso>
              ) : null}
              {vistaActual.vacios.length > 0 ? (
                <p className="flex flex-wrap items-center gap-1.5 text-xs">
                  <Chip tono="aviso">campos vacíos</Chip>
                  <span className="text-text-muted">saldrían en blanco para este destinatario: {vistaActual.vacios.join(", ")}</span>
                </p>
              ) : null}
              <div className="overflow-hidden rounded-lg border border-subtle">
                <div className="border-b border-subtle bg-page px-3 py-2 text-sm">
                  <span className="text-text-muted">Asunto: </span>
                  <span className="font-medium text-text-primary">{vistaActual.asunto || "(sin asunto)"}</span>
                </div>
                {/* `sandbox` sin permisos: el HTML de la plantilla no ejecuta scripts ni navega. */}
                <iframe
                  title={`Vista previa de ${vistaActual.plantillaNombre}`}
                  sandbox=""
                  srcDoc={vistaActual.html}
                  className={`h-[560px] w-full bg-white transition ${previsualizando ? "opacity-50" : ""}`}
                />
              </div>
            </>
          ) : (
            <div className="flex h-[420px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-subtle px-6 text-center text-sm text-text-muted">
              <Icono nombre="alerta" className="h-5 w-5" />
              No se pudo montar la vista previa. El motivo está arriba; puedes continuar y comprobarlo con la prueba.
            </div>
          )}
        </div>
      </div>
    </PasoDelAsistente>
  );
}
