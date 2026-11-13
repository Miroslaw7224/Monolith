import { readList, updateList } from "@/lib/nexus/yaml-store";
import type { Pinned } from "./models";

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
