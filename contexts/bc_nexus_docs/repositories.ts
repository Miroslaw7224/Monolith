import { DomainError } from "@/lib/errors";
import { parseFrontmatter } from "@/lib/nexus/frontmatter";
import { listVaultFilesRecursive, readVaultFile } from "@/lib/nexus/vault-fs";
import { NEXUS_AREAS, type RawNexusDoc } from "./models";

/**
 * Ścieżki `.md` z `Knowledge/` i `Projects/` (względem vaulta, posortowane w obrębie obszaru).
 * `listVaultFilesRecursive` pomija dowiązania i katalogi `Work`; filtr domenowy jest w `services`.
 */
export function listNexusPaths(): string[] {
  return NEXUS_AREAS.flatMap((area) => listVaultFilesRecursive(area));
}

/**
 * Odczyt i parsowanie frontmattera. `null`, gdy pliku nie ma albo nie da się go odczytać
 * (np. niepoprawny UTF-8); błędy domenowe (ścieżka, Work) lecą wyżej.
 */
export function readNexusDoc(rel: string): RawNexusDoc | null {
  let text: string;
  try {
    const file = readVaultFile(rel);
    if (file === null) return null;
    text = file.text;
  } catch (err) {
    if (err instanceof DomainError) throw err;
    return null;
  }
  const parsed = parseFrontmatter(text);
  return {
    path: rel,
    meta: parsed?.meta ?? {},
    body: parsed ? parsed.body : text,
    bytes: Buffer.byteLength(text, "utf8"),
  };
}
