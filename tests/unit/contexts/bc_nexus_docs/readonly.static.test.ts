// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const CTX = "contexts/bc_nexus_docs";
const ROUTES = ["app/api/nexus-docs/route.ts", "app/api/nexus-docs/[...path]/route.ts"];
const WRITE_NAMES = [
  "writeVaultFile",
  "updateVaultFile",
  "deleteVaultFile",
  "createEntry",
  "updateEntry",
  "deleteEntry",
];
const WRITE_MODULES = ["markdown-dir", "yaml-store"];

const stripComments = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function contextFiles(): string[] {
  const dir = path.join(ROOT, CTX);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { recursive: true, withFileTypes: false })
    .map(String)
    .filter((f) => /\.tsx?$/.test(f))
    .map((f) => `${CTX}/${f.replace(/\\/g, "/")}`)
    .sort();
}

const read = (rel: string) => stripComments(fs.readFileSync(path.join(ROOT, rel), "utf8"));

describe("bc_nexus_docs jest tylko do odczytu", () => {
  const files = contextFiles();

  it("skanuje pięć plików kontekstu", () => {
    for (const name of ["models", "schemas", "repositories", "services", "router"]) {
      expect(files, name).toContain(`${CTX}/${name}.ts`);
    }
  });

  it("nie używa żadnej funkcji zapisu ani zapisujących modułów", () => {
    const found: string[] = [];
    for (const rel of files) {
      const text = read(rel);
      for (const name of WRITE_NAMES) if (text.includes(name)) found.push(`${rel}: ${name}`);
      for (const mod of WRITE_MODULES) if (text.includes(mod)) found.push(`${rel}: ${mod}`);
    }
    expect(found).toEqual([]);
  });

  it("nie importuje fs ani child_process", () => {
    const found: string[] = [];
    for (const rel of files) {
      if (/from\s+["'](?:node:)?(?:fs|child_process)/.test(read(rel))) found.push(rel);
    }
    expect(found).toEqual([]);
  });

  it("trasy wystawiają wyłącznie GET", () => {
    for (const rel of ROUTES) {
      expect(fs.existsSync(path.join(ROOT, rel)), rel).toBe(true);
      const text = read(rel);
      expect(text, rel).toMatch(/\bGET\b/);
      expect(text, rel).not.toMatch(/\b(?:POST|PUT|PATCH|DELETE)\b/);
    }
  });
});
