import { readList, updateList } from "@/lib/nexus/yaml-store";
import type { Closing, Pinned } from "./models";

const FILE = "Cockpit/pinned.yaml";
const LIST_KEY = "projects";

/** Brak pliku = pusta lista. Uszkodzony YAML rzuca błąd z nazwą pliku (serwis robi z niego ostrzeżenie). */
export function readPinned(): Pinned {
  const ids: string[] = [];
  for (const item of readList(FILE, LIST_KEY)) {
    const id = typeof item.id === "string" ? item.id.trim() : "";
    if (id !== "" && !ids.includes(id)) ids.push(id);
  }
  return { ids };
}

/**
 * Zastępuje całą listę przez `updateList` (ponawianie na świeżej treści przy zmianie zewnętrznej,
 * po wyczerpaniu prób `ConflictError` = 409; plik, który się nie parsuje, nie jest nadpisywany).
 */
export async function writePinned(ids: string[]): Promise<void> {
  await updateList(FILE, LIST_KEY, () => ids.map((id) => ({ id })));
}

const CLOSING_FILE = "Cockpit/closing.yaml";
const CLOSING_KEY = "days";
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Wpisy rosnąco po dacie; wpisy bez poprawnej daty lub tekstu (ręczna edycja) są pomijane. */
export function readClosings(): Closing[] {
  const result: Closing[] = [];
  for (const item of readList(CLOSING_FILE, CLOSING_KEY)) {
    const date = text(item.date);
    const body = text(item.text);
    if (!DAY_RE.test(date) || body === "") continue;
    result.push({
      date,
      text: body,
      projectId: text(item.project) || null,
      commits:
        typeof item.commits === "number" && Number.isInteger(item.commits) && item.commits >= 0
          ? item.commits
          : null,
    });
  }
  return result.sort((a, b) => a.date.localeCompare(b.date));
}

/** Jeden wpis na dzień: ten sam `date` nadpisuje poprzedni. Plik, który się nie parsuje, nie jest nadpisywany. */
export async function upsertClosing(closing: Closing): Promise<void> {
  await updateList(CLOSING_FILE, CLOSING_KEY, (items) => {
    const kept = items.filter((i) => text(i.date) !== closing.date);
    const entry: Record<string, unknown> = { date: closing.date, text: closing.text };
    if (closing.projectId) entry.project = closing.projectId;
    if (closing.commits !== null) entry.commits = closing.commits;
    return [...kept, entry].sort((a, b) => text(a.date).localeCompare(text(b.date)));
  });
}
