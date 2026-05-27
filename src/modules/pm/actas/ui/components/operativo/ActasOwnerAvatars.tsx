import type { ActasElementOwner } from "@/modules/pm/actas/types";

import { avatarColorFromUserId } from "@/modules/pm/actas/logic/actas-avatar";
import { isUnresolvedOwner } from "@/modules/pm/actas/logic/owner-display";

interface ActasOwnerAvatarsProps {
  owners: ActasElementOwner[];
  compact?: boolean;
}

export function ActasOwnerAvatars({
  owners,
  compact = false,
}: ActasOwnerAvatarsProps) {
  if (owners.length === 0) {
    return (
      <span className={`text-text-muted ${compact ? "text-[10px]" : "text-xs"}`}>
        —
      </span>
    );
  }

  return (
    <div className="flex items-center -space-x-1.5" aria-label="Responsables">
      {owners.map((owner) => {
        const unresolved = isUnresolvedOwner(owner);
        return (
          <span
            key={owner.userId}
            title={
              unresolved
                ? "Usuario no encontrado"
                : (owner.email ?? owner.label)
            }
            className={`inline-flex shrink-0 items-center justify-center rounded-full border-2 border-card font-semibold text-white ${
              compact ? "h-6 w-6 text-[9px]" : "h-7 w-7 text-[10px]"
            }`}
            style={{
              backgroundColor: unresolved
                ? "#9ca3af"
                : avatarColorFromUserId(owner.userId),
            }}
          >
            {unresolved ? "?" : owner.initials}
          </span>
        );
      })}
    </div>
  );
}
