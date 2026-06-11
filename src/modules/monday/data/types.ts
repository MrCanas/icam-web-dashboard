export interface MondayBoard {
  id: string;
  name: string;
  state?: string;
}

export interface MondayColumn {
  id: string;
  title: string;
  type: string;
}

export interface MondayBoardGroup {
  id: string;
  title: string;
}

export interface MondayColumnValue {
  id: string;
  text: string | null;
  value: string | null;
}

export interface MondayItem {
  id: string;
  name: string;
  created_at: string | null;
  updated_at: string | null;
  group: { id: string; title: string } | null;
  column_values: MondayColumnValue[];
}

export interface MondayActivityLogEntry {
  id: string;
  created_at: string | null;
  event: string | null;
  data: string | null;
}

export interface MondayItemsPage {
  cursor: string | null;
  items: MondayItem[];
}

export interface MondayQueryError {
  message: string;
  extensions?: Record<string, unknown>;
}
