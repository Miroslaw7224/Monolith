import type { UserTag } from "./models";
import type { YamlRecord } from "@/lib/nexus/yaml-lists";
import { readList } from "@/lib/nexus/yaml-store";
import {
  appendRecord,
  generateId,
  nowIso,
  optStr,
  patchRecord,
  removeRecord,
  sortByCreated,
  str,
} from "@/lib/nexus/record-helpers";

const FILE = "Resources/tags.yaml";
const KEY = "tags";

const normTag = (value: unknown): string => str(value).trim().replace(/^#/, "");
const normColor = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

/** Synonimy: przycięte, bez `#`, bez pustych, duplikatów (bez wielkości liter) i nazwy kanonicznej. */
function toAliases(value: unknown, canonical: string): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set<string>([canonical.toLowerCase()]);
  const out: string[] = [];
  for (const raw of value) {
    const alias = normTag(raw);
    const key = alias.toLowerCase();
    if (alias === "" || seen.has(key)) continue;
    seen.add(key);
    out.push(alias);
  }
  return out.length > 0 ? out : undefined;
}

function toTag(record: YamlRecord): UserTag {
  const tag = normTag(record.tag);
  const aliases = toAliases(record.aliases, tag);
  return {
    id: str(record.id),
    tag,
    title: str(record.title).trim(),
    color: optStr(record.color),
    ...(aliases ? { aliases } : {}),
    created_at: optStr(record.created),
  };
}

export async function getUserTags(): Promise<UserTag[]> {
  return sortByCreated(readList(FILE, KEY).map(toTag), (t) => t.created_at, "asc");
}

export async function createUserTag(data: {
  tag: string;
  title: string;
  color?: string;
}): Promise<UserTag> {
  const color = normColor(data.color);
  const record = await appendRecord(FILE, KEY, (taken) => ({
    id: generateId(taken),
    tag: normTag(data.tag),
    title: str(data.title).trim(),
    ...(color ? { color } : {}),
    created: nowIso(),
  }));
  return toTag(record);
}

export async function updateUserTag(
  tagId: string,
  data: { tag?: string; title?: string; color?: string | null }
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (data.tag !== undefined) patch.tag = normTag(data.tag);
  if (data.title !== undefined) patch.title = str(data.title).trim();
  if (data.color !== undefined) patch.color = normColor(data.color); // undefined usuwa klucz
  if (Object.keys(patch).length === 0) return;
  await patchRecord(FILE, KEY, tagId, patch, "Tag not found");
}

export async function deleteUserTag(tagId: string): Promise<void> {
  await removeRecord(FILE, KEY, tagId);
}
