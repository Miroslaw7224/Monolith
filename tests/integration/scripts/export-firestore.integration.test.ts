import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { getFirestore } from "../../../lib/firebase-admin.js";
import { countReport, runExport } from "../../../scripts/export-firestore/run.js";
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

describe.skipIf(!integrationEnabled)("runExport (emulator)", () => {
  beforeEach(async () => {
    await wipeEmulator();
  });

  it("exports every collection, flags unknown ones and lists ghost documents", async () => {
    const db = getFirestore();
    await seed(db, { withUnknown: true });
    const outDir = path.join(tmpDir(created), "dump");

    const manifest = await runExport({ db, outDir, pageSize: 2, resume: false });

    expect(manifest.status).toBe("needs-review");
    const byPath = Object.fromEntries(manifest.collections.map((c) => [c.path, c]));
    expect(Object.keys(byPath).sort()).toEqual(
      [
        "mystery",
        "users",
        "users/ghost/tasks",
        "users/u1/board",
        "users/u1/board/main/history",
        "users/u1/notes",
        "users/u1/tasks",
        "waitlist",
      ].sort()
    );
    expect(byPath["users/u1/tasks"]).toMatchObject({ before: 3, lines: 3, after: 3, known: true });
    expect(byPath["users"]).toMatchObject({ before: 1, lines: 1, after: 1 }); // duch users/ghost nie jest liczony
    expect(byPath["mystery"]).toMatchObject({ known: false, lines: 1 });
    expect(manifest.ghosts).toEqual(["users/ghost"]);
    expect(manifest.auth).toEqual({ skipped: true });

    const tasks = readJsonl(path.join(outDir, "users/u1/tasks.jsonl"));
    expect(tasks.map((t) => t._id)).toEqual(["t-a", "t-b", "t-c"]);
    expect(tasks[0]._path).toBe("users/u1/tasks/t-a");
    const restored = decodeValue(tasks[0].data) as {
      createdAt: typeof SEED_TIMESTAMP;
      tags: unknown[];
    };
    expect(restored.createdAt.isEqual(SEED_TIMESTAMP)).toBe(true);
    expect(restored.tags).toEqual(["x", { n: 1 }]);

    expect(fs.statSync(path.join(outDir, "users/u1/tasks.jsonl")).mode & 0o777).toBe(0o600);
    expect(fs.statSync(outDir).mode & 0o777).toBe(0o700);
    expect(fs.existsSync(path.join(outDir, "manifest.json"))).toBe(true);
  });

  it("is ok when no unknown collection holds data", async () => {
    const db = getFirestore();
    await seed(db, { withUnknown: false });
    const outDir = path.join(tmpDir(created), "dump");
    const manifest = await runExport({ db, outDir, pageSize: 500, resume: false });
    expect(manifest.status).toBe("ok");
    expect(manifest.totals.documents).toBe(1 + 3 + 1 + 1 + 1 + 1); // users, tasks, notes, board, ghost task, waitlist
  });

  it("resumes after a crash without duplicating documents", async () => {
    const db = getFirestore();
    await seed(db, { withUnknown: false });

    const full = path.join(tmpDir(created), "full");
    const fullManifest = await runExport({ db, outDir: full, pageSize: 1, resume: false });
    const fullTasks = fs.readFileSync(path.join(full, "users/u1/tasks.jsonl"), "utf8");
    const firstLine = fullTasks.split("\n")[0];

    const resumed = path.join(tmpDir(created), "resumed");
    fs.mkdirSync(path.join(resumed, "users/u1"), { recursive: true });
    fs.writeFileSync(
      path.join(resumed, "users/u1/tasks.jsonl.part"),
      `${firstLine}\n{"_id":"t-b","_pa`
    );

    const manifest = await runExport({ db, outDir: resumed, pageSize: 1, resume: true });

    expect(fs.readFileSync(path.join(resumed, "users/u1/tasks.jsonl"), "utf8")).toBe(fullTasks);
    expect(fs.existsSync(path.join(resumed, "users/u1/tasks.jsonl.part"))).toBe(false);
    expect(manifest.status).toBe("ok");
    const sha = (m: typeof manifest) =>
      m.collections.find((c) => c.path === "users/u1/tasks")?.sha256;
    expect(sha(manifest)).toBe(sha(fullManifest));
  });

  it("with a uid exports only that account and nothing else", async () => {
    const db = getFirestore();
    await seed(db, { withUnknown: true });
    const outDir = path.join(tmpDir(created), "dump");

    const manifest = await runExport({ db, outDir, pageSize: 500, resume: false, uid: "u1" });

    expect(manifest.uid).toBe("u1");
    const paths = manifest.collections.map((c) => c.path).sort();
    expect(paths).toEqual(
      ["users/u1/board", "users/u1/board/main/history", "users/u1/notes", "users/u1/tasks"].sort()
    );
    expect(manifest.ghosts).toEqual([]);
    expect(fs.existsSync(path.join(outDir, "root"))).toBe(false);
    expect(fs.existsSync(path.join(outDir, "users/ghost"))).toBe(false);
  });

  it("with only exports just the named collections and skips the rest", async () => {
    const db = getFirestore();
    await seed(db, { withUnknown: true });
    const outDir = path.join(tmpDir(created), "dump");

    const manifest = await runExport({
      db,
      outDir,
      pageSize: 500,
      resume: false,
      uid: "u1",
      only: ["tasks", "notes"],
    });

    expect(manifest.only).toEqual(["tasks", "notes"]);
    expect(manifest.collections.map((c) => c.path).sort()).toEqual([
      "users/u1/notes",
      "users/u1/tasks",
    ]);
    expect(manifest.status).toBe("ok");
    expect(fs.existsSync(path.join(outDir, "users/u1/board.jsonl"))).toBe(false);
  });

  it("refuses to write inside this repository", async () => {
    const db = getFirestore();
    const inside = path.join(process.cwd(), "tests", "tmp-dump-should-not-exist");
    await expect(runExport({ db, outDir: inside, pageSize: 500, resume: false })).rejects.toThrow(
      /drzewie roboczym gita/
    );
    expect(fs.existsSync(inside)).toBe(false);
  });

  it("count-only reports counts without writing any file", async () => {
    const db = getFirestore();
    await seed(db, { withUnknown: true });

    const report = await countReport(db);

    const row = (p: string) => report.rows.find((r) => r.path === p);
    expect(row("users/u1/tasks")).toMatchObject({ count: 3, known: true });
    expect(row("mystery")).toMatchObject({ count: 1, known: false });
    expect(report.ghosts).toEqual(["users/ghost"]);
    expect(report.total).toBe(1 + 3 + 1 + 1 + 1 + 1 + 1 + 1); // users, tasks, notes, board, ghost task, waitlist, history, mystery
    expect(report.estimatedReads).toBe(report.total * 2);
  });
});
