"use client";

import { Ayuda } from "@/components/ui/Ayuda";
import { Boton } from "@/components/ui/Boton";
import { Campo, claseCampo } from "@/components/ui/Campo";
import { Chip } from "@/components/ui/Chip";
import { fmtFechaHora } from "@/lib/formatters";
import type { ComAjustesRow, ComComunicacionRow } from "@/modules/comunicaciones/types";
import { PasoCard } from "@/modules/comunicaciones/ui/components/ui/PasoCard";

export function PasoPrueba({
  comunicacion,
  ajustes,
  usuarioEmail,
  hecho,
  bloqueado,
  hayPrueba,
  puedeEscribir,
  ocupado,
  remitente,
  onRemitente,
  motivoPrueba,
  motivoMarcar,
  onEnviarPrueba,
  onMarcarVista,
}: {
  comunicacion: ComComunicacionRow;
  ajustes: ComAjustesRow;
  usuarioEmail: string;
  hecho: boolean;
  /** Falta el paso anterior. */
  bloqueado: boolean;
  hayPrueba: boolean;
  puedeEscribir: boolean;
  ocupado: boolean;
  remitente: string;
  onRemitente: (r: string) => void;
  motivoPrueba: string | null;
  motivoMarcar: string | null;
  onEnviarPrueba: () => void;
  onMarcarVista: () => void;
}) {
  if (hecho) {
    return (
      <PasoCard
        numero={2}
        titulo="Prueba recibida y dada por buena"
        estado="hecho"
        resumen={`${comunicacion.probada_por_email} · ${fmtFechaHora(comunicacion.probada_at)} · remitente ${comunicacion.remitente_email}`}
      />
    );
  }
  if (bloqueado) {
    return <PasoCard numero={2} titulo="Enviarte una prueba y mirarla" estado="pendiente" resumen="Antes hay que revisar los destinatarios." />;
  }
  return (
    <PasoCard numero={2} titulo="Enviarte una prueba y mirarla" estado="actual">
      <p>
        Se envía el correo de verdad, con la plantilla elegida, <strong>solo a {usuarioEmail}</strong>.
        <Ayuda className="ml-1">
          Sale sobre la cuenta de pruebas de los ajustes, no sobre un destinatario de la lista, para no dejar correos
          de prueba en la ficha de un inversor. Es exactamente el correo que montará el portal, con su seguimiento.
        </Ayuda>
      </p>
      {hayPrueba ? (
        <p className="flex flex-wrap items-center gap-2">
          <Chip tono="ok">Prueba enviada</Chip>
          <span className="text-text-muted">
            {fmtFechaHora(comunicacion.prueba_enviada_at)} · {comunicacion.prueba_enviada_por_email}
            {comunicacion.pasarela === "simulada" ? " · simulada: no ha salido ningún correo" : ""}
          </span>
        </p>
      ) : null}
      {puedeEscribir ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[260px]">
            <Campo etiqueta="Remitente">
              <select value={remitente} onChange={(e) => onRemitente(e.target.value)} className={claseCampo}>
                {ajustes.remitentes_permitidos.length === 0 ? <option value="">(ninguno permitido)</option> : null}
                {ajustes.remitentes_permitidos.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
          <Boton variante={hayPrueba ? "secundario" : "primario"} disabled={ocupado || motivoPrueba !== null} onClick={onEnviarPrueba}>
            {hayPrueba ? "Enviar otra prueba" : "Enviarme la prueba"}
          </Boton>
          {hayPrueba ? (
            <Boton variante="primario" disabled={ocupado || motivoMarcar !== null} onClick={onMarcarVista}>
              La he recibido y está bien
            </Boton>
          ) : null}
        </div>
      ) : null}
      {puedeEscribir && motivoPrueba ? <p className="text-xs text-text-muted">{motivoPrueba}</p> : null}
    </PasoCard>
  );
}
