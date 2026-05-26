import type { ActasElementOwner } from "@/modules/pm/actas/types";

const AVATAR_COLORS = [
  "#579bfc",
  "#037f4c",
  "#fdab3d",
  "#a25ddc",
  "#bb3354",
  "#ff5ac4",
  "#0086c0",
  "#66ccff",
];

function avatarColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]!;
}

interface ActasOwnerAvatarsProps {
  owners: ActasElementOwner[];
}

export function ActasOwnerAvatars({ owners }: ActasOwnerAvatarsProps) {
  if (owners.length === 0) {
    return <span className="text-text-muted text-xs">—</span>;
  }

  return (
    <div className="flex items-center -space-x-1.5" aria-label="Responsables">
      {owners.map((owner) => (
        <span
          key={owner.userId}
          title={owner.email ?? owner.label}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-card text-[10px] font-semibold text-white"
          style={{ backgroundColor: avatarColor(owner.userId) }}
        >
          {owner.initials}
        </span>
      ))}
    </div>
  );
}
