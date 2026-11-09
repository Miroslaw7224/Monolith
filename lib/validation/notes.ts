import { z } from "zod";
import { looseObject } from "@/lib/validation/looseObject";

export const NoteBodySchema = looseObject({
  title: z.unknown().optional(),
  content: z.unknown().optional(),
});
