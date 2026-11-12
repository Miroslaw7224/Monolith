import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Timestamp, type Firestore } from "firebase-admin/firestore";

export const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
export const integrationEnabled = !!process.env.RUN_INTEGRATION_TESTS && !!emulatorHost;

/** Czyści WYŁĄCZNIE emulator (URL budowany z FIRESTORE_EMULATOR_HOST). */
export async function wipeEmulator(): Promise<void> {
  if (!emulatorHost) throw new Error("FIRESTORE_EMULATOR_HOST nie jest ustawiony");
  const project = process.env.FIREBASE_PROJECT_ID ?? process.env.GCLOUD_PROJECT ?? "demo-nexus";
  const res = await fetch(
    `http://${emulatorHost}/emulator/v1/projects/${project}/databases/(default)/documents`,
    { method: "DELETE" }
  );
  if (!res.ok) throw new Error(`Czyszczenie emulatora nie powiodło się: ${res.status}`);
}

// Firestore przechowuje czas z dokładnością do mikrosekund, więc nanos musi być wielokrotnością 1000.
export const SEED_TIMESTAMP = new Timestamp(1767323045, 678901000);

/** withUnknown dodaje kolekcję mystery i podkolekcję board/main/history (obie nieznane). */
export async function seed(db: Firestore, opts: { withUnknown: boolean }): Promise<void> {
  await db.doc("users/u1").set({ email: "a@example.test" });
  for (const id of ["t-a", "t-b", "t-c"]) {
    await db
      .doc(`users/u1/tasks/${id}`)
      .set({ title: id, createdAt: SEED_TIMESTAMP, tags: ["x", { n: 1 }], priority: null });
  }
  await db
    .doc("users/u1/notes/n1")
    .set({ title: "n", content: "<p>hi</p>", createdAt: SEED_TIMESTAMP });
  await db.doc("users/u1/board/main").set({ nodes: [] });
  await db.doc("users/ghost/tasks/t1").set({ title: "ghost" });
  await db.doc("waitlist/w1").set({ email: "w@example.test" });
  if (opts.withUnknown) {
    await db.doc("users/u1/board/main/history/h1").set({ at: SEED_TIMESTAMP });
    await db.doc("mystery/m1").set({ a: 1 });
  }
}

export function readJsonl(file: string): Array<{ _id: string; _path: string; data: unknown }> {
  const text = fs.readFileSync(file, "utf8");
  return text === ""
    ? []
    : text
        .slice(0, -1)
        .split("\n")
        .map((line) => JSON.parse(line));
}

export function tmpDir(created: string[]): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fsx-int-"));
  created.push(dir);
  return dir;
}
