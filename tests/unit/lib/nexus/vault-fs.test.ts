// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError, DomainError } from "@/lib/errors";
import { VaultConfigError } from "@/lib/nexus/vault-path";
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
afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("resolveInsideVault", () => {
  it("throws VaultConfigError when the vault root is missing or is a file", () => {
    expect(() => resolveInsideVault(path.join(tmp, "nope"), "a.md")).toThrow(VaultConfigError);
    const file = path.join(tmp, "file.txt");
    fs.writeFileSync(file, "x");
    expect(() => resolveInsideVault(file, "a.md")).toThrow(VaultConfigError);
  });
  it("rejects traversal, absolute paths, empty path and NUL", () => {
    for (const bad of ["../x", "a/../../x", "/etc/passwd", "C:\\x", "", "a\0b"]) {
      expect(() => resolveInsideVault(root, bad), bad).toThrow(PathOutsideVaultError);
    }
  });
  it("throws a DomainError with status 400", () => {
    let caught: unknown;
    try {
      resolveInsideVault(root, "../x");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(PathOutsideVaultError);
    expect(caught).toBeInstanceOf(DomainError);
    expect((caught as DomainError).statusCode).toBe(400);
  });
  it("does not treat names starting with two dots as traversal", () => {
    expect(resolveInsideVault(root, "..notes.md")).toBe(
      path.join(fs.realpathSync(root), "..notes.md")
    );
    expect(() => resolveInsideVault(root, "a/../b")).toThrow(PathOutsideVaultError);
  });
  it("rejects a dangling symlink inside the vault", () => {
    fs.symlinkSync(path.join(tmp, "nope"), path.join(root, "dangling"));
    expect(() => resolveInsideVault(root, "dangling/x.md")).toThrow(PathOutsideVaultError);
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
  it("reads strictly as UTF-8 and throws on invalid bytes", () => {
    fs.writeFileSync(path.join(root, "bad.md"), Buffer.from([0x66, 0xf3, 0x72]));
    expect(() => readVaultFile("bad.md", { root })).toThrow(/UTF-8/);
  });
  it("strips a leading BOM on read", () => {
    fs.writeFileSync(path.join(root, "bom.md"), "\uFEFF---\nid: 1\n---\n");
    expect(readVaultFile("bom.md", { root })!.text).toBe("---\nid: 1\n---\n");
  });
  it("throws when the path is a directory", () => {
    fs.mkdirSync(path.join(root, "somedir"));
    expect(() => readVaultFile("somedir", { root })).toThrow();
  });
  it("writes LF only, even for CRLF input", () => {
    writeVaultFile("a.md", "a\r\nb\r\n", { root, expected: null });
    expect(fs.readFileSync(path.join(root, "a.md"), "utf8")).not.toContain("\r");
  });
  it("removes the temporary file and keeps the original error when rename fails", () => {
    vi.spyOn(fs, "renameSync").mockImplementationOnce(() => {
      throw new Error("rename failed");
    });
    expect(() => writeVaultFile("a.md", "x\n", { root, expected: null })).toThrow("rename failed");
    expect(fs.readdirSync(root)).toEqual([]);
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
  it("does not lose updates when called concurrently", async () => {
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
