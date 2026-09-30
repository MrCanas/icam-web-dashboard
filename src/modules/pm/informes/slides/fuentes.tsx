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
      ["300 10px Lato", "400 10px Lato", "700 10px Lato", "italic 400 10px Lato", "400 10px Baskervville"].map((f) =>
        document.fonts.load(f).catch(() => []),
      ),
    );
    await document.fonts.ready;
  })();
  return listas;
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
