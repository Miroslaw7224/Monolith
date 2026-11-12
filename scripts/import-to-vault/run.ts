import { convertDump } from "./records";
import { buildPlan } from "./plan";
import { DumpError, readDump } from "./read-dump";
import { formatScreenReport, writeDetailedReport } from "./report";
import type { RunReport, TypeCount } from "./report";
import { verifyVault } from "./verify";
import { PathOutsideVaultError, applyPlan, createVaultView, resolveInsideVault } from "./write";
import { EXIT, HANDLED_TYPES } from "./types";
import type { Converted, DumpData, HandledType, PlanResult } from "./types";

export type RunOptions = {
  dumpDir: string;
  vaultRoot: string;
  write: boolean;
  uid?: string;
  now?: Date;
};

export type RunResult = { exitCode: number; screen: string };

const CONVERTED_KEY: Record<HandledType, keyof Converted> = {
  notes: "notes",
  tasks: "tasks",
  resources: "resources",
  user_tags: "tags",
  task_templates: "templates",
};

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function failure(exitCode: number, text: string): RunResult {
  return { exitCode, screen: `BŁĄD: ${text}\n` };
}

function buildCounts(dump: DumpData, converted: Converted): Record<HandledType, TypeCount> {
  const counts = {} as Record<HandledType, TypeCount>;
  for (const type of HANDLED_TYPES) {
    const skipped = dump.skipped
      .filter((group) => group.type === type)
      .reduce((sum, group) => sum + group.count, 0);
    counts[type] = {
      dump: dump.rows[type].length + skipped,
      written: (converted[CONVERTED_KEY[type]] as unknown[]).length,
      skipped,
    };
  }
  return counts;
}

function balanceProblems(dump: DumpData, converted: Converted): string[] {
  const problems: string[] = [];
  for (const type of HANDLED_TYPES) {
    const expected = dump.rows[type].length;
    const got = (converted[CONVERTED_KEY[type]] as unknown[]).length;
    if (expected !== got) {
      problems.push(`bilans ${type}: w zrzucie ${expected}, po konwersji ${got}`);
    }
  }
  return problems;
}

function countActions(plan: PlanResult): RunReport["fileActions"] {
  const actions = { create: 0, update: 0, unchanged: 0 };
  for (const file of plan.files) actions[file.action] += 1;
  return actions;
}

export function runImport(opts: RunOptions): RunResult {
  const now = opts.now ?? new Date();

  let dump: DumpData;
  try {
    dump = readDump(opts.dumpDir, opts.uid);
  } catch (error) {
    if (error instanceof DumpError) return failure(EXIT.DUMP, error.message);
    throw error;
  }

  const converted = convertDump(dump);

  let plan: PlanResult;
  try {
    // Sprawdza też sam root (błąd zwykły, nie PathOutsideVaultError).
    resolveInsideVault(opts.vaultRoot, "Notes");
    plan = buildPlan(converted, createVaultView(opts.vaultRoot));
    for (const file of plan.files) resolveInsideVault(opts.vaultRoot, file.relPath);
  } catch (error) {
    if (error instanceof PathOutsideVaultError) return failure(EXIT.PATH, error.message);
    return failure(EXIT.USAGE, message(error));
  }

  const report: RunReport = {
    mode: opts.write ? "write" : "dry-run",
    uid: dump.uid,
    counts: buildCounts(dump, converted),
    outOfScope: dump.skipped.filter((group) => group.type === null),
    fileActions: countActions(plan),
    warnings: [...converted.warnings, ...plan.warnings],
    noteLosses: plan.noteLosses,
    verify: { ran: false, ok: true, problems: [] },
    noteTitles: Object.fromEntries(converted.notes.map((note) => [note.id, note.title])),
  };

  let exitCode: number = EXIT.OK;

  const balance = balanceProblems(dump, converted);
  if (balance.length > 0) {
    report.verify = { ran: false, ok: false, problems: balance };
    exitCode = EXIT.VERIFY;
  } else if (opts.write) {
    try {
      applyPlan(opts.vaultRoot, plan.files);
    } catch (error) {
      if (error instanceof PathOutsideVaultError) return failure(EXIT.PATH, error.message);
      throw error;
    }
    const result = verifyVault(converted, plan, createVaultView(opts.vaultRoot));
    report.verify = { ran: true, ok: result.ok, problems: result.problems };
    if (!result.ok) exitCode = EXIT.VERIFY;
  }

  const reportFile = writeDetailedReport(dump.dumpDir, report, now);
  const screen = `${formatScreenReport(report)}\nraport szczegółowy: ${reportFile}\n`;
  return { exitCode, screen };
}
