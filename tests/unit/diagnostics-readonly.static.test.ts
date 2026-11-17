// @vitest-environment node
/**
 * Strażnik: karta Diagnostyka jest tylko do odczytu i aplikacja nie potrafi zatrzymać żadnego procesu.
 * Komenda kill jest wyłącznie tekstem do skopiowania (`buildKillCommand`), nigdy nie jest wykonywana.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { WINDOWS_SCRIPT } from "@/lib/ports/windows";

const ROOT = path.resolve(__dirname, "../..");

function walk(dir: string): string[] {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((e) => {
    const rel = path.posix.join(dir, e.name);
    if (e.isDirectory()) return e.name === "node_modules" || e.name === ".next" ? [] : walk(rel);
    return /\.(ts|tsx|js|mjs)$/.test(e.name) ? [rel] : [];
  });
}

const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const APP_DIRS = ["app", "contexts", "lib", "src"];
const FEATURE_DIRS = [
  "lib/ports",
  "contexts/bc_diagnostics",
  "src/features/diagnostics",
  "app/api/diagnostics",
];

describe("Diagnostyka: tylko odczyt", () => {
  it("kod aplikacji nie ma żadnego wywołania zabijającego proces", () => {
    const hits: string[] = [];
    for (const file of APP_DIRS.flatMap(walk)) {
      read(file)
        .split("\n")
        .forEach((line, i) => {
          if (/process\.kill|\.kill\(|taskkill|pkill|killall|SIGKILL|SIGTERM/.test(line)) {
            hits.push(`${file}:${i + 1} ${line.trim()}`);
          }
        });
    }
    expect(hits).toEqual([]);
  });

  it("tekst 'Stop-Process' i 'kill <pid>' istnieje tylko jako szablon w buildKillCommand", () => {
    const hits: string[] = [];
    for (const file of APP_DIRS.flatMap(walk)) {
      read(file)
        .split("\n")
        .forEach((line, i) => {
          if (/Stop-Process/.test(line)) hits.push(`${file}:${i + 1}`);
        });
    }
    expect(hits).toEqual([`contexts/bc_diagnostics/services.ts:${lineOf("Stop-Process")}`]);
  });

  it("skrypt PowerShell używa wyłącznie cmdletów odczytu i serializacji", () => {
    const cmdlets = [...new Set(WINDOWS_SCRIPT.match(/\b[A-Za-z]+-[A-Za-z]+\b/g) ?? [])].sort();
    expect(cmdlets).toEqual(
      [
        "ConvertTo-Json",
        "ForEach-Object",
        "Get-CimInstance",
        "Get-NetTCPConnection",
        "Get-Process",
      ].sort()
    );
  });

  it("procesy w karcie uruchamia wyłącznie lib/ports/run.ts, z komendami ss i powershell.exe", () => {
    const users = FEATURE_DIRS.flatMap(walk).filter((f) => /child_process|execFile/.test(read(f)));
    expect(users).toEqual(["lib/ports/run.ts"]);
    expect(read("lib/ports/wsl.ts")).toContain('"ss", ["-ltnpH"]');
    expect(read("lib/ports/windows.ts")).toContain("powershell.exe");
  });

  it("trasa API eksportuje wyłącznie GET", () => {
    const route = read("app/api/diagnostics/ports/route.ts");
    const methods = [...route.matchAll(/\b(GET|POST|PUT|PATCH|DELETE)\b/g)].map((m) => m[1]);
    expect(new Set(methods)).toEqual(new Set(["GET"]));
  });

  it("UI tylko kopiuje komendę do schowka (bez fetch metodą zapisu)", () => {
    const view = FEATURE_DIRS.flatMap(walk)
      .filter((f) => f.startsWith("src/features/diagnostics"))
      .map(read)
      .join("\n");
    expect(view).toContain("navigator.clipboard.writeText");
    expect(view).not.toMatch(/method:\s*["'](POST|PUT|PATCH|DELETE)["']/);
  });
});

function lineOf(needle: string): number {
  const idx = read("contexts/bc_diagnostics/services.ts")
    .split("\n")
    .findIndex((l) => l.includes(needle));
  return idx + 1;
}
