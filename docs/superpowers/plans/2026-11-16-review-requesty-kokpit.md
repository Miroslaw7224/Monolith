# Kokpit: lista „Do zrecenzowania” Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. W tym repo wykonawcą jest Claude Code, a pomocnicy (`cursor`, `agy`) wykonują wskazane kroki (zob. „Podział pracy”).

**Goal:** Sekcja „Do zrecenzowania (N)” w Kokpicie Monolith z otwartymi PR-ami, w których użytkownik jest wskazany jako recenzent (dane z `gh`, tylko odczyt).

**Architecture:** `lib/github/review-requests.ts` woła `gh search prs` (async `execFile`, biała lista) → `bc_cockpit` (`repositories` → `services` → `router`) → trasa `GET /api/cockpit/reviews` → komponent `ReviewRequests.tsx` w Kokpicie (odświeżanie co 5 min, tylko przy widocznej karcie). Spec: `docs/superpowers/specs/2026-11-16-review-requesty-kokpit-design.md`.

**Tech Stack:** Next.js 14, TypeScript, zod (bez nowych schematów wejścia), Vitest + Testing Library, i18next.

---

## Podział pracy

| Kto              | Zadania                                                                                                                                                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Code      | Taski 1–3 i 5: testy czerwone → kod → zielone, teksty PL/EN (cursor gubi cudzysłowy i ogonki, więc teksty piszę sam), commity.                                                                                       |
| `cursor` (light) | Task 4 (CSS, mocki w `HomeView*.test.tsx`, test EN: mechaniczne, kod podany niżej) oraz wszystkie uruchomienia `tsc`/`vitest`/`lint`/`build` z `--approve-allowed` i wynikiem „przeszło” / `plik:linia + przyczyna`. |
| `agy`            | Review (read-only): po Tasku 1 (bezpieczeństwo `lib/github`) i na końcu (cały diff). Model: `AGY_DEEP_TAG=Hydrogen` (Argon wyczerpany do ~2026-11-21).                                                               |

Wywołania (z `~/projects/Brain_7224/Monolith`, zawsze `--tier light` dla cursora):

```bash
# cursor: sprawdzenia
scripts/ask-helper.sh --role task --tier light --approve-allowed --fresh cursor "<prompt>"
# agy: review
AGY_DEEP_TAG=Hydrogen scripts/ask-helper.sh --role review --tier deep --fresh agy "<prompt>"
```

Opinie pomocników to hipotezy: weryfikuję w kodzie, zanim cokolwiek zmienię. Po `--role task` zawsze sprawdzam `git diff --stat` i testy. Commity robi Claude (zmiany w `architecture.static.test.ts` nie są potrzebne). Push tylko na prośbę użytkownika.

## Struktura plików

| Plik                                                                                    | Rola                                                                 |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Create `lib/github/review-requests.ts`                                                  | `gh search prs` + walidacja wyjścia (jedyne `child_process` GitHuba) |
| Modify `contexts/bc_cockpit/models.ts`                                                  | typy `ReviewRequest`, `ReviewRequests`                               |
| Modify `contexts/bc_cockpit/repositories.ts`                                            | `loadReviewRequests()` (lib → model)                                 |
| Modify `contexts/bc_cockpit/services.ts`                                                | `getReviewRequests()`, `MAX_REVIEW_REQUESTS`                         |
| Modify `contexts/bc_cockpit/schemas.ts`                                                 | `ReviewRequestDto(s)`, `toReviewRequestsDto`                         |
| Modify `contexts/bc_cockpit/router.ts`                                                  | `getReviewRequests()` (zawsze 200)                                   |
| Create `app/api/cockpit/reviews/route.ts`                                               | re-eksport `GET`                                                     |
| Modify `src/i18n/locales/{pl,en}/home.ts`                                               | sekcja `reviews`                                                     |
| Create `src/features/home/ReviewRequests.tsx`                                           | panel w Kokpicie                                                     |
| Modify `src/features/home/CockpitSections.tsx`                                          | wstawienie panelu przed `CommitHistory`                              |
| Modify `src/features/home/home.css`                                                     | style `kok-reviews*`                                                 |
| Create `tests/unit/lib/github/review-requests.test.ts`                                  | testy lib                                                            |
| Create `tests/unit/contexts/bc_cockpit/reviews-repository.test.ts`                      | test mapowania repozytorium                                          |
| Modify `tests/unit/contexts/bc_cockpit/{services,schemas,router}.test.ts`               | testy serwisu, mapera, routera                                       |
| Create `tests/unit/features/home/ReviewRequests.test.tsx`, `ReviewRequests.en.test.tsx` | testy komponentu (PL, EN)                                            |
| Modify `tests/unit/features/home/HomeView.test.tsx`, `HomeView.en.test.tsx`             | mock `/api/cockpit/reviews` w `respond`                              |
| Modify `CLAUDE.md`                                                                      | `lib/github/` na liście infrastruktury                               |

---

### Task 0: Korekta specu (zmiany ustalone przy planowaniu)

**Files:** Modify `docs/superpowers/specs/2026-11-16-review-requesty-kokpit-design.md`

Dwie rozbieżności wyszły przy pisaniu planu: (1) `lib/github` zwraca już spłaszczony typ (`repo`, `author`), a `repositories` kopiuje go do modelu; (2) licznik pokazuje chip z liczbą, a nie `{{count}}` w tytule (klucz z `count` uruchamia w i18next odmianę liczebnikową).

- [ ] **Step 1: Popraw spec**

W §3 (`lib/github`) zdanie „Wynik: `{ ok: true, items }` …” uzupełnij o: „`items` są już spłaszczone: `repo` (z `repository.nameWithOwner`), `author` (z `author.login` albo `null`)”. W §3 (`repositories.ts`) zmień opis na: „`loadReviewRequests()` woła `lib/github` i kopiuje wynik do modelu; `ok: false` daje `available: false`, `items: []`”. W §3 (UI) zmień nagłówek na „Do zrecenzowania” z chipem `kok-chip` z liczbą (tylko gdy lista się wczytała), a w kluczach i18n zamiast `title` z `{{count}}` wpisz `title` bez parametrów. W §4 usuń „mapowanie `repository.nameWithOwner` → `repo`” z testu repozytorium (zastąp: „kopiowanie pól; `ok: false` → `available: false`”) i zmień „nagłówek „(2)”” na „chip „2””.

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-11-16-review-requesty-kokpit-design.md
git commit -m "docs(spec): review requesty, korekty po planie (spłaszczony typ lib, chip z licznikiem)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 1: `lib/github/review-requests.ts`

**Files:**

- Create: `lib/github/review-requests.ts`
- Test: `tests/unit/lib/github/review-requests.test.ts`

- [ ] **Step 1: Napisz czerwony test**

```ts
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockExecFile = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ execFile: mockExecFile }));

import { fetchReviewRequests } from "@/lib/github/review-requests";

type Done = (err: Error | null, stdout?: string, stderr?: string) => void;

function ghReturns(stdout: string) {
  mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: object, done: Done) => {
    done(null, stdout, "");
  });
}

function ghFails(code: string | number) {
  mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: object, done: Done) => {
    done(Object.assign(new Error("gh failed"), { code }), "", "");
  });
}

const PR = {
  number: 1476,
  title: "fix(matchers): słownik",
  url: "https://github.com/crait-p-s-a/career-guide/pull/1476",
  author: { login: "Adiszef-ai", type: "User" },
  repository: { name: "career-guide", nameWithOwner: "crait-p-s-a/career-guide" },
  updatedAt: "2026-11-16T05:58:28Z",
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("fetchReviewRequests", () => {
  it("poprawny JSON: spłaszcza pola do `repo` i `author`", async () => {
    ghReturns(JSON.stringify([PR]));
    expect(await fetchReviewRequests()).toEqual({
      ok: true,
      items: [
        {
          repo: "crait-p-s-a/career-guide",
          number: 1476,
          title: "fix(matchers): słownik",
          author: "Adiszef-ai",
          url: "https://github.com/crait-p-s-a/career-guide/pull/1476",
          updatedAt: "2026-11-16T05:58:28Z",
        },
      ],
    });
  });

  it("pusta tablica to ok z pustą listą", async () => {
    ghReturns("[]");
    expect(await fetchReviewRequests()).toEqual({ ok: true, items: [] });
  });

  it("author null albo bez login: pozycja zostaje, author null", async () => {
    ghReturns(
      JSON.stringify([
        { ...PR, author: null },
        { ...PR, number: 2, author: {} },
      ])
    );
    const res = await fetchReviewRequests();
    if (res.ok === false) throw new Error("oczekiwano ok");
    expect(res.items.map((i) => i.author)).toEqual([null, null]);
  });

  it.each([
    ["brak url", { ...PR, url: undefined }],
    ["http zamiast https", { ...PR, url: "http://github.com/o/r/pull/1" }],
    ["obca domena z prefiksem github.com", { ...PR, url: "https://github.com.evil.example/x" }],
    ["inna domena", { ...PR, url: "https://example.com/o/r/pull/1" }],
    ["url niebędący adresem", { ...PR, url: "nie-adres" }],
    ["brak number", { ...PR, number: undefined }],
    ["number niecałkowity", { ...PR, number: 1.5 }],
    ["pusty title", { ...PR, title: "" }],
    ["brak repository", { ...PR, repository: undefined }],
    ["brak nameWithOwner", { ...PR, repository: { name: "x" } }],
    ["updatedAt nie jest datą", { ...PR, updatedAt: "nie-data" }],
    ["brak updatedAt", { ...PR, updatedAt: undefined }],
  ])("pomija pozycję: %s", async (_name, bad) => {
    ghReturns(JSON.stringify([bad, { ...PR, number: 7 }]));
    const res = await fetchReviewRequests();
    if (res.ok === false) throw new Error("oczekiwano ok");
    expect(res.items.map((i) => i.number)).toEqual([7]);
  });

  it("ENOENT to gh-missing", async () => {
    ghFails("ENOENT");
    expect(await fetchReviewRequests()).toEqual({ ok: false, reason: "gh-missing" });
  });

  it.each([
    ["kod wyjścia 1", () => ghFails(1)],
    ["przekroczony maxBuffer", () => ghFails("ERR_CHILD_PROCESS_STDIO_MAXBUFFER")],
    ["niepoprawny JSON", () => ghReturns("{nie json")],
    ["JSON niebędący tablicą", () => ghReturns('{"a":1}')],
  ])("gh-error: %s", async (_name, setup) => {
    setup();
    expect(await fetchReviewRequests()).toEqual({ ok: false, reason: "gh-error" });
  });

  it("execFile rzucający synchronicznie to gh-error (bez wyjątku)", async () => {
    mockExecFile.mockImplementation(() => {
      throw new Error("spawn");
    });
    expect(await fetchReviewRequests()).toEqual({ ok: false, reason: "gh-error" });
  });

  it("woła gh dokładnie z białą listą argumentów i bezpiecznym środowiskiem", async () => {
    ghReturns("[]");
    await fetchReviewRequests();
    expect(mockExecFile).toHaveBeenCalledTimes(1);
    const [cmd, args, opts] = mockExecFile.mock.calls[0] as [
      string,
      string[],
      { timeout: number; maxBuffer: number; env: Record<string, string | undefined> },
    ];
    expect(cmd).toBe("gh");
    expect(args).toEqual([
      "search",
      "prs",
      "--review-requested=@me",
      "--state=open",
      "--limit",
      "30",
      "--json",
      "number,title,url,author,repository,updatedAt",
    ]);
    expect(opts.timeout).toBe(8000);
    expect(opts.maxBuffer).toBe(256 * 1024);
    expect(opts.env.GH_PROMPT_DISABLED).toBe("1");
    expect(opts.env.GH_PAGER).toBe("cat");
    expect(opts.env.NO_COLOR).toBe("1");
    expect(opts.env.GH_NO_UPDATE_NOTIFIER).toBe("1");
    expect(opts.env.PATH).toBe(process.env.PATH);
  });
});
```

- [ ] **Step 2: Uruchom test, ma paść**

Run: `npx vitest run tests/unit/lib/github/review-requests.test.ts`
Expected: FAIL (`Failed to resolve import "@/lib/github/review-requests"`).

- [ ] **Step 3: Napisz implementację**

```ts
import { execFile } from "node:child_process";

/** Otwarty PR, w którym użytkownik jest wskazany jako recenzent (spłaszczony wynik `gh`). */
export type GithubReviewRequest = {
  /** `właściciel/repo`. */
  repo: string;
  number: number;
  title: string;
  /** Login autora; `null`, gdy GitHub go nie podał. */
  author: string | null;
  url: string;
  /** Data ISO ostatniej zmiany PR-a. */
  updatedAt: string;
};

export type ReviewRequestsResult =
  | { ok: true; items: GithubReviewRequest[] }
  | { ok: false; reason: "gh-missing" | "gh-error" };

/** Biała lista: jedyne wywołanie `gh`, jakie ta warstwa potrafi wykonać (tylko odczyt, bez argumentów z zewnątrz). */
const GH_ARGS = [
  "search",
  "prs",
  "--review-requested=@me",
  "--state=open",
  "--limit",
  "30",
  "--json",
  "number,title,url,author,repository,updatedAt",
];
const TIMEOUT_MS = 8000;
const MAX_BUFFER = 256 * 1024;

type Run = { ok: true; stdout: string } | { ok: false; reason: "gh-missing" | "gh-error" };

/** Uruchamia `gh` bez powłoki i bez blokowania pętli zdarzeń; nigdy nie rzuca. */
function runGh(): Promise<Run> {
  return new Promise((resolve) => {
    try {
      execFile(
        "gh",
        GH_ARGS,
        {
          encoding: "utf8",
          timeout: TIMEOUT_MS,
          maxBuffer: MAX_BUFFER,
          env: {
            ...process.env,
            GH_PROMPT_DISABLED: "1",
            GH_PAGER: "cat",
            NO_COLOR: "1",
            GH_NO_UPDATE_NOTIFIER: "1",
          },
        },
        (err, stdout) => {
          if (err) {
            const code = (err as NodeJS.ErrnoException).code;
            resolve({ ok: false, reason: code === "ENOENT" ? "gh-missing" : "gh-error" });
            return;
          }
          resolve({ ok: true, stdout: String(stdout) });
        }
      );
    } catch {
      resolve({ ok: false, reason: "gh-error" });
    }
  });
}

/** `url` trafia do `href`, więc przepuszczamy tylko `https://github.com/...`. */
function isGithubUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && u.hostname === "github.com";
  } catch {
    return false;
  }
}

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function parseItem(raw: unknown): GithubReviewRequest | null {
  const r = asObject(raw);
  if (!r) return null;
  const repo = asObject(r.repository)?.nameWithOwner;
  const login = asObject(r.author)?.login;
  const { number, title, url, updatedAt } = r;
  if (typeof repo !== "string" || repo === "") return null;
  if (typeof number !== "number" || !Number.isInteger(number)) return null;
  if (typeof title !== "string" || title === "") return null;
  if (typeof url !== "string" || !isGithubUrl(url)) return null;
  if (typeof updatedAt !== "string" || !Number.isFinite(Date.parse(updatedAt))) return null;
  return {
    repo,
    number,
    title,
    author: typeof login === "string" && login !== "" ? login : null,
    url,
    updatedAt,
  };
}

/** Otwarte PR-y z prośbą o review do użytkownika (konto zalogowane w `gh`). Błąd `gh` to `ok: false`, nie wyjątek. */
export async function fetchReviewRequests(): Promise<ReviewRequestsResult> {
  const run = await runGh();
  if (run.ok === false) return run;
  let parsed: unknown;
  try {
    parsed = JSON.parse(run.stdout);
  } catch {
    return { ok: false, reason: "gh-error" };
  }
  if (!Array.isArray(parsed)) return { ok: false, reason: "gh-error" };
  const items: GithubReviewRequest[] = [];
  for (const raw of parsed) {
    const item = parseItem(raw);
    if (item) items.push(item);
  }
  return { ok: true, items };
}
```

- [ ] **Step 4: Uruchom test, ma przejść**

Run: `npx vitest run tests/unit/lib/github/review-requests.test.ts`
Expected: PASS (wszystkie przypadki).

- [ ] **Step 5: Commit**

```bash
git add lib/github/review-requests.ts tests/unit/lib/github/review-requests.test.ts
git commit -m "feat(github): lib/github, otwarte prośby o review przez gh (tylko odczyt)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Review bezpieczeństwa przez agy (read-only)**

```bash
AGY_DEEP_TAG=Hydrogen scripts/ask-helper.sh --role review --tier deep --fresh agy "Zrób review pliku lib/github/review-requests.ts i tests/unit/lib/github/review-requests.test.ts (tylko czytaj). Porównaj z lib/git/project-git.ts. Szukaj: wstrzyknięcia argumentów lub powłoki, wycieku env, braku limitu czasu/bufora, nieobsłużonych ścieżek błędu (wyjątek zamiast {ok:false}), luk w walidacji url/updatedAt, luk w testach. Odpowiedz listą: plik:linia + problem + poprawka; na końcu 'OK' lub 'wymaga poprawek'. Max 25 linii."
```

Po odpowiedzi weryfikuję każdy zarzut w kodzie; uzasadnione poprawki wprowadzam z testem i commitem `fix(github): …`.

---

### Task 2: Kontekst `bc_cockpit` i trasa API

**Files:**

- Modify: `contexts/bc_cockpit/models.ts`, `repositories.ts`, `services.ts`, `schemas.ts`, `router.ts`
- Create: `app/api/cockpit/reviews/route.ts`
- Test: `tests/unit/contexts/bc_cockpit/reviews-repository.test.ts` (nowy), `services.test.ts`, `schemas.test.ts`, `router.test.ts`

- [ ] **Step 1: Napisz czerwone testy**

`tests/unit/contexts/bc_cockpit/reviews-repository.test.ts` (nowy):

```ts
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFetchReviewRequests = vi.hoisted(() => vi.fn());
vi.mock("@/lib/github/review-requests", () => ({ fetchReviewRequests: mockFetchReviewRequests }));

import { loadReviewRequests } from "@/contexts/bc_cockpit/repositories";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("loadReviewRequests", () => {
  it("ok: kopiuje pola do modelu, available true", async () => {
    const item = {
      repo: "o/r",
      number: 5,
      title: "Tytuł",
      author: "ktoś",
      url: "https://github.com/o/r/pull/5",
      updatedAt: "2026-11-16T05:58:28Z",
    };
    mockFetchReviewRequests.mockResolvedValue({ ok: true, items: [item] });
    expect(await loadReviewRequests()).toEqual({ available: true, items: [item] });
  });

  it.each(["gh-missing", "gh-error"])("%s to available false z pustą listą", async (reason) => {
    mockFetchReviewRequests.mockResolvedValue({ ok: false, reason });
    expect(await loadReviewRequests()).toEqual({ available: false, items: [] });
  });
});
```

`tests/unit/contexts/bc_cockpit/services.test.ts` — trzy edycje:

1. Po linii `const mockUpdateTask = vi.hoisted(() => vi.fn());` dopisz: `const mockLoadReviewRequests = vi.hoisted(() => vi.fn());`
2. W fabryce `vi.mock("@/contexts/bc_cockpit/repositories", …)` po `  upsertClosing: mockUpsertClosing,` dopisz `  loadReviewRequests: mockLoadReviewRequests,`
3. W bloku importu serwisu po linii `  getCommitHistory,` dopisz `  getReviewRequests,` i `  MAX_REVIEW_REQUESTS,`; na końcu pliku dopisz:

```ts
describe("getReviewRequests", () => {
  const pr = (n: number, updatedAt: string) => ({
    repo: "o/r",
    number: n,
    title: `PR ${n}`,
    author: "a",
    url: `https://github.com/o/r/pull/${n}`,
    updatedAt,
  });

  it("sortuje malejąco po updatedAt", async () => {
    mockLoadReviewRequests.mockResolvedValue({
      available: true,
      items: [
        pr(1, "2026-11-14T10:00:00Z"),
        pr(2, "2026-11-16T10:00:00Z"),
        pr(3, "2026-11-15T10:00:00Z"),
      ],
    });
    const res = await getReviewRequests();
    expect(res.available).toBe(true);
    expect(res.items.map((i) => i.number)).toEqual([2, 3, 1]);
  });

  it("przycina do 20 najnowszych", async () => {
    const items = Array.from({ length: 25 }, (_, i) =>
      pr(i + 1, new Date(Date.UTC(2026, 10, 1, 0, i)).toISOString())
    ).reverse();
    mockLoadReviewRequests.mockResolvedValue({ available: true, items });
    const res = await getReviewRequests();
    expect(MAX_REVIEW_REQUESTS).toBe(20);
    expect(res.items).toHaveLength(20);
    expect(res.items[0].number).toBe(25);
    expect(res.items[19].number).toBe(6);
  });

  it("niedostępny GitHub przechodzi bez zmian", async () => {
    mockLoadReviewRequests.mockResolvedValue({ available: false, items: [] });
    expect(await getReviewRequests()).toEqual({ available: false, items: [] });
  });
});
```

`tests/unit/contexts/bc_cockpit/schemas.test.ts` — w imporcie z `@/contexts/bc_cockpit/schemas` dopisz `toReviewRequestsDto,`; na końcu pliku:

```ts
describe("toReviewRequestsDto", () => {
  const item = {
    repo: "o/r",
    number: 1,
    title: "t",
    author: null,
    url: "https://github.com/o/r/pull/1",
    updatedAt: "2026-11-16T05:58:28Z",
  };

  it("kopiuje pola i odrzuca nadmiarowe", () => {
    const dto = toReviewRequestsDto({
      available: true,
      items: [{ ...item, extra: 1 }],
    } as never);
    expect(dto).toEqual({ available: true, items: [item] });
  });

  it("niedostępny GitHub: available false, pusta lista", () => {
    expect(toReviewRequestsDto({ available: false, items: [] })).toEqual({
      available: false,
      items: [],
    });
  });
});
```

`tests/unit/contexts/bc_cockpit/router.test.ts` — edycje: po `const mockGetCommitHistory = vi.hoisted(() => vi.fn());` dopisz `const mockGetReviewRequests = vi.hoisted(() => vi.fn());`; w fabryce po `  getCommitHistory: mockGetCommitHistory,` dopisz `  getReviewRequests: mockGetReviewRequests,`; w imporcie routera po `  getCommits,` dopisz `  getReviewRequests,`; przed `describe("POST /api/cockpit/queue/complete"` dopisz:

```ts
describe("GET /api/cockpit/reviews", () => {
  const item = {
    repo: "o/r",
    number: 1,
    title: "t",
    author: "a",
    url: "https://github.com/o/r/pull/1",
    updatedAt: "2026-11-16T05:58:28Z",
  };

  it("200 z DTO", async () => {
    mockGetReviewRequests.mockResolvedValue({ available: true, items: [item] });
    const res = await getReviewRequests();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ available: true, items: [item] });
  });

  it("200 i available false, gdy GitHub niedostępny (nie 500)", async () => {
    mockGetReviewRequests.mockResolvedValue({ available: false, items: [] });
    const res = await getReviewRequests();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ available: false, items: [] });
  });
});
```

- [ ] **Step 2: Uruchom testy, mają paść**

Run: `npx vitest run tests/unit/contexts/bc_cockpit`
Expected: FAIL (brak `loadReviewRequests`, `getReviewRequests`, `toReviewRequestsDto`, `MAX_REVIEW_REQUESTS`).

- [ ] **Step 3: Napisz implementację**

`contexts/bc_cockpit/models.ts` — przed komentarzem `/** Proponowane okno pracy w wolnej części dnia` wstaw:

```ts
/** Otwarty PR z prośbą o review do użytkownika (tylko odczyt z GitHuba). */
export type ReviewRequest = {
  /** `właściciel/repo`. */
  repo: string;
  number: number;
  title: string;
  author: string | null;
  url: string;
  /** Data ISO ostatniej zmiany PR-a. */
  updatedAt: string;
};

/** Prośby o review; `available: false`, gdy GitHub jest niedostępny (brak `gh`, sieci, logowania). */
export type ReviewRequests = { available: boolean; items: ReviewRequest[] };
```

`contexts/bc_cockpit/repositories.ts` — import i funkcja:

```ts
import { fetchReviewRequests } from "@/lib/github/review-requests";
```

oraz zmień `import type { Closing, Pinned } from "./models";` na `import type { Closing, Pinned, ReviewRequests } from "./models";`. Na końcu pliku dopisz:

```ts
/** Prośby o review z GitHuba (przez `lib/github`); błąd `gh` to `available: false`, nie wyjątek. */
export async function loadReviewRequests(): Promise<ReviewRequests> {
  const res = await fetchReviewRequests();
  if (res.ok === false) return { available: false, items: [] };
  return {
    available: true,
    items: res.items.map((i) => ({
      repo: i.repo,
      number: i.number,
      title: i.title,
      author: i.author,
      url: i.url,
      updatedAt: i.updatedAt,
    })),
  };
}
```

`contexts/bc_cockpit/services.ts` — w bloku `import { MAX_PINNED, type Closing, type CommitHistory, … } from "./models"` dopisz `type ReviewRequests,` (obok `type CommitHistory,`). Po funkcji `getCommitHistory` (przed komentarzem `/**\n * Tekst zadania z ustawioną energią`) wstaw:

```ts
// ── prośby o review ────────────────────────────────────────────────────────────

export const MAX_REVIEW_REQUESTS = 20;

/** Otwarte prośby o review z GitHuba: najnowsze pierwsze, maksymalnie `MAX_REVIEW_REQUESTS`. */
export async function getReviewRequests(): Promise<ReviewRequests> {
  const res = await repositories.loadReviewRequests();
  const items = [...res.items]
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, MAX_REVIEW_REQUESTS);
  return { available: res.available, items };
}
```

`contexts/bc_cockpit/schemas.ts` — w `import type { … } from "./models"` dopisz `ReviewRequests,` (po `QueueGroup,` w kolejności alfabetycznej: `QueueGroup, ReviewRequest, ReviewRequests, Topic`; dopisz oba). Po linii `export type CommitHistoryDto = CommitHistory;` dopisz:

```ts
export type ReviewRequestDto = ReviewRequest;
export type ReviewRequestsDto = ReviewRequests;
```

oraz po funkcji `toCommitHistoryDto`:

```ts
export function toReviewRequestsDto(r: ReviewRequests): ReviewRequestsDto {
  return {
    available: r.available,
    items: r.items.map((i) => ({
      repo: i.repo,
      number: i.number,
      title: i.title,
      author: i.author,
      url: i.url,
      updatedAt: i.updatedAt,
    })),
  };
}
```

`contexts/bc_cockpit/router.ts` — w imporcie ze `./schemas` dopisz `toReviewRequestsDto,` (po `toPinnedDto,`), a przed `/** POST: domyka pozycję kolejki` wstaw:

```ts
/** GET: lista próśb o review z GitHuba; niedostępny `gh` to 200 z `available: false`, nie błąd. */
export async function getReviewRequests(): Promise<NextResponse> {
  try {
    return NextResponse.json(toReviewRequestsDto(await services.getReviewRequests()));
  } catch (err) {
    return handleServiceError(err);
  }
}
```

`app/api/cockpit/reviews/route.ts`:

```ts
export { getReviewRequests as GET } from "@/contexts/bc_cockpit/router";

export const dynamic = "force-dynamic";
```

- [ ] **Step 4: Uruchom testy, mają przejść**

Run: `npx vitest run tests/unit/contexts/bc_cockpit tests/unit/architecture.static.test.ts`
Expected: PASS (testy kontekstu i architektury bez zmian w teście architektury).

- [ ] **Step 5: Commit**

```bash
git add contexts/bc_cockpit app/api/cockpit/reviews tests/unit/contexts/bc_cockpit
git commit -m "feat(cockpit): GET /api/cockpit/reviews, prośby o review z GitHuba

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: UI `ReviewRequests` i teksty PL/EN

**Files:**

- Modify: `src/i18n/locales/pl/home.ts`, `src/i18n/locales/en/home.ts`, `src/features/home/CockpitSections.tsx`
- Create: `src/features/home/ReviewRequests.tsx`
- Test: `tests/unit/features/home/ReviewRequests.test.tsx` (nowy)

- [ ] **Step 1: Teksty (piszę sam, nie cursor)**

`src/i18n/locales/pl/home.ts` — po bloku `history: { … barPr: ", {{count}} PR", },` (przed `common: {`) wstaw:

```ts
  reviews: {
    aria: "Prośby o review",
    title: "Do zrecenzowania",
    empty: "Brak próśb o review",
    error: "Nie można pobrać z GitHuba",
  },
```

`src/i18n/locales/en/home.ts` — w tym samym miejscu:

```ts
  reviews: {
    aria: "Review requests",
    title: "To review",
    empty: "No review requests",
    error: "Could not load from GitHub",
  },
```

- [ ] **Step 2: Napisz czerwony test**

`tests/unit/features/home/ReviewRequests.test.tsx`:

```tsx
import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ReviewRequests } from "@/src/features/home/ReviewRequests";

const ITEMS = [
  {
    repo: "crait-p-s-a/career-guide",
    number: 1476,
    title: "fix(matchers): słownik",
    author: "Adiszef-ai",
    url: "https://github.com/crait-p-s-a/career-guide/pull/1476",
    updatedAt: "2026-11-16T05:58:28Z",
  },
  {
    repo: "o/r",
    number: 2,
    title: "Drugi PR",
    author: null,
    url: "https://github.com/o/r/pull/2",
    updatedAt: "2026-11-15T10:00:00Z",
  },
];

const ok = (items: unknown[]) => ({
  ok: true,
  json: async () => ({ available: true, items }),
});

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Reflect.deleteProperty(document, "visibilityState");
  vi.restoreAllMocks();
});

describe("ReviewRequests", () => {
  test("przed pierwszą odpowiedzią nic nie pokazuje", () => {
    const apiFetch = vi.fn(() => new Promise<never>(() => {}));
    const { container } = render(<ReviewRequests apiFetch={apiFetch} />);
    expect(container).toBeEmptyDOMElement();
    expect(apiFetch).toHaveBeenCalledWith("/api/cockpit/reviews");
  });

  test("lista: nagłówek, licznik i bezpieczne linki do PR-ów", async () => {
    const apiFetch = vi.fn().mockResolvedValue(ok(ITEMS));
    render(<ReviewRequests apiFetch={apiFetch} />);
    expect(await screen.findByText("Do zrecenzowania")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    const link = screen.getByRole("link", { name: /career-guide#1476/ });
    expect(link.getAttribute("href")).toBe(ITEMS[0].url);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getByRole("link", { name: /o\/r#2/ })).toBeTruthy();
    expect(screen.getByText(/Adiszef-ai/)).toBeTruthy();
  });

  test("pusta lista: komunikat, bez linków", async () => {
    const apiFetch = vi.fn().mockResolvedValue(ok([]));
    render(<ReviewRequests apiFetch={apiFetch} />);
    expect(await screen.findByText("Brak próśb o review")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });

  test.each([
    ["available false", () => ({ ok: true, json: async () => ({ available: false, items: [] }) })],
    ["HTTP 500", () => ({ ok: false, status: 500, json: async () => ({}) })],
    ["odpowiedź bez items", () => ({ ok: true, json: async () => [] })],
  ])("błąd: %s pokazuje komunikat", async (_name, response) => {
    const apiFetch = vi.fn().mockResolvedValue(response());
    render(<ReviewRequests apiFetch={apiFetch} />);
    expect(await screen.findByText("Nie można pobrać z GitHuba")).toBeTruthy();
  });

  test("odrzucony apiFetch pokazuje komunikat", async () => {
    const apiFetch = vi.fn().mockRejectedValue(new Error("sieć"));
    render(<ReviewRequests apiFetch={apiFetch} />);
    expect(await screen.findByText("Nie można pobrać z GitHuba")).toBeTruthy();
  });

  test("co 5 minut odświeża, ale tylko przy widocznej karcie", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const apiFetch = vi.fn().mockResolvedValue(ok(ITEMS));
    render(<ReviewRequests apiFetch={apiFetch} />);
    await screen.findByText("Do zrecenzowania");
    expect(apiFetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(5 * 60_000);
    });
    expect(apiFetch).toHaveBeenCalledTimes(2);

    setVisibility("hidden");
    await act(async () => {
      vi.advanceTimersByTime(5 * 60_000);
    });
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });

  test("powrót karty do widoczności odświeża od razu", async () => {
    const apiFetch = vi.fn().mockResolvedValue(ok(ITEMS));
    render(<ReviewRequests apiFetch={apiFetch} />);
    await screen.findByText("Do zrecenzowania");
    setVisibility("hidden");
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(apiFetch).toHaveBeenCalledTimes(1);
    setVisibility("visible");
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });

  test("po odmontowaniu: brak zapytań (interwał i nasłuch zdjęte)", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const apiFetch = vi.fn().mockResolvedValue(ok(ITEMS));
    const { unmount } = render(<ReviewRequests apiFetch={apiFetch} />);
    await screen.findByText("Do zrecenzowania");
    unmount();
    await act(async () => {
      vi.advanceTimersByTime(10 * 60_000);
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  test("odmontowanie w trakcie zapytania: odpowiedź nie zmienia stanu (bez ostrzeżeń)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let resolve: (v: unknown) => void = () => {};
    const apiFetch = vi.fn(() => new Promise((r) => (resolve = r)));
    const { unmount } = render(<ReviewRequests apiFetch={apiFetch as never} />);
    unmount();
    await act(async () => {
      resolve(ok(ITEMS));
    });
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Uruchom test, ma paść**

Run: `npx vitest run tests/unit/features/home/ReviewRequests.test.tsx`
Expected: FAIL (`Failed to resolve import "@/src/features/home/ReviewRequests"`).

- [ ] **Step 4: Napisz komponent**

`src/features/home/ReviewRequests.tsx`:

```tsx
import React, { useEffect, useState } from "react";
import type { ReviewRequestDto, ReviewRequestsDto } from "@/contexts/bc_cockpit/schemas";
import { useT } from "@/src/i18n/useT";
import { formatShortDate, formatTime } from "@/src/i18n/format";

type ApiFetch = (url: string, options?: RequestInit) => Promise<Response>;

/** Odstęp między odświeżeniami listy (tylko przy widocznej karcie przeglądarki). */
export const REVIEWS_REFRESH_MS = 5 * 60_000;

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ok"; items: ReviewRequestDto[] };

/**
 * Otwarte PR-y z prośbą o review do użytkownika (z GitHuba przez `gh`, tylko odczyt).
 * W odróżnieniu od `CommitHistory` błąd pobrania jest widoczny: cichy brak listy oznaczałby
 * przegapioną prośbę, czyli dokładnie ten problem, który panel ma usunąć.
 */
export function ReviewRequests({ apiFetch }: { apiFetch: ApiFetch }) {
  const t = useT();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      apiFetch("/api/cockpit/reviews")
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((data: ReviewRequestsDto) => {
          if (cancelled) return;
          if (data && data.available === true && Array.isArray(data.items)) {
            setState({ status: "ok", items: data.items });
          } else {
            setState({ status: "error" });
          }
        })
        .catch(() => {
          if (!cancelled) setState({ status: "error" });
        });
    };
    const reloadIfVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    load();
    const timer = setInterval(reloadIfVisible, REVIEWS_REFRESH_MS);
    document.addEventListener("visibilitychange", reloadIfVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", reloadIfVisible);
    };
  }, [apiFetch]);

  if (state.status === "loading") return null;

  return (
    <section className="kok-panel kok-reviews" aria-label={t("home:reviews.aria")}>
      <div className="kok-panel__head">
        <h3 className="kok-panel__title">
          <b>{t("home:reviews.title")}</b>
        </h3>
        {state.status === "ok" ? <span className="kok-chip">{state.items.length}</span> : null}
      </div>
      {state.status === "error" ? (
        <p className="kok-empty-msg" role="status">
          {t("home:reviews.error")}
        </p>
      ) : state.items.length === 0 ? (
        <p className="kok-empty-msg">{t("home:reviews.empty")}</p>
      ) : (
        <ul className="kok-reviews__list">
          {state.items.map((item) => {
            const when = new Date(item.updatedAt);
            return (
              <li key={`${item.repo}#${item.number}`} className="kok-reviews__item">
                <a
                  className="kok-reviews__link"
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="kok-reviews__ref">
                    {item.repo}#{item.number}
                  </span>{" "}
                  {item.title}
                </a>
                <span className="kok-reviews__meta">
                  {item.author ? `${item.author} · ` : ""}
                  {formatShortDate(when)} {formatTime(when)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
```

`src/features/home/CockpitSections.tsx` — po `import { CommitHistory } from "./CommitHistory";` dopisz `import { ReviewRequests } from "./ReviewRequests";`, a linię `<CommitHistory apiFetch={apiFetch} day={data.date} />` poprzedź linią:

```tsx
<ReviewRequests apiFetch={apiFetch} />
```

- [ ] **Step 5: Uruchom test, ma przejść**

Run: `npx vitest run tests/unit/features/home/ReviewRequests.test.tsx tests/unit/i18n`
Expected: PASS (komponent i parytet PL/EN).

- [ ] **Step 6: Uruchom testy Kokpitu**

Run: `npx vitest run tests/unit/features/home`
Expected: istniejące testy mogą paść lub zostać zielone. Domyślna odpowiedź mocka `[]` nie ma `items`, więc `ReviewRequests` pokaże błąd; jeśli któryś test `HomeView*` na tym pęka, naprawia to Task 4 (mock `/api/cockpit/reviews`).

- [ ] **Step 7: Commit**

```bash
git add src/i18n/locales src/features/home/ReviewRequests.tsx src/features/home/CockpitSections.tsx tests/unit/features/home/ReviewRequests.test.tsx
git commit -m "feat(home): panel „Do zrecenzowania” w Kokpicie (odświeżanie co 5 min)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Mechaniczne dopełnienia: CSS, mocki, test EN (`cursor --role task`)

**Files:**

- Modify: `src/features/home/home.css`, `tests/unit/features/home/HomeView.test.tsx`, `tests/unit/features/home/HomeView.en.test.tsx`
- Create: `tests/unit/features/home/ReviewRequests.en.test.tsx`

- [ ] **Step 1: Zleć cursorowi (jedno zadanie, dokładny kod)**

```bash
scripts/ask-helper.sh --role task --tier light --fresh cursor "Cztery drobne zmiany, dokładnie w tych plikach, nic poza nimi. (1) Na końcu src/features/home/home.css dopisz: /* ---------- Do zrecenzowania ---------- */ .kok-reviews__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--s-3); } .kok-reviews__item { display: flex; flex-direction: column; gap: 2px; min-width: 0; } .kok-reviews__link { color: var(--text); text-decoration: none; font: 500 var(--fs-sm) / 1.4 var(--font-mono); overflow-wrap: anywhere; } .kok-reviews__link:hover { color: var(--accent); text-decoration: underline; } .kok-reviews__ref { color: var(--accent); } .kok-reviews__meta { font: 500 var(--fs-sm) / 1.4 var(--font-mono); color: var(--muted); } (sformatuj jak reszta pliku, jedna deklaracja na linię). (2) W tests/unit/features/home/HomeView.test.tsx w funkcji respond, zaraz po bloku if (url.startsWith(\"/api/cockpit/commits\")) { … } dopisz blok: if (url === \"/api/cockpit/reviews\") { return Promise.resolve({ ok: true, json: async () => ({ available: true, items: [] }) }); }. (3) To samo w tests/unit/features/home/HomeView.en.test.tsx w funkcji respond (po bloku dla /api/cockpit/commits). (4) Utwórz tests/unit/features/home/ReviewRequests.en.test.tsx: import React, { cleanup, render, screen }, { afterEach, describe, expect, test, vi }, { setLanguage } z \"@/src/i18n\", { act } z testing-library, ReviewRequests z \"@/src/features/home/ReviewRequests\". Jeden describe('ReviewRequests po angielsku') z trzema testami, w każdym najpierw await act(async () => { await setLanguage('en'); }), afterEach: cleanup() oraz await act(async () => { await setLanguage('pl'); }). Test 1: apiFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ available: true, items: [{ repo: 'o/r', number: 2, title: 'Second PR', author: 'ann', url: 'https://github.com/o/r/pull/2', updatedAt: '2026-11-15T10:00:00Z' }] }) }); po render oczekuj await screen.findByText('To review') oraz getByRole('link', { name: /o\/r#2/ }). Test 2: items: [] → findByText('No review requests'). Test 3: apiFetch = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }) → findByText('Could not load from GitHub'). Teksty angielskie wpisz dokładnie tak, jak podano (bez zmiany cudzysłowów i wielkości liter). Po zmianach uruchom npx vitest run tests/unit/features/home i podaj wynik: 'przeszło' albo lista plik:linia + przyczyna."
```

- [ ] **Step 2: Sprawdź wynik**

Run: `git diff --stat` — ma obejmować dokładnie: `home.css`, `HomeView.test.tsx`, `HomeView.en.test.tsx` i nowy `ReviewRequests.en.test.tsx`. Przejrzyj `git diff` pod kątem: wartości CSS zgodne z podaną listą, brak zmian poza wskazanymi blokami. Cokolwiek poza zakresem cofam (`git checkout -- <plik>` dla pliku spoza listy).

- [ ] **Step 3: Zweryfikuj testy**

Run (przez cursora, `--approve-allowed`):

```bash
scripts/ask-helper.sh --role task --tier light --approve-allowed --keep cursor "Uruchom npx vitest run tests/unit/features/home tests/unit/i18n i odpowiedz 'przeszło' albo lista plik:linia + przyczyna."
```

Expected: przeszło.

- [ ] **Step 4: Commit**

```bash
git add src/features/home/home.css tests/unit/features/home
git commit -m "feat(home): style panelu „Do zrecenzowania”, mocki i test EN

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Dokumentacja, pełna weryfikacja i review końcowe

**Files:** Modify `CLAUDE.md`

- [ ] **Step 1: Dopisz `lib/github/` do infrastruktury**

W `CLAUDE.md` zamień fragment `` `lib/http/`, `lib/schema/`, `lib/errors.ts` `` na `` `lib/github/` (otwarte prośby o review przez `gh`, tylko odczyt; `child_process` tylko tu), `lib/http/`, `lib/schema/`, `lib/errors.ts` ``.

- [ ] **Step 2: Pełna weryfikacja przez cursora (po kolei, jedno polecenie na zadanie)**

```bash
scripts/ask-helper.sh --role task --tier light --approve-allowed --fresh cursor "Uruchom npx tsc --noEmit i odpowiedz 'przeszło' albo lista plik:linia + przyczyna."
scripts/ask-helper.sh --role task --tier light --approve-allowed --keep cursor "Uruchom npm run lint i odpowiedz 'przeszło' albo lista plik:linia + przyczyna."
scripts/ask-helper.sh --role task --tier light --approve-allowed --keep cursor "Uruchom npx vitest run i odpowiedz 'przeszło' (podaj liczbę testów) albo lista plik:linia + przyczyna."
scripts/ask-helper.sh --role task --tier light --approve-allowed --keep cursor "Uruchom npm run build i odpowiedz 'przeszło' albo lista plik:linia + przyczyna."
```

Expected: cztery razy „przeszło”. Gdy podsumowanie nie wystarcza, czytam pełny output sam. Pękający test naprawiam kodem (nie zmieniam `architecture.static.test.ts`).

- [ ] **Step 3: Sprawdzenie na żywo (jednorazowo, bez nowego kodu)**

Run: `gh search prs --review-requested=@me --state=open --limit 30 --json number,title,url,author,repository,updatedAt` i porównaj liczbę wyników z tym, co pokaże Kokpit po `npm run dev` (użytkownik otwiera Kokpit; w terminalu agenta nie uruchamiam przeglądarki). Oczekiwane: te same PR-y (dziś: `crait-p-s-a/career-guide#1476`).

- [ ] **Step 4: Review całego diffa przez agy (read-only)**

```bash
AGY_DEEP_TAG=Hydrogen scripts/ask-helper.sh --role review --tier deep --fresh agy "Zrób review diffa gałęzi względem main (git diff main...HEAD, tylko czytaj) dla funkcji 'Do zrecenzowania' w Kokpicie Monolith. Spec: docs/superpowers/specs/2026-11-16-review-requesty-kokpit-design.md, plan: docs/superpowers/plans/2026-11-16-review-requesty-kokpit.md. Szukaj: rozbieżności ze specem, naruszeń warstw (contexts/bc_cockpit), błędów w ReviewRequests.tsx (wycieki interwału/nasłuchu, wyścigi odpowiedzi), luk w testach, błędów w tekstach PL/EN. Odpowiedz listą: plik:linia + problem + poprawka; na końcu 'OK' lub 'wymaga poprawek'. Max 30 linii."
```

Opinie weryfikuję w kodzie; uzasadnione poprawki wprowadzam z testem i osobnym commitem `fix(...)`.

- [ ] **Step 5: Commit dokumentacji**

```bash
git add CLAUDE.md
git commit -m "docs: lib/github/ na liście infrastruktury

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Podsumowanie dla użytkownika**

Podaję: wyniki czterech kontroli, uwagi z review i co z nimi zrobiłem, `git log --oneline main..HEAD`. Push i PR tylko na prośbę użytkownika (skill `finishing-a-development-branch`).

---

## Self-review planu względem specu

- **Pokrycie specu:** §3 `lib/github` → Task 1; `bc_cockpit` (models, repositories, services, schemas, router, route) → Task 2; UI, i18n, CSS, `CockpitSections` → Tasks 3–4; dokumentacja (`CLAUDE.md`) → Task 5; §4 testy: lib (Task 1), services/router/schemas/repositories (Task 2), komponent PL i EN, odświeżanie, widoczność, odmontowanie (Tasks 3–4); test architektury bez zmian (Task 2, Step 4).
- **Rozbieżności ze specem usunięte w Tasku 0:** spłaszczony typ w lib, chip zamiast `{{count}}`. Odpadło „godz. temu” (spec §3 UI już mówi o `formatShortDate`/`formatTime`).
- **Spójność nazw:** `fetchReviewRequests` (lib) → `loadReviewRequests` (repositories) → `getReviewRequests` (services i router) → `toReviewRequestsDto` (schemas); typy `ReviewRequest`/`ReviewRequests` (models), `ReviewRequestDto`/`ReviewRequestsDto` (schemas); stała `MAX_REVIEW_REQUESTS` (services), `REVIEWS_REFRESH_MS` (komponent); klucze i18n `home:reviews.{aria,title,empty,error}`.
