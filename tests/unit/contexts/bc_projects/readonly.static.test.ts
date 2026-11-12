// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const CTX = "contexts/bc_projects";
const WRITE_API =
  /\b(writeVaultFile|updateVaultFile|deleteVaultFile|updateList|appendRecord|patchRecord|removeRecord)\b/;
const FS_IMPORT = /from\s+["'](?:node:)?fs/;

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

describe("bc_projects: tylko odczyt", () => {
  const files = collectTs(CTX);

  it("skanuje repositories/index.ts (ochrona przed pustym skanem)", () => {
    expect(files).toContain("contexts/bc_projects/repositories/index.ts");
  });

  it("żaden plik nie woła zapisu vaulta ani node:fs", () => {
    const hits: string[] = [];
    for (const rel of files) {
      const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
      if (WRITE_API.test(src)) hits.push(`${rel}: write API`);
      if (FS_IMPORT.test(src)) hits.push(`${rel}: fs import`);
    }
    expect(hits).toEqual([]);
  });
});
