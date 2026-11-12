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

  it("verifies a single-account dump against that account only", async () => {
    const db = getFirestore();
    const scoped = path.join(tmpDir(created), "scoped");
    await runExport({ db, outDir: scoped, pageSize: 500, resume: false, uid: "u1" });
    // zmiana w innym koncie i w kolekcji głównej nie dotyczy tego zrzutu
    await db.doc("users/ghost/tasks/t2").set({ title: "other account" });
    await db.doc("fresh/f1").set({ a: 1 });
    expect(await verifyDump(scoped, db)).toEqual({ ok: true, problems: [] });
  });

  it("recomputes status from the current known list, not the stored one", async () => {
    const file = path.join(outDir, "manifest.json");
    const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
    manifest.status = "needs-review";
    manifest.collections[0].known = false; // jak w zrzucie sprzed dopisania kolekcji do znanych
    fs.writeFileSync(file, JSON.stringify(manifest));
    expect(await verifyDump(outDir, getFirestore())).toEqual({ ok: true, problems: [] });
  });

  it("verifies a dump limited with only against those collections only", async () => {
    const db = getFirestore();
    const narrow = path.join(tmpDir(created), "narrow");
    await runExport({
      db,
      outDir: narrow,
      pageSize: 500,
      resume: false,
      uid: "u1",
      only: ["tasks"],
    });
    await db.doc("users/u1/notes/n2").set({ title: "added outside the dump scope" });
    expect(await verifyDump(narrow, db)).toEqual({ ok: true, problems: [] });
    await db.doc("users/u1/tasks/t-new").set({ title: "in scope" });
    expect((await verifyDump(narrow, db)).ok).toBe(false);
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
