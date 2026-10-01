"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { accionAnadirFuente } from "../../actions/informes";
import { arbolBloques, desplegar, normalizar } from "../../logic/edicion";
import { actualizarPeriodo, tituloDe, validarSlide } from "../../logic/informe";
import { urlFoto } from "../../logic/paths";
import { componentesPermitidos } from "../../slides/components";
import type { MedidaSlide } from "../../slides/motor";
import type { MetaInforme, SlideJson } from "../../slides/tipos";
import { Boton, Chip, claseCampo } from "../componentes";
import type { HerramientaInforme } from "../InformeApp";
import { subirFotoInforme } from "../asistente/PasoFuentes";
import { ZonaSoltar } from "../asistente/ZonaSoltar";
import { mensajeErrorClaude, pedirClaude, type ImagenClaude } from "../lib/claude";
import { aBase64, ACEPTA_DOCUMENTOS, extraerTexto, redimensionar } from "../lib/ficheros";
import { VisorSlide, type ResultadoVisor } from "../slides/VisorSlide";
import { CapaEdicion, type ModoEdicion } from "./CapaEdicion";
import { CapaMarcas } from "./CapaMarcas";
import { ListaTextos } from "./ListaTextos";
import { capturaMarcada, HERRAMIENTAS, marcasTexto, NOMBRE_MARCA, type Herramienta, type Marca } from "./marcas";

interface Adjunto {
  tipo: "imagen" | "documento" | "tabla";
  nombre: string;
  file?: File;
  url?: string;
  texto?: string;
}

interface Props {
  h: HerramientaInforme;
  slide: SlideJson;
  pagina: number;
  total: number;
  meta: MetaInforme;
  medida: (ResultadoVisor & { pendientes: number }) | undefined;
  onPintado: (r: ResultadoVisor) => void;
  mover: (delta: number) => void;
  ocultar: () => void;
  /** Sustituye esta slide por otra: comprueba que pinta, la guarda y deja la anterior para «Deshacer». */
  cambiar: (nueva: SlideJson, cambio: string) => Promise<MedidaSlide>;
  /** Vuelve a la slide anterior al último cambio; null si no hay nada que deshacer. */
  deshacer: (() => Promise<MedidaSlide>) | null;
}

/** Una slide del editor: vista, chips de relleno/pendientes/origen, edición a mano, marcas y corrección con Claude. */
export function TarjetaSlide({ h, slide, pagina, total, meta, medida, onPintado, mover, ocultar, cambiar, deshacer }: Props) {
  const { informe, puedeEditar } = h;
  const [marcando, setMarcando] = useState(false);
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [herramienta, setHerramienta] = useState<Herramienta>("resaltar");
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [instruccion, setInstruccion] = useState("");
  const [adjuntos, setAdjuntos] = useState<Adjunto[]>([]);
  const [estado, setEstado] = useState("");
  const [trabajando, setTrabajando] = useState(false);
  const lienzo = useRef<HTMLElement | null>(null);
  const [editando, setEditando] = useState<ModoEdicion | null>(null);
  const [listaAbierta, setListaAbierta] = useState(false);
  // Lienzo junto al slide que tiene pintado. La capa de edición trabaja siempre sobre esa pareja y se
  // bloquea mientras no sea la vigente (entre un cambio y su repintado), sin perder la selección.
  const [pintada, setPintada] = useState<{ lienzo: HTMLElement; slide: SlideJson } | null>(null);
  const normalizado = useMemo(() => normalizar(slide), [slide]);
  const pintado = useMemo(() => (pintada ? normalizar(pintada.slide) : null), [pintada]);
  const abrirLista = useCallback(() => setListaAbierta(true), []);
  const [anadiendo, setAnadiendo] = useState(false);
  const terminarAnadir = useCallback(() => setAnadiendo(false), []);
  // Plantillas sin área de bloques (portada, índice, financieras…): ahí no cabe una imagen nueva.
  const admiteImagenNueva = useMemo(() => !!arbolBloques(desplegar(slide)), [slide]);

  /** Cambio hecho a mano (texto, bloque o foto): sin Claude. */
  async function aplicarManual(nueva: SlideJson, cambio: string) {
    setTrabajando(true);
    setEstado("");
    try {
      if (nueva.origen === "heredada") nueva.origen = "actualizada";
      const m = await cambiar(nueva, cambio);
      setEstado(m.desborde ? "Cambio aplicado, pero ahora la slide desborda: acorta el texto o deshaz el cambio." : "");
    } catch (e) {
      setEstado(`No se pudo aplicar el cambio: ${e instanceof Error ? e.message : "error"}`);
    } finally {
      setTrabajando(false);
    }
  }

  async function deshacerCambio() {
    if (!deshacer) return;
    setTrabajando(true);
    try {
      await deshacer();
      setEstado("Cambio deshecho.");
    } catch (e) {
      setEstado(`No se pudo deshacer: ${e instanceof Error ? e.message : "error"}`);
    } finally {
      setTrabajando(false);
    }
  }

  async function adjuntar(files: File[]) {
    for (const file of files) {
      if (/^image\/(jpeg|png|webp)$/.test(file.type)) {
        setAdjuntos((a) => [...a, { tipo: "imagen", nombre: file.name, file, url: URL.createObjectURL(file) }]);
        continue;
      }
      setEstado(`Leyendo ${file.name}…`);
      try {
        const texto = (await extraerTexto(file)).slice(0, 40_000);
        setAdjuntos((a) => [...a, { tipo: /\.(xlsx|xlsm|csv)$/i.test(file.name) ? "tabla" : "documento", nombre: file.name, texto }]);
        setEstado("");
      } catch (e) {
        setEstado(`No se ha podido leer ${file.name}: ${e instanceof Error ? e.message : "error"}`);
      }
    }
  }

  async function aplicar() {
    let instr = instruccion.trim();
    if (!instr && marcas.length) {
      setEstado("Escribe qué hay que cambiar en lo marcado.");
      return;
    }
    if (!instr && !adjuntos.length) return;
    if (!instr) instr = "Incorpora al slide la información del material adjunto (datos, tablas o imágenes), sin inventar nada.";
    setMarcando(false);
    setTrabajando(true);
    setEstado(adjuntos.length || marcas.length ? "Preparando las marcas y los adjuntos…" : "Claude está aplicando la corrección…");
    try {
      const imgs = adjuntos.filter((a) => a.tipo === "imagen");
      const docs = adjuntos.filter((a) => a.tipo !== "imagen");
      // Las imágenes adjuntas se guardan con las fotos del informe (Claude puede colocarlas) y Claude las ve.
      const subidas: { nombre: string; src: string }[] = [];
      const imagenes: ImagenClaude[] = [];
      for (const a of imgs) {
        const f = await subirFotoInforme(informe.id, a.file!, "Otra", a.nombre.replace(/\.[a-z0-9]+$/i, ""));
        h.setFotos((fs) => [...fs, f]);
        subidas.push({ nombre: a.nombre, src: urlFoto(f.id) });
        imagenes.push({ mediaType: "image/jpeg", data: await aBase64((await redimensionar(a.file!)).blob) });
      }
      for (const a of docs) {
        const r = await accionAnadirFuente(informe.id, { tipo: "correccion", nombre: `[corrección · ${slide.id}] ${a.nombre}`, texto: a.texto ?? "" });
        if (r.ok) h.setFuentes((fs) => [...fs, r.data]);
      }
      let captura: ImagenClaude | null = null;
      if (marcas.length) {
        try {
          captura = { mediaType: "image/jpeg", data: await aBase64(await capturaMarcada(slide, pagina, meta, marcas)) };
        } catch {
          // Sin captura, las marcas van solo como texto.
        }
      }
      let adjTexto = "";
      if (subidas.length) {
        adjTexto +=
          "== IMÁGENES ADJUNTAS A ESTA CORRECCIÓN ==\n" +
          subidas
            .map(
              (s) =>
                `- ${s.nombre} · src "${s.src}" (puedes colocarla en el slide con ImagenMarco o Galeria si la instrucción lo pide o mejora el slide) · la ves adjunta: si contiene datos, una tabla o un texto, extráelos y úsalos`,
            )
            .join("\n") +
          "\n";
      }
      if (docs.length) {
        adjTexto +=
          "== MATERIAL ADJUNTO A ESTA CORRECCIÓN (úsalo como fuente; prevalece sobre lo anterior si se contradicen) ==\n" +
          docs.map((a) => `### ${a.tipo === "tabla" ? "TABLA" : "DOCUMENTO"}: ${a.nombre}\n${a.texto}`).join("\n\n");
      }
      setEstado("Claude está aplicando la corrección…");
      const { json } = await pedirClaude(
        {
          tipo: "correccion",
          informeId: informe.id,
          slide,
          instruccion: instr,
          marcas: marcas.length ? marcasTexto(marcas, !!captura) : undefined,
          adjuntos: adjTexto || undefined,
        },
        { imagenes: [...(captura ? [captura] : []), ...imagenes].slice(0, 4) },
      );
      const avisos = json && typeof json === "object" && Array.isArray((json as { avisos?: unknown }).avisos) ? ((json as { avisos: string[] }).avisos) : [];
      const s = actualizarPeriodo(validarSlide(json, slide.id, componentesPermitidos()), informe);
      s.origen = slide.origen === "nueva" ? "nueva" : "actualizada";
      const m = await cambiar(s, `${tituloDe(s)}: ${instr}${marcas.length ? ` (${marcas.length} marca${marcas.length > 1 ? "s" : ""})` : ""}`);
      setEstado((m.desborde ? "Aplicada, pero ahora desborda: pide acortarla. " : "Aplicada. ") + (avisos.length ? "Revisa también: " + avisos.join(" · ") : ""));
      setInstruccion("");
      adjuntos.forEach((a) => a.url && URL.revokeObjectURL(a.url));
      setAdjuntos([]);
      setMarcas([]);
    } catch (e) {
      setEstado(e instanceof Error && !("code" in e) ? `No se pudo aplicar: ${e.message}` : mensajeErrorClaude(e));
    } finally {
      setTrabajando(false);
    }
  }

  const chips = [];
  if (medida?.error) chips.push(<Chip key="e" tono="error">Error</Chip>);
  else if (medida?.medida?.desborde) chips.push(<Chip key="d" tono="error">Desborda</Chip>);
  else if (medida?.medida) chips.push(<Chip key="r" tono={medida.medida.relleno < 80 ? "aviso" : "ok"}>Relleno {medida.medida.relleno} %</Chip>);
  if (medida?.pendientes) chips.push(<Chip key="p" tono="aviso">{medida.pendientes} pendiente{medida.pendientes > 1 ? "s" : ""}</Chip>);
  if (slide.origen) chips.push(<Chip key="o">{slide.origen}</Chip>);

  return (
    <section className="flex scroll-mt-4 flex-col gap-2" id={`ed-${slide.id}`}>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm">
        <b className="text-text-primary">Slide {pagina}</b>
        <span className="text-text-muted">{tituloDe(slide)}</span>
        <span className="flex flex-wrap gap-1">{chips}</span>
        {puedeEditar ? (
          <span className="ml-auto flex flex-wrap gap-1.5">
            <Boton
              pequeno
              aria-pressed={marcando}
              className={marcando ? "!border-red-600 !bg-red-600 !text-white" : ""}
              title="Pinta, subraya o recuadra sobre la slide lo que quieres cambiar"
              onClick={() => {
                setMarcando(!marcando);
                setEditando(null);
                if (!marcando) setCorrigiendo(true);
              }}
            >
              Marcar
            </Boton>
            <Boton
              pequeno
              aria-pressed={!!editando}
              className={editando ? "!border-icam-900 !bg-icam-900 !text-white" : ""}
              title="Cambia a mano un texto, el sitio de un bloque o una foto, sin pasar por Claude"
              onClick={() => {
                setEditando(editando ? null : "textos");
                setMarcando(false);
              }}
            >
              Editar
            </Boton>
            {deshacer ? (
              <Boton pequeno disabled={trabajando} title="Vuelve a la slide anterior al último cambio" onClick={() => void deshacerCambio()}>
                Deshacer
              </Boton>
            ) : null}
            <Boton pequeno onClick={() => setCorrigiendo(!corrigiendo)}>
              Corregir
            </Boton>
            <Boton pequeno aria-label="Subir" disabled={pagina === 1} onClick={() => mover(-1)}>
              ↑
            </Boton>
            <Boton pequeno aria-label="Bajar" disabled={pagina === total} onClick={() => mover(1)}>
              ↓
            </Boton>
            {!["disclaimer", "cierre"].includes(slide.id) ? (
              <Boton pequeno onClick={ocultar}>
                Ocultar
              </Boton>
            ) : null}
          </span>
        ) : null}
      </div>

      {marcando ? (
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-subtle bg-card px-2.5 py-2 text-sm shadow-sm" role="toolbar" aria-label="Herramientas de marcado">
          {HERRAMIENTAS.map((x) => (
            <Boton
              key={x.id}
              pequeno
              aria-pressed={herramienta === x.id}
              title={x.ayuda}
              className={herramienta === x.id ? "!border-icam-900 !bg-icam-900 !text-white" : ""}
              onClick={() => setHerramienta(x.id)}
            >
              {x.nombre}
            </Boton>
          ))}
          <span className="text-text-muted">Marca sobre la slide lo que quieres cambiar; cada marca lleva un número que puedes citar en el texto.</span>
          <span className="ml-auto flex gap-1.5">
            <Boton pequeno onClick={() => setMarcas((m) => m.slice(0, -1))}>
              Deshacer
            </Boton>
            <Boton pequeno onClick={() => setMarcas([])}>
              Borrar marcas
            </Boton>
            <Boton pequeno variante="primario" onClick={() => setMarcando(false)}>
              Listo
            </Boton>
          </span>
        </div>
      ) : null}

      {editando ? (
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-subtle bg-card px-2.5 py-2 text-sm shadow-sm" role="toolbar" aria-label="Edición a mano">
          {(
            [
              ["textos", "Textos"],
              ["disposicion", "Disposición"],
            ] as const
          ).map(([modo, nombre]) => (
            <Boton
              key={modo}
              pequeno
              aria-pressed={editando === modo}
              className={editando === modo ? "!border-icam-900 !bg-icam-900 !text-white" : ""}
              onClick={() => setEditando(modo)}
            >
              {nombre}
            </Boton>
          ))}
          <Boton
            pequeno
            disabled={trabajando || !admiteImagenNueva || pintada?.slide !== slide}
            title={
              admiteImagenNueva
                ? "Sube una imagen de tu ordenador o elígela de la biblioteca del proyecto: entra como un bloque más de la slide"
                : "La plantilla de esta slide no admite imágenes nuevas; las que ya tiene se cambian pulsando sobre ellas"
            }
            onClick={() => {
              setEditando("disposicion");
              setAnadiendo(true);
            }}
          >
            ＋ Añadir imagen
          </Boton>
          <span className="text-text-muted">
            {editando === "textos"
              ? "Pulsa sobre un texto de la slide para cambiarlo."
              : "Pulsa un bloque para moverlo con los botones o arrástralo. Cada imagen tiene su botón para cambiarla."}
          </span>
          <span className="ml-auto flex gap-1.5">
            <Boton pequeno aria-pressed={listaAbierta} onClick={() => setListaAbierta(!listaAbierta)}>
              Todos los textos
            </Boton>
            <Boton
              pequeno
              variante="primario"
              onClick={() => {
                setEditando(null);
                setListaAbierta(false);
                setAnadiendo(false);
              }}
            >
              Listo
            </Boton>
          </span>
        </div>
      ) : null}

      <div
        className={
          marcando
            ? "rounded-md outline outline-2 outline-offset-2 outline-red-600"
            : editando
              ? "rounded-md outline outline-2 outline-offset-2 outline-icam-900"
              : ""
        }
      >
        <VisorSlide
          slide={slide}
          pagina={pagina}
          meta={meta}
          className="rounded-md border border-subtle shadow-sm"
          onPintado={(r, l, s) => {
            lienzo.current = l;
            setPintada({ lienzo: l, slide: s });
            onPintado(r);
          }}
        >
          <CapaMarcas
            marcas={marcas}
            activa={marcando}
            herramienta={herramienta}
            lienzo={() => lienzo.current}
            onMarca={(m) => setMarcas((ms) => [...ms, m])}
            etiqueta={`Capa de marcas de la slide ${pagina}`}
          />
          {editando && pintada && pintado ? (
            <CapaEdicion
              slide={pintado}
              lienzo={pintada.lienzo}
              modo={editando}
              informeId={informe.id}
              trimestre={informe.trimestre}
              alSubirFoto={(f) => h.setFotos((fs) => [...fs, f])}
              anadiendo={anadiendo}
              alTerminarAnadir={terminarAnadir}
              trabajando={trabajando || pintada.slide !== slide}
              aplicar={(nueva, cambio) => void aplicarManual(nueva, cambio)}
              avisar={setEstado}
              abrirLista={abrirLista}
            />
          ) : null}
        </VisorSlide>
      </div>

      {editando && listaAbierta ? (
        <ListaTextos slide={normalizado} trabajando={trabajando} aplicar={(nueva, cambio) => void aplicarManual(nueva, cambio)} />
      ) : null}

      {corrigiendo && puedeEditar ? (
        <div className="flex flex-col gap-2 rounded-lg border border-subtle bg-card p-3 shadow-sm">
          {marcas.length ? (
            <p className="text-sm text-text-muted">
              <b>Marcas:</b>{" "}
              {marcas
                .map((m, i) => {
                  const t = m.textos?.length ? m.textos[0]!.marcado || m.textos[0]!.texto : m.imagenes?.length ? "imagen" : "zona sin texto";
                  return `${i + 1} · ${NOMBRE_MARCA[m.tipo]} — «${t.length > 60 ? t.slice(0, 57) + "…" : t}»`;
                })
                .join(" · ")}
              . Explica abajo qué cambiar en cada una (p. ej. «1: pon noviembre; 2: quita la fila de seguros»).
            </p>
          ) : null}
          <label className="flex flex-col gap-1.5 text-sm font-medium text-text-primary">
            ¿Qué hay que cambiar en esta slide?
            <textarea
              className={`${claseCampo} min-h-[70px]`}
              value={instruccion}
              onChange={(e) => setInstruccion(e.target.value)}
              placeholder="Ej.: la entrega al operador es en noviembre de 2026; quita el párrafo de seguros. Puedes pegar aquí una tabla copiada de Excel."
            />
          </label>
          <ZonaSoltar acepta={`image/jpeg,image/png,image/webp,${ACEPTA_DOCUMENTOS}`} multiple pequena onFicheros={(f) => void adjuntar(f)} deshabilitado={trabajando}>
            Adjuntar imágenes, documentos o tablas (JPG, PNG, PDF, Word, PowerPoint, Excel, CSV): arrastra aquí o pulsa para elegir
          </ZonaSoltar>
          {adjuntos.length ? (
            <div className="flex flex-wrap gap-1.5">
              {adjuntos.map((a, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-subtle bg-page px-2 py-0.5 text-xs">
                  {a.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.url} alt="" className="h-5 w-7 rounded object-cover" />
                  ) : a.tipo === "tabla" ? (
                    "▦"
                  ) : (
                    "▤"
                  )}
                  {a.nombre}
                  {a.texto ? <span className="text-text-muted">· {a.texto.length.toLocaleString("es-ES")} car.</span> : null}
                  <button type="button" aria-label={`Quitar ${a.nombre}`} onClick={() => setAdjuntos((x) => x.filter((_, j) => j !== i))}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          <p className="text-xs text-text-muted">
            Las imágenes se guardan con las fotos del informe y Claude las ve al corregir; los documentos y tablas se leen en tu navegador y se
            añaden a las fuentes del trimestre.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Boton variante="primario" pequeno disabled={trabajando} onClick={() => void aplicar()}>
              {trabajando ? "Aplicando…" : "Aplicar corrección"}
            </Boton>
            <span className="text-sm text-text-muted" aria-live="polite">
              {estado}
            </span>
          </div>
        </div>
      ) : estado ? (
        <p className="text-sm text-text-muted">{estado}</p>
      ) : null}
      {slide.fuentes ? <p className="text-xs text-text-muted">Fuentes: {slide.fuentes}</p> : null}
    </section>
  );
}
