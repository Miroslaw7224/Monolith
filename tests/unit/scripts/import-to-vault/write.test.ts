// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  PathOutsideVaultError,
  applyPlan,
  atomicWrite,
  createVaultView,
  resolveInsideVault,
} from "@/scripts/import-to-vault/write";
import type { PlannedFile } from "@/scripts/import-to-vault/types";

let tmp: string;
let root: string;
let realRoot: string;
let outside: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "write-test-"));
  root = path.join(tmp, "vault");
  outside = path.join(tmp, "outside");
  fs.mkdirSync(root);
  fs.mkdirSync(outside);
  realRoot = fs.realpathSync(root);
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("resolveInsideVault", () => {
  it("resolves a relative path under the real root", () => {
    expect(resolveInsideVault(root, "Notes/a.md")).toBe(path.join(realRoot, "Notes", "a.md"));
  });

  it("rejects traversal, absolute, empty and root-pointing paths", () => {
    for (const rel of ["../x.md", "Notes/../../x.md", "/etc/passwd", "", "Notes/.."]) {
      expect(() => resolveInsideVault(root, rel), rel).toThrow(PathOutsideVaultError);
    }
  });

  it("rejects a path through a symlink leading outside the vault", () => {
    fs.symlinkSync(outside, path.join(root, "link"), "dir");
    expect(() => resolveInsideVault(root, "link/x.md")).toThrow(PathOutsideVaultError);
  });

  it("accepts a nonexistent nested allowed path", () => {
    expect(resolveInsideVault(root, "Notes/.html/a.html")).toBe(
      path.join(realRoot, "Notes", ".html", "a.html")
    );
  });

  it("throws a plain Error when the root does not exist or is not a directory", () => {
    expect(() => resolveInsideVault(path.join(tmp, "missing"), "a.md")).toThrow(Error);
    const file = path.join(tmp, "file.txt");
    fs.writeFileSync(file, "x");
    expect(() => resolveInsideVault(file, "a.md")).toThrow(Error);
  });
});

describe("atomicWrite", () => {
  it("writes exact content and leaves no tmp files", () => {
    const target = path.join(realRoot, "a.md");
    const content = "Zażółć gęślą jaźń\n";
    atomicWrite(target, content);
    expect(fs.readFileSync(target, "utf8")).toBe(content);
    expect(fs.readdirSync(realRoot).filter((n) => n.endsWith(".tmp"))).toEqual([]);
  });

  it("overwrites an existing file", () => {
    const target = path.join(realRoot, "a.md");
    fs.writeFileSync(target, "old");
    atomicWrite(target, "new");
    expect(fs.readFileSync(target, "utf8")).toBe("new");
  });

  it("cleans up the tmp file and rethrows when the rename fails", () => {
    const target = path.join(realRoot, "dir");
    fs.mkdirSync(target);
    expect(() => atomicWrite(target, "x")).toThrow();
    expect(fs.readdirSync(realRoot).filter((n) => n.endsWith(".tmp"))).toEqual([]);
  });
});

describe("createVaultView", () => {
  it("reads files, returns null for missing ones", () => {
    fs.mkdirSync(path.join(root, "Notes"));
    fs.writeFileSync(path.join(root, "Notes", "a.md"), "hi");
    const view = createVaultView(root);
    expect(view.read("Notes/a.md")).toBe("hi");
    expect(view.read("Nie/ma.md")).toBeNull();
  });

  it("lists only files, sorted, and [] for a missing dir", () => {
    fs.mkdirSync(path.join(root, "Notes", ".html"), { recursive: true });
    fs.writeFileSync(path.join(root, "Notes", "b.md"), "");
    fs.writeFileSync(path.join(root, "Notes", "a.md"), "");
    const view = createVaultView(root);
    expect(view.list("Notes")).toEqual(["a.md", "b.md"]);
    expect(view.list("Brak")).toEqual([]);
  });

  it("guards paths", () => {
    const view = createVaultView(root);
    expect(() => view.read("../x")).toThrow(PathOutsideVaultError);
    expect(() => view.list("../x")).toThrow(PathOutsideVaultError);
  });
});

describe("applyPlan", () => {
  const f = (relPath: string, action: PlannedFile["action"], content = "c"): PlannedFile => ({
    relPath,
    content,
    kind: "note",
    action,
  });

  it("creates and updates files with directories and counts them", () => {
    fs.mkdirSync(path.join(root, "Notes"));
    fs.writeFileSync(path.join(root, "Notes", "old.md"), "old");
    const res = applyPlan(root, [
      f("Notes/new.md", "create", "new"),
      f("Notes/old.md", "update", "updated"),
      f("Deep/er/x.md", "create", "x"),
      f("Notes/same.md", "unchanged"),
    ]);
    expect(res).toEqual({ created: 2, updated: 1, unchanged: 1 });
    expect(fs.readFileSync(path.join(root, "Notes", "new.md"), "utf8")).toBe("new");
    expect(fs.readFileSync(path.join(root, "Notes", "old.md"), "utf8")).toBe("updated");
    expect(fs.readFileSync(path.join(root, "Deep", "er", "x.md"), "utf8")).toBe("x");
    expect(fs.existsSync(path.join(root, "Notes", "same.md"))).toBe(false);
  });

  it("writes nothing when a bad path is last in the list", () => {
    expect(() =>
      applyPlan(root, [
        f("Notes/a.md", "create"),
        f("Other/b.md", "create"),
        f("../evil.md", "create"),
      ])
    ).toThrow(PathOutsideVaultError);
    expect(fs.existsSync(path.join(root, "Notes"))).toBe(false);
    expect(fs.existsSync(path.join(root, "Other"))).toBe(false);
    expect(fs.existsSync(path.join(tmp, "evil.md"))).toBe(false);
  });

  it("does not touch an unchanged file (mtime stays)", () => {
    const file = path.join(root, "same.md");
    fs.writeFileSync(file, "same");
    const old = new Date("2020-01-01T00:00:00Z");
    fs.utimesSync(file, old, old);
    const res = applyPlan(root, [f("same.md", "unchanged", "same")]);
    expect(res).toEqual({ created: 0, updated: 0, unchanged: 1 });
    expect(fs.statSync(file).mtimeMs).toBe(old.getTime());
  });
});
