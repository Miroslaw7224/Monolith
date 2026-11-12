// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseFrontmatter } from "@/lib/nexus/frontmatter";
import { parseTaskLines } from "@/lib/nexus/task-line";
import { runImport } from "@/scripts/import-to-vault/run";
import { buildPlan } from "@/scripts/import-to-vault/plan";
import { readDump } from "@/scripts/import-to-vault/read-dump";
import { convertDump } from "@/scripts/import-to-vault/records";
import { createVaultView } from "@/scripts/import-to-vault/write";
import { makeDump, sampleCollections } from "./helpers";

let tmp: string;
let dumpDir: string;
let vault: string;
let outside: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "run-test-"));
  dumpDir = path.join(tmp, "dump");
  vault = path.join(tmp, "vault");
  outside = path.join(tmp, "outside");
  fs.mkdirSync(vault);
  fs.mkdirSync(outside);
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

/** Migawka katalogu: ścieżka względna -> treść i mtime. */
function snapshot(root: string): Record<string, { content: string; mtimeMs: number }> {
  const out: Record<string, { content: string; mtimeMs: number }> = {};
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else {
        out[path.relative(root, abs)] = {
          content: fs.readFileSync(abs, "utf8"),
          mtimeMs: fs.statSync(abs).mtimeMs,
        };
      }
    }
  };
  walk(root);
  return out;
}

// sampleCollections ma dwa konta (u1, u2), więc domyślnie wskazujemy u1.
const run = (write: boolean, uid: string | undefined = "u1") =>
  runImport({ dumpDir, vaultRoot: vault, write, uid, now: new Date("2026-11-12T12:00:00Z") });

const rel = (...parts: string[]) => path.join(vault, ...parts);

describe("runImport", () => {
  it("dry-run does not touch the vault and writes the detailed report next to the dump", () => {
    const collections = sampleCollections();
    collections["users/u1/tasks"][0].data.description = "SEKRET opis";
    makeDump(dumpDir, collections);
    const before = snapshot(vault);

    const { exitCode, screen } = run(false);

    expect(exitCode).toBe(0);
    expect(snapshot(vault)).toEqual(before);
    expect(before).toEqual({});
    expect(screen).toContain("DRY-RUN");
    expect(screen).not.toContain("Zażółć");
    expect(screen).not.toContain("SEKRET");
    const reports = fs.readdirSync(dumpDir).filter((f) => /^import-report-.*\.json$/.test(f));
    expect(reports).toHaveLength(1);
    expect(screen).toContain(path.join(dumpDir, reports[0]));
  });

  it("writes all files, reports losses and warnings, and passes round-trip", () => {
    makeDump(dumpDir, sampleCollections());

    const { exitCode, screen } = run(true);

    expect(exitCode).toBe(0);
    for (const file of [
      "Notes/zazolc-gesla-jazn.md",
      "Notes/duplikat.md",
      "Notes/duplikat-2.md",
      "Notes/bez-tytulu.md",
      "Notes/.html/n1.html",
      "Notes/.html/n2.html",
      "Notes/.html/n3.html",
      "Notes/.html/n4.html",
      "Tasks/tasks.md",
      "Resources/resources.yaml",
      "Resources/tags.yaml",
      "Tasks/templates.yaml",
    ]) {
      expect(fs.existsSync(rel(file)), file).toBe(true);
    }
    expect(fs.readFileSync(rel("Notes/duplikat.md"), "utf8")).toContain("pierwszy");
    expect(fs.readFileSync(rel("Notes/duplikat-2.md"), "utf8")).toContain("drugi");

    expect(screen).toMatch(
      /Notes\/zazolc-gesla-jazn\.md.*kolor czcionki, wyrównanie, podkreślenie/
    );
    expect(screen).toMatch(/archived.*t3|t3.*archived/);
    expect(screen).toContain("round-trip: OK");

    const tasks = parseTaskLines(fs.readFileSync(rel("Tasks/tasks.md"), "utf8"));
    expect(tasks).toHaveLength(4);
    expect(tasks.find((t) => t.id === "t3")?.status).toBe("todo");
  });

  it("is idempotent: the second write leaves content and mtimes unchanged", () => {
    makeDump(dumpDir, sampleCollections());
    expect(run(true).exitCode).toBe(0);
    const first = snapshot(vault);
    const fileCount = Object.keys(first).length;

    const second = run(true);

    expect(second.exitCode).toBe(0);
    expect(snapshot(vault)).toEqual(first);
    expect(second.screen).toContain(`create 0, update 0, unchanged ${fileCount}`);
  });

  it("does not overwrite manual work and stores both duplicates beside it", () => {
    const manual = "---\nid: reczna\ntitle: Duplikat\n---\nmoja praca\n";
    fs.mkdirSync(rel("Notes"));
    fs.writeFileSync(rel("Notes/duplikat.md"), manual);
    makeDump(dumpDir, sampleCollections());

    const { exitCode, screen } = run(true);

    expect(exitCode).toBe(0);
    expect(fs.readFileSync(rel("Notes/duplikat.md"), "utf8")).toBe(manual);
    expect(fs.readFileSync(rel("Notes/duplikat-2.md"), "utf8")).toContain("pierwszy");
    expect(fs.readFileSync(rel("Notes/duplikat-3.md"), "utf8")).toContain("drugi");
    expect(screen).toMatch(/ostrzeżenia:\n\s+\S/);
    expect(screen).not.toMatch(/ostrzeżenia:\n\s+\(brak\)/);
  });

  it("updates a note by id and keeps its file name", () => {
    makeDump(dumpDir, sampleCollections());
    expect(run(true).exitCode).toBe(0);
    const countBefore = fs.readdirSync(rel("Notes")).length;

    const changed = sampleCollections();
    changed["users/u1/notes"][0].data.title = "Nowy tytuł";
    makeDump(dumpDir, changed);
    const { exitCode } = run(true);

    expect(exitCode).toBe(0);
    expect(fs.readdirSync(rel("Notes")).length).toBe(countBefore);
    const parsed = parseFrontmatter(fs.readFileSync(rel("Notes/zazolc-gesla-jazn.md"), "utf8"));
    expect(parsed?.meta.id).toBe("n1");
    expect(parsed?.meta.title).toBe("Nowy tytuł");
  });

  it("rejects a Notes symlink leading outside the vault (exit 3) and writes nothing", () => {
    fs.symlinkSync(outside, rel("Notes"), "dir");
    makeDump(dumpDir, sampleCollections());

    const { exitCode } = run(true);

    expect(exitCode).toBe(3);
    expect(fs.readdirSync(outside)).toEqual([]);
    expect(fs.readdirSync(vault)).toEqual(["Notes"]);
  });

  it("returns exit 2 for a corrupted dump and leaves the vault empty", () => {
    makeDump(dumpDir, sampleCollections());
    const file = path.join(dumpDir, "users/u1/notes.jsonl");
    const buffer = fs.readFileSync(file);
    buffer[buffer.length - 3] ^= 0x01;
    fs.writeFileSync(file, buffer);

    const { exitCode, screen } = run(true);

    expect(exitCode).toBe(2);
    expect(screen).toContain("SHA");
    expect(fs.readdirSync(vault)).toEqual([]);
  });

  it("requires --uid for a dump with two accounts", () => {
    const collections = sampleCollections();
    collections["users/u2/tasks"] = [{ id: "y1", data: { title: "Cudze", status: "todo" } }];
    makeDump(dumpDir, collections);

    const refused = runImport({ dumpDir, vaultRoot: vault, write: true });
    expect(refused.exitCode).toBe(2);
    expect(refused.screen).toContain("--uid");
    expect(fs.readdirSync(vault)).toEqual([]);

    const accepted = run(true, "u1");
    expect(accepted.exitCode).toBe(0);
    expect(fs.existsSync(rel("Tasks/tasks.md"))).toBe(true);
  });

  it("reports the record balance per type and out-of-scope collections", () => {
    makeDump(dumpDir, sampleCollections());

    const { screen } = run(false);

    expect(screen).toContain("notes | 5 | 4 | 1");
    expect(screen).toContain("tasks | 4 | 4 | 0");
    expect(screen).toContain("resources | 1 | 1 | 0");
    expect(screen).toContain("user_tags | 2 | 2 | 0");
    expect(screen).toContain("task_templates | 1 | 1 | 0");
    expect(screen).toContain("users/u1/calendar_events: 2");
  });

  it("returns exit 1 (usage) for a missing vault root", () => {
    makeDump(dumpDir, sampleCollections());
    const { exitCode } = runImport({
      dumpDir,
      vaultRoot: path.join(tmp, "missing"),
      write: false,
      uid: "u1",
    });
    expect(exitCode).toBe(1);
  });

  it("plans the same files that were written (sanity check on the plan used by the run)", () => {
    makeDump(dumpDir, sampleCollections());
    run(true);
    const plan = buildPlan(convertDump(readDump(dumpDir, "u1")), createVaultView(vault));
    expect(plan.files.every((f) => f.action === "unchanged")).toBe(true);
  });
});
