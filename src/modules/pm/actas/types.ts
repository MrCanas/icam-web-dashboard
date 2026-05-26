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

export interface ActasArchivedProjectListItem {
  id: string;
  code: string;
  name: string;
  phase: ProjectPhase;
  /** ISO timestamp de archivado. */
  archivedAt: string;
}

/** Proyecto archivado referenciado desde la ruta por código. */
export interface ActasArchivedProjectRef {
  id: string;
  code: string;
  name: string;
  archivedAt: string;
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
  authorId: string | null;
  source: string | null;
  editedAt: string | null;
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

/** Preset de rango temporal en la vista Acta. */
export type ActasActaRangePreset = "week" | "month" | "quarter" | "custom";

export interface ActasActaFilterOption {
  id: string;
  label: string;
}

export interface ActasActaAuthorOption {
  /** `null` = entradas migradas sin autor. */
  id: string | null;
  label: string;
}

export interface ActasActaElementSection {
  id: string;
  name: string;
  depth: number;
  orderIndex: number;
  entryCount: number;
  entries: ActasLogEntryItem[];
}

export interface ActasActaCategorySection {
  id: string;
  name: string;
  displayName: string;
  masterGroupId: string | null;
  orderIndex: number;
  entryCount: number;
  elements: ActasActaElementSection[];
}

export interface ActasActaViewData {
  categories: ActasActaCategorySection[];
  totalEntryCount: number;
  availableCategories: ActasActaFilterOption[];
  availableAuthors: ActasActaAuthorOption[];
}

/** Opción en el buscador del hub Histórico. */
export interface ActasHistoricoElementOption {
  id: string;
  name: string;
  categoryLabel: string;
  categoryId: string;
  archived: boolean;
}

export interface ActasHistoricoElementDetail {
  element: {
    id: string;
    name: string;
    status: ElementStatus;
    archivedAt: string | null;
    createdAt: string;
    lastActivityAt: string | null;
    timelineStart: string | null;
    timelineEnd: string | null;
  };
  category: {
    id: string;
    displayName: string;
  };
  owners: ActasElementOwner[];
  /** Todas las entradas (incl. borradas), orden ASC por entry_date. */
  entries: ActasLogEntryItem[];
}

export interface ActasActaQueryInput {
  projectId: string;
  dateFrom: string;
  dateTo: string;
  categoryIds?: string[];
  authorIds?: (string | null)[];
  onlyWithStatusChange?: boolean;
}
