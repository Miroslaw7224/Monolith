import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { getFirestore } from "../../../lib/firebase-admin.js";
import { exportCollection } from "../../../scripts/export-firestore/exporter.js";
import { decodeValue } from "../../../scripts/export-firestore/serialize.js";
import {
  integrationEnabled,
  readJsonl,
  SEED_TIMESTAMP,
  seed,
  tmpDir,
  wipeEmulator,
} from "./export-helpers.js";

const created: string[] = [];
afterEach(() => {
  for (const dir of created.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe.skipIf(!integrationEnabled)("exportCollection (emulator)", () => {
  beforeEach(async () => {
    await wipeEmulator();
    await seed(getFirestore(), { withUnknown: false });
  });

  it.each([1, 2, 3, 500])("pages through a collection with page size %i", async (pageSize) => {
    const col = getFirestore().collection("users/u1/tasks");
    const outDir = tmpDir(created);

    const result = await exportCollection(col, outDir, { pageSize, resume: false });

    expect(result).toMatchObject({
      path: "users/u1/tasks",
      file: "users/u1/tasks.jsonl",
      lines: 3,
    });
    expect(readJsonl(path.join(outDir, result.file)).map((row) => row._id)).toEqual([
      "t-a",
      "t-b",
      "t-c",
    ]);
    expect(fs.existsSync(path.join(outDir, `${result.file}.part`))).toBe(false);
  });

  it("writes full-fidelity documents (path and timestamps)", async () => {
    const col = getFirestore().collection("users/u1/tasks");
    const outDir = tmpDir(created);
    const result = await exportCollection(col, outDir, { pageSize: 500, resume: false });

    const [first] = readJsonl(path.join(outDir, result.file));
    expect(first._path).toBe("users/u1/tasks/t-a");
    const data = decodeValue(first.data) as { createdAt: typeof SEED_TIMESTAMP; priority: null };
    expect(data.createdAt.isEqual(SEED_TIMESTAMP)).toBe(true);
    expect(data.priority).toBeNull();
  });

  it("with resume, skips a collection whose final file already exists", async () => {
    const col = getFirestore().collection("users/u1/tasks");
    const outDir = tmpDir(created);
    fs.mkdirSync(path.join(outDir, "users/u1"), { recursive: true });
    fs.writeFileSync(path.join(outDir, "users/u1/tasks.jsonl"), "sentinel\n");

    const result = await exportCollection(col, outDir, { pageSize: 500, resume: true });

    expect(result.lines).toBe(1);
    expect(fs.readFileSync(path.join(outDir, "users/u1/tasks.jsonl"), "utf8")).toBe("sentinel\n");
  });

  it("with resume, continues from a truncated .part file and matches a fresh export", async () => {
    const col = getFirestore().collection("users/u1/tasks");
    const fresh = tmpDir(created);
    const freshResult = await exportCollection(col, fresh, { pageSize: 1, resume: false });
    const freshText = fs.readFileSync(path.join(fresh, freshResult.file), "utf8");

    const resumed = tmpDir(created);
    fs.mkdirSync(path.join(resumed, "users/u1"), { recursive: true });
    fs.writeFileSync(
      path.join(resumed, "users/u1/tasks.jsonl.part"),
      `${freshText.split("\n")[0]}\n{"_id":"t-b","_pa`
    );

    const result = await exportCollection(col, resumed, { pageSize: 1, resume: true });

    expect(fs.readFileSync(path.join(resumed, result.file), "utf8")).toBe(freshText);
    expect(result.sha256).toBe(freshResult.sha256);
    expect(fs.existsSync(path.join(resumed, `${result.file}.part`))).toBe(false);
  });
});
