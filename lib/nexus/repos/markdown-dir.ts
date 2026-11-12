import { ConflictError, DomainError } from "@/lib/errors";
import { formatFrontmatter, parseFrontmatter, type Frontmatter } from "../frontmatter";
import { allocateName, slugify } from "../slug";
import {
  deleteVaultFile,
  listVaultFiles,
  readVaultFile,
  updateVaultFile,
  writeVaultFile,
  type FileVersion,
} from "../vault-fs";
import { generateId } from "./common";

/**
 * Katalog plików `.md` z frontmatterem (`Notes/`, `Documents/`): wyszukiwanie po `id`
 * z frontmattera, slug nazwy pliku stały po utworzeniu.
 */
export type MarkdownEntry = {
  rel: string;
  id: string;
  meta: Frontmatter;
  /** Bez wiodących `\n` i końcowych białych znaków (jak zapisuje `formatFrontmatter`). */
  body: string;
  version: FileVersion;
};

const MD_FILE = /\.md$/i;
const MAX_CREATE_ATTEMPTS = 5;

function cleanBody(body: string): string {
  return body.replace(/^\n+/, "").replace(/\s+$/, "");
}

function readEntry(dir: string, name: string): MarkdownEntry | null {
  const rel = `${dir}/${name}`;
  const file = readVaultFile(rel);
  if (file === null) return null;
  const parsed = parseFrontmatter(file.text);
  if (parsed === null) return null;
  const { id } = parsed.meta;
  if (typeof id !== "string" || id === "") return null;
  return { rel, id, meta: parsed.meta, body: cleanBody(parsed.body), version: file.version };
}

/** Pliki `*.md` bezpośrednio w `dir`, po nazwie rosnąco; pliki bez frontmattera i bez tekstowego `id` są pomijane. */
export function listEntries(dir: string): MarkdownEntry[] {
  const entries: MarkdownEntry[] = [];
  for (const name of listVaultFiles(dir)) {
    if (!MD_FILE.test(name)) continue;
    const entry = readEntry(dir, name);
    if (entry !== null) entries.push(entry);
  }
  return entries;
}

/** Pierwszy wpis o danym `id` (kolejność nazw) albo `null`. */
export function findEntry(dir: string, id: string): MarkdownEntry | null {
  return listEntries(dir).find((entry) => entry.id === id) ?? null;
}

/** Tworzy plik z nowym `id` i slugiem z `slugSource`; zwraca `id` i ścieżkę. */
export function createEntry(
  dir: string,
  slugSource: string,
  build: (id: string) => { meta: Frontmatter; body: string }
): { id: string; rel: string } {
  for (let attempt = 1; ; attempt += 1) {
    const taken = new Set(listVaultFiles(dir).map((name) => name.toLowerCase()));
    const ids = new Set(listEntries(dir).map((entry) => entry.id));
    const id = generateId(ids);
    const name = allocateName(slugify(slugSource), (candidate) => taken.has(`${candidate}.md`));
    const rel = `${dir}/${name}.md`;
    const { meta, body } = build(id);
    try {
      writeVaultFile(rel, formatFrontmatter(meta, body), { expected: null });
      return { id, rel };
    } catch (err) {
      // Plik o tej nazwie pojawił się w międzyczasie (proces zewnętrzny): nowa nazwa.
      if (!(err instanceof ConflictError) || attempt >= MAX_CREATE_ATTEMPTS) throw err;
    }
  }
}

/**
 * Zmienia wpis o danym `id`. Brak wpisu, plik bez rozpoznawalnego frontmattera albo z innym `id`
 * to `DomainError(notFound, 404)`; takiego pliku nigdy nie nadpisujemy.
 */
export async function updateEntry(
  dir: string,
  id: string,
  notFound: string,
  change: (entry: { meta: Frontmatter; body: string }) => { meta: Frontmatter; body: string }
): Promise<void> {
  const entry = findEntry(dir, id);
  if (entry === null) throw new DomainError(notFound, 404);
  await updateVaultFile(entry.rel, (current) => {
    const parsed = current === null ? null : parseFrontmatter(current);
    if (parsed === null || parsed.meta.id !== id) throw new DomainError(notFound, 404);
    const next = change({ meta: parsed.meta, body: cleanBody(parsed.body) });
    return formatFrontmatter(next.meta, next.body);
  });
}

/**
 * Usuwa wpis o danym `id`; brak → `false`. `ConflictError` (plik zmieniony przez proces zewnętrzny
 * między odczytem a usunięciem) propaguje się jako 409.
 */
export function deleteEntry(dir: string, id: string): boolean {
  const entry = findEntry(dir, id);
  if (entry === null) return false;
  return deleteVaultFile(entry.rel, { expected: entry.version });
}
