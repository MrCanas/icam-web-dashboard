"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Aviso } from "@/components/ui/Aviso";
import { Ayuda } from "@/components/ui/Ayuda";
import { Boton } from "@/components/ui/Boton";
import { Campo, claseCampo, claseCampoConError } from "@/components/ui/Campo";
import { Chip } from "@/components/ui/Chip";
import { Icono } from "@/components/ui/Icono";
import { Tarjeta } from "@/components/ui/Tarjeta";
import { fmtFechaHora, fmtInt } from "@/lib/formatters";
import {
  actualizarDatosZohoAction,
  prepararComunicacionAction,
} from "@/modules/comunicaciones/actions/comunicaciones";
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

interface Props {
  recuento: RecuentoAudiencias;
  datosZohoAt: string | null;
  /** Lo decide el servidor, con la fecha de Madrid: es el mismo corte que aplica al preparar. */
  datosDeHoy: boolean;
}

const DESCRIPCION_AUDIENCIA: Record<Audiencia, string> = {
  promocion: "Las cuentas con suscripción a una promoción o un fondo.",
  toda_la_base: "Todas las cuentas de inversión.",
  inversores_directos: "Las cuentas sin intermediario.",
};

const SECCION = "text-xs font-medium uppercase tracking-wider text-text-muted";

type Falta = "zoho" | "tipo" | "audiencia" | "promocion" | "roles";

const MENSAJE_FALTA: Record<Falta, string> = {
  zoho: "Los datos de Zoho no son de hoy: pulsa «Actualizar datos de Zoho».",
  tipo: "Elige el tipo de comunicación.",
  audiencia: "Elige a quién va dirigida.",
  promocion: "Elige la promoción o el fondo.",
  roles: "Elige al menos un papel de contacto para «Para».",
};

/**
 * Preparar una comunicación: tipo, audiencia y papeles. Preparar no envía nada.
 *
 * El botón siempre se puede pulsar: si falta algo, se marca el campo y se dice
 * qué falta junto al botón. El servidor lo vuelve a comprobar todo.
 */
export function NuevaForm({ recuento, datosZohoAt, datosDeHoy }: Props) {
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

  /** Qué falta para preparar, en el orden de la pantalla. */
  const queFalta = (): Falta[] => {
    const lista: Falta[] = [];
    if (!datosDeHoy) lista.push("zoho");
    if (tipo === "") lista.push("tipo");
    if (audiencia === "") lista.push("audiencia");
    else if (audiencia === "promocion" && promocion === "") lista.push("promocion");
    if (rolesPara.length === 0) lista.push("roles");
    return lista;
  };
  const falta = (f: Falta) => faltan.includes(f);
  // Al corregir un campo, su aviso desaparece.
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
        if (r.ok) router.push(r.path);
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

  return (
    <Tarjeta className="max-w-3xl">
      <form
        className="space-y-6"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          preparar();
        }}
      >
        <section className="space-y-2">
          <h2 className={SECCION}>1 · Datos de Zoho</h2>
          <div className="flex flex-wrap items-center gap-2">
            {datosDeHoy ? (
              <Chip tono="ok" punto>
                Datos de hoy
              </Chip>
            ) : (
              <Chip tono="error" punto>
                {datosZohoAt ? "No son de hoy" : "Sin copia correcta"}
              </Chip>
            )}
            <span className="text-sm text-text-muted">{datosZohoAt ? `Última copia correcta: ${fmtFechaHora(datosZohoAt)}` : "Todavía no hay ninguna copia correcta de Zoho."}</span>
            <Ayuda>
              Los destinatarios se calculan con la copia de Zoho del portal, que se actualiza cada día de madrugada.
              Para preparar hace falta la de hoy; actualizarla solo lee de Zoho y tarda alrededor de un minuto. Si la
              actualización queda «parcial», la fecha no cambia: vuelve a intentarlo o avisa.
            </Ayuda>
            <Boton
              variante={datosDeHoy ? "secundario" : "primario"}
              pequeno
              icono={<Icono nombre="actualizar" />}
              cargando={actualizando}
              disabled={preparando}
              onClick={actualizar}
              className="ml-auto"
            >
              {actualizando ? "Actualizando… (alrededor de un minuto)" : "Actualizar datos de Zoho"}
            </Boton>
          </div>
          {falta("zoho") ? <p className="text-xs text-red-700">{MENSAJE_FALTA.zoho}</p> : null}
        </section>

        <section className="space-y-2">
          <h2 className={SECCION}>2 · Tipo de comunicación</h2>
          <Campo etiqueta="Tipo" error={falta("tipo") ? MENSAJE_FALTA.tipo : null}>
            <select
              value={tipo}
              onChange={(e) => {
                setTipo(e.target.value as TipoComunicacion | "");
                quitar("tipo");
              }}
              className={falta("tipo") ? claseCampoConError : claseCampo}
            >
              <option value="">Elige…</option>
              {TIPOS_COMUNICACION.map((t) => (
                <option key={t} value={t}>
                  {ETIQUETA_TIPO[t]}
                </option>
              ))}
            </select>
          </Campo>
        </section>

        <fieldset className="space-y-2">
          <legend className={SECCION}>3 · A quién va dirigida</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {AUDIENCIAS.map((a) => {
              const n = a === "toda_la_base" ? recuento.todaLaBase : a === "inversores_directos" ? recuento.inversoresDirectos : recuento.promociones.length;
              const activa = audiencia === a;
              return (
                <label
                  key={a}
                  className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-3 transition ${
                    activa ? "border-icam-900 bg-icam-900/[0.04] ring-1 ring-icam-900/30" : falta("audiencia") ? "border-red-300" : "border-subtle hover:border-icam-900/40"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="audiencia"
                      value={a}
                      checked={activa}
                      onChange={() => {
                        setAudiencia(a);
                        quitar("audiencia");
                      }}
                      className="accent-icam-900"
                    />
                    <span className="text-sm font-medium text-text-primary">{ETIQUETA_AUDIENCIA[a]}</span>
                  </span>
                  <span className="text-2xl font-semibold tabular-nums text-text-primary">{fmtInt(n)}</span>
                  <span className="text-xs text-text-muted">
                    {a === "promocion" ? "promociones y fondos con cuentas" : "cuentas"} · {DESCRIPCION_AUDIENCIA[a]}
                  </span>
                </label>
              );
            })}
          </div>
          {falta("audiencia") ? <p className="text-xs text-red-700">{MENSAJE_FALTA.audiencia}</p> : null}

          {audiencia === "promocion" ? (
            <Campo etiqueta="Promoción o fondo" error={falta("promocion") ? MENSAJE_FALTA.promocion : null}>
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

        <fieldset className="space-y-2">
          <legend className={`${SECCION} inline-flex items-center gap-1.5`}>
            4 · Qué contactos de cada cuenta lo reciben
            <Ayuda>
              Sale un correo por cuenta, no uno por persona. Quien tiene un papel marcado en «Para» recibe el correo;
              quien lo tiene en copia, va en copia. Nadie va a la vez en los dos.
            </Ayuda>
          </legend>
          <div className={`overflow-auto rounded-md border ${falta("roles") ? "border-red-300" : "border-subtle"}`}>
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
        </fieldset>

        <div className="flex flex-wrap items-center gap-3 border-t border-subtle pt-4">
          <Boton type="submit" variante="primario" cargando={preparando} disabled={actualizando} icono={<Icono nombre="enviar" />}>
            {preparando ? "Calculando destinatarios…" : "Preparar y revisar destinatarios"}
          </Boton>
          <span className="text-sm text-text-muted">
            {cuentas === null
              ? "Preparar no envía nada: calcula a quién iría y después revisas la lista."
              : `Se calcularán los destinatarios de ${fmtInt(cuentas)} cuentas. Preparar no envía nada.`}
          </span>
          {faltan.length > 0 ? (
            <Aviso tipo="error" titulo="Falta algo antes de preparar" className="basis-full">
              <ul className="list-disc pl-5">
                {faltan.map((f) => (
                  <li key={f}>{MENSAJE_FALTA[f]}</li>
                ))}
              </ul>
            </Aviso>
          ) : null}
          {aviso ? (
            <Aviso tipo={aviso.ok ? "ok" : "error"} className="basis-full">
              {aviso.mensaje}
            </Aviso>
          ) : null}
        </div>
      </form>
    </Tarjeta>
  );
}
