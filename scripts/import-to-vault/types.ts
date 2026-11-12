import type { TaskLine } from "../../lib/nexus/task-line";

export const EXIT = { OK: 0, USAGE: 1, DUMP: 2, PATH: 3, VERIFY: 4 } as const;

export const HANDLED_TYPES = [
  "notes",
  "tasks",
  "resources",
  "user_tags",
  "task_templates",
] as const;
export type HandledType = (typeof HANDLED_TYPES)[number];

/** Jedna linia JSONL zrzutu: {"_id","_path","data"}. */
export type DumpRow = { id: string; path: string; data: Record<string, unknown> };

/** Kolekcja (lub jej część) pominięta świadomie, z powodem. `type` ustawione, gdy to kolekcja obsługiwana innego konta. */
export type SkippedGroup = {
  path: string;
  count: number;
  reason: string;
  type: HandledType | null;
};

export type DumpData = {
  dumpDir: string;
  uid: string;
  exportedAt: string;
  rows: Record<HandledType, DumpRow[]>;
  skipped: SkippedGroup[];
};

export type VaultNote = {
  id: string;
  title: string;
  html: string;
  created: string | null;
  updated: string | null;
  tags: string[];
};
export type VaultResource = {
  id: string;
  title: string;
  url: string;
  description: string;
  tags: string[];
  favorite: boolean;
  thumbnail_url?: string;
  note_id?: string;
  created?: string;
  updated?: string;
};
export type VaultTag = { id: string; tag: string; title: string; color?: string; created?: string };
export type VaultTemplate = {
  id: string;
  label: string;
  title: string;
  link: string;
  created?: string;
};

export type Converted = {
  notes: VaultNote[];
  tasks: TaskLine[];
  resources: VaultResource[];
  tags: VaultTag[];
  templates: VaultTemplate[];
  warnings: string[];
};

/** Widok vaulta tylko do odczytu. Ścieżki względne, separator "/". */
export interface VaultView {
  read(rel: string): string | null; // null, gdy plik nie istnieje
  list(relDir: string): string[]; // nazwy plików (bez katalogów); [] gdy katalog nie istnieje
}

export type PlannedKind = "note" | "note-html" | "tasks" | "resources" | "tags" | "templates";
export type PlannedFile = {
  relPath: string;
  content: string;
  kind: PlannedKind;
  action: "create" | "update" | "unchanged";
};

export type NoteLoss = { id: string; relPath: string; losses: string[] };

export type PlanResult = {
  files: PlannedFile[];
  /** Ścieżki plików pojedynczych (mogą mieć sufiks). Brak klucza = brak rekordów danego typu. */
  targets: { tasks?: string; resources?: string; tags?: string; templates?: string };
  /** Ścieżka pliku każdej notatki po id. */
  noteFiles: Record<string, string>;
  noteLosses: NoteLoss[];
  warnings: string[];
};
