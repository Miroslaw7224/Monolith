import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { getFirestore } from "../../../lib/firebase-admin.js";
import { runExport } from "../../../scripts/export-firestore/run.js";
import { verifyDump } from "../../../scripts/export-firestore/verify.js";
import { integrationEnabled, seed, tmpDir, wipeEmulator } from "./export-helpers.js";

const created: string[] = [];
afterEach(() => {
  for (const dir of created.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe.skipIf(!integrationEnabled)("verifyDump (emulator)", () => {
  let outDir: string;

  beforeEach(async () => {
    await wipeEmulator();
    const db = getFirestore();
    await seed(db, { withUnknown: false });
    outDir = path.join(tmpDir(created), "dump");
    await runExport({ db, outDir, pageSize: 500, resume: false });
  });

  it("passes for an untouched dump", async () => {
    expect(await verifyDump(outDir, getFirestore())).toEqual({ ok: true, problems: [] });
  });

  it("fails when a document was added to Firestore after the export", async () => {
    const db = getFirestore();
    await db.doc("users/u1/tasks/t-new").set({ title: "late" });
    const result = await verifyDump(outDir, db);
    expect(result.ok).toBe(false);
    expect(result.problems.join("\n")).toMatch(/users\/u1\/tasks.*4.*3/);
  });

  it("fails when a new collection appeared after the export", async () => {
    const db = getFirestore();
    await db.doc("fresh/f1").set({ a: 1 });
    const result = await verifyDump(outDir, db);
    expect(result.ok).toBe(false);
    expect(result.problems.join("\n")).toMatch(/nowa kolekcja fresh/);
  });

  it("fails when a dump file was tampered with", async () => {
    const file = path.join(outDir, "users/u1/tasks.jsonl");
    fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("t-a", "t-X"));
    const result = await verifyDump(outDir, getFirestore());
    expect(result.ok).toBe(false);
    expect(result.problems.join("\n")).toMatch(/users\/u1\/tasks\.jsonl.*sha256/);
  });

  it("fails when a dump file is missing", async () => {
    fs.rmSync(path.join(outDir, "users/u1/notes.jsonl"));
    const result = await verifyDump(outDir, getFirestore());
    expect(result.ok).toBe(false);
    expect(result.problems.join("\n")).toMatch(/brak pliku users\/u1\/notes\.jsonl/);
  });

  it("fails when manifest.json is missing", async () => {
    fs.rmSync(path.join(outDir, "manifest.json"));
    const result = await verifyDump(outDir, getFirestore());
    expect(result.ok).toBe(false);
    expect(result.problems[0]).toMatch(/manifest\.json/);
  });
});
