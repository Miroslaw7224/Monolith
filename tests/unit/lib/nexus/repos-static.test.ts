// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const STORE = "lib/nexus/yaml-store.ts";
const REPOS = ["common", "tags", "taskTemplates", "resources"].map(
  (name) => `lib/nexus/repos/${name}.ts`
);
const FILES = [STORE, ...REPOS];

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

describe("0c-2 static guards", () => {
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

  it("old Firestore repositories and collection helpers are gone", () => {
    for (const name of ["tags", "taskTemplates", "resources"]) {
      expect(fs.existsSync(path.join(ROOT, `lib/firestore/${name}.ts`)), name).toBe(false);
    }
    expect(read("lib/firestore/collections.ts")).not.toMatch(
      /userTagsCol|taskTemplatesCol|userResourcesCol/
    );
  });

  it("the barrel points the three groups at lib/nexus/repos", () => {
    const barrel = read("lib/firestore-db.ts");
    expect(barrel).not.toMatch(/lib\/firestore\/(tags|taskTemplates|resources)/);
    for (const name of ["tags", "taskTemplates", "resources"]) {
      expect(barrel).toContain(`@/lib/nexus/repos/${name}`);
    }
  });
});
