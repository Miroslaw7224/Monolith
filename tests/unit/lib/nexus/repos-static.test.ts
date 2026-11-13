// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const STORE = "lib/nexus/yaml-store.ts";
const REPOS = [
  "lib/nexus/record-helpers.ts",
  "contexts/bc_tags/repositories.ts",
  "contexts/bc_notes/repositories.ts",
  "contexts/bc_tasks/repositories/templates.ts",
  "contexts/bc_resources/repositories/resources.ts",
];
const PLAIN_TEXT = "lib/nexus/markdown-edit.ts";
const FILE_REPOS = [
  "lib/nexus/markdown-dir.ts",
  "contexts/bc_tasks/repositories/tasks.ts",
  "contexts/bc_calendar/repositories/index.ts",
  ...["mindMaps", "board"].map((name) => `lib/nexus/repos/${name}.ts`),
];
const FILES = [STORE, PLAIN_TEXT, ...REPOS, ...FILE_REPOS];

const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const lineOf = (text: string, index: number) => text.slice(0, index).split("\n").length;

function hits(pattern: RegExp, files: string[] = FILES): string[] {
  const out: string[] = [];
  const global = new RegExp(pattern.source, pattern.flags.replace("g", "") + "g");
  for (const rel of files) {
    const text = read(rel);
    for (const m of text.matchAll(global))
      out.push(`${rel}:${lineOf(text, m.index ?? 0)} (${m[0]})`);
  }
  return out;
}

describe("0c-2 / 0c-3 static guards", () => {
  it("scans existing sources", () => {
    for (const rel of FILES) expect(fs.existsSync(path.join(ROOT, rel))).toBe(true);
  });

  it("has no firebase, direct fs access, process.env or file mutations", () => {
    expect(hits(/firebase/i)).toEqual([]);
    expect(hits(/from\s+["'](?:node:)?fs(?:\/promises)?["']|require\(\s*["'](?:node:)?fs/)).toEqual(
      []
    );
    expect(hits(/process\.env/)).toEqual([]);
    expect(
      hits(/writeFileSync|renameSync|rmSync|mkdirSync|appendFileSync|unlinkSync|createWriteStream/)
    ).toEqual([]);
  });

  it("writes only through yaml-store: repositories do not import vault-fs", () => {
    expect(hits(/vault-fs/, REPOS)).toEqual([]);
  });

  it("markdown-edit is pure text; only yaml-store and the two file repos import vault-fs", () => {
    expect(hits(/from\s+["'][^"']*vault-fs["']/, [PLAIN_TEXT])).toEqual([]);
    const importers: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) walk(rel);
        else if (/\.ts$/.test(entry.name) && /from\s+["'][^"']*\/vault-fs["']/.test(read(rel))) {
          importers.push(rel);
        }
      }
    };
    walk("lib/nexus");
    expect(importers.sort()).toEqual(
      [
        STORE,
        "lib/nexus/repos/board.ts",
        "lib/nexus/markdown-dir.ts",
        "lib/nexus/repos/mindMaps.ts",
      ].sort()
    );
  });

  it("the old Firestore directory is gone", () => {
    expect(fs.existsSync(path.join(ROOT, "lib/firestore"))).toBe(false);
  });

  it("the barrel points every collection at lib/nexus/repos", () => {
    const barrel = read("lib/firestore-db.ts");
    expect(barrel).not.toMatch(/lib\/firestore\//);
    for (const name of ["mindMaps", "board"]) {
      expect(barrel).toContain(`@/lib/nexus/repos/${name}`);
    }
  });
});
