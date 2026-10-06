"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

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
  type Audiencia,
  type RecuentoAudiencias,
  type RolContacto,
  type TipoComunicacion,
} from "@/modules/comunicaciones/types";

interface Props {
  recuento: RecuentoAudiencias;
  datosZohoAt: string | null;
}

const DESCRIPCION_AUDIENCIA: Record<Audiencia, string> = {
  promocion: "Las cuentas con suscripción a una promoción o un fondo.",
  toda_la_base: "Todas las cuentas de inversión.",
  inversores_directos: "Las cuentas sin intermediario.",
};

/** ¿La fecha es de hoy en la zona horaria del navegador? Solo decide un aviso; el corte está en el servidor. */
function esDeHoy(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso).toDateString() === new Date().toDateString();
}

const CAMPO = "block w-full rounded-md border border-subtle bg-card px-3 py-2 text-sm text-text-body";
const LEYENDA = "text-sm font-medium text-text-primary";

export function NuevaForm({ recuento, datosZohoAt }: Props) {
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoComunicacion | "">("");
  const [audiencia, setAudiencia] = useState<Audiencia | "">("");
  const [promocion, setPromocion] = useState("");
  const [rolesPara, setRolesPara] = useState<RolContacto[]>(["principal"]);
  const [rolesCopia, setRolesCopia] = useState<RolContacto[]>([]);
  const [aviso, setAviso] = useState<{ ok: boolean; mensaje: string } | null>(null);
  const [preparando, empezarPreparar] = useTransition();
  const [actualizando, empezarActualizar] = useTransition();

  const datosDeHoy = esDeHoy(datosZohoAt);
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

  const listo =
    tipo !== "" &&
    audiencia !== "" &&
    (audiencia !== "promocion" || promocion !== "") &&
    rolesPara.length > 0 &&
    datosDeHoy;

  return (
    <form
      className="space-y-5 rounded-lg border border-subtle/50 bg-card p-4 sm:p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!listo) return;
        empezarPreparar(async () => {
          setAviso(null);
          const r = await prepararComunicacionAction({
            tipo,
            audiencia,
            promocionZohoId: promocion || null,
            rolesPara,
            rolesCopia,
          });
          if (r.ok) router.push(r.path);
          else setAviso({ ok: false, mensaje: r.mensaje });
        });
      }}
    >
      <section className="space-y-2">
        <h2 className={LEYENDA}>Datos de Zoho</h2>
        <p className="text-sm text-text-body">
          {datosZohoAt
            ? `Última copia correcta: ${fmtFechaHora(datosZohoAt)}.`
            : "Todavía no hay ninguna copia correcta de Zoho."}{" "}
          {datosDeHoy ? null : (
            <strong className="text-[#9B3B3B]">No son de hoy: actualízalos antes de preparar.</strong>
          )}
        </p>
        <button
          type="button"
          disabled={actualizando || preparando}
          onClick={() =>
            empezarActualizar(async () => {
              setAviso(null);
              const r = await actualizarDatosZohoAction();
              setAviso({ ok: r.ok, mensaje: r.mensaje });
              if (r.ok) router.refresh();
            })
          }
          className="min-h-9 rounded-md border border-subtle px-3 py-1.5 text-sm text-text-body hover:border-icam-900 disabled:opacity-60"
        >
          {actualizando ? "Actualizando… (puede tardar un minuto)" : "Actualizar datos de Zoho"}
        </button>
      </section>

      <section className="space-y-2">
        <label htmlFor="com-tipo" className={LEYENDA}>
          Tipo de comunicación
        </label>
        <select
          id="com-tipo"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoComunicacion | "")}
          className={CAMPO}
        >
          <option value="">Elige…</option>
          {TIPOS_COMUNICACION.map((t) => (
            <option key={t} value={t}>
              {ETIQUETA_TIPO[t]}
            </option>
          ))}
        </select>
      </section>

      <fieldset className="space-y-2">
        <legend className={LEYENDA}>A quién va dirigida</legend>
        {AUDIENCIAS.map((a) => (
          <label key={a} className="flex cursor-pointer items-start gap-2 text-sm text-text-body">
            <input
              type="radio"
              name="audiencia"
              value={a}
              checked={audiencia === a}
              onChange={() => setAudiencia(a)}
              className="mt-1"
            />
            <span>
              <span className="font-medium text-text-primary">{ETIQUETA_AUDIENCIA[a]}</span>
              {a === "toda_la_base" ? ` · ${fmtInt(recuento.todaLaBase)} cuentas` : null}
              {a === "inversores_directos" ? ` · ${fmtInt(recuento.inversoresDirectos)} cuentas` : null}
              <span className="block text-text-muted">{DESCRIPCION_AUDIENCIA[a]}</span>
            </span>
          </label>
        ))}

        {audiencia === "promocion" ? (
          <select
            aria-label="Promoción o fondo"
            value={promocion}
            onChange={(e) => setPromocion(e.target.value)}
            className={CAMPO}
          >
            <option value="">Elige la promoción o el fondo…</option>
            {recuento.promociones.map((p) => (
              <option key={p.zohoId} value={p.zohoId}>
                {p.codigo ? `${p.codigo} · ` : ""}
                {p.nombre} ({fmtInt(p.numCuentas)} cuentas)
              </option>
            ))}
          </select>
        ) : null}

        {audiencia === "inversores_directos" && recuento.sinDatoIntermediario > 0 ? (
          <p className="text-sm text-[#9B3B3B]">
            {fmtInt(recuento.sinDatoIntermediario)} cuentas no tienen todavía el dato «Tiene
            intermediario» y no entran en esta audiencia. Actualiza los datos de Zoho.
          </p>
        ) : null}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className={LEYENDA}>Qué contactos de cada cuenta lo reciben</legend>
        <div className="overflow-auto">
          <table className="text-sm text-text-body">
            <thead>
              <tr className="text-left text-text-muted">
                <th scope="col" className="py-1 pr-6 font-medium">Papel en la cuenta</th>
                <th scope="col" className="py-1 pr-6 font-medium">Para</th>
                <th scope="col" className="py-1 font-medium">Copia</th>
              </tr>
            </thead>
            <tbody>
              {ROLES_CONTACTO.map((rol) => (
                <tr key={rol}>
                  <th scope="row" className="py-1 pr-6 text-left font-normal">
                    {ETIQUETA_ROL[rol]}
                  </th>
                  <td className="py-1 pr-6">
                    <input
                      type="checkbox"
                      aria-label={`${ETIQUETA_ROL[rol]} en Para`}
                      checked={rolesPara.includes(rol)}
                      onChange={() => {
                        setRolesPara(alternar(rolesPara, rol));
                        // Nadie va a la vez en «Para» y en copia.
                        setRolesCopia(rolesCopia.filter((r) => r !== rol));
                      }}
                    />
                  </td>
                  <td className="py-1">
                    <input
                      type="checkbox"
                      aria-label={`${ETIQUETA_ROL[rol]} en copia`}
                      checked={rolesCopia.includes(rol)}
                      disabled={rolesPara.includes(rol)}
                      onChange={() => setRolesCopia(alternar(rolesCopia, rol))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </fieldset>

      <div className="space-y-2 border-t border-subtle pt-4">
        <p className="text-sm text-text-body">
          {cuentas === null
            ? "Elige una audiencia para ver cuántas cuentas tiene."
            : `Se calcularán los destinatarios de ${fmtInt(cuentas)} cuentas. En el siguiente paso los ves uno a uno y puedes excluir los que no deban recibirlo.`}
        </p>
        <button
          type="submit"
          disabled={!listo || preparando || actualizando}
          className="min-h-9 rounded-md bg-icam-900 px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {preparando ? "Preparando…" : "Preparar y revisar destinatarios"}
        </button>
        {aviso ? (
          <p role="status" className={`text-sm ${aviso.ok ? "text-text-muted" : "text-[#9B3B3B]"}`}>
            {aviso.mensaje}
          </p>
        ) : null}
      </div>
    </form>
  );
}
