import {
  ELEMENT_STATUS_LABEL,
  ELEMENT_STATUS_STYLE,
} from "@/modules/pm/actas/logic/element-status";
import type { ElementStatus } from "@/modules/pm/actas/types";

interface ActasLogEntryStatusChipProps {
  statusBefore: ElementStatus;
  statusAfter: ElementStatus;
}

export function ActasLogEntryStatusChip({
  statusBefore,
  statusAfter,
}: ActasLogEntryStatusChipProps) {
  const beforeStyle = ELEMENT_STATUS_STYLE[statusBefore];
  const afterStyle = ELEMENT_STATUS_STYLE[statusAfter];

  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border border-icam-900/15 bg-icam-900/5 px-2 py-0.5 text-[11px] font-semibold"
      title="Cambio de estado"
    >
      <span
        className="rounded px-1"
        style={{
          backgroundColor: beforeStyle.bg,
          color: beforeStyle.text,
        }}
      >
        {ELEMENT_STATUS_LABEL[statusBefore]}
      </span>
      <span className="text-text-muted" aria-hidden>
        →
      </span>
      <span
        className="rounded px-1"
        style={{
          backgroundColor: afterStyle.bg,
          color: afterStyle.text,
        }}
      >
        {ELEMENT_STATUS_LABEL[statusAfter]}
      </span>
    </span>
  );
}
