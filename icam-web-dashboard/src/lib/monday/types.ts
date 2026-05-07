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

export interface MondayColumnValue {
  id: string;
  text: string | null;
  value: string | null;
}

export interface MondayItem {
  id: string;
  name: string;
  updated_at: string | null;
  column_values: MondayColumnValue[];
}

export interface MondayItemsPage {
  cursor: string | null;
  items: MondayItem[];
}

export interface MondayQueryError {
  message: string;
  extensions?: Record<string, unknown>;
}
