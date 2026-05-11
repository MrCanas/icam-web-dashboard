import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isIcamAuthenticated } from "@/lib/api-auth";
import { MondayApiError } from "@/lib/monday/client";
import { getMondayBoardColumns, getMondayBoardItems, getMondayBoards, getMondayMe } from "@/lib/monday/read";

type MondayScope = "me" | "boards" | "columns" | "items";

function parseScope(value: string | null): MondayScope {
  if (value === "columns" || value === "items" || value === "boards" || value === "me") {
    return value;
  }
  return "boards";
}

export async function GET(request: NextRequest) {
  if (!isIcamAuthenticated(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const scope = parseScope(request.nextUrl.searchParams.get("scope"));
  const boardId = request.nextUrl.searchParams.get("boardId");
  const limitParam = request.nextUrl.searchParams.get("limit");
  const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;
  const limit = Number(limitParam ?? "50");

  try {
    if (scope === "me") {
      const me = await getMondayMe();
      return NextResponse.json({ scope, data: me });
    }

    if (scope === "boards") {
      const boards = await getMondayBoards();
      return NextResponse.json({ scope, data: boards });
    }

    if (!boardId) {
      return NextResponse.json(
        { error: "Falta el parámetro boardId para esta operación." },
        { status: 400 },
      );
    }

    if (scope === "columns") {
      const board = await getMondayBoardColumns(boardId);
      return NextResponse.json({ scope, data: board });
    }

    const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 50;
    const board = await getMondayBoardItems(boardId, safeLimit, cursor);
    return NextResponse.json({ scope, data: board });
  } catch (error) {
    if (error instanceof MondayApiError) {
      return NextResponse.json(
        {
          error: error.message,
          details: error.details ?? [],
        },
        { status: error.status },
      );
    }
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
