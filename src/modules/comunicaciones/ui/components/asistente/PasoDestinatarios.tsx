"use client";

import { useState, type ReactNode } from "react";

import { Aviso } from "@/components/ui/Aviso";
import { Boton } from "@/components/ui/Boton";
import { Icono } from "@/components/ui/Icono";
import { fmtFechaHora, fmtInt } from "@/lib/formatters";
import { revisarDestinatariosAction } from "@/modules/comunicaciones/actions/envio";
import { motivoParaContinuar } from "@/modules/comunicaciones/logic/asistente";
import type { ContextoControles } from "@/modules/comunicaciones/logic/controles";
import type { ComDestinatarioRow } from "@/modules/comunicaciones/types";
import { DestinatariosPanel } from "@/modules/comunicaciones/ui/components/DestinatariosPanel";
import { cuantos } from "@/modules/comunicaciones/ui/components/envio/texto";

import { ListaGuiada, PreguntaGuiada, type EstadoPregunta } from "./guiado";
import { BarraDeAcciones, PasoDelAsistente } from "./marco";

/**
 * Paso 2: la lista, cuenta por cuenta. «Continuar» es el control de revisión:
 * deja constancia de quién la ha revisado y con cuántos correos. Si después se
 * excluye o incluye a alguien, el servidor deshace la revisión.
 */
export function PasoDestinatarios({
  ctx,
  destinatarios,
  dominiosInternos,
  editable,
  puedeEscribir,
  atras,
  onContinuar,
}: {
  ctx: ContextoControles;
  destinatarios: ComDestinatarioRow[];
  dominiosInternos: string[];
  editable: boolean;
  puedeEscribir: boolean;
  atras: ReactNode;
  onContinuar: () => void;
}) {
  const { comunicacion, resumen } = ctx;
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const porRevisar = comunicacion.estado === "borrador";
  const motivo = puedeEscribir ? motivoParaContinuar("destinatarios", ctx) : null;

  const continuar = async () => {
    if (!porRevisar || !puedeEscribir) {
      onContinuar();
      return;
    }
    setOcupado(true);
    setError(null);
    const r = await revisarDestinatariosAction(comunicacion.id, resumen.aEnviar);
    setOcupado(false);
    if (r.ok) onContinuar();
    else setError(r.mensaje);
  };

  const etiqueta =
    porRevisar && puedeEscribir
      ? resumen.aEnviar === 1
        ? "He revisado el destinatario"
        : `He revisado los ${fmtInt(resumen.aEnviar)}`
      : "Continuar a Contenido";

  // La lista se mira antes de confirmar. Si ya está revisada, se da por mirada.
  const [mirando, setMirando] = useState(porRevisar);
  const conAvisos = destinatarios.filter((d) => d.avisos.length > 0).length;
  const estadoLista: EstadoPregunta = mirando ? "activa" : "hecha";
  const estadoConfirmar: EstadoPregunta = !porRevisar ? "hecha" : mirando ? "bloqueada" : "activa";

  return (
    <PasoDelAsistente
      ancho="ancho"
      titulo="Revisa quién lo va a recibir"
      subtitulo="Tres pasos cortos: mira las cifras, repasa la lista y confírmala."
      ayuda={
        <>
          La lista es una foto del momento en que se preparó: no se recalcula sola, y lo que revisas aquí es
          exactamente lo que después se envía. Excluir a alguien no toca el CRM, solo esta comunicación. Si después de
          confirmarla excluyes o incluyes a alguien, tendrás que volver a confirmar que la has revisado.
        </>
      }
      pie={
        <BarraDeAcciones
          atras={atras}
          motivo={
            motivo ??
            (!porRevisar || !puedeEscribir
              ? null
              : mirando
                ? "2 de 3 · repasa la lista"
                : "3 de 3 · confirma que la has revisado")
          }
          principal={
            <Boton variante="primario" cargando={ocupado} disabled={motivo !== null} onClick={continuar}>
              {etiqueta}
              {porRevisar && puedeEscribir ? <span className="opacity-70">· Continuar</span> : null}
              <Icono nombre="chevron" className="h-3.5 w-3.5" />
            </Boton>
          }
        />
      }
    >
      <ListaGuiada>
        <PreguntaGuiada
          numero={1}
          estado="hecha"
          abiertaSiHecha
          titulo="Esto es lo que saldría"
          respuesta={
            <>
              {cuantos(resumen.aEnviar, "correo", "correos")}
              <span className="font-normal text-text-muted">
                {" "}
                · uno por cuenta, a {cuantos(resumen.direcciones, "dirección", "direcciones")} ({cuantos(resumen.direccionesExternas, "externa", "externas")})
              </span>
            </>
          }
        >
          <div className="grid gap-2 sm:grid-cols-4">
            <Cifra titulo="Saldrán" valor={resumen.aEnviar} nota="correos" destacada />
            <Cifra titulo="Cuentas en la lista" valor={resumen.total} />
            <Cifra titulo="Excluidas" valor={resumen.excluidos} />
            <Cifra titulo="Sin destinatario" valor={resumen.sinDestinatario} nota="no recibirían nada" />
          </div>
        </PreguntaGuiada>

        <PreguntaGuiada
          numero={2}
          estado={estadoLista}
          abiertaSiHecha={false}
          titulo="Repasa la lista, cuenta por cuenta"
          subtitulo={
            conAvisos > 0 ? (
              <>
                Empieza por las <strong>{cuantos(conAvisos, "cuenta con avisos", "cuentas con avisos")}</strong> (filtro «Con
                avisos»). Excluye a quien no deba recibirlo.
              </>
            ) : (
              "Ninguna cuenta tiene avisos. Excluye a quien no deba recibirlo."
            )
          }
          respuesta={
            <>
              {cuantos(resumen.total, "cuenta revisada", "cuentas revisadas")}
              <span className="font-normal text-text-muted">
                {" "}
                · {cuantos(resumen.excluidos, "excluida", "excluidas")} · {cuantos(conAvisos, "con avisos", "con avisos")}
              </span>
            </>
          }
          onCambiar={() => setMirando(true)}
        >
          <DestinatariosPanel
            comunicacionId={comunicacion.id}
            nombre={comunicacion.nombre}
            destinatarios={destinatarios}
            dominiosInternos={dominiosInternos}
            editable={editable}
            compacta
          />
          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
            <span className="text-xs text-text-muted">
              {cuantos(resumen.aEnviar, "cuenta recibiría", "cuentas recibirían")} el correo
            </span>
            <Boton variante={porRevisar ? "primario" : "secundario"} pequeno onClick={() => setMirando(false)}>
              {porRevisar ? "Ya la he repasado" : "Cerrar la lista"}
              <Icono nombre="check" className="h-3 w-3" />
            </Boton>
          </div>
        </PreguntaGuiada>

        <PreguntaGuiada
          numero={3}
          estado={estadoConfirmar}
          ultima
          titulo="Confirma que la has revisado"
          subtitulo="Queda constancia de quién la ha revisado y con cuántos correos."
          respuesta={
            comunicacion.revisada_por_email ? (
              <>
                Revisada por {comunicacion.revisada_por_email}
                <span className="font-normal text-text-muted">
                  {comunicacion.revisada_n !== null ? ` · ${cuantos(comunicacion.revisada_n, "correo", "correos")}` : ""}
                  {comunicacion.revisada_at ? ` · ${fmtFechaHora(comunicacion.revisada_at)}` : ""}
                </span>
              </>
            ) : (
              "Revisada"
            )
          }
        >
          {puedeEscribir ? (
            <div className="flex flex-wrap items-center gap-2">
              <Boton variante="primario" cargando={ocupado} disabled={motivo !== null} icono={<Icono nombre="check" />} onClick={continuar}>
                {etiqueta} · Continuar
              </Boton>
              {motivo ? <span className="text-xs text-text-muted">{motivo}</span> : null}
            </div>
          ) : (
            <p className="text-sm text-text-muted">Tu rol es de lectura: no puedes confirmarla.</p>
          )}
        </PreguntaGuiada>
      </ListaGuiada>

      {error ? <Aviso tipo="error">{error}</Aviso> : null}
    </PasoDelAsistente>
  );
}

function Cifra({ titulo, valor, nota, destacada }: { titulo: string; valor: number; nota?: string; destacada?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${destacada ? "border-icam-900/15 bg-icam-900/[0.04]" : "border-subtle/60 bg-card"}`}>
      <p className="text-xs font-medium uppercase tracking-wider text-text-muted">{titulo}</p>
      <p className={`mt-0.5 text-2xl font-semibold tabular-nums ${destacada ? "text-icam-900" : "text-text-primary"}`}>{fmtInt(valor)}</p>
      {nota ? <p className="text-xs text-text-muted">{nota}</p> : null}
    </div>
  );
}
