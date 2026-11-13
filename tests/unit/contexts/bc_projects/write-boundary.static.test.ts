// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const CTX = "contexts/bc_projects";
const WRITE_ALLOWED_PREFIX = `${CTX}/repositories/`;
const WRITE_API =
  /\b(writeVaultFile|updateVaultFile|deleteVaultFile|updateList|appendRecord|patchRecord|removeRecord)\b/;
const FS_IMPORT = /from\s+["'](?:node:)?fs/;

/**
 * Granica zapisu: wywołania zapisu do vaulta tylko w `repositories/`, `node:fs` nigdzie w kontekście.
 * `sources`: ścieżka względem korzenia repo → treść pliku.
 */
function findViolations(sources: Record<string, string>): string[] {
  const hits: string[] = [];
  for (const [rel, src] of Object.entries(sources)) {
    if (WRITE_API.test(src) && !rel.startsWith(WRITE_ALLOWED_PREFIX)) {
      hits.push(`${rel}: write API`);
    }
    if (FS_IMPORT.test(src)) hits.push(`${rel}: fs import`);
  }
  return hits;
}

function collectTs(dir: string): string[] {
  const out: string[] = [];
  const walk = (rel: string) => {
    for (const entry of fs.readdirSync(path.join(ROOT, rel), { withFileTypes: true })) {
      const next = `${rel}/${entry.name}`;
      if (entry.isDirectory()) walk(next);
      else if (entry.name.endsWith(".ts")) out.push(next);
    }
  };
  walk(dir);
  return out;
}

describe("bc_projects: granica zapisu (silnik reguły)", () => {
  it("zapis w repositories/index.ts jest dozwolony", () => {
    expect(findViolations({ [`${CTX}/repositories/index.ts`]: "writeVaultFile(x)" })).toEqual([]);
  });

  it("zapis w services.ts jest naruszeniem", () => {
    expect(findViolations({ [`${CTX}/services.ts`]: "updateVaultFile(x)" })).toEqual([
      `${CTX}/services.ts: write API`,
    ]);
  });

  it("import node:fs w router.ts jest naruszeniem", () => {
    expect(findViolations({ [`${CTX}/router.ts`]: 'import fs from "node:fs";' })).toEqual([
      `${CTX}/router.ts: fs import`,
    ]);
  });

  it("import fs nawet w repositories/ jest naruszeniem", () => {
    expect(findViolations({ [`${CTX}/repositories/markdown.ts`]: 'import x from "fs";' })).toEqual([
      `${CTX}/repositories/markdown.ts: fs import`,
    ]);
  });

  it("nazwa tylko zawierająca słowo (bez granicy \\b) nie jest naruszeniem", () => {
    expect(findViolations({ [`${CTX}/schemas.ts`]: "const writeVaultFileX = 1;" })).toEqual([]);
  });
});

describe("bc_projects: granica zapisu (prawdziwy kod)", () => {
  const files = collectTs(CTX);

  it("skanuje repositories/index.ts (ochrona przed pustym skanem)", () => {
    expect(files).toContain(`${CTX}/repositories/index.ts`);
  });

  it("skanuje też pliki poza repositories/ (router.ts, services.ts)", () => {
    expect(files).toContain(`${CTX}/router.ts`);
    // `services` bywa plikiem albo folderem z `index.ts` (CLAUDE.md: plik urósł → folder).
    expect(files.some((f) => f === `${CTX}/services.ts` || f === `${CTX}/services/index.ts`)).toBe(
      true
    );
  });

  it("zapis tylko w repositories/, nigdzie node:fs", () => {
    const sources: Record<string, string> = {};
    for (const rel of files) sources[rel] = fs.readFileSync(path.join(ROOT, rel), "utf8");
    expect(findViolations(sources)).toEqual([]);
  });
});
