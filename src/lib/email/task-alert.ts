/**
 * Correo de alerta de tarea (recordatorio de plazo) en español.
 * Asunto: «Alerta: quedan {N} días para "{tarea}"».
 * SOLO servidor.
 */
import { sendGraphMail } from "./graph-mailer";

export interface TaskAlertEmailInput {
  to: string;
  taskName: string;
  projectName: string;
  /** Fecha límite (ISO string o Date). */
  dueDate: string | Date;
  /** Días restantes hasta la fecha límite (puede ser 0 o negativo si vencida). */
  daysRemaining: number;
}

const DATE_FMT = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function formatDueDate(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    return typeof value === "string" ? value : "";
  }
  return DATE_FMT.format(d);
}

function pluralDays(n: number): string {
  return Math.abs(n) === 1 ? "1 día" : `${n} días`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface RenderInput extends TaskAlertEmailInput {
  dueLabel: string;
  headline: string;
}

function renderTaskAlertHtml(input: RenderInput): string {
  const task = escapeHtml(input.taskName);
  const project = escapeHtml(input.projectName);
  const due = escapeHtml(input.dueLabel);
  const headline = escapeHtml(input.headline);

  const row = (label: string, value: string) => `
        <tr>
          <td style="padding:6px 0;color:#6b7280;font-size:13px;width:140px;vertical-align:top;">${label}</td>
          <td style="padding:6px 0;color:#111827;font-size:13px;font-weight:600;">${value}</td>
        </tr>`;

  return `<!DOCTYPE html>
<html lang="es">
  <body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
            <tr>
              <td style="background-color:#0b1f3a;padding:16px 24px;">
                <span style="color:#ffffff;font-size:15px;font-weight:700;letter-spacing:0.04em;">IMPAR · Actas</span>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <h1 style="margin:0 0 8px;font-size:18px;color:#111827;">Recordatorio de plazo</h1>
                <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#374151;">${headline}</p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;margin:8px 0;">
                  ${row("Proyecto", project)}
                  ${row("Tarea", task)}
                  ${row("Fecha límite", due)}
                  ${row("Días restantes", escapeHtml(pluralDays(input.daysRemaining)))}
                </table>
                <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#9ca3af;">
                  Mensaje automático del módulo de Actas de Impar. No respondas a este correo.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendTaskAlertEmail(input: TaskAlertEmailInput): Promise<void> {
  const dueLabel = formatDueDate(input.dueDate);
  const days = pluralDays(input.daysRemaining);
  const headline =
    input.daysRemaining > 0
      ? `Quedan ${days} para completar la tarea «${input.taskName}» del proyecto ${input.projectName}.`
      : input.daysRemaining === 0
        ? `Hoy es la fecha límite de la tarea «${input.taskName}» del proyecto ${input.projectName}.`
        : `La tarea «${input.taskName}» del proyecto ${input.projectName} está vencida (${days}).`;

  const subject = `Alerta: quedan ${days} para "${input.taskName}"`;
  const html = renderTaskAlertHtml({ ...input, dueLabel, headline });

  await sendGraphMail({ to: input.to, subject, html });
}
