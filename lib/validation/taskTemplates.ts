import { z } from "zod";

export const CreateTaskTemplateBodySchema = z
  .object({
    label: z.unknown().optional(),
    title: z.unknown().optional(),
    link: z.unknown().optional(),
  })
  .superRefine((body, ctx) => {
    if (typeof body.label !== "string" || !body.label.trim()) {
      ctx.addIssue("label required");
    } else if (typeof body.title !== "string" || !body.title.trim()) {
      ctx.addIssue("title required");
    }
  });

export const UpdateTaskTemplateBodySchema = z.object({
  label: z.unknown().optional(),
  title: z.unknown().optional(),
  link: z.unknown().optional(),
});
