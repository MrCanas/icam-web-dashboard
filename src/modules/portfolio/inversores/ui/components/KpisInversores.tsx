"use client";

import { KPICard } from "@/components/ui/KPICard";
import { fmtEurosCompact, fmtInt, fmtMult, fmtPct } from "@/lib/formatters";
import type { CuentaInversion, KpisInversores as Kpis } from "@/modules/portfolio/inversores/types";
import type { AperturaCuentas } from "@/modules/portfolio/inversores/ui/drilldown/tipos";

interface Props {
  kpis: Kpis;
  cuentas: CuentaInversion[];
  onAbrir: (apertura: AperturaCuentas) => void;
}

/**
 * «Repartido» y «Pendiente» están ocultos a la espera de validación.
 *
 * Los dos son correctos según su definición, pero esa definición no es la que
 * se lee en la pantalla, y eso es un problema de la pantalla, no de quien la
 * mira: «Pendiente» es comprometido − aportado, capital firmado que aún no se
 * ha desembolsado, y NO capital pendiente de devolver al inversor. Puesto al
 * lado de «Repartido» se lee como lo segundo. Mientras no se acuerde la
 * redacción, es mejor no enseñarlos que enseñarlos mal.
 *
 * Para volver a mostrarlos, `true`. El cálculo sigue vivo y la tabla de abajo
 * sigue enseñando las dos columnas, que es donde se están validando.
 */
const MOSTRAR_REPARTOS = false;

/**
 * La fila de cifras de cabecera. Todas son pinchables.
 *
 * Regla del portal: un número sin referencia no es un KPI, así que el subtítulo
 * siempre lleva contraste o periodo. Y siendo botones, son además el camino de
 * teclado al detalle: las marcas SVG de las gráficas no se pueden tabular.
 */
export function KpisInversores({ kpis, cuentas, onAbrir }: Props) {
  const conAportes = cuentas.filter((c) => c.aportado > 0);
  const conRepartos = cuentas.filter((c) => c.repartido > 0);
  const conPendiente = cuentas.filter((c) => (c.comprometido ?? 0) > c.aportado);

  return (
    <div
      className={`grid grid-cols-2 gap-3 md:grid-cols-3 sm:gap-4 ${
        MOSTRAR_REPARTOS ? "xl:grid-cols-5" : ""
      }`}
    >
      <KPICard
        title="Comprometido"
        value={fmtEurosCompact(kpis.comprometido)}
        subtitle={`${fmtInt(kpis.numCuentas)} cuentas de inversión`}
        highlight
        actionLabel={`Ver las ${fmtInt(kpis.numCuentas)} cuentas de inversión`}
        onClick={() =>
          onAbrir({
            titulo: `${fmtInt(cuentas.length)} cuentas de inversión`,
            subtitulo: `Comprometido ${fmtEurosCompact(kpis.comprometido)}`,
            cuentas,
          })
        }
      />
      <KPICard
        title="Aportado"
        value={fmtEurosCompact(kpis.aportado)}
        subtitle={
          kpis.comprometido > 0
            ? `${fmtPct(kpis.aportado / kpis.comprometido)} de lo comprometido`
            : "Sin compromiso registrado"
        }
        actionLabel={`Ver las ${fmtInt(conAportes.length)} cuentas que han aportado`}
        onClick={() =>
          onAbrir({
            titulo: "Cuentas que han aportado",
            subtitulo: `${fmtEurosCompact(kpis.aportado)} en total`,
            cuentas: conAportes,
          })
        }
      />
      {MOSTRAR_REPARTOS ? (
        <>
          <KPICard
            title="Repartido"
            value={fmtEurosCompact(kpis.repartido)}
            subtitle={
              kpis.dpi === null ? "Sin aportaciones todavía" : `DPI ${fmtMult(kpis.dpi)}`
            }
            actionLabel={`Ver las ${fmtInt(conRepartos.length)} cuentas que han recibido repartos`}
            onClick={() =>
              onAbrir({
                titulo: "Cuentas con repartos",
                subtitulo: `${fmtEurosCompact(kpis.repartido)} devueltos`,
                cuentas: conRepartos,
              })
            }
          />
          <KPICard
            title="Pendiente"
            value={fmtEurosCompact(kpis.pendiente)}
            subtitle={`Por desembolsar en ${fmtInt(conPendiente.length)} cuentas`}
            actionLabel={`Ver las ${fmtInt(conPendiente.length)} cuentas con desembolso pendiente`}
            onClick={() =>
              onAbrir({
                titulo: "Cuentas con desembolso pendiente",
                subtitulo: `${fmtEurosCompact(kpis.pendiente)} sin desembolsar`,
                cuentas: conPendiente,
              })
            }
          />
        </>
      ) : null}
      <KPICard
        title="Inversores"
        value={fmtInt(kpis.numInversores)}
        subtitle={`En ${fmtInt(kpis.numCuentas)} cuentas y ${fmtInt(kpis.numPromociones)} promociones`}
        actionLabel="Ver las cuentas y sus contactos"
        onClick={() =>
          onAbrir({
            titulo: `${fmtInt(kpis.numInversores)} inversores`,
            subtitulo: "Entra en una cuenta para ver sus contactos y sus correos",
            cuentas,
          })
        }
      />
    </div>
  );
}
