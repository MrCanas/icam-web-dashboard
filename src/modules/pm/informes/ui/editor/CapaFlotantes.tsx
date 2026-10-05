"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  ALTO_SLIDE,
  ANCHO_SLIDE,
  anadirFlotante,
  cambiarFotoFlotante,
  colocarFlotante,
  confirmarFlotante,
  flotantesValidos,
  limitarCaja,
  MIN_FLOTANTE,
  quitarFlotante,
  reencuadrarFlotante,
  type CajaSlide,
} from "../../logic/flotantes";
import { tituloDe } from "../../logic/informe";
import type { Flotante, SlideJson } from "../../slides/tipos";
import type { Foto } from "../../types";
import { DialogoImagen } from "./DialogoImagen";
import { encuadreAlPulsar } from "./mapa";
import { puntoEnSlide, type Punto } from "./marcas";

interface Props {
  /** Slide que está pintado en `lienzo`. */
  slide: SlideJson;
  lienzo: HTMLElement;
  /** Informe abierto: lo que se suba al elegir una imagen se guarda en él. */
  informeId: string;
  trimestre: string;
  alSubirFoto: (f: Foto) => void;
  /** Se ha pulsado «Imagen en un área»: se elige la imagen y después se dibuja dónde va. */
  anadiendo: boolean;
  alTerminarAnadir: () => void;
  trabajando: boolean;
  aplicar: (nueva: SlideJson, cambio: string) => void;
  avisar: (texto: string) => void;
}

/** Tirador de una esquina o un lado: n, s, e, o (oeste) y sus combinaciones. */
type Lado = "n" | "s" | "e" | "o" | "ne" | "no" | "se" | "so";

const TIRADORES: { lado: Lado; fx: number; fy: number; cursor: string }[] = [
  { lado: "no", fx: 0, fy: 0, cursor: "nwse-resize" },
  { lado: "n", fx: 0.5, fy: 0, cursor: "ns-resize" },
  { lado: "ne", fx: 1, fy: 0, cursor: "nesw-resize" },
  { lado: "e", fx: 1, fy: 0.5, cursor: "ew-resize" },
  { lado: "se", fx: 1, fy: 1, cursor: "nwse-resize" },
  { lado: "s", fx: 0.5, fy: 1, cursor: "ns-resize" },
  { lado: "so", fx: 0, fy: 1, cursor: "nesw-resize" },
  { lado: "o", fx: 0, fy: 0.5, cursor: "ew-resize" },
];

const FLECHAS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

type Gesto =
  | { tipo: "dibujar"; p0: Punto; caja: CajaSlide }
  | { tipo: "mover" | "tirador" | "teclas"; id: string; lado?: Lado; p0: Punto; caja0: CajaSlide; caja: CajaSlide; movido: boolean };

const entre = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

function cajaDe(f: Flotante): CajaSlide {
  return { x: f.x, y: f.y, ancho: f.ancho, alto: f.alto };
}

function mismaCaja(a: CajaSlide, b: CajaSlide): boolean {
  return a.x === b.x && a.y === b.y && a.ancho === b.ancho && a.alto === b.alto;
}

function dentro(c: CajaSlide, p: Punto): boolean {
  return p[0] >= c.x && p[0] <= c.x + c.ancho && p[1] >= c.y && p[1] <= c.y + c.alto;
}

/** La caja con el lado o la esquina del tirador desplazados; los lados opuestos no se mueven. */
function estirar(c: CajaSlide, lado: Lado, dx: number, dy: number): CajaSlide {
  let izq = c.x;
  let arr = c.y;
  let der = c.x + c.ancho;
  let aba = c.y + c.alto;
  if (lado.includes("o")) izq = entre(izq + dx, 0, der - MIN_FLOTANTE);
  if (lado.includes("e")) der = entre(der + dx, izq + MIN_FLOTANTE, ANCHO_SLIDE);
  if (lado.includes("n")) arr = entre(arr + dy, 0, aba - MIN_FLOTANTE);
  if (lado.includes("s")) aba = entre(aba + dy, arr + MIN_FLOTANTE, ALTO_SLIDE);
  return limitarCaja({ x: izq, y: arr, ancho: der - izq, alto: aba - arr });
}

/**
 * Capa de las imágenes libres: se elige una imagen, se dibuja el área donde va
 * y queda ahí, por encima del contenido de la slide. Después se mueve
 * arrastrándola o con las flechas, se redimensiona con los tiradores, se
 * reencuadra, se cambia o se quita. Vale en cualquier slide: no depende de la
 * plantilla. No llama a Claude: cada cambio sale como un slide nuevo por `aplicar`.
 */
export function CapaFlotantes({ slide, lienzo, informeId, trimestre, alSubirFoto, anadiendo, alTerminarAnadir, trabajando, aplicar, avisar }: Props) {
  const capa = useRef<HTMLDivElement>(null);
  const titulo = tituloDe(slide);
  const flotantes = useMemo(() => flotantesValidos(slide.flotantes), [slide]);
  const [ancho, setAncho] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const [gesto, setGesto] = useState<Gesto | null>(null);
  /** Imagen elegida que espera a que se dibuje su área. */
  const [dibujando, setDibujando] = useState<string | null>(null);
  const [cambiando, setCambiando] = useState(false);
  const [reencuadrando, setReencuadrando] = useState(false);
  // Lo último que se ha soltado, para que no vuelva a su sitio anterior mientras se guarda y se repinta la slide.
  const [soltada, setSoltada] = useState<{ slide: SlideJson; id: string | null; src: string; caja: CajaSlide } | null>(null);
  const pendiente = soltada && soltada.slide === slide && trabajando ? soltada : null;

  const elegida = flotantes.find((f) => f.id === sel) ?? null;
  const k = ancho / ANCHO_SLIDE;

  useEffect(() => {
    const c = capa.current;
    if (!c) return;
    const ro = new ResizeObserver(() => setAncho(c.clientWidth));
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  // Con una imagen esperando su área, Esc la descarta aunque el foco siga en el botón o en el diálogo que se acaba de cerrar.
  useEffect(() => {
    if (!dibujando) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setGesto(null);
      setDibujando(null);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [dibujando]);

  /** Dónde se ve ahora una imagen: lo que marca el gesto en curso, lo recién soltado o lo guardado. */
  const cajaVista = (f: Flotante): CajaSlide =>
    gesto && gesto.tipo !== "dibujar" && gesto.id === f.id ? gesto.caja : pendiente?.id === f.id ? pendiente.caja : cajaDe(f);

  // La imagen pintada sigue al gesto; al terminar vuelve a lo que diga el slide.
  useEffect(() => {
    const pintadas = flotantes.map((f) => ({ f, im: lienzo.querySelector<HTMLElement>(`img[data-flotante="${CSS.escape(f.id)}"]`) }));
    const poner = (im: HTMLElement | null, c: CajaSlide) => {
      if (!im) return;
      im.style.left = `${c.x}px`;
      im.style.top = `${c.y}px`;
      im.style.width = `${c.ancho}px`;
      im.style.height = `${c.alto}px`;
    };
    pintadas.forEach(({ f, im }) => poner(im, cajaVista(f)));
    return () => pintadas.forEach(({ f, im }) => poner(im, cajaDe(f)));
  });

  function alPulsar(e: React.PointerEvent) {
    // Los eventos del diálogo de imagen suben hasta aquí por el árbol de React aunque se pinte fuera.
    if (!capa.current || trabajando || anadiendo || cambiando || e.button > 0) return;
    const p = puntoEnSlide(e, capa.current);
    capa.current.focus();
    if (dibujando) {
      e.preventDefault();
      capa.current.setPointerCapture(e.pointerId);
      setGesto({ tipo: "dibujar", p0: p, caja: { x: p[0], y: p[1], ancho: 0, alto: 0 } });
      return;
    }
    // La de más arriba de las que hay bajo el puntero.
    const f = flotantes.findLast((x) => dentro(x, p));
    if (!f) {
      setSel(null);
      setReencuadrando(false);
      return;
    }
    if (f.id !== sel) setReencuadrando(false);
    e.preventDefault();
    capa.current.setPointerCapture(e.pointerId);
    setSel(f.id);
    setGesto({ tipo: "mover", id: f.id, p0: p, caja0: cajaDe(f), caja: cajaDe(f), movido: false });
  }

  function alPulsarTirador(e: React.PointerEvent, lado: Lado) {
    e.stopPropagation();
    if (!capa.current || !elegida || trabajando || e.button > 0) return;
    e.preventDefault();
    capa.current.focus();
    capa.current.setPointerCapture(e.pointerId);
    setGesto({ tipo: "tirador", id: elegida.id, lado, p0: puntoEnSlide(e, capa.current), caja0: cajaDe(elegida), caja: cajaDe(elegida), movido: false });
  }

  function alMover(e: React.PointerEvent) {
    if (!gesto || gesto.tipo === "teclas" || !capa.current) return;
    const p = puntoEnSlide(e, capa.current);
    if (gesto.tipo === "dibujar") {
      setGesto({
        ...gesto,
        caja: { x: Math.min(gesto.p0[0], p[0]), y: Math.min(gesto.p0[1], p[1]), ancho: Math.abs(p[0] - gesto.p0[0]), alto: Math.abs(p[1] - gesto.p0[1]) },
      });
      return;
    }
    const dx = p[0] - gesto.p0[0];
    const dy = p[1] - gesto.p0[1];
    // Al reencuadrar, pulsar sobre la foto elige el punto: no la arrastra.
    if (gesto.tipo === "mover" && reencuadrando) return;
    if (!gesto.movido && Math.hypot(dx, dy) * k <= 4) return;
    const caja =
      gesto.tipo === "tirador" ? estirar(gesto.caja0, gesto.lado!, dx, dy) : limitarCaja({ ...gesto.caja0, x: gesto.caja0.x + dx, y: gesto.caja0.y + dy });
    setGesto({ ...gesto, caja, movido: true });
  }

  /** Termina el gesto en curso y, si ha cambiado algo, lo aplica. */
  function terminar() {
    const g = gesto;
    setGesto(null);
    if (!g) return;
    if (g.tipo === "dibujar") {
      if (!dibujando) return;
      if (g.caja.ancho < MIN_FLOTANTE || g.caja.alto < MIN_FLOTANTE) {
        avisar("Arrastra sobre la slide para marcar el área que debe ocupar la imagen.");
        return;
      }
      const r = anadirFlotante(slide, dibujando, g.caja);
      setSoltada({ slide, id: null, src: dibujando, caja: limitarCaja(g.caja) });
      setDibujando(null);
      setSel(r.id);
      aplicar(r.slide, `${titulo}: imagen colocada en un área`);
      return;
    }
    const f = flotantes.find((x) => x.id === g.id);
    if (!f) return;
    if (!g.movido) {
      if (g.tipo !== "mover" || !reencuadrando) return;
      const im = lienzo.querySelector(`img[data-flotante="${CSS.escape(f.id)}"]`);
      if (!(im instanceof HTMLImageElement)) return;
      const foco = encuadreAlPulsar(im, (g.p0[0] - f.x) / f.ancho, (g.p0[1] - f.y) / f.alto, { x: f.focalX ?? 0.5, y: f.focalY ?? 0.5 });
      aplicar(reencuadrarFlotante(slide, f.id, foco.x, foco.y), `${titulo}: imagen reencuadrada`);
      return;
    }
    if (mismaCaja(g.caja, g.caja0)) return;
    setSoltada({ slide, id: f.id, src: f.src, caja: g.caja });
    aplicar(colocarFlotante(slide, f.id, g.caja), `${titulo}: imagen ${g.tipo === "tirador" ? "redimensionada" : "movida"}`);
  }

  function quitar() {
    if (!elegida) return;
    setSel(null);
    setReencuadrando(false);
    aplicar(quitarFlotante(slide, elegida.id), `${titulo}: imagen quitada`);
  }

  function alTeclear(e: React.KeyboardEvent) {
    // Solo las teclas de la capa: las del diálogo y las de los botones también suben hasta aquí.
    if (e.target !== capa.current) return;
    if (e.key === "Escape") {
      if (gesto) setGesto(null);
      else if (dibujando) setDibujando(null);
      else if (reencuadrando) setReencuadrando(false);
      else setSel(null);
      return;
    }
    if (trabajando || !elegida || dibujando) return;
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      quitar();
      return;
    }
    const d = FLECHAS[e.key];
    if (!d || (gesto && gesto.tipo !== "teclas")) return;
    e.preventDefault();
    // Mientras se mantiene la tecla, la imagen se mueve; se guarda al soltarla.
    const paso = e.shiftKey ? 10 : 1;
    const caja0 = gesto?.tipo === "teclas" && gesto.id === elegida.id ? gesto.caja0 : cajaDe(elegida);
    const desde = gesto?.tipo === "teclas" && gesto.id === elegida.id ? gesto.caja : caja0;
    setGesto({
      tipo: "teclas",
      id: elegida.id,
      p0: [0, 0],
      caja0,
      caja: limitarCaja({ ...desde, x: desde.x + d[0] * paso, y: desde.y + d[1] * paso }),
      movido: true,
    });
  }

  const px = (c: CajaSlide): React.CSSProperties => ({ left: c.x * k, top: c.y * k, width: c.ancho * k, height: c.alto * k });
  const boton = "rounded border border-subtle bg-card px-1.5 py-0.5 text-xs font-medium text-text-primary hover:bg-page disabled:opacity-40";
  /** Sitio de la barra de la imagen elegida: encima si cabe y, si no, dentro, arriba. */
  const sobre = (c: CajaSlide): React.CSSProperties => ({
    left: Math.max(4, Math.min(c.x * k, ancho - 364)),
    top: c.y * k >= 34 ? c.y * k - 32 : c.y * k + 4,
    maxWidth: ancho - 8,
  });
  // Área que se está dibujando, o la recién dibujada mientras se guarda.
  const nueva = gesto?.tipo === "dibujar" && dibujando ? { src: dibujando, caja: gesto.caja } : pendiente && pendiente.id === null ? pendiente : null;

  return (
    <div
      ref={capa}
      tabIndex={0}
      aria-label={`Imágenes libres de ${titulo}`}
      className={`absolute inset-0 touch-none select-none outline-none ${dibujando ? "cursor-crosshair" : ""}`}
      onPointerDown={alPulsar}
      onPointerMove={alMover}
      onPointerUp={terminar}
      onPointerCancel={() => setGesto(null)}
      onKeyDown={alTeclear}
      onKeyUp={(e) => {
        if (gesto?.tipo === "teclas" && e.key in FLECHAS) terminar();
      }}
      onBlur={() => {
        if (gesto?.tipo === "teclas") terminar();
      }}
    >
      {ancho
        ? flotantes.map((f) => {
            const es = f.id === elegida?.id;
            return (
              <div
                key={f.id}
                className={`absolute ${es ? "outline outline-2 outline-amber-500" : "outline-dashed outline-1 outline-amber-500/70"} ${
                  dibujando ? "" : es && reencuadrando ? "cursor-crosshair" : "cursor-move"
                }`}
                style={px(cajaVista(f))}
              />
            );
          })
        : null}

      {nueva && ancho ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={nueva.src} alt="" className="pointer-events-none absolute max-w-none object-cover outline outline-2 outline-amber-500" style={px(nueva.caja)} />
      ) : null}

      {elegida && ancho && !dibujando && !reencuadrando && !trabajando && gesto?.tipo !== "mover"
        ? TIRADORES.map((t) => {
            const c = cajaVista(elegida);
            return (
              <div
                key={t.lado}
                className="absolute z-10 h-2.5 w-2.5 rounded-sm border border-amber-600 bg-white shadow"
                style={{ left: (c.x + t.fx * c.ancho) * k - 5, top: (c.y + t.fy * c.alto) * k - 5, cursor: t.cursor }}
                onPointerDown={(e) => alPulsarTirador(e, t.lado)}
              />
            );
          })
        : null}

      {elegida && ancho && !gesto && !dibujando ? (
        <div
          className="absolute z-20 flex flex-wrap items-center gap-1 rounded-md border border-subtle bg-card px-1.5 py-1 text-xs shadow-md"
          style={sobre(cajaVista(elegida))}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <span className="px-1 font-medium text-text-muted">Imagen libre</span>
          <button type="button" className={boton} disabled={trabajando} onClick={() => setCambiando(true)}>
            Cambiar imagen
          </button>
          <button
            type="button"
            className={`${boton} ${reencuadrando ? "!border-amber-500 !bg-amber-100" : ""}`}
            aria-pressed={reencuadrando}
            disabled={trabajando}
            title="Pulsa sobre la foto lo que quieres que quede en el centro"
            onClick={() => setReencuadrando(!reencuadrando)}
          >
            Reencuadrar
          </button>
          {elegida.heredada ? (
            <button
              type="button"
              className={boton}
              disabled={trabajando}
              title="Viene del informe anterior: confirma que sigue bien colocada y deja de avisar en la revisión"
              onClick={() => aplicar(confirmarFlotante(slide, elegida.id), `${titulo}: imagen del informe anterior revisada`)}
            >
              Dar por buena
            </button>
          ) : null}
          <button type="button" className={boton} disabled={trabajando} onClick={quitar}>
            Quitar
          </button>
          {reencuadrando ? <span className="text-text-muted">Pulsa en la foto el punto que debe quedar centrado.</span> : null}
        </div>
      ) : null}

      {dibujando || !flotantes.length ? (
        <p className="pointer-events-none absolute left-2 top-2 max-w-[70%] rounded-md border border-subtle bg-card px-2 py-1 text-xs text-text-muted shadow-sm">
          {dibujando
            ? "Arrastra sobre la slide para marcar el área que debe ocupar la imagen. Esc cancela."
            : "Esta slide no tiene imágenes libres: pulsa «＋ Imagen en un área» para colocar una donde quieras."}
        </p>
      ) : null}

      {anadiendo ? (
        <DialogoImagen
          titulo="Imagen en un área"
          informeId={informeId}
          trimestre={trimestre}
          actual={null}
          categoria="Otra"
          onSubida={alSubirFoto}
          onCerrar={alTerminarAnadir}
          onElegir={(src) => {
            alTerminarAnadir();
            setSel(null);
            setReencuadrando(false);
            setDibujando(src);
          }}
        />
      ) : null}
      {elegida && cambiando ? (
        <DialogoImagen
          titulo="Cambiar imagen"
          informeId={informeId}
          trimestre={trimestre}
          actual={elegida.src}
          categoria="Otra"
          onSubida={alSubirFoto}
          onCerrar={() => setCambiando(false)}
          onElegir={(src) => {
            setCambiando(false);
            aplicar(cambiarFotoFlotante(slide, elegida.id, src), `${titulo}: imagen cambiada`);
          }}
        />
      ) : null}
    </div>
  );
}
