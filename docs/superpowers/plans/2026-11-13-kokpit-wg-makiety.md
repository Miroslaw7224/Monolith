# Kokpit wg makiety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. Zgodnie z `CLAUDE.md`: testy/lint/tsc przez `cursor`, review przez `agy`, zmiany `architecture.static.test.ts` tylko osobnym commitem.

**Cel:** Kokpit (`src/features/home/`, `contexts/bc_cockpit/`) dorównuje makiecie `docs/mockups/karty/cards/01-kokpit.html`: układ, dane i funkcje.

**Architektura:** Kokpit zostaje agregatem w `bc_cockpit` (serwis woła tylko `services` innych kontekstów). Każda nowa funkcja to osobny podplan z własnym PR-em/commitami; K1 przebudowuje układ na danych, które już istnieją, kolejne dokładają dane.

**Tech Stack:** Next.js 14, zod, vitest + Testing Library, vault Markdown/YAML (`lib/nexus`), `lib/git`.

**Decyzje użytkownika (2026-11-13):** dodać wszystko poniżej. Inbox: plik w vaulcie, nowy kontekst. Save State: z `state.md`. Energia: pole w zadaniu. Reszta: oś czasu (linia „teraz” + brief), okna Deep Work, zaczep + zamknij dzień, commity dziś + pasek statusu.

## Mapa podplanów (kolejność wykonania)

| ID     | Zakres                                                                                                                                                                                                                                                                                                                                                             | Nowe dane / kontekst                                                                                                      | Zależy od  |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **K1** | Układ i wygląd: nagłówek (data, zegar, tydzień), 5 kafli, karty tematów (następny krok, BRANCH, BLOKER, OSTATNIO + pewne/do sprawdzenia, chipy, Kopiuj kontekst, Wejdź, slot „Wolne miejsce”), oś czasu (zakres godzin, linia „teraz”), kolejka (podpis projekt · priorytet, przekreślone zrobione), dolny pasek statusu (bez git), przycisk `src`, tło z kropkami | tylko istniejące: `ProjectState.branch/updated`, `stateConfidence`, `board.now`, `bugs`                                   | —          |
| **K2** | Energia Deep/Quick: pole `energy` w zadaniu, filtry i tagi w kolejce, kafel „2 deep · 5 quick”                                                                                                                                                                                                                                                                     | `lib/nexus/task-line.ts` (`[energy:: deep]`), `bc_tasks`; dla zadań projektów (`tasks.md` projektu) do ustalenia przed K2 | K1         |
| **K3** | Inbox: `contexts/bc_inbox/` (5 plików), `Inbox/inbox.md` w vaulcie, panel + kafel + Alt+I                                                                                                                                                                                                                                                                          | nowy kontekst + route `app/api/inbox`                                                                                     | K1         |
| **K4** | Oś czasu: pola wydarzenia `brief`, `link` (+ „Dołącz ↗”, blok BRIEF); wpisy ukryte poza godzinami                                                                                                                                                                                                                                                                  | `bc_calendar` (model, schemas, formularz wydarzenia)                                                                      | K1         |
| **K5** | Okna Deep Work (proponowane): wolne okna w kalendarzu przypisane do tematów                                                                                                                                                                                                                                                                                        | czysta funkcja w `bc_cockpit/services`, bez zapisu                                                                        | K1, K2, K4 |
| **K6** | Zaczep z wczoraj + „Zamknij dzień” (1 zdanie → vault)                                                                                                                                                                                                                                                                                                              | `Cockpit/closing.yaml`, `PUT /api/cockpit/closing`                                                                        | K1         |
| **K7** | Commity dziś (kafel) + branch/projekt w pasku statusu z git                                                                                                                                                                                                                                                                                                        | `lib/git` (nowa funkcja `commitsSince`, biała lista `log`)                                                                | K1         |

Każdy podplan dostaje własny plik `docs/superpowers/plans/2026-11-13-kokpit-k<N>-<nazwa>.md` tuż przed wykonaniem (pytania o szczegóły zadamy przy K2; reszta jest opisana wyżej). Ten plik szczegółowo opisuje tylko **K1**.

---

# K1: Układ Kokpitu na istniejących danych

**Zasada:** nic nie zmyślamy. Element bez danych (Inbox, commity, energia, brief) w K1 się nie pojawia ani jako atrapa, ani z liczbą zero; pojawi się w swoim podplanie. Wyjątek: kafel „Następne spotkanie” (dane są: wydarzenia dnia).

## Mapa plików

- Modify `contexts/bc_cockpit/models.ts`: `Topic` + `branch`, `lastActivity`, `confidence`, `nowCount`, `bugCount`; `QueueItem` + `projectName`, `priority`; `Cockpit` + `nextMeeting`.
- Modify `contexts/bc_cockpit/services.ts`: wypełnianie nowych pól (`toTopic`, `loadQueue`) i `nextMeeting`.
- Modify `contexts/bc_cockpit/schemas.ts`: mapowanie nowych pól w `toCockpitDto`.
- Create `src/features/home/cockpitFormat.ts`: czyste funkcje UI: `hhmm`, `weekNumber`, `relativeDays`, `minutesUntil`.
- Create `src/features/home/StatusBar.tsx`: dolny pasek (projekt, vault, skróty, zegar).
- Modify `src/features/home/CockpitSections.tsx`: nowe kafle, karty tematów, oś czasu, kolejka.
- Modify `src/features/home/HomeView.tsx`: nagłówek z datą, zegarem, tygodniem; przekazanie `onOpenProject`; `StatusBar`.
- Modify `src/features/home/home.css`: klasy z makiety (`kok-clock`, `kok-now`, `kok-topic__meta`, `kok-statusbar`, tło kropkowane `kok::before`).
- Modify `src/App.tsx` (+ `src/features/cards/useCardNavigation.ts` tylko jeśli trzeba): „Wejdź” otwiera kartę Projekty z wybranym projektem. Przycisk `src` z makiety (Alt+0 „źródła”) pomijamy: w aplikacji nie ma takiej funkcji; do ustalenia z użytkownikiem osobno.
- Tests: `tests/unit/contexts/bc_cockpit/{services,schemas}.test.ts`, `tests/unit/features/home/{HomeView.test.tsx,cockpitFormat.test.ts}`.

## Interfejsy

```ts
// contexts/bc_cockpit/models.ts (zmiany)
export type Confidence = "sure" | "check"; // pewne | do sprawdzenia

export type Topic = {
  /* …dotychczasowe pola… */
  branch: string | null; // ProjectState.branch (trim, "" → null)
  lastActivity: string | null; // state.updated ?? index.lastWorked, ISO/YYYY-MM-DD
  confidence: Confidence; // "check" gdy freshness === "stale" LUB stateConfidence === "low"; inaczej "sure"
  nowCount: number; // niezakończone zadania board.now
  bugCount: number; // aktywne bugi (BugEntry) projektu
};
export type QueueItem = {
  kind: QueueKind;
  title: string;
  due: string | null;
  projectName: string | null; // null = zadanie ogólne
  priority: string | null; // RegistryEntry.priority projektu ("high"…), null dla ogólnych bez priorytetu
};
export type NextMeeting = { title: string; startMinutes: number; durationMinutes: number };
export type Cockpit = { /* … */ nextMeeting: NextMeeting | null };
```

```ts
// src/features/home/cockpitFormat.ts
export function hhmm(minutes: number): string; // 590 → "09:50"
export function weekNumber(date: Date): number; // ISO 8601
export function minutesUntil(nowMinutes: number, startMinutes: number): number; // < 0 gdy minęło
export function relativeDays(fromIso: string | null, today: Date): string | null;
// "dziś" | "wczoraj" | "N dni temu" | null (brak daty)
```

## Reguły

1. **Nagłówek:** eyebrow „Alt+1 · Kokpit”; tytuł = data po polsku z dniem tygodnia („Środa, 11 listopada”, wielka litera), bez „Dzień dobry 👋”; podtytuł „N spotkań dziś” (liczba wydarzeń `type: meeting`, odmiana 1/2–4/5+); po prawej zegar `HH:mm` (aktualizacja co 30 s, `setInterval` sprzątany w efekcie) i „tydz. N”.
2. **Kafle (4 w K1):** „Następne spotkanie” (akcent; `HH:mm`, pod spodem „za N min · tytuł”; brak = „—” i „brak spotkań dziś”), „Kolejka zadań”, „Aktywne tematy” (`n / 3`, „jedno wolne miejsce” gdy n=2, „limit 3” gdy n=3, „przypnij projekty” gdy 0), „Ostrzeżenia”. Kafel „Wydarzenia dnia” znika (zastępuje go „Następne spotkanie”). Kafle „Zadania na dziś (deep/quick)”, „Inbox”, „Commity dziś” dodają K2/K3/K7.
3. **Karta tematu:** badge „bloker” (czerwony) gdy `blocker`; „własny”/„etat” z `owner` (`work` → „etat”, `personal` → „własny”); „aktywny” zielony gdy `confidence === "sure"` i brak blokera; linia `→ nextStep` dużą czcionką (fallback: `whereIStopped`); wiersze BRANCH, BLOKER (tylko gdy jest), OSTATNIO (`relativeDays` + odznaka „pewne”/„do sprawdzenia”); chipy „Teraz: N”, „bugi: N” (tylko gdy N>0); przyciski „Kopiuj kontekst” (GET `/api/projects/{id}/context-pack`, `navigator.clipboard.writeText(markdown)`, komunikat „Skopiowano” 2 s, błąd → „Nie udało się skopiować”) i „Wejdź” (`onOpenProject(id)`). Pierwsza karta ma klasę `kok-topic--lead` (pomarańczowa ramka).
4. **Slot:** gdy tematów < 3: „Wolne miejsce na trzeci temat” (n=2) lub „…na kolejny temat” (n<2), klik otwiera `PinPicker`.
5. **Oś czasu:** w nagłówku panelu zakres godzin (`min(start, 8:00)`–`max(koniec, 18:00)` pełne godziny, np. „08–18”); linia „teraz” z etykietą i godziną wstawiana między wydarzenia wg `startMinutes` (przed pierwszym, którego start > teraz); wydarzenie trwające („teraz” w [start, start+czas)) dostaje węzeł pełny `kok-tl__node--now`.
6. **Kolejka:** pod tytułem „projekt · priorytet” (gdy jest), grupy zostają (ich nagłówki pokazują nazwę projektu), zadania „now” bez terminu bez odznaki; przekreślanie wykonanych: poza K1 (kolejka zawiera tylko niezakończone), więc **nie** dodajemy.
7. **Pasek statusu:** lewa strona „projekt <id pierwszego tematu>” (brak tematów: ukryty), „vault” + zielona kropka + „zsynchronizowany” gdy `warnings.length === 0`, inaczej żółta kropka + „N ostrzeżeń”; prawa: „Alt+1…9 karty · Ctrl+K polecenia” i zegar. „branch” i „Alt+0 źródła” dodaje K7 / osobny pomysł.

## Przypadki testowe (konkretne wartości)

`cockpitFormat.test.ts`

- `hhmm(590)` → `"09:50"`, `hhmm(0)` → `"00:00"`, `hhmm(1439)` → `"23:59"`.
- `weekNumber(new Date(2026, 10, 11))` → `46`; `weekNumber(new Date(2026, 0, 1))` → `1`; `weekNumber(new Date(2021, 0, 3))` → `53`.
- `minutesUntil(588, 630)` → `42`; `minutesUntil(700, 630)` → `-70`.
- `relativeDays("2026-11-11", new Date(2026, 10, 11))` → `"dziś"`; `("2026-11-10", …)` → `"wczoraj"`; `("2026-11-05", …)` → `"6 dni temu"`; `(null, …)` → `null`; `("2026-11-11T21:40", new Date(2026, 10, 12))` → `"wczoraj"`.

`services.test.ts` (bc_cockpit, rozszerzenie istniejącego pliku, wzorzec mocków jak tam)

- Temat z `state.branch = " fix/x "` → `branch: "fix/x"`; z `branch: ""` → `null`.
- `lastActivity`: `state.updated = "2026-11-12T21:40"` i `lastWorked = "2026-11-01"` → `"2026-11-12T21:40"`; bez `state` → `lastWorked`.
- `confidence`: `freshness: "stale"` → `"check"`; `stateConfidence: "low"` → `"check"`; `fresh` + brak `stateConfidence` → `"sure"`.
- `nowCount`: `board.now = [{done:false},{done:true},{done:false}]` → `2`. `bugCount`: 2 bugi → `2`.
- Zadanie projektu: `queue[].items[].projectName = "Nexus"`, `priority = "high"`; zadanie ogólne: `projectName: null`.
- `nextMeeting`: dziś 09:00 (work), 10:30 (meeting), 13:00 (meeting), przy `new Date(2026, 10, 13, 9, 48)` → tytuł 10:30; przy 14:00 → `null`; wydarzenie `work` nigdy nie jest „następnym spotkaniem”.

`HomeView.test.tsx` (rozszerzenie)

- Renderuje tytuł „Piątek, 13 listopada” (przy `vi.setSystemTime`), a nie „Dzień dobry”.
- Karta tematu pokazuje „→ Napisać plan 2-1”, wiersz BRANCH `main`, odznakę „bloker”, chipy „Teraz: 2” i „bugi: 1”.
- „Kopiuj kontekst” woła `apiFetch("/api/projects/nexus/context-pack")` i `navigator.clipboard.writeText` z `markdown`.
- „Wejdź” woła `onOpenProject("nexus")`.
- Gdy tematów 2: widoczny „Wolne miejsce na trzeci temat”; klik otwiera dialog PinPicker.
- Pasek statusu pokazuje „zsynchronizowany” przy 0 ostrzeżeń i „2 ostrzeżenia” przy 2.

## Zadania

### Task 1: Format czasu (`cockpitFormat.ts`)

- [ ] Napisz `tests/unit/features/home/cockpitFormat.test.ts` z przypadkami wyżej.
- [ ] `npx vitest run tests/unit/features/home/cockpitFormat.test.ts` → FAIL (brak modułu).
- [ ] Zaimplementuj `src/features/home/cockpitFormat.ts` (ISO 8601: tydzień = tydzień roku czwartku danego tygodnia).
- [ ] Test → PASS. Commit: `feat(kokpit): funkcje formatowania czasu`.

### Task 2: Dane tematów i kolejki w `bc_cockpit`

- [ ] Dopisz testy `services.test.ts` (temat: branch, lastActivity, confidence, nowCount, bugCount; kolejka: projectName, priority).
- [ ] Uruchom → FAIL. Zmień `models.ts`, `services.ts` (`toTopic`: dane z `p.state`, `p.stateConfidence`, `p.board.now.filter(t => !t.done).length`, `p.bugs.length`; `loadQueue`: `projectName`/`priority` z `projectsServices.listNowTasks()`; jeśli `NowTask` nie niesie priorytetu, dodaj do niego pole `priority: string` w `bc_projects/models.ts` i `listNowTasks`, z testem w `tests/unit/contexts/bc_projects/`).
- [ ] `schemas.ts`: mapuj nowe pola w `toCockpitDto`; dopisz test w `schemas.test.ts`.
- [ ] `npx vitest run tests/unit/contexts/bc_cockpit tests/unit/contexts/bc_projects` → PASS. Commit: `feat(kokpit): dane tematów i kolejki (branch, aktywność, pewność, liczniki)`.

### Task 3: Następne spotkanie

- [ ] Test `nextMeeting` (przypadki wyżej); FAIL; zaimplementuj w `loadEvents`/`getCockpit(today)` (porównanie z `today.getHours()*60+today.getMinutes()`); `schemas.ts` + DTO; PASS. Commit: `feat(kokpit): następne spotkanie`.

### Task 4: Komponenty (nagłówek, kafle, tematy, oś, kolejka, pasek)

- [ ] Rozszerz `HomeView.test.tsx` o przypadki wyżej (FAIL).
- [ ] `HomeView.tsx`: nagłówek, zegar, tydzień, `onOpenProject`, `StatusBar`; `CockpitSections.tsx`: reguły 2–6; `StatusBar.tsx`: reguła 7.
- [ ] `home.css`: dopisz klasy z makiety (`01-kokpit.html`, prefiks `kp-` → `kok-`), motyw tylko w `[data-card="kokpit"]`.
- [ ] `npx vitest run tests/unit/features/home` → PASS. Commit: `feat(kokpit): układ wg makiety (nagłówek, kafle, tematy, oś czasu, pasek statusu)`.

### Task 5: „Wejdź” do projektu

- [ ] Sprawdź `src/features/projects/useProjects.ts` i `App.tsx`: jak wybrać projekt z zewnątrz (hash `#projekty/<id>` lub prop `initialProjectId`). Dodaj minimalne wsparcie z testem w `tests/unit/features/projects/` oraz wywołanie `selectCard("projekty")`. Commit: `feat(kokpit): Wejdź otwiera teczkę projektu`.

### Task 6: Weryfikacja

- [ ] `cursor --role task --approve-allowed`: `npx tsc --noEmit`, `npx vitest run`, `npm run lint`, `npm run build` → „przeszło” albo `plik:linia + przyczyna`.
- [ ] Playwright: `node <scratchpad>/shoot.cjs` (zrzuty makiety i aplikacji kart 1–9) i porównanie Kokpitu; zrzut zapisać w scratchpadzie, nie w repo.
- [ ] `agy --role review`: niezależny przegląd diffu K1.
- [ ] Zaktualizuj `docs/mockups/karty/STAN-W-KODZIE.md` (sekcja 1: Kokpit; statusy: „Punkty skupienia z Save State” → JEST; „Kafle z liczbami dnia” → CZĘŚCIOWO bez inbox/commity/energia). Commit: `docs: STAN-W-KODZIE: Kokpit K1`.

## Self-review

- Pokrycie: makieta → K1 (układ, tematy, oś, pasek) + K2–K7 (funkcje); zadania na dziś/deep/quick, Inbox, commity, brief, okna, zaczep celowo poza K1.
- Typy: `Topic`, `QueueItem`, `NextMeeting`, `cockpitFormat` spójne między Taskami 1–4.
- Ryzyko: `NowTask` bez priorytetu (Task 2 to uwzględnia); drzewo robocze na gałęzi `feat/karty-nowy-wyglad` ma niescommitowane zmiany nawigacji. Przed Taskiem 1 trzeba je scommitować albo przenieść na osobną gałąź.
