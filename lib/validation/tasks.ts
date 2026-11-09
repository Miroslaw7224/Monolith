import { z } from "zod";

export const CreateTaskBodySchema = z
  .object({
    title: z.unknown().optional(),
    link: z.unknown().optional(),
    description: z.unknown().optional(),
    status: z.unknown().optional(),
    due_date: z.unknown().optional(),
    priority: z.unknown().optional(),
  })
  .superRefine((body, ctx) => {
    if (!body.title || typeof body.title !== "string") {
      ctx.addIssue("title required");
    }
  });

export const UpdateTaskBodySchema = z.object({
  title: z.unknown().optional(),
  link: z.unknown().optional(),
  description: z.unknown().optional(),
  status: z.unknown().optional(),
  due_date: z.unknown().optional(),
  priority: z.unknown().optional(),
  order: z.unknown().optional(),
});
