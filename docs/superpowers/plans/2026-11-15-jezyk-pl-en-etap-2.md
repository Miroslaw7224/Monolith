# Język PL/EN: etap 2 (Kokpit i Inbox) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Karta Kokpit (w tym Inbox, Alt+I) w pełni tłumaczona PL/EN przez `i18next`: wszystkie teksty UI z `src/features/home/` w namespace `home`, odmiana liczebników przez plural i18next, daty przez `src/i18n/format.ts`.

**Architecture:** Fundament z etapu 1 (`src/i18n/`, `useT`, `useLang`, `format.ts`, test parytetu) zostaje bez zmian. Dochodzi namespace `home` (`locales/{pl,en}/home.ts`, rejestracja w `resources.ts`). Komponenty biorą `const t = useT()` i klucze `t("home:…")`. Czyste funkcje (`cockpitFormat.ts`) wołają `i18n.t("home:…")` (spec §3); komponent, który je woła, subskrybuje język przez `useT()`, więc przerenderuje się przy zmianie. Konteksty `bc_*`, API i `src/translations.ts` (poza martwymi kluczami `home*`) bez zmian.

**Tech Stack:** Next.js 14 (klient), React 19, TypeScript (`strict: false`), `i18next` 27 + `react-i18next` 18 (już w repo), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-15-jezyk-pl-en-design.md` (decyzje J1–J9; §4 pkt 2 = ten etap). Poprzedni etap: `docs/superpowers/plans/2026-11-15-jezyk-pl-en-etap-1.md` (konwencje typów kluczy, `useT`, `TFn`). **Zasady repo:** `CLAUDE.md`; `tests/unit/architecture.static.test.ts` NIE jest zmieniany.

**Konwencje komend:** testy `npx vitest run <ścieżka>`, typy `npx tsc --noEmit`, lint `npm run lint`, build `npm run build`. Commity kończą się linią `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; hook `lint-staged` przeformatowuje pliki prettierem (to normalne).

## Podział ról (orkiestracja)

| Kto                                      | Robi                                                                                                                             |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Claude Code (orkiestrator)               | plan, gałąź, zlecenia, sprawdzanie `git diff --stat` i wyników, decyzje, **wszystkie commity**                                   |
| `cursor` (`--role task`, `--tier light`) | edycje plików wg zadań poniżej; testy/tsc/lint/build z `--approve-allowed` (odpowiedź: „przeszło” albo `plik:linia + przyczyna`) |
| `agy` (`--role review`, `--tier deep`)   | niezależny review diffa po Task 5 (tylko odczyt)                                                                                 |

Zasady zlecania: jedno zadanie = jedno zlecenie dla Cursora (`--fresh` przy nowym zadaniu, `--keep` przy poprawce tego samego); Cursor **nie commituje**. Wszystkie zadania edytują te same pliki słowników (`home.ts`), więc **wykonują się po kolei**, nigdy równolegle. Po każdym zleceniu: `git diff --stat`, uruchomienie testów zadania, dopiero potem commit.

## Rozstrzygnięcia planu (względem specu)

1. **Jeden namespace `home`** na cały katalog `src/features/home/` (Kokpit + Inbox to jedna karta). Podział w obrębie pliku słownika: `format`, `cockpit`, `queue`, `inbox`, `closeDay`, `pin`, `history`, `energy`, `common` (nazwy podgrup wykonawca dobiera wg komponentu; klucze zawsze `home:<grupa>.<klucz>`).
2. **Polskie teksty przenosi się dosłownie** (bez „poprawiania” brzmienia): testy `HomeView.test.tsx` (267 asercji) i `cockpitFormat.test.ts` startują w PL (`tests/setup.ts`) i mają przejść **bez zmian**. Jedyny dozwolony wyjątek to asercja, która dziś zakodowała błąd odmiany; zmiana takiej asercji wymaga zgody orkiestratora.
3. **Plural (J7)** przez sufiksy `_one/_few/_many/_other` (PL) i `_one/_other` (EN). Własne „odmieniacze” (`closedNoun`, logika `few` w `cockpitFormat.ts`) znikają. Przypadek `0` obsługuje osobny klucz (`…None`), bo „brak spotkań dziś” nie jest odmianą.
4. **Funkcje czyste w `cockpitFormat.ts`:** `localDay`, `hhmm`, `weekNumber`, `briefLines`, `minutesUntil`, `upcomingWindows` są neutralne językowo i **nie zmieniają się** (używa ich też kalendarz: `CalendarView`, `CalendarSidePanel`). Zmieniają się: `relativeDays`, `anchorLabel`, `formatLongDate`, `meetingsLabel`, `commitsLabel`, `meetingDayLabel`, `projectsLabel`, `windowsLabel`. `anchorLabel` dziś parsuje regexem wynik `relativeDays` (po polsku), więc dostaje wspólny pomocniczy `daysAgo()` zwracający liczbę dni.
5. **Daty:** jedyne `toLocale…` w katalogu to `CommitHistory.tsx` (linie 64 i 92) oraz `formatLongDate`. `format.ts` dostaje `formatDayMonth` i `formatWeekdayShort`; `formatLongDate` = `formatDate` z wielką pierwszą literą.
6. **Stałe z etykietami** (`ENERGY_FILTERS` w `CockpitSections.tsx`, `TARGETS` w `InboxMoveForm.tsx`, `KIND_TEXT` w `QueueItemDialog.tsx`) przechodzą na pole `labelKey` (klucz słownika), tłumaczone w renderze, nie w module.
7. **Komunikaty błędów:** teksty tworzone w kliencie (np. „Nie udało się domknąć zadania”, `CockpitSections.tsx:445`) tłumaczymy; `err.message` z serwera zostaje bez zmian (J2).
8. **Martwe klucze `home*`** w `src/translations.ts` (10 kluczy, linie ok. 245–254 i 496–505, brak odwołań) usuwamy w Task 6.
9. **Testy EN** dodajemy tylko tam, gdzie wnoszą wartość: funkcje etykiet (Task 1) i trzy kontrole `HomeView` w EN (Task 5).

---

## Mapa plików

| Plik                                                                                                                 | Zmiana                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `src/i18n/format.ts`                                                                                                 | + `formatDayMonth`, `formatWeekdayShort`                                                                       |
| `src/i18n/locales/{pl,en}/home.ts` (nowe)                                                                            | słowniki; rosną w każdym zadaniu                                                                               |
| `src/i18n/resources.ts`                                                                                              | + `home` w `pl` i `en`                                                                                         |
| `src/features/home/cockpitFormat.ts`                                                                                 | osiem funkcji etykiet → `i18n.t`; `daysAgo()`                                                                  |
| `src/features/home/{ClosingAnchor,EnergySwitch,CloseDayDialog,PinPicker,QueueItemDialog,CommitHistory,HomeView}.tsx` | teksty z `t`                                                                                                   |
| `src/features/home/{InboxPanel,InboxItemDialog,InboxMoveForm}.tsx`                                                   | teksty z `t`, plural zamiast `closedNoun`                                                                      |
| `src/features/home/CockpitSections.tsx`                                                                              | teksty z `t`, plural „zadań”, `ENERGY_FILTERS` → `labelKey`                                                    |
| `src/translations.ts`                                                                                                | usunięcie martwych `home*`                                                                                     |
| testy                                                                                                                | nowe: `tests/unit/i18n/home-format.test.ts`, `tests/unit/features/home/HomeView.en.test.tsx`; reszta bez zmian |

Bez zmian: `contexts/bc_*`, `lib/*`, `app/api/*`, `inboxMove.ts` (0 tekstów UI), `StatusBar.tsx`/`ShellStatusBar.tsx` (zrobione w etapie 1), `tests/unit/architecture.static.test.ts`.

---

## Task 0: Gałąź i baza (orkiestrator)

- [ ] **Step 1: Gałąź od `main`**

Run: `git checkout -b feat/jezyk-pl-en-etap-2 && git status --short`
Expected: czysto na nowej gałęzi.

- [ ] **Step 2: Zacommituj plan**

```bash
git add docs/superpowers/plans/2026-11-15-jezyk-pl-en-etap-2.md
git commit -m "docs(i18n): plan etapu 2 języka PL/EN (Kokpit i Inbox)"
```

(z linią `Co-Authored-By`). Baza przed zmianami: `tsc` przeszło, vitest 2763 passed (przebieg Cursora z 2026-11-15).

---

## Task 1: Namespace `home`, helpery dat i funkcje etykiet (Cursor, TDD)

**Files:**

- Modify: `src/i18n/format.ts`, `src/i18n/resources.ts`, `src/features/home/cockpitFormat.ts`
- Create: `src/i18n/locales/pl/home.ts`, `src/i18n/locales/en/home.ts`
- Test: `tests/unit/i18n/home-format.test.ts` (nowy); istniejące `tests/unit/features/home/cockpitFormat.test.ts` i `tests/unit/i18n/parity.test.ts` bez zmian

- [ ] **Step 1: Czerwony test**

`tests/unit/i18n/home-format.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { setLanguage } from "@/src/i18n";
import { formatDayMonth, formatWeekdayShort } from "@/src/i18n/format";
import {
  anchorLabel,
  commitsLabel,
  formatLongDate,
  meetingDayLabel,
  meetingsLabel,
  projectsLabel,
  relativeDays,
  windowsLabel,
} from "@/src/features/home/cockpitFormat";

const today = new Date(2026, 10, 11); // 2026-11-11, środa

describe("etykiety Kokpitu po angielsku", () => {
  test("meetingsLabel", async () => {
    await setLanguage("en");
    expect(meetingsLabel(0)).toBe("no meetings today");
    expect(meetingsLabel(1)).toBe("1 meeting today");
    expect(meetingsLabel(3)).toBe("3 meetings today");
  });

  test("commitsLabel / projectsLabel / windowsLabel", async () => {
    await setLanguage("en");
    expect(commitsLabel(1)).toBe("1 commit");
    expect(commitsLabel(5)).toBe("5 commits");
    expect(projectsLabel(0)).toBe("no commits yet");
    expect(projectsLabel(1)).toBe("1 project");
    expect(projectsLabel(2)).toBe("2 projects");
    expect(windowsLabel(0)).toBe("");
    expect(windowsLabel(1)).toBe("1 Deep Work window");
    expect(windowsLabel(2)).toBe("2 Deep Work windows");
  });

  test("relativeDays i anchorLabel", async () => {
    await setLanguage("en");
    expect(relativeDays("2026-11-11", today)).toBe("today");
    expect(relativeDays("2026-11-10", today)).toBe("yesterday");
    expect(relativeDays("2026-11-08", today)).toBe("3 days ago");
    expect(relativeDays(null, today)).toBeNull();
    expect(anchorLabel("2026-11-10", today)).toBe("Anchor from yesterday");
    expect(anchorLabel("2026-11-08", today)).toBe("Anchor from 3 days ago");
    expect(anchorLabel("2026-11-11", today)).toBe("Anchor");
    expect(anchorLabel("zła-data", today)).toBe("Anchor");
  });

  test("daty", async () => {
    await setLanguage("en");
    expect(formatLongDate(today)).toBe("Wednesday, November 11");
    expect(meetingDayLabel("2026-11-12", "2026-11-11")).toBe("tomorrow");
    expect(meetingDayLabel("2026-11-18", "2026-11-11")).toBe("Wednesday, November 18");
    expect(formatDayMonth(today)).toBe("November 11");
    expect(formatWeekdayShort(today)).toBe("Wed");
  });
});

describe("etykiety Kokpitu po polsku (plural)", () => {
  test("meetingsLabel i commitsLabel", () => {
    expect(meetingsLabel(22)).toBe("22 spotkania dziś");
    expect(meetingsLabel(12)).toBe("12 spotkań dziś");
    expect(commitsLabel(22)).toBe("22 commity");
  });

  test("daty", () => {
    expect(formatLongDate(today)).toBe("Środa, 11 listopada");
    expect(formatDayMonth(today)).toBe("11 listopada");
  });
});
```

- [ ] **Step 2: Uruchom, ma być czerwono**

Run: `npx vitest run tests/unit/i18n/home-format.test.ts`
Expected: FAIL (brak `formatDayMonth`, polskie teksty zamiast EN).

- [ ] **Step 3: Helpery dat**

Dopisz do `src/i18n/format.ts` (po `formatDate`):

```ts
/** „16 listopada” / „November 16”. */
export function formatDayMonth(date: Date, lang: Lang = currentLang()): string {
  return new Intl.DateTimeFormat(LOCALE[lang], { day: "numeric", month: "long" }).format(date);
}

/** Skrót dnia tygodnia: „pon.” / „Mon”. */
export function formatWeekdayShort(date: Date, lang: Lang = currentLang()): string {
  return new Intl.DateTimeFormat(LOCALE[lang], { weekday: "short" }).format(date);
}
```

- [ ] **Step 4: Słowniki `home` (grupa `format`)**

`src/i18n/locales/pl/home.ts`:

```ts
export const home = {
  format: {
    today: "dziś",
    yesterday: "wczoraj",
    tomorrow: "jutro",
    daysAgo: "{{count}} dni temu",
    anchor: "Zaczep",
    anchorYesterday: "Zaczep z wczoraj",
    anchorDaysAgo: "Zaczep sprzed {{count}} dni",
    meetingsNone: "brak spotkań dziś",
    meetings_one: "{{count}} spotkanie dziś",
    meetings_few: "{{count}} spotkania dziś",
    meetings_many: "{{count}} spotkań dziś",
    meetings_other: "{{count}} spotkania dziś",
    commits_one: "{{count}} commit",
    commits_few: "{{count}} commity",
    commits_many: "{{count}} commitów",
    commits_other: "{{count}} commity",
    projectsNone: "jeszcze bez commitów",
    projects_one: "{{count}} projekt",
    projects_few: "{{count}} projekty",
    projects_many: "{{count}} projektów",
    projects_other: "{{count}} projekty",
    windows_one: "{{count}} okno Deep Work",
    windows_few: "{{count}} okna Deep Work",
    windows_many: "{{count}} okien Deep Work",
    windows_other: "{{count}} okna Deep Work",
  },
};
```

`src/i18n/locales/en/home.ts`:

```ts
export const home = {
  format: {
    today: "today",
    yesterday: "yesterday",
    tomorrow: "tomorrow",
    daysAgo: "{{count}} days ago",
    anchor: "Anchor",
    anchorYesterday: "Anchor from yesterday",
    anchorDaysAgo: "Anchor from {{count}} days ago",
    meetingsNone: "no meetings today",
    meetings_one: "{{count}} meeting today",
    meetings_other: "{{count}} meetings today",
    commits_one: "{{count}} commit",
    commits_other: "{{count}} commits",
    projectsNone: "no commits yet",
    projects_one: "{{count}} project",
    projects_other: "{{count}} projects",
    windows_one: "{{count}} Deep Work window",
    windows_other: "{{count}} Deep Work windows",
  },
};
```

`src/i18n/resources.ts`: dodaj importy `home as plHome` / `home as enHome` i wpisz `home: plHome` / `home: enHome` do `pl` i `en`. Sprawdź `src/i18n/i18next.d.ts`: jeśli typy kluczy czytają `resources.pl`, nic więcej nie trzeba.

- [ ] **Step 5: `cockpitFormat.ts`**

Dodaj na górze `import i18n from "@/src/i18n";` i `import { formatDate } from "@/src/i18n/format";`. Zamień osiem funkcji (pozostałe zostają):

```ts
/** Pełne dni od `fromIso` do dziś; `null` dla braku lub błędnej daty. Przyszłość liczy się jak 0. */
function daysAgo(fromIso: string | null, today: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fromIso ?? "");
  if (!m) return null;
  const from = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.round((now - from) / (24 * 3600 * 1000)));
}

/** „dziś” / „wczoraj” / „N dni temu”; `null` dla braku lub błędnej daty. */
export function relativeDays(fromIso: string | null, today: Date): string | null {
  const days = daysAgo(fromIso, today);
  if (days === null) return null;
  if (days === 0) return i18n.t("home:format.today");
  if (days === 1) return i18n.t("home:format.yesterday");
  return i18n.t("home:format.daysAgo", { count: days });
}

/** „Zaczep z wczoraj” / „Zaczep sprzed 3 dni”; dla dziś i błędnej daty: „Zaczep”. */
export function anchorLabel(dateIso: string, today: Date): string {
  const days = daysAgo(dateIso, today);
  if (days === 1) return i18n.t("home:format.anchorYesterday");
  if (days !== null && days >= 2) return i18n.t("home:format.anchorDaysAgo", { count: days });
  return i18n.t("home:format.anchor");
}

/** „Środa, 11 listopada” / „Wednesday, November 11”. */
export function formatLongDate(date: Date): string {
  const text = formatDate(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function meetingsLabel(count: number): string {
  return count === 0
    ? i18n.t("home:format.meetingsNone")
    : i18n.t("home:format.meetings", { count });
}

export function commitsLabel(count: number): string {
  return i18n.t("home:format.commits", { count });
}

/** „jutro” albo pełna data spotkania względem `todayIso`. */
export function meetingDayLabel(dateIso: string, todayIso: string): string {
  const parse = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const days = Math.round((parse(dateIso).getTime() - parse(todayIso).getTime()) / 86_400_000);
  return days === 1 ? i18n.t("home:format.tomorrow") : formatLongDate(parse(dateIso));
}

/** Meta kafla „Commity dziś”. */
export function projectsLabel(count: number): string {
  return count === 0
    ? i18n.t("home:format.projectsNone")
    : i18n.t("home:format.projects", { count });
}

/** „N okien Deep Work”; 0 → pusty tekst. */
export function windowsLabel(count: number): string {
  return count === 0 ? "" : i18n.t("home:format.windows", { count });
}
```

Jeśli `tsc` odrzuci klucz plural bez sufiksu albo `count` w `i18n.t`, wykonawca stosuje obejście z etapu 1 (typ `TFn` / klucze jak w `shell.ts`) i zgłasza to orkiestratorowi.

- [ ] **Step 6: Zielono**

Run: `npx vitest run tests/unit/i18n tests/unit/features/home/cockpitFormat.test.ts && npx tsc --noEmit`
Expected: PASS (nowy test, parytet `home` pl/en, stary `cockpitFormat.test.ts` bez zmian).

- [ ] **Step 7: Commit (orkiestrator, po `git diff --stat`)**

```bash
git add src/i18n src/features/home/cockpitFormat.ts tests/unit/i18n/home-format.test.ts
git commit -m "feat(i18n): namespace home, helpery dat i etykiety Kokpitu przez i18next"
```

---

## Task 2: Małe komponenty Kokpitu (Cursor)

**Files:** `src/features/home/{ClosingAnchor,EnergySwitch,CloseDayDialog,PinPicker,QueueItemDialog,CommitHistory}.tsx`; słowniki `home.ts` (pl, en).

Zasady dla wszystkich zadań migracji (Task 2–4):

- Komponent: `const t = useT();` (z `@/src/i18n/useT`), każdy tekst widoczny, `aria-label`, `title`, `placeholder`, tekst pusty stan i komunikat tworzony w kliencie → `t("home:<grupa>.<klucz>")`. Teksty w JSDoc i komentarzach zostają polskie.
- PL w `home.ts` = dokładnie dzisiejszy tekst; EN = naturalne angielskie tłumaczenie (krótkie, jak w UI narzędzi pracy). Interpolacja przez `{{nazwa}}`; liczby przez `count` + plural.
- Każdy nowy klucz musi być w obu słownikach; parytet pilnuje `tests/unit/i18n/parity.test.ts`.
- Stałe z etykietami → pole `labelKey`, tłumaczone w renderze (rozstrzygnięcie 6).
- `QueueItemDialog.tsx`: `KIND_TEXT` (L8) → klucze; `due` (L54) bez własnego formatowania daty, jeśli to już gotowy tekst z `cockpitFormat`.
- `CommitHistory.tsx`: `toLocaleDateString("pl-PL", …)` → `formatDayMonth(date)` (L64) i `formatWeekdayShort(date)` (L92); „brak commitów”, „PR w {{count}} dni” → klucze.

- [ ] **Step 1:** zlecenie dla Cursora (prompt: cel, lista plików, zasady powyżej, „nie commituj”, „na końcu uruchom `npx tsc --noEmit` i `npx vitest run tests/unit/features/home tests/unit/i18n`”).
- [ ] **Step 2:** orkiestrator: `git diff --stat`; `grep -nP "[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]" <6 plików> | grep -v -E "^\S+:\s*[0-9]+:\s*(//|\*|/\*)"` ma zwrócić tylko komentarze i JSDoc; test: `npx vitest run tests/unit/features/home` przechodzi bez zmian w testach.
- [ ] **Step 3: Commit**

```bash
git add src/features/home src/i18n
git commit -m "feat(i18n): małe komponenty Kokpitu (zaczep, energia, domknięcie dnia, kolejka, historia commitów) w PL/EN"
```

---

## Task 3: Inbox (Cursor)

**Files:** `src/features/home/{InboxPanel,InboxItemDialog,InboxMoveForm}.tsx`; słowniki `home.ts`.

- `InboxPanel.tsx`: usuń `closedNoun` (L9); „Usunąć {{count}} … na stałe?” przez klucze plural `inbox.deleteClosed_one/_few/_many/_other` (PL: „Usunąć {{count}} zamknięty wpis na stałe?”, „… zamknięte wpisy …”, „… zamkniętych wpisów …”; EN `_one/_other`: „Delete {{count}} closed entry permanently?” / „entries”). Komunikat „Plik zadań zmienił się, spróbuj ponownie” (L106) i pozostałe teksty klienta → klucze.
- `InboxMoveForm.tsx`: `TARGETS` (L20) → `labelKey`; reszta tekstów → klucze.
- `InboxItemDialog.tsx`: teksty → klucze.

- [ ] **Step 1:** zlecenie dla Cursora (`--keep`, jeśli Task 2 zostawił mały kontekst, inaczej `--fresh`), zasady z Task 2.
- [ ] **Step 2:** orkiestrator: `git diff --stat`, ten sam grep po polskich znakach dla 3 plików, `npx vitest run tests/unit/features/home` zielone.
- [ ] **Step 3: Commit**

```bash
git add src/features/home src/i18n
git commit -m "feat(i18n): Inbox (panel, wpis, przenoszenie) w PL/EN z pluralem zamkniętych wpisów"
```

---

## Task 4: `CockpitSections.tsx` i `HomeView.tsx` (Cursor, w dwóch zleceniach)

**Files:** `src/features/home/CockpitSections.tsx` (774 linie, ok. 55 tekstów), `src/features/home/HomeView.tsx` (8 tekstów); słowniki `home.ts`.

Plik jest duży, więc dwa zlecenia z `--keep`: (a) komponenty od początku pliku do `QueueSection` włącznie (kafle, tematy, `relativeDays` w L69), (b) reszta pliku + `HomeView.tsx`.

- Plural „zadań” w L690 (`{visibleCount} zadań`) → klucz `cockpit.energyCount_one/_few/_many/_other` (PL: „{{count}} zadanie / zadania / zadań”; EN: „{{count}} task / tasks”). Przypadek: 1 → „1 zadanie”, 22 → „22 zadania”, 5 → „5 zadań”.
- `ENERGY_FILTERS` (L156) → `labelKey`.
- „Nie udało się domknąć zadania” (L445) i inne komunikaty tworzone w kliencie → klucze; `err.message` z serwera bez zmian.
- Daty w `HomeView.tsx` L97, L106–107 i w `CockpitSections.tsx` (L69, 279, 315, 330, 548, 552, 555, 608) to wywołania funkcji z `cockpitFormat.ts` (`formatLongDate`, `relativeDays`, `meetingsLabel`…): bez własnego formatowania, tylko upewnij się, że komponent ma `useT()` (subskrypcja języka).

- [ ] **Step 1 (a):** zlecenie dla Cursora.
- [ ] **Step 2 (a):** `git diff --stat` i `npx vitest run tests/unit/features/home` (testy startują w PL).
- [ ] **Step 3 (b):** zlecenie `--keep`.
- [ ] **Step 4 (b):** orkiestrator: grep po polskich znakach dla `CockpitSections.tsx` i `HomeView.tsx` (tylko komentarze), `git diff --stat`, testy jak wyżej.
- [ ] **Step 5: Commit**

```bash
git add src/features/home src/i18n
git commit -m "feat(i18n): Kokpit (kafle, kolejka, energia, HomeView) w PL/EN z pluralem zadań"
```

---

## Task 5: Test `HomeView` po angielsku i review (Cursor + agy)

**Files:** Create `tests/unit/features/home/HomeView.en.test.tsx`.

- [ ] **Step 1: Napisz test (Cursor, wzorując się na helperach renderu z `tests/unit/features/home/HomeView.test.tsx`, bez kopiowania całego pliku)**

Trzy przypadki po `await setLanguage("en")` przed renderem:

1. Nagłówek dnia: dla ustalonej daty (`vi.useFakeTimers` / `vi.setSystemTime` jak w istniejącym teście) pojawia się „Wednesday, November 11”, a „Środa, 11 listopada” nie.
2. Kolejka z 3 zadaniami przy filtrze energii: chip „3 tasks”, a przy 1 zadaniu „1 task”.
3. Po przełączeniu `setLanguage("pl")` w `act()` te same elementy mają polskie teksty (bez remountu): „3 zadania”.

- [ ] **Step 2:** `npx vitest run tests/unit/features/home` zielone. Jeśli któryś przypadek nie ma sensu przy realnym API komponentu, Cursor zgłasza i proponuje najbliższy równoważny, nie dopisuje na siłę.
- [ ] **Step 3: Commit**

```bash
git add tests/unit/features/home/HomeView.en.test.tsx
git commit -m "test(i18n): HomeView po angielsku i przełączenie języka bez remontu"
```

- [ ] **Step 4: Review `agy` (`--role review`, `--tier deep`, `--fresh`)**

Prompt: „Review `git diff main...HEAD` (tylko odczyt, ścieżki względem Monolith). Sprawdź: (1) czy w `src/features/home/` zostały polskie teksty UI poza komentarzami; (2) czy PL w `locales/pl/home.ts` jest dosłownie dzisiejszym tekstem (porównaj z `git show main:<plik>`); (3) czy EN ma te same klucze i poprawne sufiksy plural; (4) funkcje czyste wołane poza Reactem bez subskrypcji języka (komponent bez `useT()`, który wywołuje `i18n.t` albo funkcję z `cockpitFormat.ts`); (5) regresje w kalendarzu (`CalendarView`, `CalendarSidePanel` importują z `cockpitFormat.ts`). Format: lista `plik:linia + problem`, max 30 linii.” Opinie traktuję jako hipotezy: weryfikuję w kodzie przed poprawką.

---

## Task 6: Sprzątanie i weryfikacja (orkiestrator + Cursor)

- [ ] **Step 1: Martwe klucze `home*`**

Run: `grep -rn "t\.home\|\.home[A-Z]\|home[A-Z][a-zA-Z]*" src app --include=*.ts --include=*.tsx | grep -v "src/translations.ts" | head`
Expected: brak odwołań do 10 kluczy `home*`. Następnie usuń je z obu bloków (`en`, `pl`) w `src/translations.ts` (Edit, bez Cursora: to 20 linii) i sprawdź, że żaden test nie asertuje tych kluczy: `grep -rn "home[A-Z]" tests | head`.

- [ ] **Step 2: Komplet (Cursor, `--approve-allowed`, każda komenda osobnym zleceniem lub po kolei)**

`npx tsc --noEmit`, `npx vitest run`, `npm run lint`, `npm run build`. Oczekiwane: tsc przeszło, vitest bez błędów (baza 2763 + nowe testy), lint bez błędów, build przeszedł. Przy porażce: `plik:linia + przyczyna`, poprawka, ponowny przebieg.

- [ ] **Step 3: Commit**

```bash
git add src/translations.ts
git commit -m "refactor(i18n): usunięcie martwych kluczy home* z translations.ts"
```

- [ ] **Step 4: Oględziny w przeglądarce (na kopii vaulta, osobny port, nie 3100)**

Kopia vaulta i uruchomienie jak w etapie 1 (skill `run`). Lista kontroli: Kokpit w EN (nagłówek dnia, kafle, kolejka, filtr energii, „1/3 tasks”), Inbox (Alt+I: dodanie, zamknięcie, „Delete N closed entries”, przenoszenie), historia commitów (daty EN), okno domknięcia dnia, przełączenie PL↔EN bez przeładowania, F5 zachowuje język, widok mobile, brak błędów w konsoli. Wynik: ile kontroli z ilu przeszło.

- [ ] **Step 5: Wpis w NEXUS (orkiestrator, commit + push od razu: reguła NEXUS)**

`Vault/Projects/monolith/tasks.md`: odhaczony wpis „Język PL/EN, etap 2 (Kokpit i Inbox)” z linkami do planu, numerem PR i wynikiem oględzin; w Backlogu zawęź język do etapów 3–5.

- [ ] **Step 6: PR**

Gałąź `feat/jezyk-pl-en-etap-2`: `git push` i `gh pr create` **dopiero na prośbę użytkownika** (reguła dla Monolithu). Opis PR kończy się linią „🤖 Generated with [Claude Code](https://claude.com/claude-code)”.

---

## Self-review

- **Pokrycie specu (§4 pkt 2, J1–J9):** teksty Kokpitu i Inboxu (Task 2–4), plural J7 (Task 1, 3, 4), daty J8 (Task 1, 2), słowniki J4 (Task 1 + rozstrzygnięcie 1), testy J9 (Task 1, 5), dostarczanie J6 (osobny PR). Martwe klucze `home*` (spec §1) w Task 6.
- **Placeholdery:** pełny kod tylko dla małego współdzielonego formatu (Task 1); migracja plików jest mechaniczna i opisana regułami + weryfikacją grepem, bo lista ok. 170 tekstów powstaje z samego kodu (zakaz prototypowania w `CLAUDE.md`).
- **Spójność nazw:** `daysAgo`, `formatDayMonth`, `formatWeekdayShort`, klucze `home:format.*` (`today`, `yesterday`, `tomorrow`, `daysAgo`, `anchor*`, `meetings*`, `commits*`, `projects*`, `windows*`) użyte tak samo w teście, słownikach i kodzie.
- **Ryzyka:** (1) typy `i18n.t` z kluczami plural przy `strict: false` (obejście z etapu 1); (2) `CockpitSections.tsx` jest duży: dwa zlecenia i grep po polskich znakach jako bramka; (3) komponent wołający funkcję z `cockpitFormat.ts` bez `useT()` nie przerenderuje się przy zmianie języka: sprawdza review `agy` i test z Task 5 (przypadek 3).
