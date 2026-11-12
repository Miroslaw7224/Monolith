// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const STORE = "lib/nexus/yaml-store.ts";
const REPOS = ["common", "tags", "taskTemplates", "resources"].map(
  (name) => `lib/nexus/repos/${name}.ts`
);
const PLAIN_TEXT = "lib/nexus/markdown-edit.ts";
const FILE_REPOS = ["tasks", "calendarEvents", "markdown-dir", "mindMaps"].map(
  (name) => `lib/nexus/repos/${name}.ts`
);
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
        "lib/nexus/repos/calendarEvents.ts",
        "lib/nexus/repos/markdown-dir.ts",
        "lib/nexus/repos/mindMaps.ts",
        "lib/nexus/repos/tasks.ts",
      ].sort()
    );
  });

  it("old Firestore repositories and collection helpers are gone", () => {
    for (const name of ["tags", "taskTemplates", "resources", "tasks", "calendar"]) {
      expect(fs.existsSync(path.join(ROOT, `lib/firestore/${name}.ts`)), name).toBe(false);
    }
    expect(read("lib/firestore/collections.ts")).not.toMatch(
      /userTagsCol|taskTemplatesCol|userResourcesCol|tasksCol|calendarEventsCol/
    );
  });

  it("the barrel points the five groups at lib/nexus/repos", () => {
    const barrel = read("lib/firestore-db.ts");
    expect(barrel).not.toMatch(/lib\/firestore\/(tags|taskTemplates|resources|tasks|calendar)/);
    for (const name of ["tags", "taskTemplates", "resources", "tasks", "calendarEvents"]) {
      expect(barrel).toContain(`@/lib/nexus/repos/${name}`);
    }
  });
});
