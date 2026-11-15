import { z } from "zod";
import { isIsoDay } from "@/lib/schema/archive-date";
import { isHttpUrl, isSafeCertificatePath } from "@/lib/schema/course-fields";
import type {
  ArsenalCatalog,
  AgentsEntry,
  AgentsOverview,
  ArsenalEntry,
  CourseEntry,
  CourseList,
  DeployInstructions,
  DeployTarget,
} from "./models";

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

// ── kursy ────────────────────────────────────────────────────────────────────────

/** Statusy kursu; `schemas` nie importuje runtime z `models` (R3), a typy wymusza przypisanie w routerze. */
export const COURSE_STATUSES = ["plan", "w-trakcie", "ukonczony"] as const;

/** Tekst przycięty; pusty = `undefined` (puste pole formularza kasuje klucz w pliku, K5). */
const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .transform((value) => {
      const text = value?.trim();
      return text === "" ? undefined : text;
    });

/** Body `POST /api/arsenal/courses` i `PUT /api/arsenal/courses/[courseId]`. */
export const CourseInputSchema = z
  .object({
    title: z.string().trim().min(1, "title is required").max(200),
    url: z.string().trim().max(2000),
    provider: optionalText(100),
    status: z.enum(COURSE_STATUSES),
    completed: optionalText(10),
    certificateUrl: optionalText(2000),
    certificateFile: optionalText(200),
    note: optionalText(1000),
  })
  .superRefine((course, ctx) => {
    const bad = (field: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [field], message });
    if (!isHttpUrl(course.url)) bad("url", "url must start with http:// or https://");
    if (course.certificateUrl !== undefined && !isHttpUrl(course.certificateUrl)) {
      bad("certificateUrl", "certificateUrl must start with http:// or https://");
    }
    if (course.certificateFile !== undefined && !isSafeCertificatePath(course.certificateFile)) {
      bad("certificateFile", "certificateFile must be a relative path inside Documents/");
    }
    if (course.completed !== undefined && !isIsoDay(course.completed)) {
      bad("completed", "completed must be YYYY-MM-DD");
    }
  });

export type CourseInputDto = z.input<typeof CourseInputSchema>;

export const CourseDtoSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  provider: z.string().optional(),
  status: z.enum(COURSE_STATUSES),
  completed: z.string().optional(),
  certificateUrl: z.string().optional(),
  certificateFile: z.string().optional(),
  certificateMissing: z.boolean(),
  note: z.string().optional(),
});

export const CoursesDtoSchema = z.object({
  courses: z.array(CourseDtoSchema),
  skipped: z.number(),
});

export type CourseDto = z.infer<typeof CourseDtoSchema>;
export type CoursesDto = z.infer<typeof CoursesDtoSchema>;

export function toCourseDto(entry: CourseEntry): CourseDto {
  return {
    id: entry.id,
    title: entry.title,
    url: entry.url,
    status: entry.status,
    certificateMissing: entry.certificateMissing,
    ...(entry.provider !== undefined && { provider: entry.provider }),
    ...(entry.completed !== undefined && { completed: entry.completed }),
    ...(entry.certificateUrl !== undefined && { certificateUrl: entry.certificateUrl }),
    ...(entry.certificateFile !== undefined && { certificateFile: entry.certificateFile }),
    ...(entry.note !== undefined && { note: entry.note }),
  };
}

export function toCoursesDto(list: CourseList): CoursesDto {
  return { courses: list.courses.map(toCourseDto), skipped: list.skipped };
}

// ── agenci i polecenia ───────────────────────────────────────────────────────────

const requiredText = (max: number) => z.string().trim().min(1).max(max);

const AgentInputSchema = z.object({
  kind: z.literal("agent"),
  name: requiredText(100),
  role: requiredText(500),
  model: optionalText(200),
  when: optionalText(1000),
});
const PresetInputSchema = z.object({
  kind: z.literal("preset"),
  name: requiredText(100),
  command: requiredText(2000),
  description: optionalText(1000),
});
const ScriptInputSchema = z.object({
  kind: z.literal("script"),
  name: requiredText(100),
  path: requiredText(300),
  description: optionalText(1000),
  example: optionalText(2000),
});

/** Body `POST /api/arsenal/agents` i `PUT /api/arsenal/agents/[entryId]`. */
export const AgentEntryInputSchema = z.discriminatedUnion("kind", [
  AgentInputSchema,
  PresetInputSchema,
  ScriptInputSchema,
]);
export type AgentEntryInputDto = z.input<typeof AgentEntryInputSchema>;

const AgentRowDtoSchema = z.object({
  kind: z.literal("agent"),
  id: z.string(),
  name: z.string(),
  role: z.string(),
  model: z.string().optional(),
  when: z.string().optional(),
});
const PresetRowDtoSchema = z.object({
  kind: z.literal("preset"),
  id: z.string(),
  name: z.string(),
  command: z.string(),
  description: z.string().optional(),
});
const ScriptRowDtoSchema = z.object({
  kind: z.literal("script"),
  id: z.string(),
  name: z.string(),
  path: z.string(),
  description: z.string().optional(),
  example: z.string().optional(),
});

export const AgentEntryDtoSchema = z.discriminatedUnion("kind", [
  AgentRowDtoSchema,
  PresetRowDtoSchema,
  ScriptRowDtoSchema,
]);
export const AgentsDtoSchema = z.object({
  agents: z.array(AgentRowDtoSchema),
  presets: z.array(PresetRowDtoSchema),
  scripts: z.array(ScriptRowDtoSchema),
  skipped: z.number(),
});

export type AgentEntryDto = z.infer<typeof AgentEntryDtoSchema>;
export type AgentRowDto = z.infer<typeof AgentRowDtoSchema>;
export type PresetRowDto = z.infer<typeof PresetRowDtoSchema>;
export type ScriptRowDto = z.infer<typeof ScriptRowDtoSchema>;
export type AgentsDto = z.infer<typeof AgentsDtoSchema>;

export function toAgentEntryDto(entry: AgentsEntry): AgentEntryDto {
  const optional = (key: string, value: string | undefined) =>
    value === undefined ? {} : { [key]: value };
  switch (entry.kind) {
    case "agent":
      return {
        kind: "agent",
        id: entry.id,
        name: entry.name,
        role: entry.role,
        ...optional("model", entry.model),
        ...optional("when", entry.when),
      };
    case "preset":
      return {
        kind: "preset",
        id: entry.id,
        name: entry.name,
        command: entry.command,
        ...optional("description", entry.description),
      };
    case "script":
      return {
        kind: "script",
        id: entry.id,
        name: entry.name,
        path: entry.path,
        ...optional("description", entry.description),
        ...optional("example", entry.example),
      };
  }
}

export function toAgentsDto(overview: AgentsOverview): AgentsDto {
  return {
    agents: overview.agents.map((e) => toAgentEntryDto(e) as AgentRowDto),
    presets: overview.presets.map((e) => toAgentEntryDto(e) as PresetRowDto),
    scripts: overview.scripts.map((e) => toAgentEntryDto(e) as ScriptRowDto),
    skipped: overview.skipped,
  };
}
