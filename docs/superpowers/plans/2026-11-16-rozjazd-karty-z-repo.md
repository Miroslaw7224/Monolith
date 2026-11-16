# Rozjazd karty z repozytorium Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplikacja wykrywa, że repozytorium projektu ma commity nowsze niż zapisany w `state.md` sha (`code_commit`), pokazuje to na liście projektów, w teczce i w Kokpicie oraz daje paczkę kontekstu „odśwież kartę" i przycisk „Oznacz jako zaktualizowaną".

**Architecture:** Nowe funkcje tylko do odczytu w `lib/git/project-git.ts` (`headSha`, `relationToHead`, `commitsInRange`, `diffStatInRange`). Kontekst `bc_projects`: `repositories` mapuje git → `CodeSync`, `services` liczy stan (`getProject`, `getCodeSync`, `listCodeSync`) i zapisuje `code_commit` (`markCodeSynced`), `router` dodaje dwie trasy, `context-pack` dostaje rolę `refresh`. `listProjects` zostaje bez gita; UI pobiera mapę stanów osobną trasą.

**Tech Stack:** Next.js 14, TypeScript, zod 4, Vitest (jsdom dla UI, `@vitest-environment node` dla reszty), `tests/unit/helpers/tempGit.ts` (prawdziwe repo git).

**Spec:** `docs/superpowers/specs/2026-11-16-rozjazd-karty-z-repo-design.md`. Odstępstwa od specu wynikające z czytania kodu (naniesione w Tasku 9): (a) `head` w DTO to pełny sha (40 znaków), UI skraca do 7; (b) przycisk bez `commit` w ciele bierze HEAD z chwili kliknięcia (tylko gdy DTO nie ma `head`, czyli `no-baseline`); (c) błąd „sha nie jest przodkiem HEAD" to `DomainError` 422, tak jak inne błędy zapisu w `repositories`; (d) rola `refresh` nie ma osobnego budżetu: ma `rulesMax: 1200`, limity 30 commitów i 40 linii diffu oraz kroki redukcji w `composeContextPack`.

**Zasady repo, o których trzeba pamiętać:**

- `CLAUDE.md`: testy, lint, typecheck i build zlecaj pomocnikowi `cursor` (`scripts/ask-helper.sh --role task --tier light --approve-allowed cursor "…"`); pojedyncze `npx vitest run <plik>` w krokach niżej można odpalić samemu.
- `tests/unit/architecture.static.test.ts` zostaje bez zmian. Jeśli pęknie, napraw kod, nie test.
- Repozytoria projektów i vault: kod tylko do odczytu; zapis wyłącznie `state.md` przez `writeProjectState`.
- Komunikaty commitów kończ linią `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

---

## Task 0: Gałąź robocza

**Files:** brak

- [ ] **Step 1: Utwórz gałąź z gałęzi specu**

```bash
git checkout docs/rozjazd-karty-z-repo-spec
git add docs/superpowers/plans/2026-11-16-rozjazd-karty-z-repo.md
git commit -m "docs(plan): rozjazd karty projektu z repozytorium

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git checkout -b feat/rozjazd-karty-z-repo
```

Expected: `Switched to a new branch 'feat/rozjazd-karty-z-repo'`, `git status` czysty.

---

## Task 1: `lib/git` — odczyt HEAD, relacji sha↔HEAD i zakresu

**Files:**

- Modify: `lib/git/project-git.ts` (dopisz na końcu pliku)
- Test: `tests/unit/lib/git/project-git.range.test.ts` (nowy)

- [ ] **Step 1: Napisz test (czerwony)**

Utwórz `tests/unit/lib/git/project-git.range.test.ts`:

```ts
// @vitest-environment node
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  commitsInRange,
  diffStatInRange,
  headSha,
  normalizeSha,
  relationToHead,
} from "@/lib/git/project-git";
import { setupTempRepos } from "../../helpers/tempGit";

const repos = setupTempRepos();

function git(dir: string, ...args: string[]): string {
  return execFileSync(
    "git",
    ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args],
    { cwd: dir, encoding: "utf8" }
  ).trim();
}

const head = (dir: string) => git(dir, "rev-parse", "HEAD");

/** Repo z commitami c1…cn; zwraca repo i sha po każdym z nich (shas[0] = po c1). */
function history(n: number) {
  const repo = repos.create();
  const shas: string[] = [];
  for (let i = 1; i <= n; i++) {
    repo.write(`f${i}.txt`, `${i}\n`);
    repo.commit(`c${i}`);
    shas.push(head(repo.dir));
  }
  return { repo, shas };
}

describe("normalizeSha", () => {
  it("małe litery i obcięcie spacji", () => {
    expect(normalizeSha(" ABCDEF1 ")).toBe("abcdef1");
  });
  it.each(["abcdef", "--help", "HEAD", "abc123g", "a".repeat(41), ""])("odrzuca %j", (raw) => {
    expect(normalizeSha(raw)).toBeNull();
  });
});

describe("headSha", () => {
  it("zwraca pełny sha HEAD", () => {
    const { repo, shas } = history(2);
    expect(headSha(repo.dir)).toEqual({ ok: true, sha: shas[1] });
  });
  it("repo bez commitów: ok false", () => {
    const repo = repos.create();
    expect(headSha(repo.dir)).toEqual({ ok: false });
  });
});

describe("relationToHead", () => {
  it("przodek: liczba commitów od sha do HEAD", () => {
    const { repo, shas } = history(3);
    expect(relationToHead(repo.dir, shas[0])).toEqual({ kind: "ancestor", ahead: 2 });
  });
  it("sha równy HEAD: ahead 0", () => {
    const { repo, shas } = history(3);
    expect(relationToHead(repo.dir, shas[2])).toEqual({ kind: "ancestor", ahead: 0 });
  });
  it("skrócony sha (7 znaków) i wielkie litery", () => {
    const { repo, shas } = history(3);
    expect(relationToHead(repo.dir, shas[0].slice(0, 7).toUpperCase())).toEqual({
      kind: "ancestor",
      ahead: 2,
    });
  });
  it("commit z innej gałęzi (nie przodek HEAD): diverged", () => {
    const { repo } = history(1);
    git(repo.dir, "checkout", "-q", "-b", "side");
    repo.write("side.txt", "s");
    repo.commit("side");
    const sideSha = head(repo.dir);
    git(repo.dir, "checkout", "-q", "main");
    repo.write("main.txt", "m");
    repo.commit("main2");
    expect(relationToHead(repo.dir, sideSha)).toEqual({ kind: "diverged" });
  });
  it("commit sprzed amend (obiekt jest w repo, nie jest przodkiem): diverged", () => {
    const { repo, shas } = history(2);
    git(repo.dir, "commit", "--amend", "-q", "-m", "c2-amended");
    expect(relationToHead(repo.dir, shas[1])).toEqual({ kind: "diverged" });
  });
  it("sha, którego nie ma w repo: missing", () => {
    const { repo } = history(1);
    expect(relationToHead(repo.dir, "deadbeef".repeat(5))).toEqual({ kind: "missing" });
  });
  it("niepoprawny sha (np. opcja gita): error, a nie missing", () => {
    const { repo } = history(1);
    expect(relationToHead(repo.dir, "--help")).toEqual({ kind: "error" });
    expect(relationToHead(repo.dir, "HEAD")).toEqual({ kind: "error" });
  });
});

describe("commitsInRange", () => {
  it("limit 30 z 32 commitów w zakresie: lines 30, total 32, najnowszy pierwszy", () => {
    const { repo, shas } = history(33);
    const res = commitsInRange(repo.dir, shas[0], 30);
    expect(res.ok).toBe(true);
    if (res.ok === false) return;
    expect(res.lines).toHaveLength(30);
    expect(res.total).toBe(32);
    expect(res.lines[0]).toMatch(/ c33$/);
  }, 30_000);
  it("sha null: ostatnie commity od początku historii", () => {
    const { repo } = history(3);
    const res = commitsInRange(repo.dir, null, 30);
    expect(res).toMatchObject({ ok: true, total: 3 });
  });
  it("niepoprawny sha: ok false", () => {
    const { repo } = history(1);
    expect(commitsInRange(repo.dir, "--help", 30)).toEqual({ ok: false });
  });
});

describe("diffStatInRange", () => {
  it("pliki zmienione w zakresie", () => {
    const { repo, shas } = history(3);
    const res = diffStatInRange(repo.dir, shas[0]);
    expect(res.ok).toBe(true);
    if (res.ok === false) return;
    expect(res.stat).toContain("f2.txt");
    expect(res.stat).toContain("f3.txt");
    expect(res.stat).not.toContain("f1.txt");
  });
  it("niepoprawny sha: ok false", () => {
    const { repo } = history(1);
    expect(diffStatInRange(repo.dir, "nie-sha")).toEqual({ ok: false });
  });
});
```

- [ ] **Step 2: Uruchom, upewnij się, że pada**

Run: `npx vitest run tests/unit/lib/git/project-git.range.test.ts`
Expected: FAIL (`normalizeSha`/`headSha`… `is not a function` albo brak eksportu).

- [ ] **Step 3: Zaimplementuj**

Dopisz na końcu `lib/git/project-git.ts`:

```ts
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
```

- [ ] **Step 4: Uruchom, upewnij się, że przechodzi**

Run: `npx vitest run tests/unit/lib/git/`
Expected: PASS (nowy plik i istniejące `project-git.test.ts`).

- [ ] **Step 5: Commit**

```bash
git add lib/git/project-git.ts tests/unit/lib/git/project-git.range.test.ts
git commit -m "feat(git): headSha, relationToHead, commitsInRange, diffStatInRange (tylko odczyt)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 2: Modele i `state.md` z polem `code_commit`

**Files:**

- Modify: `contexts/bc_projects/models.ts` (`ProjectState`, `ProjectWithContent`, nowe `CodeSync`, `GitRange`)
- Modify: `contexts/bc_projects/repositories/markdown.ts` (`parseState`, `sameStateFields`, `serializeStateQuoted`, `serializeState`)
- Test: `tests/unit/contexts/bc_projects/repositories.state-code-commit.test.ts` (nowy)

- [ ] **Step 1: Napisz test (czerwony)**

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { ProjectState } from "@/contexts/bc_projects/models";
import { parseState, serializeState } from "@/contexts/bc_projects/repositories/markdown";

const base: ProjectState = {
  branch: "main",
  env: "",
  blocker: "",
  nextStep: "krok",
  links: [],
  milestone: "",
  notes: "notatki",
};

describe("state.md: code_commit", () => {
  it("czyta ręcznie dopisane pole, notatki bez zmian", () => {
    const state = parseState(
      "---\nbranch: main\ncode_commit: abc1234\n---\n\nnotatki\n",
      "state.md"
    );
    expect(state.codeCommit).toBe("abc1234");
    expect(state.notes).toBe("notatki");
  });

  it("brak pola: codeCommit undefined i brak klucza w pliku", () => {
    expect(parseState(serializeState(base), "state.md").codeCommit).toBeUndefined();
    expect(serializeState(base)).not.toContain("code_commit");
  });

  it.each([
    "abc1234def5678",
    "0123456", // zaczyna się od zera: YAML mógłby zmienić na liczbę
    "1234567", // same cyfry
    "1e30000", // wygląda na liczbę zmiennoprzecinkową
    "abcdef0123456789abcdef0123456789abcdef01",
  ])("round-trip sha %s", (sha) => {
    const out = serializeState({ ...base, codeCommit: sha });
    expect(parseState(out, "state.md").codeCommit).toBe(sha);
    expect(parseState(out, "state.md").notes).toBe("notatki");
  });
});
```

- [ ] **Step 2: Uruchom, upewnij się, że pada**

Run: `npx vitest run tests/unit/contexts/bc_projects/repositories.state-code-commit.test.ts`
Expected: FAIL (`codeCommit` nie istnieje w typie / `undefined`).

- [ ] **Step 3: Zmień `models.ts`**

W `ProjectState` (po polu `updated?`, przed `notes`) dopisz:

```ts
  /** Pełny sha commita repo, z którym zgadza się karta (YAML: `code_commit`); brak = bez punktu odniesienia. */
  codeCommit?: string;
```

W `ProjectWithContent` dopisz pole na końcu typu:

```ts
  /** Stan karty względem repo; brak = nie policzono. */
  codeSync?: CodeSync;
```

Dopisz pod `ProjectState`:

```ts
/** Stan karty względem HEAD repo projektu (`head` = pełny sha HEAD). */
export type CodeSync =
  | { status: "current"; head: string }
  | { status: "behind"; ahead: number; head: string }
  | { status: "diverged"; head: string }
  | { status: "no-baseline" } // brak `code_commit` w `state.md` albo brak `state.md`
  | { status: "unknown-sha" } // sha poza repo (rebase, force-push, shallow clone)
  | { status: "unavailable" }; // brak `local_path`, repo niedostępne, repo bez commitów, błąd gita

/** Zakres commitów dla paczki „odśwież kartę”. `baseline: null` = bez sha (ostatnie commity). */
export type GitRange =
  | {
      ok: true;
      head: string;
      baseline: string | null;
      /** `code_commit` jest, ale nie jest przodkiem HEAD: pokazujemy ostatnie commity. */
      baselineLost: boolean;
      commits: string[];
      total: number;
      diffStat: string;
    }
  | { ok: false };
```

- [ ] **Step 4: Zmień `repositories/markdown.ts`**

W `parseState` w zwracanym obiekcie, po `updated: optionalText(meta.updated),` dodaj:

```ts
    codeCommit: optionalText(meta.code_commit),
```

W `sameStateFields` po linii `(a.updated || undefined) === (b.updated || undefined) &&` dodaj:

```ts
    (a.codeCommit || undefined) === (b.codeCommit || undefined) &&
```

W `serializeStateQuoted` po linii `...(state.updated ? [`updated: ${q(state.updated)}`] : []),` dodaj:

```ts
    ...(state.codeCommit ? [`code_commit: ${q(state.codeCommit)}`] : []),
```

W `serializeState` w obiekcie przekazywanym do `formatFrontmatter`, po `updated: state.updated || undefined,` dodaj:

```ts
      code_commit: state.codeCommit || undefined,
```

- [ ] **Step 5: Uruchom testy kontekstu**

Run: `npx vitest run tests/unit/contexts/bc_projects/repositories.state-code-commit.test.ts tests/unit/contexts/bc_projects/repositories.markdown.test.ts`
Expected: PASS (nowe i istniejące testy parsera).

- [ ] **Step 6: Commit**

```bash
git add contexts/bc_projects/models.ts contexts/bc_projects/repositories/markdown.ts tests/unit/contexts/bc_projects/repositories.state-code-commit.test.ts
git commit -m "feat(projects): pole code_commit w state.md oraz typy CodeSync i GitRange

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 3: `repositories` — `readCodeSync`, `readHeadSha`, `readGitRange`

**Files:**

- Modify: `contexts/bc_projects/repositories/index.ts` (import z `@/lib/git/project-git`, typy z `models`, trzy funkcje po `readGitHistory`)
- Test: `tests/unit/contexts/bc_projects/repositories.code-sync.test.ts` (nowy)

- [ ] **Step 1: Napisz test (czerwony)**

```ts
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RegistryEntry } from "@/contexts/bc_projects/models";

const mockResolve = vi.hoisted(() => vi.fn());
const mockHeadSha = vi.hoisted(() => vi.fn());
const mockRelation = vi.hoisted(() => vi.fn());
const mockCommitsInRange = vi.hoisted(() => vi.fn());
const mockDiffStat = vi.hoisted(() => vi.fn());

vi.mock("@/lib/git/repo-path", () => ({ resolveRepoPath: mockResolve }));
vi.mock("@/lib/git/project-git", () => ({
  headSha: mockHeadSha,
  relationToHead: mockRelation,
  commitsInRange: mockCommitsInRange,
  diffStatInRange: mockDiffStat,
  normalizeSha: (s: string) => s.trim().toLowerCase(),
}));
vi.mock("@/lib/git/repo-file", () => ({ readRepoFile: vi.fn() }));

import { readCodeSync, readGitRange, readHeadSha } from "@/contexts/bc_projects/repositories";

const entry: RegistryEntry = {
  id: "a",
  name: "A",
  status: "active",
  priority: "high",
  folder: "Projects/a/",
  localPath: "~/projects/a",
  owner: "personal",
};
const HEAD = "h".repeat(40).replace(/h/g, "a");

beforeEach(() => {
  vi.clearAllMocks();
  mockResolve.mockReturnValue({ ok: true, path: "/home/u/projects/a" });
  mockHeadSha.mockReturnValue({ ok: true, sha: HEAD });
});

describe("readHeadSha", () => {
  it("pełny sha HEAD", () => {
    expect(readHeadSha(entry)).toBe(HEAD);
  });
  it("repo niedostępne albo bez commitów: null", () => {
    mockResolve.mockReturnValue({ ok: false, reason: "missing" });
    expect(readHeadSha(entry)).toBeNull();
    mockResolve.mockReturnValue({ ok: true, path: "/p" });
    mockHeadSha.mockReturnValue({ ok: false });
    expect(readHeadSha(entry)).toBeNull();
  });
});

describe("readCodeSync", () => {
  it("repo nierozwiązane: unavailable", () => {
    mockResolve.mockReturnValue({ ok: false, reason: "unsupported-path" });
    expect(readCodeSync(entry, "abc1234")).toEqual({ status: "unavailable" });
  });
  it("brak HEAD: unavailable (bez pytania o relację)", () => {
    mockHeadSha.mockReturnValue({ ok: false });
    expect(readCodeSync(entry, "abc1234")).toEqual({ status: "unavailable" });
    expect(mockRelation).not.toHaveBeenCalled();
  });
  it("ahead 0: current", () => {
    mockRelation.mockReturnValue({ kind: "ancestor", ahead: 0 });
    expect(readCodeSync(entry, "abc1234")).toEqual({ status: "current", head: HEAD });
  });
  it("ahead 3: behind", () => {
    mockRelation.mockReturnValue({ kind: "ancestor", ahead: 3 });
    expect(readCodeSync(entry, "abc1234")).toEqual({ status: "behind", ahead: 3, head: HEAD });
  });
  it("diverged / missing / error", () => {
    mockRelation.mockReturnValue({ kind: "diverged" });
    expect(readCodeSync(entry, "abc1234")).toEqual({ status: "diverged", head: HEAD });
    mockRelation.mockReturnValue({ kind: "missing" });
    expect(readCodeSync(entry, "abc1234")).toEqual({ status: "unknown-sha" });
    mockRelation.mockReturnValue({ kind: "error" });
    expect(readCodeSync(entry, "abc1234")).toEqual({ status: "unavailable" });
  });
});

describe("readGitRange", () => {
  it("sha jest przodkiem: zakres od sha i diff --stat", () => {
    mockRelation.mockReturnValue({ kind: "ancestor", ahead: 2 });
    mockCommitsInRange.mockReturnValue({ ok: true, lines: ["b2 x", "a1 y"], total: 2 });
    mockDiffStat.mockReturnValue({ ok: true, stat: " f.ts | 2 +-" });
    expect(readGitRange(entry, "ABC1234")).toEqual({
      ok: true,
      head: HEAD,
      baseline: "abc1234",
      baselineLost: false,
      commits: ["b2 x", "a1 y"],
      total: 2,
      diffStat: " f.ts | 2 +-",
    });
    expect(mockCommitsInRange).toHaveBeenCalledWith("/home/u/projects/a", "abc1234", 30);
  });
  it("sha nie jest przodkiem: baselineLost, ostatnie commity bez sha", () => {
    mockRelation.mockReturnValue({ kind: "diverged" });
    mockCommitsInRange.mockReturnValue({ ok: true, lines: ["c3 z"], total: 40 });
    const res = readGitRange(entry, "abc1234");
    expect(res).toMatchObject({ ok: true, baseline: null, baselineLost: true, diffStat: "" });
    expect(mockCommitsInRange).toHaveBeenCalledWith("/home/u/projects/a", null, 30);
    expect(mockDiffStat).not.toHaveBeenCalled();
  });
  it("brak code_commit: baseline null, baselineLost false", () => {
    mockCommitsInRange.mockReturnValue({ ok: true, lines: ["c3 z"], total: 3 });
    expect(readGitRange(entry, undefined)).toMatchObject({
      ok: true,
      baseline: null,
      baselineLost: false,
    });
    expect(mockRelation).not.toHaveBeenCalled();
  });
  it("repo niedostępne albo log pada: ok false", () => {
    mockResolve.mockReturnValue({ ok: false, reason: "missing" });
    expect(readGitRange(entry, undefined)).toEqual({ ok: false });
    mockResolve.mockReturnValue({ ok: true, path: "/p" });
    mockCommitsInRange.mockReturnValue({ ok: false });
    expect(readGitRange(entry, undefined)).toEqual({ ok: false });
  });
});
```

- [ ] **Step 2: Uruchom, upewnij się, że pada**

Run: `npx vitest run tests/unit/contexts/bc_projects/repositories.code-sync.test.ts`
Expected: FAIL (brak eksportów `readCodeSync` itd.).

- [ ] **Step 3: Zaimplementuj w `repositories/index.ts`**

W bloku `import { ... } from "@/lib/git/project-git";` dopisz `commitsInRange`, `diffStatInRange`, `headSha`, `normalizeSha`, `relationToHead` (alfabetycznie obok istniejących). W bloku importu typów z `@/contexts/bc_projects/models` dopisz `type CodeSync` i `type GitRange`.

Po funkcji `readGitHistory` (przed kolejnymi funkcjami tego pliku) dopisz:

```ts
const RANGE_COMMITS_MAX = 30;

/** Pełny sha HEAD repo projektu; `null`, gdy repo jest niedostępne albo nie ma commitów. */
export function readHeadSha(entry: RegistryEntry): string | null {
  const repo = resolveRepoPath(entry.localPath);
  if (repo.ok === false) return null;
  const head = headSha(repo.path);
  return head.ok ? head.sha : null;
}

/** Stan karty względem repo dla zapisanego `codeCommit`; git tylko do odczytu. */
export function readCodeSync(entry: RegistryEntry, codeCommit: string): CodeSync {
  const repo = resolveRepoPath(entry.localPath);
  if (repo.ok === false) return { status: "unavailable" };
  const head = headSha(repo.path);
  if (head.ok === false) return { status: "unavailable" };
  const relation = relationToHead(repo.path, codeCommit);
  switch (relation.kind) {
    case "ancestor":
      return relation.ahead === 0
        ? { status: "current", head: head.sha }
        : { status: "behind", ahead: relation.ahead, head: head.sha };
    case "diverged":
      return { status: "diverged", head: head.sha };
    case "missing":
      return { status: "unknown-sha" };
    default:
      return { status: "unavailable" };
  }
}

/**
 * Zakres commitów dla paczki „odśwież kartę”: od `codeCommit` do HEAD, a gdy go brak albo nie jest
 * przodkiem HEAD, ostatnie commity (`baselineLost` mówi, który z tych przypadków zaszedł).
 */
export function readGitRange(entry: RegistryEntry, codeCommit: string | undefined): GitRange {
  const repo = resolveRepoPath(entry.localPath);
  if (repo.ok === false) return { ok: false };
  const head = headSha(repo.path);
  if (head.ok === false) return { ok: false };
  let baseline: string | null = null;
  if (codeCommit !== undefined) {
    const relation = relationToHead(repo.path, codeCommit);
    if (relation.kind === "ancestor") baseline = normalizeSha(codeCommit);
  }
  const commits = commitsInRange(repo.path, baseline, RANGE_COMMITS_MAX);
  if (commits.ok === false) return { ok: false };
  const stat = baseline === null ? null : diffStatInRange(repo.path, baseline);
  return {
    ok: true,
    head: head.sha,
    baseline,
    baselineLost: codeCommit !== undefined && baseline === null,
    commits: commits.lines,
    total: commits.total,
    diffStat: stat !== null && stat.ok ? stat.stat : "",
  };
}
```

- [ ] **Step 4: Uruchom testy**

Run: `npx vitest run tests/unit/contexts/bc_projects/repositories.code-sync.test.ts tests/unit/contexts/bc_projects/repositories.context-pack.test.ts`
Expected: PASS.

- [ ] **Step 5: Test architektury**

Run: `npx vitest run tests/unit/architecture.static.test.ts`
Expected: PASS (git tylko przez `lib/git`, `repositories` bez `fs`/`child_process`).

- [ ] **Step 6: Commit**

```bash
git add contexts/bc_projects/repositories/index.ts tests/unit/contexts/bc_projects/repositories.code-sync.test.ts
git commit -m "feat(projects): odczyt stanu karty względem repo i zakresu commitów w repositories

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 4: `services` — stan, zapis `code_commit`, ochrona w `saveState`

**Files:**

- Modify: `contexts/bc_projects/services/index.ts`
- Test: `tests/unit/contexts/bc_projects/services.code-sync.test.ts` (nowy)

- [ ] **Step 1: Napisz test (czerwony)**

```ts
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectState, RegistryEntry } from "@/contexts/bc_projects/models";
import { ConflictError, DomainError } from "@/lib/errors";

const mockReadRegistry = vi.hoisted(() => vi.fn());
const mockReadProjectIndex = vi.hoisted(() => vi.fn());
const mockReadProjectContent = vi.hoisted(() => vi.fn());
const mockReadProjectState = vi.hoisted(() => vi.fn());
const mockReadDevlog = vi.hoisted(() => vi.fn());
const mockReadProjectBoard = vi.hoisted(() => vi.fn());
const mockWriteProjectState = vi.hoisted(() => vi.fn());
const mockReadCodeSync = vi.hoisted(() => vi.fn());
const mockReadHeadSha = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/bc_projects/repositories", () => ({
  readRegistry: mockReadRegistry,
  readProjectIndex: mockReadProjectIndex,
  readProjectContent: mockReadProjectContent,
  readProjectState: mockReadProjectState,
  readDevlog: mockReadDevlog,
  readProjectBoard: mockReadProjectBoard,
  writeProjectState: mockWriteProjectState,
  readCodeSync: mockReadCodeSync,
  readHeadSha: mockReadHeadSha,
}));

import {
  getCodeSync,
  getProject,
  listCodeSync,
  listProjects,
  markCodeSynced,
  saveState,
} from "@/contexts/bc_projects/services";

const entry: RegistryEntry = {
  id: "a",
  name: "A",
  status: "active",
  priority: "high",
  folder: "Projects/a/",
  localPath: "~/projects/a",
  owner: "personal",
};
const HEAD = "f".repeat(40);
const SHA = "abc1234";
const VERSION = { size: 10, hash: "h1" };
const TODAY = new Date(2026, 10, 16);

function state(over: Partial<ProjectState> = {}): ProjectState {
  return {
    branch: "main",
    env: "",
    blocker: "",
    nextStep: "x",
    links: [],
    milestone: "",
    updated: "2026-11-10T10:00",
    notes: "notatki",
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockReadRegistry.mockReturnValue({ entries: [entry], warnings: [] });
  mockReadProjectIndex.mockReturnValue({ whereIStopped: null });
  mockReadProjectContent.mockReturnValue({ tasks: [], bugs: [] });
  mockReadDevlog.mockReturnValue([]);
  mockReadProjectBoard.mockReturnValue({
    blockers: [],
    now: [],
    next: [],
    icebox: [],
    version: null,
  });
  mockReadProjectState.mockReturnValue({ state: null, version: null });
  mockReadHeadSha.mockReturnValue(HEAD);
});

describe("getCodeSync / getProject", () => {
  it("bez state.md: no-baseline i brak wywołania gita", () => {
    expect(getCodeSync("a")).toEqual({ status: "no-baseline" });
    expect(mockReadCodeSync).not.toHaveBeenCalled();
  });
  it("state.md bez code_commit: no-baseline", () => {
    mockReadProjectState.mockReturnValue({ state: state(), version: VERSION });
    expect(getCodeSync("a")).toEqual({ status: "no-baseline" });
  });
  it("z code_commit: wynik readCodeSync dla tego sha", () => {
    mockReadProjectState.mockReturnValue({ state: state({ codeCommit: SHA }), version: VERSION });
    mockReadCodeSync.mockReturnValue({ status: "behind", ahead: 2, head: HEAD });
    expect(getCodeSync("a")).toEqual({ status: "behind", ahead: 2, head: HEAD });
    expect(mockReadCodeSync).toHaveBeenCalledWith(entry, SHA);
  });
  it("getProject dołącza codeSync", () => {
    mockReadProjectState.mockReturnValue({ state: state({ codeCommit: SHA }), version: VERSION });
    mockReadCodeSync.mockReturnValue({ status: "current", head: HEAD });
    expect(getProject("a", TODAY).codeSync).toEqual({ status: "current", head: HEAD });
  });
});

describe("listProjects", () => {
  it("nie woła gita (lista zostaje szybka)", () => {
    mockReadProjectState.mockReturnValue({ state: state({ codeCommit: SHA }), version: VERSION });
    listProjects(TODAY);
    expect(mockReadCodeSync).not.toHaveBeenCalled();
    expect(mockReadHeadSha).not.toHaveBeenCalled();
  });
});

describe("listCodeSync", () => {
  it("mapa po id; wyjątek jednego projektu daje unavailable tylko dla niego", () => {
    const b: RegistryEntry = { ...entry, id: "b", folder: "Projects/b/" };
    mockReadRegistry.mockReturnValue({ entries: [entry, b], warnings: [] });
    mockReadProjectState.mockImplementation((e: RegistryEntry) => {
      if (e.id === "b") throw new Error("zepsuty frontmatter");
      return { state: state({ codeCommit: SHA }), version: VERSION };
    });
    mockReadCodeSync.mockReturnValue({ status: "current", head: HEAD });
    expect(listCodeSync()).toEqual({
      a: { status: "current", head: HEAD },
      b: { status: "unavailable" },
    });
  });
});

describe("saveState", () => {
  it("zachowuje code_commit z istniejącego state.md", async () => {
    mockReadProjectState.mockReturnValue({ state: state({ codeCommit: SHA }), version: VERSION });
    await saveState(
      "a",
      {
        branch: "dev",
        env: "",
        blocker: "",
        nextStep: "nowy krok",
        links: [],
        milestone: "",
        version: VERSION,
      },
      TODAY
    );
    expect(mockWriteProjectState).toHaveBeenCalledWith(
      entry,
      expect.objectContaining({ codeCommit: SHA, branch: "dev", notes: "notatki" }),
      VERSION
    );
  });
});

describe("markCodeSynced", () => {
  beforeEach(() => {
    mockReadProjectState.mockReturnValue({ state: state(), version: VERSION });
  });

  it("zapisuje code_commit, nie rusza updated ani notatek, używa tokenu wersji", async () => {
    mockReadCodeSync.mockReturnValue({ status: "behind", ahead: 2, head: HEAD });
    await markCodeSynced("a", SHA, TODAY);
    expect(mockReadCodeSync).toHaveBeenCalledWith(entry, SHA);
    expect(mockWriteProjectState).toHaveBeenCalledWith(
      entry,
      expect.objectContaining({
        codeCommit: SHA,
        updated: "2026-11-10T10:00",
        notes: "notatki",
      }),
      VERSION
    );
  });

  it("bez commit w wywołaniu bierze HEAD", async () => {
    mockReadCodeSync.mockReturnValue({ status: "current", head: HEAD });
    await markCodeSynced("a", undefined, TODAY);
    expect(mockReadCodeSync).toHaveBeenCalledWith(entry, HEAD);
    expect(mockWriteProjectState).toHaveBeenCalledWith(
      entry,
      expect.objectContaining({ codeCommit: HEAD }),
      VERSION
    );
  });

  it("brak state.md: tworzy plik z pustymi polami, bez updated, expected null", async () => {
    mockReadProjectState.mockReturnValue({ state: null, version: null });
    mockReadCodeSync.mockReturnValue({ status: "current", head: HEAD });
    await markCodeSynced("a", SHA, TODAY);
    const [, written, expected] = mockWriteProjectState.mock.calls[0];
    expect(written).toEqual({
      branch: "",
      env: "",
      blocker: "",
      nextStep: "",
      links: [],
      milestone: "",
      notes: "",
      codeCommit: SHA,
    });
    expect(expected).toBeNull();
  });

  it.each([
    [{ status: "diverged", head: HEAD }],
    [{ status: "unknown-sha" }],
    [{ status: "unavailable" }],
  ])("odrzuca commit, gdy readCodeSync = %j", async (sync) => {
    mockReadCodeSync.mockReturnValue(sync);
    await expect(markCodeSynced("a", SHA, TODAY)).rejects.toBeInstanceOf(DomainError);
    expect(mockWriteProjectState).not.toHaveBeenCalled();
  });

  it("niepoprawny format sha: DomainError bez pytania o git", async () => {
    await expect(markCodeSynced("a", "--help", TODAY)).rejects.toBeInstanceOf(DomainError);
    expect(mockReadCodeSync).not.toHaveBeenCalled();
  });

  it("repo bez HEAD i brak commit: DomainError", async () => {
    mockReadHeadSha.mockReturnValue(null);
    await expect(markCodeSynced("a", undefined, TODAY)).rejects.toBeInstanceOf(DomainError);
  });

  it("zmiana pliku w międzyczasie: ConflictError leci dalej", async () => {
    mockReadCodeSync.mockReturnValue({ status: "current", head: HEAD });
    mockWriteProjectState.mockImplementation(() => {
      throw new ConflictError("Plik zmienił się");
    });
    await expect(markCodeSynced("a", SHA, TODAY)).rejects.toBeInstanceOf(ConflictError);
  });
});
```

- [ ] **Step 2: Uruchom, upewnij się, że pada**

Run: `npx vitest run tests/unit/contexts/bc_projects/services.code-sync.test.ts`
Expected: FAIL (brak eksportów `getCodeSync` itd.).

- [ ] **Step 3: Zaimplementuj w `services/index.ts`**

(a) Importy: do bloku `import { ... } from "@/contexts/bc_projects/models"` dopisz `type CodeSync` i `type ProjectState`; do bloku z `@/contexts/bc_projects/repositories` dopisz `readCodeSync`, `readHeadSha` (`readGitRange` dochodzi dopiero w Tasku 6).

(b) Przed funkcją `getProject` dodaj:

```ts
/** Stan karty względem repo. Bez `code_commit` nie dotykamy gita (`no-baseline`). */
function codeSyncOf(entry: RegistryEntry, state: ProjectState | null): CodeSync {
  const sha = state?.codeCommit;
  if (!sha) return { status: "no-baseline" };
  return readCodeSync(entry, sha);
}

export function getCodeSync(id: string): CodeSync {
  const entry = findEntry(id);
  return codeSyncOf(entry, readProjectState(entry).state);
}

/** Stany wszystkich projektów po `id`; błąd jednego projektu daje `unavailable` tylko dla niego. */
export function listCodeSync(): Record<string, CodeSync> {
  const out: Record<string, CodeSync> = {};
  for (const entry of readRegistry().entries) {
    try {
      out[entry.id] = codeSyncOf(entry, readProjectState(entry).state);
    } catch {
      out[entry.id] = { status: "unavailable" };
    }
  }
  return out;
}
```

(b2) W Tasku 6 (krok 5) do tego samego importu dopisz `readGitRange`.

(c) W `getProject` w zwracanym obiekcie po linii `freshness: freshness(effectiveLastWorked(index.lastWorked, state?.updated), today),` dodaj:

```ts
    codeSync: codeSyncOf(entry, state),
```

(d) W `saveState` zamień fragment

```ts
      updated: localDateTime(now),
      notes: current?.notes ?? "",
    },
    input.version
```

na

```ts
      updated: localDateTime(now),
      notes: current?.notes ?? "",
      codeCommit: current?.codeCommit,
    },
    input.version
```

(e) Pod `saveState` dodaj:

```ts
const SHA_FORMAT = /^[0-9a-f]{7,40}$/;
const EMPTY_STATE: ProjectState = {
  branch: "",
  env: "",
  blocker: "",
  nextStep: "",
  links: [],
  milestone: "",
  notes: "",
};

/**
 * Zapisuje w `state.md` tylko `code_commit` (nie ustawia `updated`: potwierdzenie sha nie jest pracą
 * nad projektem i nie może maskować `stale`). Bez `commit` bierze HEAD. Commit musi być równy HEAD
 * albo jego przodkiem. Brak `state.md` tworzy plik z pustymi polami; zmiana pliku w międzyczasie
 * daje `ConflictError`.
 */
export async function markCodeSynced(
  id: string,
  commit?: string,
  today: Date = new Date()
): Promise<ProjectWithContent> {
  const entry = findEntry(id);
  if (commit !== undefined && !SHA_FORMAT.test(commit)) {
    throw new DomainError("Zły sha commita (oczekiwano 7–40 znaków szesnastkowych)", 422);
  }
  const target = commit ?? readHeadSha(entry);
  if (target === null) {
    throw new DomainError("Repozytorium projektu jest niedostępne albo nie ma commitów", 422);
  }
  const sync = readCodeSync(entry, target);
  if (sync.status !== "current" && sync.status !== "behind") {
    throw new DomainError(
      `Commit ${target.slice(0, 7)} nie jest równy HEAD ani jego przodkiem w repozytorium projektu`,
      422
    );
  }
  const { state, version } = readProjectState(entry);
  writeProjectState(entry, { ...(state ?? EMPTY_STATE), codeCommit: target }, version);
  return getProject(id, today);
}
```

- [ ] **Step 4: Uruchom testy**

Run: `npx vitest run tests/unit/contexts/bc_projects/services.code-sync.test.ts`
Expected: PASS.

- [ ] **Step 5: Uruchom istniejące testy serwisów (regresja)**

Run: `npx vitest run tests/unit/contexts/bc_projects/ tests/unit/contexts/bc_cockpit/`
Expected: PASS. Jeśli któryś test porównuje cały wynik `getProject` przez `toEqual` i pada na nowym polu `codeSync: { status: "no-baseline" }`, dopisz to pole do oczekiwanej wartości w tym teście (zmiana oczekiwań, nie logiki).

- [ ] **Step 6: Commit**

```bash
git add contexts/bc_projects/services/index.ts tests/unit/contexts/bc_projects/
git commit -m "feat(projects): codeSync w getProject, listCodeSync, markCodeSynced; saveState zachowuje code_commit

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 5: `schemas`, `router` i trasy

**Files:**

- Modify: `contexts/bc_projects/schemas.ts` (`CodeSyncDto`, `CodeSyncMarkInputSchema`, `ProjectDetailDto.codeSync`, `toDetailDto`)
- Modify: `contexts/bc_projects/router.ts` (`getCodeSyncMap`, `putCodeSync`)
- Create: `app/api/projects/code-sync/route.ts`
- Create: `app/api/projects/[id]/code-sync/route.ts`
- Test: `tests/unit/contexts/bc_projects/router.code-sync.test.ts` (nowy)

- [ ] **Step 1: Napisz test (czerwony)**

```ts
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ConflictError, DomainError } from "@/lib/errors";
import type { ProjectWithContent } from "@/contexts/bc_projects/models";

const mockListCodeSync = vi.hoisted(() => vi.fn());
const mockMarkCodeSynced = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/bc_projects/services", () => ({
  listCodeSync: mockListCodeSync,
  markCodeSynced: mockMarkCodeSynced,
}));

import { GET as mapGET } from "@/app/api/projects/code-sync/route";
import { PUT as markPUT } from "@/app/api/projects/[id]/code-sync/route";

const HEAD = "f".repeat(40);
const detail: ProjectWithContent = {
  id: "a",
  name: "Alpha",
  status: "active",
  priority: "high",
  folder: "Projects/a/",
  localPath: "/tmp/a",
  owner: "personal",
  whereIStopped: null,
  freshness: "fresh",
  tasks: [],
  board: { blockers: [], now: [], next: [], icebox: [], version: null },
  bugs: [],
  state: null,
  stateVersion: null,
  devlog: [],
  codeSync: { status: "current", head: HEAD },
};

const ctx = { params: Promise.resolve({ id: "a" }) };
const put = (body: unknown) =>
  new NextRequest("http://localhost/api/projects/a/code-sync", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/projects/code-sync", () => {
  it("mapa stanów po id", async () => {
    mockListCodeSync.mockReturnValue({ a: { status: "no-baseline" } });
    const res = await mapGET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ codeSync: { a: { status: "no-baseline" } } });
  });
});

describe("PUT /api/projects/[id]/code-sync", () => {
  it("commit z ciała: małe litery, odpowiedź to szczegóły projektu z codeSync", async () => {
    mockMarkCodeSynced.mockResolvedValue(detail);
    const res = await markPUT(put({ commit: "ABC1234" }), ctx);
    expect(res.status).toBe(200);
    expect(mockMarkCodeSynced).toHaveBeenCalledWith("a", "abc1234");
    expect((await res.json()).codeSync).toEqual({ status: "current", head: HEAD });
  });

  it("puste ciało `{}`: commit undefined (serwer bierze HEAD)", async () => {
    mockMarkCodeSynced.mockResolvedValue(detail);
    const res = await markPUT(put({}), ctx);
    expect(res.status).toBe(200);
    expect(mockMarkCodeSynced).toHaveBeenCalledWith("a", undefined);
  });

  it.each(["xyz", "--help", "abc12", "HEAD"])(
    "zły commit %j: 400 bez wołania serwisu",
    async (c) => {
      const res = await markPUT(put({ commit: c }), ctx);
      expect(res.status).toBe(400);
      expect(mockMarkCodeSynced).not.toHaveBeenCalled();
    }
  );

  it("błąd domenowy 422 i konflikt 409 mapują się na statusy", async () => {
    mockMarkCodeSynced.mockRejectedValueOnce(new DomainError("nie przodek", 422));
    expect((await markPUT(put({ commit: "abc1234" }), ctx)).status).toBe(422);
    mockMarkCodeSynced.mockRejectedValueOnce(new ConflictError("zmiana"));
    expect((await markPUT(put({ commit: "abc1234" }), ctx)).status).toBe(409);
  });
});
```

- [ ] **Step 2: Uruchom, upewnij się, że pada**

Run: `npx vitest run tests/unit/contexts/bc_projects/router.code-sync.test.ts`
Expected: FAIL (brak modułów tras).

- [ ] **Step 3: `schemas.ts`**

Do importu typów z `@/contexts/bc_projects/models` dopisz `type CodeSync`. Dopisz (np. pod `StateInputSchema`):

```ts
/** Stan karty względem repo; ten sam kształt co `CodeSync` z `models` (nie zawiera nic poza statusem, sha i licznikiem). */
export type CodeSyncDto = CodeSync;

/**
 * Wejście `PUT /api/projects/[id]/code-sync`. `commit` (7–40 znaków szesnastkowych, wielkie litery
 * zamieniane na małe) pochodzi z `head` pokazanego w UI; bez niego serwer bierze HEAD z chwili zapisu.
 */
export const CodeSyncMarkInputSchema = z.object({
  commit: z
    .string()
    .trim()
    .regex(/^[0-9a-f]{7,40}$/i, "Zły sha commita")
    .transform((s) => s.toLowerCase())
    .optional(),
});
```

W typie `ProjectDetailDto` dopisz pole po `devlog: DevlogEntryDto[];`:

```ts
  /** Stan karty względem repo; brak = nie policzono. */
  codeSync?: CodeSyncDto;
```

W `toDetailDto` po linii `devlog: p.devlog.slice(0, DEVLOG_LIMIT),` dodaj:

```ts
    ...(p.codeSync !== undefined ? { codeSync: p.codeSync } : {}),
```

- [ ] **Step 4: `router.ts`**

W imporcie ze `./schemas` dopisz `CodeSyncMarkInputSchema`. Na końcu pliku dopisz:

```ts
export async function getCodeSyncMap(): Promise<NextResponse> {
  try {
    return NextResponse.json({ codeSync: services.listCodeSync() });
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function putCodeSync(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  try {
    const parsed = await parseBody(req, CodeSyncMarkInputSchema);
    if (parsed.success === false) return parsed.response;
    const { id } = await ctx.params;
    const project = await services.markCodeSynced(id, parsed.data.commit);
    return NextResponse.json(toDetailDto(project));
  } catch (err) {
    return handleServiceError(err);
  }
}
```

- [ ] **Step 5: Trasy (tylko re-eksport)**

`app/api/projects/code-sync/route.ts`:

```ts
export { getCodeSyncMap as GET } from "@/contexts/bc_projects/router";
```

`app/api/projects/[id]/code-sync/route.ts`:

```ts
export { putCodeSync as PUT } from "@/contexts/bc_projects/router";
```

- [ ] **Step 6: Uruchom testy**

Run: `npx vitest run tests/unit/contexts/bc_projects/router.code-sync.test.ts tests/unit/contexts/bc_projects/router.test.ts tests/unit/architecture.static.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add contexts/bc_projects/schemas.ts contexts/bc_projects/router.ts app/api/projects tests/unit/contexts/bc_projects/router.code-sync.test.ts
git commit -m "feat(projects): trasy GET /api/projects/code-sync i PUT /api/projects/[id]/code-sync

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 6: Rola paczki `refresh` („odśwież kartę")

**Files:**

- Modify: `contexts/bc_projects/models.ts` (`CONTEXT_PACK_ROLES`)
- Modify: `contexts/bc_projects/schemas.ts` (`ContextPackRoleSchema`, `PACK_ROLES`)
- Modify: `contexts/bc_projects/services/context-pack.ts` (sekcja `gitRange`, profil, knoby, kroki redukcji)
- Modify: `contexts/bc_projects/services/index.ts` (`buildContextPack`)
- Modify: `src/i18n/locales/pl/projects.ts`, `src/i18n/locales/en/projects.ts` (etykieta roli)
- Test: `tests/unit/contexts/bc_projects/context-pack.refresh.test.ts` (nowy)

- [ ] **Step 1: Napisz test (czerwony)**

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { GitRange, ProjectWithContent } from "@/contexts/bc_projects/models";
import {
  composeContextPack,
  type ContextPackInput,
} from "@/contexts/bc_projects/services/context-pack";

const HEAD = "9".repeat(40);

const project: ProjectWithContent = {
  id: "a",
  name: "Alpha",
  status: "active",
  priority: "high",
  folder: "Projects/a/",
  localPath: "~/projects/a",
  owner: "personal",
  whereIStopped: null,
  freshness: "fresh",
  tasks: [],
  board: {
    blockers: [],
    now: [{ text: "N1", done: false }],
    next: [],
    icebox: [],
    version: null,
  },
  bugs: [],
  state: {
    branch: "main",
    env: "",
    blocker: "",
    nextStep: "Zrobić Z",
    links: [],
    milestone: "",
    notes: "",
  },
  stateVersion: null,
  devlog: [],
};

const commits = (n: number) =>
  Array.from({ length: n }, (_, i) => `abcdef1 commit ${String(i + 1).padStart(2, "0")}`);

function range(over: Partial<Extract<GitRange, { ok: true }>> = {}): GitRange {
  return {
    ok: true,
    head: HEAD,
    baseline: "abc1234def5678abc1234def5678abc1234def56",
    baselineLost: false,
    commits: commits(3),
    total: 3,
    diffStat: " src/a.ts | 4 ++--",
    ...over,
  };
}

function input(over: Partial<ContextPackInput> = {}): ContextPackInput {
  return {
    project,
    lastWorked: "2026-11-10",
    rules: null,
    git: { ok: true, snapshot: { status: "## main", log: "x y", diffStat: "" } },
    warnings: [],
    role: "refresh",
    range: range(),
    ...over,
  };
}

const idx = (md: string, s: string) => md.indexOf(s);

describe("rola refresh", () => {
  it("kolejność: Save State, zmiany w repo, zadania; bez sekcji „Kod (git)”", () => {
    const { markdown } = composeContextPack(input());
    expect(markdown).not.toContain("## Kod (git)");
    expect(idx(markdown, "## Save State")).toBeGreaterThan(-1);
    expect(idx(markdown, "## Zmiany w repo")).toBeGreaterThan(idx(markdown, "## Save State"));
    expect(idx(markdown, "## Zadania")).toBeGreaterThan(idx(markdown, "## Zmiany w repo"));
  });

  it("z sha: nagłówek „od abc1234”, commity, diff --stat i instrukcja z pełnym HEAD", () => {
    const { markdown } = composeContextPack(input());
    expect(markdown).toContain("od `abc1234`");
    expect(markdown).toContain("abcdef1 commit 03");
    expect(markdown).toContain("src/a.ts | 4 ++--");
    expect(markdown).toContain(`code_commit: ${HEAD}`);
  });

  it("więcej commitów niż pokazano: „… i N starszych”", () => {
    const { markdown } = composeContextPack(
      input({ range: range({ commits: commits(30), total: 45 }) })
    );
    expect(markdown).toContain("… i 15 starszych");
  });

  it("bez punktu odniesienia i z utraconym sha: osobne opisy", () => {
    const none = composeContextPack(input({ range: range({ baseline: null }) })).markdown;
    expect(none).toContain("brak punktu odniesienia");
    const lost = composeContextPack(
      input({ range: range({ baseline: null, baselineLost: true }) })
    ).markdown;
    expect(lost).toContain("nie jest już w historii repo");
  });

  it("zakres niedostępny: informacja zamiast commitów", () => {
    const { markdown } = composeContextPack(input({ range: { ok: false } }));
    expect(markdown).toContain("## Zmiany w repo");
    expect(markdown).toContain("Repozytorium niedostępne");
  });

  it("przy małym budżecie ścina diff i commity (maks. 10 linii commitów), truncated true", () => {
    const big = Array.from({ length: 200 }, (_, i) => ` src/f${i}.ts | 10 ++++++++++`).join("\n");
    const res = composeContextPack(
      input({ range: range({ commits: commits(30), total: 30, diffStat: big }) }),
      600
    );
    expect(res.truncated).toBe(true);
    const shown = res.markdown.split("\n").filter((l) => l.startsWith("abcdef1 commit"));
    expect(shown.length).toBeLessThanOrEqual(10);
  });

  it("inne role ignorują range", () => {
    const { markdown } = composeContextPack(input({ role: "full" }));
    expect(markdown).not.toContain("## Zmiany w repo");
  });
});
```

- [ ] **Step 2: Uruchom, upewnij się, że pada**

Run: `npx vitest run tests/unit/contexts/bc_projects/context-pack.refresh.test.ts`
Expected: FAIL (`range` nie istnieje w `ContextPackInput` / rola nieznana).

- [ ] **Step 3: Rola w `models.ts` i `schemas.ts`**

`models.ts`: zamień

```ts
export const CONTEXT_PACK_ROLES = ["full", "review", "implementation", "debug"] as const;
```

na

```ts
export const CONTEXT_PACK_ROLES = ["full", "review", "implementation", "debug", "refresh"] as const;
```

`schemas.ts`: zamień `z.enum(["full", "review", "implementation", "debug"])` na `z.enum(["full", "review", "implementation", "debug", "refresh"])` oraz w `PACK_ROLES` dopisz na końcu tablicy `{ key: "refresh", label: "Odśwież kartę" },`.

- [ ] **Step 4: `context-pack.ts`**

(a) Importy typów: dopisz `GitRange` do listy z `@/contexts/bc_projects/models`.

(b) W `ContextPackInput` po polu `role?` dopisz:

```ts
  /** Zakres commitów od `code_commit` (tylko rola `refresh`). */
  range?: GitRange;
```

(c) W `Knobs` dopisz `rangeCommits: number; rangeDiff: number;`. W obiekcie `k` w `composeContextPack` (inicjalizacja `let k: Knobs = {…}`) dopisz `rangeCommits: 30, rangeDiff: 40,`.

(d) `export type SectionId = "rules" | "state" | "git" | "tasks" | "bugs" | "devlog";` → dodaj `| "gitRange"`.

(e) W `ROLE_PROFILES` dopisz na końcu obiektu:

```ts
  refresh: {
    order: ["rules", "state", "gitRange", "tasks", "bugs"],
    tasks: { blockers: true, now: true },
    diff: false,
    protectDiff: false,
    rulesMax: 1200,
    bugDetails: false,
  },
```

(f) W `renderPack` w obiekcie `render` (obok `git`) dopisz:

```ts
    gitRange: () => {
      const range = input.range;
      if (range === undefined || range.ok === false) {
        return "## Zmiany w repo od ostatniej karty\n\nRepozytorium niedostępne albo zakresu commitów nie da się ustalić.";
      }
      const short = (sha: string) => sha.slice(0, 7);
      const title = range.baseline
        ? `## Zmiany w repo od ostatniej karty (od \`${short(range.baseline)}\`)`
        : range.baselineLost
          ? "## Zmiany w repo (sha z karty nie jest już w historii repo; ostatnie commity)"
          : "## Zmiany w repo (brak punktu odniesienia; ostatnie commity)";
      const shown = range.commits.slice(0, k.rangeCommits);
      const hidden = range.total - shown.length;
      const parts = [
        `HEAD: \`${short(range.head)}\` · commity w zakresie: ${range.total}`,
        `Commity:\n${block(shown.join("\n"))}${hidden > 0 ? `\n… i ${hidden} starszych` : ""}`,
      ];
      if (range.diffStat !== "") {
        parts.push(`Zmiany (diff --stat):\n${block(limitLines(range.diffStat, k.rangeDiff))}`);
      }
      parts.push(
        "Instrukcja: na podstawie powyższych commitów zaproponuj poprawki w „Gdzie skończyłem” i zadaniach " +
          "(nic nie usuwaj bez wskazania commita, który to zamyka). Po zatwierdzeniu ustaw " +
          `\`code_commit: ${range.head}\` w \`state.md\` projektu.`
      );
      return `${title}\n\n${parts.join("\n\n")}`;
    },
```

(g) W `composeContextPack` po obliczeniu `devlogLength`/`rulesLength` dodaj:

```ts
const hasRange = profile.order.includes("gitRange");
const rangeCommits = input.range && input.range.ok ? input.range.commits.length : 0;
const rangeDiffLines = input.range && input.range.ok ? lineCount(input.range.diffStat) : 0;
```

a po istniejącym kroku `if (over() && stat > 0 && k.diff) step({ ...k, diff: false });` dodaj:

```ts
if (over() && hasRange && rangeDiffLines > 10) step({ ...k, rangeDiff: 10 });
if (over() && hasRange && rangeCommits > 10) step({ ...k, rangeCommits: 10 });
```

- [ ] **Step 5: `buildContextPack` w `services/index.ts`**

W wywołaniu `composeContextPack({ ... })` na końcu dopisz pole `range`:

```ts
    range: role === "refresh" ? readGitRange(entry, project.state?.codeCommit) : undefined,
```

- [ ] **Step 6: Etykiety roli (i18n)**

`src/i18n/locales/pl/projects.ts` linia z `role: { full: "Pełna", … debug: "Debug" },` → `role: { full: "Pełna", review: "Review", implementation: "Implementacja", debug: "Debug", refresh: "Odśwież kartę" },` (zachowaj formatowanie prettiera).

`src/i18n/locales/en/projects.ts` linia 50 analogicznie: dopisz `refresh: "Refresh card"`.

- [ ] **Step 7: Uruchom testy**

Run: `npx vitest run tests/unit/contexts/bc_projects/ tests/unit/i18n/`
Expected: PASS (w tym `schemas.pack-role.test.ts`: lista ról zgodna w `models` i `schemas`; testy i18n zgodności kluczy pl/en).

- [ ] **Step 8: Commit**

```bash
git add contexts/bc_projects src/i18n tests/unit/contexts/bc_projects/context-pack.refresh.test.ts
git commit -m "feat(projects): rola paczki refresh (odśwież kartę) z zakresem commitów od code_commit

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 7: Kokpit — `behind` i `diverged` dają `confidence: "check"`

**Files:**

- Modify: `contexts/bc_cockpit/services.ts` (`toTopic`, ok. linii 69–72)
- Test: `tests/unit/contexts/bc_cockpit/services.test.ts` (dopisz dwa przypadki)

- [ ] **Step 1: Napisz test (czerwony)**

W `tests/unit/contexts/bc_cockpit/services.test.ts` po teście `it("stary last_worked: temat zostaje, freshness stale", …)` dopisz:

```ts
it.each([
  [{ status: "behind", ahead: 2, head: "a".repeat(40) }, "check"],
  [{ status: "diverged", head: "a".repeat(40) }, "check"],
  [{ status: "current", head: "a".repeat(40) }, "sure"],
  [{ status: "no-baseline" }, "sure"],
] as const)("codeSync %j: confidence %s", async (codeSync, expected) => {
  mockGetProject.mockReturnValue(project({ whereIStopped: "x", codeSync }));
  expect((await getCockpit(TODAY)).topics[0].confidence).toBe(expected);
});
```

(Pomocnik `project(over)` w tym pliku przyjmuje nadpisania pól projektu jak `freshness` i `whereIStopped`; jeśli jego typ nie dopuszcza `codeSync`, rozszerz typ parametru o `codeSync?: CodeSync` bez zmiany reszty.)

- [ ] **Step 2: Uruchom, upewnij się, że pada**

Run: `npx vitest run tests/unit/contexts/bc_cockpit/services.test.ts -t codeSync`
Expected: FAIL (dla `behind` i `diverged` confidence = `sure`).

- [ ] **Step 3: Zaimplementuj w `contexts/bc_cockpit/services.ts`**

Zamień

```ts
const confidence: Confidence =
  p.freshness === "stale" || p.stateConfidence === "unknown" || p.stateConfidence === "low"
    ? "check"
    : "sure";
```

na

```ts
const confidence: Confidence =
  p.freshness === "stale" ||
  p.stateConfidence === "unknown" ||
  p.stateConfidence === "low" ||
  p.codeSync?.status === "behind" ||
  p.codeSync?.status === "diverged"
    ? "check"
    : "sure";
```

- [ ] **Step 4: Uruchom testy Kokpitu**

Run: `npx vitest run tests/unit/contexts/bc_cockpit/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add contexts/bc_cockpit/services.ts tests/unit/contexts/bc_cockpit/services.test.ts
git commit -m "feat(cockpit): kod nowszy niż karta obniża pewność tematu do check

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 8: UI — znacznik na liście, blok w teczce, przycisk

**Files:**

- Create: `src/features/projects/useCodeSync.ts`
- Create: `src/features/projects/ProjectCodeSync.tsx` (`CodeSyncMarker` i `ProjectCodeSync`)
- Modify: `src/features/projects/mutation.ts` (`markCodeSynced` w `ProjectActions`)
- Modify: `src/features/projects/useProjects.ts` (akcja `markCodeSynced`)
- Modify: `src/features/projects/ProjectList.tsx` (prop `codeSync`, znacznik)
- Modify: `src/features/projects/ProjectDossier.tsx` (blok pod nagłówkiem karty)
- Modify: `src/features/projects/ProjectsView.tsx` (hook, przekazanie propsów)
- Modify: `src/features/projects/projects.css` (klasa znacznika)
- Modify: `src/i18n/locales/pl/projects.ts`, `src/i18n/locales/en/projects.ts` (sekcja `codeSync`)
- Test: `tests/unit/features/projects/ProjectCodeSync.test.tsx`, `tests/unit/features/projects/useCodeSync.test.tsx` (nowe)

- [ ] **Step 1: Teksty (i18n)**

W `src/i18n/locales/pl/projects.ts`, na tym samym poziomie co `list: {…}`, dopisz po bloku `list`:

```ts
  codeSync: {
    listBehind: "kod nowszy (commity: {{count}})",
    listDiverged: "historia repo zmieniona",
    listUnknown: "sha poza repo",
    title: "Stan względem kodu",
    behind: "Repozytorium ma commity nowsze niż karta (commity: {{count}}, HEAD {{head}}).",
    diverged: "Zapisany commit nie leży w historii bieżącej gałęzi (HEAD {{head}}).",
    unknownSha: "Zapisanego commita nie ma w repozytorium (rebase albo force-push).",
    current: "Karta zgadza się z HEAD ({{head}}).",
    noBaseline: "Brak zapisanego commita. Oznacz kartę, gdy opis i zadania są aktualne.",
    unavailable: "Repozytorium niedostępne.",
    note: "Wykrywamy tylko zacommitowane zmiany.",
    showPack: "Pokaż paczkę „odśwież kartę”",
    mark: "Oznacz jako zaktualizowaną",
  },
```

W `src/i18n/locales/en/projects.ts` analogicznie, po bloku `list`:

```ts
  codeSync: {
    listBehind: "code ahead (commits: {{count}})",
    listDiverged: "repo history changed",
    listUnknown: "sha not in repo",
    title: "State vs. code",
    behind: "The repository has commits newer than the card (commits: {{count}}, HEAD {{head}}).",
    diverged: "The saved commit is not in the current branch history (HEAD {{head}}).",
    unknownSha: "The saved commit is not in the repository (rebase or force-push).",
    current: "The card matches HEAD ({{head}}).",
    noBaseline: "No saved commit. Mark the card once the description and tasks are up to date.",
    unavailable: "Repository unavailable.",
    note: "Only committed changes are detected.",
    showPack: "Show the “refresh card” pack",
    mark: "Mark as updated",
  },
```

- [ ] **Step 2: Napisz testy komponentu i hooka (czerwone)**

`tests/unit/features/projects/ProjectCodeSync.test.tsx`:

```tsx
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CodeSyncMarker, ProjectCodeSync } from "@/src/features/projects/ProjectCodeSync";

afterEach(cleanup);

const HEAD = "abcdef1234567890abcdef1234567890abcdef12";
const ok = { ok: true } as const;

describe("CodeSyncMarker", () => {
  it("behind pokazuje liczbę commitów", () => {
    render(<CodeSyncMarker sync={{ status: "behind", ahead: 3, head: HEAD }} />);
    expect(screen.getByText("kod nowszy (commity: 3)")).toBeTruthy();
  });
  it("diverged i unknown-sha mają osobne napisy", () => {
    render(<CodeSyncMarker sync={{ status: "diverged", head: HEAD }} />);
    expect(screen.getByText("historia repo zmieniona")).toBeTruthy();
    cleanup();
    render(<CodeSyncMarker sync={{ status: "unknown-sha" }} />);
    expect(screen.getByText("sha poza repo")).toBeTruthy();
  });
  it.each([undefined, { status: "current", head: HEAD }, { status: "no-baseline" }] as const)(
    "bez znacznika dla %j",
    (sync) => {
      const { container } = render(<CodeSyncMarker sync={sync} />);
      expect(container.textContent).toBe("");
    }
  );
});

describe("ProjectCodeSync", () => {
  it("behind: opis ze skróconym HEAD, przycisk wysyła pełny head", async () => {
    const onMark = vi.fn().mockResolvedValue(ok);
    render(
      <ProjectCodeSync
        sync={{ status: "behind", ahead: 2, head: HEAD }}
        onMark={onMark}
        onShowPack={() => {}}
      />
    );
    expect(screen.getByText(/commity: 2, HEAD abcdef1/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Oznacz jako zaktualizowaną" }));
    expect(onMark).toHaveBeenCalledWith(HEAD);
  });

  it("no-baseline: przycisk wysyła undefined (serwer weźmie HEAD)", async () => {
    const onMark = vi.fn().mockResolvedValue(ok);
    render(
      <ProjectCodeSync sync={{ status: "no-baseline" }} onMark={onMark} onShowPack={() => {}} />
    );
    await userEvent.click(screen.getByRole("button", { name: "Oznacz jako zaktualizowaną" }));
    expect(onMark).toHaveBeenCalledWith(undefined);
  });

  it("current: tekst o zgodności, bez przycisku „Oznacz”", () => {
    render(
      <ProjectCodeSync
        sync={{ status: "current", head: HEAD }}
        onMark={vi.fn()}
        onShowPack={() => {}}
      />
    );
    expect(screen.getByText("Karta zgadza się z HEAD (abcdef1).")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Oznacz jako zaktualizowaną" })).toBeNull();
  });

  it("przycisk paczki woła onShowPack; uwaga o zacommitowanych zmianach jest zawsze", async () => {
    const onShowPack = vi.fn();
    render(
      <ProjectCodeSync
        sync={{ status: "behind", ahead: 1, head: HEAD }}
        onMark={vi.fn()}
        onShowPack={onShowPack}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Pokaż paczkę „odśwież kartę”" }));
    expect(onShowPack).toHaveBeenCalled();
    expect(screen.getByText("Wykrywamy tylko zacommitowane zmiany.")).toBeTruthy();
  });

  it("błąd zapisu pokazuje komunikat", async () => {
    const onMark = vi.fn().mockResolvedValue({ ok: false, error: "Konflikt", conflict: true });
    render(
      <ProjectCodeSync
        sync={{ status: "diverged", head: HEAD }}
        onMark={onMark}
        onShowPack={() => {}}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Oznacz jako zaktualizowaną" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Konflikt");
  });

  it("brak sync (jeszcze nie policzono): nic nie renderuje", () => {
    const { container } = render(
      <ProjectCodeSync sync={undefined} onMark={vi.fn()} onShowPack={() => {}} />
    );
    expect(container.textContent).toBe("");
  });
});
```

`tests/unit/features/projects/useCodeSync.test.tsx`:

```tsx
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProjectDetailDto } from "@/contexts/bc_projects/schemas";
import { useCodeSync } from "@/src/features/projects/useCodeSync";

afterEach(cleanup);

const HEAD = "a".repeat(40);
const json = (body: unknown, ok = true) =>
  Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);

describe("useCodeSync", () => {
  it("nie woła API, dopóki lista nie jest gotowa", () => {
    const apiFetch = vi.fn();
    renderHook(() => useCodeSync(apiFetch, false, null));
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("pobiera mapę po gotowej liście", async () => {
    const apiFetch = vi.fn().mockReturnValue(json({ codeSync: { a: { status: "no-baseline" } } }));
    const { result } = renderHook(() => useCodeSync(apiFetch, true, null));
    await waitFor(() => expect(result.current).toEqual({ a: { status: "no-baseline" } }));
    expect(apiFetch).toHaveBeenCalledWith("/api/projects/code-sync");
  });

  it("błąd sieci albo HTTP: pusta mapa, bez wyjątku", async () => {
    const apiFetch = vi.fn().mockReturnValue(json({}, false));
    const { result } = renderHook(() => useCodeSync(apiFetch, true, null));
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    expect(result.current).toEqual({});
    const failing = vi.fn().mockRejectedValue(new Error("offline"));
    const second = renderHook(() => useCodeSync(failing, true, null));
    await waitFor(() => expect(failing).toHaveBeenCalled());
    expect(second.result.current).toEqual({});
  });

  it("codeSync ze szczegółów wybranego projektu nadpisuje wpis w mapie", async () => {
    const apiFetch = vi.fn().mockReturnValue(json({ codeSync: { a: { status: "no-baseline" } } }));
    const detail = { id: "a", codeSync: { status: "current", head: HEAD } } as ProjectDetailDto;
    const { result, rerender } = renderHook(
      ({ d }: { d: ProjectDetailDto | null }) => useCodeSync(apiFetch, true, d),
      { initialProps: { d: null as ProjectDetailDto | null } }
    );
    await waitFor(() => expect(result.current.a).toEqual({ status: "no-baseline" }));
    rerender({ d: detail });
    await waitFor(() => expect(result.current.a).toEqual({ status: "current", head: HEAD }));
  });
});
```

- [ ] **Step 3: Uruchom, upewnij się, że padają**

Run: `npx vitest run tests/unit/features/projects/ProjectCodeSync.test.tsx tests/unit/features/projects/useCodeSync.test.tsx`
Expected: FAIL (brak modułów).

- [ ] **Step 4: `useCodeSync.ts`**

```ts
"use client";

import { useEffect, useState } from "react";
import type { CodeSyncDto, ProjectDetailDto } from "@/contexts/bc_projects/schemas";

type ApiFetch = (url: string, options?: RequestInit) => Promise<Response>;

/**
 * Stany kart względem repo po `id`, pobierane osobno od listy projektów (lista nie czeka na git).
 * Błąd sieci albo HTTP zostawia pustą mapę: znaczniki są dodatkiem i nie psują listy. Wpis wybranego
 * projektu odświeża się z jego szczegółów (np. po „Oznacz jako zaktualizowaną”).
 */
export function useCodeSync(
  apiFetch: ApiFetch,
  enabled: boolean,
  detail: ProjectDetailDto | null
): Record<string, CodeSyncDto> {
  const [map, setMap] = useState<Record<string, CodeSyncDto>>({});

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch("/api/projects/code-sync");
        if (!res.ok) return;
        const body = (await res.json()) as { codeSync?: Record<string, CodeSyncDto> };
        if (!cancelled && body.codeSync) setMap(body.codeSync);
      } catch {
        // brak znaczników zamiast błędu listy
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiFetch, enabled]);

  const id = detail?.id;
  const sync = detail?.codeSync;
  useEffect(() => {
    if (id && sync) setMap((m) => ({ ...m, [id]: sync }));
  }, [id, sync]);

  return map;
}
```

- [ ] **Step 5: `ProjectCodeSync.tsx`**

```tsx
"use client";

import React, { useState } from "react";
import type { CodeSyncDto } from "@/contexts/bc_projects/schemas";
import { useT } from "@/src/i18n/useT";
import type { MutationResult } from "./mutation";

/** Krótki znacznik przy projekcie na liście; `current`, `no-baseline` i brak danych nie są alarmem. */
export function CodeSyncMarker(props: { sync: CodeSyncDto | undefined }): React.JSX.Element | null {
  const { sync } = props;
  const t = useT();
  if (sync === undefined) return null;
  if (sync.status === "behind") {
    return (
      <span className="prj-item__sync">
        {t("projects:codeSync.listBehind", { count: sync.ahead })}
      </span>
    );
  }
  if (sync.status === "diverged") {
    return <span className="prj-item__sync">{t("projects:codeSync.listDiverged")}</span>;
  }
  if (sync.status === "unknown-sha") {
    return <span className="prj-item__sync">{t("projects:codeSync.listUnknown")}</span>;
  }
  return null;
}

/** Blok „Stan względem kodu” w teczce projektu: opis stanu, paczka „odśwież kartę”, oznaczenie karty. */
export function ProjectCodeSync(props: {
  sync: CodeSyncDto | undefined;
  /** `commit`: pełny sha z `head`; `undefined` = serwer weźmie HEAD (stan `no-baseline`). */
  onMark: (commit?: string) => Promise<MutationResult>;
  onShowPack: () => void;
}): React.JSX.Element | null {
  const { sync, onMark, onShowPack } = props;
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (sync === undefined) return null;

  const head = "head" in sync ? sync.head : undefined;
  const short = head?.slice(0, 7) ?? "";
  const text =
    sync.status === "behind"
      ? t("projects:codeSync.behind", { count: sync.ahead, head: short })
      : sync.status === "diverged"
        ? t("projects:codeSync.diverged", { head: short })
        : sync.status === "current"
          ? t("projects:codeSync.current", { head: short })
          : sync.status === "unknown-sha"
            ? t("projects:codeSync.unknownSha")
            : sync.status === "no-baseline"
              ? t("projects:codeSync.noBaseline")
              : t("projects:codeSync.unavailable");

  const canMark = sync.status !== "current" && sync.status !== "unavailable";
  const canShowPack = sync.status !== "unavailable";

  const mark = async () => {
    setBusy(true);
    setError(null);
    const result = await onMark(head);
    setBusy(false);
    // `=== false`: przy `strict: false` tylko takie porównanie zawęża unię.
    if (result.ok === false) setError(result.error);
  };

  return (
    <article className="prj-card" aria-label={t("projects:codeSync.title")}>
      <h3 className="prj-section-title">{t("projects:codeSync.title")}</h3>
      <p>{text}</p>
      <p className="prj-pack__note">{t("projects:codeSync.note")}</p>
      <div className="prj-form__actions">
        {canShowPack ? (
          <button type="button" className="prj-btn" onClick={onShowPack}>
            {t("projects:codeSync.showPack")}
          </button>
        ) : null}
        {canMark ? (
          <button type="button" className="prj-btn" disabled={busy} onClick={mark}>
            {t("projects:codeSync.mark")}
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="prj-alert" role="alert">
          {error}
        </p>
      ) : null}
    </article>
  );
}
```

- [ ] **Step 6: Podłącz akcję zapisu**

`mutation.ts`: w typie `ProjectActions` dopisz po `archiveDone`:

```ts
/** Zapisuje `code_commit` w `state.md`; bez argumentu serwer bierze HEAD (stan `no-baseline`). */
markCodeSynced: (commit?: string) => Promise<MutationResult>;
```

`useProjects.ts`: po definicji `saveState` dopisz

```ts
const markCodeSynced = useCallback(
  (commit?: string) => mutate("PUT", "/code-sync", commit === undefined ? {} : { commit }),
  [mutate]
);
```

i w zwracanym obiekcie (po `archiveDone,`) dopisz `markCodeSynced,`.

- [ ] **Step 7: Podłącz UI**

`ProjectList.tsx`: do importów dodaj `import type { CodeSyncDto, ProjectStatusChangeDto, ProjectSummaryDto } from "@/contexts/bc_projects/schemas";` (zastępując istniejący import typów) oraz `import { CodeSyncMarker } from "./ProjectCodeSync";`. Do propsów dopisz `codeSync?: Record<string, CodeSyncDto>;`, a w destrukturyzacji `const { projects, selectedId, onSelect, onSetStatus, codeSync } = props;`. W `<span className="prj-item__meta">` po bloku `stateConfidence` dopisz:

```tsx
<CodeSyncMarker sync={codeSync?.[project.id]} />
```

`ProjectDossier.tsx`: dopisz import `import { ProjectCodeSync } from "./ProjectCodeSync";` i zaraz po `</article>` zamykającym pierwszą kartę (przed `<ProjectSaveState`) wstaw:

```tsx
<ProjectCodeSync
  key={`${project.id}-code-sync`}
  sync={project.codeSync}
  onMark={actions.markCodeSynced}
  onShowPack={() => pack.setRole("refresh")}
/>
```

`ProjectsView.tsx`: dopisz `import { useCodeSync } from "./useCodeSync";`; po wywołaniu `useProjects(...)` (przed wczesnymi `return`) dodaj

```tsx
const codeSync = useCodeSync(props.apiFetch, status === "ready", detail);
```

do `<ProjectList … />` dodaj prop `codeSync={codeSync}`, a w obiekcie `actions={{ … }}` dopisz `markCodeSynced,` (i dopisz `markCodeSynced` do destrukturyzacji wyniku `useProjects`).

`projects.css`: po regule `.prj-item__conf { … }` dopisz

```css
.prj-item__sync {
  font-weight: 600;
}
```

- [ ] **Step 8: Uruchom testy UI**

Run: `npx vitest run tests/unit/features/projects/ tests/unit/i18n/`
Expected: PASS (nowe i istniejące; `ProjectsView.test.tsx` nie zna trasy `code-sync`, ale hook połyka błąd i zostawia pustą mapę).

- [ ] **Step 9: Typecheck i lint (zleć `cursor`)**

```bash
scripts/ask-helper.sh --role task --tier light --approve-allowed cursor "W katalogu Monolith uruchom dokładnie: npx tsc --noEmit 2>&1. Odpowiedz: przeszło albo lista plik:linia + przyczyna. Niczego nie edytuj."
```

Expected: przeszło. Jeśli `tsc` zgłasza brakujące `markCodeSynced` w obiektach typu `ProjectActions` w testach, dopisz tam `markCodeSynced: vi.fn()` (zmiana fixtur, nie logiki). Potem to samo dla `npm run lint`.

- [ ] **Step 10: Commit**

```bash
git add src tests/unit/features/projects
git commit -m "feat(ui): znacznik rozjazdu na liście, blok Stan względem kodu i przycisk oznaczenia karty

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 9: Dokumentacja formatu i korekta specu

**Files:**

- Modify: `docs/nexus-vault-formaty-yaml.md` (nowa sekcja `state.md` przed sekcją „## Bugi”)
- Modify: `docs/superpowers/specs/2026-11-16-rozjazd-karty-z-repo-design.md` (odstępstwa z nagłówka planu)

- [ ] **Step 1: Sekcja `state.md` w formatach**

W `docs/nexus-vault-formaty-yaml.md` przed linią `## Bugi: \`Projects/<projekt>/bugs.md\`` dopisz:

````markdown
## Save State: `Projects/<projekt>/state.md`

Plik aplikacji (formularz „Save State” w karcie Projekty); frontmatter YAML + treść jako notatki.

```yaml
---
branch: main
env: lokalnie
blocker: ""
next_step: Uruchomić testy
links: []
milestone: ""
milestone_due: 2026-12-01 # opcjonalnie
updated: 2026-11-16T20:45 # ustawia aplikacja przy Save State
code_commit: 8c107d7a… # opcjonalnie: sha commita repo, z którym zgadza się karta
---
```

- `code_commit`: pełny (zalecany) lub skrócony sha, 7–40 znaków szesnastkowych. Aplikacja porównuje go z HEAD repo z `local_path` i pokazuje „kod nowszy: N commitów”, gdy repo poszło dalej. Zapisuje go przycisk „Oznacz jako zaktualizowaną” albo agent po odświeżeniu karty (paczka kontekstu w roli „Odśwież kartę” zawiera tę instrukcję).
- Zapis formularza Save State zachowuje `code_commit`; przycisk „Oznacz jako zaktualizowaną” zmienia tylko to pole (nie rusza `updated`).
- Bez `code_commit` (albo bez pliku) karta ma stan „brak punktu odniesienia” i rozjazd nie jest zgłaszany.
````

- [ ] **Step 2: Korekta specu**

Przeczytaj spec i wprowadź cztery zmiany (zachowaj formatowanie tabel prettiera):

1. §2 D7 i §4.1: `head` w `CodeSync` to pełny sha HEAD (UI skraca do 7 znaków); D7 dopisz: gdy DTO nie ma `head` (`no-baseline`), przycisk wysyła puste ciało, a serwer bierze HEAD z chwili zapisu i też sprawdza go przez `readCodeSync`.
2. §4.3 i §7: błąd „commit nie jest równy HEAD ani przodkiem” to `DomainError` 422 (jak inne błędy zapisu w `repositories`), nie 400; zły format sha w ciele PUT to 400 z walidacji zod.
3. §4.4: `CodeSyncMarkInputSchema` ma `commit` opcjonalny.
4. §4.5: rola `refresh` nie ma osobnego budżetu; ma `rulesMax: 1200`, limity 30 commitów i 40 linii diffu oraz kroki redukcji w `composeContextPack` (10 linii diffu, potem 10 commitów); budżet całej paczki zostaje `PACK_BUDGET_TOKENS`.

- [ ] **Step 3: Formatowanie i commit**

```bash
npx prettier --write docs/nexus-vault-formaty-yaml.md docs/superpowers/specs/2026-11-16-rozjazd-karty-z-repo-design.md
git add docs
git commit -m "docs: state.md z code_commit w formatach vaulta, korekta specu po implementacji

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 10: Weryfikacja końcowa

**Files:** brak (tylko polecenia)

- [ ] **Step 1: Pełny zestaw (zleć `cursor`)**

```bash
scripts/ask-helper.sh --role task --tier light --approve-allowed cursor "W katalogu Monolith uruchom po kolei: npx tsc --noEmit 2>&1 ; npx vitest run 2>&1 ; npm run lint 2>&1 ; npm run build 2>&1. Dla każdego odpowiedz: przeszło albo lista plik:linia + przyczyna. Niczego nie edytuj."
```

Expected: cztery razy „przeszło". Pęknięty `tests/unit/architecture.static.test.ts` naprawiamy kodem, nie testem.

- [ ] **Step 2: Sprawdzenie na żywo (tylko odczyt)**

```bash
npm run dev   # port 3100, w osobnym terminalu
curl -s localhost:3100/api/projects/code-sync
curl -s "localhost:3100/api/projects/tester-ai/context-pack?role=refresh" | head -c 1500
```

Expected: mapa JSON ze stanem każdego projektu (dziś bez `state.md` z `code_commit` wszystkie `{"status":"no-baseline"}`), a paczka `refresh` dla `tester-ai` zawiera sekcję „## Zmiany w repo (brak punktu odniesienia; ostatnie commity)” z commitami `8c107d7` i `eeb9481` oraz instrukcją z pełnym HEAD. **Nie wołaj `PUT …/code-sync` na prawdziwym vaulcie** bez zgody użytkownika: zapisałby `state.md` w NEXUS (potem auto-sync). Oznaczenie Tester AI robi użytkownik w UI po przeglądzie.

- [ ] **Step 3: Przegląd diffa przez pomocnika**

```bash
scripts/ask-helper.sh --role review --tier deep --fresh agy "Review diffa gałęzi feat/rozjazd-karty-z-repo względem main (git diff main...HEAD) w katalogu Monolith. Spec: docs/superpowers/specs/2026-11-16-rozjazd-karty-z-repo-design.md. Szukaj: błędów logicznych, naruszeń reguł z CLAUDE.md (konteksty, warstwy), braków w testach. Format: lista do 10 punktów z plik:linia i wagą."
```

(Dopóki limit Argona nie wróci, ok. 2026-11-21, poprzedź komendę `AGY_DEEP_TAG=Hydrogen`.) Opinie traktuj jak hipotezy: zweryfikuj w kodzie, zanim zmienisz.

- [ ] **Step 4: Dalsze kroki**

Wypchnięcie gałęzi i PR na prośbę użytkownika (Monolith: commit/push/PR tylko na prośbę). Opis PR kończy linia `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
