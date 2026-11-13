import { execFileSync } from "node:child_process";
import path from "node:path";

export type GitCommand = "status" | "log" | "diff";
export type GitSnapshot = { status: string; log: string; diffStat: string };
export type SnapshotResult =
  | { ok: true; snapshot: GitSnapshot }
  | { ok: false; reason: "git-error" };

/** Konfiguracja obcego repo nie może wykonać kodu: bez pagera, fsmonitora i hooków. */
const GIT_PREFIX = ["--no-pager", "-c", "core.fsmonitor=false", "-c", "core.hooksPath=/dev/null"];

/** Biała lista: jedyne wywołania gita, jakie ta warstwa potrafi wykonać (tylko odczyt). */
const COMMANDS: Record<GitCommand, string[]> = {
  status: ["status", "--short", "--branch"],
  log: ["log", "-5", "--oneline", "--no-decorate"],
  diff: ["diff", "--stat", "--no-ext-diff"],
};

/** Wspólne wykonanie gita (bez powłoki); `args` pochodzą wyłącznie z białej listy lub z funkcji tego pliku. */
function execGit(repoDir: string, args: string[]): { status: number; stdout: string } {
  try {
    const stdout = execFileSync("git", [...GIT_PREFIX, ...args], {
      cwd: repoDir,
      encoding: "utf8",
      timeout: 5000,
      maxBuffer: 256 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
      env: {
        ...process.env,
        GIT_OPTIONAL_LOCKS: "0",
        GIT_TERMINAL_PROMPT: "0",
        // git nie szuka repozytorium w katalogach nadrzędnych katalogu projektu
        GIT_CEILING_DIRECTORIES: path.dirname(repoDir),
      },
    });
    return { status: 0, stdout };
  } catch (err) {
    const status = (err as { status?: number | null }).status;
    // status 0 w `catch` (np. przekroczony maxBuffer) też jest błędem
    return { status: typeof status === "number" && status !== 0 ? status : -1, stdout: "" };
  }
}

/**
 * Uruchamia whitelistowane `git <polecenie>` w `repoDir` (bez powłoki). Status różny od 0 oznacza
 * błąd, limit czasu albo brak gita. `repoDir` ma pochodzić z `resolveRepoPath`.
 */
export function runGit(repoDir: string, command: GitCommand): { status: number; stdout: string } {
  const args = COMMANDS[command];
  if (!args) throw new Error(`git: polecenie spoza białej listy: ${String(command)}`);
  return execGit(repoDir, args);
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Liczba commitów (bez merge'y) na lokalnych gałęziach od początku dnia `day` (`RRRR-MM-DD`, czas
 * lokalny). Zły format daty rzuca: do gita nie trafia nic poza zwalidowaną datą.
 */
export function commitsSince(
  repoDir: string,
  day: string
): { ok: true; count: number } | { ok: false } {
  if (!DAY_RE.test(day)) throw new Error(`git: zła data (oczekiwano RRRR-MM-DD): ${day}`);
  const res = execGit(repoDir, [
    "log",
    "--branches",
    "--no-merges",
    "--format=%H",
    `--since=${day}T00:00:00`,
  ]);
  if (res.status !== 0) {
    // repo bez commitów kończy `log --branches` sukcesem; błąd = brak repo/gita
    return { ok: false };
  }
  const hashes = res.stdout.split("\n").filter((l) => l.trim() !== "");
  return { ok: true, count: new Set(hashes).size };
}

/** Nazwa bieżącej gałęzi; `null` dla odłączonego HEAD, repo bez commitów i błędu gita. */
export function currentBranch(repoDir: string): string | null {
  const res = execGit(repoDir, ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (res.status !== 0) return null;
  const name = res.stdout.trim();
  return name === "" || name === "HEAD" ? null : name;
}

/** Status, 5 ostatnich commitów i `diff --stat`; błąd `status` = `git-error`, błąd `log`/`diff` = puste pole. */
export function snapshotRepo(repoDir: string): SnapshotResult {
  const status = runGit(repoDir, "status");
  if (status.status !== 0) return { ok: false, reason: "git-error" };
  const log = runGit(repoDir, "log");
  const diff = runGit(repoDir, "diff");
  return {
    ok: true,
    snapshot: {
      status: status.stdout.trimEnd(),
      log: log.status === 0 ? log.stdout.trimEnd() : "",
      diffStat: diff.status === 0 ? diff.stdout.trimEnd() : "",
    },
  };
}
