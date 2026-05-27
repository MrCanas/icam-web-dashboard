/** Utilidades compartidas de avatar (owner picker + filas operativas). */

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

export function avatarColorFromUserId(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]!;
}

export function avatarColorFromEmail(email: string): string {
  return avatarColorFromUserId(email.trim().toLowerCase());
}
