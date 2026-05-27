import type { ActasActaQueryInput, ActasActaViewData } from "@/modules/pm/actas/types";

export interface ActaPdfProps {
  projectCode: string;
  projectName: string;
  dateFrom: string;
  dateTo: string;
  generatedAt: Date;
  filterLines: string[];
  viewData: ActasActaViewData;
}

export type ActaExportPdfBody = Omit<ActasActaQueryInput, "projectId">;

export function actaPdfFilename(
  code: string,
  dateFrom: string,
  dateTo: string,
): string {
  const safeCode = code.replace(/[^a-zA-Z0-9-_]/g, "");
  return `acta-${safeCode}-${dateFrom}-${dateTo}.pdf`;
}

export function buildActaPdfFilterLines(
  input: Pick<
    ActasActaQueryInput,
    "categoryIds" | "authorIds" | "onlyWithStatusChange"
  >,
  viewData: ActasActaViewData,
): string[] {
  const lines: string[] = [];

  if (input.categoryIds && input.categoryIds.length > 0) {
    const names = input.categoryIds
      .map(
        (id) =>
          viewData.availableCategories.find((c) => c.id === id)?.label ?? id,
      )
      .join(", ");
    lines.push(`Filtrado por categorías: ${names}`);
  }

  if (input.authorIds && input.authorIds.length > 0) {
    const names = input.authorIds
      .map((id) => {
        if (id == null) return "Sin autor";
        return (
          viewData.availableAuthors.find((a) => a.id === id)?.label ?? id
        );
      })
      .join(", ");
    lines.push(`Filtrado por autores: ${names}`);
  }

  if (input.onlyWithStatusChange) {
    lines.push("Solo entradas con cambio de estado");
  }

  return lines;
}
