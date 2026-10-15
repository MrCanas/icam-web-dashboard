"use client";

import { useRef, useState } from "react";

import { accionRegistrarRevision } from "../../actions/informes";
import { cerrarRonda, comentar, comentariosActivos, fuentesNuevas, leerRespuestas, marcarEditado, normalizarAnalisis, quitarDeLista, type ListaTexto } from "../../logic/analisis";
import { NO_ANADIBLES } from "../../logic/biblioteca";
import { defFija } from "../../logic/estructuraFija";
import { normalizarEstructura } from "../../logic/informe";
import { hitosObligatorios } from "../../logic/cronograma";
import type { AccionEstructura, Analisis, EntradaEstructura, HitoCronograma, Seleccion } from "../../types";
import { Boton, Chip, claseCampo, Tarjeta } from "../componentes";
import type { HerramientaInforme } from "../InformeApp";
import { mensajeErrorClaude, pedirClaude } from "../lib/claude";
import { Comentario, ElementoEditable } from "./ElementoEditable";
import { ZonaAportes } from "./ZonaAportes";

const ACCIONES: [AccionEstructura, string][] = [
  ["mantener", "Mantener (sin cambios)"],
  ["actualizar", "Actualizar"],
  ["ocultar", "Ocultar"],
  ["nueva", "Nueva"],
];

const ESTADOS_OBJETIVO = ["cumplido", "parcial", "no cumplido", "ya no aplica"];

function tonoObjetivo(e: string) {
  return e === "cumplido" ? "ok" : e === "parcial" ? "aviso" : e === "no cumplido" ? "error" : "neutro";
}

/**
 * Estructura de la selección tras una revisión: la nueva de Claude, salvo en
 * las filas que el equipo ha tocado (título, acción o motivo), que se quedan.
 */
function estructuraTrasRevision(nueva: EntradaEstructura[], anterior: EntradaEstructura[], editados: string[]): EntradaEstructura[] {
  const previa = new Map(anterior.map((e) => [e.id, e]));
  const fuera = nueva.map((e) => (editados.includes(`estructura.${e.id}`) && previa.has(e.id) ? previa.get(e.id)! : e));
  // Filas que el equipo editó y Claude ya no trae: se conservan al final del cuerpo.
  for (const e of anterior) {
    if (editados.includes(`estructura.${e.id}`) && !fuera.some((x) => x.id === e.id)) fuera.splice(Math.max(0, fuera.length - 2), 0, e);
  }
  return fuera;
}

/** Paso 3 · Lo entendido (editable y comentable), la estructura, la biblioteca y GO. */
export function PasoBiblioteca({ h }: { h: HerramientaInforme }) {
  const { informe, biblioteca, puedeEditar } = h;
  const a = informe.analisis;
  const hayNoReportar = h.fuentes.some((f) => f.tipo === "no_reportar" && f.texto.trim());
  const base: Seleccion = informe.seleccion ?? { estructura: a?.estructura ?? [], anadir: [] };
  // Siempre con la estructura fija completa y en su orden (también en análisis hechos antes de que existiera).
  const sel: Seleccion = { ...base, estructura: normalizarEstructura(base.estructura, h.previo) };
  const presentes = new Set(sel.estructura.map((e) => e.id));
  const sugeridas = a?.sugeridas ?? [];
  const nClaude = sel.estructura.filter((e) => e.accion === "actualizar" || e.accion === "nueva").length + sel.anadir.length + 2;
  const [revisando, setRevisando] = useState<string | null>(null);
  const abortar = useRef<AbortController | null>(null);
  // Análisis anteriores a las rondas no tienen fecha: lo aportado desde que se abrió el paso cuenta como nuevo.
  const [abierto] = useState(() => new Date().toISOString());

  if (!a) {
    return (
      <Tarjeta>
        <p className="text-sm">Todavía no hay análisis del trimestre.</p>
        <Boton onClick={() => h.ir("paso2")}>Volver a la información del trimestre</Boton>
      </Tarjeta>
    );
  }
  const analisis: Analisis = a.fecha ? a : { ...a, fecha: abierto };
  const nuevas = fuentesNuevas(h.fuentes, analisis);
  const comentarios = comentariosActivos(analisis);
  const editados = new Set(analisis.editados ?? []);
  const hitos = hitosObligatorios(analisis, h.previo);

  function guardarA(nuevo: Analisis, cambio?: string) {
    void h.guardar({ analisis: nuevo }, cambio);
  }
  function cambiarSel(s: Seleccion) {
    void h.guardar({ seleccion: s });
  }
  const com = (clave: string) => ({
    comentario: analisis.comentarios?.[clave] ?? "",
    respuesta: analisis.respuestas?.[clave],
    onComentar: (t: string) => guardarA(comentar(analisis, clave, t)),
  });

  /* ---------- listas de texto ---------- */
  function editarTexto(lista: ListaTexto, i: number, texto: string) {
    const arr = [...(analisis[lista] ?? [])];
    arr[i] = texto;
    guardarA(marcarEditado({ ...analisis, [lista]: arr }, `${lista}.${i}`));
  }
  function quitarTexto(lista: ListaTexto, i: number) {
    const arr = (analisis[lista] ?? []).filter((_, j) => j !== i);
    guardarA({ ...analisis, ...quitarDeLista(analisis, lista, i), [lista]: arr } as Analisis);
  }
  function anadirTexto(lista: ListaTexto) {
    const arr = [...(analisis[lista] ?? []), ""];
    guardarA({ ...analisis, [lista]: arr });
  }

  // Función y no componente: así no se vuelve a montar (ni pierde lo que se está escribiendo) en cada render.
  function listaEditable(lista: ListaTexto, vacio: string) {
    const items = analisis[lista] ?? [];
    return (
      <div className="flex flex-col gap-2.5">
        {items.length ? (
          items.map((t, i) => (
            <div key={`${lista}.${i}`} className="border-l-2 border-subtle/70 pl-3">
              <ElementoEditable
                valor={t}
                puedeEditar={puedeEditar}
                editado={editados.has(`${lista}.${i}`)}
                onGuardar={(x) => editarTexto(lista, i, x)}
                onBorrar={() => quitarTexto(lista, i)}
                {...com(`${lista}.${i}`)}
              />
            </div>
          ))
        ) : (
          <p className="text-sm text-text-muted">{vacio}</p>
        )}
        {puedeEditar ? (
          <Boton variante="texto" className="self-start !text-xs" onClick={() => anadirTexto(lista)}>
            ＋ Añadir
          </Boton>
        ) : null}
      </div>
    );
  }

  /* ---------- objetivos, hechos e hitos ---------- */
  function editarObjetivo(i: number, cambios: Partial<Analisis["objetivosPrevios"][number]>) {
    const arr = analisis.objetivosPrevios.map((o, j) => (j === i ? { ...o, ...cambios } : o));
    guardarA(marcarEditado({ ...analisis, objetivosPrevios: arr }, `objetivos.${i}`));
  }
  function editarHecho(i: number, cambios: Partial<Analisis["hechos"][number]>) {
    const arr = analisis.hechos.map((x, j) => (j === i ? { ...x, ...cambios } : x));
    guardarA(marcarEditado({ ...analisis, hechos: arr }, `hechos.${i}`));
  }
  function guardarHitos(lista: HitoCronograma[], clave?: string) {
    const nuevo = { ...analisis, hitosPrevios: lista };
    guardarA(clave ? marcarEditado(nuevo, clave) : nuevo, "Cronograma del informe anterior editado");
  }

  /* ---------- estructura ---------- */
  function editarFila(i: number, cambios: Partial<EntradaEstructura>) {
    const e = sel.estructura[i]!;
    cambiarSel({ ...sel, estructura: sel.estructura.map((x, j) => (j === i ? { ...x, ...cambios } : x)) });
    if (!editados.has(`estructura.${e.id}`)) guardarA(marcarEditado(analisis, `estructura.${e.id}`));
  }

  /* ---------- nueva ronda ---------- */
  async function revisar() {
    setRevisando("Claude está revisando el análisis con tus cambios…");
    h.avisar(null);
    abortar.current = new AbortController();
    try {
      // La revisión se monta en el servidor con lo guardado: primero, que no quede nada en cola (y que el análisis tenga su fecha).
      if (!a?.fecha) await h.guardar({ analisis });
      await h.guardadoAlDia();
      const { json } = await pedirClaude(
        { tipo: "analisis", informeId: informe.id, modo: "revision" },
        { signal: abortar.current.signal, onProgreso: () => setRevisando("Claude está escribiendo el análisis revisado…") },
      );
      const nuevo = normalizarAnalisis(json, { previo: h.previo, hayNoReportar });
      const respuestas = leerRespuestas(json);
      const cerrado = cerrarRonda(analisis, nuevo, respuestas, new Date().toISOString());
      const estructura = estructuraTrasRevision(cerrado.estructura, sel.estructura, cerrado.editados ?? []);
      const ok = await h.guardar(
        { analisis: cerrado, seleccion: { ...sel, estructura } },
        `Análisis revisado (ronda ${cerrado.ronda})${comentarios.length ? ` con ${comentarios.length} comentario(s)` : ""}${nuevas.length ? ` y ${nuevas.length} fuente(s) nueva(s)` : ""}`,
      );
      if (!ok) throw new Error("no se ha podido guardar el análisis revisado");
      void accionRegistrarRevision(informe.id, {
        tipo: "analisis",
        instruccion: [...comentarios.map(([k, v]) => `[${k}] ${v}`), ...nuevas.map((f) => `Nueva: ${f.nombre}`)].join("\n"),
        resumen: Object.entries(respuestas)
          .map(([k, v]) => `[${k}] ${v}`)
          .join("\n"),
        antes: [],
        despues: [],
        ordenAntes: [],
      });
      h.avisar(`Análisis revisado (ronda ${cerrado.ronda}). Debajo de cada comentario tienes lo que ha hecho Claude.`, "ok");
    } catch (e) {
      h.avisar(mensajeErrorClaude(e), "error");
    } finally {
      setRevisando(null);
      abortar.current = null;
    }
  }

  const ocupado = !!revisando;

  return (
    <>
      <Tarjeta>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-text-primary">Lo que he entendido del trimestre</h2>
          <span className="text-xs text-text-muted">
            {analisis.ronda && analisis.ronda > 1 ? `Ronda ${analisis.ronda} · ` : ""}Pulsa «Editar» para corregir un punto o «💬» para pedirle algo a Claude.
          </span>
        </div>
        {listaEditable("resumen", "Nada.")}
      </Tarjeta>

      {hayNoReportar || analisis.omitidos?.length ? (
        <Tarjeta>
          <h2 className="text-sm font-semibold text-text-primary">Lo que he dejado fuera</h2>
          <p className="text-sm text-text-muted">
            Por tus indicaciones de «No reportar». Comprueba que es lo que querías dejar fuera antes de generar el informe.
          </p>
          {analisis.omitidos ? (
            listaEditable("omitidos", "Nada de la información aportada estaba afectado por tus indicaciones.")
          ) : (
            <p className="text-sm">Este análisis es anterior a tus indicaciones: vuelve a analizar la información para que se apliquen.</p>
          )}
          <Boton onClick={() => h.ir("paso2")}>Revisar las indicaciones</Boton>
        </Tarjeta>
      ) : null}

      {analisis.objetivosPrevios.length ? (
        <Tarjeta>
          <h2 className="text-sm font-semibold text-text-primary">Objetivos del {informe.trimestreAnterior}</h2>
          <div className="flex flex-col divide-y divide-subtle/60 rounded-lg border border-subtle/60">
            {analisis.objetivosPrevios.map((o, i) => (
              <div key={i} className="grid gap-2 p-3 md:grid-cols-[1fr_160px_1fr]">
                <ElementoEditable
                  valor={o.objetivo}
                  puedeEditar={puedeEditar}
                  editado={editados.has(`objetivos.${i}`)}
                  onGuardar={(t) => editarObjetivo(i, { objetivo: t })}
                  {...com(`objetivos.${i}`)}
                />
                <div className="flex items-start gap-1.5">
                  {puedeEditar ? (
                    <select
                      className={`${claseCampo} !py-1 text-sm`}
                      aria-label="Estado del objetivo"
                      value={ESTADOS_OBJETIVO.includes(o.estado) ? o.estado : ""}
                      onChange={(e) => editarObjetivo(i, { estado: e.target.value })}
                    >
                      {!ESTADOS_OBJETIVO.includes(o.estado) ? <option value="">{o.estado || "—"}</option> : null}
                      {ESTADOS_OBJETIVO.map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  ) : (
                    <Chip tono={tonoObjetivo(o.estado)}>{o.estado || "—"}</Chip>
                  )}
                </div>
                <ElementoEditable valor={o.evidencia ?? ""} puedeEditar={puedeEditar} onGuardar={(t) => editarObjetivo(i, { evidencia: t })} />
              </div>
            ))}
          </div>
        </Tarjeta>
      ) : null}

      <Tarjeta>
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-text-primary">
            Hechos del trimestre ({analisis.hechos.length}) <span className="font-normal text-text-muted">· es lo que Claude usará para redactar cada slide</span>
          </summary>
          <div className="mt-3 flex flex-col gap-2.5">
            {analisis.hechos.map((x, i) => (
              <div key={i} className="border-l-2 border-subtle/70 pl-3">
                <ElementoEditable
                  valor={x.texto}
                  puedeEditar={puedeEditar}
                  editado={editados.has(`hechos.${i}`)}
                  onGuardar={(t) => editarHecho(i, { texto: t })}
                  onBorrar={() =>
                    guardarA({ ...analisis, ...quitarDeLista(analisis, "hechos", i), hechos: analisis.hechos.filter((_, j) => j !== i) } as Analisis)
                  }
                  {...com(`hechos.${i}`)}
                >
                  <span className="flex shrink-0 gap-1">
                    {x.tipo ? <Chip>{x.tipo}</Chip> : null}
                    {x.fecha ? <Chip>{x.fecha}</Chip> : null}
                  </span>
                </ElementoEditable>
              </div>
            ))}
            {puedeEditar ? (
              <Boton
                variante="texto"
                className="self-start !text-xs"
                onClick={() => guardarA({ ...analisis, hechos: [...analisis.hechos, { tipo: "estado", texto: "" }] })}
              >
                ＋ Añadir hecho
              </Boton>
            ) : null}
          </div>
        </details>
      </Tarjeta>

      {hitos.length || analisis.hitosPrevios ? (
        <Tarjeta>
          <h2 className="text-sm font-semibold text-text-primary">Cronograma del informe anterior</h2>
          <p className="text-sm text-text-muted">
            Estos hitos se mantienen en el informe nuevo: Claude solo puede cambiar su fecha o marcarlos como hechos si las fuentes lo justifican, y
            si alguno desaparece se repone solo. Quita o cambia aquí lo que no deba seguir.
          </p>
          <div className="overflow-x-auto rounded-lg border border-subtle/60">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-subtle/30">
                <tr>
                  <th className="p-2.5 font-semibold text-icam-900">Hito</th>
                  <th className="p-2.5 font-semibold text-icam-900">Fecha</th>
                  <th className="p-2.5 font-semibold text-icam-900">Hecho</th>
                  <th className="p-2.5" />
                </tr>
              </thead>
              <tbody>
                {hitos.map((x, i) => (
                  <tr key={i} className="border-t border-subtle/60 align-top">
                    <td className="p-2.5">
                      <ElementoEditable
                        valor={x.titulo}
                        multilinea={false}
                        puedeEditar={puedeEditar}
                        onGuardar={(t) => guardarHitos(hitos.map((y, j) => (j === i ? { ...y, titulo: t } : y)), `hitos.${i}`)}
                        {...com(`hitos.${i}`)}
                      />
                    </td>
                    <td className="w-28 p-2.5">
                      <input
                        className={`${claseCampo} !py-1 text-sm`}
                        defaultValue={x.fecha}
                        aria-label="Fecha (MM/AA)"
                        placeholder="MM/AA"
                        disabled={!puedeEditar}
                        onBlur={(e) => e.target.value !== x.fecha && guardarHitos(hitos.map((y, j) => (j === i ? { ...y, fecha: e.target.value } : y)), `hitos.${i}`)}
                      />
                    </td>
                    <td className="p-2.5">
                      <input
                        type="checkbox"
                        aria-label={`${x.titulo} hecho`}
                        checked={x.hecho}
                        disabled={!puedeEditar}
                        onChange={(e) => guardarHitos(hitos.map((y, j) => (j === i ? { ...y, hecho: e.target.checked } : y)), `hitos.${i}`)}
                      />
                    </td>
                    <td className="p-2.5">
                      {puedeEditar ? (
                        <Boton variante="texto" className="!text-xs" onClick={() => guardarHitos(hitos.filter((_, j) => j !== i))}>
                          Quitar
                        </Boton>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {puedeEditar ? (
            <Boton
              variante="texto"
              className="self-start !text-xs"
              onClick={() => guardarHitos([...hitos, { titulo: "Hito nuevo", fecha: "", hecho: false, slide: hitos.at(-1)?.slide }])}
            >
              ＋ Añadir hito
            </Boton>
          ) : null}
        </Tarjeta>
      ) : null}

      <Tarjeta>
        <h2 className="text-sm font-semibold text-text-primary">Estructura propuesta</h2>
        <div className="flex flex-col divide-y divide-subtle/60 rounded-lg border border-subtle/60">
          {sel.estructura.map((e, i) => {
            const b = biblioteca.find((x) => x.id === e.id);
            // Las de la estructura fija no se ocultan.
            const fija = !!defFija(e.id);
            return (
              <div key={e.id} className="grid gap-2 p-3 md:grid-cols-[32px_1.2fr_190px_1fr]">
                <span className="pt-1 text-sm tabular-nums text-text-muted">{i + 1}</span>
                <div className="flex flex-col gap-0.5">
                  <ElementoEditable
                    valor={e.titulo || b?.nombre || e.id}
                    multilinea={false}
                    puedeEditar={puedeEditar}
                    editado={editados.has(`estructura.${e.id}`)}
                    onGuardar={(t) => editarFila(i, { titulo: t })}
                    {...com(`estructura.${e.id}`)}
                  />
                  <span className="flex items-center gap-1.5 text-xs text-text-muted">
                    {e.id}
                    {fija ? <Chip tono="neutro">Fija</Chip> : null}
                  </span>
                </div>
                <div>
                  <select
                    className={`${claseCampo} !py-1 text-sm`}
                    aria-label="Acción"
                    value={e.accion}
                    disabled={!puedeEditar}
                    onChange={(ev) => editarFila(i, { accion: ev.target.value as AccionEstructura })}
                  >
                    {ACCIONES.filter(([v]) => !fija || v !== "ocultar").map(([v, t]) => (
                      <option key={v} value={v}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <ElementoEditable valor={e.motivo} puedeEditar={puedeEditar} onGuardar={(t) => editarFila(i, { motivo: t })} />
              </div>
            );
          })}
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
                .filter((b) => !presentes.has(b.id) && !NO_ANADIBLES.includes(b.id))
                .map((b) => (
                  <tr key={b.n} className="border-t border-subtle/60 align-top">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        aria-label={`Añadir ${b.nombre}`}
                        checked={sel.anadir.includes(b.n)}
                        disabled={!puedeEditar}
                        onChange={(ev) =>
                          cambiarSel({
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
          {listaEditable("faltan", "Nada.")}
          <p className="text-sm text-text-muted">Quedarán marcados como [pendiente] en el informe. Si tienes el dato, añádelo abajo y revisa.</p>
        </Tarjeta>
        <Tarjeta>
          <h2 className="text-sm font-semibold text-text-primary">Contradicciones entre fuentes</h2>
          {listaEditable("contradicciones", "Nada.")}
        </Tarjeta>
      </div>

      <Tarjeta>
        <h2 className="text-sm font-semibold text-text-primary">Revisar con lo nuevo</h2>
        <Comentario
          valor={analisis.comentarios?.general ?? ""}
          respuesta={analisis.respuestas?.general}
          puedeEditar={puedeEditar}
          etiqueta="Comentario general sobre el análisis o el informe"
          abiertoInicial
          onGuardar={(t) => guardarA(comentar(analisis, "general", t))}
        />
        <ZonaAportes
          h={h}
          titulo="Añadir más información"
          ayuda="Lo que añadas aquí pasa a las fuentes del trimestre. Para que Claude lo incorpore al análisis, pulsa «Revisar con lo nuevo»."
        />
        <div className="flex flex-wrap items-center gap-2">
          <Boton
            variante="primario"
            disabled={!puedeEditar || ocupado || (!comentarios.length && !nuevas.length && !editados.size)}
            onClick={() => void revisar()}
          >
            {ocupado ? "Revisando…" : "Revisar con lo nuevo"}
          </Boton>
          {ocupado ? <Boton onClick={() => abortar.current?.abort()}>Parar</Boton> : null}
          <span className="text-sm text-text-muted" aria-live="polite">
            {revisando ??
              (comentarios.length || nuevas.length
                ? `Claude verá ${[comentarios.length ? `${comentarios.length} comentario(s)` : "", nuevas.length ? `${nuevas.length} fuente(s) nueva(s)` : ""].filter(Boolean).join(" y ")}; lo que has editado a mano se respeta.`
                : "Comenta, edita o añade información y Claude rehará el análisis respetando tus cambios. Los comentarios sin revisar también llegan a la redacción de cada slide.")}
          </span>
        </div>
      </Tarjeta>

      <Tarjeta>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-text-muted">
            Se harán unas {nClaude} peticiones a Claude. Tardará unos {Math.max(3, Math.round(nClaude * 0.6))} minutos; deja la pestaña abierta
            mientras tanto (si se cierra, al volver se reanuda donde se quedó).
          </p>
          <div className="flex gap-2">
            <Boton onClick={() => h.ir("paso2")} disabled={ocupado}>
              Atrás
            </Boton>
            <Boton variante="primario" className="!px-6 !py-2.5 !text-[15px]" disabled={!puedeEditar || ocupado} onClick={() => h.ir("generando")}>
              GO · Generar informe
            </Boton>
          </div>
        </div>
      </Tarjeta>
    </>
  );
}
