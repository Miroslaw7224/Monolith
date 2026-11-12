import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { HANDLED_TYPES } from "./types";
import type { DumpData, DumpRow, HandledType, SkippedGroup } from "./types";

/** Błąd zrzutu (manifest, status, SHA, struktura). Komunikaty nie zawierają treści rekordów. */
export class DumpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DumpError";
  }
}

type ManifestEntry = { path: string; file: string; lines: number; sha256: string };

const OUT_OF_SCOPE = "poza zakresem etapu 0 (§1.1)";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readManifest(dumpDir: string): {
  entries: ManifestEntry[];
  uid: string | null;
  exportedAt: string;
} {
  const manifestPath = path.join(dumpDir, "manifest.json");
  let text: string;
  try {
    text = fs.readFileSync(manifestPath, "utf8");
  } catch {
    throw new DumpError(`Brak pliku manifest.json w katalogu zrzutu: ${dumpDir}`);
  }
  let manifest: unknown;
  try {
    manifest = JSON.parse(text);
  } catch {
    throw new DumpError("manifest.json nie jest poprawnym JSON-em");
  }
  if (!isObject(manifest)) throw new DumpError("manifest.json ma nieprawidłową strukturę");
  if (manifest.version !== 1) {
    throw new DumpError(`manifest.json: nieobsługiwana wersja (${String(manifest.version)})`);
  }
  if (manifest.tool !== "export-firestore") {
    throw new DumpError("manifest.json: zrzut nie pochodzi z narzędzia export-firestore");
  }
  if (manifest.status !== "ok") {
    throw new DumpError(
      `Zrzut nie ma statusu "ok" (status: ${String(manifest.status)}); popraw eksport przed importem`
    );
  }
  if (!Array.isArray(manifest.collections)) {
    throw new DumpError("manifest.json: brak listy collections");
  }
  const entries: ManifestEntry[] = manifest.collections.map((raw, index) => {
    if (
      !isObject(raw) ||
      typeof raw.path !== "string" ||
      typeof raw.file !== "string" ||
      typeof raw.sha256 !== "string" ||
      typeof raw.lines !== "number"
    ) {
      throw new DumpError(`manifest.json: nieprawidłowy wpis collections[${index}]`);
    }
    return { path: raw.path, file: raw.file, lines: raw.lines, sha256: raw.sha256 };
  });
  return {
    entries,
    uid: typeof manifest.uid === "string" && manifest.uid !== "" ? manifest.uid : null,
    exportedAt: typeof manifest.exportedAt === "string" ? manifest.exportedAt : "",
  };
}

function resolveInside(dumpDir: string, file: string): string {
  if (path.isAbsolute(file)) {
    throw new DumpError(`Ścieżka pliku poza katalogiem zrzutu (absolutna): ${file}`);
  }
  const root = path.resolve(dumpDir);
  const target = path.resolve(root, file);
  const relative = path.relative(root, target);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new DumpError(`Ścieżka pliku poza katalogiem zrzutu: ${file}`);
  }
  return target;
}

/** Wczytuje i weryfikuje plik kolekcji (SHA-256, liczba linii, kształt wierszy). */
function readCollectionFile(dumpDir: string, entry: ManifestEntry): DumpRow[] {
  const target = resolveInside(dumpDir, entry.file);
  let buffer: Buffer;
  try {
    buffer = fs.readFileSync(target);
  } catch {
    throw new DumpError(`Brak pliku zrzutu: ${entry.file}`);
  }
  const sha = crypto.createHash("sha256").update(buffer).digest("hex");
  if (sha !== entry.sha256) {
    throw new DumpError(`Suma SHA-256 pliku ${entry.file} nie zgadza się z manifestem`);
  }

  const rows: DumpRow[] = [];
  const lines = buffer.toString("utf8").split("\n");
  lines.forEach((line, index) => {
    if (line.trim() === "") return;
    const where = `${entry.file}:${index + 1}`;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      throw new DumpError(`${where}: linia nie jest poprawnym JSON-em`);
    }
    if (
      !isObject(parsed) ||
      typeof parsed._id !== "string" ||
      typeof parsed._path !== "string" ||
      !isObject(parsed.data)
    ) {
      throw new DumpError(`${where}: nieprawidłowy kształt wiersza (oczekiwano _id, _path, data)`);
    }
    if (parsed._path !== `${entry.path}/${parsed._id}`) {
      throw new DumpError(`${where}: _path nie zgadza się z kolekcją ${entry.path}`);
    }
    rows.push({ id: parsed._id, path: parsed._path, data: parsed.data });
  });

  if (rows.length !== entry.lines) {
    throw new DumpError(
      `${entry.file}: liczba linii (${rows.length}) różni się od manifestu (${entry.lines})`
    );
  }
  return rows;
}

function handledType(segments: string[]): { uid: string; type: HandledType } | null {
  if (segments.length !== 3 || segments[0] !== "users") return null;
  const type = (HANDLED_TYPES as readonly string[]).includes(segments[2])
    ? (segments[2] as HandledType)
    : null;
  return type ? { uid: segments[1], type } : null;
}

export function readDump(dumpDir: string, uidOverride?: string): DumpData {
  const { entries, uid: manifestUid, exportedAt } = readManifest(dumpDir);

  const loaded = entries.map((entry) => ({
    entry,
    rows: readCollectionFile(dumpDir, entry),
    handled: handledType(entry.path.split("/")),
  }));

  const uids = [...new Set(loaded.flatMap((l) => (l.handled ? [l.handled.uid] : [])))];
  if (uids.length === 0) {
    throw new DumpError("Zrzut nie zawiera żadnej obsługiwanej kolekcji (users/<uid>/<typ>)");
  }

  let uid: string;
  if (uidOverride !== undefined) {
    if (!uids.includes(uidOverride)) {
      throw new DumpError(
        `Konto "${uidOverride}" nie występuje w zrzucie (dostępne: ${uids.join(", ")})`
      );
    }
    uid = uidOverride;
  } else if (manifestUid !== null) {
    if (!uids.includes(manifestUid)) {
      throw new DumpError(
        `Konto "${manifestUid}" z manifestu nie ma obsługiwanych kolekcji (dostępne: ${uids.join(", ")})`
      );
    }
    uid = manifestUid;
  } else if (uids.length === 1) {
    uid = uids[0];
  } else {
    throw new DumpError(`Zrzut zawiera kilka kont (${uids.join(", ")}); wskaż jedno przez --uid`);
  }

  const rows: Record<HandledType, DumpRow[]> = {
    notes: [],
    tasks: [],
    resources: [],
    user_tags: [],
    task_templates: [],
  };
  const skipped: SkippedGroup[] = [];

  for (const { entry, rows: collectionRows, handled } of loaded) {
    if (handled && handled.uid === uid) {
      rows[handled.type].push(...collectionRows);
    } else if (handled) {
      skipped.push({
        path: entry.path,
        count: collectionRows.length,
        reason: "inne konto",
        type: handled.type,
      });
    } else {
      skipped.push({
        path: entry.path,
        count: collectionRows.length,
        reason: entry.path.startsWith("users/") ? OUT_OF_SCOPE : "kolekcja główna, poza zakresem",
        type: null,
      });
    }
  }

  return { dumpDir, uid, exportedAt, rows, skipped };
}
