import { NextRequest, NextResponse } from "next/server";
import { handleServiceError } from "@/lib/http/apiError";
import { parseBody } from "@/lib/http/parseBody";
import { NoteBodySchema } from "@/lib/validation/notes";
import * as noteService from "@/services/noteService";

export async function GET(request: NextRequest) {
  try {
    const notes = await noteService.listNotes();
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
  const parsed = await parseBody(request, NoteBodySchema, { details: false });
  if (parsed.success === false) return parsed.response;

  const { title, content } = parsed.data;
  try {
    const result = await noteService.createNote({
      title: (title ?? "") as string,
      content: (content ?? "") as string,
    });
    return NextResponse.json(result);
  } catch (err) {
    return handleServiceError(err);
  }
}
