/**
 * Comprueba, SIN ENVIAR NADA, a quién escribiría cada comunicación guardada.
 *
 * Solo LEE de la base. Coge cada comunicación con correos pendientes y le pasa
 * las mismas funciones que usa el envío de verdad (`montarCorreo` y
 * `verificarCandado`, a través de `simularCandado`), en los DOS modos, y dice
 * cuántos correos dejaría salir el candado y a qué direcciones exactas.
 *
 *   npm run comunicaciones:candado-verificar
 *
 * Termina con error si algún correo permitido lleva una dirección que no esté
 * en la lista cerrada del candado. No debería poder pasar; por eso se comprueba.
 */
import { closePgPool, withPgClient } from "../actas/lib/db";
import { cargarEnv } from "../pm/lib/env";
import { hayTokenDeEnvios } from "@/modules/comunicaciones/data/pasarela/pasarelaZoho";
import {
  calcularPermitidos,
  CANDADO,
  normalizarEmail,
  type EspejosParaCandado,
} from "@/modules/comunicaciones/logic/candado";
import { simularCandado } from "@/modules/comunicaciones/logic/envio";
import type { ComComunicacionRow, ComDestinatarioRow, ModoEnvio } from "@/modules/comunicaciones/types";

const USUARIO = CANDADO.emailsPermitidos[0];

async function main(): Promise<void> {
  cargarEnv();
  const lista = new Set<string>(CANDADO.emailsPermitidos.map(normalizarEmail));
  let fugas = 0;

  await withPgClient(async (client) => {
    await client.query("BEGIN READ ONLY");
    try {
      const tabla = async <T>(nombre: string): Promise<T[]> =>
        (await client.query(`SELECT * FROM public.${nombre}`)).rows as T[];

      const espejos: EspejosParaCandado = {
        cuentas: await tabla("inv_cuentas"),
        contactos: await tabla("inv_contactos"),
        cuentaContacto: await tabla("inv_cuenta_contacto"),
        promociones: await tabla("inv_promociones"),
        cuentaPromocion: await tabla("inv_cuenta_promocion"),
      };
      const permitidos = calcularPermitidos(espejos);

      console.log("CANDADO DE DESTINATARIOS");
      console.log(`  Direcciones que pueden recibir correo (lista cerrada, en el código): ${[...lista].join(", ")}`);
      console.log(
        `  Registros sobre los que se puede enviar: ${
          permitidos.cuentas.map((c) => c.nombre).join(", ") || "ninguno (la promoción de pruebas no aparece)"
        }`,
      );
      console.log(
        `  Pasarela en este entorno: ${hayTokenDeEnvios() ? "ZOHO (hay token de envíos)" : "simulada (no hay token de envíos: no puede salir ningún correo)"}`,
      );

      const { rows: ajustes } = await client.query<{ envios_activados: boolean; modo: string }>(
        "SELECT envios_activados, modo FROM public.com_ajustes",
      );
      console.log(
        `  Ajustes ahora: envíos ${ajustes[0]?.envios_activados ? "ACTIVADOS" : "desactivados"} · modo ${ajustes[0]?.modo ?? "?"}`,
      );

      const { rows: comunicaciones } = await client.query<ComComunicacionRow>(
        "SELECT * FROM public.com_comunicacion ORDER BY created_at",
      );
      console.log(`\nCOMUNICACIONES GUARDADAS: ${comunicaciones.length}`);

      for (const comunicacion of comunicaciones) {
        const { rows: destinatarios } = await client.query<ComDestinatarioRow>(
          "SELECT * FROM public.com_destinatario WHERE comunicacion_id = $1 ORDER BY cuenta_nombre",
          [comunicacion.id],
        );
        const pendientes = destinatarios.filter(
          (d) => !d.excluido && d.para.length > 0 && d.estado_envio === "pendiente",
        );
        const yaSalieron = destinatarios.filter((d) => d.estado_envio === "enviado");
        console.log(`\n· ${comunicacion.nombre} — ${comunicacion.estado}`);
        console.log(`  ${destinatarios.length} cuentas en la lista · ${pendientes.length} correos pendientes`);

        for (const d of yaSalieron) {
          const a = d.enviado_para ? [...d.enviado_para.para, ...d.enviado_para.copia, ...d.enviado_para.copiaOculta] : [];
          const malas = a.map(normalizarEmail).filter((e) => !lista.has(e));
          fugas += malas.length;
          console.log(
            `  YA ENVIADO (${d.pasarela ?? "?"}) ${d.cuenta_nombre} → ${a.join(", ") || "?"}${malas.length ? "  ✗ FUERA DE LA LISTA" : ""}`,
          );
        }
        if (pendientes.length === 0) continue;

        for (const modo of ["pruebas", "real"] as ModoEnvio[]) {
          // Sin plantilla ni remitente todavía se supone lo más favorable al
          // envío: lo que se mide aquí es el candado, no lo que falta por elegir.
          const simulacion = simularCandado(
            { plantilla_id: comunicacion.plantilla_id ?? "(sin elegir)", plantilla_modulo: comunicacion.plantilla_modulo },
            destinatarios,
            { modo, usuarioEmail: USUARIO, remitente: comunicacion.remitente_email ?? USUARIO },
            permitidos,
          );
          console.log(
            `  modo ${modo}: el candado deja salir ${simulacion.permitidos.length} y rechaza ${simulacion.rechazados.length}` +
              (simulacion.omitidos.length ? ` (${simulacion.omitidos.length} omitidos por dirección repetida)` : ""),
          );
          for (const { cuenta, correo } of simulacion.permitidos) {
            const a = [...correo.para, ...correo.copia, ...correo.copiaOculta];
            const malas = a.map(normalizarEmail).filter((e) => !lista.has(e));
            fugas += malas.length;
            console.log(
              `      saldría: ${cuenta} → Para ${correo.para.join(", ")}` +
                (correo.copia.length ? ` · copia ${correo.copia.join(", ")}` : "") +
                (correo.copiaOculta.length ? ` · copia oculta ${correo.copiaOculta.join(", ")}` : "") +
                (malas.length ? "  ✗ FUERA DE LA LISTA" : ""),
            );
          }
          const motivos = new Map<string, number>();
          for (const r of simulacion.rechazados) {
            // Las direcciones concretas no hacen falta para contar por qué se rechaza.
            const motivo = r.motivo.includes("no está entre las direcciones permitidas")
              ? "alguna dirección no está en la lista cerrada"
              : r.motivo;
            motivos.set(motivo, (motivos.get(motivo) ?? 0) + 1);
          }
          for (const [motivo, n] of motivos) console.log(`      rechazados ${n}: ${motivo}`);
        }
      }
    } finally {
      await client.query("ROLLBACK");
    }
  });
  await closePgPool();

  if (fugas > 0) {
    console.log(`\n✗ ${fugas} direcciones fuera de la lista cerrada. NO ENVIAR NADA y revisar el candado.`);
    process.exitCode = 1;
  } else {
    console.log("\n✓ Ningún correo, enviado o por enviar, lleva una dirección fuera de la lista cerrada.");
  }
}

// Ver la nota de zoho-auth.ts sobre process.exitCode en Windows.
main().catch((err: unknown) => {
  console.error(`✗ ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
});
