import type { CorpDiccionarioEntrada, CorpNota } from "@/modules/corporativo/types";
import { CLASE_TARJETA } from "@/modules/corporativo/ui/charts/tokens";

interface MetodologiaCorporativaProps {
  diccionario: CorpDiccionarioEntrada[];
  notas: CorpNota[];
}

/**
 * Glosario y avisos metodológicos, tal y como los publica el maestro.
 *
 * Se leen de `corp_diccionario` y `corp_notas`, que se cargan con los datos en
 * cada sincronización, en vez de estar copiados aquí. Copiados envejecerían en
 * silencio en cuanto alguien editara el Excel, y una nota metodológica caducada
 * es peor que ninguna: las cifras del tab dependen de definiciones concretas
 * (qué EBITDA, qué periodificación, qué perímetro) y quien las lee tiene que
 * poder comprobar cuáles.
 */
export function MetodologiaCorporativa({ diccionario, notas }: MetodologiaCorporativaProps) {
  if (diccionario.length === 0 && notas.length === 0) {
    return (
      <section className={CLASE_TARJETA}>
        <h3 className="text-base font-semibold text-text-primary">Metodología</h3>
        <p className="mt-2 text-sm text-text-muted">
          El maestro cargado no traía las hojas DICCIONARIO ni NOTAS.
        </p>
      </section>
    );
  }

  const secciones = [...new Set(notas.map((n) => n.seccion))];

  return (
    <section className={`${CLASE_TARJETA} xl:col-span-2`}>
      <h3 className="text-base font-semibold text-text-primary">Metodología</h3>
      <p className="mt-0.5 text-xs text-text-muted">
        Del propio maestro corporativo: se actualiza con cada sincronización.
      </p>

      <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {secciones.length > 0 ? (
          <div className="min-w-0">
            {secciones.map((seccion) => (
              <div key={seccion} className="mb-3 last:mb-0">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  {seccion}
                </h4>
                <ul className="mt-1.5 space-y-1.5">
                  {notas
                    .filter((n) => n.seccion === seccion)
                    .map((nota) => (
                      <li key={nota.id} className="text-sm leading-snug text-text-body">
                        {nota.titulo ? (
                          <span className="font-medium text-text-primary">{nota.titulo}. </span>
                        ) : null}
                        {nota.texto}
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        ) : null}

        {diccionario.length > 0 ? (
          <div className="min-w-0">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Qué es cada campo
            </h4>
            <dl className="mt-1.5 max-h-[420px] overflow-y-auto pr-1">
              {diccionario.map((entrada) => (
                <div key={entrada.campo} className="mb-2 last:mb-0">
                  <dt className="text-sm font-medium text-text-primary">
                    {entrada.campo}
                    {entrada.unidad ? (
                      <span className="ml-1.5 text-xs font-normal text-text-muted">
                        ({entrada.unidad})
                      </span>
                    ) : null}
                  </dt>
                  <dd className="text-sm leading-snug text-text-body">{entrada.descripcion}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </div>
    </section>
  );
}
