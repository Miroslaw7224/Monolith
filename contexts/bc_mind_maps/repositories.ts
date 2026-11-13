import { DomainError } from "@/lib/errors";
import type { MindMap, MindMapNode } from "./models";
import {
  deleteVaultFile,
  listVaultFiles,
  readVaultFile,
  updateVaultFile,
  writeVaultFile,
} from "@/lib/nexus/vault-fs";
import { generateId, nowIso } from "@/lib/nexus/record-helpers";

const DIR = "MindMaps";
/** `id` pochodzi z URL, więc budujemy ścieżkę tylko z bezpiecznego identyfikatora. */
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const NOT_FOUND = "Mind map not found";

type Stored = {
  title: string;
  rootNode: MindMapNode;
  colWidths: Record<number, number>;
  createdAt?: string;
  updatedAt?: string;
};

const relOf = (id: string): string => `${DIR}/${id}.json`;

function parseStored(text: string, rel: string): Stored {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Nie można odczytać pliku ${rel}: ${reason}`);
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(`Nie można odczytać pliku ${rel}: oczekiwano obiektu JSON`);
  }
  const record = data as Record<string, unknown>;
  return {
    title: typeof record.title === "string" ? record.title : "",
    rootNode: record.rootNode as MindMapNode,
    colWidths: (record.colWidths as Record<number, number> | undefined) ?? {},
    createdAt: typeof record.createdAt === "string" ? record.createdAt : undefined,
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : undefined,
  };
}

/** Kolejność kluczy w pliku jest stała; rekord nie przechowuje właściciela (M1). */
function serialize(stored: Stored): string {
  const { title, rootNode, colWidths, createdAt, updatedAt } = stored;
  return JSON.stringify({ title, rootNode, colWidths, createdAt, updatedAt }, null, 2) + "\n";
}

function toMindMap(id: string, stored: Stored): MindMap {
  return { id, ...stored };
}

export async function getMindMaps(): Promise<MindMap[]> {
  const maps: MindMap[] = [];
  for (const name of listVaultFiles(DIR)) {
    if (!name.endsWith(".json")) continue;
    const id = name.slice(0, -".json".length);
    if (!ID_PATTERN.test(id)) continue;
    const file = readVaultFile(relOf(id));
    if (file === null) continue;
    try {
      maps.push(toMindMap(id, parseStored(file.text, relOf(id))));
    } catch {
      // uszkodzony plik nie blokuje listy; bezpośredni odczyt (`getMindMap`) zgłasza błąd
    }
  }
  return maps;
}

export async function getMindMap(mapId: string): Promise<MindMap | null> {
  if (!ID_PATTERN.test(mapId)) return null;
  const file = readVaultFile(relOf(mapId));
  if (file === null) return null;
  return toMindMap(mapId, parseStored(file.text, relOf(mapId)));
}

export async function createMindMap(data: {
  title: string;
  rootNode: MindMapNode;
}): Promise<MindMap> {
  const taken = new Set(listVaultFiles(DIR).map((name) => name.replace(/\.json$/, "")));
  const id = generateId(taken);
  const now = nowIso();
  const stored: Stored = {
    title: data.title,
    rootNode: data.rootNode,
    colWidths: {},
    createdAt: now,
    updatedAt: now,
  };
  writeVaultFile(relOf(id), serialize(stored), { expected: null });
  return toMindMap(id, stored);
}

export async function saveMindMap(
  mapId: string,
  patch: { title?: string; rootNode?: MindMapNode; colWidths?: Record<number, number> }
): Promise<void> {
  if (!ID_PATTERN.test(mapId)) throw new DomainError(NOT_FOUND, 404);
  const rel = relOf(mapId);
  await updateVaultFile(rel, (current) => {
    if (current === null) throw new DomainError(NOT_FOUND, 404);
    const stored = parseStored(current, rel);
    return serialize({
      ...stored,
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.rootNode !== undefined ? { rootNode: patch.rootNode } : {}),
      ...(patch.colWidths !== undefined ? { colWidths: patch.colWidths } : {}),
      updatedAt: nowIso(),
    });
  });
}

/** Idempotentne; `ConflictError` (zmiana zewnętrzna między odczytem a usunięciem) propaguje się jako 409. */
export async function deleteMindMap(mapId: string): Promise<void> {
  if (!ID_PATTERN.test(mapId)) return;
  const file = readVaultFile(relOf(mapId));
  if (file === null) return;
  deleteVaultFile(relOf(mapId), { expected: file.version });
}
