import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { FieldPath, type CollectionReference } from "firebase-admin/firestore";
import { encodeValue } from "./serialize";

export type ExportedCollection = {
  path: string;
  file: string;
  lines: number;
  sha256: string;
};

export type ExportOptions = { pageSize: number; resume: boolean };

/** Ścieżka pliku zrzutu dla kolekcji (spec 4.2). */
export function fileFor(collectionPath: string): string {
  const segments = collectionPath.split("/");
  if (segments[0] === "users" && segments.length >= 3) return `${collectionPath}.jsonl`;
  return `root/${collectionPath}.jsonl`;
}

/**
 * Po przerwanym zapisie odcina plik do ostatniej kompletnej linii.
 * Zwraca id ostatniego dokumentu (kursor wznowienia) i liczbę zachowanych linii.
 */
export function truncateToLastFullLine(partPath: string): { lastId: string | null; lines: number } {
  const text = fs.readFileSync(partPath, "utf8");
  const end = text.lastIndexOf("\n");
  const complete = end === -1 ? "" : text.slice(0, end + 1);
  if (complete.length !== text.length) fs.writeFileSync(partPath, complete, { mode: 0o600 });
  if (complete === "") return { lastId: null, lines: 0 };
  const rows = complete.slice(0, -1).split("\n");
  const last = JSON.parse(rows[rows.length - 1]) as { _id: string };
  return { lastId: last._id, lines: rows.length };
}

export function describeFile(
  collectionPath: string,
  outDir: string,
  rel: string
): ExportedCollection {
  const buffer = fs.readFileSync(path.join(outDir, rel));
  let lines = 0;
  for (const byte of buffer) if (byte === 0x0a) lines += 1;
  return {
    path: collectionPath,
    file: rel,
    lines,
    sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
  };
}

/**
 * Czyta kolekcję stronami (orderBy documentId + startAfter) i zapisuje do <plik>.part,
 * a po zakończeniu zmienia nazwę na <plik>. Istniejący gotowy plik przy --resume jest pomijany.
 */
export async function exportCollection(
  col: CollectionReference,
  outDir: string,
  opts: ExportOptions
): Promise<ExportedCollection> {
  const rel = fileFor(col.path);
  const finalPath = path.join(outDir, rel);
  const partPath = `${finalPath}.part`;
  fs.mkdirSync(path.dirname(finalPath), { recursive: true, mode: 0o700 });

  if (opts.resume && fs.existsSync(finalPath)) return describeFile(col.path, outDir, rel);

  let lastId: string | null = null;
  if (opts.resume && fs.existsSync(partPath)) {
    lastId = truncateToLastFullLine(partPath).lastId;
  } else if (fs.existsSync(partPath)) {
    fs.rmSync(partPath);
  }

  const fd = fs.openSync(partPath, "a", 0o600);
  try {
    for (;;) {
      let query = col.orderBy(FieldPath.documentId()).limit(opts.pageSize);
      if (lastId !== null) query = query.startAfter(lastId);
      const snap = await query.get();
      if (snap.empty) break;
      const chunk = snap.docs
        .map(
          (doc) =>
            JSON.stringify({
              _id: doc.id,
              _path: doc.ref.path,
              data: encodeValue(doc.data(), doc.ref.path),
            }) + "\n"
        )
        .join("");
      fs.writeSync(fd, chunk);
      lastId = snap.docs[snap.docs.length - 1].id;
      if (snap.size < opts.pageSize) break;
    }
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(partPath, finalPath);
  return describeFile(col.path, outDir, rel);
}
