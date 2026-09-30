"use client";

import { useEffect, useRef, useState } from "react";

import { ALTO, ANCHO, cajaMarca, contenidoBajo, trazarMarca, type Herramienta, type Marca, type Punto } from "./marcas";

interface Props {
  marcas: Marca[];
  activa: boolean;
  herramienta: Herramienta;
  /** Slide pintada, para saber qué texto queda bajo cada marca. */
  lienzo: () => HTMLElement | null;
  onMarca: (m: Marca) => void;
  etiqueta: string;
}

/** Capa de dibujo sobre la slide del editor. */
export function CapaMarcas({ marcas, activa, herramienta, lienzo, onMarca, etiqueta }: Props) {
  const cv = useRef<HTMLCanvasElement>(null);
  const [trazo, setTrazo] = useState<Marca | null>(null);

  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const k = c.width / ANCHO;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    marcas.forEach((m, i) => trazarMarca(ctx, m, i + 1));
    if (trazo) trazarMarca(ctx, trazo, marcas.length + 1);
  }, [marcas, trazo]);

  function punto(e: React.PointerEvent): Punto {
    const r = cv.current!.getBoundingClientRect();
    return [
      Math.max(0, Math.min(ANCHO, ((e.clientX - r.left) * ANCHO) / r.width)),
      Math.max(0, Math.min(ALTO, ((e.clientY - r.top) * ALTO) / r.height)),
    ];
  }

  function terminar() {
    if (!trazo) return;
    const m = trazo;
    setTrazo(null);
    const b = cajaMarca(m);
    const util = m.tipo === "recuadro" ? b.x1 - b.x0 > 6 && b.y1 - b.y0 > 6 : m.tipo === "subrayar" ? b.x1 - b.x0 > 6 : true;
    if (!util) return;
    const l = lienzo();
    onMarca(l ? { ...m, ...contenidoBajo(l, m) } : m);
  }

  return (
    <canvas
      ref={cv}
      width={ANCHO * 2}
      height={ALTO * 2}
      aria-label={etiqueta}
      className={`absolute inset-0 h-full w-full ${activa ? "cursor-crosshair touch-none" : "pointer-events-none"}`}
      onPointerDown={(e) => {
        if (!activa || e.button > 0) return;
        e.preventDefault();
        cv.current!.setPointerCapture(e.pointerId);
        const p = punto(e);
        setTrazo({ tipo: herramienta, puntos: herramienta === "resaltar" || herramienta === "lapiz" ? [p] : [p, p] });
      }}
      onPointerMove={(e) => {
        if (!trazo) return;
        const p = punto(e);
        const pts = [...trazo.puntos];
        if (trazo.tipo === "subrayar") {
          // Recta horizontal salvo que se incline a propósito.
          pts[1] = [p[0], pts[0]![1] + (Math.abs(p[1] - pts[0]![1]) < 12 ? 0 : p[1] - pts[0]![1])];
        } else if (trazo.tipo === "recuadro") pts[1] = p;
        else {
          const u = pts[pts.length - 1]!;
          if (Math.hypot(p[0] - u[0], p[1] - u[1]) >= 2) pts.push(p);
        }
        setTrazo({ ...trazo, puntos: pts });
      }}
      onPointerUp={terminar}
      onPointerCancel={terminar}
    />
  );
}
