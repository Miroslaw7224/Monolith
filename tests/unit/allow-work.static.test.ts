// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const DIRS = ["app", "src", "lib", "services", "scripts", "types"];
const ALLOWED = ["lib/nexus/vault-fs.ts", "lib/workGuard.ts"];

function collect(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(rel);
      else if (/\.tsx?$/.test(entry.name)) out.push(rel);
    }
  };
  for (const dir of DIRS) walk(dir);
  return out;
}

describe("0f static guard: allowWork tylko w vault-fs i workGuard", () => {
  it("scans existing sources", () => {
    const files = collect();
    expect(files).toContain("lib/nexus/vault-fs.ts");
    expect(files).toContain("lib/workGuard.ts");
  });

  it("żaden inny plik nie ustawia ani nie przekazuje allowWork", () => {
    const hits: string[] = [];
    for (const rel of collect()) {
      if (ALLOWED.includes(rel)) continue;
      fs.readFileSync(path.join(ROOT, rel), "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (/allowWork/.test(line)) hits.push(`${rel}:${i + 1} (${line.trim()})`);
        });
    }
    expect(hits).toEqual([]);
  });

  it("strażnik sprawdza git, a vault-fs nie wywołuje procesów", () => {
    const guard = fs.readFileSync(path.join(ROOT, "lib/workGuard.ts"), "utf8");
    expect(guard).toMatch(/check-ignore/);
    expect(guard).toMatch(/ls-files/);
    expect(guard).toMatch(/allowWork: true/);
    expect(fs.readFileSync(path.join(ROOT, "lib/nexus/vault-fs.ts"), "utf8")).not.toMatch(
      /child_process/
    );
  });
});
