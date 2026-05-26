export type ProjectPhase =
  | "adquisicion"
  | "desarrollo"
  | "comercializacion"
  | "operacion"
  | "desinversion"
  | "cierre";

export interface ActasProjectListItem {
  id: string;
  code: string;
  name: string;
  phase: ProjectPhase;
}

export type ActasProjectTab = "operativo" | "acta" | "historico" | "ajustes";

export const ACTAS_PROJECT_TABS: { key: ActasProjectTab; label: string }[] = [
  { key: "operativo", label: "Operativo" },
  { key: "acta", label: "Acta" },
  { key: "historico", label: "Histórico" },
  { key: "ajustes", label: "Ajustes" },
];

export interface ActasProjectDetail extends ActasProjectListItem {
  /** Email of the principal owner, null if not set. */
  ownerEmail: string | null;
  /** ISO date string of the latest log_entry.entry_date, null if no entries. */
  lastLogEntryAt: string | null;
  /** Count of active (non-archived) elements. */
  elementCount: number;
}
