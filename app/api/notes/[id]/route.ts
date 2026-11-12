import { NextRequest, NextResponse } from "next/server";
import { handleServiceError } from "@/lib/http/apiError";
import { parseBody } from "@/lib/http/parseBody";
import { NoteBodySchema } from "@/lib/validation/notes";
import * as noteService from "@/services/noteService";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const parsed = await parseBody(request, NoteBodySchema, { details: false });
  if (parsed.success === false) return parsed.response;

  const { title, content } = parsed.data;
  try {
    await noteService.updateNote(id, {
      title: title as string,
      content: content as string,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await noteService.deleteNote(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleServiceError(err);
  }
}
