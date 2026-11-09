import { z } from "zod";
import { looseObject } from "@/lib/validation/looseObject";

export const CreateTagBodySchema = looseObject({
  tag: z.unknown().optional(),
  title: z.unknown().optional(),
  color: z.unknown().optional(),
}).superRefine((body, ctx) => {
  if (typeof body.tag !== "string" || !body.tag.trim()) {
    ctx.addIssue("tag required");
  }
});

export const UpdateTagBodySchema = looseObject({
  tag: z.unknown().optional(),
  title: z.unknown().optional(),
  color: z.unknown().optional(),
});
