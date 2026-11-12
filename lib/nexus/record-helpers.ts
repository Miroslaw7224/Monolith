import { randomInt } from "node:crypto";
import { DomainError } from "@/lib/errors";
import type { YamlRecord } from "./yaml-lists";
import { updateList } from "./yaml-store";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** 20 znaków alfanumerycznych (kształt jak id z Firestore), bez kolizji z `taken`. */
export function generateId(taken: ReadonlySet<string>): string {
  for (;;) {
    let id = "";
    for (let i = 0; i < 20; i += 1) id += ALPHABET[randomInt(ALPHABET.length)];
    if (!taken.has(id)) return id;
  }
}

export const nowIso = (): string => new Date().toISOString();

/** Wartość pola jako tekst (`null`/`undefined` → ""). */
export function str(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

/** Przycięty tekst albo `undefined`, gdy pusty. */
export function optStr(value: unknown): string | undefined {
  const text = str(value).trim();
  return text === "" ? undefined : text;
}

function timeOf(iso: string | undefined): number {
  const time = Date.parse(iso ?? "");
  return Number.isNaN(time) ? 0 : time;
}

/** Sortuje kopię listy po dacie (brak daty = 0); remisy rosnąco po `id`. */
export function sortByCreated<T extends { id: string }>(
  list: readonly T[],
  created: (item: T) => string | undefined,
  direction: "asc" | "desc"
): T[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...list].sort((a, b) => {
    const diff = timeOf(created(a)) - timeOf(created(b));
    if (diff !== 0) return sign * diff;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** Nakłada `patch` na rekord; wartość `undefined` usuwa klucz. */
export function applyPatch(record: YamlRecord, patch: Record<string, unknown>): YamlRecord {
  const next: YamlRecord = { ...record };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete next[key];
    else next[key] = value;
  }
  return next;
}

/** Dopisuje rekord zbudowany przez `build` (dostaje zajęte id) i zwraca go. */
export async function appendRecord(
  file: string,
  listKey: string,
  build: (takenIds: ReadonlySet<string>) => YamlRecord
): Promise<YamlRecord> {
  let created: YamlRecord | undefined;
  await updateList(file, listKey, (items) => {
    const record = build(new Set(items.map((r) => str(r.id))));
    created = record;
    return [...items, record];
  });
  return created as YamlRecord;
}

/** Nakłada `patch` na rekord o danym `id`; brak rekordu to `DomainError(404)`. */
export async function patchRecord(
  file: string,
  listKey: string,
  id: string,
  patch: Record<string, unknown>,
  notFoundMessage: string
): Promise<void> {
  await updateList(file, listKey, (items) => {
    const index = items.findIndex((r) => str(r.id) === id);
    if (index === -1) throw new DomainError(notFoundMessage, 404);
    const next = [...items];
    next[index] = applyPatch(items[index], patch);
    return next;
  });
}

/** Usuwa rekord o danym `id`; brak rekordu nie powoduje zapisu pliku. */
export async function removeRecord(file: string, listKey: string, id: string): Promise<void> {
  await updateList(file, listKey, (items) => {
    const next = items.filter((r) => str(r.id) !== id);
    return next.length === items.length ? null : next;
  });
}
