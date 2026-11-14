/** Obszary vaulta widoczne w panelu Notatki (tylko odczyt). */
export type NexusArea = "Knowledge" | "Projects";

export const NEXUS_AREAS: readonly NexusArea[] = ["Knowledge", "Projects"];

/** Pliki `Projects/<id>/` obsługiwane przez kartę Projekty; nie pokazujemy ich tutaj (spec D3). */
export const PROJECT_EXCLUDED_FILES: readonly string[] = [
  "index.md",
  "tasks.md",
  "bugs.md",
  "state.md",
  "ai-context.md",
  "devlog.md",
];

/** Treść dłuższa niż 1 MB daje 413 przy odczycie pojedynczego dokumentu. */
export const MAX_DOC_BYTES = 1_048_576;

export type NexusDocSummary = {
  /** Względem korzenia vaulta, np. `Knowledge/alembic.md`. */
  path: string;
  area: NexusArea;
  /** Podkatalog w `Knowledge/` albo id projektu; pusty dla plików luzem w `Knowledge/`. */
  group: string;
  title: string;
  tags: string[];
};

/** Para klucz–wartość frontmattera; wartość jest już tekstem (tablica YAML jako `[a, b]`). */
export type FrontmatterLine = { key: string; value: string };

export type NexusDoc = NexusDocSummary & {
  frontmatter: FrontmatterLine[];
  body: string;
};

/** Plik po odczycie i sparsowaniu frontmattera, jeszcze bez reguł domeny. */
export type RawNexusDoc = {
  path: string;
  meta: Record<string, unknown>;
  body: string;
  bytes: number;
};
