import Link from "next/link";

interface FilterBarProps {
  selectedSituacion?: string;
  selectedTipo?: string;
  basePath?: string;
}

const situaciones = ["En Marcha", "Culminado"];
const tipos = ["Promoción", "Fondo"];

function buildHref(basePath: string, situacion?: string, tipo?: string): string {
  const params = new URLSearchParams();
  if (situacion) {
    params.set("situacion", situacion);
  }
  if (tipo) {
    params.set("tipo", tipo);
  }

  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

const chipClass = (active: boolean) =>
  `min-h-11 inline-flex items-center justify-center px-3 py-2 rounded-md text-sm border whitespace-nowrap shrink-0 ${
    active
      ? "bg-icam-900 text-white border-icam-900"
      : "bg-white text-text-body border-subtle hover:border-icam-900"
  }`;

export function FilterBar({
  selectedSituacion,
  selectedTipo,
  basePath = "/dashboard",
}: FilterBarProps) {
  return (
    <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3">
          <span className="text-sm text-text-muted shrink-0">Filtros:</span>

          <div className="flex flex-col gap-2 min-w-0 flex-1">
            <span className="text-sm text-text-body sm:sr-only">Situación</span>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 sm:flex-wrap sm:overflow-visible">
              <Link
                href={buildHref(basePath, undefined, selectedTipo)}
                className={chipClass(!selectedSituacion)}
              >
                Todas
              </Link>
              {situaciones.map((situacion) => (
                <Link
                  key={situacion}
                  href={buildHref(basePath, situacion, selectedTipo)}
                  className={chipClass(selectedSituacion === situacion)}
                >
                  {situacion}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3">
          <div className="flex flex-col gap-2 min-w-0 flex-1 sm:flex-initial">
            <span className="text-sm text-text-body sm:sr-only">Tipo</span>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 sm:flex-wrap sm:overflow-visible">
              <Link
                href={buildHref(basePath, selectedSituacion, undefined)}
                className={chipClass(!selectedTipo)}
              >
                Todos
              </Link>
              {tipos.map((tipo) => (
                <Link
                  key={tipo}
                  href={buildHref(basePath, selectedSituacion, tipo)}
                  className={chipClass(selectedTipo === tipo)}
                >
                  {tipo}
                </Link>
              ))}
            </div>
          </div>

          <Link
            href={basePath}
            className="min-h-11 inline-flex items-center justify-center px-3 py-2 rounded-md text-sm border border-icam-gold text-icam-gold hover:bg-icam-gold hover:text-white sm:ml-auto shrink-0"
          >
            Limpiar
          </Link>
        </div>
      </div>
    </section>
  );
}
