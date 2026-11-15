import { z } from "zod";
import type { ArsenalCatalog, ArsenalEntry, DeployInstructions, DeployTarget } from "./models";

export const DeployModeSchema = z.enum(["full", "adapted"]);

/** Zapytanie `GET …/deploy?project=&mode=` i ciało `POST …/deployed`. */
export const DeployQuerySchema = z.object({
  project: z.string().min(1).max(100),
  mode: DeployModeSchema,
});
export const MarkDeployedBodySchema = DeployQuerySchema;

const DeploymentDtoSchema = z.object({
  project: z.string(),
  mode: DeployModeSchema,
  date: z.string(),
});
const TemplateDtoSchema = z.object({ name: z.string(), text: z.string() });

const entryBase = {
  id: z.string(),
  path: z.string(),
  name: z.string(),
  summary: z.string(),
  body: z.string(),
};

export const SkillEntryDtoSchema = z.object({
  kind: z.literal("skill"),
  ...entryBase,
  slug: z.string(),
  origin: z.string().optional(),
  deployed: z.array(DeploymentDtoSchema),
  templates: z.array(TemplateDtoSchema),
});

export const PromptEntryDtoSchema = z.object({
  kind: z.literal("prompt"),
  ...entryBase,
  model: z.string().optional(),
  projects: z.array(z.string()),
});

export const ArsenalEntryDtoSchema = z.discriminatedUnion("kind", [
  SkillEntryDtoSchema,
  PromptEntryDtoSchema,
]);

export const DeployTargetDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  localPath: z.string(),
  owner: z.enum(["personal", "work"]),
  companyData: z.boolean(),
});

export const CatalogDtoSchema = z.object({
  entries: z.array(ArsenalEntryDtoSchema),
  targets: z.array(DeployTargetDtoSchema),
  skipped: z.number(),
});

export const DeployInstructionsDtoSchema = z.object({
  mode: DeployModeSchema,
  text: z.string(),
  note: z.string().optional(),
});

export type DeployModeDto = z.infer<typeof DeployModeSchema>;
export type SkillEntryDto = z.infer<typeof SkillEntryDtoSchema>;
export type PromptEntryDto = z.infer<typeof PromptEntryDtoSchema>;
export type ArsenalEntryDto = z.infer<typeof ArsenalEntryDtoSchema>;
export type DeployTargetDto = z.infer<typeof DeployTargetDtoSchema>;
export type CatalogDto = z.infer<typeof CatalogDtoSchema>;
export type DeployInstructionsDto = z.infer<typeof DeployInstructionsDtoSchema>;

export function toEntryDto(entry: ArsenalEntry): ArsenalEntryDto {
  const base = {
    id: entry.id,
    path: entry.path,
    name: entry.name,
    summary: entry.summary,
    body: entry.body,
  };
  if (entry.kind === "skill") {
    return {
      kind: "skill",
      ...base,
      slug: entry.slug,
      ...(entry.origin !== undefined && { origin: entry.origin }),
      deployed: entry.deployed.map((d) => ({ ...d })),
      templates: entry.templates.map((t) => ({ ...t })),
    };
  }
  return {
    kind: "prompt",
    ...base,
    ...(entry.model !== undefined && { model: entry.model }),
    projects: [...entry.projects],
  };
}

export function toTargetDto(target: DeployTarget): DeployTargetDto {
  return { ...target };
}

export function toCatalogDto(catalog: ArsenalCatalog): CatalogDto {
  return {
    entries: catalog.entries.map(toEntryDto),
    targets: catalog.targets.map(toTargetDto),
    skipped: catalog.skipped,
  };
}

export function toInstructionsDto(result: DeployInstructions): DeployInstructionsDto {
  return {
    mode: result.mode,
    text: result.text,
    ...(result.note !== undefined && { note: result.note }),
  };
}
