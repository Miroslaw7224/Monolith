# Aplikacja desktopowa (skrót Monolith) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ikona „Monolith" na pulpicie Windows uruchamia produkcyjną wersję `main` w oknie bez paska przeglądarki, a wczytywanie jest szybsze niż w `npm run dev`.

**Architecture:** Osobny `git worktree` (`~/projects/Brain_7224/Monolith-prod`, detached na `main`) z własnym `node_modules`. Skrypt `scripts/prod/start-prod.sh` (logika pomocnicza w `scripts/prod/lib.sh`, testowana Vitestem) buduje do katalogu `.next-<12 znaków HEAD>`, startuje `next start` na porcie 3101, otwiera Edge `--app` z osobnym profilem i po zamknięciu okna zatrzymuje serwer. Skrót `.lnk` ma jedną cienką komendę `wsl.exe`. Szybkość: produkcja zamiast dev plus lazy loading widoków w `src/App.tsx`.

**Tech Stack:** bash, Next.js 14 (`NEXT_DIST_DIR` już obsługiwane w `next.config.mjs`), Vitest (`@vitest-environment node`, wzorzec jak `tests/unit/scripts/deploy-skill/`), `tsx`, PowerShell (tworzenie `.lnk`).

**Spec:** `docs/superpowers/specs/2026-11-16-aplikacja-desktopowa-skrot-design.md`

**Zasady projektu, o których trzeba pamiętać:**

- Testy, lint, tsc, build: wolno je zlecić `cursorowi` (`scripts/ask-helper.sh --role task --approve-allowed --tier light cursor "…"`), z prośbą o „przeszło" albo listę `plik:linia + przyczyna`. Samo `bash scripts/prod/measure.sh` nie jest na liście zgód (ma krótki wynik), więc uruchamiaj je sam.
- Komunikaty skryptów i commity: po polsku. Każdy commit kończy się linią `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Nie zmieniamy `tests/unit/architecture.static.test.ts`. Jeśli pęknie po naszych zmianach, naprawiamy kod.
- Kod projektów wolno tylko czytać; aplikacja zapisuje wyłącznie do `Vault/`. Ten plan nie zmienia zapisu do vaulta.

---

## Mapa plików

| Plik                                                                       | Odpowiedzialność                                                                                                |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `scripts/prod/measure.sh` (nowy)                                           | pomiar: czas builda, rozmiary tras, zimny start, TTFB; nie rusza dev ani ikony                                  |
| `scripts/prod/lib.sh` (nowy)                                               | funkcje bash do `source`: nazwa katalogu builda, potrzeba builda/instalacji, najnowszy build, prune, stan portu |
| `scripts/prod/start-prod.sh` (nowy)                                        | orkiestracja startu ikony (install, build z fallbackiem, serwer, prewarm, okno, sprzątanie)                     |
| `scripts/prod/setup-prod.sh` (nowy)                                        | jednorazowo: worktree, dowiązanie `.env`, `npm ci`, pierwszy build, skrót                                       |
| `scripts/prod/install-shortcut.sh` + `.ps1` (nowe)                         | kopiuje ikonę do `%LOCALAPPDATA%\Monolith`, tworzy `Monolith.lnk` na pulpicie                                   |
| `scripts/prod/make-ico.ts` (nowy), `monolith.ico`                          | opakowanie PNG w kontener ICO (jednorazowo), wynik w repo                                                       |
| `src/App.tsx` (zmiana)                                                     | `next/dynamic` dla `ProjectsView`, `MapView`, `CodexView`, `PlanowanieView`                                     |
| `app/layout.tsx` (zmiana)                                                  | tytuł `Monolith`                                                                                                |
| `tests/unit/scripts/prod/lib.test.ts` (nowy)                               | testy `lib.sh` na tymczasowym repo git i prawdziwym serwerze HTTP                                               |
| `tests/unit/scripts/prod/make-ico.test.ts` (nowy)                          | test `pngToIco`                                                                                                 |
| `tests/unit/desktop-shell.static.test.ts` (nowy)                           | test statyczny: widoki leniwe, tytuł `Monolith`                                                                 |
| `docs/superpowers/plans/2026-11-16-aplikacja-desktopowa-pomiary.md` (nowy) | wyniki pomiarów przed i po                                                                                      |
| `CLAUDE.md` (zmiana)                                                       | krótka sekcja „Uruchamianie z pulpitu"                                                                          |

---

### Task 0: Gałąź robocza

- [ ] **Step 1: Utwórz gałąź z bieżącego `HEAD` (zawiera spec)**

```bash
cd ~/projects/Brain_7224/Monolith
git status --short
git checkout -b feat/aplikacja-desktopowa-skrot
```

Expected: `git status --short` puste; `Switched to a new branch 'feat/aplikacja-desktopowa-skrot'`.

---

### Task 1: Pomiar bazowy

**Files:**

- Create: `scripts/prod/measure.sh`
- Create: `docs/superpowers/plans/2026-11-16-aplikacja-desktopowa-pomiary.md`

- [ ] **Step 1: Napisz skrypt pomiarowy**

`scripts/prod/measure.sh`:

```bash
#!/usr/bin/env bash
# Pomiar wczytywania wersji produkcyjnej: czas builda, rozmiary tras, zimny start, TTFB.
# Buduje do .next-measure i startuje na porcie 3199, więc nie rusza dev (:3100) ani ikony (:3101).
# Użycie (z repozytorium): bash scripts/prod/measure.sh
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT" || exit 1

DIST=".next-measure"
PORT=3199
URL="http://127.0.0.1:$PORT"
LOG="$(mktemp)"
now_ms() { echo $(( $(date +%s%N) / 1000000 )); }

rm -rf "$DIST"
t0=$(now_ms)
if ! NEXT_DIST_DIR="$DIST" node_modules/.bin/next build >"$LOG" 2>&1; then
  echo "build nie powiódł się; koniec logu:"
  tail -20 "$LOG"
  rm -rf "$DIST" "$LOG"
  exit 1
fi
t1=$(now_ms)
echo "build: $(( (t1 - t0) / 1000 )) s"
echo "--- trasy (bez /api) ---"
sed -n '/^Route (app)/,$p' "$LOG" | grep -v ' /api/' | head -40

NEXT_DIST_DIR="$DIST" node_modules/.bin/next start -p "$PORT" -H 127.0.0.1 >/dev/null 2>&1 &
SERVER=$!
trap 'kill "$SERVER" 2>/dev/null; rm -rf "$DIST" "$LOG"' EXIT

t2=$(now_ms)
until curl -s -o /dev/null -m 2 "$URL/dashboard"; do
  kill -0 "$SERVER" 2>/dev/null || { echo "serwer zakończył się przy starcie"; exit 1; }
  sleep 0.1
done
t3=$(now_ms)
echo "zimny start do pierwszej odpowiedzi /dashboard: $(( t3 - t2 )) ms"
for i in 1 2 3; do
  printf 'GET /api/cockpit #%s: %s s (TTFB)\n' "$i" \
    "$(curl -s -o /dev/null -w '%{time_starttransfer}' "$URL/api/cockpit")"
done
printf 'GET /dashboard (rozgrzany): %s s (TTFB)\n' \
  "$(curl -s -o /dev/null -w '%{time_starttransfer}' "$URL/dashboard")"
```

- [ ] **Step 2: Uruchom pomiar (stan bazowy, przed zmianami w `src/App.tsx`)**

Run: `bash scripts/prod/measure.sh`
Expected: linie `build: N s`, tabela tras z kolumną `First Load JS` (w tym `/dashboard` i `First Load JS shared by all`), `zimny start … ms` i cztery wiersze TTFB. Jeśli `build nie powiódł się`, przeczytaj log i napraw przyczynę zanim ruszysz dalej (build musi przechodzić na `main`).

- [ ] **Step 3: Zapisz wynik w pliku z pomiarami**

`docs/superpowers/plans/2026-11-16-aplikacja-desktopowa-pomiary.md`:

````markdown
# Pomiary: aplikacja desktopowa

Komenda: `bash scripts/prod/measure.sh` (build do `.next-measure`, port 3199).

## Przed zmianami (stan bazowy)

```text
<wklej wynik z kroku 2>
```
````

Wklej prawdziwy wynik w miejsce `<wklej wynik z kroku 2>` (to plik wyników, nie plan).

- [ ] **Step 4: Zdecyduj o warstwie 3 (async git w kokpicie) na podstawie liczb**

Jeśli TTFB `/api/cockpit` (wiersze #2 i #3, rozgrzane) jest większy niż ok. 300 ms, dopisz w pliku pomiarów jedną linię „Warstwa 3 (async git/hc w `getCockpit`): potrzebna" i powiadom użytkownika, że to osobny spec i plan. W przeciwnym razie dopisz „Warstwa 3: niepotrzebna".

- [ ] **Step 5: Commit**

```bash
git add scripts/prod/measure.sh docs/superpowers/plans/2026-11-16-aplikacja-desktopowa-pomiary.md
git commit -m "feat(prod): skrypt pomiarowy i pomiar bazowy wczytywania

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Tytuł okna i lazy loading widoków

**Files:**

- Create: `tests/unit/desktop-shell.static.test.ts`
- Modify: `src/App.tsx:10-25`
- Modify: `app/layout.tsx:8-10`

- [ ] **Step 1: Napisz test (czerwony)**

`tests/unit/desktop-shell.static.test.ts`:

```ts
// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

describe("Monolith jako aplikacja z pulpitu", () => {
  const app = read("src/App.tsx");

  it.each(["ProjectsView", "MapView", "CodexView", "PlanowanieView"])(
    "%s ładuje się leniwie (next/dynamic), bez statycznego importu",
    (name) => {
      expect(app).not.toMatch(new RegExp(`^import[^\\n]*\\b${name}\\b[^\\n]*from`, "m"));
      expect(app).toMatch(new RegExp(`const ${name} = dynamic\\(`));
    }
  );

  it("HomeView zostaje importowany statycznie (Kokpit startuje bez dodatkowego chunka)", () => {
    expect(app).toMatch(/^import HomeView from/m);
  });

  it('tytuł okna to dokładnie "Monolith"', () => {
    expect(read("app/layout.tsx")).toMatch(/title:\s*"Monolith"/);
  });
});
```

- [ ] **Step 2: Uruchom test i sprawdź, że pada**

Run: `npx vitest run tests/unit/desktop-shell.static.test.ts`
Expected: FAIL (5 testów: 4 widoki + tytuł; `HomeView` przechodzi).

- [ ] **Step 3: Zmień `src/App.tsx`**

Dodaj import `next/dynamic` po imporcie Reacta (linia 6):

```tsx
import dynamic from "next/dynamic";
```

Usuń cztery statyczne importy:

```tsx
import PlanowanieView from "@/src/features/planowanie/PlanowanieView";
import { ProjectsView } from "@/src/features/projects/ProjectsView";
import { MapView } from "@/src/features/map/MapView";
import { CodexView } from "@/src/features/codex/CodexView";
```

Zaraz po ostatnim imporcie (przed `export default function App()`) dodaj:

```tsx
/** Widoki poza Kokpitem ładują się dopiero po wejściu w kartę (mniejszy pierwszy bundle). */
const ViewFallback = () => <div className="flex-1" aria-busy="true" />;
const ProjectsView = dynamic(
  () => import("@/src/features/projects/ProjectsView").then((m) => m.ProjectsView),
  { ssr: false, loading: ViewFallback }
);
const MapView = dynamic(() => import("@/src/features/map/MapView").then((m) => m.MapView), {
  ssr: false,
  loading: ViewFallback,
});
const CodexView = dynamic(() => import("@/src/features/codex/CodexView").then((m) => m.CodexView), {
  ssr: false,
  loading: ViewFallback,
});
const PlanowanieView = dynamic(() => import("@/src/features/planowanie/PlanowanieView"), {
  ssr: false,
  loading: ViewFallback,
});
```

Reszta pliku (JSX z `<ProjectsView … />` itd.) bez zmian.

- [ ] **Step 4: Zmień tytuł w `app/layout.tsx`**

Zamień `title: "Monolith · Offline Nexus Core",` na:

```tsx
  title: "Monolith",
```

- [ ] **Step 5: Uruchom test, typy i lint**

Run: `npx vitest run tests/unit/desktop-shell.static.test.ts`
Expected: PASS (6 testów: 4 widoki + `HomeView` + tytuł).

Run: `npx tsc --noEmit`
Expected: bez błędów. Gdy `dynamic(...)` zgłasza niezgodność typów propsów, sprawdź eksport (`named` vs `default`) w pliku widoku i popraw `.then((m) => m.<Nazwa>)`.

Run: `npm run lint`
Expected: bez błędów.

- [ ] **Step 6: Uruchom pełny zestaw testów jednostkowych**

Run: `npx vitest run`
Expected: wszystko zielone (w tym `tests/unit/architecture.static.test.ts`). Jeśli jakiś test renderował `App` i szukał widoku synchronicznie, popraw ten test (`await screen.findBy…`), nie kod.

- [ ] **Step 7: Pomiar po zmianie i zapis**

Run: `bash scripts/prod/measure.sh`
Expected: `First Load JS` dla `/dashboard` mniejszy niż w pomiarze bazowym. Dopisz wynik do `docs/superpowers/plans/2026-11-16-aplikacja-desktopowa-pomiary.md` jako sekcję „Po lazy loadingu". Jeśli rozmiar się nie zmniejszył, inny moduł statycznie importuje te widoki lub ich ciężkie zależności: sprawdź `grep -rn "features/map/MapView\|features/codex/CodexView\|features/projects/ProjectsView\|features/planowanie/PlanowanieView" src app` i opisz, co zostało w głównym bundlu (nie rozbudowuj zakresu, tylko zanotuj).

- [ ] **Step 8: Commit**

```bash
git add tests/unit/desktop-shell.static.test.ts src/App.tsx app/layout.tsx docs/superpowers/plans/2026-11-16-aplikacja-desktopowa-pomiary.md
git commit -m "perf(app): leniwe ładowanie widoków poza Kokpitem, tytuł okna Monolith

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `lib.sh` z testami

**Files:**

- Create: `tests/unit/scripts/prod/lib.test.ts`
- Create: `scripts/prod/lib.sh`

Funkcje (kontrakt):

| Funkcja                       | Zachowanie                                                                                                     |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `prod_dist_name <repo>`       | wypisuje `.next-` + pierwsze 12 znaków `HEAD`                                                                  |
| `prod_needs_build <repo>`     | kod 0, gdy brak `<repo>/<dist>/.monolith-ok`; kod 1, gdy jest                                                  |
| `prod_latest_ok_dist <repo>`  | wypisuje nazwę najnowszego (wg mtime znacznika) katalogu `.next-*` ze znacznikiem `.monolith-ok`, albo nic     |
| `prod_prune_dists <repo> <n>` | zostawia `n` najnowszych udanych katalogów `.next-*`, usuwa resztę (także bez znacznika)                       |
| `prod_needs_install <repo>`   | kod 0, gdy brak `node_modules/.monolith-lock-hash` lub hash `package-lock.json` inny; kod 1 w przeciwnym razie |
| `prod_mark_installed <repo>`  | zapisuje hash `package-lock.json` do `node_modules/.monolith-lock-hash`                                        |
| `prod_port_state <port>`      | wypisuje `free` (odmowa połączenia), `monolith` (`GET /dashboard` zawiera `<title>Monolith`) albo `busy`       |

- [ ] **Step 1: Napisz testy (czerwone)**

`tests/unit/scripts/prod/lib.test.ts`:

```ts
// @vitest-environment node
import { execFile, execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const LIB = path.join(process.cwd(), "scripts/prod/lib.sh");
const run = promisify(execFile);

/** Woła funkcję z lib.sh: `bash -c 'source lib.sh; <fn> "$@"' bash args`. */
async function call(fn: string, ...args: string[]) {
  try {
    const { stdout } = await run("bash", ["-c", `source "${LIB}"; ${fn} "$@"`, "bash", ...args]);
    return { code: 0, stdout: stdout.trim() };
  } catch (e) {
    const err = e as { code: number; stdout?: string };
    return { code: err.code, stdout: (err.stdout ?? "").trim() };
  }
}

let dir: string;
const git = (...a: string[]) => execFileSync("git", ["-C", dir, ...a], { encoding: "utf8" }).trim();

function commit(msg: string) {
  fs.writeFileSync(path.join(dir, `f-${msg}.txt`), msg);
  git("add", ".");
  git("-c", "commit.gpgsign=false", "commit", "-q", "-m", msg);
}

function okDist(name: string, mtimeSec: number) {
  fs.mkdirSync(path.join(dir, name), { recursive: true });
  const marker = path.join(dir, name, ".monolith-ok");
  fs.writeFileSync(marker, "");
  fs.utimesSync(marker, mtimeSec, mtimeSec);
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "prod-lib-"));
  git("init", "-q");
  git("config", "user.email", "t@example.com");
  git("config", "user.name", "t");
  fs.writeFileSync(path.join(dir, "package-lock.json"), "{}");
  commit("init");
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("prod_dist_name", () => {
  it("to .next- i 12 pierwszych znaków HEAD", async () => {
    const head = git("rev-parse", "HEAD");
    const r = await call("prod_dist_name", dir);
    expect(r).toEqual({ code: 0, stdout: `.next-${head.slice(0, 12)}` });
  });
});

describe("prod_needs_build", () => {
  it("kod 0, gdy brak znacznika .monolith-ok", async () => {
    expect((await call("prod_needs_build", dir)).code).toBe(0);
  });

  it("kod 1, gdy build dla bieżącego commita jest gotowy", async () => {
    const { stdout: dist } = await call("prod_dist_name", dir);
    okDist(dist, 1000);
    expect((await call("prod_needs_build", dir)).code).toBe(1);
  });

  it("kod 0 po nowym commicie (inny katalog builda)", async () => {
    const { stdout: dist } = await call("prod_dist_name", dir);
    okDist(dist, 1000);
    commit("kolejny");
    expect((await call("prod_needs_build", dir)).code).toBe(0);
  });
});

describe("prod_latest_ok_dist", () => {
  it("zwraca najnowszy udany build i pomija katalog bez znacznika", async () => {
    okDist(".next-aaa", 1000);
    okDist(".next-bbb", 2000);
    fs.mkdirSync(path.join(dir, ".next-ccc"));
    expect(await call("prod_latest_ok_dist", dir)).toEqual({ code: 0, stdout: ".next-bbb" });
  });

  it("zwraca pusty wynik, gdy nie ma udanego builda", async () => {
    fs.mkdirSync(path.join(dir, ".next-ccc"));
    expect(await call("prod_latest_ok_dist", dir)).toEqual({ code: 0, stdout: "" });
  });
});

describe("prod_prune_dists", () => {
  it("zostawia n najnowszych udanych, usuwa starsze i nieudane", async () => {
    okDist(".next-aaa", 1000);
    okDist(".next-bbb", 2000);
    okDist(".next-ddd", 3000);
    fs.mkdirSync(path.join(dir, ".next-ccc"));
    await call("prod_prune_dists", dir, "2");
    const left = fs
      .readdirSync(dir)
      .filter((n) => n.startsWith(".next-"))
      .sort();
    expect(left).toEqual([".next-bbb", ".next-ddd"]);
  });
});

describe("prod_needs_install / prod_mark_installed", () => {
  it("kod 0 bez node_modules, 1 po oznaczeniu, 0 po zmianie package-lock.json", async () => {
    expect((await call("prod_needs_install", dir)).code).toBe(0);
    fs.mkdirSync(path.join(dir, "node_modules"));
    await call("prod_mark_installed", dir);
    expect((await call("prod_needs_install", dir)).code).toBe(1);
    fs.writeFileSync(path.join(dir, "package-lock.json"), '{"zmiana":1}');
    expect((await call("prod_needs_install", dir)).code).toBe(0);
  });
});

describe("prod_port_state", () => {
  function serve(html: string): Promise<{ port: number; close: () => Promise<void> }> {
    return new Promise((resolve) => {
      const server = http.createServer((_req, res) => {
        res.setHeader("content-type", "text/html");
        res.end(html);
      });
      server.listen(0, "127.0.0.1", () => {
        const { port } = server.address() as { port: number };
        resolve({ port, close: () => new Promise((r) => server.close(() => r())) });
      });
    });
  }

  it("free, gdy nic nie nasłuchuje", async () => {
    const s = await serve("x");
    await s.close();
    expect(await call("prod_port_state", String(s.port))).toEqual({ code: 0, stdout: "free" });
  });

  it("monolith, gdy strona ma tytuł Monolith", async () => {
    const s = await serve("<html><head><title>Monolith</title></head></html>");
    try {
      expect(await call("prod_port_state", String(s.port))).toEqual({
        code: 0,
        stdout: "monolith",
      });
    } finally {
      await s.close();
    }
  });

  it("busy, gdy port zajmuje inny program", async () => {
    const s = await serve("<html><head><title>Inny</title></head></html>");
    try {
      expect(await call("prod_port_state", String(s.port))).toEqual({ code: 0, stdout: "busy" });
    } finally {
      await s.close();
    }
  });
});
```

- [ ] **Step 2: Uruchom testy i sprawdź, że padają**

Run: `npx vitest run tests/unit/scripts/prod/lib.test.ts`
Expected: FAIL (brak `scripts/prod/lib.sh`, `source` zgłasza błąd).

- [ ] **Step 3: Napisz `scripts/prod/lib.sh`**

```bash
#!/usr/bin/env bash
# Funkcje pomocnicze start-prod.sh (do `source`). Wczytanie pliku nie ma skutków ubocznych.

# Nazwa katalogu builda dla bieżącego commita: .next-<12 znaków HEAD>.
prod_dist_name() {
  local head
  head="$(git -C "$1" rev-parse HEAD)" || return 1
  echo ".next-${head:0:12}"
}

# Kod 0, gdy build dla bieżącego commita jest potrzebny (brak znacznika .monolith-ok).
prod_needs_build() {
  local dist
  dist="$(prod_dist_name "$1")" || return 0
  [[ ! -f "$1/$dist/.monolith-ok" ]]
}

# Nazwa najnowszego udanego katalogu .next-* (wg mtime znacznika) albo pusty wynik.
prod_latest_ok_dist() {
  local marker
  marker="$(ls -1t "$1"/.next-*/.monolith-ok 2>/dev/null | head -n 1)"
  [[ -n "$marker" ]] || return 0
  basename "$(dirname "$marker")"
}

# Zostawia <n> najnowszych udanych katalogów .next-*, usuwa resztę (także nieudane).
prod_prune_dists() {
  local root="$1" keep="$2" marker d i keepit
  local -a ok=()
  while IFS= read -r marker; do
    ok+=("$(basename "$(dirname "$marker")")")
  done < <(ls -1t "$root"/.next-*/.monolith-ok 2>/dev/null)
  for d in "$root"/.next-*/; do
    [[ -d "$d" ]] || continue
    d="$(basename "$d")"
    keepit=0
    for ((i = 0; i < keep && i < ${#ok[@]}; i++)); do
      [[ "${ok[$i]}" == "$d" ]] && keepit=1
    done
    [[ $keepit -eq 1 ]] || rm -rf "${root:?}/$d"
  done
  return 0
}

prod_lock_hash() { sha1sum "$1/package-lock.json" | cut -d' ' -f1; }

# Kod 0, gdy trzeba zrobić `npm ci` (brak oznaczenia albo zmienił się package-lock.json).
prod_needs_install() {
  local f="$1/node_modules/.monolith-lock-hash"
  [[ ! -f "$f" ]] || [[ "$(cat "$f")" != "$(prod_lock_hash "$1")" ]]
}

# Zapisuje hash package-lock.json po udanym `npm ci`.
prod_mark_installed() { prod_lock_hash "$1" >"$1/node_modules/.monolith-lock-hash"; }

# free | monolith | busy dla 127.0.0.1:<port>.
prod_port_state() {
  local port="$1" body rc=0
  body="$(curl -s -m 3 "http://127.0.0.1:$port/dashboard")" || rc=$?
  case "$rc" in
    0) if [[ "$body" == *"<title>Monolith"* ]]; then echo monolith; else echo busy; fi ;;
    7) echo free ;;
    *) echo busy ;;
  esac
}
```

- [ ] **Step 4: Uruchom testy i sprawdź, że przechodzą**

Run: `npx vitest run tests/unit/scripts/prod/lib.test.ts`
Expected: PASS (wszystkie testy). Jeśli `prod_prune_dists` usuwa za dużo lub za mało, sprawdź kolejność `ls -1t` (najnowszy pierwszy) i warunek pętli `i < keep`.

- [ ] **Step 5: Commit**

```bash
git add scripts/prod/lib.sh tests/unit/scripts/prod/lib.test.ts
git commit -m "feat(prod): funkcje pomocnicze startu ikony (build, install, prune, stan portu)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `start-prod.sh`

**Files:**

- Create: `scripts/prod/start-prod.sh`

Skrypt jest orkiestracją procesów (serwer, okno Windows), więc nie ma testu jednostkowego; weryfikacja jest ręczna w krokach 2-4. Cała logika decyzyjna jest już przetestowana w Task 3.

- [ ] **Step 1: Napisz skrypt**

```bash
#!/usr/bin/env bash
# Uruchamia Monolith z tego katalogu (worktree prod na main): w razie potrzeby instaluje zależności
# i buduje, startuje `next start`, otwiera okno Edge (--app) i po jego zamknięciu zatrzymuje serwer.
# Zmienne: MONOLITH_PORT (domyślnie 3101), MONOLITH_NO_WINDOW=1 (bez okna, serwer do Ctrl+C),
#          MONOLITH_BUILD_ONLY=1 (tylko install + build).
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=scripts/prod/lib.sh
source "$ROOT/scripts/prod/lib.sh"

PORT="${MONOLITH_PORT:-3101}"
URL="http://127.0.0.1:$PORT"
PS="/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe"
NEXT="$ROOT/node_modules/.bin/next"
cd "$ROOT" || exit 1

log() { printf '[monolith] %s\n' "$*"; }
die() {
  log "BŁĄD: $*"
  read -r -n 1 -p "Naciśnij dowolny klawisz, aby zamknąć… " _ || true
  exit 1
}

command -v node >/dev/null || die "brak node w PATH (skrót woła bash -lc; sprawdź ~/.profile)"

# Blokada: drugie kliknięcie ikony czeka, aż pierwsze skończy checkout/install/build/start serwera,
# a potem widzi działający serwer (state=monolith) i tylko otwiera okno.
exec 9>"$ROOT/.monolith-start.lock"
flock 9

# Worktree prod zawsze na aktualnym main. Skrypt może się przy tym zmienić na dysku, więc po
# checkoutcie uruchamiamy go od nowa (bash czyta skrypty w trakcie wykonywania); fd 9 z blokadą przechodzi dalej.
if [[ -z "${MONOLITH_SYNCED:-}" ]]; then
  # Zabezpieczenie: `checkout -f` kasuje lokalne zmiany, więc tylko w worktree prod (nigdy w katalogu dev).
  [[ "$(basename "$ROOT")" == "Monolith-prod" ]] || die "start-prod.sh działa tylko w katalogu Monolith-prod (checkout -f)"
  git -C "$ROOT" checkout -q -f --detach main || die "git checkout main nie powiódł się"
  MONOLITH_SYNCED=1 exec bash "$ROOT/scripts/prod/start-prod.sh" "$@"
fi

# Tryb samego builda (setup-prod.sh) nie patrzy na port: ma zbudować także, gdy serwer już działa.
state="free"
if [[ "${MONOLITH_BUILD_ONLY:-0}" != "1" ]]; then
  state="$(prod_port_state "$PORT")"
  [[ "$state" == "busy" ]] && die "port $PORT jest zajęty przez inny program"
fi

SERVER_PID=""
if [[ "$state" == "free" ]]; then
  if prod_needs_install "$ROOT"; then
    log "Instaluję zależności (npm ci)…"
    npm ci --ignore-scripts || die "npm ci nie powiodło się"
    prod_mark_installed "$ROOT"
  fi

  DIST="$(prod_dist_name "$ROOT")" || die "nie mogę odczytać HEAD"
  if prod_needs_build "$ROOT"; then
    log "Buduję wersję $DIST (to potrwa)…"
    rm -rf "${ROOT:?}/$DIST"
    if NEXT_DIST_DIR="$DIST" "$NEXT" build; then
      touch "$ROOT/$DIST/.monolith-ok"
      prod_prune_dists "$ROOT" 2
    else
      rm -rf "${ROOT:?}/$DIST"
      [[ "${MONOLITH_BUILD_ONLY:-0}" == "1" ]] && die "build nie powiódł się"
      DIST="$(prod_latest_ok_dist "$ROOT")"
      [[ -n "$DIST" ]] || die "build nie powiódł się i nie ma poprzedniej wersji"
      log "OSTRZEŻENIE: build nie powiódł się, uruchamiam poprzednią wersję ($DIST)."
      log "Uwaga: node_modules i pliki worktree są już z nowego main, więc możliwy rozjazd ze starym buildem."
    fi
  fi
  [[ "${MONOLITH_BUILD_ONLY:-0}" == "1" ]] && { log "Build gotowy ($DIST)."; exit 0; }

  log "Startuję serwer: $URL"
  # 9>&-: serwer nie dziedziczy blokady (inaczej trzymałby ją przez cały czas działania)
  NEXT_DIST_DIR="$DIST" "$NEXT" start -p "$PORT" -H 127.0.0.1 9>&- &
  SERVER_PID=$!
  trap 'kill "$SERVER_PID" 2>/dev/null' EXIT

  ready=0
  for _ in $(seq 1 120); do
    kill -0 "$SERVER_PID" 2>/dev/null || die "serwer zakończył się przy starcie"
    if curl -s -o /dev/null -m 2 "$URL/dashboard"; then ready=1; break; fi
    sleep 0.5
  done
  [[ $ready -eq 1 ]] || die "serwer nie odpowiedział w 60 s"
  curl -s -o /dev/null -m 30 "$URL/api/cockpit" || true # prewarm
fi
exec 9>&- # zwolnij blokadę: kolejne kliknięcie ma tylko otworzyć okno

if [[ "${MONOLITH_NO_WINDOW:-0}" == "1" ]]; then
  log "Serwer działa: $URL (Ctrl+C kończy)"
  [[ -n "$SERVER_PID" ]] && wait "$SERVER_PID"
  exit 0
fi

log "Otwieram okno Monolith…"
LAD="$("$PS" -NoProfile -Command '[Environment]::GetFolderPath("LocalApplicationData")' | tr -d '\r')"
PROFILE_ARG="\"--user-data-dir=${LAD}\\Monolith\\edge\""
"$PS" -NoProfile -Command "Start-Process msedge -ArgumentList '--app=$URL','$PROFILE_ARG' -Wait"
log "Okno zamknięte."
# trap EXIT zatrzymuje serwer uruchomiony przez ten skrypt
```

- [ ] **Step 2: Sprawdź składnię i start bez okna**

Run: `bash -n scripts/prod/start-prod.sh`
Expected: brak wyjścia.

Run (w osobnym terminalu, katalog `Monolith`, port testowy, żeby nie ruszać innych): `MONOLITH_PORT=3198 MONOLITH_NO_WINDOW=1 bash scripts/prod/start-prod.sh`
Expected: na repo bez `node_modules` jest to ten sam katalog co dev, więc `prod_needs_install` zwróci 0 (brak `.monolith-lock-hash`) i skrypt uruchomi `npm ci`. **Nie uruchamiaj tego kroku w katalogu dev**: wykonaj go dopiero w worktree prod (Task 8). Tutaj wystarczy `bash -n`.

- [ ] **Step 3: Commit**

```bash
git add scripts/prod/start-prod.sh
git commit -m "feat(prod): skrypt startu ikony (install, build z fallbackiem, serwer, okno Edge)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Ikona `.ico`

**Files:**

- Create: `tests/unit/scripts/prod/make-ico.test.ts`
- Create: `scripts/prod/make-ico.ts`
- Create: `scripts/prod/monolith.ico` (wynik)

Źródło: `app/apple-icon.png` (180 × 180, RGBA). Kontener ICO z jednym wpisem PNG (obsługiwany przez Windows Vista+).

- [ ] **Step 1: Napisz test (czerwony)**

`tests/unit/scripts/prod/make-ico.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { pngToIco } from "../../../../scripts/prod/make-ico";

/** Minimalny „PNG": sygnatura + IHDR z wymiarami (reszta nie jest czytana). */
function fakePng(width: number, height: number): Buffer {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write("IHDR", 12, "ascii");
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return b;
}

describe("pngToIco", () => {
  it("buduje nagłówek ICO z jednym wpisem PNG i dołącza dane PNG", () => {
    const png = fakePng(180, 180);
    const ico = pngToIco(png);
    expect([...ico.subarray(0, 6)]).toEqual([0, 0, 1, 0, 1, 0]);
    expect(ico[6]).toBe(180); // szerokość
    expect(ico[7]).toBe(180); // wysokość
    expect(ico.readUInt16LE(10)).toBe(1); // planes
    expect(ico.readUInt16LE(12)).toBe(32); // bity na piksel
    expect(ico.readUInt32LE(14)).toBe(png.length); // rozmiar danych
    expect(ico.readUInt32LE(18)).toBe(22); // offset danych
    expect(ico.subarray(22).equals(png)).toBe(true);
  });

  it("wymiar 256 zapisuje jako 0", () => {
    const ico = pngToIco(fakePng(256, 256));
    expect(ico[6]).toBe(0);
    expect(ico[7]).toBe(0);
  });

  it("odrzuca plik, który nie jest PNG", () => {
    expect(() => pngToIco(Buffer.from("to nie png, ale dość długi tekst na nagłówek"))).toThrow(
      "PNG"
    );
  });
});
```

- [ ] **Step 2: Uruchom test i sprawdź, że pada**

Run: `npx vitest run tests/unit/scripts/prod/make-ico.test.ts`
Expected: FAIL (brak modułu).

- [ ] **Step 3: Napisz `scripts/prod/make-ico.ts`**

```ts
/**
 * Opakowuje plik PNG w kontener ICO (jeden wpis, dane PNG bez zmian).
 * Użycie: npx tsx scripts/prod/make-ico.ts <wejście.png> <wyjście.ico>
 */
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function pngToIco(png: Buffer): Buffer {
  if (png.length < 24 || !png.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("Wejście nie jest plikiem PNG");
  }
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0); // zarezerwowane
  header.writeUInt16LE(1, 2); // typ: ikona
  header.writeUInt16LE(1, 4); // liczba obrazów
  header[6] = width >= 256 ? 0 : width;
  header[7] = height >= 256 ? 0 : height;
  header[8] = 0; // liczba kolorów (0 = brak palety)
  header[9] = 0;
  header.writeUInt16LE(1, 10); // planes
  header.writeUInt16LE(32, 12); // bity na piksel
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(22, 18); // offset danych
  return Buffer.concat([header, png]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) {
    console.error("Użycie: npx tsx scripts/prod/make-ico.ts <wejście.png> <wyjście.ico>");
    process.exit(1);
  }
  fs.writeFileSync(output, pngToIco(fs.readFileSync(input)));
}
```

- [ ] **Step 4: Uruchom test i sprawdź, że przechodzi**

Run: `npx vitest run tests/unit/scripts/prod/make-ico.test.ts`
Expected: PASS (3 testy).

- [ ] **Step 5: Wygeneruj ikonę i sprawdź wynik**

Run: `npx tsx scripts/prod/make-ico.ts app/apple-icon.png scripts/prod/monolith.ico && file scripts/prod/monolith.ico`
Expected: `MS Windows icon resource - 1 icon, 180x180, 32 bits/pixel` (lub podobnie, z wymiarami 180x180).

- [ ] **Step 6: Commit**

```bash
git add scripts/prod/make-ico.ts scripts/prod/monolith.ico tests/unit/scripts/prod/make-ico.test.ts
git commit -m "feat(prod): ikona Monolith (.ico z apple-icon.png)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Skrót na pulpicie i instalacja jednorazowa

**Files:**

- Create: `scripts/prod/install-shortcut.ps1`
- Create: `scripts/prod/install-shortcut.sh`
- Create: `scripts/prod/setup-prod.sh`

Te skrypty dotykają Windowsa i worktree, więc nie mają testów jednostkowych; weryfikacja ręczna w Task 8.

- [ ] **Step 1: `scripts/prod/install-shortcut.ps1`**

```powershell
# Tworzy skrót Monolith.lnk na pulpicie Windows. Wołany przez install-shortcut.sh.
param(
  [Parameter(Mandatory = $true)][string]$Distro,
  [Parameter(Mandatory = $true)][string]$IconPath,
  [Parameter(Mandatory = $true)][string]$ProdDir
)
$desktop = [Environment]::GetFolderPath('Desktop')
$shell = New-Object -ComObject WScript.Shell
$lnk = $shell.CreateShortcut((Join-Path $desktop 'Monolith.lnk'))
$lnk.TargetPath = Join-Path $env:SystemRoot 'System32\wsl.exe'
# Cienka komenda: ustaw worktree na main (-f: katalog jest zarządzany maszynowo) i uruchom skrypt z repo.
# Checkout main robi sam start-prod.sh (pod blokadą i z komunikatem błędu).
$lnk.Arguments = "-d $Distro -- bash -lc `"cd '$ProdDir' && exec bash scripts/prod/start-prod.sh`""
$lnk.IconLocation = $IconPath
$lnk.Description = 'Monolith'
$lnk.WindowStyle = 1
$lnk.Save()
Write-Output ("Skrót utworzony: " + (Join-Path $desktop 'Monolith.lnk'))
```

- [ ] **Step 2: `scripts/prod/install-shortcut.sh`**

```bash
#!/usr/bin/env bash
# Kopiuje ikonę i skrypt .ps1 do %LOCALAPPDATA%\Monolith i tworzy skrót Monolith.lnk na pulpicie.
# Uruchamiaj z worktree prod (ścieżka tego katalogu trafia do skrótu).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PS="/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe"
DISTRO="${WSL_DISTRO_NAME:-Ubuntu}"

LAD="$("$PS" -NoProfile -Command '[Environment]::GetFolderPath("LocalApplicationData")' | tr -d '\r')"
LAD_WSL="$(wslpath -u "$LAD")"
mkdir -p "$LAD_WSL/Monolith"
cp "$ROOT/scripts/prod/monolith.ico" "$LAD_WSL/Monolith/monolith.ico"
# .ps1 uruchamiamy z dysku lokalnego (ścieżki UNC wsl.localhost bywają blokowane przez politykę wykonywania).
cp "$ROOT/scripts/prod/install-shortcut.ps1" "$LAD_WSL/Monolith/install-shortcut.ps1"

"$PS" -NoProfile -ExecutionPolicy Bypass -File "$LAD\\Monolith\\install-shortcut.ps1" \
  -Distro "$DISTRO" -IconPath "$LAD\\Monolith\\monolith.ico" -ProdDir "$ROOT"
```

- [ ] **Step 3: `scripts/prod/setup-prod.sh`**

```bash
#!/usr/bin/env bash
# Jednorazowa instalacja ikony Monolith (uruchom z głównego katalogu Monolith PO merge'u do main):
# worktree prod na main, dowiązanie .env, npm ci, pierwszy build, skrót na pulpicie.
# Idempotentny: ponowne uruchomienie odświeża worktree, build i skrót.
set -euo pipefail

MAIN="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROD="$(dirname "$MAIN")/Monolith-prod"

[[ -f "$MAIN/.env" ]] || { echo "Brak $MAIN/.env (potrzebny NEXUS_VAULT_PATH)" >&2; exit 1; }
grep -q '^NEXUS_VAULT_PATH=' "$MAIN/.env" || { echo "W .env brak NEXUS_VAULT_PATH" >&2; exit 1; }

if [[ ! -e "$PROD/.git" ]]; then # nie -d: pusty katalog po przerwanym setupie też wymaga `worktree add`
  git -C "$MAIN" worktree add --detach "$PROD" main
fi
[[ -e "$PROD/.env" ]] || ln -s "$MAIN/.env" "$PROD/.env"
git -C "$PROD" checkout -q -f --detach main

MONOLITH_BUILD_ONLY=1 bash "$PROD/scripts/prod/start-prod.sh"
bash "$PROD/scripts/prod/install-shortcut.sh"
echo "Gotowe: ikona Monolith na pulpicie, katalog $PROD"
```

- [ ] **Step 4: Sprawdź składnię**

Run: `bash -n scripts/prod/install-shortcut.sh scripts/prod/setup-prod.sh`
Expected: brak wyjścia.

- [ ] **Step 5: Commit**

```bash
git add scripts/prod/install-shortcut.ps1 scripts/prod/install-shortcut.sh scripts/prod/setup-prod.sh
git commit -m "feat(prod): instalacja worktree prod i skrótu Monolith na pulpicie

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Dokumentacja i końcowa weryfikacja

**Files:**

- Modify: `CLAUDE.md` (po akapicie o formatach plików vaulta, przed `## Struktura kodu`)

- [ ] **Step 1: Dodaj krótką sekcję do `CLAUDE.md`**

Wstaw przed nagłówkiem `## Struktura kodu`:

```markdown
## Uruchamianie z pulpitu

Ikona „Monolith" (Windows) startuje wersję produkcyjną `main` z osobnego worktree `~/projects/Brain_7224/Monolith-prod`
na porcie 3101; `npm run dev` (3100) działa niezależnie. Skrypty: `scripts/prod/` (instalacja: `bash scripts/prod/setup-prod.sh`
z głównego katalogu po merge'u do `main`). Zmiana kodu trafia do ikony po merge'u do `main` (przy starcie robi się build).
Spec: `docs/superpowers/specs/2026-11-16-aplikacja-desktopowa-skrot-design.md`.
```

- [ ] **Step 2: Skoryguj spec (rozbieżności wykryte przy planowaniu)**

W `docs/superpowers/specs/2026-11-16-aplikacja-desktopowa-skrot-design.md` popraw:

1. w „Start ze skrótu", punkt 1: znacznik to nazwa katalogu builda `.next-<12 znaków HEAD>` ze znacznikiem `.monolith-ok` (hash `package-lock.json` służy tylko do decyzji o `npm ci`); zostają 2 ostatnie udane buildy, a build, który się nie powiódł, nie niszczy poprzedniej wersji;
2. w „Okno i konsola": konsola zostaje widoczna przez cały czas działania (można ją zminimalizować), bez automatycznego minimalizowania;
3. w „Start ze skrótu": komenda w skrócie to tylko `cd '<Monolith-prod>' && exec bash scripts/prod/start-prod.sh`; `git checkout -q -f --detach main` robi sam `start-prod.sh` (`-f`, bo build mógł zmodyfikować śledzone pliki) pod blokadą `flock` i uruchamia się od nowa po checkoutcie (skrypt mógł się zmienić);
4. ścieżka skryptu: `scripts/prod/start-prod.sh` (nie `scripts/start-prod.sh`);
5. ikona: `.ico` powstaje z `app/apple-icon.png` (nie z `app/icon.svg`);
6. „Testy": lazy loading pilnuje test statyczny (regex po `src/App.tsx`), nie test renderujący `App`;
7. w „Okno i konsola" usuń zdanie o minimalizowaniu konsoli po otwarciu okna (punkt 2 wyżej); w „Start ze skrótu" dopisz blokadę `flock` przeciw podwójnemu kliknięciu.

- [ ] **Step 3: Pełna weryfikacja**

Run: `npx vitest run`
Expected: wszystko zielone.

Run: `npx tsc --noEmit && npm run lint && npx prettier --check scripts docs/superpowers CLAUDE.md`
Expected: bez błędów. Jeśli prettier zgłasza pliki, uruchom `npx prettier --write` na nich i dołącz do commita.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-11-16-aplikacja-desktopowa-skrot-design.md
git commit -m "docs: sekcja Uruchamianie z pulpitu, korekta specu skrótu

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Odbiór ręczny po merge'u do `main`

Wykonuje użytkownik z agentem po merge'u gałęzi `feat/aplikacja-desktopowa-skrot` do `main` (skrypty muszą być na `main`, bo worktree prod czyta `main`).

- [ ] **Step 1: Instalacja**

Run (w `~/projects/Brain_7224/Monolith`, na `main`): `bash scripts/prod/setup-prod.sh`
Expected: powstaje `~/projects/Brain_7224/Monolith-prod`, `npm ci`, `Build gotowy (.next-xxxxxxxxxxxx).`, `Skrót utworzony: …\Monolith.lnk`, `Gotowe: …`.

- [ ] **Step 2: Start bez okna w worktree (diagnostyka)**

Run: `cd ~/projects/Brain_7224/Monolith-prod && MONOLITH_PORT=3198 MONOLITH_NO_WINDOW=1 bash scripts/prod/start-prod.sh`
Expected: `Startuję serwer: http://127.0.0.1:3198`, potem `Serwer działa…`; `curl -s http://127.0.0.1:3198/dashboard | grep -o '<title>[^<]*'` daje `<title>Monolith`. Zakończ Ctrl+C.

- [ ] **Step 3: Kliknij ikonę na pulpicie**

Expected: otwiera się konsola WSL z logiem, potem okno „Monolith" bez paska adresu z Kokpitem, ikona Monolith na pasku zadań. Dane (zadania, notatki) są te same co w dev (ten sam vault).

- [ ] **Step 4: Zamknięcie**

Zamknij okno. Expected: konsola pisze `Okno zamknięte.` i znika; `curl -s -o /dev/null http://127.0.0.1:3101/dashboard` kończy się błędem (serwer zatrzymany).

- [ ] **Step 5: Zmiana na `main` odświeża wersję**

Zmerge'uj dowolną drobną zmianę do `main`, kliknij ikonę. Expected: w konsoli `Buduję wersję .next-…`, potem start z nową zmianą; po kolejnym kliknięciu bez zmian build jest pomijany i start trwa kilka sekund.

- [ ] **Step 6: Dwa tryby równolegle**

Uruchom `npm run dev` w katalogu `Monolith` (3100) i kliknij ikonę (3101). Expected: obie wersje działają, żadna nie psuje drugiej.

- [ ] **Step 6a: Kontrole z review**

(a) Podwójne kliknięcie ikony w czasie builda: drugie okno czeka na blokadę i po starcie serwera tylko otwiera okno; w `ps` jest jeden `next build`.
(b) Po zamknięciu okna: `ps aux | grep -E 'next|node' | grep 3101` nie pokazuje osieroconych procesów.
(c) Skrót znajduje `node` (konsola nie pisze „brak node w PATH"); jeśli pisze, dopisz ładowanie nvm do `~/.profile`.

- [ ] **Step 7: Pomiar końcowy**

Run: `bash scripts/prod/measure.sh` w `Monolith-prod`; dopisz sekcję „Po wdrożeniu" do pliku pomiarów i porównaj czas od kliknięcia ikony do widocznego Kokpitu z `npm run dev` (stoper, orientacyjnie).

---

## Self-review (spec ↔ plan)

| Wymaganie ze specu                                         | Task                                        |
| ---------------------------------------------------------- | ------------------------------------------- |
| Skrót „Monolith" z ikoną, okno `--app` z osobnym profilem  | 4 (okno), 5 (ikona), 6 (skrót)              |
| Dwa tryby, dwa porty, osobne katalogi                      | 4, 6 (worktree), 8 krok 6                   |
| Ikona zawsze z `main` (worktree detached)                  | 6 (`setup-prod.sh`, `checkout -f --detach`) |
| Build tylko po zmianie, fallback po błędzie, prune         | 3 (`lib.sh`), 4                             |
| Prewarm `/api/cockpit`, zamykanie serwera po oknie         | 4                                           |
| Zajęty port 3101 (monolith / busy)                         | 3 (`prod_port_state`), 4                    |
| `NEXUS_VAULT_PATH` przez dowiązanie `.env`                 | 6 (`setup-prod.sh`)                         |
| `npm ci --ignore-scripts` przy zmianie `package-lock.json` | 3, 4                                        |
| Tytuł okna „Monolith"                                      | 2                                           |
| Lazy loading widoków                                       | 2                                           |
| Pomiar bazowy i po zmianach; warstwa 3 warunkowo           | 1, 2 (krok 7), 8 (krok 7)                   |
| Testy skryptów w Vitest, test statyczny widoków            | 2, 3, 5                                     |
| Cache w kokpicie z krótkim TTL                             | poza tym planem (warstwa 3, osobny spec)    |
