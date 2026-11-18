# Kokpit: kafelek „Otwarte PR” i zamiana kolumn, plan wykonania

> **Dla wykonawców:** spec: `docs/superpowers/specs/2026-11-18-kokpit-otwarte-pr-design.md`. Kroki mają
> checkboxy (`- [ ]`). **Nikt poza Claude Code nie robi `git commit`** (reguła repo): pomocnik kończy pracę
> raportem `GOTOWE: …` / `UTKNĄŁEM: …`, a Claude sprawdza `git diff --stat`, testy i commituje.
> Prompty do pomocników: ścieżki względem `~/projects/Brain_7224/Monolith`.

**Cel:** w Kokpicie pokazać wszystkie własne, otwarte PR-y (draft na szaro, gotowy na zielono) i przestawić
kolumny na: Do zrecenzowania / Otwarte PR + Kolejka dziś + Inbox / Punkty skupienia.

**Architektura:** `gh search prs --author=@me --state=open` w `lib/github/my-open-prs.ts` → `bc_cockpit`
(repositories → services → router) → `app/api/cockpit/open-prs/route.ts` → `src/features/home/OpenPrs.tsx`
(wzorowany na `ReviewRequests.tsx`).

**Stos:** Next.js 14, TypeScript, Vitest (+ Testing Library), CSS w `src/features/home/home.css`, i18n `pl`/`en`.

## Podział pracy

| Zadanie                 | Pliki                                                                | Kto                                   | Kolejność         |
| ----------------------- | -------------------------------------------------------------------- | ------------------------------------- | ----------------- |
| 1. `lib/github`         | `lib/github/parse.ts`, `my-open-prs.ts`, `review-requests.ts`, testy | `cursor --role task`                  | 1                 |
| 2. `bc_cockpit` + trasa | `contexts/bc_cockpit/*`, `app/api/cockpit/open-prs/route.ts`, testy  | `cursor --role task`                  | 2 (po commicie 1) |
| 3. UI + układ           | `OpenPrs.tsx`, `CockpitSections.tsx`, `home.css`, i18n, testy        | `agy --role task`                     | 3 (po commicie 2) |
| 4. Weryfikacja          | tsc, vitest, lint, build, review diffa                               | `cursor` (testy), `agy --role review` | 4                 |

Zadania idą kolejno (każde używa typów z poprzedniego); pliki nie nakładają się, więc nikt nie edytuje cudzych plików.

---

## Task 1: `lib/github/my-open-prs.ts` (wykonawca: cursor)

**Pliki:**

- Create: `lib/github/parse.ts`, `lib/github/my-open-prs.ts`, `tests/unit/lib/github/my-open-prs.test.ts`
- Modify: `lib/github/review-requests.ts` (użycie wspólnych helperów, zachowanie bez zmian)

- [ ] **Krok 1: wspólne helpery.** Utwórz `lib/github/parse.ts`:

```ts
/** Wspólna walidacja odpowiedzi `gh` (tylko odczyt, bez I/O). */

/** `gh` podaje daty ISO-8601 (`2026-11-16T05:58:28Z`); luźne ciągi typu „1” odrzucamy. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

/** `url` trafia do `href`, więc przepuszczamy tylko `https://github.com/...` (bez portu i danych logowania). */
export function isGithubUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return (
      u.protocol === "https:" &&
      u.hostname === "github.com" &&
      u.port === "" &&
      u.username === "" &&
      u.password === ""
    );
  } catch {
    return false;
  }
}

export function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && ISO_DATE.test(value) && Number.isFinite(Date.parse(value));
}

export function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}
```

- [ ] **Krok 2: `review-requests.ts` używa helperów.** W `lib/github/review-requests.ts` usuń lokalne `ISO_DATE`,
      `isGithubUrl` i `asObject`, dodaj `import { asObject, isGithubUrl, isIsoDate } from "./parse";`, a warunek
      daty w `parseItem` zamień na `if (!isIsoDate(updatedAt)) return null;`. Nic więcej nie zmieniaj.
      Uruchom: `npx vitest run tests/unit/lib/github/review-requests.test.ts`. Oczekiwane: wszystkie zielone (bez zmian w teście).

- [ ] **Krok 3: czerwony test.** Utwórz `tests/unit/lib/github/my-open-prs.test.ts` (ten sam szkielet mocka `execFile` co w `review-requests.test.ts`):

```ts
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockExecFile = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ execFile: mockExecFile }));

import { fetchMyOpenPrs } from "@/lib/github/my-open-prs";

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
  number: 5,
  title: "feat: coś",
  url: "https://github.com/o/r/pull/5",
  repository: { name: "r", nameWithOwner: "o/r" },
  updatedAt: "2026-11-16T05:58:28Z",
  isDraft: false,
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("fetchMyOpenPrs", () => {
  it("poprawny JSON: spłaszcza pola, isDraft trafia do draft", async () => {
    ghReturns(JSON.stringify([PR, { ...PR, number: 6, isDraft: true }]));
    expect(await fetchMyOpenPrs()).toEqual({
      ok: true,
      items: [
        {
          repo: "o/r",
          number: 5,
          title: "feat: coś",
          url: "https://github.com/o/r/pull/5",
          updatedAt: "2026-11-16T05:58:28Z",
          draft: false,
        },
        {
          repo: "o/r",
          number: 6,
          title: "feat: coś",
          url: "https://github.com/o/r/pull/5",
          updatedAt: "2026-11-16T05:58:28Z",
          draft: true,
        },
      ],
    });
  });

  it("woła gh ze stałą białą listą argumentów", async () => {
    ghReturns("[]");
    await fetchMyOpenPrs();
    expect(mockExecFile).toHaveBeenCalledTimes(1);
    expect(mockExecFile.mock.calls[0][0]).toBe("gh");
    expect(mockExecFile.mock.calls[0][1]).toEqual([
      "search",
      "prs",
      "--author=@me",
      "--state=open",
      "--sort",
      "updated",
      "--order",
      "desc",
      "--limit",
      "100",
      "--json",
      "number,title,url,repository,updatedAt,isDraft",
    ]);
  });

  it.each([
    ["url spoza github.com", { url: "https://evil.example/o/r/pull/5" }],
    ["url z http", { url: "http://github.com/o/r/pull/5" }],
    ["number 0", { number: 0 }],
    ["number ułamkowy", { number: 1.5 }],
    ["zła data", { updatedAt: "1" }],
    ["brak repository", { repository: undefined }],
    ["pusty tytuł", { title: "" }],
    ["isDraft nie boolean", { isDraft: "no" }],
  ])("pomija wiersz: %s", async (_name, patch) => {
    ghReturns(
      JSON.stringify([
        { ...PR, ...patch },
        { ...PR, number: 7 },
      ])
    );
    const res = await fetchMyOpenPrs();
    if (res.ok === false) throw new Error("oczekiwano ok");
    expect(res.items.map((i) => i.number)).toEqual([7]);
  });

  it("niepoprawny JSON i nie-tablica to gh-error", async () => {
    ghReturns("nie json");
    expect(await fetchMyOpenPrs()).toEqual({ ok: false, reason: "gh-error" });
    ghReturns("{}");
    expect(await fetchMyOpenPrs()).toEqual({ ok: false, reason: "gh-error" });
  });

  it("brak gh to gh-missing, inny błąd to gh-error", async () => {
    ghFails("ENOENT");
    expect(await fetchMyOpenPrs()).toEqual({ ok: false, reason: "gh-missing" });
    ghFails(1);
    expect(await fetchMyOpenPrs()).toEqual({ ok: false, reason: "gh-error" });
  });
});
```

Uruchom: `npx vitest run tests/unit/lib/github/my-open-prs.test.ts`. Oczekiwane: FAIL (brak modułu `my-open-prs`).

- [ ] **Krok 4: implementacja.** Utwórz `lib/github/my-open-prs.ts`:

```ts
import { runGh } from "./gh";
import { asObject, isGithubUrl, isIsoDate } from "./parse";

/** Własny, otwarty PR (spłaszczony wynik `gh`). */
export type GithubOpenPr = {
  /** `właściciel/repo`. */
  repo: string;
  number: number;
  title: string;
  url: string;
  /** Data ISO ostatniej zmiany PR-a. */
  updatedAt: string;
  /** PR w trybie draft. */
  draft: boolean;
};

export type OpenPrsResult =
  | { ok: true; items: GithubOpenPr[] }
  | { ok: false; reason: "gh-missing" | "gh-error" };

/** Biała lista: jedyne wywołanie `gh`, jakie ta warstwa potrafi wykonać (tylko odczyt, bez argumentów z zewnątrz). */
const GH_ARGS = [
  "search",
  "prs",
  "--author=@me",
  "--state=open",
  "--sort",
  "updated",
  "--order",
  "desc",
  "--limit",
  "100",
  "--json",
  "number,title,url,repository,updatedAt,isDraft",
];

function parseItem(raw: unknown): GithubOpenPr | null {
  const r = asObject(raw);
  if (!r) return null;
  const repo = asObject(r.repository)?.nameWithOwner;
  const { number, title, url, updatedAt, isDraft } = r;
  if (typeof repo !== "string" || repo === "") return null;
  if (typeof number !== "number" || !Number.isInteger(number) || number <= 0) return null;
  if (typeof title !== "string" || title === "") return null;
  if (typeof url !== "string" || !isGithubUrl(url)) return null;
  if (!isIsoDate(updatedAt)) return null;
  if (typeof isDraft !== "boolean") return null;
  return { repo, number, title, url, updatedAt, draft: isDraft };
}

/** Własne otwarte PR-y (konto zalogowane w `gh`; repo publiczne, prywatne i organizacji), najnowsze pierwsze. Błąd `gh` to `ok: false`, nie wyjątek. */
export async function fetchMyOpenPrs(): Promise<OpenPrsResult> {
  const run = await runGh(GH_ARGS);
  if (run.ok === false) return run;
  let parsed: unknown;
  try {
    parsed = JSON.parse(run.stdout);
  } catch {
    return { ok: false, reason: "gh-error" };
  }
  if (!Array.isArray(parsed)) return { ok: false, reason: "gh-error" };
  const items: GithubOpenPr[] = [];
  for (const raw of parsed) {
    const item = parseItem(raw);
    if (item) items.push(item);
  }
  return { ok: true, items };
}
```

- [ ] **Krok 5: zielone.** `npx vitest run tests/unit/lib/github tests/unit/architecture.static.test.ts` oraz `npx tsc --noEmit`.
      Oczekiwane: wszystko zielone. Wiersze z `repository: undefined` i `isDraft: "no"` są odrzucane (test `it.each`).
- [ ] **Krok 6 (Claude):** `git diff --stat`, commit `feat(github): własne otwarte PR-y (my-open-prs), wspólne helpery parse`.

### Prompt dla cursora (Task 1)

```
Zadanie (--role task), repo ~/projects/Brain_7224/Monolith, gałąź feat/kokpit-otwarte-pr. NIE commituj.
Wykonaj Task 1 z docs/superpowers/plans/2026-11-18-kokpit-otwarte-pr.md (kroki 1-5), dosłownie wg kodu z planu:
utwórz lib/github/parse.ts, lib/github/my-open-prs.ts, tests/unit/lib/github/my-open-prs.test.ts, zmodyfikuj
lib/github/review-requests.ts (użycie helperów, bez zmiany zachowania). Zachowaj polskie znaki i cudzysłowy
z planu bez zmian. Nie ruszaj innych plików. Kolejność: najpierw test (ma być czerwony), potem implementacja.
Na koniec uruchom: npx vitest run tests/unit/lib/github tests/unit/architecture.static.test.ts  oraz  npx tsc --noEmit.
Raport: "GOTOWE: <lista zmienionych plików>, testy zielone" albo "UTKNĄŁEM: plik:linia + przyczyna".
```

---

## Task 2: `bc_cockpit` i trasa API (wykonawca: cursor)

**Pliki:**

- Modify: `contexts/bc_cockpit/{models,repositories,services,schemas,router}.ts`
- Create: `app/api/cockpit/open-prs/route.ts`
- Test: `tests/unit/contexts/bc_cockpit/{reviews-repository,services,schemas,router}.test.ts` (dopisać describe'y)

- [ ] **Krok 1: czerwone testy.**

a) `reviews-repository.test.ts`: dodaj na górze (obok pozostałych mocków) `const mockFetchMyOpenPrs = vi.hoisted(() => vi.fn());`
oraz `vi.mock("@/lib/github/my-open-prs", () => ({ fetchMyOpenPrs: mockFetchMyOpenPrs }));`, rozszerz import o `loadOpenPrs` i dopisz na końcu pliku:

```ts
describe("loadOpenPrs", () => {
  it("ok: kopiuje pola do modelu, available true", async () => {
    const item = {
      repo: "o/r",
      number: 5,
      title: "Tytuł",
      url: "https://github.com/o/r/pull/5",
      updatedAt: "2026-11-16T05:58:28Z",
      draft: true,
    };
    mockFetchMyOpenPrs.mockResolvedValue({ ok: true, items: [item] });
    expect(await loadOpenPrs()).toEqual({ available: true, total: 1, items: [item] });
  });

  it.each(["gh-missing", "gh-error"])("%s to available false z pustą listą", async (reason) => {
    mockFetchMyOpenPrs.mockResolvedValue({ ok: false, reason });
    expect(await loadOpenPrs()).toEqual({ available: false, total: 0, items: [] });
  });
});
```

b) `services.test.ts`: dodaj `const mockLoadOpenPrs = vi.hoisted(() => vi.fn());`, w fabryce mocka repozytorium
(obok `loadReviewRequests: mockLoadReviewRequests,`) dopisz `loadOpenPrs: mockLoadOpenPrs,`, w imporcie z
`@/contexts/bc_cockpit/services` dopisz `getOpenPrs,` i `MAX_OPEN_PRS,`, a po bloku `describe("getReviewRequests", …)` dodaj:

```ts
describe("getOpenPrs", () => {
  const pr = (n: number, updatedAt: string, draft = false) => ({
    repo: "o/r",
    number: n,
    title: `PR ${n}`,
    url: `https://github.com/o/r/pull/${n}`,
    updatedAt,
    draft,
  });

  it("sortuje malejąco po updatedAt", async () => {
    mockLoadOpenPrs.mockResolvedValue({
      available: true,
      total: 3,
      items: [
        pr(1, "2026-11-14T10:00:00Z"),
        pr(2, "2026-11-16T10:00:00Z"),
        pr(3, "2026-11-15T10:00:00Z", true),
      ],
    });
    const res = await getOpenPrs();
    expect(res.available).toBe(true);
    expect(res.items.map((i) => i.number)).toEqual([2, 3, 1]);
    expect(res.items[1].draft).toBe(true);
  });

  it("przycina do 20 najnowszych, total zostaje pełny", async () => {
    const items = Array.from({ length: 25 }, (_, i) =>
      pr(i + 1, new Date(Date.UTC(2026, 10, 1, 0, i)).toISOString())
    ).reverse();
    mockLoadOpenPrs.mockResolvedValue({ available: true, total: 25, items });
    const res = await getOpenPrs();
    expect(res.total).toBe(25);
    expect(MAX_OPEN_PRS).toBe(20);
    expect(res.items).toHaveLength(20);
    expect(res.items[0].number).toBe(25);
    expect(res.items[19].number).toBe(6);
  });

  it("niedostępny GitHub przechodzi bez zmian", async () => {
    mockLoadOpenPrs.mockResolvedValue({ available: false, total: 0, items: [] });
    expect(await getOpenPrs()).toEqual({ available: false, total: 0, items: [] });
  });
});
```

c) `schemas.test.ts`: dodaj `toOpenPrsDto,` do importu z `@/contexts/bc_cockpit/schemas` i na końcu pliku:

```ts
describe("toOpenPrsDto", () => {
  const item = {
    repo: "o/r",
    number: 1,
    title: "t",
    url: "https://github.com/o/r/pull/1",
    updatedAt: "2026-11-16T05:58:28Z",
    draft: true,
  };

  it("kopiuje pola i odrzuca nadmiarowe", () => {
    const dto = toOpenPrsDto({
      available: true,
      total: 7,
      items: [{ ...item, extra: 1 }],
    } as never);
    expect(dto).toEqual({ available: true, total: 7, items: [item] });
  });
});
```

d) `router.test.ts`: dodaj `const mockGetOpenPrs = vi.hoisted(() => vi.fn());`, w fabryce mocka serwisu
`getOpenPrs: mockGetOpenPrs,`, w imporcie z routera `getOpenPrs,` i na końcu pliku:

```ts
describe("GET /api/cockpit/open-prs", () => {
  const item = {
    repo: "o/r",
    number: 1,
    title: "t",
    url: "https://github.com/o/r/pull/1",
    updatedAt: "2026-11-16T05:58:28Z",
    draft: false,
  };

  it("200 z DTO", async () => {
    mockGetOpenPrs.mockResolvedValue({ available: true, total: 9, items: [item] });
    const res = await getOpenPrs();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ available: true, total: 9, items: [item] });
  });

  it("200 i available false, gdy GitHub niedostępny (nie 500)", async () => {
    mockGetOpenPrs.mockResolvedValue({ available: false, total: 0, items: [] });
    const res = await getOpenPrs();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ available: false, total: 0, items: [] });
  });
});
```

Uruchom: `npx vitest run tests/unit/contexts/bc_cockpit`. Oczekiwane: FAIL (brak eksportów).

- [ ] **Krok 2: implementacja** (dokładnie te dopiski):

`contexts/bc_cockpit/models.ts`: po `ReviewRequests` dopisz

```ts
/** Własny, otwarty PR użytkownika (tylko odczyt z GitHuba). */
export type OpenPr = {
  /** `właściciel/repo`. */
  repo: string;
  number: number;
  title: string;
  url: string;
  /** Data ISO ostatniej zmiany PR-a. */
  updatedAt: string;
  /** PR w trybie draft. */
  draft: boolean;
};

/**
 * Otwarte PR-y użytkownika; `available: false`, gdy GitHub jest niedostępny (brak `gh`, sieci, logowania).
 * `total` to liczba wszystkich PR-ów, a `items` może być krótsze (limit listy).
 */
export type OpenPrs = { available: boolean; total: number; items: OpenPr[] };
```

`repositories.ts`: dodaj `import { fetchMyOpenPrs } from "@/lib/github/my-open-prs";`, dopisz `OpenPrs` do importu typów z `./models`,
a po `loadReviewRequests` dodaj

```ts
/** Własne otwarte PR-y z GitHuba (przez `lib/github`); błąd `gh` to `available: false`, nie wyjątek. */
export async function loadOpenPrs(): Promise<OpenPrs> {
  const res = await fetchMyOpenPrs();
  if (res.ok === false) return { available: false, total: 0, items: [] };
  return {
    available: true,
    total: res.items.length,
    items: res.items.map((i) => ({
      repo: i.repo,
      number: i.number,
      title: i.title,
      url: i.url,
      updatedAt: i.updatedAt,
      draft: i.draft,
    })),
  };
}
```

`services.ts`: dopisz `type OpenPrs,` do importu typów z `./models`; po `getReviewRequests` dodaj

```ts
export const MAX_OPEN_PRS = 20;

/** Własne otwarte PR-y z GitHuba: najnowsze pierwsze, maksymalnie `MAX_OPEN_PRS`. */
export async function getOpenPrs(): Promise<OpenPrs> {
  const res = await repositories.loadOpenPrs();
  const items = [...res.items]
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, MAX_OPEN_PRS);
  return { available: res.available, total: res.total, items };
}
```

`schemas.ts`: dopisz `OpenPr, OpenPrs,` do importu typów z `./models`; po `ReviewRequestsDto` dodaj
`export type OpenPrDto = OpenPr;` i `export type OpenPrsDto = OpenPrs;`; po `toReviewRequestsDto` dodaj

```ts
export function toOpenPrsDto(r: OpenPrs): OpenPrsDto {
  return {
    available: r.available,
    total: r.total,
    items: r.items.map((i) => ({
      repo: i.repo,
      number: i.number,
      title: i.title,
      url: i.url,
      updatedAt: i.updatedAt,
      draft: i.draft,
    })),
  };
}
```

`router.ts`: dopisz `toOpenPrsDto,` do importu z `./schemas` (alfabetycznie, przed `toPinnedDto` jeśli tam jest) i po `getReviewRequests` dodaj

```ts
/** GET: własne otwarte PR-y z GitHuba; niedostępny `gh` to 200 z `available: false`, nie błąd. */
export async function getOpenPrs(): Promise<NextResponse> {
  try {
    return NextResponse.json(toOpenPrsDto(await services.getOpenPrs()));
  } catch (err) {
    return handleServiceError(err);
  }
}
```

`app/api/cockpit/open-prs/route.ts` (nowy plik, wzór `app/api/cockpit/reviews/route.ts`):

```ts
export { getOpenPrs as GET } from "@/contexts/bc_cockpit/router";

export const dynamic = "force-dynamic";
```

- [ ] **Krok 3: zielone.**
      `npx vitest run tests/unit/contexts/bc_cockpit tests/unit/api-routes-dynamic.static.test.ts tests/unit/architecture.static.test.ts`
      oraz `npx tsc --noEmit` oraz `npm run lint`. Oczekiwane: zielone.
- [ ] **Krok 4 (Claude):** `git diff --stat`, commit `feat(cockpit): trasa /api/cockpit/open-prs (własne otwarte PR-y)`.

### Prompt dla cursora (Task 2)

```
Zadanie (--role task), repo ~/projects/Brain_7224/Monolith, gałąź feat/kokpit-otwarte-pr. NIE commituj.
Wykonaj Task 2 z docs/superpowers/plans/2026-11-18-kokpit-otwarte-pr.md (kroki 1-3), dosłownie wg kodu z planu.
Pliki wolno zmieniać tylko te, które wymienia Task 2. Najpierw testy (czerwone), potem implementacja.
Nie zmieniaj tests/unit/architecture.static.test.ts. Zachowaj polskie znaki i cudzysłowy bez zmian.
Na koniec: npx vitest run tests/unit/contexts/bc_cockpit tests/unit/api-routes-dynamic.static.test.ts tests/unit/architecture.static.test.ts,
npx tsc --noEmit, npm run lint.
Raport: "GOTOWE: <pliki>, testy/tsc/lint zielone" albo "UTKNĄŁEM: plik:linia + przyczyna".
```

---

## Task 3: UI i układ kolumn (wykonawca: agy)

**Pliki:**

- Create: `src/features/home/OpenPrs.tsx`, `tests/unit/features/home/OpenPrs.test.tsx`
- Modify: `src/features/home/CockpitSections.tsx`, `src/features/home/home.css`,
  `src/i18n/locales/pl/home.ts`, `src/i18n/locales/en/home.ts`,
  `tests/unit/features/home/HomeView.test.tsx`, `tests/unit/features/home/HomeView.en.test.tsx`

- [ ] **Krok 1: i18n.** W `src/i18n/locales/pl/home.ts` zaraz po bloku `reviews: { … },` dodaj:

```ts
  openPrs: {
    aria: "Otwarte PR",
    title: "Otwarte PR",
    empty: "Brak otwartych PR",
    error: "Nie można pobrać z GitHuba",
    draft: "draft",
    ready: "gotowy",
    more: "+{{n}} starszych",
  },
```

W `src/i18n/locales/en/home.ts` w tym samym miejscu:

```ts
  openPrs: {
    aria: "Open PRs",
    title: "Open PRs",
    empty: "No open PRs",
    error: "Could not load from GitHub",
    draft: "draft",
    ready: "ready",
    more: "+{{n}} older",
  },
```

Uruchom `npx vitest run tests/unit/i18n/parity.test.ts` (klucze `pl` i `en` muszą się zgadzać).

- [ ] **Krok 2: CSS.** W `src/features/home/home.css` zaraz po regule `.kok-reviews__meta { … }` dodaj:

```css
/* ---------- Otwarte PR: draft na szaro, gotowy na zielono ---------- */
.kok-reviews__ref--ready {
  color: var(--green);
}

.kok-reviews__ref--draft {
  color: var(--muted);
}

.kok-reviews__state {
  font: 500 var(--fs-xs) / 1.3 var(--font-mono);
}

.kok-reviews__state--ready {
  color: var(--green);
}

.kok-reviews__state--draft {
  color: var(--muted);
}
```

Oraz w regule `.kok-grid` zmień `grid-template-columns: 1.05fr 1.35fr 1fr;` na `grid-template-columns: 1.05fr 1fr 1.35fr;`,
a komentarz nad nią na `/* ---------- Siatka główna (Do zrecenzowania i oś dnia, otwarte PR i kolejka, punkty skupienia) ---------- */`.

- [ ] **Krok 3: czerwony test komponentu.** Utwórz `tests/unit/features/home/OpenPrs.test.tsx`:

```tsx
import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { OpenPrs } from "@/src/features/home/OpenPrs";

const ITEMS = [
  {
    repo: "o/r",
    number: 5,
    title: "Gotowy PR",
    url: "https://github.com/o/r/pull/5",
    updatedAt: "2026-11-16T05:58:28Z",
    draft: false,
  },
  {
    repo: "org/app",
    number: 6,
    title: "Szkic",
    url: "https://github.com/org/app/pull/6",
    updatedAt: "2026-11-15T10:00:00Z",
    draft: true,
  },
];

const ok = (items: unknown[], total: number = items.length) => ({
  ok: true,
  json: async () => ({ available: true, total, items }),
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("OpenPrs", () => {
  test("przed pierwszą odpowiedzią nic nie pokazuje i woła właściwą trasę", () => {
    const apiFetch = vi.fn(() => new Promise<never>(() => {}));
    const { container } = render(<OpenPrs apiFetch={apiFetch} />);
    expect(container).toBeEmptyDOMElement();
    expect(apiFetch).toHaveBeenCalledWith("/api/cockpit/open-prs");
  });

  test("lista: nagłówek, licznik, bezpieczne linki, draft szary i gotowy zielony", async () => {
    const apiFetch = vi.fn().mockResolvedValue(ok(ITEMS));
    render(<OpenPrs apiFetch={apiFetch} />);
    expect(await screen.findByText("Otwarte PR")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    const link = screen.getByRole("link", { name: /o\/r#5/ });
    expect(link.getAttribute("href")).toBe(ITEMS[0].url);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getByText("o/r#5").className).toContain("kok-reviews__ref--ready");
    expect(screen.getByText("org/app#6").className).toContain("kok-reviews__ref--draft");
    expect(screen.getByText("gotowy").className).toContain("kok-reviews__state--ready");
    expect(screen.getByText("draft").className).toContain("kok-reviews__state--draft");
  });

  test("pusta lista: komunikat, licznik 0", async () => {
    render(<OpenPrs apiFetch={vi.fn().mockResolvedValue(ok([]))} />);
    expect(await screen.findByText("Brak otwartych PR")).toBeTruthy();
    expect(screen.getByText("0")).toBeTruthy();
  });

  test("błąd HTTP i available false pokazują komunikat o błędzie", async () => {
    render(<OpenPrs apiFetch={vi.fn().mockResolvedValue({ ok: false, status: 500 })} />);
    expect(await screen.findByText("Nie można pobrać z GitHuba")).toBeTruthy();
    cleanup();
    render(
      <OpenPrs
        apiFetch={vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ available: false, total: 0, items: [] }),
        })}
      />
    );
    expect(await screen.findByText("Nie można pobrać z GitHuba")).toBeTruthy();
  });

  test("total większy niż lista: „+N starszych”", async () => {
    render(<OpenPrs apiFetch={vi.fn().mockResolvedValue(ok(ITEMS, 25))} />);
    expect(await screen.findByText("+23 starszych")).toBeTruthy();
  });

  test("odświeża co 5 minut przy widocznej karcie", async () => {
    vi.useFakeTimers();
    const apiFetch = vi.fn().mockResolvedValue(ok(ITEMS));
    render(<OpenPrs apiFetch={apiFetch} />);
    await act(async () => {});
    expect(apiFetch).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(5 * 60_000);
    });
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });
});
```

Uruchom `npx vitest run tests/unit/features/home/OpenPrs.test.tsx`. Oczekiwane: FAIL (brak komponentu).

- [ ] **Krok 4: komponent.** Utwórz `src/features/home/OpenPrs.tsx`:

```tsx
import React, { useEffect, useState } from "react";
import type { OpenPrDto, OpenPrsDto } from "@/contexts/bc_cockpit/schemas";
import { useT } from "@/src/i18n/useT";
import { formatShortDate, formatTime } from "@/src/i18n/format";

type ApiFetch = (url: string, options?: RequestInit) => Promise<Response>;

/** Odstęp między odświeżeniami listy (tylko przy widocznej karcie przeglądarki). */
export const OPEN_PRS_REFRESH_MS = 5 * 60_000;

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ok"; items: OpenPrDto[]; total: number };

/**
 * Własne, otwarte PR-y użytkownika (z GitHuba przez `gh`, tylko odczyt): draft na szaro, gotowy na zielono.
 * Błąd pobrania jest widoczny (jak w `ReviewRequests`): cichy brak listy ukryłby PR wymagający uwagi.
 */
export function OpenPrs({ apiFetch }: { apiFetch: ApiFetch }) {
  const t = useT();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    /** Numer ostatniego zapytania: starsza odpowiedź nie nadpisuje nowszej. */
    let latest = 0;
    const load = () => {
      const id = ++latest;
      apiFetch("/api/cockpit/open-prs")
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((data: OpenPrsDto) => {
          if (cancelled || id !== latest) return;
          if (data && data.available === true && Array.isArray(data.items)) {
            setState({
              status: "ok",
              items: data.items,
              total: Number.isFinite(data.total)
                ? Math.max(data.total, data.items.length)
                : data.items.length,
            });
          } else {
            setState({ status: "error" });
          }
        })
        .catch(() => {
          if (!cancelled && id === latest) setState({ status: "error" });
        });
    };
    const reloadIfVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    load();
    const timer = setInterval(reloadIfVisible, OPEN_PRS_REFRESH_MS);
    document.addEventListener("visibilitychange", reloadIfVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", reloadIfVisible);
    };
  }, [apiFetch]);

  if (state.status === "loading") return null;

  return (
    <section className="kok-panel kok-reviews" aria-label={t("home:openPrs.aria")}>
      <div className="kok-panel__head">
        <h3 className="kok-panel__title">
          <b>{t("home:openPrs.title")}</b>
        </h3>
        {state.status === "ok" ? <span className="kok-chip">{state.total}</span> : null}
      </div>
      {state.status === "error" ? (
        <p className="kok-empty-msg" role="status">
          {t("home:openPrs.error")}
        </p>
      ) : state.items.length === 0 ? (
        <p className="kok-empty-msg">{t("home:openPrs.empty")}</p>
      ) : (
        <ul className="kok-reviews__list">
          {state.items.map((item) => {
            const when = new Date(item.updatedAt);
            const kind = item.draft ? "draft" : "ready";
            return (
              <li key={`${item.repo}#${item.number}`} className="kok-reviews__item">
                <a
                  className="kok-reviews__link"
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className={`kok-reviews__ref kok-reviews__ref--${kind}`}>
                    {item.repo}#{item.number}
                  </span>{" "}
                  {item.title}
                </a>
                <span className="kok-reviews__meta">
                  <span className={`kok-reviews__state kok-reviews__state--${kind}`}>
                    {t(item.draft ? "home:openPrs.draft" : "home:openPrs.ready")}
                  </span>
                  {" · "}
                  {formatShortDate(when)} {formatTime(when)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {state.status === "ok" && state.total > state.items.length ? (
        <p className="kok-empty-msg">
          {t("home:openPrs.more", { n: state.total - state.items.length })}
        </p>
      ) : null}
    </section>
  );
}
```

Uruchom `npx vitest run tests/unit/features/home/OpenPrs.test.tsx`. Oczekiwane: PASS. Jeśli `getByText("2")` trafia
w kilka elementów, zawęź zapytanie (np. `within(screen.getByLabelText("Otwarte PR"))`), nie zmieniaj komponentu.

- [ ] **Krok 5: układ w `CockpitSections.tsx`.**
  1. Dodaj `import { OpenPrs } from "./OpenPrs";` obok `import { ReviewRequests } …`.
  2. W `<div className="kok-grid">` są trzy dzieci: lewy `<div className="kok-col">` (ReviewRequests…), `<section className="kok-focus" …>…</section>`
     i drugi `<div className="kok-col">` (kolejka + inbox). **Przenieś cały drugi `<div className="kok-col">…</div>` tak, by stał
     między lewą kolumną a `<section className="kok-focus">`** (kolejność dzieci: lewa kolumna, kolumna z kolejką, punkty skupienia). Treści
     wewnątrz nie zmieniaj.
  3. Jako pierwsze dziecko przeniesionej kolumny (przed `<section className="kok-panel kok-queue" …>`) wstaw `<OpenPrs apiFetch={apiFetch} />`.
  4. Po zmianie uruchom `npx prettier --check src/features/home/CockpitSections.tsx` (jeśli zgłosi, `npx prettier --write` tylko na tym pliku).
- [ ] **Krok 6: mocki w testach widoku.** `HomeView.test.tsx` oraz `HomeView.en.test.tsx`: tuż po bloku
      `if (url === "/api/cockpit/reviews") { … }` dodaj (analogicznie w obu plikach)

```ts
if (url === "/api/cockpit/open-prs") {
  return Promise.resolve({
    ok: true,
    json: async () => ({ available: true, total: 0, items: [] }),
  });
}
```

- [ ] **Krok 7: zielone.** `npx vitest run tests/unit/features/home tests/unit/i18n` oraz `npx tsc --noEmit` oraz `npm run lint`. Oczekiwane: zielone.
- [ ] **Krok 8 (Claude):** `git diff --stat`, sprawdzenie polskich znaków skryptem (`grep -n "Otwarte PR\|Brak otwartych\|gotowy\|starszych" src/i18n/locales/pl/home.ts`), commit
      `feat(home): kafelek Otwarte PR, zamiana kolumn Kokpitu`.

### Prompt dla agy (Task 3)

```
Zadanie (--role task), repo ~/projects/Brain_7224/Monolith, gałąź feat/kokpit-otwarte-pr. NIE commituj.
Wykonaj Task 3 z docs/superpowers/plans/2026-11-18-kokpit-otwarte-pr.md (kroki 1-7), dosłownie wg kodu z planu.
Pliki wolno zmieniać tylko te, które wymienia Task 3. Zachowaj polskie znaki (ą ę ó ł ż ź ć ń ś) i cudzysłowy
z planu bez zmian. Krok 5 (przeniesienie bloku kok-col w CockpitSections.tsx) rób ostrożnie: nie zmieniaj
treści bloków, tylko ich kolejność, i dodaj <OpenPrs apiFetch={apiFetch} /> jako pierwsze dziecko kolumny z kolejką.
Na koniec: npx vitest run tests/unit/features/home tests/unit/i18n, npx tsc --noEmit, npm run lint.
Raport: "GOTOWE: <pliki>, testy/tsc/lint zielone" albo "UTKNĄŁEM: plik:linia + przyczyna".
```

---

## Task 4: weryfikacja końcowa

- [ ] **Krok 1 (cursor, `--role task --approve-allowed --tier light`):** `npx tsc --noEmit`, `npx vitest run`, `npm run lint`, `npm run build`;
      raport „przeszło” albo lista `plik:linia + przyczyna`.
- [ ] **Krok 2 (agy, `--role review`):** niezależny review `git diff main...HEAD` pod kątem: walidacja URL, brak zapisu poza odczytem,
      zgodność z architekturą (UI importuje tylko `schemas`; `child_process` tylko w `lib/`), kolejność kolumn, dostępność (status draft/gotowy także tekstem).
      Opinie traktuję jako hipotezy i weryfikuję w kodzie.
- [ ] **Krok 3 (Claude):** sprawdzenie w przeglądarce na `npm run dev` (3100): trzy kolumny w kolejności z specu, kolory draft/gotowy,
      linki otwierają PR, stan błędu przy braku `gh`. Gdy nie da się sprawdzić w przeglądarce, powiedzieć to wprost.
- [ ] **Krok 4 (Claude):** push gałęzi i PR dopiero na prośbę użytkownika.

## Samoocena planu względem specu

- Układ kolumn i CSS: Task 3 kroki 2, 5. Kafelek (autor, draft szary, gotowy zielony, wszystkie repo, limit 20, błąd, pusto, odświeżanie): Task 1, 2, 3.
- Trasa `force-dynamic` i strażnik: Task 2 krok 2 i 3. Wspólna walidacja zamiast kopii: Task 1 kroki 1-2. i18n `pl`/`en`: Task 3 krok 1.
- Testy: parser, repozytorium, serwis, DTO, router, komponent, `HomeView` (nowy fetch). `architecture.static.test.ts` bez zmian.
- Spójność typów: `GithubOpenPr` (`draft`) → `OpenPr` → `OpenPrDto`; `fetchMyOpenPrs` → `loadOpenPrs` → `getOpenPrs` → `toOpenPrsDto` → `OpenPrs` (komponent).

---

## Task 5: tabelka PR (wykonawca: agy; uzupełnienie specu „tabelka”)

**Pliki:**

- Create: `src/features/home/PrRow.tsx`, `tests/unit/features/home/PrRow.test.tsx`
- Modify: `src/features/home/OpenPrs.tsx`, `src/features/home/ReviewRequests.tsx`, `src/features/home/home.css`,
  `tests/unit/features/home/OpenPrs.test.tsx`, `tests/unit/features/home/ReviewRequests.test.tsx`

Istniejące zachowanie testów zostaje: link ma nazwę zawierającą `repo#numer`, `target="_blank"`, `rel="noopener noreferrer"`,
klasy `kok-reviews__ref--ready|draft` i `kok-reviews__state--ready|draft`, teksty „scalony”, „gotowy”, „draft”, autor.

- [ ] **Krok 1: czerwony test `PrRow`.** Utwórz `tests/unit/features/home/PrRow.test.tsx`:

```tsx
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { PrRow } from "@/src/features/home/PrRow";
import { formatShortDate, formatTime } from "@/src/i18n/format";

afterEach(cleanup);

const UPDATED = "2026-11-16T05:58:28Z";

describe("PrRow", () => {
  test("link do PR z repo#numer i tytułem, pełny tekst w title, bezpieczne atrybuty", () => {
    render(
      <ul>
        <PrRow
          repo="o/r"
          number={5}
          title="Bardzo długi tytuł"
          url="https://github.com/o/r/pull/5"
          updatedAt={UPDATED}
          refClassName="kok-reviews__ref--ready"
        >
          <span>status</span>
        </PrRow>
      </ul>
    );
    const link = screen.getByRole("link", { name: /o\/r#5/ });
    expect(link.getAttribute("href")).toBe("https://github.com/o/r/pull/5");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link.getAttribute("title")).toBe("o/r#5 Bardzo długi tytuł");
    expect(screen.getByText("o/r#5").className).toContain("kok-reviews__ref--ready");
    expect(screen.getByText("Bardzo długi tytuł").className).toContain("kok-pr-row__title");
  });

  test("kolumny: status (children) i data z godziną", () => {
    render(
      <ul>
        <PrRow
          repo="o/r"
          number={5}
          title="T"
          url="https://github.com/o/r/pull/5"
          updatedAt={UPDATED}
        >
          <span>status</span>
        </PrRow>
      </ul>
    );
    expect(screen.getByText("status").closest(".kok-pr-row__cell")).toBeTruthy();
    const when = new Date(UPDATED);
    expect(screen.getByText(`${formatShortDate(when)} ${formatTime(when)}`).className).toContain(
      "kok-pr-row__when"
    );
  });
});
```

Uruchom `npx vitest run tests/unit/features/home/PrRow.test.tsx`. Oczekiwane: FAIL (brak komponentu).

- [ ] **Krok 2: komponent.** Utwórz `src/features/home/PrRow.tsx`:

```tsx
import React from "react";
import { formatShortDate, formatTime } from "@/src/i18n/format";

type Props = {
  repo: string;
  number: number;
  title: string;
  url: string;
  /** Data ISO ostatniej zmiany PR-a. */
  updatedAt: string;
  /** Dodatkowa klasa koloru odnośnika `repo#numer` (np. `kok-reviews__ref--ready`). */
  refClassName?: string;
  /** Zawartość kolumny „status” (chip, autor, odznaka). */
  children?: React.ReactNode;
};

/** Wiersz tabelki PR: `repo#numer` + tytuł (jedna linia, wielokropek) jako link, status i data (wspólny dla „Otwarte PR” i „Do zrecenzowania”). */
export function PrRow({ repo, number, title, url, updatedAt, refClassName, children }: Props) {
  const when = new Date(updatedAt);
  return (
    <li className="kok-pr-row">
      <a
        className="kok-pr-row__main"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title={`${repo}#${number} ${title}`}
      >
        <span
          className={`kok-reviews__ref kok-pr-row__ref${refClassName ? ` ${refClassName}` : ""}`}
        >
          {repo}#{number}
        </span>
        <span className="kok-pr-row__title">{title}</span>
      </a>
      <span className="kok-pr-row__cell">{children}</span>
      <span className="kok-pr-row__when">
        {formatShortDate(when)} {formatTime(when)}
      </span>
    </li>
  );
}
```

Uruchom test z kroku 1. Oczekiwane: PASS.

- [ ] **Krok 3: `OpenPrs.tsx`.** Zastąp `<ul className="kok-reviews__list">…</ul>` przez

```tsx
<ul className="kok-pr-table">
  {state.items.map((item) => {
    const kind = item.draft ? "draft" : "ready";
    return (
      <PrRow
        key={`${item.repo}#${item.number}`}
        repo={item.repo}
        number={item.number}
        title={item.title}
        url={item.url}
        updatedAt={item.updatedAt}
        refClassName={`kok-reviews__ref--${kind}`}
      >
        <span className={`kok-reviews__state kok-reviews__state--${kind}`}>
          {t(item.draft ? "home:openPrs.draft" : "home:openPrs.ready")}
        </span>
      </PrRow>
    );
  })}
</ul>
```

dodaj `import { PrRow } from "./PrRow";` i usuń niepotrzebne już importy `formatShortDate`, `formatTime`.

- [ ] **Krok 4: `ReviewRequests.tsx`.** Analogicznie zastąp listę przez

```tsx
<ul className="kok-pr-table">
  {state.items.map((item) => (
    <PrRow
      key={`${item.repo}#${item.number}`}
      repo={item.repo}
      number={item.number}
      title={item.title}
      url={item.url}
      updatedAt={item.updatedAt}
    >
      {item.author ? <span>{item.author}</span> : null}
      {item.state === "merged" ? (
        <span className="kok-badge">{t("home:reviews.merged")}</span>
      ) : null}
    </PrRow>
  ))}
</ul>
```

dodaj `import { PrRow } from "./PrRow";` i usuń nieużywane importy formatowania daty.

- [ ] **Krok 5: CSS.** W `src/features/home/home.css` usuń reguły `.kok-reviews__list`, `.kok-reviews__item`, `.kok-reviews__link`,
      `.kok-reviews__link:hover`, `.kok-reviews__meta` (po zmianie nieużywane; sprawdź `grep -rn "kok-reviews__\(list\|item\|link\|meta\)" src tests`, ma nic nie zwrócić).
      Zostaw `.kok-reviews__ref` i reguły `--ready|--draft|state`. Zaraz po `.kok-reviews__ref` dodaj:

```css
/* ---------- Tabelka PR (Otwarte PR, Do zrecenzowania): jak lista w Kolejce ---------- */
.kok-pr-table {
  list-style: none;
  margin: 0;
  padding: var(--s-2) var(--s-3);
  display: flex;
  flex-direction: column;
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: var(--r-md);
}

.kok-pr-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  column-gap: var(--s-3);
  padding: var(--s-2) 0;
  border-bottom: 1px solid color-mix(in srgb, var(--line) 40%, transparent);
}

.kok-pr-row:last-child {
  border-bottom: none;
}

.kok-pr-row__main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  text-decoration: none;
}

.kok-pr-row__ref,
.kok-pr-row__title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kok-pr-row__ref {
  font: 500 var(--fs-xs) / 1.3 var(--font-mono);
}

.kok-pr-row__title {
  color: var(--text);
  font: 500 var(--fs-sm) / 1.4 var(--font-mono);
}

.kok-pr-row__main:hover .kok-pr-row__title {
  color: var(--accent);
  text-decoration: underline;
}

.kok-pr-row__cell {
  display: inline-flex;
  align-items: center;
  gap: var(--s-2);
  font: 500 var(--fs-xs) / 1.3 var(--font-mono);
  color: var(--muted);
  white-space: nowrap;
}

.kok-pr-row__when {
  font: 500 var(--fs-xs) / 1.3 var(--font-mono);
  color: var(--muted);
  white-space: nowrap;
  text-align: right;
}
```

- [ ] **Krok 6: testy kafelków.** W `OpenPrs.test.tsx` w teście „lista: …” dopisz
      `expect(document.querySelectorAll(".kok-pr-row")).toHaveLength(2);`, a w `ReviewRequests.test.tsx` w teście „lista: …”
      to samo (`toHaveLength(2)`). Reszta asercji bez zmian.
- [ ] **Krok 7: zielone.** `npx vitest run tests/unit/features/home` oraz `npx tsc --noEmit` oraz `npm run lint`. Oczekiwane: zielone.
- [ ] **Krok 8 (Claude):** commit `feat(home): tabelka PR w kafelkach Otwarte PR i Do zrecenzowania`.

### Prompt dla agy (Task 5)

```
Zadanie (--role task), repo ~/projects/Brain_7224/Monolith, gałąź feat/kokpit-otwarte-pr. NIE commituj.
Wykonaj Task 5 z docs/superpowers/plans/2026-11-18-kokpit-otwarte-pr.md (kroki 1-7), dosłownie wg kodu z planu.
Pliki wolno zmieniać tylko te, które wymienia Task 5. Zachowaj polskie znaki i cudzysłowy z planu bez zmian.
Na koniec uruchom OSOBNO (bez &&, bez pipe): npx vitest run tests/unit/features/home ; npx tsc --noEmit ; npm run lint.
Raport: GOTOWE: <pliki>, testy/tsc/lint zielone albo UTKNĄŁEM: plik:linia + przyczyna.
```
