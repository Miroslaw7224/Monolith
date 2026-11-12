import { NextRequest, NextResponse } from "next/server";
import { handleServiceError } from "@/lib/http/apiError";
import { parseBody } from "@/lib/http/parseBody";
import { BoardBodySchema } from "@/src/features/board/boardSchema";
import { getBoard, saveBoard } from "@/services/boardService";

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(await getBoard());
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function PUT(request: NextRequest) {
  const parsed = await parseBody(request, BoardBodySchema);
  if (parsed.success === false) return parsed.response;
  try {
    return NextResponse.json(await saveBoard(parsed.data));
  } catch (err) {
    return handleServiceError(err);
  }
}
