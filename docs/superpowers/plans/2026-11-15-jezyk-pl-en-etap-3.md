# Język PL/EN: etap 3 (Projekty) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Karta Projekty w pełni tłumaczona PL/EN przez `i18next`: wszystkie teksty UI z `src/features/projects/` (16 plików `.ts`/`.tsx`, bez `projects.css`) w namespace `projects`, odmiana liczebników przez plural i18next.

**Architecture:** Fundament z etapów 1–2 (`src/i18n/`, `useT`, `useLang`, `format.ts`, `projectKind.ts`, test parytetu) bez zmian poza `resources.ts`. Dochodzi namespace `projects` (`locales/{pl,en}/projects.ts`). Komponenty: `const t = useT()`, klucze `t("projects:…")`. Czyste funkcje w `projectTiles.ts`, `packSections.ts`, nowym `projectsFormat.ts` wołają `i18n.t("projects:…")`; komponent nadrzędny subskrybuje język przez `useT()`. Etykiety rodzaju projektu w listach/selectach: `projectKindLabel()` z `src/i18n/projectKind.ts` (`common:projectKind.*`), bez duplikacji. `PACK_ROLES` z `schemas` zostaje; w UI wyświetlamy `t("projects:pack.role.<key>")`, nie pole `label` ze schematu (zakaz zmian `bc_*`). Konteksty `bc_*`, API, `src/translations.ts` bez zmian.

**Tech Stack:** Next.js 14 (klient), React 19, TypeScript (`strict: false`), `i18next` 27 + `react-i18next` 18, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-15-jezyk-pl-en-design.md` (J1–J9; §4 pkt 3 = ten etap). Wzorce: `docs/superpowers/plans/2026-11-15-jezyk-pl-en-etap-1.md`, `docs/superpowers/plans/2026-11-15-jezyk-pl-en-etap-2.md`. **Zasady repo:** `CLAUDE.md`; `tests/unit/architecture.static.test.ts` NIE jest zmieniany.

**Konwencje komend:** testy `npx vitest run <ścieżka>`, typy `npx tsc --noEmit`, lint `npm run lint`, build `npm run build`. Commity kończą się linią `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; hook `lint-staged` formatuje prettierem.

## Podział ról (orkiestracja)

| Kto                                      | Robi                                                                                         |
| ---------------------------------------- | -------------------------------------------------------------------------------------------- |
| Claude Code (orkiestrator)               | plan, zlecenia, `git diff --stat`, decyzje, **wszystkie commity**                            |
| `cursor` (`--role task`, `--tier light`) | edycje wg zadań; testy/tsc/lint/build z odpowiedzią „przeszło” albo `plik:linia + przyczyna` |
| `agy` (`--role review`, `--tier deep`)   | niezależny review diffa po Task 6 (tylko odczyt)                                             |

Jedno zadanie = jedno zlecenie Cursora (`--fresh` / `--keep`); **nie commituje**. Zadania edytują `projects.ts` (pl/en) — **wykonuj po kolei**, nigdy równolegle. Po zleceniu: `git diff --stat`, testy zadania, commit orkiestratora.

## Rozstrzygnięcia planu (względem specu)

1. **Jeden namespace `projects`** na cały `src/features/projects/`. Podgrupy w słowniku: `view`, `tiles`, `format`, `registry`, `list`, `dialog`, `links`, `saveState`, `board`, `bugs`, `devlog`, `pack`, `dossier`, `errors`, `common` (przyciski współdzielone).
2. **Polskie teksty dosłownie**; testy w `tests/unit/features/projects/` startują w PL i przechodzą **bez zmian**, z **jednym zatwierdzonym wyjątkiem**: `ProjectTasksBoard.test.tsx` L476, L487, L501 — poprawka błędnej odmiany („1 zadań”/„2 zadań”) na poprawny plural i18next; zmiana testu w **tym samym commicie** co `ProjectTasksBoard.tsx` (Task 5). Grep pozostałych 10 plików testowych: brak podobnych błędnych form plural przy „zadań/zadania”.
3. **Plural (J7)** przez `_one/_few/_many/_other` (PL) i `_one/_other` (EN). Usuwamy: `projectsWord` (`ProjectsView.tsx:~16–21`), `countLabel` (`ProjectTasksBoard.tsx:~48–56`), licznik devlogu (`ProjectDevlog.tsx:~40`), komunikaty z „N zadań” (`~141`, `~189`, `~368`). Zero → osobne klucze (`…None`).
4. **`projectKind.ts`** dla pojedynczych etykiet rodzaju (Własny/Etat/Biblioteka) w `ProjectList`, `NewProjectDialog`, `ProjectDossier`. **Osobne klucze `tiles.kindCount.*`** dla liczników w meta kafla (`własne` / `biblioteka` / `etat` — to nie to samo co `common:projectKind`).
5. **`PACK_ROLES`** w `contexts/bc_projects/schemas.ts` bez zmian; UI mapuje `key` → `projects:pack.role.<key>`.
6. **Komunikaty klienta** (`CONFLICT_MESSAGE`, `Nie wybrano projektu`, walidacja linków, schowek) → klucze; `err.message` / `readError` z API bez zmian (J2). Wartości vaulta (`section === "Zamknięte"`, `status`, nazwy plików) bez zmian.
7. **`src/translations.ts`:** grep `projekt|project` — brak martwych kluczy dotyczących karty Projekty (są tylko `tasksDetailProjectLabel`, `tasksNoProject`, placeholder w resources Planowania). **Task 7 nie usuwa nic z `translations.ts`.**
8. **Nowe testy EN:** `tests/unit/i18n/projects-format.test.ts`, `tests/unit/features/projects/ProjectsView.en.test.tsx`.
9. **Gałąź** `feat/jezyk-pl-en-etap-3` już istnieje; Task 0 = commit planu.

---

## Mapa plików

| Plik                                                                                   | Zmiana                                                                                             |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `src/i18n/resources.ts`                                                                | + `projects` w `pl` i `en`                                                                         |
| `src/i18n/locales/{pl,en}/projects.ts` (nowe)                                          | słowniki; rosną w każdym zadaniu                                                                   |
| `src/features/projects/projectsFormat.ts` (nowy)                                       | funkcje etykiet (plural, paczka, archiwizacja) → `i18n.t`                                          |
| `src/features/projects/{projectTiles,packSections}.ts`                                 | `i18n.t`, meta kafli                                                                               |
| `src/features/projects/*.tsx` (12 komponentów + `useProjects.ts`, `useContextPack.ts`) | `useT()`, `labelKey`, `projectKindLabel`                                                           |
| `src/i18n/index.ts`                                                                    | `ns` + `"projects"`                                                                                |
| testy                                                                                  | nowe EN + 3 asercje poprawione w `ProjectTasksBoard.test.tsx` (Task 5); reszta 10 plików bez zmian |

Bez zmian: `projects.css`, `mutation.ts`, `isHttpUrl.ts`, `contexts/bc_*`, `lib/*`, `app/api/*`, `src/translations.ts`, `tests/unit/architecture.static.test.ts`.

---

## Task 0: Gałąź i baza (orkiestrator)

- [ ] **Step 1: Sprawdź gałąź**

Run: `git branch --show-current && git status --short`
Expected: `feat/jezyk-pl-en-etap-3`, czysto lub tylko ten plan.

- [ ] **Step 2: Zacommituj plan**

```bash
git add docs/superpowers/plans/2026-11-15-jezyk-pl-en-etap-3.md
git commit -m "docs(i18n): plan etapu 3 języka PL/EN (Projekty)"
```

(z linią `Co-Authored-By`).

---

## Task 1: Namespace `projects`, `projectsFormat.ts`, kafle i paczka (Cursor, TDD)

**Files:**

- Modify: `src/i18n/resources.ts`, `src/i18n/index.ts` (`ns`), `src/features/projects/projectTiles.ts`, `src/features/projects/packSections.ts`
- Create: `src/i18n/locales/pl/projects.ts`, `src/i18n/locales/en/projects.ts`, `src/features/projects/projectsFormat.ts`
- Test: `tests/unit/i18n/projects-format.test.ts` (nowy); `projectTiles.test.ts`, `packSections.test.ts`, `parity.test.ts` bez zmian

- [ ] **Step 1: Czerwony test**

`tests/unit/i18n/projects-format.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { setLanguage } from "@/src/i18n";
import {
  archiveConfirmQuestion,
  archiveMovedNotice,
  columnTaskCountLabel,
  devlogEntriesLabel,
  packBudgetMeta,
  packButtonSizeSuffix,
  packTileValue,
  registryProjectsLabel,
  tokensThousandLabel,
} from "@/src/features/projects/projectsFormat";

describe("etykiety Projekty po angielsku", () => {
  test("registryProjectsLabel (plural projektów w rejestrze)", async () => {
    await setLanguage("en");
    expect(registryProjectsLabel(1)).toBe("1 project");
    expect(registryProjectsLabel(2)).toBe("2 projects");
    expect(registryProjectsLabel(5)).toBe("5 projects");
  });

  test("columnTaskCountLabel", async () => {
    await setLanguage("en");
    expect(columnTaskCountLabel("icebox", 3)).toBe("3 deferred");
    expect(columnTaskCountLabel("next", 1)).toBe("1 task");
    expect(columnTaskCountLabel("next", 2)).toBe("2 tasks");
    expect(columnTaskCountLabel("next", 5)).toBe("5 tasks");
    expect(columnTaskCountLabel("next", 22)).toBe("22 tasks");
  });

  test("devlogEntriesLabel", async () => {
    await setLanguage("en");
    expect(devlogEntriesLabel(1)).toBe("1 entry");
    expect(devlogEntriesLabel(3)).toBe("3 entries");
  });

  test("archiwizacja i paczka", async () => {
    await setLanguage("en");
    expect(archiveMovedNotice(3)).toBe("Moved 3 tasks to changelog.md");
    expect(archiveConfirmQuestion(2, 0)).toBe("Move 2 tasks to changelog.md?");
    expect(archiveConfirmQuestion(3, 1)).toBe(
      "Move 3 tasks to changelog.md (including 1 without date)?"
    );
    expect(packTileValue(3850)).toBe("3,850 tok");
    expect(packBudgetMeta(96, 4000, false)).toBe("96% of 4,000 token budget");
    expect(packBudgetMeta(96, 4000, true)).toBe("96% of 4,000 token budget · truncated");
    expect(tokensThousandLabel(3200)).toBe("~3.2k tokens");
    expect(packButtonSizeSuffix(3200)).toBe(" (~3.2k tok)");
  });
});

describe("etykiety Projekty po polsku (plural, setup PL)", () => {
  test("formatowanie tokenów PL (dosłownie jak dziś)", () => {
    expect(packTileValue(3850)).toBe("3 850 tok");
    expect(tokensThousandLabel(3200)).toBe("~3,2 tys. tokenów");
    expect(packButtonSizeSuffix(3200)).toBe(" (~3,2 tys. tok)");
  });

  test("columnTaskCountLabel", () => {
    expect(columnTaskCountLabel("next", 1)).toBe("1 zadanie");
    expect(columnTaskCountLabel("next", 2)).toBe("2 zadania");
    expect(columnTaskCountLabel("next", 5)).toBe("5 zadań");
    expect(columnTaskCountLabel("next", 22)).toBe("22 zadania");
  });

  test("registryProjectsLabel", () => {
    expect(registryProjectsLabel(22)).toBe("22 projekty");
    expect(registryProjectsLabel(12)).toBe("12 projektów");
  });
});
```

- [ ] **Step 2: Uruchom, ma być czerwono**

Run: `npx vitest run tests/unit/i18n/projects-format.test.ts`
Expected: FAIL (brak modułu / polskie funkcje inline).

- [ ] **Step 3: Słowniki `projects` (grupy `format`, `tiles`, `pack` — reszta w kolejnych taskach)**

`src/i18n/locales/pl/projects.ts` (fragment Task 1; plik eksportuje `projects` i rośnie w Task 2–6):

```ts
export const projects = {
  format: {
    registryCount_one: "{{count}} projekt",
    registryCount_few: "{{count}} projekty",
    registryCount_many: "{{count}} projektów",
    registryCount_other: "{{count}} projekty",
    tasksInColumn_one: "{{count}} zadanie",
    tasksInColumn_few: "{{count}} zadania",
    tasksInColumn_many: "{{count}} zadań",
    tasksInColumn_other: "{{count}} zadania",
    iceboxCount: "{{count}} odłożone",
    devlogEntries_one: "{{count}} wpis",
    devlogEntries_few: "{{count}} wpisy",
    devlogEntries_many: "{{count}} wpisów",
    devlogEntries_other: "{{count}} wpisy",
    archiveMoved_one: "Przeniesiono {{count}} zadanie do changelog.md",
    archiveMoved_few: "Przeniesiono {{count}} zadania do changelog.md",
    archiveMoved_many: "Przeniesiono {{count}} zadań do changelog.md",
    archiveMoved_other: "Przeniesiono {{count}} zadań do changelog.md",
    archiveConfirm_one: "Przenieść {{count}} zadanie do changelog.md{{suffix}}?",
    archiveConfirm_few: "Przenieść {{count}} zadania do changelog.md{{suffix}}?",
    archiveConfirm_many: "Przenieść {{count}} zadań do changelog.md{{suffix}}?",
    archiveConfirm_other: "Przenieść {{count}} zadań do changelog.md{{suffix}}?",
    archiveConfirmNoDate: " (w tym {{count}} bez daty)",
    nowLimit: "Limit {{limit}} zadań w kolumnie Teraz",
    doneToNow: "Ukończone zadanie nie może trafić do Teraz",
    tokensThousand: "~{{value}} tys. tokenów",
    tokensThousandShort: "~{{value}} tys. tok",
    packValue: "{{formatted}} tok",
  },
  tiles: {
    activeLabel: "Aktywne projekty",
    bugsLabel: "Aktywne bugi",
    staleLabel: "Wymaga decyzji (>14 dni)",
    packLabel: "Paczka kontekstu",
    noSelection: "wybierz projekt",
    packLoading: "składam paczkę…",
    packError: "paczka niedostępna",
    packBudget: "{{percent}}% budżetu {{budget}} tokenów",
    packTruncated: " · skrócona",
    metaFresh: "wszystko świeże",
    metaStaleMore: "{{names}} i {{rest}} więcej",
    metaNoActive: "brak aktywnych",
    metaInProject: "w projekcie {{name}}",
    kindCount: {
      wlasny: "własne",
      biblioteka: "biblioteka",
      etat: "etat",
    },
  },
  pack: {
    headerSection: "Nagłówek",
  },
};
```

`src/i18n/locales/en/projects.ts` (te same klucze):

```ts
export const projects = {
  format: {
    registryCount_one: "{{count}} project",
    registryCount_other: "{{count}} projects",
    tasksInColumn_one: "{{count}} task",
    tasksInColumn_other: "{{count}} tasks",
    iceboxCount: "{{count}} deferred",
    devlogEntries_one: "{{count}} entry",
    devlogEntries_other: "{{count}} entries",
    archiveMoved_one: "Moved {{count}} task to changelog.md",
    archiveMoved_other: "Moved {{count}} tasks to changelog.md",
    archiveConfirm_one: "Move {{count}} task to changelog.md{{suffix}}?",
    archiveConfirm_other: "Move {{count}} tasks to changelog.md{{suffix}}?",
    archiveConfirmNoDate: " (including {{count}} without date)",
    nowLimit: "Limit of {{limit}} tasks in the Now column",
    doneToNow: "A completed task cannot go to Now",
    tokensThousand: "~{{value}} tokens",
    tokensThousandShort: "~{{value}} tok",
    packValue: "{{formatted}} tok",
  },
  tiles: {
    activeLabel: "Active projects",
    bugsLabel: "Active bugs",
    staleLabel: "Needs decision (>14 days)",
    packLabel: "Context pack",
    noSelection: "select a project",
    packLoading: "building pack…",
    packError: "pack unavailable",
    packBudget: "{{percent}}% of {{budget}} token budget",
    packTruncated: " · truncated",
    metaFresh: "all fresh",
    metaStaleMore: "{{names}} and {{rest}} more",
    metaNoActive: "no active",
    metaInProject: "in project {{name}}",
    kindCount: {
      wlasny: "own",
      biblioteka: "library",
      etat: "work",
    },
  },
  pack: {
    headerSection: "Header",
  },
};
```

`src/i18n/resources.ts`: importy `projects as plProjects` / `projects as enProjects`, wpis `projects:` w `pl` i `en`.

`src/i18n/index.ts` L53: `ns: ["common", "shell", "home", "projects"]`.

- [ ] **Step 4: `projectsFormat.ts`**

Nowy plik (import `i18n`, `currentLang`, `formatTokens` z `packSections`; **bez** stałego `.replace(".", ",")` — separator zależy od języka):

```ts
import i18n from "@/src/i18n";
import { formatTokens } from "./packSections";
import type { ColumnKey } from "./ProjectTasksBoard";

export function registryProjectsLabel(count: number): string {
  return i18n.t("projects:format.registryCount", { count });
}

export function columnTaskCountLabel(column: ColumnKey, n: number): string {
  if (column === "icebox") return i18n.t("projects:format.iceboxCount", { count: n });
  return i18n.t("projects:format.tasksInColumn", { count: n });
}

export function devlogEntriesLabel(count: number): string {
  return i18n.t("projects:format.devlogEntries", { count });
}

export function archiveMovedNotice(count: number): string {
  return i18n.t("projects:format.archiveMoved", { count });
}

export function archiveConfirmQuestion(count: number, noDate: number): string {
  const suffix =
    noDate > 0 ? i18n.t("projects:format.archiveConfirmNoDate", { count: noDate }) : "";
  return i18n.t("projects:format.archiveConfirm", { count, suffix });
}

export function nowLimitError(limit: number): string {
  return i18n.t("projects:format.nowLimit", { limit });
}

export function doneToNowError(): string {
  return i18n.t("projects:format.doneToNow");
}

function formatThousandsDecimal(n: number): string {
  const lang = currentLang();
  const raw = (n / 1000).toFixed(1);
  if (lang === "pl") return raw.replace(".", ",");
  return raw;
}

/** Pełna etykieta tokenów (notatka po kopiowaniu): PL „~3,2 tys. tokenów”, EN „~3.2k tokens”. */
export function tokensThousandLabel(approxTokens: number): string {
  const value = formatThousandsDecimal(approxTokens);
  const lang = currentLang();
  if (lang === "en") {
    return i18n.t("projects:format.tokensThousand", { value: `${value}k` });
  }
  return i18n.t("projects:format.tokensThousand", { value });
}

/** Skrót w nawiasie przycisku: PL „ (~3,2 tys. tok)”, EN „ (~3.2k tok)”. */
export function packButtonSizeSuffix(approxTokens: number): string {
  const value = formatThousandsDecimal(approxTokens);
  const lang = currentLang();
  const core =
    lang === "en"
      ? i18n.t("projects:format.tokensThousandShort", { value: `${value}k` })
      : i18n.t("projects:format.tokensThousandShort", { value });
  return ` (${core})`;
}

/** Wartość w kafelu paczki: PL „3 850 tok” (`formatTokens`), EN „3,850 tok”. */
export function packTileValue(approxTokens: number): string {
  const lang = currentLang();
  const formatted =
    lang === "en" ? approxTokens.toLocaleString("en-US") : formatTokens(approxTokens);
  return i18n.t("projects:format.packValue", { formatted });
}

export function packBudgetMeta(percent: number, budget: number, truncated: boolean): string {
  const base = i18n.t("projects:tiles.packBudget", {
    percent,
    budget: formatTokens(budget),
  });
  return truncated ? base + i18n.t("projects:tiles.packTruncated") : base;
}

export function kindCountLabel(kind: "wlasny" | "biblioteka" | "etat"): string {
  return i18n.t(`projects:tiles.kindCount.${kind}`);
}
```

Eksport typu `ColumnKey` z `ProjectTasksBoard.tsx` (albo przenieś `type ColumnKey` do `projectsFormat.ts` i importuj w board — wykonawca wybiera mniejszy diff; bez cyklicznego importu).

- [ ] **Step 5: `projectTiles.ts`**

`import i18n from "@/src/i18n"`; usuń `KIND_LABELS` — użyj `kindCountLabel`. Wszystkie stringi meta/label → `i18n.t("projects:tiles.*", …)`. `section !== "Zamknięte"` bez zmian. Meta „N kind” składaj: `` `${n} ${kindCountLabel(kind)}` ``.

- [ ] **Step 6: `packSections.ts`**

Pierwsza sekcja: `{ name: i18n.t("projects:pack.headerSection"), lines: [] }` (test PL nadal widzi „Nagłówek”).

- [ ] **Step 7: Podkomponenty i subskrypcja języka**

W plikach `.tsx` z wewnętrznymi komponentami renderującymi teksty: **`useT()` obowiązkowo** w `CopyNoticeView` (`ProjectContextPack.tsx:~23`) i `BugRow` (`ProjectBugs.tsx:~21`); `taskHint` przenieś do `BugRow` (woła `t`, nie modułowy `COLUMN_LABEL`). `StateBox` (`ProjectSaveState.tsx`) tylko wyświetla `label` z rodzica — bez `useT()`. Inne pliki projects: brak dodatkowych wewnętrznych komponentów z tekstem UI (grep: tylko `BugRow`, `CopyNoticeView`, `StateBox`).

- [ ] **Step 8: Zielono**

Run: `npx vitest run tests/unit/i18n tests/unit/features/projects/projectTiles.test.ts tests/unit/features/projects/packSections.test.ts && npx tsc --noEmit`
Expected: PASS (`ProjectContextPack.test.tsx` L64 nadal `(~3,2 tys. tok)` w PL).

- [ ] **Step 9: Commit (orkiestrator)**

```bash
git add src/i18n src/features/projects/projectTiles.ts src/features/projects/packSections.ts src/features/projects/projectsFormat.ts tests/unit/i18n/projects-format.test.ts
git commit -m "feat(i18n): namespace projects, kafle rejestru i funkcje etykiet Projekty"
```

---

## Task 2: Małe komponenty (Cursor)

**Files:** `ProjectLinks.tsx`, `ProjectDevlog.tsx`, `ProjectList.tsx`, `NewProjectDialog.tsx`, `ProjectDossier.tsx` (bez tablicy/board/bugs/pack); słowniki `projects.ts`.

Zasady: `useT()`; stałe `PRIORITIES` / `TYPES` / `TYPE_OPTIONS` / `SLOTS` → `labelKey` lub `value` + `t(...)` / `projectKindLabel`; `ProjectList`: zamień `PROJECT_KIND_LABELS` na `projectKindLabel(project.kind)` + `useT()` w komponencie.

- [ ] **Step 1: Klucze PL/EN (Task 2)**

Dopisz do obu `projects.ts`:

**PL:**

```ts
  common: {
    save: "Zapisz",
    cancel: "Anuluj",
    edit: "Edytuj",
    create: "Utwórz",
    saving: "Zapisuję…",
    notSet: "Nie ustawiono",
  },
  links: {
    slotRepo: "Repo",
    slotDev: "Dev",
    slotDocs: "Docs",
    formAria: "Edycja linków projektu",
    save: "Zapisz linki",
    edit: "Edytuj linki",
    add: "Dodaj link: {{label}}",
    githubPlaceholder: "https://github.com/…",
    deployPlaceholder: "http://localhost:3000 albo adres wdrożenia",
    docsPlaceholder: "link albo ścieżka, np. docs/specs/v2.md",
  },
  devlog: {
    title: "Devlog · ostatnie decyzje",
    empty: "Brak wpisów",
    formAria: "Nowy wpis w devlogu",
    fieldTitle: "Tytuł",
    fieldWhy: "Dlaczego",
    add: "Dodaj wpis",
  },
  list: {
    staleAlert: "Brak zmian od ponad 14 dni. Podejmij decyzję.",
    sleep: "Uśpiony: nie wymaga decyzji.",
    sleepAria: "Uśpij projekt {{name}}",
    wakeAria: "Wznów projekt {{name}}",
    sleepBtn: "Uśpij",
    wakeBtn: "Wznów",
    firmBadge: "Firma",
  },
  dialog: {
    aria: "Nowy projekt",
    title: "Nowy projekt",
    name: "Nazwa",
    priority: "Priorytet",
    type: "Typ",
    localPath: "Ścieżka lokalna (opcjonalnie)",
    localPathPlaceholder: "~/projects/nazwa",
    github: "GitHub (opcjonalnie)",
    hint: "Dopisuje projekt do rejestru NEXUS i zakłada w vaulcie index.md, tasks.md i bugs.md. Kodu projektu nie zmienia.",
    create: "Utwórz projekt",
    priorityHigh: "Wysoki",
    priorityMedium: "Średni",
    priorityLow: "Niski",
  },
  dossier: {
    aria: "Teczka projektu {{name}}",
    companyData: "Dane z firmy",
    companyProtectedTitle: "Chronione: owner: work w rejestrze",
    companyLabelTitle:
      "Etykieta z typu Etat; ochronę (Mapa, Notatki, przyszłe AI i eksport) włącza owner: work w rejestrze",
    resumeTitle: "Przywraca status active w rejestrze",
    pauseTitle: "Ustawia status paused w rejestrze: projekt przestaje wymagać decyzji",
    resumeBtn: "Wznów projekt",
    pauseBtn: "Uśpij projekt",
    typeAria: "Typ projektu",
    milestone: "Kamień milowy: {{text}}",
    milestoneDue: " · do {{date}}",
    tasksTitle: "Tablica zadań · tasks.md",
    tasksCount: "{{count}} w projekcie",
  },
```

**EN (pełny obiekt do `locales/en/projects.ts`, dopisać obok grup z Task 1):**

```ts
  common: {
    save: "Save",
    cancel: "Cancel",
    edit: "Edit",
    create: "Create",
    saving: "Saving…",
    notSet: "Not set",
  },
  links: {
    slotRepo: "Repo",
    slotDev: "Dev",
    slotDocs: "Docs",
    formAria: "Edit project links",
    save: "Save links",
    edit: "Edit links",
    add: "Add link: {{label}}",
    githubPlaceholder: "https://github.com/…",
    deployPlaceholder: "http://localhost:3000 or deployment URL",
    docsPlaceholder: "link or path, e.g. docs/specs/v2.md",
  },
  devlog: {
    title: "Devlog · recent decisions",
    empty: "No entries",
    formAria: "New devlog entry",
    fieldTitle: "Title",
    fieldWhy: "Why",
    add: "Add entry",
  },
  list: {
    staleAlert: "No changes for over 14 days. Decide what to do.",
    sleep: "Paused: no decision needed.",
    sleepAria: "Pause project {{name}}",
    wakeAria: "Resume project {{name}}",
    sleepBtn: "Pause",
    wakeBtn: "Resume",
    firmBadge: "Company",
  },
  dialog: {
    aria: "New project",
    title: "New project",
    name: "Name",
    priority: "Priority",
    type: "Type",
    localPath: "Local path (optional)",
    localPathPlaceholder: "~/projects/name",
    github: "GitHub (optional)",
    hint: "Adds the project to the NEXUS registry and creates index.md, tasks.md, and bugs.md in the vault. Does not modify project code.",
    create: "Create project",
    priorityHigh: "High",
    priorityMedium: "Medium",
    priorityLow: "Low",
  },
  dossier: {
    aria: "Project dossier {{name}}",
    companyData: "Company data",
    companyProtectedTitle: "Protected: owner: work in registry",
    companyLabelTitle:
      "Label from Etat type; protection (Map, Notes, future AI and export) is enabled by owner: work in registry",
    resumeTitle: "Restores active status in registry",
    pauseTitle: "Sets paused status in registry: project no longer needs a decision",
    resumeBtn: "Resume project",
    pauseBtn: "Pause project",
    typeAria: "Project type",
    milestone: "Milestone: {{text}}",
    milestoneDue: " · due {{date}}",
    tasksTitle: "Task board · tasks.md",
    tasksCount: "{{count}} in project",
  },
```

- [ ] **Step 2:** zlecenie Cursora (lista plików, zasady, `useT()` także jeśli dzieci są w tym samym pliku; `npx vitest run tests/unit/features/projects/ProjectLinks.test.tsx tests/unit/features/projects/ProjectDevlog.test.tsx` + tsc).
- [ ] **Step 3:** grep polskich znaków (poza komentarzami) w 5 plikach — pusto; commit:

```bash
git add src/features/projects src/i18n
git commit -m "feat(i18n): linki, devlog, rejestr, dialog i metryczka teczki Projekty w PL/EN"
```

---

## Task 3: Save State, paczka kontekstu (Cursor)

**Files:** `ProjectSaveState.tsx`, `useContextPack.ts`, `ProjectContextPack.tsx`; słowniki `projects.ts`.

- [ ] **Step 1: Klucze**

**PL (`saveState`, `pack`, `errors`):**

```ts
  saveState: {
    title: "Save State",
    editAria: "Edycja Save State",
    noFile: "brak state.md",
    whereStopped: "Gdzie skończyłem (z index.md)",
    noEntry: "Brak wpisu",
    create: "Utwórz Save State",
    savedAt: "Zapisano: {{date}}",
    fieldBranch: "Branch",
    readBranch: "Aktywny branch",
    fieldEnv: "Środowisko",
    readEnv: "Środowisko",
    fieldBlocker: "Bloker",
    readBlocker: "Bloker",
    fieldNextStep: "Następny krok",
    readNextStep: "Następny krok",
    fieldMilestone: "Kamień milowy",
    fieldMilestoneDue: "Termin kamienia",
    readLinks: "Linki",
    linksMultiline: "Linki (jeden na linię)",
    save: "Zapisz",
    edit: "Edytuj",
    reload: "Wczytaj aktualną wersję",
    conflict:
      "state.md zmienił się poza aplikacją. Wczytaj aktualną wersję; niezapisane zmiany w formularzu zostaną utracone.",
    linksHttpOnly: "Linki muszą zaczynać się od http:// lub https://",
  },
  pack: {
    cardAria: "Paczka kontekstu",
    title: "Paczka kontekstu · zrzut do LLM",
    subtitle:
      "Prompt startowy dla agenta, składany na żywo z Save State, gita, zadań, bugów i devlogu.",
    budgetLine: "{{used}} / {{budget}} tokenów",
    windowUse: "Wykorzystanie okna: {{percent}}%",
    rolesAria: "Rola paczki",
    role: { full: "Pełna", review: "Review", implementation: "Implementacja", debug: "Debug" },
    loading: "Składam paczkę…",
    progressAria: "Budżet paczki kontekstu",
    truncatedNote: "Paczka skrócona do budżetu.",
    copy: "Kopiuj paczkę kontekstu",
    copyWithSize: "Kopiuj paczkę kontekstu{{size}}",
    copied: "Skopiowano paczkę kontekstu ({{label}})",
    copiedTruncated: " · skrócona do budżetu",
    previewShow: "Podgląd Markdown",
    previewHide: "Ukryj podgląd",
  },
  errors: {
    clipboard: "Nie udało się skopiować do schowka",
  },
```

**EN (pełny obiekt):**

```ts
  saveState: {
    title: "Save State",
    editAria: "Edit Save State",
    noFile: "no state.md",
    whereStopped: "Where I left off (from index.md)",
    noEntry: "No entry",
    create: "Create Save State",
    savedAt: "Saved: {{date}}",
    fieldBranch: "Branch",
    readBranch: "Active branch",
    fieldEnv: "Environment",
    readEnv: "Environment",
    fieldBlocker: "Blocker",
    readBlocker: "Blocker",
    fieldNextStep: "Next step",
    readNextStep: "Next step",
    fieldMilestone: "Milestone",
    fieldMilestoneDue: "Milestone due",
    readLinks: "Links",
    linksMultiline: "Links (one per line)",
    save: "Save",
    edit: "Edit",
    reload: "Reload current version",
    conflict:
      "state.md changed outside the app. Reload the current version; unsaved form changes will be lost.",
    linksHttpOnly: "Links must start with http:// or https://",
  },
  pack: {
    cardAria: "Context pack",
    title: "Context pack · LLM snapshot",
    subtitle:
      "Starter prompt for the agent, assembled live from Save State, git, tasks, bugs, and devlog.",
    budgetLine: "{{used}} / {{budget}} tokens",
    windowUse: "Window usage: {{percent}}%",
    rolesAria: "Pack role",
    role: { full: "Full", review: "Review", implementation: "Implementation", debug: "Debug" },
    loading: "Building pack…",
    progressAria: "Context pack budget",
    truncatedNote: "Pack truncated to budget.",
    copy: "Copy context pack",
    copyWithSize: "Copy context pack{{size}}",
    copied: "Copied context pack ({{label}})",
    copiedTruncated: " · truncated to budget",
    previewShow: "Markdown preview",
    previewHide: "Hide preview",
  },
  errors: {
    clipboard: "Failed to copy to clipboard",
  },
```

Formularz edycji: `fieldBranch` (test `getByLabelText("Branch")` — słowo **Branch** zostaje w PL dosłownie). Widok odczytu: `readBranch` („Aktywny branch”). Pary field/read dla pozostałych pól jak w tabeli (Środowisko/Bloker/Następny krok — ten sam tekst w PL, osobne klucze na wypadek rozjazdu w EN).

- [ ] **Step 2:** `useContextPack.ts`: błąd schowka → `i18n.t("projects:errors.clipboard")`. `ProjectContextPack.tsx`: `tokensThousandLabel`, `packButtonSizeSuffix`, `packTileValue` z `projectsFormat.ts`; przycisk: `` `${t("projects:pack.copy")}${size}` `` gdzie `size = packButtonSizeSuffix(...)`; role z `t("projects:pack.role." + key)`; **`useT()` w `ProjectContextPack`, `ProjectContextPackButton` i `CopyNoticeView`**.
- [ ] **Step 3:** `npx vitest run tests/unit/features/projects/ProjectSaveState.test.tsx tests/unit/features/projects/ProjectContextPack.test.tsx`
- [ ] **Step 4: Commit**

```bash
git add src/features/projects src/i18n
git commit -m "feat(i18n): Save State i paczka kontekstu Projekty w PL/EN"
```

---

## Task 4: Bugi (Cursor)

**Files:** `ProjectBugs.tsx`; słowniki `board.columns.*` (współdzielone z Task 5) — w Task 4 dopisz tylko `bugs.*`.

**PL `bugs`:**

```ts
  bugs: {
    title: "Bugi",
    empty: "Brak bugów",
    closedToggle: "Zamknięte: {{count}}",
    hintClosedOpen: "bug zamknięty, zadanie nadal otwarte",
    hintOpenDone: "zadanie zrobione, bug nadal otwarty",
    hintInTasks: "w zadaniach: {{column}}",
    openDays: "otwarty {{days}} d",
    closedOn: "zamknięto {{date}}",
    detailsAria: "Szczegóły {{id}}",
    collapse: "Zwiń",
    expand: "Szczegóły",
    fieldFile: "Plik",
    fieldDesc: "Opis",
    fieldFix: "Naprawa",
    fieldResolution: "Rozwiązanie",
  },
  board: {
    columns: {
      blockers: "Blokery",
      now: "Teraz",
      next: "Następne",
      icebox: "Icebox",
    },
  },
```

**EN (pełny obiekt `bugs` + `board.columns`):**

```ts
  bugs: {
    title: "Bugs",
    empty: "No bugs",
    closedToggle: "Closed: {{count}}",
    hintClosedOpen: "bug closed, task still open",
    hintOpenDone: "task done, bug still open",
    hintInTasks: "in tasks: {{column}}",
    openDays: "open {{days}} d",
    closedOn: "closed {{date}}",
    detailsAria: "Details {{id}}",
    collapse: "Collapse",
    expand: "Details",
    fieldFile: "File",
    fieldDesc: "Description",
    fieldFix: "Fix",
    fieldResolution: "Resolution",
  },
  board: {
    columns: {
      blockers: "Blockers",
      now: "Now",
      next: "Next",
      icebox: "Icebox",
    },
  },
```

`COLUMN_LABEL` → klucze `projects:board.columns.*`; `taskHint` wewnątrz **`BugRow` z `useT()`**.

- [ ] **Step 1–3:** migracja, `npx vitest run tests/unit/features/projects/ProjectBugs.test.tsx`, grep, commit:

```bash
git commit -m "feat(i18n): sekcja bugów teczki projektu w PL/EN"
```

---

## Task 5: Tablica zadań (Cursor)

**Files:** `ProjectTasksBoard.tsx`; reszta kluczy `board.*` w słownikach.

**PL `board` (uzupełnienie):**

```ts
  board: {
    // columns z Task 4
    conflict: "Plik zadań zmienił się; odświeżono tablicę. Spróbuj ponownie.",
    filterAria: "Filtr zadań",
    filterAll: "Wszystkie",
    filterOpen: "Otwarte",
    filterDone: "Ukończone",
    emptyAll: "Brak",
    emptyOpen: "Brak otwartych",
    emptyDone: "Brak ukończonych",
    archiveOlder: "starsze niż",
    archiveDaysAria: "Archiwizuj starsze niż",
    archiveDays: "{{count}} dni",
    archiveConfirmBtn: "Tak",
    archiveCancelAria: "Anuluj archiwizację",
    archiveConfirmAria: "Potwierdź archiwizację",
    archiveBtn: "Archiwizuj ukończone ({{count}})",
    columnAria: "Kolumna {{label}}",
    editTaskAria: "Edytuj zadanie",
    dragTitle: "Przeciągnij na inną kolumnę",
    dragAria: "Przeciągnij: {{text}}",
    editBtn: "Edytuj",
    editAria: "Edytuj: {{text}}",
    confirmRemoveAria: "Potwierdź usunięcie: {{text}}",
    confirmRemoveBtn: "Potwierdź",
    removeAria: "Usuń: {{text}}",
    removeBtn: "Usuń",
    addPlaceholder: "Nowe zadanie…",
    addAria: "Dodaj zadanie: {{label}}",
    addBtn: "Dodaj zadanie",
  },
```

**EN (pełny obiekt `board`, kolumny jak w Task 4):**

```ts
  board: {
    columns: {
      blockers: "Blockers",
      now: "Now",
      next: "Next",
      icebox: "Icebox",
    },
    conflict: "tasks.md changed; board refreshed. Try again.",
    filterAria: "Task filter",
    filterAll: "All",
    filterOpen: "Open",
    filterDone: "Done",
    emptyAll: "None",
    emptyOpen: "No open tasks",
    emptyDone: "No completed tasks",
    archiveOlder: "older than",
    archiveDaysAria: "Archive older than",
    archiveDays: "{{count}} days",
    archiveConfirmBtn: "Yes",
    archiveCancelAria: "Cancel archive",
    archiveConfirmAria: "Confirm archive",
    archiveBtn: "Archive completed ({{count}})",
    columnAria: "Column {{label}}",
    editTaskAria: "Edit task",
    dragTitle: "Drag to another column",
    dragAria: "Drag: {{text}}",
    editBtn: "Edit",
    editAria: "Edit: {{text}}",
    confirmRemoveAria: "Confirm delete: {{text}}",
    confirmRemoveBtn: "Confirm",
    removeAria: "Delete: {{text}}",
    removeBtn: "Delete",
    addPlaceholder: "New task…",
    addAria: "Add task: {{label}}",
    addBtn: "Add task",
  },
```

Implementacja: `COLUMNS`/`FILTERS`/`EMPTY_TEXT` → `labelKey` + `emptyKey`; `countLabel` → `columnTaskCountLabel`; `CONFLICT_MESSAGE` → `t("projects:board.conflict")`; `moveBlockReason` → `doneToNowError()` / `nowLimitError(NOW_LIMIT)`; `setNotice` → `archiveMovedNotice`; potwierdzenie → `archiveConfirmQuestion`.

- [ ] **Step 1:** zlecenie Cursora (plik ~475 linii).

- [ ] **Step 2: Wyjątek testu PL (ten sam commit co komponent)**

W `tests/unit/features/projects/ProjectTasksBoard.test.tsx` zamień 3 asercje na poprawny plural:

| Linia | Stary tekst (błędna odmiana)                            | Nowy tekst                                                |
| ----- | ------------------------------------------------------- | --------------------------------------------------------- |
| ~476  | `Przenieść 1 zadań do changelog.md (w tym 1 bez daty)?` | `Przenieść 1 zadanie do changelog.md (w tym 1 bez daty)?` |
| ~487  | `Przenieść 1 zadań do changelog.md?`                    | `Przenieść 1 zadanie do changelog.md?`                    |
| ~501  | `Przeniesiono 2 zadań do changelog.md`                  | `Przeniesiono 2 zadania do changelog.md`                  |

- [ ] **Step 3:** `npx vitest run tests/unit/features/projects/ProjectTasksBoard.test.tsx`
- [ ] **Step 4: Commit**

```bash
git commit -m "feat(i18n): tablica zadań projektu w PL/EN z pluralem i archiwizacją"
```

---

## Task 6: `ProjectsView`, `useProjects`, test EN (Cursor + agy)

**Files:** `ProjectsView.tsx`, `useProjects.ts`; klucze `view.*`, `errors.noProjectSelected`; test `ProjectsView.en.test.tsx`.

**PL `view` + `errors`:**

```ts
  view: {
    loading: "Ładowanie…",
    loadingProject: "Ładowanie projektu…",
    eyebrow: "Alt+4 · Projekty",
    heading: "Teczka inżynierska projektów",
    subRegistry: "{{label}} w rejestrze",
    subSelected: " · wybrany: {{name}}",
    newProject: "+ Nowy projekt",
    tilesAria: "Statystyki projektów",
    registryAria: "Rejestr projektów",
    registryTitle: "Rejestr",
    emptyRegistry: "Brak projektów w rejestrze",
    searchPlaceholder: "Szukaj w rejestrze projektów…",
    searchAria: "Filtruj projekty",
    emptyFilter: "Brak projektów pasujących do filtra",
  },
```

**EN (pełny obiekt `view`):**

```ts
  view: {
    loading: "Loading…",
    loadingProject: "Loading project…",
    eyebrow: "Alt+4 · Projects",
    heading: "Engineering project dossier",
    subRegistry: "{{label}} in registry",
    subSelected: " · selected: {{name}}",
    newProject: "+ New project",
    tilesAria: "Project statistics",
    registryAria: "Project registry",
    registryTitle: "Registry",
    emptyRegistry: "No projects in registry",
    searchPlaceholder: "Search project registry…",
    searchAria: "Filter projects",
    emptyFilter: "No projects matching filter",
  },
```

`ProjectsView`: usuń `projectsWord`; podtytuł: `t("projects:view.subRegistry", { label: registryProjectsLabel(projects.length) })` (daje PL „2 projekty w rejestrze”, EN „2 projects in registry”); nagłówek rejestru: `` `${t("view.registryTitle")} · ${registryProjectsLabel(projects.length)}` ``; `useT()`. `useProjects` L86, L181 → `i18n.t("projects:errors.noProjectSelected")`.

- [ ] **Step 1: Test EN**

`tests/unit/features/projects/ProjectsView.en.test.tsx` (wzoruj helpery mocków z `ProjectsView.test.tsx`):

```ts
import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { ProjectDetailDto, ProjectSummaryDto } from "@/contexts/bc_projects/schemas";
import { ProjectsView } from "@/src/features/projects/ProjectsView";
import { setLanguage } from "@/src/i18n";

afterEach(() => cleanup());

function summary(
  partial: Partial<ProjectSummaryDto> & Pick<ProjectSummaryDto, "id">
): ProjectSummaryDto {
  const owner = partial.owner ?? "personal";
  return {
    name: partial.name ?? partial.id,
    status: "active",
    priority: "P2",
    localPath: `/tmp/${partial.id}`,
    owner,
    kind: partial.type ?? (owner === "work" ? "etat" : "wlasny"),
    companyData: owner === "work" || partial.type === "etat",
    freshness: "fresh",
    ...partial,
  };
}

function listResponse(projects: ProjectSummaryDto[], warnings: string[] = []): Response {
  return new Response(JSON.stringify({ projects, warnings }), { status: 200 });
}

function makeApiFetch(
  projects: ProjectSummaryDto[],
  details: Record<string, ProjectDetailDto | Response> = {},
  warnings: string[] = []
) {
  const pack = {
    markdown: "# P",
    approxTokens: 3850,
    truncated: false,
    warnings: [] as string[],
  };
  return vi.fn(async (url: string) => {
    if (url === "/api/projects") return listResponse(projects, warnings);
    if (url.endsWith("/context-pack")) return new Response(JSON.stringify(pack), { status: 200 });
    const prefix = "/api/projects/";
    if (url.startsWith(prefix)) {
      const id = decodeURIComponent(url.slice(prefix.length));
      const value = details[id];
      if (value instanceof Response) return value;
      if (value) return new Response(JSON.stringify(value), { status: 200 });
      return new Response(JSON.stringify({ error: `Nie ma projektu o id ${id}` }), {
        status: 404,
      });
    }
    return new Response("{}", { status: 404 });
  });
}

const twoProjects: ProjectSummaryDto[] = [
  summary({ id: "a", name: "Alpha" }),
  summary({ id: "b", name: "Beta" }),
];

describe("ProjectsView po angielsku", () => {
  test("nagłówek i licznik rejestru po EN", async () => {
    await act(async () => {
      await setLanguage("en");
    });
    render(<ProjectsView apiFetch={makeApiFetch(twoProjects)} />);
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(
      "Engineering project dossier"
    );
    expect(screen.getByText("2 projects in registry")).toBeInTheDocument();
    expect(screen.queryByText("Teczka inżynierska projektów")).toBeNull();
  });

  test("przycisk nowego projektu i placeholder wyszukiwania", async () => {
    await act(async () => {
      await setLanguage("en");
    });
    render(<ProjectsView apiFetch={makeApiFetch(twoProjects)} />);
    expect(await screen.findByRole("button", { name: "+ New project" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search project registry…")).toBeInTheDocument();
  });

  test("przełączenie na PL bez remountu: nagłówek i 2 projekty", async () => {
    await act(async () => {
      await setLanguage("en");
    });
    render(<ProjectsView apiFetch={makeApiFetch(twoProjects)} />);
    const heading = await screen.findByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Engineering project dossier");
    expect(screen.getByText("2 projects in registry")).toBeInTheDocument();

    await act(async () => {
      await setLanguage("pl");
    });

    expect(heading).toHaveTextContent("Teczka inżynierska projektów");
    expect(screen.getByText("2 projekty w rejestrze")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2:** `npx vitest run tests/unit/features/projects`
- [ ] **Step 3: Commit**

```bash
git add src/features/projects tests/unit/features/projects/ProjectsView.en.test.tsx src/i18n
git commit -m "feat(i18n): widok Projekty i test EN z przełączeniem języka"
```

- [ ] **Step 4: Review `agy`** (`--role review`, `--tier deep`, `--fresh`)

Prompt: review `git diff main...HEAD` — polskie UI poza komentarzami, dosłowność PL, parytet EN, `i18n.t` bez `useT()` w drzewie, `Zamknięte` jako dana, max 30 linii `plik:linia + problem`.

---

## Task 7: Weryfikacja i domknięcie (orkiestrator + Cursor)

- [ ] **Step 1: Grep bramka**

Run: `grep -nP '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]' src/features/projects/*.ts src/features/projects/*.tsx | grep -v -E '^\S+:\s*[0-9]+:\s*(//|\*|/\*)'`
Expected: brak (tylko komentarze/JSDoc).

- [ ] **Step 2: Komplet (Cursor, po kolei)**

`npx tsc --noEmit`, `npx vitest run`, `npm run lint`, `npm run build`.

- [ ] **Step 3: Oględziny przeglądarki**

Karta Projekty: kafle, rejestr, teczka, tablica (plural 1/2/5/22 zadań), bugi, devlog, paczka, dialog nowego projektu, PL↔EN bez F5, mobile.

- [ ] **Step 4: NEXUS + PR na prośbę użytkownika**

`Vault/Projects/monolith/tasks.md`: odhaczenie etapu 3; PR jak w etapie 2.

---

## Self-review

- **§4 pkt 3, J1–J9:** cały `src/features/projects/` poza CSS i `mutation.ts` / `isHttpUrl.ts` (brak UI).
- **PACK_ROLES:** tłumaczenie tylko w UI (schemas bez zmian).
- **`projectKind.ts`:** listy i selecty typu; `tiles.kindCount` dla meta kafli.
- **`translations.ts`:** brak martwych kluczy Projekty — Task 7 nie dotyka pliku.
- **Testy:** 10 plików PL bez zmian; 3 asercje poprawione w `ProjectTasksBoard.test.tsx`; 2 nowe EN; plural w `projects-format.test.ts` zgodnie z J9.
- **Ryzyko:** eksport `ColumnKey` — uniknąć importu cyklicznego `ProjectTasksBoard` ↔ `projectsFormat`.
