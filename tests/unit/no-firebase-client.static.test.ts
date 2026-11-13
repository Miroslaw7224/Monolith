// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const DIRS = ["app", "src", "lib", "contexts"];
const EXCLUDED: string[] = [];
const PATTERN =
  /from ["']firebase\/|firebase-client|\buseAuth\b|getIdToken|\/api\/waitlist|getAuthUserId|LoginScreen/;

function collect(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(rel);
      else if (/\.tsx?$/.test(entry.name) && !EXCLUDED.some((ex) => rel.startsWith(ex))) {
        out.push(rel);
      }
    }
  };
  for (const dir of DIRS) walk(dir);
  return out;
}

describe("0d-2 static guard: no Firebase client, login or waitlist in application code", () => {
  it("scans existing sources", () => {
    const files = collect();
    expect(files).toContain("src/App.tsx");
    expect(files).toContain("app/dashboard/page.tsx");
    expect(files).toContain("contexts/bc_notes/services.ts");
  });

  it("does not use the firebase client SDK, useAuth, tokens or the waitlist", () => {
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
