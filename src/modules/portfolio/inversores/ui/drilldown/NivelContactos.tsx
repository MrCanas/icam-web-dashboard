"use client";

import { useState } from "react";

import { fmtEurosCompact, fmtFechaCorta } from "@/lib/formatters";
import type { CuentaInversion } from "@/modules/portfolio/inversores/types";

function euros(valor: number | null): string {
  return valor === null || !Number.isFinite(valor) ? "—" : fmtEurosCompact(valor);
}

/**
 * Nivel 2: la ficha de una cuenta, con sus contactos y sus correos.
 *
 * Es el destino del recorrido y lo que de verdad se venía a buscar, así que el
 * correo no es solo texto: enlaza a `mailto:` y hay un botón para copiarlos
 * todos de golpe, que es lo que hace quien abre esta lista para escribirles.
 */
export function NivelContactos({ cuenta }: { cuenta: CuentaInversion }) {
  const [copiado, setCopiado] = useState(false);
  const correos = cuenta.contactos
    .map((c) => c.email)
    .filter((email): email is string => !!email);

  async function copiarCorreos() {
    try {
      await navigator.clipboard.writeText(correos.join("; "));
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso de portapapeles no hay nada que hacer, y los correos siguen
      // visibles y seleccionables en la tabla.
    }
  }

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { t: "Comprometido", v: euros(cuenta.comprometido) },
          { t: "Aportado", v: euros(cuenta.aportado) },
          { t: "Repartido", v: euros(cuenta.repartido) },
          { t: "Sigue puesto", v: euros(cuenta.neto) },
        ].map((dato) => (
          <div key={dato.t} className="rounded-lg border border-subtle/50 px-3 py-2">
            <dt className="text-xs uppercase tracking-wider text-text-muted">{dato.t}</dt>
            <dd className="mt-0.5 text-base font-semibold tabular-nums text-icam-900">{dato.v}</dd>
          </div>
        ))}
      </dl>

      <section>
        <header className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-text-primary">
            Contactos{cuenta.estado ? ` · ${cuenta.estado}` : ""}
            {cuenta.fechaAlta ? ` · alta ${fmtFechaCorta(cuenta.fechaAlta)}` : ""}
          </h3>
          {correos.length > 0 ? (
            <button
              type="button"
              onClick={copiarCorreos}
              className="min-h-9 rounded-md border border-subtle px-3 py-1.5 text-xs text-text-body hover:border-icam-900"
            >
              {copiado ? "Copiados ✓" : `Copiar los ${correos.length} correos`}
            </button>
          ) : null}
        </header>

        {cuenta.contactos.length === 0 ? (
          <p className="text-sm text-text-muted">
            Esta cuenta no tiene contactos vinculados en Zoho.
          </p>
        ) : (
          <div className="overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[520px] text-sm">
              <caption className="sr-only">Contactos de {cuenta.nombre} con su correo.</caption>
              <thead>
                <tr className="border-b border-subtle text-left text-text-muted">
                  <th scope="col" className="py-2 pr-3">Nombre</th>
                  <th scope="col" className="py-2 pr-3">Correo</th>
                  <th scope="col" className="py-2">Rol</th>
                </tr>
              </thead>
              <tbody>
                {cuenta.contactos.map((contacto) => (
                  <tr
                    key={contacto.zohoId}
                    className="border-b border-subtle/60 text-text-body last:border-b-0"
                  >
                    <td className="py-2 pr-3 font-medium text-icam-900">{contacto.nombre}</td>
                    <td className="py-2 pr-3">
                      {contacto.email ? (
                        <a
                          href={`mailto:${contacto.email}`}
                          className="text-icam-900 underline underline-offset-2"
                        >
                          {contacto.email}
                        </a>
                      ) : (
                        <span className="text-text-muted">sin correo en Zoho</span>
                      )}
                    </td>
                    <td className="py-2">{contacto.rol ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {cuenta.promociones.length > 0 ? (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-text-primary">Promociones</h3>
          <div className="overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[520px] text-sm">
              <caption className="sr-only">
                Promociones en las que participa {cuenta.nombre}.
              </caption>
              <thead>
                <tr className="border-b border-subtle text-left text-text-muted">
                  <th scope="col" className="py-2 pr-3">Promoción</th>
                  {/* El estado en el embudo comercial. Está aquí a propósito:
                      los totales cuentan todas las suscripciones, incluidas las
                      que solo van por «Dossier + NDA», y sin esta columna no
                      habría forma de saberlo desde la pantalla. */}
                  <th scope="col" className="py-2 pr-3">Estado</th>
                  <th scope="col" className="py-2 pr-3">Situación</th>
                  <th scope="col" className="py-2 pr-3 text-right">Comprometido</th>
                  <th scope="col" className="py-2 pr-3 text-right">Aportado</th>
                  <th scope="col" className="py-2 text-right">Repartido</th>
                </tr>
              </thead>
              <tbody>
                {cuenta.promociones.map((promocion) => (
                  <tr
                    key={promocion.zohoId}
                    className="border-b border-subtle/60 text-text-body last:border-b-0"
                  >
                    <td className="py-2 pr-3 font-medium text-icam-900">{promocion.nombre}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{promocion.status ?? "—"}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{promocion.situacion ?? "—"}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {euros(promocion.comprometido)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{euros(promocion.aportado)}</td>
                    <td className="py-2 text-right tabular-nums">{euros(promocion.repartido)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
