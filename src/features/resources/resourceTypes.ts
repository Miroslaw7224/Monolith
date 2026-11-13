import { z } from "zod";

export type TranslationDict = Record<string, string | string[]>;

export type { ResourceDto as NoteResource } from "@/contexts/bc_resources/schemas";

/** Result of parsing a single block (Opis:/Description: ... URL: ... Tagi:/Tags: ...). */
export const ParsedResourceBlockSchema = z.object({
  description: z.string(),
  url: z.string(),
  tags: z.array(z.string()),
});

export type ParsedResourceBlock = z.infer<typeof ParsedResourceBlockSchema>;

export {
  CreateResourceBodySchema,
  UpdateResourceBodySchema,
} from "@/contexts/bc_resources/schemas";

export interface ResourceSectionProps {
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  t: TranslationDict;
}
