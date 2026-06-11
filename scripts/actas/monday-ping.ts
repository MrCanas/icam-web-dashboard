import { config } from "dotenv";
import { resolve } from "node:path";

import { mondayQuery, type Board } from "../../src/services/monday/client";

config({ path: resolve(process.cwd(), ".env.local") });

const PAGE_SIZE = 500;

const WORKSPACE_BOARDS_PAGE_QUERY = `
  query WorkspaceBoards($workspaceIds: [ID!]!, $limit: Int!, $page: Int!) {
    boards(workspace_ids: $workspaceIds, limit: $limit, page: $page) {
      id
      name
      updated_at
      items_count
    }
  }
`;

type WorkspaceBoardsResult = {
  boards: Board[];
};

async function fetchAllWorkspaceBoards(workspaceId: string): Promise<Board[]> {
  const all: Board[] = [];
  let page = 1;

  for (;;) {
    const data = await mondayQuery<WorkspaceBoardsResult>(
      WORKSPACE_BOARDS_PAGE_QUERY,
      { workspaceIds: [workspaceId], limit: PAGE_SIZE, page },
      { timeoutMs: 90_000 },
    );
    const batch = data.boards ?? [];
    all.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    page += 1;
  }

  return all;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toISOString();
}

async function main(): Promise<void> {
  const workspaceId = process.env.MONDAY_WORKSPACE_ID_ACTAS?.trim();
  if (!workspaceId) {
    throw new Error(
      "Falta MONDAY_WORKSPACE_ID_ACTAS en .env.local (ver .env.local.example).",
    );
  }

  console.log(`Workspace Actas: ${workspaceId}\n`);
  console.log("id\titems\tupdated_at\tname");
  console.log("-".repeat(80));

  const boards = [...(await fetchAllWorkspaceBoards(workspaceId))].sort((a, b) =>
    a.name.localeCompare(b.name, "es"),
  );

  for (const board of boards) {
    const items = board.items_count ?? 0;
    console.log(
      `${board.id}\t${items}\t${formatDate(board.updated_at)}\t${board.name}`,
    );
  }

  console.log("-".repeat(80));
  console.log(`Total boards: ${boards.length}`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
