import { z } from "zod";
import type {
  BoardTask,
  BugEntry,
  ChecklistItem,
  ChecklistSection,
  ContextPack,
  DevlogEntry,
  Freshness,
  Owner,
  Project,
  ProjectState,
  ProjectType,
  ProjectWithContent,
  TasksBoard,
} from "./models";

export type { Owner, ProjectType };

// ── wejście (zod) ──────────────────────────────────────────────────────────────

const VERSION_RE = /^(\d+):([0-9a-f]{64})$/;
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isIsoDate(value: string): boolean {
  const m = ISO_DATE_RE.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const month = Number(m[2]);
  const d = Number(m[3]);
  const probe = new Date(Date.UTC(y, month - 1, d));
  return (
    probe.getUTCFullYear() === y && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === d
  );
}

const oneLine = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((v) => !/[\r\n]/.test(v), "Tylko jedna linia");

const httpUrl = z
  .string()
  .trim()
  .max(300)
  .refine((v) => /^https?:\/\/\S+$/i.test(v), "Dozwolone tylko linki http(s)");

/** Typ projektu; lista zgodna z `PROJECT_TYPES` w `models` (pilnuje test). */
export const ProjectTypeSchema = z.enum(["etat", "wlasny", "biblioteka"]);
export const ProjectTypeInputSchema = z.object({ type: ProjectTypeSchema });

function toVersion(v: string): { size: number; hash: string } | null {
  const m = VERSION_RE.exec(v);
  return m ? { size: Number(m[1]), hash: m[2] } : null;
}

/** `"<size>:<hash>"` z GET albo `null` (plik ma nie istnieć). */
const nullableVersion = z
  .string()
  .regex(VERSION_RE, "Zła wersja pliku")
  .nullable()
  .transform((v) => (v === null ? null : toVersion(v)));

/** Wersja wymagana (plik istnieje); po regexie nigdy `null`. */
const requiredVersion = z.string().regex(VERSION_RE, "Zła wersja pliku").transform(toVersion);

/** Wejście `PUT /api/projects/[id]/state`. `version`: `null` (tworzenie) albo `"<size>:<hash>"` z GET. */
export const StateInputSchema = z.object({
  branch: oneLine(200),
  env: oneLine(200),
  blocker: oneLine(500),
  nextStep: oneLine(500),
  links: z.array(httpUrl).max(10),
  milestone: oneLine(200),
  milestoneDue: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === "" ? undefined : v))
    .refine((v) => v === undefined || isIsoDate(v), "Data w formacie RRRR-MM-DD"),
  version: nullableVersion,
});

/** Wejście `POST /api/projects/[id]/devlog`. */
export const DevlogInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .refine((v) => !/[\r\n]/.test(v), "Tytuł w jednej linii")
    .refine((v) => !v.startsWith("#"), "Tytuł nie może zaczynać się od #"),
  why: z
    .string()
    .max(2000)
    .transform((v) => v.replace(/\r\n/g, "\n").trim())
    .refine((v) => !/^#{1,2}\s/m.test(v), "Linia nie może zaczynać się od # lub ##"),
});

/** Limit zadań w kolumnie „Teraz” dla UI; wartość zgodna z `NOW_LIMIT` w `models` (pilnuje test). */
export const NOW_LIMIT = 3;

/** Kolumny tablicy zadań; lista zgodna z `TASK_COLUMNS` w `models` (pilnuje test). */
export const TaskColumnSchema = z.enum(["blockers", "now", "next", "icebox"]);

const TRAILING_DONE_DATE_RE = /\s—\s\d{4}-\d{2}-\d{2}$/;

/** Tekst nowego lub edytowanego zadania: jedna linia, bez znacznika Teraz i bez końcowej daty ukończenia. */
const taskText = z
  .string()
  .trim()
  .min(1)
  .max(300)
  .refine((v) => !/[\r\n]/.test(v), "Tylko jedna linia")
  .refine((v) => !v.includes("[now::]"), "Tekst nie może zawierać [now::]")
  .refine((v) => !TRAILING_DONE_DATE_RE.test(v), "Tekst nie może kończyć się datą ukończenia");

/** Tekst istniejącego zadania (referencja do linii): bez reguł kanoniczności, bo plik bywa edytowany ręcznie. */
const refText = z
  .string()
  .trim()
  .min(1)
  .max(1000)
  .refine((v) => !/[\r\n]/.test(v), "Tylko jedna linia");

const taskIndex = z.number().int().min(0).max(999);

/**
 * Wejście `POST /api/projects/[id]/tasks`. `add` przyjmuje `version: null` (plik ma nie istnieć),
 * pozostałe operacje wymagają wersji `tasks.md` z GET (`board.version`).
 */
export const TaskOpInputSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("add"),
    column: TaskColumnSchema,
    text: taskText,
    version: nullableVersion,
  }),
  z.object({
    op: z.literal("toggle"),
    column: TaskColumnSchema,
    index: taskIndex,
    text: refText,
    version: requiredVersion,
  }),
  z.object({
    op: z.literal("remove"),
    column: TaskColumnSchema,
    index: taskIndex,
    text: refText,
    version: requiredVersion,
  }),
  z.object({
    op: z.literal("edit"),
    column: TaskColumnSchema,
    index: taskIndex,
    text: refText,
    newText: taskText,
    version: requiredVersion,
  }),
  z.object({
    op: z.literal("move"),
    column: TaskColumnSchema,
    index: taskIndex,
    text: refText,
    to: TaskColumnSchema,
    version: requiredVersion,
  }),
]);

/** Co wysyła UI (przed transformacjami). */
export type StateInputDto = z.input<typeof StateInputSchema>;
export type DevlogInputDto = z.input<typeof DevlogInputSchema>;
export type TaskOpInputDto = z.input<typeof TaskOpInputSchema>;

// ── wyjście (DTO) ──────────────────────────────────────────────────────────────

export const DEVLOG_LIMIT = 50;

export type ChecklistItemDto = ChecklistItem;
export type ChecklistSectionDto = ChecklistSection;
export type BoardTaskDto = BoardTask;
/** Tablica zadań projektu; `version` to `"<size>:<hash>"` pliku `tasks.md` (`null`, gdy pliku nie ma). */
export type TasksBoardDto = Omit<TasksBoard, "version"> & { version: string | null };
export type BugEntryDto = BugEntry;
export type FreshnessDto = Freshness;

export type ProjectStateDto = {
  branch: string;
  env: string;
  blocker: string;
  nextStep: string;
  links: string[];
  milestone: string;
  milestoneDue?: string;
  updated?: string;
};
export type DevlogEntryDto = DevlogEntry;

export type ProjectSummaryDto = {
  id: string;
  name: string;
  status: string;
  priority: string;
  localPath: string;
  deploy?: string;
  github?: string;
  owner: Owner;
  lastWorked?: string;
  stateConfidence?: string;
  type?: ProjectType;
  freshness: FreshnessDto;
};

export type ProjectDetailDto = ProjectSummaryDto & {
  tasks: ChecklistSectionDto[];
  board: TasksBoardDto;
  bugs: BugEntryDto[];
  whereIStopped: string | null;
  state: ProjectStateDto | null;
  /** `"<size>:<hash>"` pliku `state.md` (do odesłania w PUT); `null`, gdy pliku nie ma. */
  stateVersion: string | null;
  devlog: DevlogEntryDto[];
};

function toStateDto(state: ProjectState): ProjectStateDto {
  const dto: ProjectStateDto = {
    branch: state.branch,
    env: state.env,
    blocker: state.blocker,
    nextStep: state.nextStep,
    links: state.links,
    milestone: state.milestone,
  };
  if (state.milestoneDue !== undefined) dto.milestoneDue = state.milestoneDue;
  if (state.updated !== undefined) dto.updated = state.updated;
  return dto;
}

export function toSummaryDto(p: Project): ProjectSummaryDto {
  const dto: ProjectSummaryDto = {
    id: p.id,
    name: p.name,
    status: p.status,
    priority: p.priority,
    localPath: p.localPath,
    owner: p.owner,
    freshness: p.freshness,
  };
  if (p.deploy !== undefined) dto.deploy = p.deploy;
  if (p.github !== undefined) dto.github = p.github;
  if (p.lastWorked !== undefined) dto.lastWorked = p.lastWorked;
  if (p.stateConfidence !== undefined) dto.stateConfidence = p.stateConfidence;
  if (p.type !== undefined) dto.type = p.type;
  return dto;
}

export function toDetailDto(p: ProjectWithContent): ProjectDetailDto {
  return {
    ...toSummaryDto(p),
    tasks: p.tasks,
    board: {
      blockers: p.board.blockers,
      now: p.board.now,
      next: p.board.next,
      icebox: p.board.icebox,
      version: p.board.version ? `${p.board.version.size}:${p.board.version.hash}` : null,
    },
    bugs: p.bugs,
    whereIStopped: p.whereIStopped,
    state: p.state ? toStateDto(p.state) : null,
    stateVersion: p.stateVersion ? `${p.stateVersion.size}:${p.stateVersion.hash}` : null,
    devlog: p.devlog.slice(0, DEVLOG_LIMIT),
  };
}

// ── paczka kontekstu dla agenta (etap 1-4) ──────────────────────────────────────

export type ContextPackDto = {
  markdown: string;
  approxTokens: number;
  truncated: boolean;
  warnings: string[];
};

export function toContextPackDto(p: ContextPack): ContextPackDto {
  return {
    markdown: p.markdown,
    approxTokens: p.approxTokens,
    truncated: p.truncated,
    warnings: p.warnings,
  };
}
