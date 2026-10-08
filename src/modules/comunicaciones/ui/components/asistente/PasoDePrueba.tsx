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

  return (
    <PasoDelAsistente
      ancho="estrecho"
      titulo="Envíate una prueba"
      subtitulo={`Te llega el correo de verdad, con la plantilla elegida, solo a ti (${usuarioEmail}).`}
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
          motivo={motivo ?? (!probada && puedeEscribir ? "Cuando la hayas mirado, dala por buena" : null)}
          principal={
            <Boton variante="primario" cargando={ocupado === "vista"} disabled={motivo !== null || ocupado !== null} onClick={continuar}>
              {probada || !puedeEscribir ? "Continuar a Revisar y enviar" : "La he recibido y está bien"}
              <Icono nombre="chevron" className="h-3.5 w-3.5" />
            </Boton>
          }
        />
      }
    >
      {probada ? (
        <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-600 text-white">
            <Icono nombre="check" className="h-4 w-4" />
          </span>
          <div className="min-w-0 text-sm">
            <p className="font-semibold text-green-900">Prueba dada por buena</p>
            <p className="text-green-900/80">
              {comunicacion.probada_por_email} · {fmtFechaHora(comunicacion.probada_at)} · desde {comunicacion.remitente_email}
            </p>
          </div>
        </div>
      ) : hayPrueba ? (
        <div className="space-y-3 rounded-xl border border-icam-900/15 bg-card p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-icam-900/[0.06] text-icam-900">
              <Icono nombre="correo" className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-base font-semibold text-text-primary">
                {recienEnviada ? "¡Enviada! Mira tu bandeja" : "Mira tu bandeja de entrada"}
              </p>
              <p className="text-sm text-text-muted">
                Enviada a {comunicacion.prueba_enviada_por_email} el {fmtFechaHora(comunicacion.prueba_enviada_at)}
                {simulada ? " · pasarela simulada: no ha salido ningún correo" : ""}
              </p>
            </div>
          </div>
          <ul className="space-y-1.5 border-t border-subtle/60 pt-3 text-sm text-text-body">
            {MIRAR.map((m) => (
              <li key={m} className="flex items-start gap-2">
                <Icono nombre="check" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-muted" />
                {m}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-subtle bg-card px-6 py-8 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-icam-900/[0.06] text-icam-900">
            <Icono nombre="enviar" className="h-5 w-5" />
          </span>
          <p className="text-base font-semibold text-text-primary">Todavía no te has enviado ninguna prueba</p>
          <p className="max-w-md text-sm text-text-muted">
            Ábrela en tu correo como la verá un inversor. Cuando esté bien, vuelve aquí y dala por buena.
          </p>
        </div>
      )}

      {puedeEscribir ? (
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-subtle/60 bg-card p-4">
          <div className="min-w-[240px] flex-1">
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
          </div>
          <Boton
            variante={hayPrueba || probada ? "secundario" : "primario"}
            icono={<Icono nombre="enviar" />}
            cargando={ocupado === "prueba"}
            disabled={motivoPrueba !== null || ocupado !== null}
            onClick={enviar}
          >
            {hayPrueba || probada ? "Enviarme otra prueba" : "Enviarme la prueba"}
          </Boton>
          {motivoPrueba ? <p className="basis-full text-xs text-text-muted">{motivoPrueba}</p> : null}
          {probada ? (
            <p className="basis-full text-xs text-text-muted">Enviar otra prueba obliga a darla por buena de nuevo.</p>
          ) : null}
        </div>
      ) : null}

      {error ? <Aviso tipo="error">{error}</Aviso> : null}
    </PasoDelAsistente>
  );
}
