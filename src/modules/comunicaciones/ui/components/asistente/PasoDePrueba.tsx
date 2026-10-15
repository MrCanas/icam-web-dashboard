"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Aviso } from "@/components/ui/Aviso";
import { Boton } from "@/components/ui/Boton";
import { Campo, claseCampo } from "@/components/ui/Campo";
import { Icono } from "@/components/ui/Icono";
import { fmtFechaHora } from "@/lib/formatters";
import { enviarPruebaAction, marcarPruebaVistaAction } from "@/modules/comunicaciones/actions/envio";
import { motivoParaContinuar } from "@/modules/comunicaciones/logic/asistente";
import { pruebaVigente, puedeEnviarPrueba, type ContextoControles } from "@/modules/comunicaciones/logic/controles";

import { ListaGuiada, PreguntaGuiada, type EstadoPregunta } from "./guiado";
import { BarraDeAcciones, PasoDelAsistente } from "./marco";

const MIRAR = [
  "El asunto y el remitente son los que esperas",
  "Los datos de la cuenta (nombres, importes, fechas) están bien",
  "Los enlaces llevan adonde deben",
  "Los adjuntos están y se abren",
];

/**
 * Paso 4: el correo de verdad, solo a quien está delante. Son dos controles:
 * enviar la prueba (sobre la cuenta de pruebas de los ajustes) y darla por
 * buena tras mirarla en la bandeja.
 */
export function PasoDePrueba({
  ctx,
  usuarioEmail,
  puedeEscribir,
  atras,
  onContinuar,
}: {
  ctx: ContextoControles;
  usuarioEmail: string;
  puedeEscribir: boolean;
  atras: ReactNode;
  onContinuar: () => void;
}) {
  const router = useRouter();
  const { comunicacion, ajustes } = ctx;
  const [remitente, setRemitente] = useState(
    ajustes.remitentes_permitidos.includes(usuarioEmail.toLowerCase())
      ? usuarioEmail.toLowerCase()
      : (comunicacion.remitente_email ?? ajustes.remitentes_permitidos[0] ?? ""),
  );
  const [ocupado, setOcupado] = useState<"prueba" | "vista" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recienEnviada, setRecienEnviada] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [mirado, setMirado] = useState<string[]>([]);

  const hayPrueba = pruebaVigente(comunicacion);
  const probada = comunicacion.estado !== "borrador" && comunicacion.estado !== "revisada";
  const motivoPrueba = puedeEscribir ? puedeEnviarPrueba(ctx, remitente) : null;
  const motivo = puedeEscribir ? motivoParaContinuar("prueba", ctx) : null;
  const simulada = comunicacion.pasarela === "simulada";

  const enviar = async () => {
    setOcupado("prueba");
    setError(null);
    const r = await enviarPruebaAction(comunicacion.id, remitente);
    setOcupado(null);
    if (r.ok) {
      setRecienEnviada(true);
      setReenviando(false);
      setMirado([]);
      router.refresh();
    } else setError(r.mensaje);
  };

  const continuar = async () => {
    if (probada || !puedeEscribir) {
      onContinuar();
      return;
    }
    setOcupado("vista");
    setError(null);
    const r = await marcarPruebaVistaAction(comunicacion.id);
    setOcupado(null);
    if (r.ok) onContinuar();
    else setError(r.mensaje);
  };

  const estadoEnviar: EstadoPregunta = reenviando || (!hayPrueba && !probada) ? "activa" : "hecha";
  const estadoMirar: EstadoPregunta = probada && !reenviando ? "hecha" : hayPrueba && !reenviando ? "activa" : "bloqueada";

  return (
    <PasoDelAsistente
      ancho="estrecho"
      titulo="Envíate una prueba"
      subtitulo="Antes de que salga a nadie, míralo tú como lo verá un inversor."
      ayuda={
        <>
          La prueba sale sobre la cuenta de pruebas de los ajustes, no sobre un destinatario de la lista, para no
          dejar correos de prueba en la ficha de un inversor. Es exactamente el correo que montará el portal, con su
          seguimiento. Si cambias la plantilla después, habrá que enviar otra.
        </>
      }
      pie={
        <BarraDeAcciones
          atras={atras}
          motivo={
            probada || !puedeEscribir
              ? null
              : !hayPrueba
                ? "1 de 2 · envíate la prueba"
                : "2 de 2 · cuando la hayas mirado, dala por buena"
          }
          principal={
            <Boton variante="primario" cargando={ocupado === "vista"} disabled={motivo !== null || ocupado !== null || reenviando} onClick={continuar}>
              {probada || !puedeEscribir ? "Continuar a Revisar y enviar" : "La he recibido y está bien"}
              <Icono nombre="chevron" className="h-3.5 w-3.5" />
            </Boton>
          }
        />
      }
    >
      <ListaGuiada>
        <PreguntaGuiada
          numero={1}
          estado={estadoEnviar}
          titulo="Envíate la prueba"
          subtitulo={`Te llega solo a ti, a ${usuarioEmail}.`}
          respuesta={
            hayPrueba || probada ? (
              <>
                Enviada a {comunicacion.prueba_enviada_por_email ?? usuarioEmail}
                <span className="font-normal text-text-muted">
                  {" "}
                  · {fmtFechaHora(comunicacion.prueba_enviada_at)} · desde {comunicacion.remitente_email}
                  {simulada ? " · simulada, no ha salido ningún correo" : ""}
                </span>
              </>
            ) : null
          }
          onCambiar={puedeEscribir ? () => setReenviando(true) : undefined}
        >
          {puedeEscribir ? (
            <div className="space-y-3">
              <Campo etiqueta="Desde">
                <select value={remitente} onChange={(e) => setRemitente(e.target.value)} className={claseCampo}>
                  {ajustes.remitentes_permitidos.length === 0 ? <option value="">(ninguno permitido)</option> : null}
                  {ajustes.remitentes_permitidos.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </Campo>
              <div className="flex flex-wrap items-center gap-2">
                <Boton
                  variante="primario"
                  icono={<Icono nombre="enviar" />}
                  cargando={ocupado === "prueba"}
                  disabled={motivoPrueba !== null || ocupado !== null}
                  onClick={enviar}
                >
                  {hayPrueba || probada ? "Enviarme otra prueba" : "Enviarme la prueba"}
                </Boton>
                {reenviando ? (
                  <Boton variante="texto" onClick={() => setReenviando(false)}>
                    Cancelar
                  </Boton>
                ) : null}
              </div>
              {motivoPrueba ? <p className="text-xs text-text-muted">{motivoPrueba}</p> : null}
              {probada ? <p className="text-xs text-text-muted">Enviar otra prueba obliga a darla por buena de nuevo.</p> : null}
            </div>
          ) : (
            <p className="text-sm text-text-muted">Todavía no se ha enviado ninguna prueba.</p>
          )}
        </PreguntaGuiada>

        <PreguntaGuiada
          numero={2}
          estado={estadoMirar}
          ultima
          titulo={recienEnviada && !probada ? "¡Enviada! Ábrela en tu bandeja y revísala" : "Ábrela en tu bandeja y revísala"}
          subtitulo="Marca lo que ya has comprobado. Si todo está bien, dala por buena."
          respuesta={
            probada ? (
              <>
                Dada por buena
                <span className="font-normal text-text-muted">
                  {" "}
                  · {comunicacion.probada_por_email} · {fmtFechaHora(comunicacion.probada_at)}
                </span>
              </>
            ) : null
          }
        >
          <ul className="space-y-1.5">
            {MIRAR.map((m) => {
              const hecho = mirado.includes(m);
              return (
                <li key={m}>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-text-body hover:bg-page">
                    <input
                      type="checkbox"
                      checked={hecho}
                      onChange={() => setMirado((l) => (hecho ? l.filter((x) => x !== m) : [...l, m]))}
                      className="h-4 w-4 accent-green-600"
                    />
                    <span className={hecho ? "text-text-muted line-through" : ""}>{m}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          {puedeEscribir ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-subtle/60 pt-3">
              <Boton variante="primario" icono={<Icono nombre="check" />} cargando={ocupado === "vista"} disabled={motivo !== null || ocupado !== null} onClick={continuar}>
                La he recibido y está bien
              </Boton>
              <span className="text-xs text-text-muted">
                {mirado.length === MIRAR.length ? "¡Todo comprobado!" : `${mirado.length} de ${MIRAR.length} comprobados`}
              </span>
            </div>
          ) : null}
        </PreguntaGuiada>
      </ListaGuiada>

      {error ? <Aviso tipo="error">{error}</Aviso> : null}
    </PasoDelAsistente>
  );
}
