// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { REPO_FILE_MAX_BYTES, readRepoFile } from "@/lib/git/repo-file";

let dir = "";

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "prj-file-"));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("readRepoFile", () => {
  it("zwykły plik", () => {
    fs.writeFileSync(path.join(dir, "CLAUDE.md"), "# Zasady\nX");
    expect(readRepoFile(dir, "CLAUDE.md")).toEqual({ ok: true, text: "# Zasady\nX" });
  });

  it("brak pliku", () => {
    expect(readRepoFile(dir, "CLAUDE.md")).toEqual({ ok: false, reason: "missing" });
  });

  it("symlink jest odrzucony", () => {
    const target = path.join(dir, "inny.md");
    fs.writeFileSync(target, "tajne");
    fs.symlinkSync(target, path.join(dir, "CLAUDE.md"));
    expect(readRepoFile(dir, "CLAUDE.md")).toEqual({ ok: false, reason: "unsafe" });
  });

  it("limit rozmiaru: 64 KB przechodzi, o bajt więcej nie", () => {
    fs.writeFileSync(path.join(dir, "CLAUDE.md"), "a".repeat(REPO_FILE_MAX_BYTES));
    expect(readRepoFile(dir, "CLAUDE.md").ok).toBe(true);
    fs.writeFileSync(path.join(dir, "CLAUDE.md"), "a".repeat(REPO_FILE_MAX_BYTES + 1));
    expect(readRepoFile(dir, "CLAUDE.md")).toEqual({ ok: false, reason: "unsafe" });
  });

  it("katalog zamiast pliku", () => {
    fs.mkdirSync(path.join(dir, "CLAUDE.md"));
    expect(readRepoFile(dir, "CLAUDE.md")).toEqual({ ok: false, reason: "unsafe" });
  });
});
