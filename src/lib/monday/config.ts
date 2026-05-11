const DEFAULT_MONDAY_API_VERSION = "2026-04";

function parseBoardIds(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export function getMondayConfig() {
  const token = process.env.MONDAY_API_TOKEN?.trim();
  const apiVersion = process.env.MONDAY_API_VERSION?.trim() || DEFAULT_MONDAY_API_VERSION;
  const boardIds = parseBoardIds(process.env.MONDAY_BOARD_IDS);

  if (!token) {
    throw new Error("Falta MONDAY_API_TOKEN en variables de entorno.");
  }

  return {
    endpoint: "https://api.monday.com/v2",
    token,
    apiVersion,
    boardIds,
  };
}
