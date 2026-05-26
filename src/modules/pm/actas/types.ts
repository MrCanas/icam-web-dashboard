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

export type ElementStatus =
  | "not_started"
  | "working_on_it"
  | "stuck"
  | "done";

export interface ActasElementOwner {
  userId: string;
  email: string | null;
  /** Etiqueta corta (parte local del email). */
  label: string;
  initials: string;
}

export interface ActasOperativoElement {
  id: string;
  name: string;
  status: ElementStatus;
  orderIndex: number;
  parentElementId: string | null;
  /** Raíz de árbol: puede tener sub-elementos (botón + Sub-elemento). */
  canHaveSubelements: boolean;
  owners: ActasElementOwner[];
  timelineStart: string | null;
  timelineEnd: string | null;
  lastEntryContent: string | null;
  lastEntryDate: string | null;
  children: ActasOperativoElement[];
}

export interface ActasLogEntryItem {
  id: string;
  content: string;
  entryDate: string;
  deletedAt: string | null;
  statusBefore: ElementStatus | null;
  statusAfter: ElementStatus | null;
  author: ActasElementOwner | null;
}

export interface ActasOperativoCategory {
  id: string;
  name: string;
  displayName: string;
  orderIndex: number;
  sublotLabel: string | null;
  masterGroupId: string | null;
  elements: ActasOperativoElement[];
}
