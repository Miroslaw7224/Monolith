import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/getAuth";
import { handleServiceError } from "@/lib/apiError";
import { parseBody } from "@/lib/parseBody";
import { NoteBodySchema } from "@/lib/validation/notes";
import * as noteService from "@/services/noteService";

export async function GET(request: NextRequest) {
  const auth = await getAuthUserId(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const notes = await noteService.listNotes(auth.uid);
    return NextResponse.json(
      notes.map((n) => ({
        id: n.id,
        title: n.title,
        content: n.content,
        created_at: n.created_at,
      }))
    );
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUserId(request);
  if (auth instanceof NextResponse) return auth;

  const parsed = await parseBody(request, NoteBodySchema);
  if (parsed.success === false) return parsed.response;

  const { title, content } = parsed.data;
  try {
    const result = await noteService.createNote(auth.uid, {
      title: (title ?? "") as string,
      content: (content ?? "") as string,
    });
    return NextResponse.json(result);
  } catch (err) {
    return handleServiceError(err);
  }
}
