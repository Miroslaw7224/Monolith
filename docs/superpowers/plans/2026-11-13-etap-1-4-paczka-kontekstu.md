# Etap 1-4: paczka kontekstu dla agenta — plan wykonania

> **Dla agenta wykonującego:** wymagany skill: `superpowers:subagent-driven-development` (zalecany) albo `superpowers:executing-plans`. Kroki mają checkboxy (`- [ ]`). Weryfikacja (czerwony → zielony test) należy do wykonawcy: plan celowo nie zawiera pełnych implementacji, tylko interfejsy, reguły i przypadki testowe z oczekiwanymi wartościami (CLAUDE.md, „Pisanie planów”).

**Spec:** `docs/superpowers/specs/2026-11-13-etap-1-4-paczka-kontekstu-design.md` (zatwierdzony, po review pomocników; decyzje D1–D7 są wiążące).
**Gałąź:** `feat/etap-1-4-paczka-kontekstu` (już utworzona, spec zacommitowany: `7e800cd`, `6ee877a`).

**Cel:** przycisk „Kopiuj paczkę kontekstu” w teczce projektu składa na serwerze blok Markdown (zasady, Save State, git, zadania, bugi, devlog) w budżecie ok. 4 tys. tokenów i kopiuje go do schowka.

**Architektura:** nowy katalog infrastruktury `lib/git/` (ścieżka repo, whitelistowany git, odczyt `CLAUDE.md`), cienkie funkcje w `contexts/bc_projects/repositories/index.ts`, czysty kompozytor `services/context-pack.ts` plus `buildContextPack` w `services/index.ts`, trasa `GET /api/projects/[id]/context-pack`, UI `ProjectContextPack.tsx`.

**Stack:** Next.js 14, TypeScript (`strict: false`: unie zawężaj przez `x.ok === false`), vitest (+ Testing Library), `node:child_process` (`execFileSync`), `node:fs` (tylko w `lib/git/`).

## Zasady wykonania (z CLAUDE.md)

- Kierunek importów: `route` → `router` → `services` → `repositories` → `lib/*`. `models.ts` nie importuje `lib/nexus`; UI importuje z kontekstu tylko `schemas` (i typy przez `import type`). **`tests/unit/architecture.static.test.ts` nie jest zmieniany**; pęknięcie naprawia się kodem. Uwaga z review: test zabrania `node:fs` i `process.env` w `contexts/*/repositories*` i ma **zamkniętą listę plików importujących `lib/nexus/vault-fs`** (`VAULT_FS_IMPORTERS`), dlatego nowe funkcje vaultowe dopisujemy do istniejącego `repositories/index.ts`, a nie do nowego pliku.
- Testy, `npx tsc --noEmit`, `npm run lint`, `npm run build` zlecać `cursorowi` (`scripts/ask-helper.sh --role task --approve-allowed cursor "…"`, prośba: „przeszło” albo lista `plik:linia + przyczyna`). Review diffa: `agy --role review` po zadaniach 6 i 9 oraz na końcu (zad. 12).
- Komendy testowe (z katalogu `Monolith`): `npx vitest run <ścieżka>`; pełny zestaw: `npx vitest run`.
- Każdy task kończy się osobnym commitem: `feat(bc_projects): …`, `feat(lib/git): …`, `test(…)`, `docs(…)`; na końcu `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Hook `lint-staged` uruchamia prettier przy commicie.
- Testy w `tests/unit/...` używają aliasów `@/…`; testy czysto serwerowe zaczynają się od `// @vitest-environment node`.

## Mapa plików

| Plik                                                                           | Zmiana        | Odpowiedzialność                                                                               |
| ------------------------------------------------------------------------------ | ------------- | ---------------------------------------------------------------------------------------------- |
| `lib/git/repo-path.ts`                                                         | nowy          | `resolveRepoPath`: `local_path` → bezpieczny katalog repo albo powód odmowy                    |
| `lib/git/project-git.ts`                                                       | nowy          | `runGit` (biała lista `status`/`log`/`diff`), `snapshotRepo`                                   |
| `lib/git/repo-file.ts`                                                         | nowy          | `readRepoFile(repoDir, "CLAUDE.md")`: zwykły plik, limit 64 KB                                 |
| `tests/unit/helpers/tempGit.ts`                                                | nowy          | `useTempRepos()`: tymczasowe repozytoria git do testów                                         |
| `contexts/bc_projects/models.ts`                                               | zmiana        | typy: `GitSnapshot`, `GitSnapshotResult`, `RepoRulesResult`, `IndexRuleSection`, `ContextPack` |
| `contexts/bc_projects/repositories/index.ts`                                   | zmiana        | `readGitSnapshot`, `readRepoRules`, `readAiContext`, `readIndexRules`                          |
| `contexts/bc_projects/services.ts` → `services/index.ts`                       | przeniesienie | bez zmian treści (`git mv`), potem `buildContextPack`                                          |
| `contexts/bc_projects/services/context-pack.ts`                                | nowy          | czysty `composeContextPack(input, budget)`                                                     |
| `contexts/bc_projects/schemas.ts`                                              | zmiana        | `ContextPackDto`, `toContextPackDto`                                                           |
| `contexts/bc_projects/router.ts`                                               | zmiana        | `getContextPack`                                                                               |
| `app/api/projects/[id]/context-pack/route.ts`                                  | nowy          | re-eksport `GET`                                                                               |
| `src/features/projects/mutation.ts`                                            | zmiana        | `ContextPackResult`, `ProjectActions.loadContextPack`                                          |
| `src/features/projects/useProjects.ts`                                         | zmiana        | `loadContextPack`                                                                              |
| `src/features/projects/ProjectContextPack.tsx`                                 | nowy          | przycisk + komunikat inline                                                                    |
| `src/features/projects/ProjectDossier.tsx`, `ProjectsView.tsx`, `projects.css` | zmiana        | wpięcie komponentu                                                                             |
| `NEXUS/Vault/Projects/_registry.yaml`, 6× `index.md`                           | zmiana        | `local_path` na ścieżki WSL (osobne repo, osobny commit)                                       |
| `CLAUDE.md`, `docs/adr/021-struktura-kontekstow-wg-vaulta-nexus.md`            | zmiana        | wzmianka o `lib/git/`                                                                          |

---

### Task 1: Plan i drobne poprawki specu

**Files:** `docs/superpowers/plans/2026-11-13-etap-1-4-paczka-kontekstu.md`, `docs/superpowers/specs/2026-11-13-etap-1-4-paczka-kontekstu-design.md`

- [ ] **Step 1:** W specu dopisz dwie decyzje wynikające z projektowania planu (jedno zdanie każda):
  - D5: „Gdy brak `state.md`, a `index.md` ma „Gdzie skończyłem”, sekcja `## Gdzie skończyłem (brak state.md)` zastępuje Save State (żaden projekt nie ma dziś `state.md`); nie podlega skracaniu.”
  - D6 i §5: komunikat obcięcia `diff --stat` to „… i N więcej linii” (a nie „plików”; ostatnia linia `diff --stat` to podsumowanie, nie plik).
- [ ] **Step 2:** `git add` plan i spec; `git commit -m "docs(plan): etap 1-4 paczka kontekstu (+ drobne poprawki specu)"` (+ trailer).

---

### Task 2: `lib/git/repo-path.ts` — bezpieczna ścieżka repo

**Files:** Create `lib/git/repo-path.ts`; Test `tests/unit/lib/git/repo-path.test.ts`

**Interfejs:**

```ts
export type RepoPathReason = "unsupported-path" | "outside-home" | "missing" | "not-a-repo";
export type RepoPathResult = { ok: true; path: string } | { ok: false; reason: RepoPathReason };
/** `home` tylko dla testów; domyślnie `os.homedir()`. */
export function resolveRepoPath(localPath: string, opts?: { home?: string }): RepoPathResult;
```

**Reguły (w tej kolejności):**

1. `localPath.trim()` puste, zaczyna się od `/mnt/` (po normalizacji `path.posix.normalize`), albo nie jest ani `~`/`~/…`, ani bezwzględne w stylu POSIX (np. `E:\x`, `p`) → `unsupported-path`.
2. `~` i `~/rest` rozwijane na `home`, potem `path.posix.normalize` (zjada `..`); wynik zaczynający się od `/mnt/` → `unsupported-path`.
3. `fs.realpathSync` rzuca (brak katalogu) → `missing`. Wynik `realpath` musi leżeć w `realpath(home)` (równy lub z prefiksem `home + "/"`) i nie zaczynać się od `/mnt/`, inaczej `outside-home`.
4. `lstat(<path>/.git)` nie istnieje → `not-a-repo` (katalog **albo plik** `.git` wystarcza, to worktree; git nie szuka repo wyżej). Zwracamy `{ ok: true, path: <realpath> }`.

- [ ] **Step 1: Test (czerwony).** Fixture: `home = realpathSync(mkdtempSync(os.tmpdir()/prj-home-))`, sprzątanie w `afterEach`. Przypadki:

| wejście (home = `H`)                                              | oczekiwane                     |
| ----------------------------------------------------------------- | ------------------------------ |
| `~/p`, gdzie `H/p/.git/` jest katalogiem                          | `{ ok: true, path: H + "/p" }` |
| `H + "/p"` (bezwzględna)                                          | to samo                        |
| `H/p/.git` jest **plikiem** (`gitdir: x`)                         | `{ ok: true, path: H + "/p" }` |
| `E:\\x\\y`, `""`, `"   "`, `"p"` (względna)                       | `unsupported-path`             |
| `/mnt/c/x`, `~/../../mnt/c/x` (przy `H` w `/tmp/…`)               | `unsupported-path`             |
| `~/../sibling`, gdzie `dirname(H)/sibling/.git` istnieje          | `outside-home`                 |
| `~/link`, gdzie `H/link` → symlink do katalogu poza `H` z `.git`  | `outside-home`                 |
| `~/nope` (nie istnieje)                                           | `missing`                      |
| `~/sub` bez `.git`, a `H/.git/` istnieje (nie wolno szukać wyżej) | `not-a-repo`                   |

- [ ] **Step 2:** `npx vitest run tests/unit/lib/git/repo-path.test.ts` → FAIL (brak modułu).
- [ ] **Step 3:** Zaimplementuj `resolveRepoPath` zgodnie z regułami (`node:fs`, `node:os`, `node:path`; bez `lib/nexus`, bez `contexts`).
- [ ] **Step 4:** ten sam test → PASS.
- [ ] **Step 5:** `git add lib/git/repo-path.ts tests/unit/lib/git/repo-path.test.ts && git commit -m "feat(lib/git): resolveRepoPath, bezpieczna ścieżka repozytorium projektu"`.

---

### Task 3: `lib/git/project-git.ts` + helper `tempGit`

**Files:** Create `lib/git/project-git.ts`, `tests/unit/helpers/tempGit.ts`; Test `tests/unit/lib/git/project-git.test.ts`

**Interfejs:**

```ts
export type GitCommand = "status" | "log" | "diff";
/** Surowe wyjście; status != 0 przy błędzie, limicie czasu lub braku gita. Nieznane polecenie: `throw new Error("git: polecenie spoza białej listy: …")`. */
export function runGit(repoDir: string, command: GitCommand): { status: number; stdout: string };
export type GitSnapshot = { status: string; log: string; diffStat: string };
export type SnapshotResult =
  | { ok: true; snapshot: GitSnapshot }
  | { ok: false; reason: "git-error" };
/** `repoDir` musi pochodzić z `resolveRepoPath`. Pola przycięte (`trimEnd`). */
export function snapshotRepo(repoDir: string): SnapshotResult;
```

**Reguły `runGit`:** `execFileSync("git", args, …)`, bez powłoki. Stałe argumenty (przedrostek `GIT_PREFIX = ["--no-pager", "-c", "core.fsmonitor=false", "-c", "core.hooksPath=/dev/null"]`):
`status` → `[...GIT_PREFIX, "status", "--short", "--branch"]`; `log` → `[...GIT_PREFIX, "log", "-5", "--oneline", "--no-decorate"]`; `diff` → `[...GIT_PREFIX, "diff", "--stat", "--no-ext-diff"]`. Opcje: `cwd: repoDir`, `encoding: "utf8"`, `timeout: 5000`, `maxBuffer: 262144`, `stdio: ["ignore", "pipe", "ignore"]`, `env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0", GIT_CEILING_DIRECTORIES: path.dirname(repoDir) }`. Wzorzec: `lib/workGuard.ts` (`defaultGitRunner`).
**Reguły `snapshotRepo`:** `status` z błędem → `{ ok: false, reason: "git-error" }`; błąd `log` albo `diff` (np. repo bez commitów) → puste pole, nie błąd.

**Helper `tests/unit/helpers/tempGit.ts`** (wzorzec: `tests/unit/helpers/tempVault.ts`):

```ts
export type TempRepo = {
  readonly dir: string; // realpath katalogu repo
  write(rel: string, text: string): void;
  commit(message: string): void; // git add -A && git commit (lokalna tożsamość, bez gpg)
};
export function useTempRepos(): { create(): TempRepo }; // sprzątanie w afterEach
```

`create()` robi `git init -b main` w `mkdtemp(os.tmpdir()/prj-repo-)`; polecenia przez `execFileSync("git", ["-c","user.name=t","-c","user.email=t@t","-c","commit.gpgsign=false", …], { cwd })`.

- [ ] **Step 1: Test (czerwony)** — `// @vitest-environment node`. Przypadki:

| scenariusz                                                                                 | oczekiwane                                                                                                |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| repo z jednym commitem `init` (plik `a.txt`), czysto                                       | `ok: true`; `status === "## main"`; `log` pasuje do `/^[0-9a-f]{7,} init$/`; `diffStat === ""`            |
| jak wyżej + `write("a.txt","zmiana")` bez commita                                          | `status` zawiera `" M a.txt"`; `diffStat` zawiera `a.txt`                                                 |
| 7 commitów                                                                                 | `log.split("\n")` ma długość 5, pierwsza linia kończy się nazwą ostatniego commita                        |
| repo bez commitów                                                                          | `ok: true`; `status` zaczyna się od `## No commits yet`; `log === ""`                                     |
| katalog bez `.git` w `os.tmpdir()`                                                         | `{ ok: false, reason: "git-error" }` (`GIT_CEILING_DIRECTORIES` zatrzymuje szukanie wyżej)                |
| `runGit(dir, "push" as GitCommand)`                                                        | rzuca `/spoza białej listy/`                                                                              |
| repo z `git config core.fsmonitor <abs>/hook.sh` (skrypt `touch <abs>/marker`, `chmod +x`) | po `snapshotRepo(dir)` plik `marker` **nie istnieje** (bez `-c core.fsmonitor=false` hook by się wykonał) |

- [ ] **Step 2:** `npx vitest run tests/unit/lib/git/project-git.test.ts` → FAIL.
- [ ] **Step 3:** helper + `project-git.ts`.
- [ ] **Step 4:** PASS. Jeśli test fsmonitor jest zielony od razu, sprawdź ręcznie, że po usunięciu `-c core.fsmonitor=false` marker się pojawia (czerwona faza dla obrony); jeśli git nie wykonuje hooka dla `status` w tym środowisku, zamień test na asercję, że `runGit` przekazuje `-c core.fsmonitor=false` (przez wstrzykiwany `exec`), i opisz odchylenie w sekcji „Odchylenia”.
- [ ] **Step 5:** `git add lib/git/project-git.ts tests/unit/helpers/tempGit.ts tests/unit/lib/git/project-git.test.ts && git commit -m "feat(lib/git): runGit z białą listą i snapshotRepo (status, log, diff --stat)"`.

---

### Task 4: `lib/git/repo-file.ts`

**Files:** Create `lib/git/repo-file.ts`; Test `tests/unit/lib/git/repo-file.test.ts`

**Interfejs:**

```ts
export const REPO_FILE_MAX_BYTES = 64 * 1024;
export type RepoFileName = "CLAUDE.md";
export type RepoFileResult =
  | { ok: true; text: string }
  | { ok: false; reason: "missing" | "unsafe" };
export function readRepoFile(repoDir: string, name: RepoFileName): RepoFileResult;
```

**Reguły:** `lstat(path.join(repoDir, name))`: ENOENT → `missing`; symlink, nie zwykły plik albo `size > REPO_FILE_MAX_BYTES` → `unsafe`; inaczej treść UTF-8. `name` to literał z unii (brak ścieżek od użytkownika).

- [ ] **Step 1: Test (czerwony)** — katalog tymczasowy: zwykły `CLAUDE.md` „# Zasady\nX” → `{ ok: true, text: "# Zasady\nX" }`; brak pliku → `missing`; `CLAUDE.md` jako symlink do innego pliku → `unsafe`; plik 65 536 bajtów → `ok: true`; plik 65 537 bajtów → `unsafe`; `CLAUDE.md` jako katalog → `unsafe`.
- [ ] **Step 2:** FAIL → **Step 3:** implementacja → **Step 4:** PASS.
- [ ] **Step 5:** `git add lib/git/repo-file.ts tests/unit/lib/git/repo-file.test.ts && git commit -m "feat(lib/git): readRepoFile (CLAUDE.md, bez symlinków, limit 64 KB)"`.

---

### Task 5: modele i funkcje `repositories` dla paczki

**Files:** Modify `contexts/bc_projects/models.ts`, `contexts/bc_projects/repositories/index.ts`; Test `tests/unit/contexts/bc_projects/repositories.context-pack.test.ts`

**Typy (dopisz na końcu `models.ts`; nie importują `lib/git`, są strukturalnie zgodne):**

```ts
export type RepoUnavailableReason =
  | "unsupported-path"
  | "outside-home"
  | "missing"
  | "not-a-repo"
  | "git-error";
export type GitSnapshot = { status: string; log: string; diffStat: string };
export type GitSnapshotResult =
  | { ok: true; snapshot: GitSnapshot }
  | { ok: false; reason: RepoUnavailableReason };
export type RepoRulesResult =
  | { ok: true; text: string }
  | { ok: false; reason: RepoUnavailableReason | "no-file" | "unsafe-file" };
export type IndexRuleSection = { heading: string; body: string };
export type ContextPack = {
  markdown: string;
  approxTokens: number;
  truncated: boolean;
  warnings: string[];
};
```

**Funkcje w `repositories/index.ts`** (bez `fs` i `process.env`; importują `@/lib/git/repo-path`, `@/lib/git/project-git`, `@/lib/git/repo-file`):

```ts
export function readGitSnapshot(entry: RegistryEntry): GitSnapshotResult;
export function readRepoRules(entry: RegistryEntry): RepoRulesResult;
export function readAiContext(entry: RegistryEntry): string | null;
export function readIndexRules(entry: RegistryEntry): IndexRuleSection[];
```

**Reguły:**

- `readGitSnapshot`: `resolveRepoPath(entry.localPath)`; `ok === false` → `{ ok: false, reason }`; potem `snapshotRepo(path)` (jego `{ ok:false, reason:"git-error" }` przepuszczamy).
- `readRepoRules`: jak wyżej do `resolveRepoPath`; potem `readRepoFile(path, "CLAUDE.md")`: `missing` → `no-file`, `unsafe` → `unsafe-file`, `ok` → `{ ok: true, text }`.
- `readAiContext`: `readVaultFile(projectPath(entry.folder, "ai-context.md"))`; brak pliku lub treść po `trim()` pusta → `null`; inaczej przycięta treść.
- `readIndexRules`: `readVaultFile(projectPath(entry.folder, "index.md"))`; brak → `[]`; treść bez frontmattera (`parseFrontmatter(text)?.body ?? text`) → `parseSections`; zwróć w kolejności pliku sekcje o nagłówkach dokładnie `Tech Stack`, `Architektura`, `Pułapki` (`{ heading, body }`, `body` już przycięte przez `parseSections`), pomijając puste ciała.

- [ ] **Step 1: Test (czerwony)** — `// @vitest-environment node`, `useTempVault()`; wpis `RegistryEntry` z `folder: "Projects/a/"`. Dla `readGitSnapshot`/`readRepoRules` osobny `describe` z `vi.mock` trzech modułów `lib/git` (hoisted mocki):

| funkcja                  | scenariusz                                                                                                | oczekiwane                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `readAiContext`          | plik `Projects/a/ai-context.md` = `"\n  Reguły\n"`                                                        | `"Reguły"`                                                      |
| `readAiContext`          | brak pliku; plik z samymi spacjami                                                                        | `null`; `null`                                                  |
| `readIndexRules`         | `index.md`: frontmatter, potem `## Tech Stack\nNext\n\n## Inne\nX\n\n## Architektura\nA\n\n## Pułapki\nP` | `[{Tech Stack,"Next"},{Architektura,"A"},{Pułapki,"P"}]`        |
| `readIndexRules`         | `index.md` bez żadnej z trzech sekcji; brak `index.md`                                                    | `[]`; `[]`                                                      |
| `readGitSnapshot` (mock) | `resolveRepoPath` → `{ ok:false, reason:"outside-home" }`                                                 | `{ ok:false, reason:"outside-home" }`, `snapshotRepo` niewołane |
| `readGitSnapshot` (mock) | `resolveRepoPath` → `{ ok:true, path:"/h/p" }`, `snapshotRepo("/h/p")` → snapshot                         | `{ ok:true, snapshot }`                                         |
| `readRepoRules` (mock)   | `readRepoFile` → `missing` / `unsafe` / `{ok:true,text:"T"}`                                              | `no-file` / `unsafe-file` / `{ ok:true, text:"T" }`             |

- [ ] **Step 2:** `npx vitest run tests/unit/contexts/bc_projects/repositories.context-pack.test.ts` → FAIL.
- [ ] **Step 3:** typy + funkcje. **Step 4:** PASS, plus `npx vitest run tests/unit/architecture.static.test.ts tests/unit/contexts/bc_projects` (nic nie pęka: brak `fs`/`process.env` w `repositories`).
- [ ] **Step 5:** `git add contexts/bc_projects/models.ts contexts/bc_projects/repositories/index.ts tests/unit/contexts/bc_projects/repositories.context-pack.test.ts && git commit -m "feat(bc_projects): odczyty źródeł paczki kontekstu (git, CLAUDE.md, ai-context, index)"`.

---

### Task 6: `services/` jako folder + `composeContextPack`

**Files:** `git mv contexts/bc_projects/services.ts contexts/bc_projects/services/index.ts`; Create `contexts/bc_projects/services/context-pack.ts`; Test `tests/unit/contexts/bc_projects/context-pack.compose.test.ts`

- [ ] **Step 1: Przeniesienie bez zmian treści.** `mkdir contexts/bc_projects/services && git mv contexts/bc_projects/services.ts contexts/bc_projects/services/index.ts`. Importy `@/contexts/bc_projects/services` i `./services` działają dalej (rozwiązują się do `index.ts`). Uruchom `npx vitest run tests/unit/architecture.static.test.ts tests/unit/contexts/bc_projects` → PASS. Commit: `refactor(bc_projects): services jako folder (przygotowanie pod context-pack)`.
- [ ] **Step 2: Interfejs `context-pack.ts` (czysty, bez I/O):**

```ts
import type {
  ContextPack,
  GitSnapshotResult,
  ProjectWithContent,
  RepoUnavailableReason,
} from "@/contexts/bc_projects/models";

export const PACK_BUDGET_TOKENS = 4000;
export const estimateTokens = (text: string): number => Math.ceil(text.length / 4);
export const REPO_REASON_TEXT: Record<RepoUnavailableReason, string> = {
  "unsupported-path": "ścieżka spoza WSL",
  "outside-home": "ścieżka poza katalogiem domowym",
  missing: "katalog nie istnieje",
  "not-a-repo": "to nie jest repozytorium git",
  "git-error": "git zwrócił błąd",
};
export type PackRules = { source: "ai-context.md" | "CLAUDE.md" | "index.md"; text: string };
export type ContextPackInput = {
  project: ProjectWithContent;
  /** wynik `effectiveLastWorked(...)`; `undefined`, gdy brak */
  lastWorked: string | undefined;
  rules: PackRules | null;
  git: GitSnapshotResult;
  /** ostrzeżenia zebrane przez `buildContextPack`; kompozytor dopisuje własne */
  warnings: string[];
};
export function composeContextPack(input: ContextPackInput, budgetTokens?: number): ContextPack;
```

**Format sekcji (dokładne ciągi; sekcje puste pomijane; łączenie `"\n\n"`):**

1. Nagłówek: `# Kontekst projektu: <name>` + pusta linia + `Status: <status> · priorytet: <priority> · ostatnia praca: <lastWorked ? \`${lastWorked} (${etykieta})\` : "brak danych">`, gdzie etykieta: `fresh`→`świeży`, `stale`→`nieświeży`, `unknown`→`brak danych`.
2. Zasady: `## Zasady projektu (źródło: <source>)\n\n<text>` (dla `index.md` `text` składa `buildContextPack`, patrz zad. 7).
3. Save State (gdy `state` nie jest `null`): `## Save State\n\nBranch: <branch||"—"> · Środowisko: <env||"—">\nBloker: <blocker||"brak">\nNastępny krok: <nextStep||"—">` + gdy `milestone` niepuste linia `Kamień milowy: <milestone>` (+ ` · do <milestoneDue>` gdy jest). Gdy `state === null`, a `project.whereIStopped` niepuste: `## Gdzie skończyłem (brak state.md)\n\n<whereIStopped>`. Żadna z tych dwóch sekcji nie podlega skracaniu.
4. Kod: `git.ok === false` → `## Kod (git)\n\nRepozytorium niedostępne (<REPO_REASON_TEXT[reason]>).`; inaczej `## Kod (git)\n\n` + `Status:\n\`\`\`\n<status>\n\`\`\``+ (gdy`logLines>0`) `\n\nOstatnie commity:\n\`\`\`\n<log>\n\`\`\``+ (gdy`diff`włączony i`diffStat`niepusty)`\n\nZmiany (diff --stat):\n\`\`\`\n<diffStat>\n\`\`\``.
5. Zadania: tylko `board.blockers` i `board.now` z `done === false`: `## Zadania` + dla niepustych podsekcji `\n\n### Blokery\n- <text>` / `\n\n### Teraz\n- <text>`; brak obu → sekcja pominięta.
6. Bugi: `bugs` z `section !== "Zamknięte"`: `## Bugi (otwarte)\n\n` + linie `- <id>: <title>` + (gdy `priority`) ` [<priority>]` + (gdy `status`) ` (<status>)`.
7. Devlog: pierwsze `n` wpisów (najnowsze są pierwsze): `## Devlog (ostatnie <n>)\n\n` + linie `- <date||"—">: <title>` + (gdy `why`) ` — <why>`; `n` początkowo `min(3, devlog.length)`.

**Pokrętła i kroki redukcji (D6)** — stan `{ diffLines: 40, logCount: 5, diff: true, devlog: 3, rulesMax: Infinity }`; `limitLines(text, n)`: gdy linii > n, pierwsze n linii + linia `… i <reszta> więcej linii`. Renderuj; gdy `estimateTokens(markdown) > budget`, wykonuj po kolei kroki, **pomijając niestosowalne** (nic by nie zmieniły), po każdym stosowalnym renderuj i sprawdzaj:

| krok | zmiana                                                                                                        | stosowalny, gdy                              |
| ---- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 1    | `diffLines = 10`                                                                                              | `diffStat` ma > 10 linii                     |
| 2    | `logCount = 3`                                                                                                | `log` ma > 3 linie                           |
| 3    | `diff = false`                                                                                                | `diffStat` niepusty                          |
| 4    | `devlog = 2`                                                                                                  | `devlog.length > 2`                          |
| 5    | `devlog = 1`                                                                                                  | `devlog.length > 1`                          |
| 6    | `rulesMax = max(800, floor(min(len, rulesMax) / 2))`, powtarzany dopóki `rulesMax > 800` i nadal ponad budżet | `rules.text.length > 800` i `rulesMax > 800` |

`cutAtParagraph(text, max)`: `text.length <= max` → bez zmian; inaczej `s = text.slice(0, max)`, `i = s.lastIndexOf("\n\n")`, `base = i > 0 ? s.slice(0, i) : s`, wynik `base.trimEnd() + "\n\n…"`. Domyślny `budgetTokens = PACK_BUDGET_TOKENS`. Wynik: `truncated` = wykonano choć jeden krok; `approxTokens = estimateTokens(markdown)`; gdy po wyczerpaniu kroków nadal ponad budżet, do `warnings` dochodzi `"Paczka ponad budżet (~<approxTokens> tokenów)"`. `warnings` wyniku = `input.warnings` + ewentualne własne.

- [ ] **Step 3: Test (czerwony)** — `// @vitest-environment node`; fixture `ProjectWithContent` (jak `detailProject` w `router.test.ts`) z pełnym stanem, tablicą (`blockers: [{text:"B1",done:false}]`, `now: [{text:"N1",done:false},{text:"N2",done:true}]`), 2 bugami aktywnymi + 1 `section:"Zamknięte"`, devlogiem 3 wpisów, git ok z `diffStat` 30 linii i `log` 5 linii, zasady 3000 znaków. Przypadki:
  1. Pełna paczka (budżet 1 000 000): zawiera dokładnie sekcje 1–7 w tej kolejności (sprawdź indeksy `indexOf` rosnące); `Zadania` zawiera `B1` i `N1`, **nie** `N2`; bugi zamknięte nieobecne; `truncated === false`; `approxTokens === Math.ceil(markdown.length / 4)`; `warnings` równe wejściowym.
  2. `git: { ok:false, reason:"unsupported-path" }` → zawiera `Repozytorium niedostępne (ścieżka spoza WSL).`, brak bloków ``` w sekcji Kod, reszta sekcji obecna.
  3. `rules: null`, `state: null`, `whereIStopped: "tu"` → brak `## Zasady`, jest `## Gdzie skończyłem (brak state.md)\n\ntu`; `state: null`, `whereIStopped: null` → żadna z dwóch sekcji.
  4. Nagłówek: `lastWorked: "2026-11-10"`, `freshness: "fresh"` → `ostatnia praca: 2026-11-10 (świeży)`; `lastWorked: undefined`, `unknown` → `ostatnia praca: brak danych` (bez nawiasu).
  5. Kolejność kroków: `full = composeContextPack(input, 1e6)`; `r = composeContextPack(input, full.approxTokens - 1)` → `r.truncated === true`, `r.approxTokens < full.approxTokens`, w `r.markdown` jest dokładnie 10 linii statystyki + `… i <N> więcej linii`, nadal 5 commitów i 3 wpisy devlogu (krok 1 wystarcza, jeśli różnica ≤ oszczędność kroku 1; dobierz wielkość `diffStat` w fixture tak, by `full.approxTokens - r1.approxTokens ≥ 1` dla samego kroku 1).
  6. Budżet 0: wszystkie kroki wykonane — brak `Zmiany (diff --stat)`, `log` ma 3 linie, devlog ma 1 wpis (`## Devlog (ostatnie 1)`), tekst zasad ≤ 800 znaków + `…`, `truncated === true`, `warnings` zawiera `Paczka ponad budżet`. Save State, Zadania i Bugi **identyczne** jak w pełnej paczce (porównaj podciągi sekcji).
  7. Monotoniczność: dla budżetów `full.approxTokens … 0` co ~50 tokenów `approxTokens` nie rośnie; sekcje chronione zawsze obecne.
  8. `diffStat` o 100 liniach przy dużym budżecie → w wyniku 40 linii + `… i 60 więcej linii`, `truncated === false` (limit 40 to stała, nie krok redukcji).
- [ ] **Step 4:** `npx vitest run tests/unit/contexts/bc_projects/context-pack.compose.test.ts` → FAIL. **Step 5:** implementacja `composeContextPack` → PASS.
- [ ] **Step 6:** `git add contexts/bc_projects/services/context-pack.ts tests/unit/contexts/bc_projects/context-pack.compose.test.ts && git commit -m "feat(bc_projects): composeContextPack, składanie i budżet paczki kontekstu"`.
- [ ] **Step 7:** review diffa tego i poprzednich tasków przez `agy` (`--role review`, `--fresh`): poprosić o zgodność z ADR-021 i o zgodność formatu z §4 specu.

---

### Task 7: `buildContextPack` w `services/index.ts`

**Files:** Modify `contexts/bc_projects/services/index.ts`; Test `tests/unit/contexts/bc_projects/services.context-pack.test.ts`

**Interfejs:**

```ts
export function buildContextPack(id: string, today: Date = new Date()): ContextPack;
```

**Reguły:**

1. `entry = findEntry(id)` (rzuca `NotFoundError`), `project = getProject(id, today)`, `lastWorked = effectiveLastWorked(project.lastWorked, project.state?.updated)`.
2. `git = readGitSnapshot(entry)`; gdy `ok === false`: ostrzeżenie `Kod: repozytorium niedostępne (<REPO_REASON_TEXT[reason]>)`.
3. Zasady, pierwsze dostępne: `readAiContext(entry)` niepuste → `{ source: "ai-context.md", text }`; potem `readRepoRules(entry)`: `ok` → `{ source: "CLAUDE.md", text }`, `reason === "unsafe-file"` → ostrzeżenie `CLAUDE.md pominięty (symlink, zbyt duży lub nie jest zwykłym plikiem)` i dalej; pozostałe powody bez ostrzeżenia (powód niedostępności repo opisuje już ostrzeżenie z pkt 2); potem `readIndexRules(entry)` niepuste → `{ source: "index.md", text: sekcje.map(s => \`### ${s.heading}\n\n${s.body}\`).join("\n\n") }`; inaczej `null`.
4. Zwróć `composeContextPack({ project, lastWorked, rules, git, warnings })`.
5. Brak `state.md`, `devlog.md`, `ai-context.md` **nie** daje ostrzeżenia.

- [ ] **Step 1: Test (czerwony)** — wzorzec z `services.test.ts` (`vi.hoisted` + `vi.mock("@/contexts/bc_projects/repositories", …)` z funkcjami: `readRegistry`, `readProjectIndex`, `readProjectContent`, `readProjectState`, `readDevlog`, `readProjectBoard`, `readGitSnapshot`, `readRepoRules`, `readAiContext`, `readIndexRules`); `TODAY = new Date(2026, 10, 12)`. Przypadki:
  1. nieznany `id` → `NotFoundError`.
  2. `readGitSnapshot` → `{ ok:false, reason:"unsupported-path" }`, `readRepoRules` → to samo: `markdown` zawiera `Repozytorium niedostępne (ścieżka spoza WSL).`, `warnings` zawiera `Kod: repozytorium niedostępne (ścieżka spoza WSL)`, Save State obecny.
  3. Priorytet źródeł: `aiContext "AI"`, CLAUDE `ok "CL"`, index `[{Tech Stack,"TS"}]` → `## Zasady projektu (źródło: ai-context.md)` i `AI`, bez `CL` i `TS`; `aiContext null` → `źródło: CLAUDE.md`; oba braki → `źródło: index.md` i `### Tech Stack\n\nTS`; wszystkie puste → brak `## Zasady`.
  4. `readRepoRules` → `{ ok:false, reason:"unsafe-file" }`, index niepusty: źródło `index.md`, `warnings` zawiera `CLAUDE.md pominięty`; `reason:"no-file"` → bez ostrzeżenia.
  5. Data: index `lastWorked "2026-11-01"`, `state.updated "2026-11-10T09:00"` → `ostatnia praca: 2026-11-10T09:00 (świeży)`.
  6. Brak `state`, `devlog` i `ai-context` przy działającym gicie → `warnings` równe `[]`.
- [ ] **Step 2:** FAIL → **Step 3:** implementacja (importy z `./context-pack`) → **Step 4:** PASS + `npx vitest run tests/unit/contexts/bc_projects tests/unit/architecture.static.test.ts`.
- [ ] **Step 5:** `git add contexts/bc_projects/services/index.ts tests/unit/contexts/bc_projects/services.context-pack.test.ts && git commit -m "feat(bc_projects): buildContextPack (źródła zasad, git, ostrzeżenia)"`.

---

### Task 8: DTO, handler i trasa

**Files:** Modify `contexts/bc_projects/schemas.ts`, `contexts/bc_projects/router.ts`, `tests/unit/contexts/bc_projects/router.test.ts`; Create `app/api/projects/[id]/context-pack/route.ts`

**Interfejsy:**

```ts
// schemas.ts
export type ContextPackDto = {
  markdown: string;
  approxTokens: number;
  truncated: boolean;
  warnings: string[];
};
export function toContextPackDto(p: ContextPack): ContextPackDto; // kopiuje cztery pola
// router.ts
export async function getContextPack(_req: NextRequest, ctx: RouteContext): Promise<NextResponse>;
// route.ts
export { getContextPack as GET } from "@/contexts/bc_projects/router";
```

Handler: `const { id } = await ctx.params; return NextResponse.json(toContextPackDto(services.buildContextPack(id)))`, błędy przez `handleServiceError(err)` (jak `getProject`).

- [ ] **Step 1: Test (czerwony)** — w `router.test.ts` dodaj `buildContextPack: mockBuildContextPack` do fabryki `vi.mock("@/contexts/bc_projects/services", …)` oraz `import { GET as packGET } from "@/app/api/projects/[id]/context-pack/route"`. Przypadki: (a) `mockBuildContextPack` → `{ markdown:"# X", approxTokens:2, truncated:false, warnings:["w"] }`: status 200, body równe temu obiektowi, mock wołany z `"a"`; (b) rzuca `NotFoundError("Nie ma projektu o id zz")`: status 404; (c) rzuca `VaultConfigError`: status taki jak dla `detailGET` w istniejących testach (skopiuj oczekiwanie z testu „błąd konfiguracji” detalu).
- [ ] **Step 2:** FAIL → **Step 3:** implementacja → **Step 4:** `npx vitest run tests/unit/contexts/bc_projects/router.test.ts tests/unit/architecture.static.test.ts` → PASS (R4: trasa to jeden re-eksport).
- [ ] **Step 5:** `git add contexts/bc_projects/schemas.ts contexts/bc_projects/router.ts "app/api/projects/[id]/context-pack/route.ts" tests/unit/contexts/bc_projects/router.test.ts && git commit -m "feat(bc_projects): GET /api/projects/[id]/context-pack"`.

---

### Task 9: UI — hook, komponent, wpięcie

**Files:** Modify `src/features/projects/mutation.ts`, `useProjects.ts`, `ProjectsView.tsx`, `ProjectDossier.tsx`, `projects.css`; Create `src/features/projects/ProjectContextPack.tsx`; Test `tests/unit/features/projects/ProjectContextPack.test.tsx`, `tests/unit/features/projects/useProjects.test.tsx` (nowy `it`)

**Interfejsy:**

```ts
// mutation.ts
export type ContextPackResult = { ok: true; pack: ContextPackDto } | { ok: false; error: string };
// ProjectActions dostaje: loadContextPack: () => Promise<ContextPackResult>;
// ProjectContextPack.tsx
export function ProjectContextPack(props: {
  onLoad: () => Promise<ContextPackResult>;
}): React.JSX.Element;
```

**Reguły `loadContextPack` (w `useProjects`, poza `mutate`, bo to odczyt):** `id = selectedIdRef.current`; `null` → `{ ok:false, error:"Nie wybrano projektu" }`; `apiFetch(\`/api/projects/${encodeURIComponent(id)}/context-pack\`)`(domyślne`GET`); `!res.ok`→`{ ok:false, error: await readError(res) }`; inaczej `{ ok:true, pack: await res.json() }`; wyjątek → `{ ok:false, error: message }`. Dodaj do zwracanego obiektu hooka i do obiektu `actions`w`ProjectsView.tsx`.

**Reguły `ProjectContextPack`:** przycisk `Kopiuj paczkę kontekstu` (`className="prj-btn"`), wyłączony w trakcie ładowania. Po kliknięciu: `onLoad()`; błąd → `<p className="prj-alert" role="alert">{error}</p>`; sukces → `await navigator.clipboard.writeText(pack.markdown)` (odrzucenie → alert `Nie udało się skopiować do schowka`); potem `<p className="prj-pack__note" role="status">Skopiowano paczkę kontekstu (~<N> tys. tokenów)</p>`, gdzie `N = (approxTokens / 1000).toFixed(1).replace(".", ",")`, z dopiskiem ` · skrócona do budżetu`, gdy `truncated`; ostrzeżenia (`warnings`) w osobnym `<p className="prj-pack__note" role="status">` złączone `" · "`. Nowe kliknięcie czyści poprzedni komunikat. W `ProjectDossier` komponent w `prj-card__head` (po bloku z tytułem), `key={project.id}` żeby komunikat nie przechodził między projektami. CSS: `.prj-pack { display: flex; flex-direction: column; align-items: flex-end; gap: var(--s-2); }`, `.prj-pack__note { margin: 0; font: 500 var(--fs-xs) / 1.4 var(--font-mono); color: var(--text); }`.

- [ ] **Step 1: Testy (czerwone).** `ProjectContextPack.test.tsx` (wzorzec: `ProjectDevlog.test.tsx`; **stub schowka ustaw po `userEvent.setup()`**, bo `setup()` instaluje własny: `Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true })`):

| scenariusz                                                                                               | oczekiwane                                                                                                            |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `onLoad` → `{ ok:true, pack:{ markdown:"# P", approxTokens:3200, truncated:false, warnings:[] } }`, klik | `writeText` raz z `"# P"`; komunikat `Skopiowano paczkę kontekstu (~3,2 tys. tokenów)`; brak drugiego `role="status"` |
| `truncated: true`, `warnings:["a","b"]`                                                                  | komunikat kończy się `· skrócona do budżetu`; osobny status `a · b`                                                   |
| `onLoad` → `{ ok:false, error:"HTTP 404" }`                                                              | alert `HTTP 404`; `writeText` niewołane                                                                               |
| `writeText` odrzuca                                                                                      | alert `Nie udało się skopiować do schowka`                                                                            |
| `onLoad` nierozwiązany promise                                                                           | przycisk `disabled` do czasu rozwiązania                                                                              |

W `useProjects.test.tsx` dodaj `it("loadContextPack: pobiera paczkę wybranego projektu")` wg wzorca istniejących testów: `apiFetch` zwraca listę z `a`, szczegóły `a`, a dla `/api/projects/a/context-pack` JSON `{ markdown:"# A", approxTokens:1, truncated:false, warnings:[] }`; po `await act(() => result.current.loadContextPack())` wynik `{ ok:true, pack }`, a `apiFetch` wołane z `"/api/projects/a/context-pack"`; drugi `it`: odpowiedź 404 `{ error:"Nie ma projektu o id a" }` → `{ ok:false, error:"Nie ma projektu o id a" }`.

- [ ] **Step 2:** `npx vitest run tests/unit/features/projects` → FAIL. **Step 3:** implementacja + CSS + wpięcie. **Step 4:** PASS (cały katalog; `ProjectsView.test.tsx` ma dalej przechodzić).
- [ ] **Step 5:** `git add src/features/projects tests/unit/features/projects && git commit -m "feat(projects): przycisk „Kopiuj paczkę kontekstu” w teczce"`.
- [ ] **Step 6:** review UI + trasy przez `agy` (`--role review`): poprosić o sprawdzenie dostępności (role, etykiety) i obsługi błędów.

---

### Task 10: Poprawka `local_path` w NEXUS (osobne repo, osobny commit)

**Files (repo `../NEXUS`):** `Vault/Projects/_registry.yaml`, `Vault/Projects/{nexus,english-agent,tester-ai,gen-podsum-ai,portfolio,code-sensei}/index.md` (linia 6, frontmatter)

- [ ] **Step 1:** Przed zmianą: `git -C ../NEXUS status --short` (w drzewie są cudze, niezacommitowane zmiany: `Vault/Projects/monolith/index.md`, `Vault/Resources/resources.yaml`, `Vault/Board/`, `Vault/Calendar/`; **nie stage'ować ich**).
- [ ] **Step 2:** Podmień wartości `local_path` (w rejestrze i w `index.md` tego projektu; `monolith` bez zmian):

| id            | nowa wartość                             |
| ------------- | ---------------------------------------- |
| nexus         | `~/projects/Brain_7224/NEXUS`            |
| english-agent | `~/projects/English-agent`               |
| tester-ai     | `~/projects/crait/projects/TesterAI`     |
| gen-podsum-ai | `~/projects/Gen_Podsum_AI`               |
| portfolio     | `~/projects/Portfolio`                   |
| code-sensei   | `~/projects/Code_sensei/Code_sensei_v15` |

- [ ] **Step 3:** Weryfikacja: `grep -n "local_path" ../NEXUS/Vault/Projects/_registry.yaml ../NEXUS/Vault/Projects/*/index.md` → żadna linia nie zawiera `E:\`; `for p in $(grep -h "local_path:" ../NEXUS/Vault/Projects/_registry.yaml | sed 's/.*local_path: //; s|^~|'$HOME'|'); do test -e "$p/.git" && echo "OK $p" || echo "BRAK $p"; done` → siedem razy `OK`.
- [ ] **Step 4:** `git -C ../NEXUS add Vault/Projects/_registry.yaml Vault/Projects/nexus/index.md Vault/Projects/english-agent/index.md Vault/Projects/tester-ai/index.md Vault/Projects/gen-podsum-ai/index.md Vault/Projects/portfolio/index.md Vault/Projects/code-sensei/index.md && git -C ../NEXUS commit -m "vault(projects): local_path na ścieżki WSL (etap 1-4 Monolith)"` (+ trailer). Commit tylko tych plików, bez `index.md` Monolithu.

---

### Task 11: Dokumentacja

**Files:** Modify `CLAUDE.md`, `docs/adr/021-struktura-kontekstow-wg-vaulta-nexus.md`, `docs/superpowers/specs/2026-11-11-asystent-lokalny-nexus-design.md`

- [ ] **Step 1:** `CLAUDE.md`, „Struktura kodu”: w linii „Infrastruktura wspólna” dopisz `lib/git/` (odczyt repozytoriów projektów: ścieżka z walidacją, whitelistowany git, `CLAUDE.md`; `fs` i `child_process` tylko tu, nie w `repositories`). Jedno zdanie, bez zmiany reszty.
- [ ] **Step 2:** ADR-021: w opisie infrastruktury wspólnej dopisz `lib/git/` tym samym zdaniem; test architektury bez zmian.
- [ ] **Step 3:** Spec asystenta §6.1, przy „Paczka kontekstu dla agenta”: dopisz `Zrealizowane w etapie 1-4 (spec 2026-11-13-etap-1-4-paczka-kontekstu-design.md); szablony per rola i podgląd nadal odłożone.`
- [ ] **Step 4:** `npx prettier --check CLAUDE.md docs` na zmienionych plikach → czysto. Commit: `docs: lib/git w CLAUDE.md i ADR-021, status paczki kontekstu w specu asystenta (etap 1-4)`.

---

### Task 12: Weryfikacja końcowa, ręczny test, PR

- [ ] **Step 1 (cursor):** `scripts/ask-helper.sh --role task --approve-allowed cursor "W katalogu Monolith uruchom kolejno: npx vitest run, npx tsc --noEmit, npm run lint, npm run build. Podaj „przeszło” albo listę plik:linia + przyczyna."` Oczekiwane: wszystko zielone (trzy ostrzeżenia `exhaustive-deps` w plikach spoza PR są znane).
- [ ] **Step 2 (agy, review):** `scripts/ask-helper.sh --role review --fresh agy "Zrób review diffa git diff origin/main...HEAD w Monolith (tylko odczyt). Sprawdź: zgodność z docs/superpowers/specs/2026-11-13-etap-1-4-paczka-kontekstu-design.md, ADR-021 i CLAUDE.md, bezpieczeństwo lib/git (ścieżki, symlinki, argumenty gita), braki testów. Lista uwag z wagą i plik:linia, maks. 40 linii."` Uwagi traktować jak hipotezy: weryfikować w kodzie, zanim cokolwiek zmienię.
- [ ] **Step 3 (ręcznie, `run` skill):** `NEXUS_VAULT_PATH=~/projects/Brain_7224/NEXUS/Vault npm run dev`, potem `curl -s localhost:3000/api/projects/monolith/context-pack | jq -r .markdown` (jeśli trasy wymagają sesji, wywołać z przeglądarki). Oczekiwane: pełna paczka z gałęzią `feat/etap-1-4-paczka-kontekstu`, ostatnimi commitami, `## Gdzie skończyłem (brak state.md)`, zadaniami „Teraz”, zasadami z `CLAUDE.md` repo (źródło `CLAUDE.md`), `approxTokens` ≤ 4000. Następnie `tester-ai` (powinna wyjść paczka z gitem z `crait/projects/TesterAI`) i projekt z celowo złym `local_path` (tymczasowo w kopii rejestru; nie commitować) → sekcja „Kod” z adnotacją i ostrzeżeniem. W przeglądarce (Alt+4): przycisk „Kopiuj paczkę kontekstu” → komunikat z liczbą tokenów, wklejenie do edytora pokazuje Markdown.
- [ ] **Step 4:** Uzupełnij na końcu tego pliku sekcję „Odchylenia przy wykonaniu” (jeśli były), commit `docs(plan): odchylenia przy wykonaniu etapu 1-4`.
- [ ] **Step 5:** `git push -u origin feat/etap-1-4-paczka-kontekstu` i PR przez `gh pr create` (tytuł: `Etap 1-4: paczka kontekstu dla agenta`; opis: zakres, decyzje D1–D7, wynik weryfikacji, poprawka `local_path` w NEXUS jako osobny commit; na końcu `🤖 Generated with [Claude Code](https://claude.com/claude-code)`). Push i PR wykonuję dopiero po Twojej zgodzie.
- [ ] **Step 6 (po mergu, za Twoją zgodą):** w `../NEXUS/Vault/Projects/monolith/tasks.md` odhaczyć „Etap 1-4” (PR #NN, data), dopisać do Backlogu: decyzja `looseObject` → `strict`, plan 0e (Firebase), etap 1-5 (`owner`, ostrzeżenie dla `work`), szablony paczki per rola i podgląd; commit tylko `tasks.md`.

## Odchylenia przy wykonaniu

_(uzupełnia wykonawca w kroku 4 zadania 12)_
