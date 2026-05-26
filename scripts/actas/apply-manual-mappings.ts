/**
 * Ajustes post-generación en 06-user-mapping.json (provisión Auth).
 * Las resoluciones de elementos viven en lib/manual-element-resolutions.ts
 * y se aplican en el matcher al ejecutar monday-map-elements*.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const USER_FILE = resolve(process.cwd(), "docs/actas/06-user-mapping.json");

function applyUserManual(): void {
  const doc = JSON.parse(readFileSync(USER_FILE, "utf8")) as {
    mappings: Record<string, string | null>;
    users: {
      monday_user_id: string;
      supabase_user_id: string | null;
      mapped: boolean;
      unmapped: boolean;
      monday_email: string | null;
    }[];
    summary: Record<string, number>;
  };

  const EMAIL_ALIASES: Record<string, string> = {
    "8elisaferran@gmail.com": "elisaferran@gmail.com",
  };

  const javierId = doc.mappings["68771637"];
  if (!javierId) throw new Error("Expected javiercanas mapping");

  for (const u of doc.users) {
    const alias = u.monday_email
      ? EMAIL_ALIASES[u.monday_email.toLowerCase()]
      : undefined;
    if (alias) {
      u.notes = `Alias de email Monday → revisar usuario ${alias} al provisionar Auth`;
    }
  }

  doc.manual_resolution = {
    status: "pending_auth_provisioning",
    applied_at: new Date().toISOString(),
    message:
      "Antes de migrar: invitar/crear en Supabase Auth todos los emails con unmapped=true.",
    mapped_by_email: doc.summary.mapped,
    still_unmapped: doc.summary.unmapped,
    dev_fallback_supabase_user_id: javierId,
    dev_fallback_note:
      "Solo entorno local si se migra sin Auth completo. NO usar en producción.",
  };

  doc.unmapped_still_blocking_migration = doc.users.filter((u) => u.unmapped);
  doc.manual_resolution_applied_at = new Date().toISOString();

  writeFileSync(USER_FILE, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
}

applyUserManual();
console.log("Manual user-mapping notes applied.");
