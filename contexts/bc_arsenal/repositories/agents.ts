import type { YamlRecord } from "@/lib/nexus/yaml-lists";
import { readList } from "@/lib/nexus/yaml-store";
import {
  appendRecord,
  generateId,
  optStr,
  patchRecord,
  removeRecord,
} from "@/lib/nexus/record-helpers";
import { AGENTS_FILE, AGENTS_KEY, type AgentsEntry, type AgentsEntryInput } from "../models";

/** `null` = wpis uszkodzony (brak id/nazwy, nieznany rodzaj albo brak pola głównego). */
function toEntry(record: YamlRecord): AgentsEntry | null {
  const id = optStr(record.id);
  const name = optStr(record.name);
  if (id === undefined || name === undefined) return null;
  const description = optStr(record.description);
  switch (record.kind) {
    case "agent": {
      const role = optStr(record.role);
      if (role === undefined) return null;
      const model = optStr(record.model);
      const when = optStr(record.when);
      return {
        kind: "agent",
        id,
        name,
        role,
        ...(model !== undefined && { model }),
        ...(when !== undefined && { when }),
      };
    }
    case "preset": {
      const command = optStr(record.command);
      if (command === undefined) return null;
      return {
        kind: "preset",
        id,
        name,
        command,
        ...(description !== undefined && { description }),
      };
    }
    case "script": {
      const path = optStr(record.path);
      if (path === undefined) return null;
      const example = optStr(record.example);
      return {
        kind: "script",
        id,
        name,
        path,
        ...(description !== undefined && { description }),
        ...(example !== undefined && { example }),
      };
    }
    default:
      return null;
  }
}

/** Wszystkie klucze rodzajów; `undefined` kasuje klucz przy `patchRecord` i jest pomijane przy dopisywaniu. */
const CLEARED = {
  role: undefined,
  model: undefined,
  when: undefined,
  command: undefined,
  path: undefined,
  description: undefined,
  example: undefined,
};

/** Kolejność kluczy: `kind`, `name`, potem pola w kolejności `CLEARED` (stały układ pliku). */
function toFields(input: AgentsEntryInput): Record<string, unknown> {
  const base = { kind: input.kind, name: input.name, ...CLEARED };
  switch (input.kind) {
    case "agent":
      return { ...base, role: input.role, model: input.model, when: input.when };
    case "preset":
      return { ...base, command: input.command, description: input.description };
    case "script":
      return { ...base, path: input.path, description: input.description, example: input.example };
  }
}

export function readAgentEntries(): { entries: AgentsEntry[]; skipped: number } {
  const entries: AgentsEntry[] = [];
  let skipped = 0;
  for (const record of readList(AGENTS_FILE, AGENTS_KEY)) {
    const entry = toEntry(record);
    if (entry === null) skipped += 1;
    else entries.push(entry);
  }
  return { entries, skipped };
}

export async function insertAgentEntry(input: AgentsEntryInput): Promise<AgentsEntry> {
  const record = await appendRecord(AGENTS_FILE, AGENTS_KEY, (taken) => ({
    id: generateId(taken),
    ...toFields(input),
  }));
  const entry = toEntry(record);
  if (entry === null) throw new Error("Zapisany wpis jest niepoprawny"); // walidacja jest w schemacie
  return entry;
}

export async function replaceAgentEntry(id: string, input: AgentsEntryInput): Promise<void> {
  await patchRecord(AGENTS_FILE, AGENTS_KEY, id, toFields(input), "Wpis nie istnieje");
}

export async function deleteAgentEntry(id: string): Promise<void> {
  await removeRecord(AGENTS_FILE, AGENTS_KEY, id);
}
