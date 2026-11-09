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

export { CreateResourceBodySchema, UpdateResourceBodySchema } from "@/lib/validation/resources";

export interface ResourceSectionProps {
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  t: TranslationDict;
}
