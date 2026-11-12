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
  /** Ogranicza eksport do users/<uid>/… */
  uid?: string;
  /** Ogranicza eksport do kolekcji o tych nazwach. */
  only?: string[];
  now?: Date;
  log?: (message: string) => void;
};

export async function runExport(params: RunExportParams): Promise<Manifest> {
  const log = params.log ?? (() => {});
  prepareOutDir(params.outDir, { resume: params.resume });

  const { collections, ghosts } = await discoverCollections(params.db, {
    uid: params.uid,
    only: params.only,
  });
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
    ? await exportAuthUsers(params.auth, params.outDir, { uid: params.uid })
    : ({ skipped: true } as const);

  const manifest: Manifest = {
    version: 1,
    tool: "export-firestore",
    exportedAt: (params.now ?? new Date()).toISOString(),
    projectId: process.env.FIREBASE_PROJECT_ID ?? null,
    pageSize: params.pageSize,
    uid: params.uid ?? null,
    only: params.only ?? null,
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

export type CountRow = { path: string; count: number; known: boolean };

export type CountReport = {
  rows: CountRow[];
  ghosts: string[];
  total: number;
  /** Discovery czyta listę dokumentów, eksport czyta je drugi raz: ~2 odczyty na dokument. */
  estimatedReads: number;
};

export async function countReport(db: Firestore): Promise<CountReport> {
  const { collections, ghosts } = await discoverCollections(db);
  const rows: CountRow[] = [];
  for (const col of collections) {
    rows.push({ path: col.path, count: await countDocs(col), known: isKnownCollection(col.path) });
  }
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return { rows, ghosts, total, estimatedReads: total * 2 };
}

const READS_WARNING_THRESHOLD = 40_000;

export function formatCountReport(report: CountReport): string {
  const width = Math.max(10, ...report.rows.map((r) => r.path.length));
  const lines = ["Kolekcje:"];
  for (const row of report.rows) {
    const flag = row.known ? "" : "   <-- NIEZNANA kolekcja";
    lines.push(`  ${row.path.padEnd(width)}  ${String(row.count).padStart(7)}${flag}`);
  }
  if (report.ghosts.length > 0) {
    lines.push("", "Dokumenty-widma (nie istnieją, ale mają podkolekcje):");
    for (const ghost of report.ghosts) lines.push(`  ${ghost}`);
  }
  lines.push("", `Razem dokumentów: ${report.total}`);
  lines.push(`Szacowana liczba odczytów przy pełnym eksporcie: ${report.estimatedReads}`);
  if (report.estimatedReads > READS_WARNING_THRESHOLD) {
    lines.push(
      "UWAGA: blisko dziennego limitu 50 000 odczytów. Eksport może wymagać --resume następnego dnia."
    );
  }
  return lines.join("\n");
}
