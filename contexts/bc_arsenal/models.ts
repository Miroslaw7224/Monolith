import type { SkillCategory } from "@/lib/schema/skill-category";

/** Skille jako dokumenty: `Vault/Arsenal/Skills/<slug>/skill.md` (+ opcjonalny `templates/`). */
export const SKILLS_DIR = "Arsenal/Skills";
/** Prompty zostają w Bazie wiedzy (czytane bez przenoszenia). */
export const PROMPTS_DIR = "Knowledge/prompty";
/** Maksymalna długość `summary` na liście. */
export const SUMMARY_MAX = 90;
/** Ten sam tekst co `OWNER_WORK_WARNING` w paczce kontekstu (`bc_projects`). */
export const WORK_TARGET_NOTE = "Dane z firmy: sprawdź, gdzie wklejasz";

export type DeployMode = "full" | "adapted";
export type Owner = "personal" | "work";

export type Deployment = { project: string; mode: DeployMode; date: string };
export type TemplateFile = { name: string; text: string };

type EntryBase = { id: string; path: string; name: string; summary: string; body: string };

export type SkillEntry = EntryBase & {
  kind: "skill";
  slug: string;
  origin?: string;
  /** Nieznana wartość we frontmatterze jest pomijana. */
  category?: SkillCategory;
  /** `description` z frontmattera (kiedy skill się uruchamia); tylko do promptu wdrożenia, nie w DTO. */
  description?: string;
  deployed: Deployment[];
  templates: TemplateFile[];
};

export type PromptEntry = EntryBase & {
  kind: "prompt";
  model?: string;
  /** `id` projektów z rejestru, jak w frontmatterze promptu. */
  projects: string[];
};

export type ArsenalEntry = SkillEntry | PromptEntry;

export type DeployTarget = {
  id: string;
  name: string;
  localPath: string;
  owner: Owner;
  /** Jak `ProjectSummaryDto.companyData` (spec rodzajów). */
  companyData: boolean;
};

export type ArsenalCatalog = {
  entries: ArsenalEntry[];
  targets: DeployTarget[];
  /** Pominięte pliki skilli oraz wpisy `deployed` odrzucone przy odczycie. */
  skipped: number;
};

export type DeployInstructions = { mode: DeployMode; text: string; note?: string };

/** Plik po odczycie; `parsed` = `null`, gdy brak poprawnego frontmattera. */
export type RawFile = {
  path: string;
  /** Nazwa folderu skilla albo nazwa pliku promptu bez `.md`. */
  key: string;
  parsed: { meta: Record<string, unknown>; body: string } | null;
};

// ── kursy (`Arsenal/courses.yaml`) ───────────────────────────────────────────────

export const COURSES_FILE = "Arsenal/courses.yaml";
export const COURSES_KEY = "courses";
/** Katalog PDF-ów certyfikatów; `certificate_file` jest ścieżką względem niego. */
export const COURSE_CERT_DIR = "Documents";

export const COURSE_STATUSES = ["plan", "w-trakcie", "ukonczony"] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];

export type Course = {
  id: string;
  title: string;
  url: string;
  provider?: string;
  status: CourseStatus;
  /** RRRR-MM-DD, tylko dla `ukonczony`. */
  completed?: string;
  certificateUrl?: string;
  /** Względem `Vault/Documents/`. */
  certificateFile?: string;
  note?: string;
};

/** Pola edytowalne (formularz i `PUT`). */
export type CourseInput = Omit<Course, "id">;

/** Kurs z ostrzeżeniem liczonym przez `services`. */
export type CourseEntry = Course & { certificateMissing: boolean };

export type CourseList = { courses: CourseEntry[]; skipped: number };

// ── agenci i polecenia (`Arsenal/agents.yaml`) ────────────────────────────────────

export const AGENTS_FILE = "Arsenal/agents.yaml";
/** Jedna lista na cały plik (G1): rodzaj wpisu w polu `kind`. */
export const AGENTS_KEY = "items";

export const AGENT_KINDS = ["agent", "preset", "script"] as const;
export type AgentKind = (typeof AGENT_KINDS)[number];

/** Kto do czego: agent, rola, model/tier, kiedy używać. */
export type AgentRow = {
  kind: "agent";
  id: string;
  name: string;
  role: string;
  model?: string;
  when?: string;
};

/** Szablon polecenia `ask-helper`; tylko do kopiowania. */
export type PresetRow = {
  kind: "preset";
  id: string;
  name: string;
  command: string;
  description?: string;
};

export type ScriptRow = {
  kind: "script";
  id: string;
  name: string;
  path: string;
  description?: string;
  example?: string;
};

export type AgentsEntry = AgentRow | PresetRow | ScriptRow;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
/** Pola edytowalne (formularz i `PUT`). */
export type AgentsEntryInput = DistributiveOmit<AgentsEntry, "id">;

export type AgentsOverview = {
  agents: AgentRow[];
  presets: PresetRow[];
  scripts: ScriptRow[];
  skipped: number;
};
