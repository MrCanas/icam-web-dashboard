import { KPICard } from "@/components/ui/KPICard";
import { fmtEurosCompact, fmtIntOrDash, fmtPctOrDash, fmtPctSigned } from "@/lib/formatters";
import type { KpisCorp } from "@/modules/corporativo/logic/calculations";
import type { Sociedad } from "@/modules/corporativo/types";

interface KpisCorporativosProps {
  kpis: KpisCorp;
  sociedad: Sociedad;
}

/**
 * Los cinco números de cabecera, siempre sobre el último trimestre CERRADO.
 *
 * Ninguno mira la previsión: la foto de arriba tiene que ser lo que ya ha
 * pasado, y el plan del año se lee en las gráficas, donde va marcado como tal.
 * El subtítulo de cada tarjeta lleva el periodo o el contraste que da sentido a
 * la cifra; un número sin referencia no es un KPI.
 */
export function KpisCorporativos({ kpis, sociedad }: KpisCorporativosProps) {
  const periodo = kpis.periodo ?? "sin datos";
  // GIIC no gestiona capital de terceros: su AUM está vacío por definición, no
  // por un fallo de carga, y la tarjeta lo dice en vez de enseñar un guion mudo.
  const gestionaCapital = kpis.capitalBajoGestion !== null;

  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-3 sm:gap-4 xl:grid-cols-5">
      <KPICard
        title="Facturación YTD"
        value={fmtEurosCompact(kpis.facturacionYtd)}
        subtitle={
          kpis.varInteranualPct !== null
            ? `${periodo} · ${fmtPctSigned(kpis.varInteranualPct)} interanual`
            : `Acumulado ${kpis.anio ?? ""} a ${periodo}`
        }
      />
      <KPICard
        title="EBITDA YTD"
        value={fmtEurosCompact(kpis.ebitdaYtd)}
        subtitle={`Margen acumulado: ${fmtPctOrDash(kpis.margenYtdPct)}`}
      />
      <KPICard
        title="Margen EBITDA"
        value={fmtPctOrDash(kpis.margenTrimestrePct)}
        subtitle={`${periodo} · últimos 4T: ${fmtPctOrDash(kpis.margen4tPct)}`}
      />
      <KPICard
        title="Capital bajo gestión"
        value={gestionaCapital ? fmtEurosCompact(kpis.capitalBajoGestion) : "—"}
        subtitle={
          gestionaCapital
            ? `${fmtIntOrDash(kpis.vehiculos)} vehículos · fee ${fmtPctOrDash(kpis.feeSobreAumPct)}`
            : `${sociedad} no gestiona capital de terceros`
        }
      />
      <KPICard
        title="Saldo de caja"
        value={fmtEurosCompact(kpis.saldoCaja)}
        subtitle={`A cierre de ${periodo}`}
        highlight
      />
    </section>
  );
}
