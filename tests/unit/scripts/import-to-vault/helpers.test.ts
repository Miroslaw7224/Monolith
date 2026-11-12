// @vitest-environment node
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { makeDump, sampleCollections, ts } from "./helpers";

let dir: string;
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("makeDump", () => {
  it("writes JSONL files and a manifest with correct sha256 and line counts", () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "dump-helper-"));
    makeDump(dir, sampleCollections(), { uid: "u1" });

    const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
    expect(manifest).toMatchObject({
      version: 1,
      tool: "export-firestore",
      status: "ok",
      uid: "u1",
      only: null,
      ghosts: [],
      auth: { skipped: true },
    });
    expect(manifest.collections).toHaveLength(Object.keys(sampleCollections()).length);

    for (const entry of manifest.collections) {
      const buffer = fs.readFileSync(path.join(dir, entry.file));
      expect(crypto.createHash("sha256").update(buffer).digest("hex")).toBe(entry.sha256);
      const lines = buffer.toString("utf8").split("\n").filter(Boolean);
      expect(lines).toHaveLength(entry.lines);
      expect(entry.before).toBe(entry.lines);
      expect(entry.after).toBe(entry.lines);
    }
    expect(manifest.totals.documents).toBe(
      manifest.collections.reduce((n: number, c: { lines: number }) => n + c.lines, 0)
    );

    const notesFile = manifest.collections.find(
      (c: { path: string }) => c.path === "users/u1/notes"
    );
    expect(notesFile.file).toBe("users/u1/notes.jsonl");
    const first = JSON.parse(
      fs.readFileSync(path.join(dir, notesFile.file), "utf8").split("\n")[0]
    );
    expect(first).toMatchObject({ _id: "n1", _path: "users/u1/notes/n1" });
  });

  it("puts root collections under root/", () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "dump-helper-"));
    makeDump(dir, { waitlist: [{ id: "w1", data: {} }] });
    expect(fs.existsSync(path.join(dir, "root/waitlist.jsonl"))).toBe(true);
  });

  it("ts builds a timestamp", () => {
    expect(ts("2026-05-01T10:00:00.000Z")).toEqual({
      __type: "timestamp",
      iso: "2026-05-01T10:00:00.000Z",
      seconds: 1777629600,
      nanos: 0,
    });
  });
});
