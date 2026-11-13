import { NextRequest, NextResponse } from "next/server";
import { handleServiceError } from "@/lib/http/apiError";
import { parseBody } from "@/lib/http/parseBody";
import { NoteBodySchema, toNoteDto } from "./schemas";
import * as services from "./services";

type RouteContext = { params: Promise<{ id: string }> };

export async function listNotes(): Promise<NextResponse> {
  try {
    const notes = await services.listNotes();
    return NextResponse.json(notes.map(toNoteDto));
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function createNote(request: NextRequest): Promise<NextResponse> {
  const parsed = await parseBody(request, NoteBodySchema, { details: false });
  if (parsed.success === false) return parsed.response;

  const { title, content } = parsed.data;
  try {
    const created = await services.createNote({
      title: (title ?? "") as string,
      content: (content ?? "") as string,
    });
    return NextResponse.json(toNoteDto(created));
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function updateNote(request: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const { id } = await ctx.params;

  const parsed = await parseBody(request, NoteBodySchema, { details: false });
  if (parsed.success === false) return parsed.response;

  const { title, content } = parsed.data;
  try {
    await services.updateNote(id, {
      title: title as string,
      content: content as string,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function deleteNote(_request: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const { id } = await ctx.params;
  try {
    await services.deleteNote(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleServiceError(err);
  }
}
