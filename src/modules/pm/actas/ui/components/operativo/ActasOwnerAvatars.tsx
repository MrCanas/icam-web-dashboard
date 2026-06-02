import {
  avatarColorFromEmail,
  avatarColorFromUserId,
} from "@/modules/pm/actas/logic/actas-avatar";
import { isUnresolvedOwner } from "@/modules/pm/actas/logic/owner-display";
import type { ActasElementOwner } from "@/modules/pm/actas/types";

interface ActasOwnerAvatarsProps {
  owners: ActasElementOwner[];
  compact?: boolean;
  showAssignPlaceholder?: boolean;
}

export function ActasOwnerAvatars({
  owners,
  compact = false,
  showAssignPlaceholder = true,
}: ActasOwnerAvatarsProps) {
  const dim = compact ? "h-6 w-6 text-[9px]" : "h-7 w-7 text-[10px]";

  if (owners.length === 0) {
    if (!showAssignPlaceholder) {
      return (
        <span className={`text-text-muted ${compact ? "text-[10px]" : "text-xs"}`}>
          —
        </span>
      );
    }
    return (
      <span
        className={`inline-flex items-center gap-1 text-text-muted ${compact ? "text-[9px]" : "text-[10px]"}`}
        title="Asignar responsable"
      >
        <span
          className={`inline-flex shrink-0 items-center justify-center rounded-full border border-dashed border-gray-300 bg-gray-100 font-semibold text-gray-500 ${dim}`}
          aria-hidden
        >
          +
        </span>
        <span className="hidden sm:inline">asignar</span>
      </span>
    );
  }

  return (
    <div className="flex items-center -space-x-1.5" aria-label="Responsables">
      {owners.map((owner) => {
        const unresolved = isUnresolvedOwner(owner);
        const bg = unresolved
          ? "#9ca3af"
          : owner.email
            ? avatarColorFromEmail(owner.email)
            : avatarColorFromUserId(owner.userId);

        return (
          <span
            key={owner.userId}
            title={
              unresolved
                ? "Usuario no encontrado"
                : (owner.email ?? owner.label)
            }
            className={`inline-flex shrink-0 items-center justify-center rounded-full border-2 border-card font-semibold text-white ${dim}`}
            style={{ backgroundColor: bg }}
          >
            {unresolved ? "?" : owner.initials}
          </span>
        );
      })}
    </div>
  );
}
