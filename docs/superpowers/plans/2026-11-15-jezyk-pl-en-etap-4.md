# Język PL/EN: etap 4 (Planowanie, koniec `translations.ts`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Karty Planowania (sesje i aktywność, kalendarz, tagi, tablica, zadania, zasoby, mapy myśli, powłoka `PlanowanieView`) w pełni tłumaczone PL/EN przez `i18next`; plik `src/translations.ts` oraz propsy `t` i `lang` znikają z repo.

**Architecture:** Fundament z etapów 1–3 (`src/i18n/`, `useT`, `useLang`, `format.ts`, test parytetu) zostaje. Dochodzą cztery namespace'y: `planning`, `tasks`, `resources`, `mindmaps` (`locales/{pl,en}/<ns>.ts`). Klucze przenosimy **1:1 z `translations.ts` bez zmiany nazw** (placeholdery `{x}` → `{{x}}`), więc migracja jest mechaniczna: `t.tasksShowMore` → `t("tasks:tasksShowMore")`. Komponenty: `const t = useT()`; czyste funkcje wołają `i18n.t(…, { lng })`; daty przez `format.ts`. Propsy `labels` (BoardTab, BoardCanvas, TaskCard, TaskColumn, `useResources`) zostają, budowane z `t()`. Konteksty `bc_*`, API i test architektury bez zmian.

**Tech Stack:** Next.js 14 (klient), React 19, TypeScript (`strict: false`), `i18next` 27 + `react-i18next` 18, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-15-jezyk-pl-en-design.md` (J1–J9; §4 pkt 4 = ten etap; „po etapie 4 plik `src/translations.ts` znika”). Wzorce: plany etapów 1–3 w `docs/superpowers/plans/`. **Zasady repo:** `CLAUDE.md`; `tests/unit/architecture.static.test.ts` NIE jest zmieniany.

**Konwencje komend:** testy `npx vitest run <ścieżka>`, typy `npx tsc --noEmit`, lint `npm run lint`, build `npm run build`. Commity kończą się linią `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; hook `lint-staged` formatuje prettierem.

## Podział ról (orkiestracja)

| Kto                                      | Robi                                                                                         |
| ---------------------------------------- | -------------------------------------------------------------------------------------------- |
| Claude Code (orkiestrator)               | plan, zlecenia, `git diff --stat`, decyzje, **wszystkie commity**                            |
| `cursor` (`--role task`, `--tier light`) | edycje wg zadań; testy/tsc/lint/build z odpowiedzią „przeszło” albo `plik:linia + przyczyna` |
| `agy` (`--role review`, `--tier deep`)   | niezależny review diffa po Task 8 (tylko odczyt)                                             |

Jedno zadanie = jedno zlecenie Cursora (`--fresh` przy nowym obszarze, `--keep` przy poprawkach); **nie commituje**. Zadania dopisują do `planning.ts` (pl/en) i `resources.ts`/`index.ts` — **wykonuj po kolei**, nigdy równolegle. Po zleceniu: `git diff --stat`, testy zadania, `npx tsc --noEmit`, commit orkiestratora. Cursor uruchamia komendy **bez pipe'ów** (poza `2>&1`).

## Rozstrzygnięcia planu (względem specu)

1. **Cztery namespace'y** wg katalogu użycia (sprawdzone grepem po `src/`): `planning` (powłoka: `tab*`, `note*`, `deleteNote`; sesje: `session*`, `activity*`; kalendarz: `calendar*`; tagi: `tags*`; tablica: `board*`), `tasks` (`tasks*`), `resources` (`resource*`, `addResource`), `mindmaps` (`mindMaps*`). `calendarCancel` jest używany też przez zadania → zostaje w `planning`, w `tasks` wołany jako `planning:calendarCancel`.
2. **Klucze 1:1.** Nazwy kluczy ze `translations.ts` nie zmieniają się (grep-owalne, brak ryzyka literówek przy zmianie nazw). **Nowe klucze** (z ternarek `lang === "pl" ? … : …` i twardych polskich literałów) mają ten sam płaski styl i prefiks obszaru, np. `activityStart`, `calendarPrevMonth`. Wartość PL = dotychczasowy tekst dosłownie, EN = naturalne tłumaczenie. Cursor wypisuje listę nowych kluczy w odpowiedzi.
3. **Martwe klucze (53) nie są migrowane.** Grep po `src/`, `tests/`, `app/` (`t.<klucz>`) nie znalazł użycia:

```text
brainActive notesTab placeholderNotice modePlanowanie tabHome tabActivity tabTasks
calendarDay calendarClickToEdit tasksNewPlaceholder tasksMoveUp tasksMoveDown
planAskPlaceholder resourceSaveNoteFirst resourceEditTags tabContent
title subtitle searchPlaceholder home feedback
mindMapsImportCardTitle mindMapsImportCardSubtitle mindMapsAIImportTreeAdd
mindMapsAIImportTreeModalTitle mindMapsAIImportTreeInsert mindMapsImportModalTitle
mindMapsImportModalSubtitle mindMapsImportTextareaPlaceholder mindMapsImportAddImage
mindMapsImportRemoveImage mindMapsImportAnalyze mindMapsImportPreview
mindMapsImportPreviewFullScreen mindMapsImportPreviewExitFullScreen
mindMapsImportPreviewHint mindMapsImportPreviewHintImageOrText mindMapsImportSaveAsNew
mindMapsImportSaving mindMapsImportAnalyzeError mindMapsImportInvalidAIFormat
mindMapsImportCreateMapError mindMapsImportSaveMapError mindMapsImportGenericError
mindMapsAIAddTitle mindMapsAIAddSubtitle mindMapsAIQueryPlaceholder mindMapsAISearch
mindMapsAIErrorFetch mindMapsAIErrorInvalidFormat mindMapsAIErrorGeneric
mindMapsAIEnterHint mindMapsAIAddConfirm
```

Przed pominięciem klucza wykonawca robi `grep -rn "<klucz>" src tests app`; trafienie poza `src/translations.ts` = klucz żywy, migrujemy.

4. **Propsy `t` i `lang` znikają wszędzie.** `labels` zostają (jawne, testowalne). Czyste funkcje z parametrem `lang` (`deleteCopy`, `dueLabel`, funkcje kafli zadań) zachowują **opcjonalny** parametr `lang: Lang = currentLang()` i wołają `i18n.t(key, { lng: lang })`: istniejące testy, które podają `"pl"`/`"en"`, przechodzą bez zmian. Komponent renderujący taką funkcję woła `useT()` (subskrypcja na zmianę języka).
5. **Daty (`toLocale…`)** → nowe funkcje w `src/i18n/format.ts` (Task 1): `formatTime`, `formatTimeSeconds`, `formatShortDate`, `formatFullDate`. Poza zakresem: `NotesPanel.tsx` (Notatki, etap 5), `CodexView.tsx` (Kodeks, etap 5), `mindMapExportTemplate.ts` (`<html lang="pl">` w wyeksportowanym pliku HTML, bez zmian).
6. **Poza zakresem (etap 5):** `src/features/notes/`, `src/features/arsenal/` (wewnętrzne teksty), `src/features/codex/`. `NotesPanel` dalej dostaje gotowe napisy w propsach (`newNote=…`); `PlanowanieView` buduje je z `t("planning:…")`.
7. **Plural (J7)** tam, gdzie jest licznik z rzeczownikiem: `resourceAdded_*` (zastępuje parę `resourceAddedOne`/`resourceAddedCount`), `mindMapsItemsCount_*`. `{count}` w `tasksShowMore` („Pokaż jeszcze 3”) nie ma rzeczownika → bez plural. Podtytuł zadań („N zadań aktywnych · M ukończonych”) zostaje w dotychczasowym brzmieniu (jedna interpolowana wartość, bez poprawiania gramatyki: poza zakresem).
8. **Testy.** Istniejące testy startują w PL i przechodzą **bez zmian**, z dwoma dozwolonymi wyjątkami, **zawsze w tym samym commicie co komponent**: (a) usunięcie propsów `t`/`lang` i importu `translations` z testów, które je podawały; (b) asercje, które utrwalały angielski fallback (`?? "Cancel"`) lub błędną odmianę, poprawione na wartość słownika PL. **Każdą taką poprawkę (b) Cursor wypisuje z `plik:linia`, a ja ją zatwierdzam** przed commitem. Test architektury nietknięty.
9. **Nowe testy EN:** dla czystych funkcji osobne `it` obok testów komponentu; dla komponentów `tests/unit/features/<obszar>/<Komponent>.en.test.tsx` (wzór: `tests/unit/features/projects/ProjectsView.en.test.tsx`).
10. **Gałąź** `feat/jezyk-pl-en-etap-4` już istnieje (z `main` po PR #69); Task 0 = commit planu.

---

## Mapa plików

| Plik                                                                                                                                       | Zmiana                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `src/i18n/format.ts`                                                                                                                       | + `formatTime`, `formatTimeSeconds`, `formatShortDate`, `formatFullDate` |
| `src/i18n/resources.ts`, `src/i18n/index.ts` (`ns`)                                                                                        | + `planning`, `tasks`, `resources`, `mindmaps`                           |
| `src/i18n/locales/{pl,en}/{planning,tasks,resources,mindmaps}.ts` (nowe)                                                                   | słowniki; `planning` rośnie w Task 2, 3, 4, 8                            |
| `src/components/sessions/ActivityLog.tsx`                                                                                                  | `useT`, `useLang` zbędne (daty przez `format.ts`), bez `t`/`lang`        |
| `src/features/calendar/{CalendarView,CalendarEventForm}.tsx`, `src/components/sessions/StartSessionModal.tsx`                              | `useT`, bez `t`/`lang`                                                   |
| `src/features/tags/TagsSection.tsx`                                                                                                        | `useT`                                                                   |
| `src/features/board/{BoardTab,BoardCanvas}.tsx`, `boardDelete.ts`                                                                          | bez `lang`; `deleteCopy` na `i18n.t`                                     |
| `src/features/tasks/*` (TasksSection, TaskCard, TaskColumn, TaskTiles, TaskDetailModal, TaskTemplatesModal, useTasksBoard, taskOrderUtils) | `useT`, bez `t`/`lang`                                                   |
| `src/features/resources/{ResourceSection,useResources,resourceTypes}.ts(x)`                                                                | `useT`, usunięty `TranslationDict`                                       |
| `src/features/mind-maps/*` (10 plików z `t`)                                                                                               | `useT`, bez `t`                                                          |
| `src/features/planowanie/PlanowanieView.tsx`, `src/App.tsx`                                                                                | bez `t`/`lang`; App nie importuje `translations`                         |
| `src/translations.ts`                                                                                                                      | **usunięty** (Task 8)                                                    |
| testy: `TasksSection`, `MindMapTree.labelEdit`, `TaskDetailModal`, `CalendarView(.layout)`, `ResourceSection`                              | tylko usunięcie propsów `t`/`lang`/importu (rozstrzygnięcie 8)           |

Bez zmian: `contexts/bc_*`, `lib/*`, `app/api/*`, `tests/unit/architecture.static.test.ts`, `mindMapExportTemplate.ts`, `NotesPanel`, `src/features/arsenal/`, `src/features/codex/`.

---

## Task 0: Gałąź i baza (orkiestrator)

- [ ] **Step 1: Sprawdź gałąź**

Run: `git branch --show-current && git status --short`
Expected: `feat/jezyk-pl-en-etap-4`, czysto lub tylko ten plan.

- [ ] **Step 2: Zacommituj plan**

```bash
git add docs/superpowers/plans/2026-11-15-jezyk-pl-en-etap-4.md
git commit -m "docs(i18n): plan etapu 4 języka PL/EN (Planowanie)"
```

(z linią `Co-Authored-By`).

---

## Task 1: Formatery dat w `format.ts` (Cursor, TDD)

**Files:**

- Modify: `src/i18n/format.ts`
- Test: `tests/unit/i18n/format.test.ts` (dopisz `describe`; istniejące testy bez zmian)

- [ ] **Step 1: Czerwony test** (dopisz na końcu `tests/unit/i18n/format.test.ts`; importy `formatTime`, `formatTimeSeconds`, `formatShortDate`, `formatFullDate` dodaj do istniejącego importu z `@/src/i18n/format`)

```ts
describe("formatery Planowania", () => {
  const d = new Date(2026, 10, 15, 9, 5, 30); // niedziela 15.11.2026, czas lokalny
  const norm = (s: string) => s.replace(/\s/g, " ");

  test("formatTime", () => {
    expect(formatTime(d, "pl")).toBe("09:05");
    expect(norm(formatTime(d, "en"))).toBe("09:05 AM");
  });
  test("formatTimeSeconds", () => {
    expect(formatTimeSeconds(d, "pl")).toBe("09:05:30");
    expect(norm(formatTimeSeconds(d, "en"))).toBe("09:05:30 AM");
  });
  test("formatShortDate", () => {
    expect(formatShortDate(d, "pl")).toBe("15.11.2026");
    expect(formatShortDate(d, "en")).toBe("11/15/2026");
  });
  test("formatFullDate", () => {
    expect(formatFullDate(d, "pl")).toBe("niedziela, 15 listopada 2026");
    expect(formatFullDate(d, "en")).toBe("Sunday, November 15, 2026");
  });
});
```

- [ ] **Step 2: Uruchom, ma pęknąć**

Run: `npx vitest run tests/unit/i18n/format.test.ts`
Expected: FAIL (`formatTime is not a function` lub brak eksportu).

- [ ] **Step 3: Implementacja** (dopisz na końcu `src/i18n/format.ts`)

```ts
/** Godzina i minuty: „09:05” / „09:05 AM”. */
export function formatTime(date: Date, lang: Lang = currentLang()): string {
  return new Intl.DateTimeFormat(LOCALE[lang], { hour: "2-digit", minute: "2-digit" }).format(date);
}

/** Godzina z sekundami: „09:05:30” / „09:05:30 AM”. */
export function formatTimeSeconds(date: Date, lang: Lang = currentLang()): string {
  return new Intl.DateTimeFormat(LOCALE[lang], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

/** Data numeryczna: „15.11.2026” / „11/15/2026”. */
export function formatShortDate(date: Date, lang: Lang = currentLang()): string {
  return new Intl.DateTimeFormat(LOCALE[lang]).format(date);
}

/** Pełna data z rokiem: „niedziela, 15 listopada 2026” / „Sunday, November 15, 2026”. */
export function formatFullDate(date: Date, lang: Lang = currentLang()): string {
  return new Intl.DateTimeFormat(LOCALE[lang], {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}
```

- [ ] **Step 4: Zielono**

Run: `npx vitest run tests/unit/i18n/format.test.ts` → Expected: PASS. Potem `npx tsc --noEmit` → czysto.

- [ ] **Step 5: Commit (orkiestrator)**

```bash
git add src/i18n/format.ts tests/unit/i18n/format.test.ts
git commit -m "feat(i18n): formatery godziny i dat dla Planowania"
```

---

## Task 2: Namespace `planning`, aktywność i sesje (Cursor)

**Files:**

- Create: `src/i18n/locales/pl/planning.ts`, `src/i18n/locales/en/planning.ts`
- Modify: `src/i18n/resources.ts`, `src/i18n/index.ts` (`ns` + `"planning"`), `src/components/sessions/ActivityLog.tsx`, `src/features/planowanie/PlanowanieView.tsx` (tylko JSX wywołania `ActivityLog`: usuń `lang={lang} t={t}`)
- Test: `tests/unit/components/sessions/ActivityLog.en.test.tsx` (nowy; jeśli katalog testów sesji jest inny, użyj istniejącego: `ls tests/unit | grep -i session`)

Klucze do `planning` (1:1 ze `translations.ts`, wartości PL/EN skopiuj stamtąd): `activityTitle activityFrom activityTo activityNoEntries activityNoTags`. **Nowe klucze** (z ternarek i literałów w `ActivityLog.tsx`):

| Klucz             | PL                 | EN           |
| ----------------- | ------------------ | ------------ |
| `activityEnd`     | `Zakończ`          | `End`        |
| `activityStart`   | `Rozpocznij pracę` | `Start work` |
| `activityInRange` | `w zakresie`       | `in range`   |
| `activityTotal`   | `łącznie`          | `total`      |
| `activityLoading` | `Wczytywanie…`     | `Loading…`   |

(`activityLoading` zastępuje angielskie „Loading…” na sztywno; w PL dziś jest angielskie, więc zmiana PL jest zamierzona. Jeśli test PL asercją łapie „Loading…”, zgłoś jako wyjątek 8b.)

- [ ] **Step 1: Czerwony test EN** `ActivityLog.en.test.tsx`: wzoruj się na istniejącym teście `ActivityLog` (props: `apiFetch`, `userTags`, **bez `t`/`lang`**); po `await setLanguage("en")` z `activeSession={null}` oczekuj tekstu `Start work`; po `setLanguage("pl")` → `Rozpocznij pracę`. Test pęknie (komponent jeszcze wymaga propsów).
- [ ] **Step 2: Słowniki + wiring.** Utwórz oba pliki `planning.ts` (`export const planning = { … }`), dopisz do `resources.ts` (`planning` w `pl` i `en`) i do `ns`.
- [ ] **Step 3: `ActivityLog.tsx`:** `const t = useT()`; usuń propsy `t`, `lang` i typ `TranslationDict`; `t.activityTitle` → `t("planning:activityTitle")` itd.; ternarki `lang === "pl"` → klucze z tabeli; `toLocaleTimeString(...)` → `formatTime(new Date(activeSession.startedAt))` (z `@/src/i18n/format`). Fragment „X w zakresie · Y łącznie” składaj z kluczy `activityInRange` i `activityTotal` (spacje jak dziś).
- [ ] **Step 4: Testy:** `npx vitest run tests/unit/components tests/unit/i18n tests/unit/features/projects` (cały PL zielony bez zmian) i `npx tsc --noEmit`.
- [ ] **Step 5: Sweep:** `grep -nE "[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]" src/components/sessions/ActivityLog.tsx` — dozwolone tylko komentarze.
- [ ] **Step 6: Commit (orkiestrator):** `feat(i18n): aktywność i sesje w PL/EN (namespace planning)`.

---

## Task 3: Kalendarz i tagi (Cursor)

**Files:**

- Modify: `src/features/calendar/CalendarView.tsx`, `src/features/calendar/CalendarEventForm.tsx`, `src/components/sessions/StartSessionModal.tsx`, `src/features/tags/TagsSection.tsx`, `src/i18n/locales/{pl,en}/planning.ts`, `src/features/planowanie/PlanowanieView.tsx` (JSX `CalendarView` i `TagsSection`: usuń `lang`, `t`)
- Test: `tests/unit/features/calendar/CalendarView.test.tsx`, `CalendarView.layout.test.tsx` (usuń `t={{}}`/`lang="pl"`; rozstrzygnięcie 8), nowy `tests/unit/features/calendar/CalendarView.en.test.tsx`

Klucze 1:1 do `planning`: `calendarAddEntry calendarDeleteEntry calendarEditEntry calendarNewEntry calendarSave calendarCancel sessionModalSuggestionsLabel sessionModalTagPlaceholder sessionModalTagsLabel sessionModalTitle sessionModalTitleLabel sessionStartButton sessionSubmitStart sessionEndButton sessionInProgressSince tagsAdd tagsNoTags tagsSubtitle tagsTagLabel tagsTitle tagsTitleLabel`. `sessionInProgressSince`: PL `Praca w toku od godz. {{time}}`, EN `Work in progress since {{time}}` (placeholder w nawiasach podwójnych).

**Nowe klucze:** ternarka `CalendarView.tsx:275` → `calendarSubtitleTail` (PL `etat i projekty w jednym planie`, EN `full-time job and projects in one schedule`); literały PL w `CalendarView.tsx` (`tydzień`, `Poprzedni miesiąc`, `Poprzedni tydzień` i pozostałe ~30 z greppa) oraz `CalendarEventForm.tsx` → klucze `calendar*` (np. `calendarWeekShort`, `calendarPrevMonth`, `calendarPrevWeek`, `calendarNextMonth`, `calendarNextWeek`). `weekRangeLabel` i nazwy miesięcy/dni w kalendarzu: jeśli używają ręcznych tablic PL, zamień na `Intl` przez `format.ts` (`formatDayMonth`, `formatWeekdayShort`); jeśli tablic nie ma, nic nie zmieniaj.

- [ ] **Step 1: Czerwony test EN** `CalendarView.en.test.tsx`: render jak w `CalendarView.test.tsx` (bez `t`/`lang`); `await setLanguage("en")`; oczekuj `screen.getByText(/full-time job and projects in one schedule/)`; `await setLanguage("pl")` → `/etat i projekty w jednym planie/`.
- [ ] **Step 2: Słowniki + kod.** Wszystkie `t.<klucz>` / `(t.x as string) ?? "…"` → `t("planning:<klucz>")` (angielskie fallbacki usuń). `lang === "pl" ? … : …` → klucze.
- [ ] **Step 3: Testy:** `npx vitest run tests/unit/features/calendar tests/unit/features/tags tests/unit/i18n` + `npx tsc --noEmit`.
- [ ] **Step 4: Sweep:** `grep -nE "[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]" src/features/calendar src/features/tags src/components/sessions -r` — tylko komentarze i wartości vaulta/API (nazwy plików, statusy: bez zmian).
- [ ] **Step 5: Commit (orkiestrator):** `feat(i18n): kalendarz i tagi w PL/EN`.

---

## Task 4: Tablica (Cursor)

**Files:**

- Modify: `src/features/board/BoardTab.tsx`, `BoardCanvas.tsx`, `boardDelete.ts`, `src/i18n/locales/{pl,en}/planning.ts`, `src/features/planowanie/PlanowanieView.tsx` (JSX `BoardTab`: usuń `lang={lang}`; `labels` i `canvasLabels` zostają, ale zmień wartości na `t("planning:board…")` w Task 8; **tu zostają `t.board…`, dopóki `PlanowanieView` ma `t`**)
- Test: `tests/unit/features/board/BoardTab.test.tsx`, `BoardCanvas.test.tsx` (bez zmian; usuń tylko `lang="pl"`, jeśli podawany), test `boardDelete` (jeśli istnieje; wywołania `deleteCopy(plan, "pl"|"en")` zostają dzięki opcjonalnemu `lang`)

Klucze 1:1 do `planning` (16 kluczy `board*`): `boardCanvas boardList boardSaveFailed boardLoadFailed boardRetry boardOutside boardTileTitle boardTileNote boardClose boardAddTile boardAddFrame boardNewTile boardFrameName boardSave boardCancel boardDelete`.

`boardDelete.ts`: `deleteCopy(plan, lang: Lang = currentLang())` — wszystkie ternarki `pl ? … : …` → `i18n.t("planning:boardDelete…", { lng: lang, count })`. **Nowe klucze** (PL dosłownie z kodu):

| Klucz                       | PL                                              | EN                                          |
| --------------------------- | ----------------------------------------------- | ------------------------------------------- |
| `boardDeleteMultiLine`      | `Kafelki: {{tiles}}, ramki: {{frames}}.`        | `Tiles: {{tiles}}, frames: {{frames}}.`     |
| `boardDeleteEdgesLine`      | `Razem z kafelkami znikną strzałki: {{count}}.` | `Arrows removed with the tiles: {{count}}.` |
| `boardDeleteSelectionTitle` | `Usunąć zaznaczone?`                            | `Delete the selection?`                     |

Pozostałe warianty (`frames.length === 1`, pojedynczy kafelek itd.) — wykonawca przenosi 1:1 z kodu `boardDelete.ts` do kluczy `boardDelete*` w tym samym stylu (PL dosłownie, EN z istniejącej gałęzi `else`).

- [ ] **Step 1: Czerwony test EN** w nowym `tests/unit/features/board/boardDelete.en.test.ts`: bez zmiany sygnatury testu PL — `deleteCopy(plan, "en")` dla planu z 2 kafelkami i 1 strzałką oczekuje `title === "Delete the selection?"` i `lines` zawierającego `"Tiles: 2, frames: 0."` oraz `"Arrows removed with the tiles: 1."`; dla `"pl"`: `"Usunąć zaznaczone?"`, `"Kafelki: 2, ramki: 0."`, `"Razem z kafelkami znikną strzałki: 1."`. (Plan zbuduj helperem z istniejącego testu `boardDelete`/`deletePlan`.)
- [ ] **Step 2: Implementacja** wg powyższego; `BoardCanvas.tsx` i `BoardTab.tsx`: usuń prop `lang`; `deleteCopy(plan)` woła bez języka (zdarzenie kliknięcia, `currentLang()` wystarcza). Literały PL w `BoardCanvas/BoardTab` → klucze `board*`.
- [ ] **Step 3: Testy:** `npx vitest run tests/unit/features/board tests/unit/i18n` + `npx tsc --noEmit`.
- [ ] **Step 4: Sweep** `grep -nE "[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]" src/features/board -r` (komentarze dozwolone).
- [ ] **Step 5: Commit:** `feat(i18n): tablica w PL/EN`.

---

## Task 5: Zadania (namespace `tasks`, Cursor)

**Files:**

- Create: `src/i18n/locales/{pl,en}/tasks.ts`
- Modify: `src/i18n/resources.ts`, `src/i18n/index.ts` (`ns`), `src/features/tasks/{TasksSection,TaskCard,TaskColumn,TaskTiles,TaskDetailModal,TaskTemplatesModal}.tsx`, `useTasksBoard.ts`, `taskOrderUtils.ts` (tylko jeśli zawierają teksty UI), `src/features/planowanie/PlanowanieView.tsx` (JSX `TasksSection`: usuń `lang`, `t`)
- Test: `TasksSection.test.tsx` (usuń `t={translations.pl}`, `lang="pl"` i import), `TaskDetailModal.test.tsx` (usuń atrapę `fakeT`/prop `t`), pozostałe testy `tests/unit/features/tasks/` bez zmian; nowy `tests/unit/features/tasks/TasksSection.en.test.tsx`

Klucze 1:1 do `tasks` (`tasks*`, 37 minus martwe `tasksNewPlaceholder tasksMoveUp tasksMoveDown`): `tasksAdd tasksDeadlineLabel tasksDeferred tasksDetailLinkLabel tasksDetailLinkPlaceholder tasksDetailModalTitle tasksDetailNoteLabel tasksDetailNotePlaceholder tasksDetailProjectLabel tasksDetailSave tasksDetailSaving tasksDetailStatusLabel tasksDetailTitleFieldLabel tasksDone tasksInProgress tasksManageTemplates tasksNewTitlePlaceholder tasksNoProject tasksNoSearchResults tasksNoTasks tasksSearchPlaceholder tasksShowLess tasksShowMore tasksStartDateLabel tasksTemplateLabel tasksTemplateLabelField tasksTemplateNone tasksTemplateTitleField tasksTemplatesAdd tasksTemplatesModalTitle tasksTemplatesNoItems tasksTemplatesSubtitle tasksToReview tasksTodo`. `tasksShowMore`: PL `Pokaż jeszcze {{count}}`, EN `Show {{count}} more`. `calendarCancel` czytaj jako `t("planning:calendarCancel")`.

**Nowe klucze:**

| Klucz                  | PL                                                             | EN                                                        |
| ---------------------- | -------------------------------------------------------------- | --------------------------------------------------------- |
| `tasksEyebrow`         | `Alt+3 · Zadania`                                              | `Alt+3 · Tasks`                                           |
| `tasksHeading`         | `Zadania projektowe`                                           | `Project Tasks`                                           |
| `tasksDateSubtitle`    | `{{date}} · {{active}} zadań aktywnych · {{done}} ukończonych` | `{{date}} · {{active}} active tasks · {{done}} completed` |
| `tasksCardDrag`        | `Przeciągnij`                                                  | `Drag`                                                    |
| `tasksCardUrgentTitle` | `Pilne: do zrobienia od ręki`                                  | `Urgent: do right away`                                   |
| `tasksCardUrgent`      | `Pilne`                                                        | `Urgent`                                                  |
| `tasksCardDelete`      | `Usuń`                                                         | `Delete`                                                  |
| `tasksTileToday`       | `dziś`                                                         | `today`                                                   |
| `tasksTileTomorrow`    | `jutro`                                                        | `tomorrow`                                                |
| `tasksTileNextDue`     | `najbliższy termin`                                            | `next due`                                                |

Ternarki `TaskCard.tsx:201–206` i `TaskTiles.tsx:28–40` (pozostałe etykiety kafli i opis kafla): wykonawca przenosi 1:1 do kluczy `tasksCard*`/`tasksTile*`, PL dosłownie, EN z gałęzi `else`; wypisuje je w odpowiedzi.

Szczegóły kodu:

- `TasksSection.tsx`: `formatDate` → `formatShortDate(d)`; `dateSubtitle` → `t("tasks:tasksDateSubtitle", { date: capitalized(formatFullDate(today)), active, done })`, zależność `useMemo` zamień z `lang` na wynik `useLang().lang` (komponent woła `useLang()` tylko po to, by `useMemo` przeliczał się po zmianie języka; **albo** usuń `useMemo` i licz bezpośrednio, jeśli koszt trywialny — preferowane, tak jak w kaflach Projektów); `cardLabels.showMore: (count) => t("tasks:tasksShowMore", { count })`; obiekt `labels` bez `?? "…"` fallbacków.
- `TaskTiles.tsx` (`dueLabel(iso, now, lang = currentLang())`, funkcja kafli): `i18n.t("tasks:…", { lng: lang })`; komponent `TaskTiles` woła `useT()`.
- `TaskCard/TaskColumn`: usuń prop `lang`; `labels` zostają.

- [ ] **Step 1: Czerwony test EN** `TasksSection.en.test.tsx` (render jak w `TasksSection.test.tsx`, bez `t`/`lang`, przy `fixedNow`/mockach z tamtego testu): `await setLanguage("en")` → `getByText("Project Tasks")`, `getByText("Alt+3 · Tasks")`; w PL → `Zadania projektowe`, `Alt+3 · Zadania`. Dla czystej funkcji w osobnym `it`: `dueLabel("2026-11-15", new Date(2026, 10, 15), "en") === "today"`, `…, "pl") === "dziś"`.
- [ ] **Step 2: Implementacja** wg powyższego.
- [ ] **Step 3: Testy:** `npx vitest run tests/unit/features/tasks tests/unit/i18n` + `npx tsc --noEmit`.
- [ ] **Step 4: Sweep** `grep -rnE "[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]" src/features/tasks` (komentarze i wartości vaulta dozwolone).
- [ ] **Step 5: Commit:** `feat(i18n): zadania w PL/EN (namespace tasks)`.

---

## Task 6: Zasoby (namespace `resources`, Cursor)

**Files:**

- Create: `src/i18n/locales/{pl,en}/resources.ts` (nazwa pliku kolizyjna z `src/i18n/resources.ts`? **Nie**: ścieżki różne, `locales/pl/resources.ts`; import w `resources.ts` jako `plResources`)
- Modify: `src/i18n/resources.ts`, `src/i18n/index.ts` (`ns` + `"resources"`), `src/features/resources/{ResourceSection.tsx,useResources.ts,resourceTypes.ts}`, `src/features/planowanie/PlanowanieView.tsx` (JSX `ResourceSection`: usuń `t`)
- Test: `tests/unit/features/resources/ResourceSection.test.tsx` (usuń `t={{}}`; wyjątek 8b dla asercji na angielskich fallbackach), nowy test EN

Klucze 1:1 (`resource*`, `addResource`; bez martwych `resourceSaveNoteFirst`, `resourceEditTags`): `addResource resourceAddFromBlock resourceBlockFormatError resourceBlockFormatHint resourceBlockFormatLabel resourceBlockFormatPlaceholder resourceClearFilters resourceCopied resourceDeleteConfirm resourceDescriptionPlaceholder resourceEdit resourceEditModalTitle resourceFavorite resourceFavoritesSectionTitle resourceFilterByTags resourceNoMatchingTags resourceNoResources resourceSaveEdit resourceSearchPlaceholder resourceTagsPlaceholder resourceTitleUnavailable resourceUrlPlaceholder`.

**Plural zamiast pary** `resourceAddedOne`/`resourceAddedCount` (`useResources.ts:311`): klucze `resourceAdded_one/_few/_many/_other`; PL: `Dodano {{count}} zasób` / `Dodano {{count}} zasoby` / `Dodano {{count}} zasobów` / `Dodano {{count}} zasobu`; EN: `Added {{count}} resource` / `Added {{count}} resources` (`_one`, `_other`). Wywołanie: `t("resources:resourceAdded", { count })`, bez gałęzi `count === 1`.

`useResources(apiFetch, t)` (`:158`, parametr `t`) → hook woła `useT()` wewnątrz; sygnaturę uprość do `(apiFetch)`; typ `TranslationDict` usuń z `resourceTypes.ts` (jeśli używany tylko tu). Sprawdź wywołania `useResources(` w testach i dostosuj (wyjątek 8a).

- [ ] **Step 1: Czerwony test EN** (`ResourceSection.en.test.tsx`, render jak w istniejącym teście): po `setLanguage("en")` oczekuj `resourceSearchPlaceholder` w EN (wartość skopiuj z `translations.en.resourceSearchPlaceholder` przed usunięciem pliku); plural: ręczny test czystego wywołania `i18n.t("resources:resourceAdded", { count: 1, lng: "en" }) === "Added 1 resource"`, `count: 2` → `"Added 2 resources"`, a `{ lng: "pl", count: 2 }` → `"Dodano 2 zasoby"`, `count: 5` → `"Dodano 5 zasobów"`.
- [ ] **Step 2: Implementacja.**
- [ ] **Step 3: Testy:** `npx vitest run tests/unit/features/resources tests/unit/i18n` + `npx tsc --noEmit`.
- [ ] **Step 4: Sweep** `grep -rnE "[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]" src/features/resources`.
- [ ] **Step 5: Commit:** `feat(i18n): zasoby w PL/EN (namespace resources, plural)`.

---

## Task 7: Mapy myśli (namespace `mindmaps`, Cursor, dwa zlecenia, jeden commit)

**Files:**

- Create: `src/i18n/locales/{pl,en}/mindmaps.ts`
- Modify: `src/i18n/resources.ts`, `src/i18n/index.ts` (`ns` + `"mindmaps"`), `src/features/mind-maps/{MindMapsTab,MindMapList,MindMapEditor,MindMapEditorToolbar,MindMapNotesPanel,MindMapTree,TreeLevel,NodePill,MindMapDeleteModal,ExportSubtreeToMapModal}.tsx`, `src/features/planowanie/PlanowanieView.tsx` (JSX `MindMapsTab`: usuń `t`; `title` zostaje do Task 8)
- Test: `tests/unit/features/mind-maps/MindMapTree.labelEdit.test.tsx` (usuń `t={translations.pl}` i import), pozostałe testy map bez zmian (snapshot `mindMapExportHtml` nietknięty), nowy `tests/unit/features/mind-maps/MindMapsTab.en.test.tsx`

Zakres kluczy: wszystkie **żywe** klucze `mindMaps*` (64; martwe z rozstrzygnięcia 3 pomijamy). Komponenty dziś typują `t` jako `(typeof translations)["en"]` — usuń importy `translations` z tych 10 plików i typy `T`; każdy komponent `useT()`; komponenty rekurencyjne (`TreeLevel`, `NodePill`, `MindMapTree`) przestają przekazywać `t` w dół.

Szczególne miejsca:

- `mindMapsItemsCount` → plural `mindMapsItemsCount_one/_few/_many/_other`; PL: `{{count}} element` / `{{count}} elementy` / `{{count}} elementów` / `{{count}} elementu`; EN `{{count}} item` / `{{count}} items` (`MindMapNotesPanel.tsx:105`: `t("mindmaps:mindMapsItemsCount", { count })`). Test PL, który utrwala „N elementów” przy N≠5+, zgłoś jako wyjątek 8b.
- Etykieta węzła w potwierdzeniu eksportu (klucz z `{label}` w `ExportSubtreeToMapModal`): `{{label}}`.
- `MindMapList.tsx:20`: `toLocaleDateString()` → `formatShortDate(new Date(ms))`; `MindMapEditor.tsx:603`: `toLocaleTimeString()` → `formatTimeSeconds(new Date(lastSavedAt))`.

Zlecenie 7a (Cursor `--fresh`): słowniki `mindmaps.ts` (pl i en, 64 klucze 1:1, parytet) + wiring + test parytetu zielony. Zlecenie 7b (`--keep`): kod 10 komponentów + test labelEdit + test EN.

- [ ] **Step 1 (7a):** słowniki + `resources.ts` + `ns`; `npx vitest run tests/unit/i18n` zielony.
- [ ] **Step 2 (7b, czerwony test):** `MindMapsTab.en.test.tsx`: render `MindMapsTab` z mockiem `apiFetch` zwracającym pustą listę map (wzór: istniejące testy w katalogu); `setLanguage("en")` → oczekuj `mindMapsNoMaps` w EN (wartość z `translations.en.mindMapsNoMaps`), po `pl` → wartość PL.
- [ ] **Step 3:** kod komponentów.
- [ ] **Step 4: Testy:** `npx vitest run tests/unit/features/mind-maps tests/unit/i18n` + `npx tsc --noEmit`.
- [ ] **Step 5: Sweep** `grep -rnE "[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]" src/features/mind-maps` (poza `mindMapExportTemplate.ts` i komentarzami).
- [ ] **Step 6: Commit:** `feat(i18n): mapy myśli w PL/EN (namespace mindmaps, plural)`.

---

## Task 8: Powłoka `PlanowanieView`, `App.tsx`, koniec `translations.ts` (Cursor)

**Files:**

- Modify: `src/features/planowanie/PlanowanieView.tsx`, `src/App.tsx`, `src/i18n/locales/{pl,en}/planning.ts`
- Delete: `src/translations.ts`
- Test: `tests/unit/**` — brak importów `translations` (sprawdź grepem); nowy `tests/unit/features/planowanie/PlanowanieView.en.test.tsx`, jeśli istnieje już test `PlanowanieView` (wzorzec `ls tests/unit/features/planowanie 2>/dev/null`), w przeciwnym razie test EN renderuje `PlanowanieView` z mockami `apiFetch` (`[]` dla list)

Klucze 1:1 do `planning` (powłoka i notatki): `tabCalendar tabBoard tabMindMaps tabResources tabSkills tabTags newNote noteTitlePlaceholder noteContentPlaceholder noteCancelEdit saveNote noteEdit deleteNote`. `sessionInProgressSince` i `sessionEndButton` już są (Task 3).

Zmiany w `PlanowanieView.tsx`:

- `const t = useT()`; usuń propsy `lang`, `t` oraz typ `TranslationsEn` i import `translations`.
- `subtabItems`: zamiast łańcucha ternarek z fallbackami — mapa `const TAB_LABEL_KEY: Record<string, string> = { calendar: "planning:tabCalendar", activity: "planning:activityTitle", board: "planning:tabBoard", mindmaps: "planning:tabMindMaps", resources: "planning:tabResources", skills: "planning:tabSkills", tags: "planning:tabTags" }` i `label: TAB_LABEL_KEY[tab] ? t(TAB_LABEL_KEY[tab]) : tab`.
- Baner sesji: `t("planning:sessionInProgressSince", { time: formatTime(new Date(activeSession.startedAt)) })` (bez fallbacku z `en-US`); `t("planning:sessionEndButton")`.
- `NotesPanel`: propsy stringów z `t("planning:newNote")` itd.
- `BoardTab`: `labels` i `canvasLabels` z `t("planning:board…")`.
- `MindMapsTab`: `title={t("planning:tabMindMaps")}`.
- Komunikat błędu `"Failed to save"` (`handleEndSession`) → nowy klucz `sessionSaveFailed` (PL `Nie udało się zapisać`, EN `Failed to save`). Komunikaty z API bez zmian (J2).

`App.tsx`: usuń import `translations`, `const t = translations[lang]` i propsy `lang`/`t` przy `<PlanowanieView>`; `useLang()` zostaje, jeśli `App` nadal używa `lang`/`toggleLang` dla innych potrzeb (komendy, szyna).

- [ ] **Step 1: Czerwony test EN** `PlanowanieView.en.test.tsx`: `setLanguage("en")`, `planningTab="calendar"`, `CardSubTabs` pokazuje `Calendar`, `Board`, `Mind maps` (wartości z `translations.en.tabCalendar/tabBoard/tabMindMaps`); po `pl`: `Kalendarz`, `Tablica`, `Mapy myśli`.
- [ ] **Step 2: Implementacja** wg powyższego; potem `grep -rn "translations" src tests app` → Expected: zero trafień poza usuwanym plikiem i komentarzami w docs; usuń `src/translations.ts` przez `git rm`.
- [ ] **Step 3: Testy:** `npx vitest run tests/unit/features tests/unit/i18n tests/unit/components` + `npx tsc --noEmit`.
- [ ] **Step 4: Commit:** `feat(i18n): powłoka Planowania w PL/EN; usunięty src/translations.ts`.

---

## Task 9: Review i weryfikacja końcowa

- [ ] **Step 1: Review diffa (agy, `--role review --tier deep`, tylko odczyt).** Prośba: niezależny review `git diff main...HEAD` pod kątem (1) kluczy użytych w kodzie, których nie ma w słownikach PL/EN (`t("ns:klucz")` bez wpisu), (2) pozostałych twardych tekstów PL/EN w plikach Planowania (w tym bez polskich liter, np. `"Delete"`, `"Loading…"`), (3) komponentów, które po zmianie nie subskrybują języka (czysta funkcja woła `i18n.t` w renderze, a komponent nie woła `useT()`), (4) regresji gramatyki plural. Format: `plik:linia + przyczyna`.
- [ ] **Step 2: Weryfikacja każdej uwagi w kodzie** (opinie to hipotezy), poprawki własne lub małe `--role task`, osobne commity.
- [ ] **Step 3: Pełna weryfikacja (Cursor, `--approve-allowed`):** `npx tsc --noEmit`, `npx vitest run`, `npm run lint`, `npm run build`, każde osobno, bez pipe'ów.
- [ ] **Step 4: Oględziny w przeglądarce** (`npm run dev`, przełącznik PL/EN na każdej podkarcie Planowania: Kalendarz, Aktywność, Zadania, Tagi, Tablica, Mapy myśli, Zasoby; baner „Praca w toku” przy aktywnej sesji).
- [ ] **Step 5: Push i PR** (po decyzji użytkownika): `feat(i18n): język PL/EN, etap 4 (Planowanie)`; opis jak w PR #68/#69; „Dalej: etap 5 (Arsenał, Kodeks, Notatki, Płótno)”.

---

## Self-review

- **Pokrycie specu (§4 pkt 4):** migracja `translations.ts` → Task 2–8; usunięcie propsów `t`/`lang` → Task 2–8; rozwiązanie `toLocale…` → Task 1 + użycia w Task 2, 5, 7 (miejsca poza zakresem wymienione w rozstrzygnięciu 5); plik znika → Task 8.
- **Placeholdery w planie:** brak „TBD”; miejsca, gdzie lista kluczy wynika z czytania kodu (kalendarz ~30 literałów, warianty `boardDelete`, etykiety kafli), mają regułę nazewnictwa, wartość PL „dosłownie” i sprawdzian grep w kroku Sweep.
- **Spójność nazw:** `formatTime`, `formatTimeSeconds`, `formatShortDate`, `formatFullDate` (Task 1) używane w Task 2, 5, 7, 8; `planning:calendarCancel` (Task 3) czytany w Task 5; `sessionInProgressSince`/`sessionEndButton` (Task 3) używane w Task 8; `deleteCopy(plan, lang?)` (Task 4) bez zmian dla testów.
- **Znane ryzyka:** (1) asercje testów na angielskich fallbackach lub błędnym plural — wyjątek 8b, zatwierdzam ręcznie; (2) twarde teksty bez polskich liter nie łapią się greppem — łapie je review agy (Task 9, punkt 2); (3) stan w komponentach zapisany jako gotowy tekst (komunikaty błędów) zostaje w języku powstania, jak w etapach 2–3.
