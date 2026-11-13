import { z } from "zod";
import { looseObject } from "@/lib/schema/looseObject";
import type { Note } from "./models";

// ── wejście (zod) ──────────────────────────────────────────────────────────────

export const NoteBodySchema = looseObject({
  title: z.unknown().optional(),
  content: z.unknown().optional(),
});

// ── wyjście (DTO) ──────────────────────────────────────────────────────────────

export type NoteDto = {
  id: string;
  title: string;
  content: string;
  created_at?: string;
};

export function toNoteDto(note: Note): NoteDto {
  return {
    id: note.id,
    title: note.title,
    content: note.content,
    created_at: note.created_at,
  };
}
