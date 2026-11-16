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

/**
 * Commity (bez merge'y, lokalne gałęzie, bez duplikatów) pogrupowane po dniu zatwierdzenia (czas
 * lokalny) w zakresie `from`–`to` włącznie (`RRRR-MM-DD`). Dni bez commitów nie występują w wyniku.
 */
export function commitsByDay(
  repoDir: string,
  from: string,
  to: string
): { ok: true; days: Record<string, number> } | { ok: false } {
  if (!DAY_RE.test(from)) throw new Error(`git: zła data (oczekiwano RRRR-MM-DD): ${from}`);
  if (!DAY_RE.test(to)) throw new Error(`git: zła data (oczekiwano RRRR-MM-DD): ${to}`);
  if (from > to) throw new Error(`git: zły zakres dat: ${from} > ${to}`);
  const res = execGit(repoDir, [
    "log",
    "--branches",
    "--no-merges",
    "--date=format-local:%Y-%m-%d",
    "--format=%H %cd",
    `--since=${from}T00:00:00`,
    `--until=${to}T23:59:59`,
  ]);
  if (res.status !== 0) return { ok: false };
  const seen = new Set<string>();
  const days: Record<string, number> = {};
  for (const line of res.stdout.split("\n")) {
    const [hash, day] = line.trim().split(" ");
    if (!hash || !day || seen.has(hash)) continue;
    seen.add(hash);
    days[day] = (days[day] ?? 0) + 1;
  }
  return { ok: true, days };
}

/**
 * Tematy commitów (bez merge'y, lokalne gałęzie, bez duplikatów, najnowsze pierwsze) w zakresie
 * `from`–`to` włącznie (`RRRR-MM-DD`, czas lokalny). Zły format daty rzuca, jak w `commitsByDay`.
 */
export function commitSubjects(
  repoDir: string,
  from: string,
  to: string
): { ok: true; subjects: string[] } | { ok: false } {
  if (!DAY_RE.test(from)) throw new Error(`git: zła data (oczekiwano RRRR-MM-DD): ${from}`);
  if (!DAY_RE.test(to)) throw new Error(`git: zła data (oczekiwano RRRR-MM-DD): ${to}`);
  if (from > to) throw new Error(`git: zły zakres dat: ${from} > ${to}`);
  const res = execGit(repoDir, [
    "log",
    "--branches",
    "--no-merges",
    "--format=%H%x09%s",
    `--since=${from}T00:00:00`,
    `--until=${to}T23:59:59`,
  ]);
  if (res.status !== 0) return { ok: false };
  const seen = new Set<string>();
  const subjects: string[] = [];
  for (const line of res.stdout.split("\n")) {
    const [hash, ...rest] = line.split("\t");
    const subject = rest.join("\t").trim();
    if (!hash || seen.has(hash)) continue;
    seen.add(hash);
    if (subject !== "") subjects.push(subject);
  }
  return { ok: true, subjects };
}

const PR_MERGE = /^Merge pull request #\d+/;
const PR_SQUASH = /\(#\d+\)\s*$/;

/**
 * Zmergowane pull requesty pogrupowane po dniu zatwierdzenia (czas lokalny) w zakresie `from`–`to`.
 * Rozpoznaje je po temacie commitu: „Merge pull request #N …” (merge) albo „… (#N)” (squash/rebase).
 * Widzi tylko to, co jest w lokalnych gałęziach (po `git pull`); otwartych PR git nie zna.
 */
export function mergedPrsByDay(
  repoDir: string,
  from: string,
  to: string
): { ok: true; prs: Record<string, number> } | { ok: false } {
  if (!DAY_RE.test(from)) throw new Error(`git: zła data (oczekiwano RRRR-MM-DD): ${from}`);
  if (!DAY_RE.test(to)) throw new Error(`git: zła data (oczekiwano RRRR-MM-DD): ${to}`);
  if (from > to) throw new Error(`git: zły zakres dat: ${from} > ${to}`);
  const res = execGit(repoDir, [
    "log",
    "--branches",
    "--date=format-local:%Y-%m-%d",
    "--format=%H%x09%cd%x09%s",
    `--since=${from}T00:00:00`,
    `--until=${to}T23:59:59`,
  ]);
  if (res.status !== 0) return { ok: false };
  const seen = new Set<string>();
  const prs: Record<string, number> = {};
  for (const line of res.stdout.split("\n")) {
    const [hash, day, ...rest] = line.split("\t");
    const subject = rest.join("\t");
    if (!hash || !day || seen.has(hash)) continue;
    if (!PR_MERGE.test(subject) && !PR_SQUASH.test(subject)) continue;
    seen.add(hash);
    prs[day] = (prs[day] ?? 0) + 1;
  }
  return { ok: true, prs };
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

const SHA_RE = /^[0-9a-f]{7,40}$/;

/** Sha commita (7–40 znaków szesnastkowych) w małych literach; `null`, gdy to coś innego (np. opcja gita, nazwa gałęzi). */
export function normalizeSha(raw: string): string | null {
  const sha = raw.trim().toLowerCase();
  return SHA_RE.test(sha) ? sha : null;
}

/** Pełny sha HEAD; `ok: false` dla repo bez commitów i błędu gita. */
export function headSha(repoDir: string): { ok: true; sha: string } | { ok: false } {
  const res = execGit(repoDir, ["rev-parse", "--verify", "--quiet", "HEAD"]);
  const sha = res.stdout.trim();
  return res.status === 0 && SHA_RE.test(sha) ? { ok: true, sha } : { ok: false };
}

export type RelationToHead =
  | { kind: "ancestor"; ahead: number } // ahead = 0: sha jest równy HEAD
  | { kind: "diverged" } // obiekt istnieje, ale nie jest przodkiem HEAD (inna gałąź, amend)
  | { kind: "missing" } // brak obiektu (rebase, force-push, shallow clone) albo repo bez HEAD
  | { kind: "error" }; // niepoprawny sha, git niedostępny, limit czasu

function countCommits(repoDir: string, range: string): number | null {
  const res = execGit(repoDir, ["rev-list", "--count", range]);
  if (res.status !== 0) return null;
  const n = Number.parseInt(res.stdout.trim(), 10);
  return Number.isNaN(n) ? null : n;
}

/**
 * Relacja commita `rawSha` do HEAD. `rev-list --count sha..HEAD` samo nie wystarcza: dla sha spoza
 * historii HEAD zwraca dodatni licznik bez błędu, więc najpierw `merge-base --is-ancestor`
 * (0 = przodek, 1 = nie, 128 = brak obiektu). Niepoprawny sha nie trafia do gita.
 */
export function relationToHead(repoDir: string, rawSha: string): RelationToHead {
  const sha = normalizeSha(rawSha);
  if (sha === null) return { kind: "error" };
  const anc = execGit(repoDir, ["merge-base", "--is-ancestor", sha, "HEAD"]);
  if (anc.status === 1) return { kind: "diverged" };
  if (anc.status === 128) return { kind: "missing" };
  if (anc.status !== 0) return { kind: "error" };
  const ahead = countCommits(repoDir, `${sha}..HEAD`);
  return ahead === null ? { kind: "error" } : { kind: "ancestor", ahead };
}

/**
 * Do `limit` ostatnich commitów (`<abbrev> <temat>`, najnowszy pierwszy) w zakresie `rawSha..HEAD`
 * oraz ich pełna liczba w zakresie. `rawSha: null` = od początku historii.
 */
export function commitsInRange(
  repoDir: string,
  rawSha: string | null,
  limit: number
): { ok: true; lines: string[]; total: number } | { ok: false } {
  let range = "HEAD";
  if (rawSha !== null) {
    const sha = normalizeSha(rawSha);
    if (sha === null) return { ok: false };
    range = `${sha}..HEAD`;
  }
  const n = Math.max(1, Math.floor(limit));
  const log = execGit(repoDir, ["log", "--oneline", "--no-decorate", "-n", String(n), range, "--"]);
  const total = countCommits(repoDir, range);
  if (log.status !== 0 || total === null) return { ok: false };
  return { ok: true, lines: log.stdout.split("\n").filter((l) => l.trim() !== ""), total };
}

/** `git diff --stat rawSha..HEAD` (zmiany w commitach, bez working tree). */
export function diffStatInRange(
  repoDir: string,
  rawSha: string
): { ok: true; stat: string } | { ok: false } {
  const sha = normalizeSha(rawSha);
  if (sha === null) return { ok: false };
  const res = execGit(repoDir, ["diff", "--stat", "--no-ext-diff", `${sha}..HEAD`, "--"]);
  return res.status === 0 ? { ok: true, stat: res.stdout.trimEnd() } : { ok: false };
}
