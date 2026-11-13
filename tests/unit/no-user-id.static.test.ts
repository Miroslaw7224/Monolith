// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const DIRS = ["app/api", "services", "lib/nexus", "types", "src", "contexts"];
const FILES = ["lib/firestore-db.ts"];
const PATTERN = /\b_?userId\b|getAuthUserId|\bauth\.uid\b/;

function collect(): string[] {
  const out: string[] = [...FILES];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(rel);
      else if (/\.tsx?$/.test(entry.name)) {
        out.push(rel);
      }
    }
  };
  for (const dir of DIRS) walk(dir);
  return out;
}

describe("0d-1 static guard: the server layer has no userId and no auth", () => {
  it("scans existing sources", () => {
    const files = collect();
    expect(files).toContain("services/noteService.ts");
    expect(files).toContain("app/api/notes/route.ts");
    expect(files).toContain("contexts/bc_tasks/repositories/tasks.ts");
    expect(files).toContain("src/components/sessions/activeSession.ts");
    expect(files.some((f) => f.startsWith("app/api/waitlist/"))).toBe(false);
  });

  it("does not mention userId, getAuthUserId or auth.uid", () => {
    const hits: string[] = [];
    for (const rel of collect()) {
      const lines = fs.readFileSync(path.join(ROOT, rel), "utf8").split("\n");
      lines.forEach((line, i) => {
        if (PATTERN.test(line)) hits.push(`${rel}:${i + 1} (${line.trim()})`);
      });
    }
    expect(hits).toEqual([]);
  });
});
