import { NextRequest, NextResponse } from "next/server";
import { DomainError } from "@/lib/errors";
import { handleServiceError } from "@/lib/http/apiError";
import { parseBody } from "@/lib/http/parseBody";
import { BoardBodySchema, EMPTY_BOARD, normalizeBoard, parseBoard, toBoardDto } from "./schemas";
import * as services from "./services";

export async function getBoard(): Promise<NextResponse> {
  try {
    const stored = await services.getBoard();
    if (stored === null) return NextResponse.json(EMPTY_BOARD);
    const parsed = parseBoard(stored);
    if (parsed.success === false) throw new DomainError(parsed.message, 400);
    return NextResponse.json(toBoardDto(parsed.board));
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function putBoard(request: NextRequest): Promise<NextResponse> {
  const parsed = await parseBody(request, BoardBodySchema);
  if (parsed.success === false) return parsed.response;
  try {
    const saved = await services.saveBoard(normalizeBoard(parsed.data));
    return NextResponse.json(toBoardDto(saved));
  } catch (err) {
    return handleServiceError(err);
  }
}
