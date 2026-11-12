import { z } from "zod";
import { looseObject } from "@/lib/schema/looseObject";

export const NoteBodySchema = looseObject({
  title: z.unknown().optional(),
  content: z.unknown().optional(),
});
