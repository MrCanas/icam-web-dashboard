import { getCategoryGroupStyle } from "@/modules/pm/actas/logic/category-group-style";
import type { ActasActaCategorySection } from "@/modules/pm/actas/types";

import { ActasActaEntryRow } from "./ActasActaEntryRow";

interface ActasActaCategoryBlockProps {
  category: ActasActaCategorySection;
  projectCode: string;
}

export function ActasActaCategoryBlock({
  category,
  projectCode,
}: ActasActaCategoryBlockProps) {
  const style = getCategoryGroupStyle(category.masterGroupId, category.id);

  return (
    <section className="rounded-md overflow-hidden border border-subtle/50 shadow-sm">
      <header
        className="flex flex-wrap items-center gap-2 px-3 py-2.5"
        style={{ backgroundColor: style.bg, color: style.text }}
      >
        <h3 className="flex-1 min-w-0 font-semibold text-sm uppercase tracking-wide truncate">
          {category.displayName}
        </h3>
        <span
          className="shrink-0 rounded px-2 py-0.5 text-xs font-medium"
          style={{ backgroundColor: "rgba(0,0,0,0.12)" }}
        >
          ({category.entryCount}{" "}
          {category.entryCount === 1 ? "entrada" : "entradas"} en este rango)
        </span>
      </header>

      <div className="divide-y divide-subtle/40 bg-card">
        {category.elements.map((element) => (
          <div key={element.id} className="px-3 py-3">
            <h4
              className="text-sm font-semibold text-text-primary"
              style={{ paddingLeft: `${element.depth * 1.25}rem` }}
            >
              {element.name}
              <span className="ml-2 font-normal text-text-muted">
                ({element.entryCount}{" "}
                {element.entryCount === 1 ? "entrada" : "entradas"})
              </span>
            </h4>
            <div
              className="mt-2 space-y-0"
              style={{ marginLeft: `${element.depth * 1.25}rem` }}
            >
              {element.entries.map((entry) => (
                <ActasActaEntryRow
                  key={entry.id}
                  entry={entry}
                  elementId={element.id}
                  projectCode={projectCode}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
