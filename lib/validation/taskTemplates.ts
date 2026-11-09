import { z } from "zod";
import { looseObject } from "@/lib/validation/looseObject";

export const CreateTaskTemplateBodySchema = looseObject({
  label: z.unknown().optional(),
  title: z.unknown().optional(),
  link: z.unknown().optional(),
}).superRefine((body, ctx) => {
  if (typeof body.label !== "string" || !body.label.trim()) {
    ctx.addIssue("label required");
  } else if (typeof body.title !== "string" || !body.title.trim()) {
    ctx.addIssue("title required");
  }
});

export const UpdateTaskTemplateBodySchema = looseObject({
  label: z.unknown().optional(),
  title: z.unknown().optional(),
  link: z.unknown().optional(),
});
