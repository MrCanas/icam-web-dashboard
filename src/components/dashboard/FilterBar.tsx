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

export function FilterBar({
  selectedSituacion,
  selectedTipo,
  basePath = "/dashboard",
}: FilterBarProps) {
  return (
    <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-text-muted">Filtros:</span>

        <div className="flex items-center gap-2">
          <span className="text-sm text-text-body">Situación</span>
          <div className="flex items-center gap-1">
            <Link
              href={buildHref(basePath, undefined, selectedTipo)}
              className={`px-3 py-1.5 rounded-md text-xs border ${
                !selectedSituacion
                  ? "bg-icam-900 text-white border-icam-900"
                  : "bg-white text-text-body border-subtle hover:border-icam-900"
              }`}
            >
              Todas
            </Link>
            {situaciones.map((situacion) => (
              <Link
                key={situacion}
                href={buildHref(basePath, situacion, selectedTipo)}
                className={`px-3 py-1.5 rounded-md text-xs border ${
                  selectedSituacion === situacion
                    ? "bg-icam-900 text-white border-icam-900"
                    : "bg-white text-text-body border-subtle hover:border-icam-900"
                }`}
              >
                {situacion}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-text-body">Tipo</span>
          <div className="flex items-center gap-1">
            <Link
              href={buildHref(basePath, selectedSituacion, undefined)}
              className={`px-3 py-1.5 rounded-md text-xs border ${
                !selectedTipo
                  ? "bg-icam-900 text-white border-icam-900"
                  : "bg-white text-text-body border-subtle hover:border-icam-900"
              }`}
            >
              Todos
            </Link>
            {tipos.map((tipo) => (
              <Link
                key={tipo}
                href={buildHref(basePath, selectedSituacion, tipo)}
                className={`px-3 py-1.5 rounded-md text-xs border ${
                  selectedTipo === tipo
                    ? "bg-icam-900 text-white border-icam-900"
                    : "bg-white text-text-body border-subtle hover:border-icam-900"
                }`}
              >
                {tipo}
              </Link>
            ))}
          </div>
        </div>

        <Link
          href={basePath}
          className="ml-auto px-3 py-1.5 rounded-md text-xs border border-icam-gold text-icam-gold hover:bg-icam-gold hover:text-white"
        >
          Limpiar
        </Link>
      </div>
    </section>
  );
}
