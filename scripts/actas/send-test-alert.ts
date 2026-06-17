/**
 * Envío de PRUEBA de una alerta de tarea por correo (Microsoft 365 / Graph).
 *
 * No queda expuesto públicamente: solo se ejecuta server-side desde la CLI.
 * Usa las variables M365 de `.env.local` (sin hardcodear nada) vía el módulo
 * reutilizable src/lib/email.
 *
 *   npm run actas:send-test-alert
 *   # destinatario opcional:  npx tsx scripts/actas/send-test-alert.ts otra@dir.com
 */
import { loadActasEnv } from "./lib/env";

import { sendTaskAlertEmail } from "../../src/lib/email/task-alert";

const DEFAULT_TO = "javiercanas@imparcapital.com";

async function main(): Promise<void> {
  loadActasEnv();

  const to = process.argv[2]?.trim() || DEFAULT_TO;
  const now = new Date();
  const due = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const daysRemaining = Math.ceil((due.getTime() - now.getTime()) / 86_400_000);

  console.log(`Enviando alerta de prueba a ${to}…`);
  console.log(
    `  Tarea: "Tarea de prueba" · Proyecto: SOCIETARIO · ` +
      `Fecha límite: ${due.toISOString().slice(0, 10)} · Días restantes: ${daysRemaining}`,
  );

  await sendTaskAlertEmail({
    to,
    taskName: "Tarea de prueba",
    projectName: "SOCIETARIO",
    dueDate: due,
    daysRemaining,
  });

  console.log(`\n✓ Correo enviado a ${to} (quedan ${daysRemaining} días para completar la tarea).`);
}

main().catch((err: unknown) => {
  console.error("\n✗ Fallo al enviar el correo de prueba:");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
