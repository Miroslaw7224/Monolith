import fs from "node:fs";
import path from "node:path";
import type { Firestore } from "firebase-admin/firestore";
import { countDocs, discoverCollections } from "./discover";
import { describeFile } from "./exporter";
import { computeStatus, isKnownCollection, readManifest } from "./manifest";
import { MANIFEST_FILE } from "./types";

export type VerifyResult = { ok: boolean; problems: string[] };

/**
 * Niezależna weryfikacja istniejącego zrzutu: pliki vs manifest (sha256, linie)
 * oraz manifest vs bieżący stan Firestore (liczności, nowe kolekcje).
 */
export async function verifyDump(dir: string, db: Firestore): Promise<VerifyResult> {
  let manifest;
  try {
    manifest = readManifest(dir);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { ok: false, problems: [`nie można wczytać ${MANIFEST_FILE}: ${reason}`] };
  }

  const problems: string[] = [];
  // Status liczymy od nowa z bieżącej listy znanych kolekcji: zapisany w manifeście mógł
  // powstać, zanim kolekcja trafiła na listę (np. historyczne knowledgeNodes).
  const status = computeStatus(
    manifest.collections.map((e) => ({ ...e, known: isKnownCollection(e.path) }))
  );
  if (status !== "ok") {
    problems.push(`status eksportu to "${status}", a nie "ok"`);
  }

  const { collections } = await discoverCollections(db, { uid: manifest.uid ?? undefined });

  for (const entry of manifest.collections) {
    if (!fs.existsSync(path.join(dir, entry.file))) {
      problems.push(`brak pliku ${entry.file}`);
      continue;
    }
    const actual = describeFile(entry.path, dir, entry.file);
    if (actual.sha256 !== entry.sha256) {
      problems.push(`${entry.file}: sha256 różni się od manifestu`);
    }
    if (actual.lines !== entry.lines) {
      problems.push(`${entry.file}: ${actual.lines} linii w pliku, ${entry.lines} w manifeście`);
    }
    const col = collections.find((c) => c.path === entry.path);
    const now = col ? await countDocs(col) : 0;
    if (now !== entry.before) {
      problems.push(
        `${entry.path}: w Firestore jest teraz ${now} dok., a w eksporcie było ${entry.before}`
      );
    }
  }

  for (const col of collections) {
    if (!manifest.collections.some((e) => e.path === col.path)) {
      problems.push(`nowa kolekcja ${col.path} (nie ma jej w eksporcie)`);
    }
  }

  return { ok: problems.length === 0, problems };
}
