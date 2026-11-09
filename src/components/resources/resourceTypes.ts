import { z } from "zod";

export type TranslationDict = Record<string, string | string[]>;

export type { NoteResourceRecord as NoteResource } from "@/types/records";

/** Result of parsing a single block (Opis:/Description: ... URL: ... Tagi:/Tags: ...). */
export const ParsedResourceBlockSchema = z.object({
  description: z.string(),
  url: z.string(),
  tags: z.array(z.string()),
});

export type ParsedResourceBlock = z.infer<typeof ParsedResourceBlockSchema>;

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

export interface ResourceSectionProps {
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  t: TranslationDict;
}
