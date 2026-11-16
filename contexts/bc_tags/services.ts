import { DomainError } from "@/lib/errors";
import * as repositories from "./repositories";
import type { UserTag } from "./models";

export async function getUserTags() {
  return repositories.getUserTags();
}

export async function createUserTag(data: { tag: string; title: string; color?: string }) {
  if (!data.tag || typeof data.tag !== "string" || !data.tag.trim()) {
    throw new DomainError("tag required");
  }
  return repositories.createUserTag(data);
}

export async function updateUserTag(
  id: string,
  data: { tag?: string; title?: string; color?: string | null }
) {
  return repositories.updateUserTag(id, data);
}

export async function deleteUserTag(id: string) {
  return repositories.deleteUserTag(id);
}

/**
 * Czysta część: dopasowuje nazwy do słownika (nazwa kanoniczna lub alias, bez wielkości liter).
 * `tags`: nazwy kanoniczne (nieznane zostają jak podano, bez `#`), bez duplikatów, w kolejności wejścia.
 * `missing`: te spośród `tags`, których nie ma w słowniku.
 */
export function resolveTagNames(
  names: readonly unknown[],
  dictionary: readonly UserTag[]
): { tags: string[]; missing: string[] } {
  const byKey = new Map<string, string>();
  for (const entry of dictionary) byKey.set(entry.tag.toLowerCase(), entry.tag);
  for (const entry of dictionary) {
    for (const alias of entry.aliases ?? []) {
      const key = alias.toLowerCase();
      if (!byKey.has(key)) byKey.set(key, entry.tag);
    }
  }
  const tags: string[] = [];
  const missing: string[] = [];
  const seen = new Set<string>();
  for (const raw of names) {
    if (typeof raw !== "string") continue;
    const name = raw.trim().replace(/^#/, "").trim();
    if (name === "") continue;
    const canonical = byKey.get(name.toLowerCase());
    const tag = canonical ?? name;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (canonical === undefined) missing.push(tag);
  }
  return { tags, missing };
}

/** Sprowadza nazwy do kanonicznych i dopisuje nieznane tagi do słownika (bez koloru). */
export async function resolveTags(names: readonly unknown[]): Promise<string[]> {
  if (names.length === 0) return [];
  const dictionary = await repositories.getUserTags();
  const { tags, missing } = resolveTagNames(names, dictionary);
  for (const tag of missing) {
    await repositories.createUserTag({ tag, title: tag });
  }
  return tags;
}
