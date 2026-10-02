"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { accionBorrarInforme, accionGuardarVersion, accionHistorial } from "../../actions/informes";
import { ESTRUCTURALES } from "../../logic/biblioteca";
import { desmarcarAplicadas, marcarAplicadas, pendientesDirigidas, seleccionBase, slidesConDirigidas } from "../../logic/dirigidas";
import { conFlotantesDe } from "../../logic/flotantes";
import { actualizarPeriodo, clon, idNuevo, ordenar, qaMecanico, renumerar, tituloDe, validarSlide, type MedidaQa } from "../../logic/informe";
import { rutaImprimir, rutaListaInformes, rutaPdf } from "../../logic/paths";
import { componentesPermitidos } from "../../slides/components";
import { medirFuera, type MedidaSlide } from "../../slides/motor";
import type { InformeJson, MetaInforme, SlideJson } from "../../slides/tipos";
import type { Cambio, IncidenciaCoherencia, ResumenUso, Seleccion } from "../../types";
import { Aviso, Boton, ChipEstado, claseCampo, fechaCorta, Tarjeta } from "../componentes";
import type { HerramientaInforme } from "../InformeApp";
import { esCancelado, mensajeErrorClaude, pedirClaude } from "../lib/claude";
import type { ResultadoVisor } from "../slides/VisorSlide";
import { TarjetaSlide } from "./TarjetaSlide";

interface Props {
  h: HerramientaInforme;
  estadoGuardado: string;
  usoInicial: ResumenUso | null;
}

/** Editor del informe generado: revisión, correcciones, orden, versiones, aprobación y PDF. */
export function Editor({ h, estadoGuardado, usoInicial }: Props) {
  const router = useRouter();
  const { informe, biblioteca, puedeEditar } = h;
  const contenido = informe.contenido;
  const [medidas, setMedidas] = useState<Record<string, ResultadoVisor>>({});
  const [ocupado, setOcupado] = useState("");
  const [bib, setBib] = useState<number>(() => biblioteca.find((b) => !ESTRUCTURALES.includes(b.id))?.n ?? 0);
  const [confirmar, setConfirmar] = useState(false);
  const [historial, setHistorial] = useState<Cambio[] | null>(null);
  const [uso, setUso] = useState<ResumenUso | null>(usoInicial);
  const [pdf, setPdf] = useState<{ generando: boolean; error: string | null }>({ generando: false, error: null });

  // Cada slide conserva su objeto mientras no cambie su contenido: así no se repintan todas tras cada guardado.
  const [cache] = useState(() => new Map<string, { json: string; slide: SlideJson }>());
  const slides = useMemo(() => {
    return (contenido?.slides ?? []).map((s) => {
      const json = JSON.stringify(s);
      const prev = cache.get(s.id);
      if (prev && prev.json === json) return prev.slide;
      cache.set(s.id, { json, slide: s });
      return s;
    });
  }, [contenido, cache]);
  const visibles = slides.filter((s) => !s.oculto);
  const ocultas = slides.filter((s) => s.oculto);
  // Lo mismo con los datos comunes del informe: cada guardado trae un objeto nuevo aunque no hayan cambiado.
  const [cacheMeta] = useState(() => new Map<string, MetaInforme | null>());
  const meta = useMemo(() => {
    const json = JSON.stringify(contenido?.meta ?? null);
    if (!cacheMeta.has(json)) {
      cacheMeta.clear();
      cacheMeta.set(json, contenido?.meta ?? null);
    }
    return cacheMeta.get(json) ?? null;
  }, [contenido, cacheMeta]);
  // Slides anteriores a cada cambio de esta sesión, para «Deshacer» (la más reciente, al final).
  const [anteriores, setAnteriores] = useState<Record<string, SlideJson[]>>({});
  // Información que el equipo ha dirigido a slides concretas y todavía no se ha usado para montarlas.
  const pendientes = useMemo(
    () => (contenido ? pendientesDirigidas(informe.seleccion, h.fuentes, contenido.slides) : []),
    [contenido, informe.seleccion, h.fuentes],
  );
  const [montando, setMontando] = useState(false);

  // Historial y coste: se recargan tras cada guardado.
  useEffect(() => {
    let vivo = true;
    void accionHistorial(informe.id).then((r) => {
      if (!vivo || !r.ok) return;
      setHistorial(r.data.cambios);
      setUso(r.data.uso);
    });
    return () => {
      vivo = false;
    };
  }, [informe.id, informe.actualizado]);

  const medidasQa: Record<string, MedidaQa> = useMemo(() => {
    const out: Record<string, MedidaQa> = {};
    for (const [id, m] of Object.entries(medidas)) {
      out[id] = { pendientes: m.pendientes, relleno: m.medida?.relleno ?? null, desborde: m.medida?.desborde, error: m.error };
    }
    return out;
  }, [medidas]);
  const qa = useMemo(() => (contenido ? qaMecanico(contenido.slides, medidasQa, informe) : []), [contenido, medidasQa, informe]);
  const medidasCompletas = visibles.every((s) => medidas[s.id]);
  const bloqueantes = qa.filter((x) => x.nivel === "error");

  if (!contenido) {
    return (
      <Tarjeta>
        <p className="text-sm">Este informe todavía no tiene slides.</p>
        <Boton onClick={() => h.ir("paso3")}>Ir a la biblioteca y GO</Boton>
      </Tarjeta>
    );
  }

  function conSlides(fn: (sl: SlideJson[]) => SlideJson[] | void, cambio: string) {
    const c: InformeJson = clon(contenido!);
    const r = fn(c.slides);
    if (r) c.slides = r;
    renumerar(c.slides);
    void h.guardar({ contenido: c }, cambio);
  }

  /**
   * Sustituye una slide (corrección de Claude o cambio a mano): comprueba que
   * pinta, la guarda y deja la anterior para «Deshacer». Devuelve su medida.
   */
  async function cambiarSlide(
    id: string,
    pagina: number,
    nueva: SlideJson,
    cambio: string,
    deshaciendo = false,
    seleccion?: Seleccion,
  ): Promise<MedidaSlide> {
    const anterior = contenido!.slides.find((s) => s.id === id);
    if (!anterior) throw new Error("la slide ya no existe");
    const m = medirFuera(nueva, pagina, contenido!.meta);
    if (m.error) throw new Error(m.error);
    const c: InformeJson = clon(contenido!);
    c.slides = c.slides.map((x) => (x.id === id ? clon(nueva) : x));
    renumerar(c.slides);
    if (!(await h.guardar(seleccion ? { contenido: c, seleccion } : { contenido: c }, cambio))) throw new Error("no se ha podido guardar");
    setAnteriores((p) => ({ ...p, [id]: deshaciendo ? (p[id] ?? []).slice(0, -1) : [...(p[id] ?? []).slice(-19), anterior] }));
    return m;
  }

  function deshacer(id: string, pagina: number): Promise<MedidaSlide> {
    const previa = anteriores[id]?.at(-1);
    if (!previa) return Promise.reject(new Error("no hay cambios que deshacer"));
    // Si lo que se deshace es un montaje con información dirigida, esa información vuelve a estar pendiente.
    const seleccion = slidesConDirigidas(informe.seleccion, h.fuentes).has(id)
      ? desmarcarAplicadas(seleccionBase(informe.seleccion, informe.analisis), [id])
      : undefined;
    return cambiarSlide(id, pagina, previa, `${tituloDe(previa)}: cambio deshecho`, true, seleccion);
  }

  /**
   * Monta con Claude las slides que tienen información dirigida sin aplicar
   * (todas, o solo una): una petición por slide, que la rehace entera con su
   * documento. Cada una queda con su «Deshacer».
   */
  async function montarDirigidas(soloId?: string) {
    const lista = pendientes.filter((p) => !soloId || p.slide.id === soloId);
    if (!lista.length || montando) return;
    setMontando(true);
    // Varias slides seguidas: se trabaja sobre lo último guardado, no sobre el estado de este render.
    let base: InformeJson = clon(contenido!);
    let seleccion = seleccionBase(informe.seleccion, informe.analisis);
    const permitidos = componentesPermitidos();
    const fallos: string[] = [];
    let hechas = 0;
    for (const [n, p] of lista.entries()) {
      const actual = base.slides.find((s) => s.id === p.slide.id);
      if (!actual) continue;
      const documentos = p.fuentes.map((f) => f.nombre).join(", ");
      setOcupado(`Claude está montando «${tituloDe(actual)}» con ${documentos} (${n + 1} de ${lista.length})…`);
      try {
        const { json } = await pedirClaude({ tipo: "slide", informeId: informe.id, slideId: actual.id, modo: "dirigida", slide: actual });
        let s = actualizarPeriodo(validarSlide(json, actual.id, permitidos), informe);
        s.origen = "actualizada";
        let m = medirFuera(s, p.pagina, base.meta);
        if (m.error) throw new Error(m.error);
        if (m.desborde) {
          // Como en la generación: un ajuste si desborda, y se queda solo si lo arregla.
          setOcupado(`«${tituloDe(s)}» desborda: Claude la está ajustando (${n + 1} de ${lista.length})…`);
          try {
            const { json: j2 } = await pedirClaude({
              tipo: "ajuste",
              informeId: informe.id,
              slide: s,
              medida: { desborde: true, ocupacion: m.ocupacion, relleno: m.relleno },
            });
            const s2 = actualizarPeriodo(validarSlide(j2, actual.id, permitidos), informe);
            s2.origen = "actualizada";
            const m2 = medirFuera(s2, p.pagina, base.meta);
            if (!m2.error && !m2.desborde) {
              s = s2;
              m = m2;
            }
          } catch (e) {
            if (esCancelado(e)) throw e;
          }
        }
        // Lo que el equipo colocó a mano encima de la slide no lo rehace Claude: se queda.
        s = conFlotantesDe(actual, s);
        const c: InformeJson = clon(base);
        c.slides = c.slides.map((x) => (x.id === actual.id ? s : x));
        renumerar(c.slides);
        const marcada = marcarAplicadas(seleccion, [actual.id]);
        if (!(await h.guardar({ contenido: c, seleccion: marcada }, `${tituloDe(s)}: montada con ${documentos}`))) throw new Error("no se ha podido guardar");
        setAnteriores((prev) => ({ ...prev, [actual.id]: [...(prev[actual.id] ?? []).slice(-19), actual] }));
        base = c;
        seleccion = marcada;
        hechas++;
      } catch (e) {
        fallos.push(`${tituloDe(actual)}: ${e instanceof Error && !("code" in e) ? e.message : mensajeErrorClaude(e)}`);
        if (esCancelado(e)) break;
      }
    }
    setMontando(false);
    setOcupado(
      (hechas ? `${hechas} slide(s) montada(s) con la información dirigida. Revísalas: cada una tiene «Deshacer». ` : "") +
        (fallos.length ? `No se han podido montar: ${fallos.join(" · ")}` : ""),
    );
  }

  function mover(id: string, delta: number) {
    conSlides((sl) => {
      const vis = sl.filter((s) => !s.oculto);
      const j = vis.findIndex((s) => s.id === id);
      const otro = vis[j + delta];
      if (!otro) return;
      const a = sl.indexOf(vis[j]!);
      const b = sl.indexOf(otro);
      [sl[a], sl[b]] = [sl[b]!, sl[a]!];
    }, `Orden: ${tituloDe(slides.find((s) => s.id === id)!)} ${delta < 0 ? "sube" : "baja"}`);
    setTimeout(() => document.getElementById(`ed-${id}`)?.scrollIntoView({ block: "center" }), 50);
  }

  function alternarOculto(id: string) {
    const s = slides.find((x) => x.id === id)!;
    conSlides(
      (sl) => {
        const x = sl.find((y) => y.id === id)!;
        x.oculto = !x.oculto;
      },
      `${s.oculto ? "Visible" : "Oculta"}: ${tituloDe(s)}`,
    );
  }

  async function anadir() {
    const b = biblioteca.find((x) => x.n === bib);
    if (!b) return;
    const id = idNuevo(b, contenido!.slides);
    setOcupado(`Claude está redactando «${b.nombre}»…`);
    try {
      const { json } = await pedirClaude({ tipo: "slide", informeId: informe.id, slideId: id, modo: "nueva" });
      const s = actualizarPeriodo(validarSlide(json, id, componentesPermitidos()), informe);
      s.origen = "nueva";
      const m = medirFuera(s, 5, contenido!.meta);
      if (m.error) throw new Error(m.error);
      conSlides((sl) => ordenar([...sl, s]), `Añadida: ${b.nombre}`);
      setOcupado("");
      setTimeout(() => document.getElementById(`ed-${id}`)?.scrollIntoView({ block: "center" }), 300);
    } catch (e) {
      setOcupado(e instanceof Error && !("code" in e) ? `No se pudo añadir: ${e.message}` : mensajeErrorClaude(e));
    }
  }

  async function coherencia() {
    setOcupado("Claude está revisando la coherencia del informe…");
    try {
      const { json } = await pedirClaude({ tipo: "coherencia", informeId: informe.id, slides: contenido!.slides });
      const lista = Array.isArray(json) ? (json as IncidenciaCoherencia[]).slice(0, 12) : [];
      await h.guardar({ qa: { coherencia: lista, fecha: new Date().toISOString() } });
      setOcupado(lista.length ? "" : "Sin incoherencias detectadas.");
    } catch (e) {
      setOcupado(mensajeErrorClaude(e));
    }
  }

  async function guardarVersion() {
    setOcupado(`Guardando la versión ${informe.version}…`);
    const r = await accionGuardarVersion(informe.id);
    if (!r.ok) {
      setOcupado(`No se pudo guardar la versión: ${r.error}`);
      return;
    }
    const c = clon(contenido!);
    c.meta.version = `v${r.data.version}`;
    // Solo en local: el servidor ya ha subido la versión.
    await h.guardar({ version: r.data.version, contenido: c });
    setOcupado(`Versión ${informe.version} guardada. Ahora trabajas en la versión ${r.data.version}.`);
  }

  async function aprobar() {
    if (informe.estado !== "aprobado") {
      if (!medidasCompletas) {
        setOcupado("Espera a que terminen de pintarse y medirse todas las slides.");
        return;
      }
      if (bloqueantes.length) {
        setOcupado(`Hay ${bloqueantes.length} bloqueante(s) en la revisión: resuélvelos antes de aprobar.`);
        return;
      }
      const c = clon(contenido!);
      c.meta.estado = "Aprobado";
      await h.guardar({ estado: "aprobado", contenido: c }, "Aprobado");
    } else {
      const c = clon(contenido!);
      c.meta.estado = "Borrador";
      await h.guardar({ estado: "borrador", contenido: c }, "Vuelve a borrador");
    }
    setOcupado("");
  }

  async function borrar() {
    const r = await accionBorrarInforme(informe.id);
    if (!r.ok) {
      h.avisar(`No se ha podido eliminar el informe: ${r.error}`, "error");
      setConfirmar(false);
      return;
    }
    router.push(rutaListaInformes());
  }

  /** Descarga el PDF hecho en el servidor, con todo lo editado ya guardado. */
  async function descargarPdf() {
    setPdf({ generando: true, error: null });
    try {
      await h.guardadoAlDia();
      const r = await fetch(rutaPdf(informe.id));
      if (!r.ok) {
        const cuerpo = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(cuerpo?.error ?? `el servidor ha respondido ${r.status}.`);
      }
      const nombre = /filename\*=UTF-8''([^;]+)/.exec(r.headers.get("Content-Disposition") ?? "")?.[1];
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = nombre ? decodeURIComponent(nombre) : `${informe.id}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setPdf({ generando: false, error: null });
    } catch (e) {
      setPdf({ generando: false, error: e instanceof Error ? e.message : "error desconocido." });
    }
  }

  const irA = (id: string) => document.getElementById(`ed-${id}`)?.scrollIntoView({ behavior: "smooth" });
  const coh = informe.qa?.coherencia ?? [];

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">
            {informe.proyecto.nombre} · {informe.trimestre}
          </h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-text-muted">
            Versión {informe.version} · <ChipEstado estado={informe.estado} /> · actualizado {fechaCorta(informe.actualizado)}
            {uso?.peticiones ? (
              <span>
                · Claude: {uso.peticiones} peticiones,{" "}
                {uso.costeUsd.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $
              </span>
            ) : null}
            {estadoGuardado ? <span>· {estadoGuardado}</span> : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {confirmar ? (
            <span className="inline-flex flex-wrap items-center gap-2 text-sm">
              ¿Eliminar este informe con sus fuentes, fotos y versiones? No se puede deshacer.
              <button type="button" onClick={() => void borrar()} className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700">
                Sí, eliminar
              </button>
              <Boton pequeno onClick={() => setConfirmar(false)}>
                Cancelar
              </Boton>
            </span>
          ) : (
            <>
              <Link href={rutaListaInformes()} className="text-sm font-medium text-icam-900 hover:underline">
                Volver a la lista
              </Link>
              {puedeEditar ? (
                <Boton variante="peligro" pequeno onClick={() => setConfirmar(true)}>
                  Eliminar informe
                </Boton>
              ) : null}
              <Link href={rutaImprimir(informe.id)} className="text-sm font-medium text-icam-900 hover:underline">
                Vista de impresión
              </Link>
              <Boton variante="primario" disabled={pdf.generando} title="Descarga el informe en PDF, tal como se ve aquí" onClick={() => void descargarPdf()}>
                {pdf.generando ? "Generando PDF…" : "PDF"}
              </Boton>
            </>
          )}
        </div>
      </div>

      {pdf.error ? (
        <Aviso tipo="error">
          No se ha podido generar el PDF: {pdf.error} Mientras tanto puedes sacarlo desde la «Vista de impresión».
        </Aviso>
      ) : null}

      <Tarjeta>
        <h2 className="text-sm font-semibold text-text-primary">Revisión</h2>
        {!medidasCompletas ? (
          <p className="text-sm text-text-muted">Revisando…</p>
        ) : qa.length ? (
          <ul className="space-y-1 text-sm">
            {qa.map((x, i) => (
              <li key={i} className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${x.nivel === "error" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}
                >
                  {x.nivel === "error" ? "Bloqueante" : "Aviso"}
                </span>
                {x.slide} · {x.texto}
                {x.slide ? (
                  <Boton variante="texto" onClick={() => irA(x.slide)}>
                    Ir
                  </Boton>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-muted">Sin incidencias mecánicas: nada desborda, sin [pendiente] y los trimestres cuadran.</p>
        )}
        {coh.length ? (
          <>
            <h3 className="pt-1 text-sm font-semibold text-text-primary">
              Coherencia entre slides <span className="font-normal text-text-muted">· {fechaCorta(informe.qa?.fecha)}</span>
            </h3>
            <ul className="space-y-1 text-sm">
              {coh.map((x, i) => (
                <li key={i}>
                  <b>{x.slide}</b> · {x.problema}
                  {x.sugerencia ? <span className="text-text-muted"> → {x.sugerencia}</span> : null}{" "}
                  <Boton variante="texto" onClick={() => irA(x.slide)}>
                    Ir
                  </Boton>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {bloqueantes.length ? <p className="text-sm text-text-muted">Resuelve los bloqueantes antes de aprobar y exportar la versión final.</p> : null}
      </Tarjeta>

      {puedeEditar ? (
        <Tarjeta>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex min-w-[220px] flex-1 flex-col gap-1.5 text-sm font-medium text-text-primary">
              Añadir slide de la biblioteca
              <select className={claseCampo} value={bib} onChange={(e) => setBib(Number(e.target.value))}>
                {biblioteca
                  .filter((b) => !ESTRUCTURALES.includes(b.id))
                  .map((b) => (
                    <option key={b.n} value={b.n}>
                      {b.n} · {b.nombre}
                    </option>
                  ))}
              </select>
            </label>
            <Boton onClick={() => void anadir()}>Añadir</Boton>
            <Boton
              title="Vuelve a «Información del trimestre» para aportar más documentos, también dirigidos a slides concretas"
              onClick={() => h.ir("paso2")}
            >
              Añadir información
            </Boton>
            <Boton onClick={() => void coherencia()}>Revisar coherencia</Boton>
            <Boton onClick={() => void guardarVersion()}>Guardar versión</Boton>
            <Boton variante={informe.estado === "aprobado" ? "secundario" : "primario"} onClick={() => void aprobar()}>
              {informe.estado === "aprobado" ? "Volver a borrador" : "Marcar como aprobado"}
            </Boton>
          </div>
          {ocupado ? (
            <p className="text-sm text-text-muted" aria-live="polite">
              {ocupado}
            </p>
          ) : null}
        </Tarjeta>
      ) : null}

      {puedeEditar && pendientes.length ? (
        <Tarjeta>
          <h2 className="text-sm font-semibold text-text-primary">Información dirigida a slides, sin aplicar</h2>
          <ul className="space-y-1 text-sm">
            {pendientes.map((p) => (
              <li key={p.slide.id}>
                <b>
                  Slide {p.pagina} · {tituloDe(p.slide)}
                </b>
                <span className="text-text-muted"> ← {p.fuentes.map((f) => f.nombre).join(", ")}</span>{" "}
                <Boton variante="texto" onClick={() => irA(p.slide.id)}>
                  Ir
                </Boton>
              </li>
            ))}
          </ul>
          <p className="text-sm text-text-muted">
            Claude rehace cada una de esas slides por completo con su documento: elige la plantilla y copia las cifras tal cual, sin calcular
            ninguna. Es una petición por slide.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Boton variante="primario" disabled={montando} onClick={() => void montarDirigidas()}>
              {montando ? "Montando…" : `Montar ${pendientes.length === 1 ? "la slide" : `las ${pendientes.length} slides`} con Claude`}
            </Boton>
          </div>
        </Tarjeta>
      ) : null}

      {informe.estado === "aprobado" ? <Aviso tipo="ok">Informe aprobado. El PDF sale sin marcas de borrador.</Aviso> : null}

      <div className="flex flex-col gap-6">
        {visibles.map((s, i) => (
          <TarjetaSlide
            key={s.id}
            h={h}
            slide={s}
            pagina={i + 1}
            total={visibles.length}
            meta={meta!}
            medida={medidas[s.id]}
            onPintado={(r) => setMedidas((m) => ({ ...m, [s.id]: r }))}
            mover={(d) => mover(s.id, d)}
            ocultar={() => alternarOculto(s.id)}
            cambiar={(nueva, cambio) => cambiarSlide(s.id, i + 1, nueva, cambio)}
            deshacer={anteriores[s.id]?.length ? () => deshacer(s.id, i + 1) : null}
            dirigida={pendientes.find((p) => p.slide.id === s.id)?.fuentes.map((f) => f.nombre) ?? null}
            montarDirigida={montando ? null : () => void montarDirigidas(s.id)}
          />
        ))}
      </div>

      {ocultas.length ? (
        <Tarjeta>
          <h2 className="text-sm font-semibold text-text-primary">Slides ocultas</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {ocultas.map((s) => (
              <li key={s.id}>
                {tituloDe(s)}{" "}
                {puedeEditar ? (
                  <Boton variante="texto" onClick={() => alternarOculto(s.id)}>
                    Mostrar
                  </Boton>
                ) : null}
              </li>
            ))}
          </ul>
        </Tarjeta>
      ) : null}

      {historial?.length ? (
        <details className="rounded-lg border border-subtle/50 bg-card p-4 shadow-sm">
          <summary className="cursor-pointer text-sm font-semibold text-text-primary">Historial de cambios</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {historial.map((c) => (
              <li key={c.id}>
                <span className="text-text-muted">
                  {fechaCorta(c.fecha)}
                  {c.autor ? ` · ${c.autor}` : ""}
                </span>{" "}
                · {c.texto}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
