"use client";

/**
 * Fuentes de las slides (Baskervville y Lato), desde Google Fonts como el
 * visor original. React 19 sube el <link> al <head> y lo deduplica.
 */
export const URL_FUENTES =
  "https://fonts.googleapis.com/css2?family=Baskervville:ital@0;1&family=Lato:ital,wght@0,300;0,400;0,700;1,400&display=swap";

export function FuentesInforme() {
  return <link rel="stylesheet" href={URL_FUENTES} precedence="default" />;
}

/** Caras que usan las slides: las que hay que tener cargadas antes de pintar y medir. */
export const CARAS: { familia: string; peso: number; estilo: "normal" | "italic" }[] = [
  { familia: "Lato", peso: 300, estilo: "normal" },
  { familia: "Lato", peso: 400, estilo: "normal" },
  { familia: "Lato", peso: 700, estilo: "normal" },
  { familia: "Lato", peso: 400, estilo: "italic" },
  { familia: "Baskervville", peso: 400, estilo: "normal" },
];

let listas: Promise<void> | null = null;

/**
 * Espera a que las fuentes de las slides estén cargadas. Hay que pedirlas
 * explícitamente: `document.fonts.ready` resuelve en cuanto no hay cargas en
 * curso, y antes de pintar texto con Lato el navegador aún no las ha pedido.
 * Medir con la fuente de reserva daría otro relleno.
 */
export function fuentesListas(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return Promise.resolve();
  listas ??= (async () => {
    // El <link> puede no haber llegado todavía al <head>: sin sus @font-face,
    // fonts.load() resuelve vacío. Se espera a que la hoja cargue.
    for (let i = 0; i < 50 && !hojaCargada(); i++) await new Promise((r) => setTimeout(r, 100));
    await Promise.all(
      CARAS.map((c) => document.fonts.load(`${c.estilo === "italic" ? "italic " : ""}${c.peso} 10px ${c.familia}`).catch(() => [])),
    );
    await document.fonts.ready;
  })();
  return listas;
}

/**
 * Caras de las slides que no están cargadas ahora mismo (vacío = todas listas).
 * `document.fonts.check()` no sirve de prueba: da por buena una familia que no
 * existe. Aquí se exige una FontFace realmente cargada por cada cara. Si falta
 * alguna, lo pintado ha salido con la fuente de reserva: el PDF no debe hacerse.
 */
export function carasQueFaltan(): string[] {
  if (typeof document === "undefined" || !document.fonts) return [];
  const cargadas = Array.from(document.fonts).filter((f) => f.status === "loaded");
  return CARAS.filter(
    (c) =>
      !cargadas.some((f) => {
        // El peso de una FontFace puede ser un valor («400») o un rango («100 900»).
        const pesos = f.weight.split(" ").map((p) => (p === "normal" ? 400 : p === "bold" ? 700 : Number(p)));
        return (
          f.family.replace(/["']/g, "") === c.familia &&
          f.style === c.estilo &&
          c.peso >= Math.min(...pesos) &&
          c.peso <= Math.max(...pesos)
        );
      }),
  ).map((c) => `${c.familia} ${c.peso}${c.estilo === "italic" ? " cursiva" : ""}`);
}

function hojaCargada(): boolean {
  return Array.from(document.styleSheets).some((s) => {
    if (!s.href || !s.href.startsWith("https://fonts.googleapis.com/")) return false;
    try {
      return s.cssRules.length > 0;
    } catch {
      // Hoja de otro origen sin CORS: si está en la lista, ya ha cargado.
      return true;
    }
  });
}
