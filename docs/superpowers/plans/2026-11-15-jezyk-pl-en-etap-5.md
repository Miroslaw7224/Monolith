# Język PL/EN: etap 5 (Arsenał, Mapa, Kodeks, Notatki) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ostatnie karty z tekstami na sztywno po polsku (Arsenał, Mapa, Kodeks, Notatki wraz z edytorem i bazą NEXUS) tłumaczone PL/EN przez `i18next`; w repo nie zostaje żaden widoczny dla użytkownika literał PL/EN poza słownikami.

**Architecture:** Fundament z etapów 1–4 (`src/i18n/`, `useT`, `useLang`, `format.ts`, test parytetu) zostaje. Dochodzą cztery namespace'y: `arsenal`, `map`, `codex`, `notes` (`locales/{pl,en}/<ns>.ts`). Komponenty: `const t = useT()`; czyste funkcje i kod poza Reactem (hooki asynchroniczne, rysowanie na canvasie) wołają `i18n.t(…, { lng })`; daty przez `format.ts`. Klucze są pogrupowane płasko z prefiksem obszaru (styl etapu 4). Konteksty `bc_*`, API i test architektury bez zmian.

**Tech Stack:** Next.js 14 (klient), React 19, TypeScript (`strict: false`), `i18next` 27 + `react-i18next` 18, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-15-jezyk-pl-en-design.md` (J1–J9; §4 pkt 5). Wzorce: plany etapów 1–4 w `docs/superpowers/plans/`. **Zasady repo:** `CLAUDE.md`; `tests/unit/architecture.static.test.ts` NIE jest zmieniany.

**Konwencje komend:** testy `npx vitest run <ścieżka>`, typy `npx tsc --noEmit`, lint `npm run lint`, build `npm run build`. Commity kończą się linią `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; hook `lint-staged` formatuje prettierem.

## Podział ról (orkiestracja)

| Kto                                      | Robi                                                                                         |
| ---------------------------------------- | -------------------------------------------------------------------------------------------- |
| Claude Code (orkiestrator)               | plan, zlecenia, `git diff --stat`, decyzje, **wszystkie commity**                            |
| `cursor` (`--role task`, `--tier light`) | edycje wg zadań; testy/tsc/lint/build z odpowiedzią „przeszło” albo `plik:linia + przyczyna` |
| `agy` (`--role review`)                  | niezależny review diffa po Task 5 (tylko odczyt); `AGY_DEEP_TAG=Hydrogen` albo Flash         |

Jedno zadanie = jedno zlecenie Cursora (`--fresh` przy nowym obszarze, `--keep` przy poprawkach); **nie commituje**. Zadania dopisują do `resources.ts` i `index.ts` — **wykonuj po kolei**, nigdy równolegle. Po zleceniu: `git diff --stat`, testy zadania, `npx tsc --noEmit`, commit orkiestratora. Cursor uruchamia komendy **bez pipe'ów** (poza `2>&1`). Cursor bywa, że gubi cudzysłowy `”` i literały bez ogonków oraz wychodzi poza zakres: po każdym zleceniu sprawdzam diff skryptem (`grep` po starych literałach) i `git diff --stat`.

## Rozstrzygnięcia planu (względem specu)

1. **Zakres.** Etap 5 obejmuje to, co po etapach 1–4 ma jeszcze teksty na sztywno (sprawdzone grepem po `src/`): `src/features/arsenal/` (7 plików), `src/features/map/` (9 plików z tekstami widocznymi dla użytkownika), `src/features/codex/` (12), `src/features/notes/` (8), `src/components/note-editor/` (2), `src/components/theme/ThemeToggle.tsx`. **Zasoby i Płótno (tablica, mapy myśli) są już zrobione w etapie 4** (namespace `resources`, `planning`, `mindmaps`): tu bez zmian. Kalendarz, zadania, Projekty i Kokpit bez zmian.
2. **Cztery namespace'y:** `arsenal`, `map`, `codex`, `notes`. Edytor notatek (`NoteEditor*`) idzie do `notes` z prefiksem `editor` (używa go też `MindMapNotesPanel`, ale to ten sam edytor, jeden zestaw etykiet). `ThemeToggle` dostaje klucze w `common` (`theme.toLight`, `theme.toDark`), bo to element powłoki, który w etapie 1 został pominięty.
3. **Klucze płaskie** z prefiksem obszaru: `arsenal*` (np. `arsenalClearFilters`), `map*`, `codex*`, `notes*`, `editor*` (w `notes`). Wartość PL = dotychczasowy tekst dosłownie, EN = naturalne tłumaczenie. Cursor wypisuje listę nowych kluczy w odpowiedzi. Placeholdery `{{x}}`.
4. **Czyste funkcje z tekstem** (`buildMapTiles`, `noteMeta` kafle, `clusterLabel` w `MapNodeList`, `codexFilters` ostrzeżenia, `arsenalFilters`): dostają **opcjonalny** parametr `lang: Lang = currentLang()` i wołają `i18n.t(key, { lng: lang })`; istniejące testy, które nie podają języka, przechodzą bez zmian (start w PL). Komponent renderujący taką funkcję woła `useT()` (subskrypcja na zmianę języka).
5. **Dane z repozytorium i vaulta nie są tłumaczone** (J2): etykiety skupisk (`cluster.label`), tytuły i ścieżki notatek, treść skilli i promptów, identyfikatory reguł i treść reguł Kodeksu, komunikaty błędów z API (`body.error`), nazwy sekcji bugów (`"Zamknięte"` jako wartość danych z `bugs.md`, `projectTiles.ts`, `ProjectBugs.tsx`: bez zmian). Tłumaczymy tylko własne teksty interfejsu i klienckie komunikaty zastępcze (`"Błąd"`, `"Błąd ${status}"`, `"Nieprawidłowa odpowiedź …"`): wołane przez `i18n.t` w chwili rzucenia wyjątku, stan zapisany jako gotowy tekst zostaje w języku powstania (jak w etapach 2–3).
6. **Szablon Kodeksu (`codexTemplate.ts`) i instrukcja `NEXUS_VAULT_PATH`** w `CodexStates.tsx` to treść kopiowana do schowka i wklejana do pliku w vaulcie: **zostają po polsku** (to zawartość pliku NEXUS, nie interfejs). Tłumaczymy otaczające je etykiety i opisy.
7. **Eksport HTML map myśli** (`mindMapExportTemplate.ts`) poza zakresem (bez zmian, jak w etapie 4).
8. **Mapa: canvas i globus.** `Globe.tsx` rysuje `ctx.fillText(...)` z tekstem `(wkrótce)` i ma `aria-label` z instrukcją klawiszy: wołają `i18n.t` w chwili rysowania/renderu; komponent `Globe` woła `useT()`, żeby przerenderować się przy zmianie języka. Etykiety klas połączeń (`EDGE_CLASSES[].label`) zamieniamy na `labelKey` (np. `map:edge.kkSame`) i tłumaczymy w `MapView` (`t(c.labelKey)`); `tests/unit/features/map/edgeColors.test.ts` nie sprawdza `label` (sprawdzone), więc bez zmian.
9. **Daty.** `NotesPanel` (`toLocaleDateString()`, `toLocaleString("pl-PL", …)`) i `CodexView` (`toLocaleString("pl-PL", …)`, `toLocaleTimeString("pl-PL")`) przechodzą na `format.ts`: nowe `formatShortDateTime` (`dateStyle: "short"`, `timeStyle: "short"`) i `formatFullDateTime` (`dateStyle: "full"`, `timeStyle: "medium"`) w Task 1; stała data tworzenia notatki w liście → `formatShortDate`; „teraz” w komunikacie odświeżenia → `formatTimeSeconds`. Sortowanie `localeCompare(…, "pl")` (nexusTree, arsenalFilters) zostaje (porządek danych, nie tekst UI).
10. **Plural (J7)** tam, gdzie jest licznik z rzeczownikiem: `{ruleCount} reguła/reguł` (`codexRuleCount_*`), `uszkodzoną linię/uszkodzone linie` (`codexSkippedLines_*`), `{{total}} wpisów` (`arsenalEntriesCount_*`), `{{count}} słów` (`notesWordCount_*`), `{{n}} połączeń/notatek/skupisk` w `aria-label` globusa (`mapGlobeAria` z trzema licznikami: jedna interpolowana fraza, bez plural: dopuszczalne przybliżenie, jak podtytuł zadań w etapie 4). Pozostałe liczniki bez rzeczownika bez plural.
11. **Testy.** Istniejące testy startują w PL i przechodzą **bez zmian**, z jednym dozwolonym wyjątkiem, **zawsze w tym samym commicie co komponent**: asercje utrwalające błędną odmianę lub angielski fallback poprawione na wartość słownika PL. **Każdą taką poprawkę Cursor wypisuje z `plik:linia`, a ja ją zatwierdzam** przed commitem. Test architektury nietknięty.
12. **Nowe testy EN:** dla czystych funkcji osobne `it` obok testów; dla komponentów `tests/unit/features/<obszar>/<Komponent>.en.test.tsx` (wzór: `tests/unit/features/projects/ProjectsView.en.test.tsx`).
13. **Gałąź** `feat/jezyk-pl-en-etap-5` istnieje (z `main` po PR #70); Task 0 = commit planu.

---

## Mapa plików

| Plik                                                                                                                                                                  | Zmiana                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `src/i18n/format.ts`                                                                                                                                                  | + `formatShortDateTime`, `formatFullDateTime`  |
| `src/i18n/resources.ts`, `src/i18n/index.ts` (`ns`)                                                                                                                   | + `arsenal`, `map`, `codex`, `notes`           |
| `src/i18n/locales/{pl,en}/{arsenal,map,codex,notes}.ts` (nowe), `common.ts` (`theme.*`)                                                                               | słowniki                                       |
| `src/components/theme/ThemeToggle.tsx`                                                                                                                                | `useT`, klucze `common:theme.*`                |
| `src/features/arsenal/{ArsenalSkillsView,ArsenalDetail,ArsenalFilterBar,DeployPanel,CopyButton,useArsenal}.ts(x)`, `arsenalFilters.ts`                                | `useT` / `i18n.t`                              |
| `src/features/map/{MapView,MapClusterPanel,MapBlockersPanel,MapAgentsPanel,MapNodeList,GlobeControls,Globe}.tsx`, `{mapTiles,edgeColors,useMapGraph,useMapAgents}.ts` | `useT` / `i18n.t`; `labelKey` w `EDGE_CLASSES` |
| `src/features/codex/{CodexView,CodexRules,CodexToc,CodexAlerts,CodexStates,ChecklistPanel,CodexToast,CodexIcons}.tsx`, `{codexFilters,useCodex,useChecklistRun}.ts`   | `useT` / `i18n.t`; daty przez `format.ts`      |
| `src/features/notes/{NotesPanel,NexusDocsSection,NexusDocView}.tsx`, `{noteMeta,nexusTree,useNexusDocs,nexusLinks}.ts`                                                | `useT` / `i18n.t`; daty przez `format.ts`      |
| `src/components/note-editor/{NoteEditor,NoteEditorToolbar}.tsx`                                                                                                       | `useT`, klucze `notes:editor*`                 |
| testy EN (nowe): `tests/unit/features/{arsenal,map,codex,notes}/*.en.test.tsx`, `tests/unit/components/theme/ThemeToggle.en.test.tsx`                                 | nowe pliki                                     |

Bez zmian: `contexts/bc_*`, `lib/*`, `app/api/*`, `tests/unit/architecture.static.test.ts`, `mindMapExportTemplate.ts`, `codexTemplate.ts` (rozstrzygnięcie 6), Planowanie, Projekty, Kokpit.

---

## Task 0: Gałąź i baza (orkiestrator)

- [ ] **Step 1: Sprawdź gałąź**

Run: `git branch --show-current && git status --short`
Expected: `feat/jezyk-pl-en-etap-5`, czysto lub tylko ten plan.

- [ ] **Step 2: Zacommituj plan**

```bash
git add docs/superpowers/plans/2026-11-15-jezyk-pl-en-etap-5.md
git commit -m "docs(i18n): plan etapu 5 języka PL/EN (Arsenał, Mapa, Kodeks, Notatki)"
```

(z linią `Co-Authored-By`).

---

## Task 1: Formatery dat i `ThemeToggle` (Cursor, TDD)

**Files:**

- Modify: `src/i18n/format.ts`, `src/i18n/locales/{pl,en}/common.ts`, `src/components/theme/ThemeToggle.tsx`
- Test: `tests/unit/i18n/format.test.ts` (dopisz `describe`), `tests/unit/components/theme/ThemeToggle.en.test.tsx` (nowy; istniejący test ThemeToggle bez zmian)

- [ ] **Step 1: Czerwone testy** (dopisz na końcu `tests/unit/i18n/format.test.ts`; importy `formatShortDateTime`, `formatFullDateTime` dodaj do istniejącego importu z `@/src/i18n/format`)

```ts
describe("formatery Notatek i Kodeksu", () => {
  const d = new Date(2026, 10, 15, 9, 5, 30); // niedziela 15.11.2026, czas lokalny
  const norm = (s: string) => s.replace(/\s/g, " ");

  test("formatShortDateTime", () => {
    expect(norm(formatShortDateTime(d, "pl"))).toBe("15.11.2026, 09:05");
    expect(norm(formatShortDateTime(d, "en"))).toBe("11/15/26, 9:05 AM");
  });
  test("formatFullDateTime", () => {
    expect(norm(formatFullDateTime(d, "pl"))).toContain("niedziela, 15 listopada 2026");
    expect(norm(formatFullDateTime(d, "pl"))).toContain("09:05:30");
    expect(norm(formatFullDateTime(d, "en"))).toContain("Sunday, November 15, 2026");
    expect(norm(formatFullDateTime(d, "en"))).toContain("9:05:30 AM");
  });
});
```

`ThemeToggle.en.test.tsx`: wzór `tests/unit/features/projects/ProjectsView.en.test.tsx`; `setLanguage("en")`, motyw ciemny → `aria-label` „Switch to light theme”, jasny → „Switch to dark theme”; po powrocie do `pl` „Włącz tryb jasny” / „Włącz tryb ciemny”.

- [ ] **Step 2: Uruchom, ma pęknąć**

Run: `npx vitest run tests/unit/i18n/format.test.ts tests/unit/components/theme`
Expected: FAIL (brak eksportów, `aria-label` po polsku w EN).

- [ ] **Step 3: Implementacja**

`format.ts` (dopisz; tę samą konwencję `LOCALE[lang]` i `lang: Lang = currentLang()` co istniejące funkcje):

```ts
/** Data i godzina krótko: „15.11.2026, 09:05” / „11/15/26, 9:05 AM”. */
export function formatShortDateTime(date: Date, lang: Lang = currentLang()): string {
  return new Intl.DateTimeFormat(LOCALE[lang], { dateStyle: "short", timeStyle: "short" }).format(
    date
  );
}

/** Pełna data i godzina z sekundami (stan pliku Kodeksu). */
export function formatFullDateTime(date: Date, lang: Lang = currentLang()): string {
  return new Intl.DateTimeFormat(LOCALE[lang], { dateStyle: "full", timeStyle: "medium" }).format(
    date
  );
}
```

`common.ts`: `theme: { toLight: "Włącz tryb jasny", toDark: "Włącz tryb ciemny" }` (PL), `{ toLight: "Switch to light theme", toDark: "Switch to dark theme" }` (EN). `ThemeToggle.tsx`: `const t = useT()`; `aria-label={theme === "dark" ? t("common:theme.toLight") : t("common:theme.toDark")}`.

- [ ] **Step 4: Testy zielone**

Run: `npx vitest run tests/unit/i18n tests/unit/components/theme` + `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit:** `feat(i18n): formatery daty z godziną; przełącznik motywu w PL/EN`.

---

## Task 2: Arsenał (Cursor, `--fresh`)

**Files:**

- Create: `src/i18n/locales/{pl,en}/arsenal.ts`
- Modify: `src/i18n/resources.ts`, `src/i18n/index.ts` (`ns` + `"arsenal"`), `src/features/arsenal/{ArsenalSkillsView,ArsenalDetail,ArsenalFilterBar,DeployPanel,CopyButton}.tsx`, `src/features/arsenal/useArsenal.ts`
- Test: istniejące `tests/unit/features/arsenal/*` (bez zmian), nowy `ArsenalSkillsView.en.test.tsx`, `DeployPanel.en.test.tsx`

**Zasady:**

- Teksty do przeniesienia (pełna lista z grepa; Cursor dopisuje te, których tu brakuje, z tym samym prefiksem): „Brak projektów w rejestrze.”, „Wdrażanie do projektu”, „Projekt docelowy”, „Tryb”, „W całości (polecenie skryptu)”, „Oznacz jako wdrożone”, „niewdrożone nigdzie”, „Wyczyść filtry”, „Szukaj skilla lub promptu…”, „Wszystkie projekty”, „Wszystkie modele”, „Projekt”, „Model”, „Plik”, „Pochodzenie”, „Projekty”, „Treść”, „Kopiuj”, „Kopiuj wywołanie”, „Kopiuj prompt”, „Kopiuj treść”, „Szablony”, „Brak szablonów.”, „Wdrożenia”, „Niewdrożone nigdzie.”, „Brak wpisów dla tych filtrów.”, „Ładowanie”, „Statystyki arsenału”, „Skille”, „Prompty”, „dokumenty skilli w Vaulcie”, „z Bazy wiedzy, bez przenoszenia”, „skille bez znacznika wdrożenia”, „niewdrożony”, „wdrożony w N”, „pominięto N (uszkodzone lub nieznane wdrożenia)”, „Alt+7 · Arsenał”, `MODE_LABEL` („w całości” / „zredagowany”), „Szczegóły wpisu”, „Błąd”, „Błąd N”, „Zapisano, ale nie udało się odświeżyć listy: …”.
- `„Alt+7 · Arsenał”`: etykieta karty z `shell` (`shell:cards.arsenal`, jeśli istnieje; wtedy `Alt+7 · ` + nazwa) zamiast nowego klucza.
- `{a.total} wpisów` → `arsenalEntriesCount_one/_few/_many/_other` (PL) i `_one/_other` (EN).
- `MODE_LABEL` → funkcja `modeLabel(mode, t)` albo mapa kluczy (`arsenal:modeFull`, `arsenal:modeAdapted`); komunikaty `messageOf` w `useArsenal.ts` przez `i18n.t("arsenal:errorGeneric")`, `i18n.t("arsenal:errorStatus", { status })`, `i18n.t("arsenal:refreshFailed", { message })`.
- Tekst skilli i promptów (`entry.body`, `entry.title`) bez zmian (rozstrzygnięcie 5). `arsenalFilters.ts`: tylko normalizacja i sortowanie, bez tekstów UI (bez zmian).

- [ ] **Step 1: Czerwone testy EN.** `ArsenalSkillsView.en.test.tsx`: `setLanguage("en")`, render widoku z jednym skillem niewdrożonym: widać „Skills”, „Prompts”, „Not deployed anywhere”, przycisk „Copy”, `1 entry` (plural `one`); po `pl`: „Skille”, „Prompty”, „Niewdrożone nigdzie”, „1 wpis”. `DeployPanel.en.test.tsx`: nagłówek „Deploy to project”, legenda „Mode”, „Mark as deployed”; pusty rejestr „No projects in the registry.”.
- [ ] **Step 2: Uruchom, ma pęknąć:** `npx vitest run tests/unit/features/arsenal` → FAIL tylko nowe testy.
- [ ] **Step 3: Implementacja** wg zasad; rejestracja namespace w `resources.ts` i `index.ts`.
- [ ] **Step 4: Testy:** `npx vitest run tests/unit/features/arsenal tests/unit/i18n` + `npx tsc --noEmit` → PASS (parytet kluczy PL/EN włącznie).
- [ ] **Step 5: Sweep:** `grep -rnE "[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]" src/features/arsenal --include=*.tsx --include=*.ts` → w wynikach zostają tylko komentarze i normalizacja w `arsenalFilters.ts` (`/ł/g`).
- [ ] **Step 6: Commit:** `feat(i18n): Arsenał w PL/EN (namespace arsenal, plural)`.

---

## Task 3: Mapa (Cursor, `--fresh`)

**Files:**

- Create: `src/i18n/locales/{pl,en}/map.ts`
- Modify: `src/i18n/resources.ts`, `src/i18n/index.ts` (`ns` + `"map"`), `src/features/map/{MapView,MapClusterPanel,MapBlockersPanel,MapAgentsPanel,MapNodeList,GlobeControls,Globe}.tsx`, `{mapTiles,edgeColors,useMapGraph}.ts`
- Test: istniejące `tests/unit/features/map/*` (bez zmian), nowe `MapNodeList.en.test.tsx`, `MapBlockersPanel.en.test.tsx`, `GlobeControls.en.test.tsx`; dopisz `it` EN w `mapTiles.test.ts`

**Zasady (rozstrzygnięcie 8):**

- `buildMapTiles(graph, agents, lang = currentLang())`: etykiety i `meta` przez `i18n.t("map:tile…", { lng: lang })`; fragmenty `Wiedza`/`AI-2030`/`w projektach` w `meta` neuronów: klucz `mapTileNeuronsMeta` z interpolacją `{{knowledge}}`, `{{ai2030}}`, `{{projects}}`. „—” zostaje literałem (to wartość, nie tekst).
- `MapNodeList.tsx`: czysta funkcja etykiety skupiska (`cluster.soon` → `map:clusterSoon` z `{{label}}`) woła `i18n.t`; komponent `useT()`.
- `EDGE_CLASSES[].label` → `labelKey` (`map:edge.kkSame`, `kkCross`, `kp`, `kField`, `ppSame`, `ppCross`, `ka`, `pa`, `aa`); w `MapView` legenda: `t(c.labelKey)`. Nazwa „AI-2030” zostaje literałem w obu językach; strzałki `↔`/`→` w obu językach te same.
- `Globe.tsx`: `ctx.fillText(c.soon ? i18n.t("map:clusterSoon", { label: c.label }) : c.label, …)`; `aria-label` globusa (`map:globeAria`) z `useT()`. `MapView`: `ariaLabel` globusa z liczbami (`map:globeSummaryAria` z `{{clusters}}`, `{{notes}}`, `{{edges}}`), „Mapa nie wczytana”, „Sieć NEXUS: projekty, wiedza i agenci.”, „Legenda kolorów połączeń”, „Ostrzeżenia”, podpowiedź o najechaniu/kliknięciu i „Skille: wkrótce, bez powiązań.”.
- `GlobeControls`: „Powiększenie”, „Przybliż” / „Przybliż (+)”, „Oddal” / „Oddal (−)”, „Dopasuj do okna” / „Dopasuj do okna (0)”.
- Panele: „Kontynent wkrótce: bez notatek i powiązań.”, „Powiązania: N”, „wkrótce”, „Radar blokad”, „Blokery pojawią się, gdy pliki bugs.md dostaną pole blokera. Do tego czasu radar jest pusty.”, „Odśwież stan”, „Herdr niedostępny”, „Brak aktywnych agentów”. `useMapGraph.ts`: błąd klienta „Nieprawidłowa odpowiedź /api/map/graph” → `i18n.t("map:invalidResponse", { path: "/api/map/graph" })`.
- Pliki bez tekstów UI (`core.ts`, `motion.ts`, `relief.ts`, `globeMath.ts`, `sparks.ts`, `selection.ts`): polskie litery tylko w komentarzach, **nie ruszamy**.

- [ ] **Step 1: Czerwone testy EN:** `MapNodeList.en.test.tsx` (skupisko `soon` → „Label (soon)”), `MapBlockersPanel.en.test.tsx` („Blocker radar”, chip „soon”), `GlobeControls.en.test.tsx` (`aria-label` „Zoom in”/„Zoom out”/„Fit to window”), `mapTiles.test.ts`: `buildMapTiles(graph, agents, "en")` → etykiety „NEXUS neurons”, „Dependencies”, „Active blockers”, „Live agents”, `meta` „Herdr unavailable” przy `available: false`.
- [ ] **Step 2: Uruchom, ma pęknąć:** `npx vitest run tests/unit/features/map` → FAIL tylko nowe `it`.
- [ ] **Step 3: Implementacja** wg zasad.
- [ ] **Step 4: Testy:** `npx vitest run tests/unit/features/map tests/unit/i18n` + `npx tsc --noEmit` → PASS.
- [ ] **Step 5: Sweep:** grep po `src/features/map` (komentarze pomijamy) → brak literałów w `.tsx`/`mapTiles.ts`/`edgeColors.ts`/`useMapGraph.ts`.
- [ ] **Step 6: Commit:** `feat(i18n): Mapa w PL/EN (namespace map)`.

---

## Task 4: Kodeks (Cursor, `--fresh`)

**Files:**

- Create: `src/i18n/locales/{pl,en}/codex.ts`
- Modify: `src/i18n/resources.ts`, `src/i18n/index.ts` (`ns` + `"codex"`), `src/features/codex/{CodexView,CodexRules,CodexToc,CodexAlerts,CodexStates,ChecklistPanel}.tsx`, `{codexFilters,useCodex,useChecklistRun}.ts`
- Test: istniejące `tests/unit/features/codex/*` (bez zmian), nowe `CodexView.en.test.tsx`; dopisz `it` EN w `codexFilters.test.ts`

**Zasady (rozstrzygnięcia 5, 6, 9, 10):**

- `codexFilters.ts` (ostrzeżenia parsera): funkcje budujące `tag`/`text` dostają `lang = currentLang()` i `i18n.t`; „uszkodzoną linię/uszkodzone linie” → `codexSkippedLines_*` (PL: one/few/many/other; EN: one/other) z `{{count}}` i `{{file}}`; tagi „Zduplikowany identyfikator”, „Brakująca reguła”, „Dziennik zdarzeń”; „Ostatnia linia {{file}} nie jest dokończona; zignorowano ją do czasu dopisania końca linii.”
- `CodexRules.tsx`: „Szukaj reguły po ID (np. TDD-1) lub tekście...” (EN: „Search rules by ID (e.g. TDD-1) or text...”), „Wyszukiwanie reguł”, „Filtr poziomu reguł”, „Brak reguł dla filtra”, `{{count}} reguła/reguł` → `codexRuleCount_*`, `Kotwica do reguły {{id}}`, „Reguły kodeksu”.
- `CodexView.tsx`: kafle „Reguły kodeksu”, „Dziennik zdarzeń”, „Ostrzeżenia parsera (nieblokujące)”, „Tylko do odczytu”, opis „Czytnik reguł normatywnych `<code>Vault/Knowledge/kodeks.md</code>` i interaktywne checklisty zadań” (z `Trans` albo rozbity na klucze przed i po `<code>`: wybór Cursora, bez nowej zależności), „Odśwież mtime”, „Kopiuj ścieżkę”, toasty: „Przewinięto do reguły #{{id}}”, „Nie udało się skopiować do schowka”, „Nie udało się odświeżyć kodeksu”, „Odświeżono: plik kodeksu się zmienił”, „Odświeżono stan mtime: plik aktualny ({{time}})” z `formatTimeSeconds(new Date())`, „Skopiowano ścieżkę: Vault/Knowledge/kodeks.md” (ścieżka w treści zostaje). `formatMtime` → `formatFullDateTime(new Date(ms))`.
- `CodexToc.tsx`: „Spis treści kodeksu”, „Spis treści”, „Plik źródłowy:”, „Powiązanie:”, „Parser:” + „wzorzec reguły ze specu (§4.1)”.
- `CodexAlerts.tsx`: „Ostrzeżenia parsera kodeksu”, „Ostrzeżenia diagnostyczne (parsowanie poprawne, czytanie kontynuowane)”.
- `CodexStates.tsx`: tytuł „Brak pliku kodeksu inżynierskiego”, opis z `<code>Vault/{path}</code>`, „Kopiuj instrukcję utworzenia”, „Błąd konfiguracji: brak NEXUS_VAULT_PATH”, „Sprawdź połączenie ponownie”. **Treść instrukcji i szablonu kopiowanego do schowka zostaje po polsku** (rozstrzygnięcie 6).
- `ChecklistPanel.tsx`: „Brak reguły w rejestrze”, „Dodaj jednolinijkową notatkę...”, „Sekcja checklist operacyjnych”, „Rejestracja zdarzeń w formacie append-only `.jsonl`”, „Wybór checklisty”, „Kontekst zadania i prywatność:”, „[Dane z firmy] Zapis kierowany wyłącznie do strefy `{{file}}` ignorowanej przez git (§4.3 specu). Notatki i opisy nie trafią do repozytorium.”, „Opis zadania”, „Opis zadania (zapisany przy pierwszej interakcji)”, „Postęp: N z M odhaczone”, „Brak definicji ID”, „Zapisz sesję”, toasty („Zarejestrowano zdarzenie toggle: ukończono/cofnięto punkt”, „Dopisano notatkę punktu do dziennika zdarzeń (append-only)”, „Zapisano sesję: uruchomienie zamknięte w dzienniku .jsonl”). Nazwy checklist i punktów to dane (bez zmian).
- Hooki `useCodex.ts`, `useChecklistRun.ts`: tak jak w Arsenale (rozstrzygnięcie 5), klucze `codex:errorGeneric`, `codex:errorStatus`, `codex:invalidResponse`.

- [ ] **Step 1: Czerwone testy EN:** `CodexView.en.test.tsx` (wzór: istniejący `CodexView.test.tsx`; `setLanguage("en")`: „Codex rules”, „Event log”, „Read only”, „Refresh mtime”, pole wyszukiwania `Search rules by ID`, `1 rule` / `2 rules`); `codexFilters.test.ts`: ostrzeżenie o uszkodzonych liniach w EN („1 corrupted line”, „2 corrupted lines”) i w PL („1 uszkodzoną linię”, „2 uszkodzone linie”, „5 uszkodzonych linii”).
- [ ] **Step 2: Uruchom, ma pęknąć:** `npx vitest run tests/unit/features/codex` → FAIL tylko nowe testy.
- [ ] **Step 3: Implementacja** wg zasad.
- [ ] **Step 4: Testy:** `npx vitest run tests/unit/features/codex tests/unit/i18n` + `npx tsc --noEmit` → PASS.
- [ ] **Step 5: Sweep:** grep po `src/features/codex` → zostają komentarze, `codexTemplate.ts`, treść instrukcji w `CodexStates.tsx` (rozstrzygnięcie 6) i `/ł/g` w normalizacji.
- [ ] **Step 6: Commit:** `feat(i18n): Kodeks w PL/EN (namespace codex, plural)`.

---

## Task 5: Notatki i edytor notatek (Cursor, `--fresh`)

**Files:**

- Create: `src/i18n/locales/{pl,en}/notes.ts`
- Modify: `src/i18n/resources.ts`, `src/i18n/index.ts` (`ns` + `"notes"`), `src/features/notes/{NotesPanel,NexusDocsSection,NexusDocView}.tsx`, `{noteMeta,useNexusDocs}.ts`, `src/components/note-editor/{NoteEditor,NoteEditorToolbar}.tsx`
- Test: istniejące `tests/unit/features/notes/*`, `tests/unit/components/note-editor/*` (bez zmian), nowe `NotesPanel.en.test.tsx`, `NexusDocsSection.en.test.tsx`; dopisz `it` EN w `noteMeta.test.ts`

**Zasady:**

- `NotesPanel` nadal dostaje napisy akcji w propsach (`newNote`, `noteEdit`, `saveNote`, `deleteNote`, `noteCancelEdit`, `noteTitlePlaceholder`, `noteContentPlaceholder`): budowane z `t("planning:…")` w `PlanowanieView` (już zrobione w etapie 4); tu **tylko wewnętrzne** teksty panelu: „Pliki · Markdown”, „Szukaj notatki…”, „Filtruj notatki”, „Brak wyników”, „Brak tagów we frontmatterze”, „edycja”/„podgląd”, „Podgląd”, „Markdown”, „Szczegóły i powiązania notatki”, „Metadane · plik”, „Ścieżka”, „Obszar”, „Tagi”, „Utworzono”, „Rozmiar”, `{{count}} słów` (`notesWordCount_*`), „Wybierz notatkę”, „Linki zwrotne”, „Wkrótce: indeks linków [[wiki]] między notatkami”, „wkrótce”, „Baza decyzji · devlogi”, „Szukaj decyzji we wszystkich devlogach…”, „Szukaj decyzji”, „Wymaga agregacji devlogów wszystkich projektów”.
- Daty: `created_at` w liście → `formatShortDate`, w metadanych → `formatShortDateTime` (rozstrzygnięcie 9). `formatSize` (`B`/`KB`) zostaje (jednostki bez tłumaczenia).
- `noteMeta.ts` (kafle): `buildNoteTiles(…, lang = currentLang())`: „Notatki w bazie”, „katalog Notes/”, „Dodane dziś” + `todayMeta`, „Decyzje w devlogach”, „wkrótce: agregacja devlogów”, kafel Inboxu (Cursor czyta cały plik i przenosi pozostałe teksty z tą samą zasadą).
- `NexusDocsSection.tsx`: „Baza wiedzy NEXUS · tylko odczyt”, „Szukaj w bazie NEXUS…”, „Filtruj bazę NEXUS”, „Brak dokumentów NEXUS”, „Brak wyników”; `NexusDocView.tsx`: „Podgląd”; `useNexusDocs.ts`: `LIST_ERROR`, `DOC_ERROR` → `i18n.t("notes:nexusListError")`, `i18n.t("notes:nexusDocError")` w chwili rzucenia/ustawienia (stałe na poziomie modułu zamieniamy na funkcje, bo moduł ładuje się przed zmianą języka). „NEXUS” jako nazwa własna zostaje literałem.
- Edytor (`notes:editor*`): „Kolor tekstu”, „Domyślny”, „Pogrubienie”, „Kursywa”, „Podkreślenie”, „Przekreślenie”, „Wyrównaj do lewej”, „Wyśrodkuj”, „Wyrównaj do prawej”, „Justowanie”, „Rozmiar czcionki”, „Rozmiar”, „Czcionka”; `NoteEditorToolbar` ma stałą tablicę czcionek (`Sans`, `Serif`, `Mono`): nazwy zostają (nazwy rodzin). Placeholder `NoteEditor` przychodzi z propsa (bez zmian). `MindMapNotesPanel` używa tego edytora: bez zmian, dostaje etykiety z `useT()` w toolbarze.

- [ ] **Step 1: Czerwone testy EN:** `NotesPanel.en.test.tsx` (wzór: istniejący `NotesPanel.test.tsx`; `setLanguage("en")`: „Filter notes”, „Select a note”, „Created”, „Size”, `2 words`/`1 word` przy wybranej notatce, data utworzenia w formacie US); `NexusDocsSection.en.test.tsx` („NEXUS knowledge base · read-only”, „No NEXUS documents”); `noteMeta.test.ts`: kafle w EN („Notes in the base”, „Added today”, „Decisions in devlogs”).
- [ ] **Step 2: Uruchom, ma pęknąć:** `npx vitest run tests/unit/features/notes tests/unit/components/note-editor` → FAIL tylko nowe testy.
- [ ] **Step 3: Implementacja** wg zasad.
- [ ] **Step 4: Testy:** `npx vitest run tests/unit/features/notes tests/unit/components tests/unit/features/planowanie tests/unit/i18n` + `npx tsc --noEmit` → PASS.
- [ ] **Step 5: Sweep:** grep po `src/features/notes` i `src/components/note-editor` → zostają komentarze i `localeCompare(…, "pl")` w `nexusTree.ts` (rozstrzygnięcie 9).
- [ ] **Step 6: Commit:** `feat(i18n): Notatki, baza NEXUS i edytor w PL/EN (namespace notes, plural)`.

---

## Task 6: Review i weryfikacja końcowa

- [ ] **Step 1: Sweep po całym `src/`** (orkiestrator): `grep -rnE "[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]" src app --include=*.tsx --include=*.ts` z odfiltrowaniem komentarzy i `src/i18n/locales`: w wynikach mają zostać wyłącznie wyjątki z rozstrzygnięć (5, 6, 7, 9) i dane (`"Zamknięte"`, `"myśl"`). Osobno `grep -rnE "(aria-label|title|placeholder|alt)=\"[A-Za-z]" src --include=*.tsx` na angielskie literały.
- [ ] **Step 2: Review diffa (agy, `--role review`, tylko odczyt).** Prośba: niezależny review `git diff main...HEAD` pod kątem (1) kluczy użytych w kodzie, których nie ma w słownikach PL/EN, (2) pozostałych twardych tekstów PL/EN w plikach etapu 5 (w tym bez polskich liter, np. `"Copy"`, `"Loading…"`), (3) komponentów, które po zmianie nie subskrybują języka (czysta funkcja woła `i18n.t` w renderze, a komponent nie woła `useT()`; stałe modułowe z tekstem), (4) regresji gramatyki PL w plural, (5) zmienionych asercji testów. Format: `plik:linia + przyczyna`.
- [ ] **Step 3: Weryfikacja każdej uwagi w kodzie** (opinie to hipotezy), poprawki własne lub małe `--role task`, osobne commity.
- [ ] **Step 4: Pełna weryfikacja (Cursor, `--approve-allowed`):** `npx tsc --noEmit`, `npx vitest run`, `npm run lint`, `npm run build`, każde osobno, bez pipe'ów.
- [ ] **Step 5: Oględziny w przeglądarce** (`npm run dev`, przełącznik PL/EN na kartach Arsenał, Mapa, Kodeks, Notatki; edytor notatki; przełącznik motywu).
- [ ] **Step 6: Push i PR** (po decyzji użytkownika): `feat(i18n): język PL/EN, etap 5 (Arsenał, Mapa, Kodeks, Notatki)`; opis jak w PR #68–#70; „To ostatni etap: w repo nie zostaje widoczny dla użytkownika tekst poza słownikami `src/i18n/locales`”.

---

## Self-review

- **Pokrycie specu (§4 pkt 5):** Arsenał → Task 2; Mapa → Task 3; Kodeks → Task 4; Notatki (z edytorem i bazą NEXUS) → Task 5; Zasoby i Płótno → zrobione w etapie 4 (rozstrzygnięcie 1); `toLocale…` w `NotesPanel` i `CodexView` (zostawione w etapie 4) → Task 1 + Task 4, 5; pominięty w etapie 1 `ThemeToggle` → Task 1.
- **Placeholdery w planie:** brak „TBD”; listy tekstów wynikają z grepa, a miejsca, gdzie lista wynika z czytania pliku (kafel Inboxu w `noteMeta.ts`, pozostałe literały), mają regułę nazewnictwa, wartość PL „dosłownie” i sprawdzian grep w kroku Sweep.
- **Spójność nazw:** `formatShortDateTime`, `formatFullDateTime` (Task 1) używane w Task 4, 5; `formatTimeSeconds`, `formatShortDate` z etapu 4; `lang = currentLang()` jako opcjonalny ostatni parametr czystych funkcji (`buildMapTiles`, `buildNoteTiles`, funkcje `codexFilters`) w Task 3–5; klucze `…Count_*` (plural) zgodne ze wzorcem `resourceAdded_*` z etapu 4.
- **Znane ryzyka:** (1) asercje testów na błędnej odmianie lub fallbackach: wyjątek z rozstrzygnięcia 11, zatwierdzam ręcznie; (2) twarde teksty bez polskich liter nie łapią się greppem: łapie je review agy i drugi grep w Task 6; (3) `Globe` rysuje na canvasie: zmiana języka musi wymusić przerysowanie (komponent woła `useT()`; sprawdzić w oględzinach, Task 6 Step 5); (4) `Trans`/rozbicie zdań z `<code>` w Kodeksie: wybór Cursora, ma nie dodawać zależności.
