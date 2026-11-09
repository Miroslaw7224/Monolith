import { z } from "zod";

export const NoteBodySchema = z.object({
  title: z.unknown().optional(),
  content: z.unknown().optional(),
});
