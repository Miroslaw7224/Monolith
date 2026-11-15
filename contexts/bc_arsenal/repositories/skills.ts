import { DomainError } from "@/lib/errors";
import { formatFrontmatter, parseFrontmatter } from "@/lib/nexus/frontmatter";
import {
  listVaultFiles,
  listVaultFilesRecursive,
  readVaultFile,
  updateVaultFile,
} from "@/lib/nexus/vault-fs";
import {
  PROMPTS_DIR,
  SKILLS_DIR,
  type Deployment,
  type RawFile,
  type TemplateFile,
} from "../models";

const SKILL_FILE = /^Arsenal\/Skills\/([^/]+)\/skill\.md$/;

/** `null`, gdy pliku nie ma; nieczytelny plik (np. zły UTF-8) to `parsed: null`; błędy domenowe lecą wyżej. */
function readRaw(path: string, key: string): RawFile | null {
  let text: string;
  try {
    const file = readVaultFile(path);
    if (file === null) return null;
    text = file.text;
  } catch (err) {
    if (err instanceof DomainError) throw err;
    return { path, key, parsed: null };
  }
  return { path, key, parsed: parseFrontmatter(text) };
}

const present = (file: RawFile | null): file is RawFile => file !== null;

/** `Arsenal/Skills/<slug>/skill.md` (posortowane po ścieżce). */
export function readSkillFiles(): RawFile[] {
  return listVaultFilesRecursive(SKILLS_DIR)
    .flatMap((path) => {
      const slug = SKILL_FILE.exec(path)?.[1];
      return slug === undefined ? [] : [readRaw(path, slug)];
    })
    .filter(present);
}

/** Pliki `.md` bezpośrednio w `Knowledge/prompty/` (podkatalogi pomijane). */
export function readPromptFiles(): RawFile[] {
  return listVaultFiles(PROMPTS_DIR)
    .filter((name) => name.endsWith(".md"))
    .map((name) => readRaw(`${PROMPTS_DIR}/${name}`, name.replace(/\.md$/, "")))
    .filter(present);
}

/** Pliki bezpośrednio w `templates/` skilla; nieczytelny plik jest pomijany. */
export function readTemplates(slug: string): TemplateFile[] {
  const dir = `${SKILLS_DIR}/${slug}/templates`;
  const out: TemplateFile[] = [];
  for (const name of listVaultFiles(dir)) {
    try {
      const file = readVaultFile(`${dir}/${name}`);
      if (file !== null) out.push({ name, text: file.text });
    } catch (err) {
      if (err instanceof DomainError) throw err;
    }
  }
  return out;
}

/**
 * Jedyny zapis kontekstu: podmienia klucz `deployed` we frontmatterze `skill.md`, reszta kluczy i treść
 * zostają. Plik bez poprawnego frontmattera to 409 (nigdy go nie nadpisujemy).
 */
export async function writeDeployed(
  path: string,
  change: (current: unknown) => Deployment[]
): Promise<void> {
  await updateVaultFile(path, (current) => {
    const parsed = current === null ? null : parseFrontmatter(current);
    if (parsed === null) throw new DomainError("Dokument skilla jest uszkodzony", 409);
    return formatFrontmatter(
      { ...parsed.meta, deployed: change(parsed.meta.deployed) },
      parsed.body
    );
  });
}
