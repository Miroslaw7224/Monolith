import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type SampleRow = { id: string; data: Record<string, unknown> };

/** Znacznik czasu w kształcie zrzutu (syntetyczny). */
export function ts(iso: string) {
  return { __type: "timestamp", iso, seconds: Math.floor(Date.parse(iso) / 1000), nanos: 0 };
}

function fileFor(collectionPath: string): string {
  return collectionPath.startsWith("users/")
    ? `${collectionPath}.jsonl`
    : `root/${collectionPath}.jsonl`;
}

/** Zapisuje syntetyczny zrzut: pliki JSONL i manifest.json w kształcie zrzutu z 0a. */
export function makeDump(
  dir: string,
  collections: Record<string, SampleRow[]>,
  manifestPatch?: object
): void {
  fs.mkdirSync(dir, { recursive: true });
  const entries = [];
  let documents = 0;
  for (const [collectionPath, rows] of Object.entries(collections)) {
    const file = fileFor(collectionPath);
    const text = rows
      .map((row) =>
        JSON.stringify({ _id: row.id, _path: `${collectionPath}/${row.id}`, data: row.data })
      )
      .map((line) => `${line}\n`)
      .join("");
    const buffer = Buffer.from(text, "utf8");
    const target = path.join(dir, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, buffer);
    entries.push({
      path: collectionPath,
      file,
      known: true,
      before: rows.length,
      lines: rows.length,
      after: rows.length,
      sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
    });
    documents += rows.length;
  }
  const manifest = {
    version: 1,
    tool: "export-firestore",
    exportedAt: "2026-11-12T10:00:00.000Z",
    projectId: null,
    pageSize: 500,
    uid: null,
    only: null,
    status: "ok",
    collections: entries,
    ghosts: [],
    auth: { skipped: true },
    totals: { collections: entries.length, documents },
  };
  Object.assign(manifest, manifestPatch);
  fs.writeFileSync(path.join(dir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

/** Dane syntetyczne używane przez testy modułów i test integracyjny. */
export function sampleCollections(): Record<string, SampleRow[]> {
  return {
    "users/u1/notes": [
      {
        id: "n1",
        data: {
          title: "Zażółć gęślą jaźń",
          content:
            '<h1>Nagłówek</h1><p style="color: red; text-align: center">Tekst <strong>gruby</strong> i <u>podkreślony</u></p><ul><li>jeden</li><li>dwa</li></ul>',
          createdAt: ts("2026-05-01T10:00:00.000Z"),
        },
      },
      {
        id: "n2",
        data: {
          title: "Duplikat",
          created_at: "2026-05-02T10:00:00.000Z",
          content: "<p>pierwszy</p>",
        },
      },
      {
        id: "n3",
        data: {
          title: "Duplikat",
          created_at: "2026-05-03T10:00:00.000Z",
          content: "<p>drugi</p>",
        },
      },
      { id: "n4", data: { title: "", content: "<p>bez tytułu</p>" } },
    ],
    "users/u1/tasks": [
      {
        id: "t1",
        data: {
          title: "Napraw ] i :: błąd",
          link: "https://x.y/?q=[1]&r=a::b",
          description: "linia 1\nlinia 2",
          status: "in_progress",
          due_date: "2026-11-20",
          priority: 2,
          order: 1.5,
        },
      },
      { id: "t2", data: { status: "done", title: "Zrobione" } },
      { id: "t3", data: { status: "archived", title: "Stare" } },
      { id: "t4", data: { title: "", status: "todo" } },
    ],
    "users/u1/resources": [
      {
        id: "r1",
        data: {
          title: "Doc: cz. 1",
          url: "https://example.com/a::b",
          description: "opis\nwielolinijkowy",
          tags: ["a", "b: c"],
          isFavorite: true,
          createdAt: ts("2026-06-01T08:00:00.000Z"),
          updatedAt: ts("2026-06-02T08:00:00.000Z"),
        },
      },
    ],
    "users/u1/user_tags": [
      { id: "g1", data: { tag: "pilne", title: "Pilne", color: "#ff0000" } },
      { id: "g2", data: { tag: "yes", title: "Tak" } },
    ],
    "users/u1/task_templates": [
      { id: "m1", data: { label: "Szablon", title: "Tytuł: [x]", link: "" } },
    ],
    "users/u1/calendar_events": [
      { id: "e1", data: { title: "Spotkanie" } },
      { id: "e2", data: { title: "Telefon" } },
    ],
    "users/u2/notes": [{ id: "x1", data: { title: "Cudza", content: "<p>inne konto</p>" } }],
  };
}
