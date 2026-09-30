"use client";

import { ESTRUCTURALES } from "../../logic/biblioteca";
import type { AccionEstructura, Seleccion } from "../../types";
import { Boton, Chip, claseCampo, Tarjeta } from "../componentes";
import type { HerramientaInforme } from "../InformeApp";

const ACCIONES: [AccionEstructura, string][] = [
  ["mantener", "Mantener (sin cambios)"],
  ["actualizar", "Actualizar"],
  ["ocultar", "Ocultar"],
  ["nueva", "Nueva"],
];

function chipObjetivo(e: string) {
  const tono = e === "cumplido" ? "ok" : e === "parcial" ? "aviso" : e === "no cumplido" ? "error" : "neutro";
  return <Chip tono={tono}>{e || "—"}</Chip>;
}

function Lista({ items }: { items: string[] }) {
  return items.length ? (
    <ul className="list-disc space-y-1 pl-5 text-sm">
      {items.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  ) : (
    <p className="text-sm text-text-muted">Nada.</p>
  );
}

/** Paso 3 · Biblioteca y GO: lo que ha entendido Claude, la estructura propuesta y las slides que añadir. */
export function PasoBiblioteca({ h }: { h: HerramientaInforme }) {
  const { informe, biblioteca, puedeEditar } = h;
  const a = informe.analisis;
  const sel: Seleccion = informe.seleccion ?? { estructura: a?.estructura ?? [], anadir: [] };
  const presentes = new Set(sel.estructura.map((e) => e.id));
  const sugeridas = a?.sugeridas ?? [];
  const nClaude = sel.estructura.filter((e) => e.accion === "actualizar" || e.accion === "nueva").length + sel.anadir.length + 2;

  function cambiar(s: Seleccion) {
    void h.guardar({ seleccion: s });
  }

  if (!a) {
    return (
      <Tarjeta>
        <p className="text-sm">Todavía no hay análisis del trimestre.</p>
        <Boton onClick={() => h.ir("paso2")}>Volver a la información del trimestre</Boton>
      </Tarjeta>
    );
  }

  return (
    <>
      <Tarjeta>
        <h2 className="text-sm font-semibold text-text-primary">Lo que he entendido del trimestre</h2>
        <Lista items={a.resumen} />
      </Tarjeta>

      {a.objetivosPrevios.length ? (
        <Tarjeta>
          <h2 className="text-sm font-semibold text-text-primary">Objetivos del {informe.trimestreAnterior}</h2>
          <div className="overflow-x-auto rounded-lg border border-subtle/60">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-subtle/30">
                <tr>
                  <th className="p-3 font-semibold text-icam-900">Objetivo</th>
                  <th className="p-3 font-semibold text-icam-900">Estado</th>
                  <th className="p-3 font-semibold text-icam-900">Evidencia</th>
                </tr>
              </thead>
              <tbody>
                {a.objetivosPrevios.map((o, i) => (
                  <tr key={i} className="border-t border-subtle/60 align-top">
                    <td className="p-3">{o.objetivo}</td>
                    <td className="p-3">{chipObjetivo(o.estado)}</td>
                    <td className="p-3 text-text-muted">{o.evidencia}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      ) : null}

      <Tarjeta>
        <h2 className="text-sm font-semibold text-text-primary">Estructura propuesta</h2>
        <div className="overflow-x-auto rounded-lg border border-subtle/60">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-subtle/30">
              <tr>
                <th className="p-3 font-semibold text-icam-900">Nº</th>
                <th className="p-3 font-semibold text-icam-900">Slide</th>
                <th className="p-3 font-semibold text-icam-900">Acción</th>
                <th className="p-3 font-semibold text-icam-900">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {sel.estructura.map((e, i) => {
                const b = biblioteca.find((x) => x.id === e.id);
                return (
                  <tr key={e.id} className="border-t border-subtle/60 align-top">
                    <td className="p-3 tabular-nums">{i + 1}</td>
                    <td className="p-3">
                      <b className="font-semibold">{e.titulo || b?.nombre || e.id}</b>
                      <br />
                      <span className="text-xs text-text-muted">{e.id}</span>
                    </td>
                    <td className="p-3">
                      <select
                        className={claseCampo}
                        aria-label="Acción"
                        value={e.accion}
                        disabled={!puedeEditar}
                        onChange={(ev) =>
                          cambiar({
                            ...sel,
                            estructura: sel.estructura.map((x, j) => (j === i ? { ...x, accion: ev.target.value as AccionEstructura } : x)),
                          })
                        }
                      >
                        {ACCIONES.map(([v, t]) => (
                          <option key={v} value={v}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3 text-text-muted">{e.motivo}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Tarjeta>

      <Tarjeta>
        <h2 className="text-sm font-semibold text-text-primary">Biblioteca · ¿añadimos alguna slide más?</h2>
        <div className="overflow-x-auto rounded-lg border border-subtle/60">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-subtle/30">
              <tr>
                <th className="p-3" />
                <th className="p-3 font-semibold text-icam-900">Nº</th>
                <th className="p-3 font-semibold text-icam-900">Slide</th>
                <th className="p-3 font-semibold text-icam-900">Se sugiere cuando</th>
              </tr>
            </thead>
            <tbody>
              {biblioteca
                .filter((b) => !presentes.has(b.id) && !ESTRUCTURALES.includes(b.id))
                .map((b) => (
                  <tr key={b.n} className="border-t border-subtle/60 align-top">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        aria-label={`Añadir ${b.nombre}`}
                        checked={sel.anadir.includes(b.n)}
                        disabled={!puedeEditar}
                        onChange={(ev) =>
                          cambiar({
                            ...sel,
                            anadir: ev.target.checked ? [...sel.anadir, b.n] : sel.anadir.filter((x) => x !== b.n),
                          })
                        }
                      />
                    </td>
                    <td className="p-3 tabular-nums">{b.n}</td>
                    <td className="p-3">
                      <b className="font-semibold">{b.nombre}</b>
                      {sugeridas.includes(b.n) ? <span className="ml-1.5 font-semibold text-icam-gold">★ recomendada</span> : null}
                      <br />
                      <span className="text-text-muted">{b.para}</span>
                    </td>
                    <td className="p-3 text-text-muted">{b.sugerir}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Tarjeta>

      <div className="grid gap-4 md:grid-cols-2">
        <Tarjeta>
          <h2 className="text-sm font-semibold text-text-primary">Datos que faltan</h2>
          <Lista items={a.faltan} />
          <p className="text-sm text-text-muted">Quedarán marcados como [pendiente] en el informe.</p>
        </Tarjeta>
        <Tarjeta>
          <h2 className="text-sm font-semibold text-text-primary">Contradicciones entre fuentes</h2>
          <Lista items={a.contradicciones} />
        </Tarjeta>
      </div>

      <Tarjeta>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-text-muted">
            Se harán unas {nClaude} peticiones a Claude. Tardará unos {Math.max(3, Math.round(nClaude * 0.6))} minutos; deja la pestaña abierta
            mientras tanto (si se cierra, al volver se reanuda donde se quedó).
          </p>
          <div className="flex gap-2">
            <Boton onClick={() => h.ir("paso2")}>Atrás</Boton>
            <Boton variante="primario" className="!px-6 !py-2.5 !text-[15px]" disabled={!puedeEditar} onClick={() => h.ir("generando")}>
              GO · Generar informe
            </Boton>
          </div>
        </div>
      </Tarjeta>
    </>
  );
}
