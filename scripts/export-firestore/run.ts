import type { Auth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";
import { exportAuthUsers } from "./auth-export";
import { countDocs, discoverCollections } from "./discover";
import { exportCollection, type ExportedCollection } from "./exporter";
import { prepareOutDir } from "./guard";
import { computeStatus, isKnownCollection, writeManifest } from "./manifest";
import type { CollectionEntry, Manifest } from "./types";

export type RunExportParams = {
  db: Firestore;
  auth?: Auth;
  outDir: string;
  pageSize: number;
  resume: boolean;
  now?: Date;
  log?: (message: string) => void;
};

export async function runExport(params: RunExportParams): Promise<Manifest> {
  const log = params.log ?? (() => {});
  prepareOutDir(params.outDir, { resume: params.resume });

  const { collections, ghosts } = await discoverCollections(params.db);
  log(`Wykryto kolekcji: ${collections.length}, dokumentów-widm: ${ghosts.length}`);

  const before: Record<string, number> = {};
  for (const col of collections) before[col.path] = await countDocs(col);

  const exported: ExportedCollection[] = [];
  for (const col of collections) {
    log(`Eksport ${col.path} (${before[col.path]} dok.)`);
    exported.push(
      await exportCollection(col, params.outDir, {
        pageSize: params.pageSize,
        resume: params.resume,
      })
    );
  }

  const entries: CollectionEntry[] = [];
  for (const item of exported) {
    const col = collections.find((c) => c.path === item.path);
    if (!col) throw new Error(`Brak kolekcji ${item.path}`);
    entries.push({
      path: item.path,
      file: item.file,
      known: isKnownCollection(item.path),
      before: before[item.path],
      lines: item.lines,
      after: await countDocs(col),
      sha256: item.sha256,
    });
  }

  const auth = params.auth
    ? await exportAuthUsers(params.auth, params.outDir)
    : ({ skipped: true } as const);

  const manifest: Manifest = {
    version: 1,
    tool: "export-firestore",
    exportedAt: (params.now ?? new Date()).toISOString(),
    projectId: process.env.FIREBASE_PROJECT_ID ?? null,
    pageSize: params.pageSize,
    status: computeStatus(entries),
    collections: entries,
    ghosts,
    auth,
    totals: {
      collections: entries.length,
      documents: entries.reduce((sum, e) => sum + e.lines, 0),
    },
  };
  writeManifest(params.outDir, manifest);
  return manifest;
}
