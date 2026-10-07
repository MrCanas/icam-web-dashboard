"use client";

import { Aviso } from "@/components/ui/Aviso";
import { Ayuda, Desplegable } from "@/components/ui/Ayuda";
import { Boton } from "@/components/ui/Boton";
import { Campo, claseCampo } from "@/components/ui/Campo";
import { fmtFechaHora, fmtInt } from "@/lib/formatters";
import type { InformeDeEnsayo } from "@/modules/comunicaciones/actions/envio";
import type { ComAjustesRow, ComComunicacionRow, NombrePasarela, ResumenDestinatarios } from "@/modules/comunicaciones/types";
import { ChipModo, ChipPasarela } from "@/modules/comunicaciones/ui/components/ui/ChipEstado";
import { ListaDeDirecciones } from "@/modules/comunicaciones/ui/components/ui/ListaDeDirecciones";
import { PasoCard } from "@/modules/comunicaciones/ui/components/ui/PasoCard";

import { cuantos } from "./texto";

export function PasoConfirmar({
  comunicacion,
  resumen,
  ajustes,
  usuarioEmail,
  pasarela,
  lineas,
  hecho,
  bloqueado,
  puedeEscribir,
  ocupado,
  enviando,
  ensayando,
  ensayoHecho,
  informe,
  motivoEnsayar,
  motivoDelEnsayo,
  motivoConfirmar,
  numero,
  onNumero,
  onEnsayar,
  onConfirmar,
}: {
  comunicacion: ComComunicacionRow;
  resumen: ResumenDestinatarios;
  ajustes: ComAjustesRow;
  usuarioEmail: string;
  pasarela: NombrePasarela;
  lineas: string[];
  hecho: boolean;
  bloqueado: boolean;
  puedeEscribir: boolean;
  ocupado: boolean;
  enviando: boolean;
  ensayando: boolean;
  ensayoHecho: boolean;
  informe: InformeDeEnsayo | null;
  motivoEnsayar: string | null;
  motivoDelEnsayo: string | null;
  motivoConfirmar: string | null;
  numero: string;
  onNumero: (v: string) => void;
  onEnsayar: () => void;
  onConfirmar: () => void;
}) {
  if (hecho) {
    return (
      <PasoCard
        numero={3}
        titulo="Confirmada"
        estado="hecho"
        resumen={`${comunicacion.confirmada_por_email ?? usuarioEmail}${comunicacion.confirmada_at ? ` · ${fmtFechaHora(comunicacion.confirmada_at)}` : ""}`}
      />
    );
  }
  if (bloqueado) {
    return <PasoCard numero={3} titulo="Ensayo general y confirmación" estado="pendiente" resumen="Antes hay que dar por buena la prueba." />;
  }

  const ensayo = comunicacion.ensayo_resumen;
  const numeroEscrito = numero.trim() !== "";

  return (
    <PasoCard numero={3} titulo="Ensayo general y confirmación" estado="actual">
      <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-[auto_1fr]">
        <dt className="text-text-muted">Correos</dt>
        <dd>
          <strong>{fmtInt(resumen.aEnviar)}</strong>, uno por cuenta, a {cuantos(resumen.direcciones, "dirección", "direcciones")} (
          {cuantos(resumen.direccionesExternas, "externa", "externas")})
        </dd>
        <dt className="text-text-muted">Plantilla</dt>
        <dd>{comunicacion.plantilla_nombre}</dd>
        <dt className="text-text-muted">Remitente</dt>
        <dd>{comunicacion.remitente_email}</dd>
        <dt className="text-text-muted">Modo</dt>
        <dd className="flex flex-wrap items-center gap-1.5">
          <ChipModo modo={ajustes.modo} />
          <ChipPasarela pasarela={pasarela} />
          <span className="text-text-muted">
            {ajustes.modo === "pruebas"
              ? `${resumen.aEnviar === 1 ? "el correo te llega" : `los ${fmtInt(resumen.aEnviar)} correos te llegan`} a ti (${usuarioEmail}), no a los destinatarios`
              : "los correos van a las direcciones de la lista"}
            {pasarela === "simulada" ? " · no saldrá ningún correo" : ""}
          </span>
        </dd>
      </dl>

      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wider text-text-muted">A quién, uno por uno</p>
        <ul className="max-h-56 divide-y divide-subtle/60 overflow-auto rounded-md border border-subtle text-sm">
          {lineas.map((l) => (
            <li key={l} className="px-3 py-1.5">
              {l}
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2 border-t border-subtle pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-sm font-semibold text-text-primary">Ensayo general</h4>
          <Ayuda>
            Antes de confirmar, el portal monta todos los correos —con los datos de cada cuenta, sus enlaces y sus
            adjuntos—, los valida uno a uno y los pasa por el candado, sin enviar ninguno. De cada uno guarda una
            huella: lo que después se envíe tiene que ser exactamente lo ensayado, o no sale. El ensayo vale 30
            minutos.
          </Ayuda>
          {puedeEscribir ? (
            <Boton
              variante={ensayoHecho ? "secundario" : "primario"}
              disabled={ocupado || enviando || motivoEnsayar !== null}
              cargando={ensayando}
              onClick={onEnsayar}
              className="ml-auto"
            >
              {ensayando ? "Montando y validando…" : ensayoHecho ? "Repetir el ensayo" : "Hacer el ensayo general"}
            </Boton>
          ) : null}
        </div>
        {puedeEscribir && motivoEnsayar ? <p className="text-xs text-text-muted">{motivoEnsayar}</p> : null}

        {informe && informe.problemas.length > 0 ? (
          <Aviso tipo="error" titulo={`El ensayo ha encontrado ${cuantos(informe.problemas.length, "problema", "problemas")}. No se puede enviar hasta resolverlos.`}>
            <ul className="max-h-56 list-disc overflow-auto pl-5">
              {informe.problemas.map((p, i) => (
                <li key={`${p.cuenta}-${i}`}>
                  {p.cuenta}: {p.problema}
                </li>
              ))}
            </ul>
          </Aviso>
        ) : null}

        {ensayoHecho && ensayo ? (
          <Aviso tipo="ok" titulo={`Ensayado el ${fmtFechaHora(comunicacion.ensayo_at)} por ${comunicacion.ensayo_por_email}`}>
            <p>
              <strong>{cuantos(ensayo.correos, "correo correcto", "correos correctos")}</strong>
              {ensayo.omitidos > 0 ? `, ${cuantos(ensayo.omitidos, "omitido", "omitidos")} por dirección repetida` : ""} ·{" "}
              {cuantos(ensayo.enlaces, "enlace rastreado", "enlaces rastreados")} ·{" "}
              {ensayo.adjuntos.length > 0 ? `adjuntos: ${ensayo.adjuntos.join(", ")}` : "sin adjuntos"} ·{" "}
              {ensayo.imagen === "logo" ? "logotipo al pie (la plantilla no trae imágenes)" : "imagen de apertura invisible"}
            </p>
            <p className="mt-1.5 font-medium">Direcciones exactas que recibirían algo:</p>
            <ListaDeDirecciones direcciones={ensayo.direcciones} />
          </Aviso>
        ) : null}
        {ensayoHecho && ensayo && ensayo.conCamposVacios.length > 0 ? (
          <Aviso tipo="aviso" titulo={`${cuantos(ensayo.conCamposVacios.length, "cuenta tiene", "cuentas tienen")} vacío algún campo de la plantilla; ese hueco saldría en blanco`}>
            <ul className="max-h-40 list-disc overflow-auto pl-5">
              {ensayo.conCamposVacios.map((c) => (
                <li key={c.cuenta}>
                  {c.cuenta}: {c.campos.join(", ")}
                </li>
              ))}
            </ul>
          </Aviso>
        ) : null}
        {!ensayoHecho && motivoEnsayar === null && motivoDelEnsayo ? <p className="text-xs text-text-muted">{motivoDelEnsayo}</p> : null}
      </div>

      {puedeEscribir && ensayoHecho ? (
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-icam-900/20 bg-icam-900/[0.03] p-3">
          <div className="w-44">
            <Campo etiqueta="Escribe el número de correos que van a salir">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={numero}
                onChange={(e) => onNumero(e.target.value)}
                className={claseCampo}
              />
            </Campo>
          </div>
          <Boton variante="primario" disabled={ocupado || enviando || motivoConfirmar !== null} onClick={onConfirmar}>
            Enviar {cuantos(resumen.aEnviar, "correo", "correos")}
          </Boton>
          {motivoConfirmar && numeroEscrito ? <span className="basis-full text-xs text-text-muted">{motivoConfirmar}</span> : null}
        </div>
      ) : null}

      <Desplegable titulo="Qué comprueba el portal antes de que salga cada correo">
        <p>
          Ningún campo combinado sin resolver ni resto de <code>{"${…}"}</code>; asunto y cuerpo dentro de tamaño;
          tantos enlaces rastreados como tenía la plantilla y una sola imagen de apertura; el identificador de
          seguimiento es el de ese destinatario y el registro de Zoho el de su cuenta; el remitente es uno que Zoho
          acepta; y, al final, el candado de destinatarios.
        </p>
        <p>
          Durante el envío, antes de cada correo se vuelven a leer el interruptor general, el estado, el modo y el
          tope diario; y tras cada tanda, donde Zoho lo expone, se compara a quién dice Zoho que mandó el correo.
        </p>
      </Desplegable>
    </PasoCard>
  );
}
