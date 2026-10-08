"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Aviso } from "@/components/ui/Aviso";
import { Boton, BotonEnlace } from "@/components/ui/Boton";
import { Campo, claseCampo, claseCampoConError } from "@/components/ui/Campo";
import { Icono } from "@/components/ui/Icono";
import { Stepper } from "@/components/ui/Stepper";
import { fmtFechaHora, fmtInt } from "@/lib/formatters";
import {
  actualizarDatosZohoAction,
  prepararComunicacionAction,
} from "@/modules/comunicaciones/actions/comunicaciones";
import { ETIQUETA_PASO, PASOS } from "@/modules/comunicaciones/logic/asistente";
import { COMUNICACIONES_PATH } from "@/modules/comunicaciones/logic/paths";
import {
  AUDIENCIAS,
  ETIQUETA_AUDIENCIA,
  ETIQUETA_ROL,
  ETIQUETA_TIPO,
  ROLES_CONTACTO,
  TIPOS_COMUNICACION,
  type AudienciaElegible as Audiencia,
  type RecuentoAudiencias,
  type RolContacto,
  type TipoComunicacion,
} from "@/modules/comunicaciones/types";

import { ChipEntorno } from "./ChipEntorno";
import type { EntornoDeEnvio } from "./entorno";
import { BarraDeAcciones, ModoFoco, PasoDelAsistente } from "./marco";

const DESCRIPCION_AUDIENCIA: Record<Audiencia, string> = {
  promocion: "Las cuentas con suscripción a una promoción o un fondo.",
  toda_la_base: "Todas las cuentas de inversión.",
  inversores_directos: "Las cuentas sin intermediario.",
};

type Falta = "zoho" | "audiencia" | "promocion" | "tipo" | "roles";

const MENSAJE_FALTA: Record<Falta, string> = {
  zoho: "Actualiza los datos de Zoho para continuar.",
  audiencia: "Elige a quién va dirigida.",
  promocion: "Elige la promoción o el fondo.",
  tipo: "Elige el tipo de comunicación.",
  roles: "Elige al menos un papel de contacto para «Para».",
};

const ETIQUETA_GRUPO = "text-sm font-semibold text-text-primary";

/**
 * Paso 1 de una comunicación nueva: a quién va dirigida, de qué tipo es y qué
 * contactos de cada cuenta la reciben. «Continuar» calcula los destinatarios y
 * guarda el borrador; no envía nada. El servidor lo vuelve a comprobar todo,
 * también que los datos de Zoho sean de hoy.
 */
export function NuevaComunicacion({
  recuento,
  datosZohoAt,
  datosDeHoy,
  entorno,
}: {
  recuento: RecuentoAudiencias;
  datosZohoAt: string | null;
  /** Lo decide el servidor, con la fecha de Madrid: es el mismo corte que aplica al preparar. */
  datosDeHoy: boolean;
  entorno: EntornoDeEnvio;
}) {
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoComunicacion | "">("");
  const [audiencia, setAudiencia] = useState<Audiencia | "">("");
  const [promocion, setPromocion] = useState("");
  const [rolesPara, setRolesPara] = useState<RolContacto[]>(["principal"]);
  const [rolesCopia, setRolesCopia] = useState<RolContacto[]>([]);
  const [faltan, setFaltan] = useState<Falta[]>([]);
  const [aviso, setAviso] = useState<{ ok: boolean; mensaje: string } | null>(null);
  const [preparando, empezarPreparar] = useTransition();
  const [actualizando, empezarActualizar] = useTransition();

  const promocionElegida = recuento.promociones.find((p) => p.zohoId === promocion);
  const cuentas =
    audiencia === "toda_la_base"
      ? recuento.todaLaBase
      : audiencia === "inversores_directos"
        ? recuento.inversoresDirectos
        : audiencia === "promocion"
          ? (promocionElegida?.numCuentas ?? null)
          : null;

  const alternar = (lista: RolContacto[], rol: RolContacto) =>
    lista.includes(rol) ? lista.filter((r) => r !== rol) : [...lista, rol];

  /** Qué falta, en el orden de la pantalla. */
  const queFalta = (): Falta[] => {
    const lista: Falta[] = [];
    if (!datosDeHoy) lista.push("zoho");
    if (audiencia === "") lista.push("audiencia");
    else if (audiencia === "promocion" && promocion === "") lista.push("promocion");
    if (tipo === "") lista.push("tipo");
    if (rolesPara.length === 0) lista.push("roles");
    return lista;
  };
  const falta = (f: Falta) => faltan.includes(f);
  const quitar = (f: Falta) => setFaltan((lista) => lista.filter((x) => x !== f));

  const preparar = () => {
    const lista = queFalta();
    setFaltan(lista);
    setAviso(null);
    if (lista.length > 0) return;
    empezarPreparar(async () => {
      try {
        const r = await prepararComunicacionAction({
          tipo: tipo as TipoComunicacion,
          audiencia: audiencia as Audiencia,
          promocionZohoId: promocion || null,
          rolesPara,
          rolesCopia,
        });
        if (r.ok) router.push(`${r.path}?paso=destinatarios`);
        else setAviso({ ok: false, mensaje: r.mensaje });
      } catch (err) {
        setAviso({ ok: false, mensaje: err instanceof Error ? err.message : "No se pudo preparar la comunicación." });
      }
    });
  };

  const actualizar = () =>
    empezarActualizar(async () => {
      setAviso(null);
      const r = await actualizarDatosZohoAction();
      setAviso({ ok: r.ok, mensaje: r.mensaje });
      if (r.ok) {
        quitar("zoho");
        router.refresh();
      }
    });

  const resumenRoles = `${rolesPara.map((r) => ETIQUETA_ROL[r]).join(", ") || "nadie"} en Para${
    rolesCopia.length > 0 ? ` · ${rolesCopia.map((r) => ETIQUETA_ROL[r]).join(", ")} en copia` : ""
  }`;

  return (
    <ModoFoco
      titulo="Nueva comunicación"
      subtitulo="Sin guardar todavía"
      entorno={<ChipEntorno entorno={entorno} />}
      stepper={
        <Stepper
          variante="linea"
          etiqueta="Pasos del envío"
          pasos={PASOS.map((p) => ({ clave: p, etiqueta: ETIQUETA_PASO[p], estado: p === "audiencia" ? "actual" : "pendiente" }))}
        />
      }
    >
      <PasoDelAsistente
        ancho="normal"
        titulo="¿A quién va dirigida?"
        subtitulo="Elige la audiencia y el tipo de comunicación. En el siguiente paso verás la lista exacta de destinatarios antes de que salga nada."
        ayuda={
          <>
            Los destinatarios se calculan con la copia de Zoho del portal, que se actualiza cada día de madrugada. Para
            preparar hace falta la de hoy; actualizarla solo lee de Zoho y tarda alrededor de un minuto. Si la
            actualización queda «parcial», la fecha no cambia: vuelve a intentarlo o avisa.
          </>
        }
        pie={
          <BarraDeAcciones
            atras={
              <BotonEnlace href={COMUNICACIONES_PATH} variante="texto">
                Cancelar
              </BotonEnlace>
            }
            motivo={
              faltan.length > 0
                ? MENSAJE_FALTA[faltan[0]]
                : cuentas !== null
                  ? `Se calcularán los destinatarios de ${fmtInt(cuentas)} cuentas`
                  : null
            }
            principal={
              <Boton variante="primario" cargando={preparando} disabled={actualizando} onClick={preparar}>
                {preparando ? "Calculando destinatarios…" : "Continuar a Destinatarios"}
                {preparando ? null : <Icono nombre="chevron" className="h-3.5 w-3.5" />}
              </Boton>
            }
          />
        }
      >
        {/* Datos de Zoho: discreto si son de hoy; si no, es lo primero que hay que hacer. */}
        {datosDeHoy ? (
          <p className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
            <span className="inline-flex items-center gap-1 text-green-700">
              <Icono nombre="check" className="h-3.5 w-3.5" />
              Datos de Zoho de hoy
            </span>
            <span>· última copia {fmtFechaHora(datosZohoAt)}</span>
            <Boton variante="texto" pequeno cargando={actualizando} disabled={preparando} onClick={actualizar}>
              {actualizando ? "Actualizando… (≈1 min)" : "Actualizar"}
            </Boton>
          </p>
        ) : (
          <div
            className={`flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 ${falta("zoho") ? "border-red-300" : "border-amber-200"}`}
          >
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700">
              <Icono nombre="actualizar" className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-text-primary">Primero, actualiza los datos de Zoho</p>
              <p className="text-xs text-text-muted">
                {datosZohoAt ? `La última copia es del ${fmtFechaHora(datosZohoAt)}.` : "Todavía no hay ninguna copia correcta."} Hace
                falta la de hoy. Tarda alrededor de un minuto.
              </p>
            </div>
            <Boton variante="primario" cargando={actualizando} disabled={preparando} onClick={actualizar} icono={<Icono nombre="actualizar" />}>
              {actualizando ? "Actualizando…" : "Actualizar datos"}
            </Boton>
          </div>
        )}

        <fieldset className="space-y-3">
          <legend className={`${ETIQUETA_GRUPO} mb-2`}>Audiencia</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {AUDIENCIAS.map((a) => {
              const n = a === "toda_la_base" ? recuento.todaLaBase : a === "inversores_directos" ? recuento.inversoresDirectos : recuento.promociones.length;
              const activa = audiencia === a;
              return (
                <label
                  key={a}
                  className={`relative flex cursor-pointer flex-col gap-1 rounded-xl border bg-card p-4 shadow-sm transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-icam-900/40 ${
                    activa
                      ? "border-icam-900 ring-2 ring-icam-900/20"
                      : falta("audiencia")
                        ? "border-red-300"
                        : "border-subtle hover:border-icam-900/40 hover:shadow"
                  }`}
                >
                  <input
                    type="radio"
                    name="audiencia"
                    value={a}
                    checked={activa}
                    onChange={() => {
                      setAudiencia(a);
                      quitar("audiencia");
                    }}
                    className="sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={`absolute right-3 top-3 inline-flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                      activa ? "border-icam-900 bg-icam-900 text-white" : "border-subtle"
                    }`}
                  >
                    {activa ? <Icono nombre="check" className="h-3 w-3" /> : null}
                  </span>
                  <span className="pr-6 text-sm font-semibold text-text-primary">{ETIQUETA_AUDIENCIA[a]}</span>
                  <span className="text-3xl font-semibold tabular-nums text-text-primary">{fmtInt(n)}</span>
                  <span className="text-xs text-text-muted">
                    {a === "promocion" ? "promociones y fondos" : "cuentas"} · {DESCRIPCION_AUDIENCIA[a]}
                  </span>
                </label>
              );
            })}
          </div>

          {audiencia === "promocion" ? (
            <Campo etiqueta="¿Qué promoción o fondo?" error={falta("promocion") ? MENSAJE_FALTA.promocion : null}>
              <select
                value={promocion}
                onChange={(e) => {
                  setPromocion(e.target.value);
                  quitar("promocion");
                }}
                className={falta("promocion") ? claseCampoConError : claseCampo}
              >
                <option value="">Elige la promoción o el fondo…</option>
                {recuento.promociones.map((p) => (
                  <option key={p.zohoId} value={p.zohoId}>
                    {p.codigo ? `${p.codigo} · ` : ""}
                    {p.nombre} ({fmtInt(p.numCuentas)} cuentas)
                  </option>
                ))}
              </select>
            </Campo>
          ) : null}

          {audiencia === "inversores_directos" && recuento.sinDatoIntermediario > 0 ? (
            <Aviso tipo="aviso">
              {fmtInt(recuento.sinDatoIntermediario)} cuentas no tienen todavía el dato «Tiene intermediario» y no entran
              en esta audiencia. Actualiza los datos de Zoho.
            </Aviso>
          ) : null}
        </fieldset>

        <fieldset>
          <legend className={`${ETIQUETA_GRUPO} mb-2`}>Tipo de comunicación</legend>
          <div className="flex flex-wrap gap-2">
            {TIPOS_COMUNICACION.map((t) => {
              const activo = tipo === t;
              return (
                <label
                  key={t}
                  className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-sm transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-icam-900/40 ${
                    activo
                      ? "border-icam-900 bg-icam-900 text-white"
                      : falta("tipo")
                        ? "border-red-300 bg-card text-text-body"
                        : "border-subtle bg-card text-text-body hover:border-icam-900/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="tipo"
                    value={t}
                    checked={activo}
                    onChange={() => {
                      setTipo(t);
                      quitar("tipo");
                    }}
                    className="sr-only"
                  />
                  {ETIQUETA_TIPO[t]}
                </label>
              );
            })}
          </div>
          {falta("tipo") ? <p className="mt-1.5 text-xs text-red-700">{MENSAJE_FALTA.tipo}</p> : null}
        </fieldset>

        <details className={`group rounded-xl border bg-card ${falta("roles") ? "border-red-300" : "border-subtle"}`} open={falta("roles") || undefined}>
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm marker:content-none [&::-webkit-details-marker]:hidden">
            <Icono nombre="chevron" className="h-3.5 w-3.5 text-text-muted transition group-open:rotate-90" />
            <span className="font-semibold text-text-primary">Quién de cada cuenta lo recibe</span>
            <span className="min-w-0 truncate text-text-muted">· {resumenRoles}</span>
          </summary>
          <div className="space-y-2 border-t border-subtle/60 px-4 py-3">
            <p className="text-xs text-text-muted">
              Sale un correo por cuenta, no uno por persona. Quien tiene un papel marcado en «Para» recibe el correo;
              quien lo tiene en copia, va en copia. Nadie va a la vez en los dos.
            </p>
            <div className="overflow-auto rounded-md border border-subtle">
              <table className="w-full text-sm">
                <thead className="bg-subtle/30">
                  <tr className="text-left">
                    <th scope="col" className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-icam-900">Papel en la cuenta</th>
                    <th scope="col" className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-icam-900">Para</th>
                    <th scope="col" className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-icam-900">Copia</th>
                  </tr>
                </thead>
                <tbody>
                  {ROLES_CONTACTO.map((rol) => (
                    <tr key={rol} className="border-t border-subtle/60">
                      <th scope="row" className="px-3 py-1.5 text-left font-normal text-text-body">
                        {ETIQUETA_ROL[rol]}
                      </th>
                      <td className="px-3 py-1.5 text-center">
                        <input
                          type="checkbox"
                          aria-label={`${ETIQUETA_ROL[rol]} en Para`}
                          checked={rolesPara.includes(rol)}
                          onChange={() => {
                            setRolesPara(alternar(rolesPara, rol));
                            // Nadie va a la vez en «Para» y en copia.
                            setRolesCopia(rolesCopia.filter((r) => r !== rol));
                            quitar("roles");
                          }}
                          className="accent-icam-900"
                        />
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <input
                          type="checkbox"
                          aria-label={`${ETIQUETA_ROL[rol]} en copia`}
                          checked={rolesCopia.includes(rol)}
                          disabled={rolesPara.includes(rol)}
                          onChange={() => setRolesCopia(alternar(rolesCopia, rol))}
                          className="accent-icam-900"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {falta("roles") ? <p className="text-xs text-red-700">{MENSAJE_FALTA.roles}</p> : null}
          </div>
        </details>

        {aviso ? <Aviso tipo={aviso.ok ? "ok" : "error"}>{aviso.mensaje}</Aviso> : null}
      </PasoDelAsistente>
    </ModoFoco>
  );
}
