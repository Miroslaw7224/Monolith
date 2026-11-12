import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/getAuth";
import { handleServiceError } from "@/lib/apiError";
import { parseBody } from "@/lib/parseBody";
import { BoardBodySchema } from "@/src/features/board/boardSchema";
import { getBoard, saveBoard } from "@/services/boardService";

export async function GET(request: NextRequest) {
  const auth = await getAuthUserId(request);
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json(await getBoard(auth.uid));
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function PUT(request: NextRequest) {
  const auth = await getAuthUserId(request);
  if (auth instanceof NextResponse) return auth;
  const parsed = await parseBody(request, BoardBodySchema);
  if (parsed.success === false) return parsed.response;
  try {
    return NextResponse.json(await saveBoard(auth.uid, parsed.data));
  } catch (err) {
    return handleServiceError(err);
  }
}
