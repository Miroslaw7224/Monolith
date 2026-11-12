// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConflictError } from "@/lib/errors";
import {
  PathOutsideVaultError,
  readVaultFile,
  resolveInsideVault,
  updateVaultFile,
  writeVaultFile,
} from "@/lib/nexus/vault-fs";

let tmp: string;
let root: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vault-fs-"));
  root = path.join(tmp, "vault");
  fs.mkdirSync(root);
});
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe("resolveInsideVault", () => {
  it("rejects traversal, absolute paths, empty path and NUL", () => {
    for (const bad of ["../x", "a/../../x", "/etc/passwd", "C:\\x", "", "a\0b"]) {
      expect(() => resolveInsideVault(root, bad), bad).toThrow(PathOutsideVaultError);
    }
  });
  it("rejects a symlink that points outside the vault", () => {
    const outside = path.join(tmp, "outside");
    fs.mkdirSync(outside);
    fs.symlinkSync(outside, path.join(root, "link"));
    expect(() => resolveInsideVault(root, "link/file.md")).toThrow(PathOutsideVaultError);
  });
  it("accepts a nested path that does not exist yet", () => {
    expect(resolveInsideVault(root, "Tasks/tasks.md")).toBe(
      path.join(fs.realpathSync(root), "Tasks", "tasks.md")
    );
  });
});

describe("readVaultFile / writeVaultFile", () => {
  it("returns null for a missing file", () => {
    expect(readVaultFile("Tasks/tasks.md", { root })).toBeNull();
  });
  it("creates directories and writes with LF, reading back the same text and a stable version", () => {
    const v = writeVaultFile("Tasks/tasks.md", "a\nb\n", { root, expected: null });
    const f = readVaultFile("Tasks/tasks.md", { root })!;
    expect(f.text).toBe("a\nb\n");
    expect(f.version).toEqual(v);
    expect(f.version.size).toBe(4);
    expect(f.version.hash).toMatch(/^[0-9a-f]{64}$/);
  });
  it("normalizes CRLF on read and gives CRLF and LF files the same hash", () => {
    fs.writeFileSync(path.join(root, "a.md"), "x\r\ny\r\n");
    fs.writeFileSync(path.join(root, "b.md"), "x\ny\n");
    const a = readVaultFile("a.md", { root })!;
    const b = readVaultFile("b.md", { root })!;
    expect(a.text).toBe("x\ny\n");
    expect(a.version.hash).toBe(b.version.hash);
  });
  it("throws ConflictError when expected is null but the file exists", () => {
    fs.writeFileSync(path.join(root, "a.md"), "x\n");
    expect(() => writeVaultFile("a.md", "y\n", { root, expected: null })).toThrow(ConflictError);
    expect(fs.readFileSync(path.join(root, "a.md"), "utf8")).toBe("x\n");
  });
  it("throws ConflictError when the file changed after the expected read", () => {
    const v = writeVaultFile("a.md", "x\n", { root, expected: null });
    fs.writeFileSync(path.join(root, "a.md"), "changed\n");
    expect(() => writeVaultFile("a.md", "y\n", { root, expected: v })).toThrow(ConflictError);
    expect(fs.readFileSync(path.join(root, "a.md"), "utf8")).toBe("changed\n");
  });
  it("leaves no temporary files behind after a conflict or a success", () => {
    writeVaultFile("a.md", "x\n", { root, expected: null });
    try {
      writeVaultFile("a.md", "y\n", { root, expected: null });
    } catch {
      /* oczekiwany konflikt */
    }
    expect(fs.readdirSync(root)).toEqual(["a.md"]);
  });
  it("refuses to write outside the vault", () => {
    expect(() => writeVaultFile("../evil.md", "x", { root, expected: null })).toThrow(
      PathOutsideVaultError
    );
  });
});

describe("updateVaultFile", () => {
  it("creates a missing file from mutate(null)", async () => {
    await updateVaultFile("n.md", (cur) => `${cur ?? "new"}\n`, { root });
    expect(fs.readFileSync(path.join(root, "n.md"), "utf8")).toBe("new\n");
  });
  it("applies mutate to fresh content when an external write happens between read and write", async () => {
    fs.writeFileSync(path.join(root, "t.md"), "one\n");
    let calls = 0;
    await updateVaultFile(
      "t.md",
      (cur) => {
        calls += 1;
        if (calls === 1) fs.writeFileSync(path.join(root, "t.md"), "one\nexternal\n");
        return `${cur}mine\n`;
      },
      { root }
    );
    expect(calls).toBe(2);
    expect(fs.readFileSync(path.join(root, "t.md"), "utf8")).toBe("one\nexternal\nmine\n");
  });
  it("throws ConflictError when the file keeps changing beyond the retry limit", async () => {
    fs.writeFileSync(path.join(root, "t.md"), "0\n");
    let n = 0;
    await expect(
      updateVaultFile(
        "t.md",
        (cur) => {
          n += 1;
          fs.writeFileSync(path.join(root, "t.md"), `${n}\n`);
          return `${cur}x\n`;
        },
        { root, retries: 2 }
      )
    ).rejects.toThrow(ConflictError);
    expect(n).toBe(3);
  });
  it("does not retry when mutate throws", async () => {
    fs.writeFileSync(path.join(root, "t.md"), "a\n");
    let calls = 0;
    await expect(
      updateVaultFile(
        "t.md",
        () => {
          calls += 1;
          throw new Error("boom");
        },
        { root }
      )
    ).rejects.toThrow("boom");
    expect(calls).toBe(1);
  });
  it("serializes concurrent updates of the same file (no lost updates)", async () => {
    fs.writeFileSync(path.join(root, "c.md"), "");
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        updateVaultFile("c.md", (cur) => `${cur ?? ""}${i}\n`, { root })
      )
    );
    const lines = fs.readFileSync(path.join(root, "c.md"), "utf8").trim().split("\n");
    expect(lines).toHaveLength(20);
    expect(new Set(lines).size).toBe(20);
  });
});
