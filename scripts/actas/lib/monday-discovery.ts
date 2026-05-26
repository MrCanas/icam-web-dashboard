import { parseMondayBoardName } from "./monday-board-parse";
import { fetchWorkspaceBoards } from "./monday-extract";

function normalizeDiscoveredCode(raw: string): string {
  let code = raw.replace(/\s+/g, " ").trim();
  if (/^Duplicado de\s+/i.test(code)) {
    code = code.replace(/^Duplicado de\s+/i, "").trim();
  }
  return code.toUpperCase();
}

/** Extrae código de proyecto del título de un tablero Actas (snapshot / subelementos / duplicado). */
export function projectCodeFromBoardTitle(boardName: string): string | null {
  const trimmed = boardName.trim();
  const parsed = parseMondayBoardName("", trimmed, 0);
  if (parsed.projectCode) {
    return normalizeDiscoveredCode(parsed.projectCode);
  }

  const dup = trimmed.match(/^Duplicado de\s+(.+?)\s*-\s*\d{2}\/\d{2}\/\d{4}\s*$/i);
  if (dup?.[1]) {
    return normalizeDiscoveredCode(dup[1]);
  }

  return null;
}

/**
 * Lista códigos de proyecto únicos en el workspace Monday (títulos de tableros).
 */
export async function discoverProjectCodes(
  workspaceId: string,
): Promise<string[]> {
  const boards = await fetchWorkspaceBoards(workspaceId);
  const codes = new Set<string>();

  for (const board of boards) {
    const code = projectCodeFromBoardTitle(board.name);
    if (code) codes.add(code);
  }

  return [...codes].sort((a, b) => a.localeCompare(b, "es"));
}
