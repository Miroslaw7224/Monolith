import { z } from "zod";
import type { NexusDoc, NexusDocSummary } from "./models";

export const NexusDocSummaryDtoSchema = z.object({
  path: z.string(),
  area: z.enum(["Knowledge", "Projects"]),
  group: z.string(),
  title: z.string(),
  tags: z.array(z.string()),
});

export const NexusDocDtoSchema = NexusDocSummaryDtoSchema.extend({
  frontmatter: z.array(z.object({ key: z.string(), value: z.string() })),
  body: z.string(),
});

/** Segmenty catch-all `[...path]`; właściwa walidacja i błędy 400 są w `services.ts`. */
export const NexusDocPathParamsSchema = z.object({ path: z.array(z.string()).min(1) });

export type NexusDocSummaryDto = z.infer<typeof NexusDocSummaryDtoSchema>;
export type NexusDocDto = z.infer<typeof NexusDocDtoSchema>;

export function toSummaryDto(doc: NexusDocSummary): NexusDocSummaryDto {
  return {
    path: doc.path,
    area: doc.area,
    group: doc.group,
    title: doc.title,
    tags: [...doc.tags],
  };
}

export function toDocDto(doc: NexusDoc): NexusDocDto {
  return {
    ...toSummaryDto(doc),
    frontmatter: doc.frontmatter.map((line) => ({ key: line.key, value: line.value })),
    body: doc.body,
  };
}
