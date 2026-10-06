/**
 * Lo que este módulo todavía NO hace, dicho en la propia pantalla.
 *
 * Quien llega aquí viene de un kiosk que enviaba al terminar. Que preparar una
 * comunicación no envía nada tiene que leerse, no suponerse.
 */
export function AvisoSinEnvio() {
  return (
    <p className="rounded-lg border border-subtle bg-card p-3 text-sm text-text-body">
      <strong>Desde aquí no se envía ningún correo.</strong> Preparar una comunicación solo calcula y
      guarda a quién iría y enseña la plantilla. El envío, con sus controles, todavía no está
      disponible.
    </p>
  );
}
