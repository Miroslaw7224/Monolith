// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SCRIPT_DIR = "scripts/import-to-vault";

function sourceFiles(): string[] {
  const files = [
    "scripts/import-to-vault.ts",
    "lib/nexus/task-line.ts",
    "lib/nexus/yaml-lists.ts",
    "lib/nexus/frontmatter.ts",
  ];
  for (const name of fs.readdirSync(path.join(ROOT, SCRIPT_DIR))) {
    if (name.endsWith(".ts")) files.push(`${SCRIPT_DIR}/${name}`);
  }
  return files;
}

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function lineOf(text: string, index: number): number {
  return text.slice(0, index).split("\n").length;
}

/** Zwraca opisy trafień `plik:linia` dla wzorca w plikach spoza listy dozwolonych. */
function hits(pattern: RegExp, allowed: string[] = []): string[] {
  const out: string[] = [];
  const global = new RegExp(pattern.source, pattern.flags.replace("g", "") + "g");
  for (const rel of sourceFiles()) {
    if (allowed.includes(rel)) continue;
    const text = read(rel);
    for (const m of text.matchAll(global)) {
      out.push(`${rel}:${lineOf(text, m.index ?? 0)} (${m[0]})`);
    }
  }
  return out;
}

const SCRIPT = "scripts/import-to-vault.ts";
const ARGS = `${SCRIPT_DIR}/args.ts`;
const FS_ALLOWED = [
  `${SCRIPT_DIR}/read-dump.ts`,
  `${SCRIPT_DIR}/write.ts`,
  `${SCRIPT_DIR}/report.ts`,
];
const WRITE = `${SCRIPT_DIR}/write.ts`;
const REPORT = `${SCRIPT_DIR}/report.ts`;

describe("import script static guards", () => {
  it("scans the expected sources", () => {
    const files = sourceFiles();
    expect(files.length).toBeGreaterThanOrEqual(14);
    for (const rel of files) expect(fs.existsSync(path.join(ROOT, rel))).toBe(true);
    for (const required of [SCRIPT, ARGS, WRITE, REPORT, ...FS_ALLOWED]) {
      expect(files).toContain(required);
    }
  });

  it("1. contains no forbidden words or side-effect APIs", () => {
    const forbidden = /backups|homedir|firebase|child_process|execSync|spawn|git commit|node:os/i;
    expect(hits(forbidden)).toEqual([]);
    // process.env tylko w CLI, które przekazuje je do parseImportArgs.
    expect(hits(/process\.env/i, [SCRIPT])).toEqual([]);
    // NEXUS_VAULT_PATH jako tekst tylko w args.ts.
    expect(hits(/NEXUS_VAULT_PATH/, [ARGS])).toEqual([]);
  });

  it("2. imports node:fs only in read-dump, write and report", () => {
    expect(
      hits(/from\s+["'](?:node:)?fs(?:\/promises)?["']|require\(\s*["'](?:node:)?fs/, FS_ALLOWED)
    ).toEqual([]);
    for (const rel of FS_ALLOWED) {
      expect(read(rel), `${rel} powinien importować node:fs`).toMatch(/from\s+["']node:fs["']/);
    }
  });

  it("3. removes and renames files only in write.ts, with a single rmSync", () => {
    expect(hits(/rmSync|unlinkSync|rmdirSync|rename/, [WRITE])).toEqual([]);
    const writeText = read(WRITE);
    expect(writeText.match(/rmSync\(/g) ?? []).toHaveLength(1);
    expect(writeText).toMatch(/rmSync\(\s*tmp\s*,\s*\{\s*force:\s*true\s*\}\s*\)/);
    expect(writeText).not.toMatch(/unlinkSync|rmdirSync/);
  });

  it("4. writes files only in write.ts and report.ts", () => {
    expect(
      hits(/writeFileSync|appendFileSync|writeFile\b|createWriteStream/, [WRITE, REPORT])
    ).toEqual([]);
    expect(read(WRITE)).toMatch(/writeFileSync/);
    expect(read(REPORT)).toMatch(/writeFileSync/);
  });

  it("5. discovers script modules with readdirSync from process.cwd()", () => {
    const onDisk = fs
      .readdirSync(path.join(process.cwd(), "scripts/import-to-vault"))
      .filter((n) => n.endsWith(".ts"))
      .map((n) => `${SCRIPT_DIR}/${n}`);
    const files = sourceFiles();
    for (const rel of onDisk) expect(files).toContain(rel);
  });
});
