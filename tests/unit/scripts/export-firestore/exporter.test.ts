// @vitest-environment node
import { describe, it, expect, afterEach } from "vitest";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describeFile, fileFor, truncateToLastFullLine } from "@/scripts/export-firestore/exporter";

const made: string[] = [];
function tmp(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fsx-exp-"));
  made.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("fileFor", () => {
  it("puts per-user collections under users/<uid>/", () => {
    expect(fileFor("users/u1/tasks")).toBe("users/u1/tasks.jsonl");
    expect(fileFor("users/u1/board/main/history")).toBe("users/u1/board/main/history.jsonl");
  });

  it("puts root collections under root/", () => {
    expect(fileFor("users")).toBe("root/users.jsonl");
    expect(fileFor("waitlist")).toBe("root/waitlist.jsonl");
    expect(fileFor("mystery/m1/sub")).toBe("root/mystery/m1/sub.jsonl");
  });
});

describe("truncateToLastFullLine", () => {
  it("returns nothing for an empty or missing-newline file and clears it", () => {
    const file = path.join(tmp(), "a.part");
    fs.writeFileSync(file, '{"_id":"brok');
    expect(truncateToLastFullLine(file)).toEqual({ lastId: null, lines: 0 });
    expect(fs.readFileSync(file, "utf8")).toBe("");
  });

  it("cuts a half-written trailing line and reports the last complete id", () => {
    const file = path.join(tmp(), "b.part");
    fs.writeFileSync(
      file,
      '{"_id":"a","_path":"x/a","data":{}}\n{"_id":"b","_path":"x/b","data":{}}\n{"_id":"c'
    );
    expect(truncateToLastFullLine(file)).toEqual({ lastId: "b", lines: 2 });
    expect(fs.readFileSync(file, "utf8")).toBe(
      '{"_id":"a","_path":"x/a","data":{}}\n{"_id":"b","_path":"x/b","data":{}}\n'
    );
  });

  it("leaves a clean file untouched", () => {
    const file = path.join(tmp(), "c.part");
    const content = '{"_id":"a","_path":"x/a","data":{}}\n';
    fs.writeFileSync(file, content);
    expect(truncateToLastFullLine(file)).toEqual({ lastId: "a", lines: 1 });
    expect(fs.readFileSync(file, "utf8")).toBe(content);
  });
});

describe("describeFile", () => {
  it("counts lines and computes sha256", () => {
    const dir = tmp();
    fs.mkdirSync(path.join(dir, "root"), { recursive: true });
    const content = "one\ntwo\nthree\n";
    fs.writeFileSync(path.join(dir, "root", "x.jsonl"), content);
    const result = describeFile("x", dir, "root/x.jsonl");
    expect(result).toEqual({
      path: "x",
      file: "root/x.jsonl",
      lines: 3,
      sha256: crypto.createHash("sha256").update(content).digest("hex"),
    });
  });
});
