import fs from "node:fs";
import path from "node:path";
import { HANDLED_TYPES } from "./types";
import type { HandledType, NoteLoss, SkippedGroup } from "./types";

export type TypeCount = { dump: number; written: number; skipped: number };
export type RunReport = {
  mode: "dry-run" | "write";
  uid: string;
  counts: Record<HandledType, TypeCount>;
  outOfScope: SkippedGroup[]; // skipped z type === null
  fileActions: { create: number; update: number; unchanged: number };
  warnings: string[];
  noteLosses: NoteLoss[];
  verify: { ran: boolean; ok: boolean; problems: string[] };
  /** Tylko do raportu szczegółowego: tytuły notatek po id. */
  noteTitles: Record<string, string>;
};

/** Raport na ekran: liczby, ścieżki i powody. Bez tytułów, treści i HTML notatek. */
export function formatScreenReport(report: RunReport): string {
  const lines: string[] = [];
  lines.push(report.mode === "dry-run" ? "DRY-RUN: nic nie zapisano" : "ZAPIS");
  lines.push(`konto: ${report.uid}`);
  lines.push("");
  lines.push("typ | zrzut | zapisane | pominięte");
  for (const type of HANDLED_TYPES) {
    const c = report.counts[type];
    lines.push(`${type} | ${c.dump} | ${c.written} | ${c.skipped}`);
  }

  lines.push("");
  lines.push("poza zakresem:");
  if (report.outOfScope.length === 0) {
    lines.push("  (brak)");
  } else {
    for (const g of report.outOfScope) {
      lines.push(`  ${g.path}: ${g.count} (${g.reason})`);
    }
  }

  lines.push("");
  lines.push(
    `pliki: create ${report.fileActions.create}, update ${report.fileActions.update}, unchanged ${report.fileActions.unchanged}`
  );

  lines.push("");
  lines.push("ostrzeżenia:");
  if (report.warnings.length === 0) {
    lines.push("  (brak)");
  } else {
    for (const w of report.warnings) lines.push(`  ${w}`);
  }

  lines.push("");
  lines.push("notatki ze stratami konwersji:");
  if (report.noteLosses.length === 0) {
    lines.push("  (brak)");
  } else {
    for (const n of report.noteLosses) {
      lines.push(`  ${n.relPath} (${n.id}): ${n.losses.join(", ")}`);
    }
  }

  lines.push("");
  if (!report.verify.ran) {
    lines.push("round-trip: nie uruchamiano (dry-run)");
  } else if (report.verify.ok) {
    lines.push("round-trip: OK");
  } else {
    lines.push("round-trip: NIEZGODNY");
    for (const p of report.verify.problems) lines.push(`  ${p}`);
  }

  return lines.join("\n") + "\n";
}

function stamp(now: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${now.getUTCFullYear()}-${p(now.getUTCMonth() + 1)}-${p(now.getUTCDate())}` +
    `T${p(now.getUTCHours())}${p(now.getUTCMinutes())}${p(now.getUTCSeconds())}`
  );
}

/** Raport szczegółowy (z tytułami notatek) obok zrzutu, tryb 0600. Zwraca ścieżkę pliku. */
export function writeDetailedReport(dumpDir: string, report: RunReport, now: Date): string {
  if ((fs.statSync(dumpDir).mode & 0o077) !== 0) {
    report.warnings.push(
      `Katalog zrzutu ma zbyt szerokie uprawnienia (grupa lub inni mają dostęp): ${dumpDir}`
    );
  }
  const file = path.join(dumpDir, `import-report-${stamp(now)}.json`);
  fs.writeFileSync(file, JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
  return file;
}
