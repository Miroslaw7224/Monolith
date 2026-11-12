import fs from "node:fs";
import path from "node:path";
import {
  KNOWN_COLLECTIONS,
  MANIFEST_FILE,
  type CollectionEntry,
  type Manifest,
  type ManifestStatus,
} from "./types";

export function isKnownCollection(collectionPath: string): boolean {
  const last = collectionPath.split("/").pop() ?? "";
  return (KNOWN_COLLECTIONS as readonly string[]).includes(last);
}

export function computeStatus(entries: CollectionEntry[]): ManifestStatus {
  if (entries.some((e) => !(e.before === e.lines && e.lines === e.after))) return "mismatch";
  if (entries.some((e) => !e.known && e.lines > 0)) return "needs-review";
  return "ok";
}

export function writeManifest(outDir: string, manifest: Manifest): void {
  fs.writeFileSync(path.join(outDir, MANIFEST_FILE), JSON.stringify(manifest, null, 2) + "\n", {
    mode: 0o600,
  });
}

export function readManifest(dir: string): Manifest {
  return JSON.parse(fs.readFileSync(path.join(dir, MANIFEST_FILE), "utf8")) as Manifest;
}
