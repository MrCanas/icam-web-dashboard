/**
 * Comprueba el token de ENVÍOS de Comunicaciones sin enviar nada.
 *
 * Solo LEE: pide a Zoho la lista de direcciones con las que ese token puede
 * enviar. Si contesta, el token existe, es válido y tiene el permiso de
 * remitentes. No hace ninguna llamada de envío.
 *
 *   npm run comunicaciones:zoho-envio-verificar
 *
 * Las direcciones que salgan aquí son las que tiene sentido poner en
 * «Remitentes permitidos» (Comunicaciones > Ajustes): Zoho rechaza cualquier
 * otra.
 */
import { cargarEnv, ficherosEnvPresentes } from "../pm/lib/env";
import {
  hayTokenDeEnvios,
  remitentesDeZoho,
  VARIABLE_TOKEN_ENVIOS,
} from "@/modules/comunicaciones/data/pasarela/pasarelaZoho";

async function main(): Promise<void> {
  cargarEnv();

  if (!hayTokenDeEnvios()) {
    console.log(
      `No hay ${VARIABLE_TOKEN_ENVIOS} en este entorno (${ficherosEnvPresentes().join(", ") || "sin ficheros .env"}).\n` +
        "Aquí la pasarela es la simulada: el recorrido se completa y no sale ningún correo.\n\n" +
        "Para generar el token:  npm run comunicaciones:zoho-auth-envios",
    );
    return;
  }

  const remitentes = await remitentesDeZoho();
  console.log("✓ El token de envíos es válido.\n");
  console.log(`Direcciones con las que Zoho deja enviar (${remitentes.length}):`);
  for (const r of remitentes) {
    console.log(`  ${r.email}  ·  ${r.tipo || "?"}${r.nombre ? `  ·  ${r.nombre}` : ""}`);
  }
  if (remitentes.length === 0) {
    console.log("  (ninguna: el usuario dueño del token no tiene correo configurado en Zoho CRM)");
  }
  console.log(
    "\nLímite de Zoho: 100 correos al día por usuario. Una audiencia mayor no cabe en un día con un solo token.",
  );
}

// Ver la nota de zoho-auth.ts sobre process.exitCode en Windows.
main().catch((err: unknown) => {
  console.error(`✗ ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
});
