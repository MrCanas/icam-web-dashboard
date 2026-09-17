/**
 * Re-export del cliente de Zoho, que vive en `src/lib/zoho/client.ts`.
 *
 * Nació aquí, dentro de Avance de obra, porque era su único consumidor. Cuando
 * la pestaña de Inversores necesitó los mismos cinco secretos y la misma
 * paginación, dejó de ser infraestructura de un módulo: un import
 * `portfolio -> pm` es exactamente lo que ARCHITECTURE.md no quiere. Se
 * promovió a `src/lib/`, igual que `src/lib/graph/sharepoint.ts`, que comparten
 * portfolio y corporativo.
 *
 * Este fichero se queda para que los llamadores de Avance de obra y
 * `scripts/pm/*` no cambien ni una línea.
 */
export * from "@/lib/zoho/client";
