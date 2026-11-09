import { z } from "zod";

export const CreateTagBodySchema = z
  .object({
    tag: z.unknown().optional(),
    title: z.unknown().optional(),
    color: z.unknown().optional(),
  })
  .superRefine((body, ctx) => {
    if (typeof body.tag !== "string" || !body.tag.trim()) {
      ctx.addIssue("tag required");
    }
  });

export const UpdateTagBodySchema = z.object({
  tag: z.unknown().optional(),
  title: z.unknown().optional(),
  color: z.unknown().optional(),
});
