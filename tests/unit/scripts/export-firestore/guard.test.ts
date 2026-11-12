// @vitest-environment node
import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  assertOutsideGitWorkTree,
  defaultOutDir,
  prepareOutDir,
} from "@/scripts/export-firestore/guard";

const made: string[] = [];
function tmp(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fsx-guard-"));
  made.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("defaultOutDir", () => {
  it("lives under ~/backups and is stamped with date and time", () => {
    const dir = defaultOutDir(new Date("2026-11-12T14:30:45Z"));
    expect(dir).toBe(
      path.join(os.homedir(), "backups", "second-brain-firestore", "2026-11-12T1430")
    );
  });
});

describe("assertOutsideGitWorkTree", () => {
  it("accepts a directory outside any git work tree, even if it does not exist yet", () => {
    const base = tmp();
    expect(() => assertOutsideGitWorkTree(path.join(base, "not", "yet", "created"))).not.toThrow();
  });

  it("rejects a directory inside this repository (existing or not)", () => {
    const inside = path.join(process.cwd(), "tests", "does-not-exist-yet", "dump");
    expect(() => assertOutsideGitWorkTree(inside)).toThrow(/drzewie roboczym gita/);
    expect(() => assertOutsideGitWorkTree(process.cwd())).toThrow(/drzewie roboczym gita/);
  });
});

describe("prepareOutDir", () => {
  it("creates the directory with mode 0700", () => {
    const out = path.join(tmp(), "dump");
    prepareOutDir(out, { resume: false });
    expect(fs.statSync(out).mode & 0o777).toBe(0o700);
  });

  it("refuses a non-empty directory unless resuming", () => {
    const out = tmp();
    fs.writeFileSync(path.join(out, "x"), "1");
    expect(() => prepareOutDir(out, { resume: false })).toThrow(/niepusty/);
    expect(() => prepareOutDir(out, { resume: true })).not.toThrow();
  });
});
