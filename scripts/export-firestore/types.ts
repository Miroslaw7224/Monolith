/** Kolekcje, które aplikacja zna (spec 4.3). Wszystko inne jest raportowane jako nieznane. */
export const KNOWN_COLLECTIONS = [
  "users",
  "documents",
  "notes",
  "mindMaps",
  "board",
  "resources",
  "chunks",
  "calendar_events",
  "tasks",
  "user_tags",
  "task_templates",
  "agent_log",
  "waitlist",
] as const;

/**
 * Kolekcje historyczne: po usuniętym module Wiedza/RAG (maj 2026), nic w aplikacji ich nie czyta.
 * Są eksportowane wiernie, ale nie wymagają przeglądu i nie trafią do migracji (0b).
 */
export const HISTORICAL_COLLECTIONS = ["knowledgeNodes", "knowledgeEdges"] as const;

export const MANIFEST_FILE = "manifest.json";
export const AUTH_USERS_FILE = "auth-users.json";
export const DEFAULT_PAGE_SIZE = 500;

export type ManifestStatus = "ok" | "mismatch" | "needs-review";

export type CollectionEntry = {
  /** Pełna ścieżka kolekcji, np. users/u1/tasks. */
  path: string;
  /** Ścieżka pliku względem katalogu zrzutu. */
  file: string;
  /** Czy ostatni segment ścieżki jest na liście KNOWN_COLLECTIONS. */
  known: boolean;
  /** count() przed eksportem. */
  before: number;
  /** Liczba linii w pliku. */
  lines: number;
  /** count() po eksporcie. */
  after: number;
  sha256: string;
};

export type AuthExport =
  | { skipped: true }
  | { ok: true; users: number; file: string }
  | { ok: false; error: string };

export type Manifest = {
  version: 1;
  tool: "export-firestore";
  exportedAt: string;
  projectId: string | null;
  pageSize: number;
  /** Gdy ustawione, eksport objął tylko users/<uid>/… (pozostałe konta i kolekcje główne pominięto). */
  uid: string | null;
  status: ManifestStatus;
  collections: CollectionEntry[];
  /** Ścieżki dokumentów, które nie istnieją, ale mają podkolekcje (np. users/ghost). */
  ghosts: string[];
  auth: AuthExport;
  totals: { collections: number; documents: number };
};
