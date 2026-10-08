"use client";

import { useState, type ReactNode } from "react";

import { Aviso } from "@/components/ui/Aviso";
import { Boton } from "@/components/ui/Boton";
import { Icono } from "@/components/ui/Icono";
import { fmtInt } from "@/lib/formatters";
import { revisarDestinatariosAction } from "@/modules/comunicaciones/actions/envio";
import { motivoParaContinuar } from "@/modules/comunicaciones/logic/asistente";
import type { ContextoControles } from "@/modules/comunicaciones/logic/controles";
import type { ComDestinatarioRow } from "@/modules/comunicaciones/types";
import { DestinatariosPanel } from "@/modules/comunicaciones/ui/components/DestinatariosPanel";
import { cuantos } from "@/modules/comunicaciones/ui/components/envio/texto";

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

  return (
    <PasoDelAsistente
      ancho="ancho"
      titulo="Revisa quién lo va a recibir"
      subtitulo="Una fila por cuenta de inversión. Excluye a quien no deba recibirlo; no toca el CRM, solo esta comunicación."
      ayuda={
        <>
          La lista es una foto del momento en que se preparó: no se recalcula sola, y lo que revisas aquí es
          exactamente lo que después se envía. Si después de confirmarla excluyes o incluyes a alguien, tendrás que
          volver a confirmar que la has revisado.
        </>
      }
      pie={
        <BarraDeAcciones
          atras={atras}
          motivo={motivo ?? (porRevisar && puedeEscribir ? "Confirma que has revisado la lista para seguir" : null)}
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
      <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
        <div className="rounded-xl border border-icam-900/15 bg-icam-900/[0.04] p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-text-muted">Saldrán</p>
          <p className="mt-0.5 text-2xl font-semibold text-icam-900">{cuantos(resumen.aEnviar, "correo", "correos")}</p>
          <p className="text-xs text-text-muted">
            uno por cuenta, a {cuantos(resumen.direcciones, "dirección", "direcciones")} ({cuantos(resumen.direccionesExternas, "externa", "externas")})
          </p>
        </div>
        <Cifra titulo="Cuentas en la lista" valor={resumen.total} />
        <Cifra titulo="Excluidas" valor={resumen.excluidos} />
        <Cifra titulo="Sin destinatario" valor={resumen.sinDestinatario} nota="no recibirían nada" />
      </div>

      {!porRevisar && comunicacion.revisada_por_email ? (
        <p className="flex items-center gap-1.5 text-xs text-green-700">
          <Icono nombre="check" className="h-3.5 w-3.5" />
          Revisada por {comunicacion.revisada_por_email}
          {comunicacion.revisada_n !== null ? ` con ${cuantos(comunicacion.revisada_n, "correo", "correos")}` : ""}
        </p>
      ) : null}

      {error ? <Aviso tipo="error">{error}</Aviso> : null}

      <DestinatariosPanel
        comunicacionId={comunicacion.id}
        nombre={comunicacion.nombre}
        destinatarios={destinatarios}
        dominiosInternos={dominiosInternos}
        editable={editable}
        compacta
      />
    </PasoDelAsistente>
  );
}

function Cifra({ titulo, valor, nota }: { titulo: string; valor: number; nota?: string }) {
  return (
    <div className="rounded-xl border border-subtle/60 bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-text-muted">{titulo}</p>
      <p className="mt-0.5 text-2xl font-semibold tabular-nums text-text-primary">{fmtInt(valor)}</p>
      {nota ? <p className="text-xs text-text-muted">{nota}</p> : null}
    </div>
  );
}
