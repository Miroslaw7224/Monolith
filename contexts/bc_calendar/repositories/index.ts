import { DomainError } from "@/lib/errors";
import type { CalendarEvent } from "../models";
import { listVaultFiles } from "@/lib/nexus/vault-fs";
import type { YamlRecord } from "@/lib/nexus/yaml-lists";
import { readList } from "@/lib/nexus/yaml-store";
import {
  appendRecord,
  generateId,
  nowIso,
  optStr,
  patchRecord,
  removeRecord,
  str,
} from "@/lib/nexus/record-helpers";
import { eventOverlapsInclusiveRange } from "./range";

const KEY = "events";
const DIR = "Calendar";
const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const MONTH_FILE = /^\d{4}-(0[1-9]|1[0-2])\.yaml$/;

type Entry = { file: string; record: YamlRecord };

/** Plik miesiąca daty początku (T7); zła data to `DomainError(400)` (T10). */
function monthFile(date: string): string {
  if (!DATE.test(date)) throw new DomainError("date must be YYYY-MM-DD", 400);
  return `${DIR}/${date.slice(0, 7)}.yaml`;
}

/** Pliki `Calendar/RRRR-MM.yaml` rosnąco; inne nazwy (notatki, pliki tymczasowe) są ignorowane (T8). */
function monthFiles(): string[] {
  return listVaultFiles(DIR)
    .filter((name) => MONTH_FILE.test(name))
    .map((name) => `${DIR}/${name}`);
}

/** Link z pliku (mógł być edytowany ręcznie): zostaje tylko adres http(s); inne schematy (np. `javascript:`) odpadają. */
function safeLink(value: string | undefined): string | undefined {
  return value !== undefined && /^https?:\/\/\S+$/i.test(value.trim()) ? value.trim() : undefined;
}

function toEvent(r: YamlRecord): CalendarEvent {
  return {
    id: str(r.id),
    date: str(r.date),
    start_minutes: Number(r.start_minutes) || 0,
    duration_minutes: Number(r.duration_minutes) || 0,
    title: str(r.title),
    tags: Array.isArray(r.tags) ? r.tags.map(String) : r.tags ? [String(r.tags)] : [],
    color: optStr(r.color) ?? "#3B82F6",
    type: r.type === "meeting" ? "meeting" : "work",
    link: safeLink(optStr(r.link)),
    brief: optStr(r.brief),
    created_at: optStr(r.created),
  };
}

function stamp(r: YamlRecord): number {
  const time = Date.parse(optStr(r.updated) ?? optStr(r.created) ?? "");
  return Number.isNaN(time) ? 0 : time;
}

/** Wszystkie rekordy ze wszystkich miesięcy; po `id` wygrywa późniejszy `updated`, remis: późniejszy plik (T9). */
function readAll(): Entry[] {
  const byId = new Map<string, Entry>();
  for (const file of monthFiles()) {
    for (const record of readList(file, KEY)) {
      const id = str(record.id);
      const known = byId.get(id);
      if (!known || stamp(record) >= stamp(known.record)) byId.set(id, { file, record });
    }
  }
  return [...byId.values()];
}

export async function getCalendarEvents(options?: {
  startDate?: string;
  endDate?: string;
}): Promise<CalendarEvent[]> {
  let list = readAll().map((entry) => toEvent(entry.record));
  const { startDate, endDate } = options ?? {};
  if (startDate && endDate) {
    list = list.filter((e) => eventOverlapsInclusiveRange(e, startDate, endDate));
  } else if (startDate) {
    list = list.filter((e) => e.date >= startDate);
  } else if (endDate) {
    list = list.filter((e) => e.date <= endDate);
  }
  return list.sort(
    (a, b) =>
      a.date.localeCompare(b.date) || a.start_minutes - b.start_minutes || a.id.localeCompare(b.id)
  );
}

export async function createCalendarEvent(data: {
  date: string;
  start_minutes: number;
  duration_minutes: number;
  title: string;
  tags: string[];
  color: string;
  type?: "work" | "meeting";
  link?: string;
  brief?: string;
}): Promise<CalendarEvent> {
  const file = monthFile(data.date);
  const record = await appendRecord(file, KEY, (taken) => ({
    id: generateId(taken),
    date: data.date,
    start_minutes: data.start_minutes,
    duration_minutes: data.duration_minutes,
    title: data.title,
    tags: data.tags ?? [],
    color: data.color ?? "#3B82F6",
    type: data.type === "meeting" ? "meeting" : "work",
    ...(data.link ? { link: data.link } : {}),
    ...(data.brief ? { brief: data.brief } : {}),
    created: nowIso(),
  }));
  return toEvent(record);
}

export async function updateCalendarEvent(
  eventId: string,
  data: Partial<{
    date: string;
    start_minutes: number;
    duration_minutes: number;
    title: string;
    tags: string[];
    color: string;
    type: "work" | "meeting";
    /** Pusty tekst usuwa link. */
    link: string;
    /** Pusty tekst usuwa brief. */
    brief: string;
  }>
): Promise<void> {
  const patch: YamlRecord = {};
  if (data.date !== undefined) patch.date = data.date;
  if (data.start_minutes !== undefined) patch.start_minutes = data.start_minutes;
  if (data.duration_minutes !== undefined) patch.duration_minutes = data.duration_minutes;
  if (data.title !== undefined) patch.title = data.title;
  if (data.tags !== undefined) patch.tags = data.tags;
  if (data.color !== undefined) patch.color = data.color;
  if (data.type !== undefined) patch.type = data.type === "meeting" ? "meeting" : "work";
  if (data.link !== undefined) patch.link = data.link === "" ? undefined : data.link;
  if (data.brief !== undefined) patch.brief = data.brief === "" ? undefined : data.brief;
  if (Object.keys(patch).length === 0) return;
  const newFile = data.date !== undefined ? monthFile(data.date) : undefined;
  patch.updated = nowIso();

  const entry = readAll().find((e) => str(e.record.id) === eventId);
  if (!entry) throw new DomainError("Calendar event not found", 404);

  if (newFile === undefined || newFile === entry.file) {
    await patchRecord(entry.file, KEY, eventId, patch, "Calendar event not found");
    return;
  }
  // Przeniesienie (T9): najpierw zapis w nowym miesiącu, potem usunięcie ze starego.
  await appendRecord(newFile, KEY, () => ({ ...entry.record, ...patch }));
  await removeRecord(entry.file, KEY, eventId);
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  for (const file of monthFiles()) {
    if (readList(file, KEY).some((r) => str(r.id) === eventId)) {
      await removeRecord(file, KEY, eventId);
    }
  }
}
