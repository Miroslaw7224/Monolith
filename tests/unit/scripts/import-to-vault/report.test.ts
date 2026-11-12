// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  formatScreenReport,
  writeDetailedReport,
  type RunReport,
} from "@/scripts/import-to-vault/report";

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "report-test-"));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function makeReport(overrides: Partial<RunReport> = {}): RunReport {
  return {
    mode: "dry-run",
    uid: "uid-1",
    counts: {
      notes: { dump: 2, written: 2, skipped: 0 },
      tasks: { dump: 3, written: 3, skipped: 0 },
      resources: { dump: 1, written: 1, skipped: 0 },
      user_tags: { dump: 0, written: 0, skipped: 0 },
      task_templates: { dump: 4, written: 3, skipped: 1 },
    },
    outOfScope: [{ path: "users/uid-1/other", count: 5, reason: "poza zakresem", type: null }],
    fileActions: { create: 2, update: 1, unchanged: 3 },
    warnings: ["pierwsze ostrzeżenie", "drugie ostrzeżenie"],
    noteLosses: [{ id: "n1", relPath: "Notes/x.md", losses: ["kolor czcionki", "wyrównanie"] }],
    verify: { ran: false, ok: false, problems: [] },
    noteTitles: { n1: "Tytuł SEKRET notatki" },
    ...overrides,
  };
}

describe("formatScreenReport", () => {
  it("nie zawiera tytułów ani HTML notatek, ale pokazuje ścieżkę i straty", () => {
    const report = makeReport({
      noteTitles: { n1: "SEKRET" },
      noteLosses: [{ id: "n1", relPath: "Notes/x.md", losses: ["kolor czcionki", "wyrównanie"] }],
    });
    const screen = formatScreenReport(report);
    expect(screen).not.toContain("SEKRET");
    expect(screen).toContain("Notes/x.md");
    expect(screen).toContain("kolor czcionki, wyrównanie");
  });

  it("pokazuje dry-run w trybie dry-run", () => {
    const screen = formatScreenReport(makeReport());
    expect(screen).toContain("DRY-RUN: nic nie zapisano");
    expect(screen).toContain("nie uruchamiano (dry-run)");
  });

  it("pokazuje ZAPIS w trybie write", () => {
    const screen = formatScreenReport(
      makeReport({ mode: "write", verify: { ran: true, ok: true, problems: [] } })
    );
    expect(screen).toContain("ZAPIS");
    expect(screen).not.toContain("DRY-RUN");
    expect(screen).toContain("round-trip: OK");
  });

  it("pokazuje NIEZGODNY z listą problemów przy verify.ok === false", () => {
    const screen = formatScreenReport(
      makeReport({
        mode: "write",
        verify: { ran: true, ok: false, problems: ["problem-A", "problem-B"] },
      })
    );
    expect(screen).toContain("NIEZGODNY");
    expect(screen).toContain("problem-A");
    expect(screen).toContain("problem-B");
  });

  it("zawiera liczby per typ, kolekcje poza zakresem, liczniki plików i ostrzeżenia w osobnych liniach", () => {
    const screen = formatScreenReport(makeReport());
    const lines = screen.split("\n");
    expect(lines.some((l) => l.includes("task_templates") && /4\D+3\D+1/.test(l))).toBe(true);
    expect(screen).toContain("users/uid-1/other");
    expect(screen).toContain("poza zakresem");
    expect(screen).toMatch(/create\D+2/);
    expect(screen).toMatch(/update\D+1/);
    expect(screen).toMatch(/unchanged\D+3/);
    expect(lines.some((l) => l.includes("pierwsze ostrzeżenie"))).toBe(true);
    expect(lines.some((l) => l.includes("drugie ostrzeżenie"))).toBe(true);
  });
});

describe("writeDetailedReport", () => {
  it("tworzy plik 0600 z poprawnym JSON-em zawierającym noteTitles", () => {
    const dir = path.join(tmp, "dump");
    fs.mkdirSync(dir, { mode: 0o700 });
    fs.chmodSync(dir, 0o700);
    const report = makeReport();
    const file = writeDetailedReport(dir, report, new Date("2026-11-12T10:20:30Z"));
    expect(path.dirname(file)).toBe(dir);
    expect(path.basename(file)).toMatch(/^import-report-2026-11-12T\d{6}\.json$/);
    expect(path.basename(file)).toBe("import-report-2026-11-12T102030.json");
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
    const raw = fs.readFileSync(file, "utf8");
    expect(raw).toContain("SEKRET");
    const parsed = JSON.parse(raw);
    expect(parsed.noteTitles.n1).toContain("SEKRET");
    expect(parsed.uid).toBe("uid-1");
    expect(report.warnings).toEqual(["pierwsze ostrzeżenie", "drugie ostrzeżenie"]);
    expect(fs.statSync(dir).mode & 0o777).toBe(0o700);
  });

  it("katalog 0755 daje ostrzeżenie o uprawnieniach i nie zmienia uprawnień katalogu", () => {
    const dir = path.join(tmp, "dump");
    fs.mkdirSync(dir);
    fs.chmodSync(dir, 0o755);
    const report = makeReport({ warnings: [] });
    const file = writeDetailedReport(dir, report, new Date("2026-11-12T10:20:30Z"));
    expect(report.warnings.some((w) => /uprawnie/i.test(w))).toBe(true);
    expect(JSON.parse(fs.readFileSync(file, "utf8")).warnings.length).toBe(1);
    expect(fs.statSync(dir).mode & 0o777).toBe(0o755);
  });
});
