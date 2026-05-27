import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { USER_MAPPING_PATH } from "./constants";

export interface UserMappingEntry {
  monday_user_id: string;
  monday_name: string | null;
  monday_email: string | null;
  supabase_user_id: string | null;
  mapped?: boolean;
  unmapped?: boolean;
  match_method?: string | null;
  notes?: string | null;
}

export interface UserMappingFile {
  users?: UserMappingEntry[];
  unmapped_monday_users?: UserMappingEntry[];
}

export interface ImparCapitalSeedCandidate {
  email: string;
  userId: string;
  mondayName: string | null;
}

export interface ImparCapitalExcluded {
  email: string;
  mondayName: string | null;
  reason: string;
}

const IMPAR_DOMAIN = "@imparcapital.com";

export function isImparCapitalEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(IMPAR_DOMAIN);
}

export function loadUserMappingFile(): UserMappingFile {
  const path = resolve(process.cwd(), USER_MAPPING_PATH);
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as UserMappingFile;
}

/**
 * Candidatos al seed: @imparcapital.com con supabase_user_id.
 * Excluidos: @imparcapital.com sin supabase_user_id (users + unmapped_monday_users).
 */
export function partitionImparCapitalUsers(doc: UserMappingFile): {
  candidates: ImparCapitalSeedCandidate[];
  excluded: ImparCapitalExcluded[];
} {
  const allEntries: UserMappingEntry[] = [
    ...(doc.users ?? []),
    ...(doc.unmapped_monday_users ?? []),
  ];

  const excluded: ImparCapitalExcluded[] = [];
  const byUserId = new Map<string, ImparCapitalSeedCandidate>();

  for (const entry of allEntries) {
    const email = entry.monday_email?.trim();
    if (!email || !isImparCapitalEmail(email)) continue;

    if (!entry.supabase_user_id) {
      excluded.push({
        email,
        mondayName: entry.monday_name,
        reason: "sin supabase_user_id en el mapping",
      });
      continue;
    }

    const userId = entry.supabase_user_id;
    if (!byUserId.has(userId)) {
      byUserId.set(userId, {
        email,
        userId,
        mondayName: entry.monday_name,
      });
    }
  }

  const candidates = [...byUserId.values()].sort((a, b) =>
    a.email.localeCompare(b.email, "es"),
  );

  return { candidates, excluded };
}
