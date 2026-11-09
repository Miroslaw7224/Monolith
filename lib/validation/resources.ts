import { z } from "zod";

/** Body for POST /api/resources (create resource). */
export const CreateResourceBodySchema = z.object({
  description: z.string().min(1, "description is required"),
  url: z.string().url("invalid URL"),
  tags: z.array(z.string()).optional().default([]),
});

/** Body for PUT /api/resources/[resourceId] (partial update). */
export const UpdateResourceBodySchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    url: z.string().url().optional(),
    tags: z.array(z.string()).optional(),
    isFavorite: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one of title, description, url, tags, isFavorite is required",
  });
