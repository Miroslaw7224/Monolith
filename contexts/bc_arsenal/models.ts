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
