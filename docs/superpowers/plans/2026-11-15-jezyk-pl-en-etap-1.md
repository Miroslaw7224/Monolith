# Język PL/EN: etap 1 (fundament i powłoka) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Widoczny przełącznik PL/EN w `CardRail` i powłoka aplikacji (rail kart, paleta Ctrl+K, pasek statusu, dolna nawigacja mobile, szufladka „Więcej”, okno feedbacku) tłumaczona przez `i18next`, z zapisem wyboru w `localStorage["monolith.lang"]`.

**Architecture:** `src/i18n/` trzyma instancję i18next (zasoby wbudowane w bundle, init synchroniczny), `setLanguage`/`readStoredLanguage`, hook `useLang`, helper dat i providera klienckiego z bramką „renderuj dopiero po odczycie zapisanego języka” (brak mignięcia PL po F5). Komponenty powłoki biorą teksty z `useTranslation`; `App.tsx` bierze język z `useLang()` i dalej podaje stary `t = translations[lang]` oraz `lang` do `PlanowanieView` (most do etapu 4). Konteksty `bc_*` i API bez zmian.

**Tech Stack:** Next.js 14 (App Router, klient), React 19, TypeScript (`strict: false`), `i18next` 27.x, `react-i18next` 18.x, Vitest + Testing Library (jsdom).

**Spec:** `docs/superpowers/specs/2026-11-15-jezyk-pl-en-design.md` (decyzje J1–J9, §5 = ten etap). **Zasady repo:** `CLAUDE.md`; `tests/unit/architecture.static.test.ts` NIE jest zmieniany w tym planie (zmiany testu architektury zawsze osobnym commitem).

**Konwencje komend:** testy `npx vitest run <ścieżka>`, typy `npx tsc --noEmit`, lint `npm run lint`, build `npm run build` (te cztery można zlecić `cursor --role task --approve-allowed` z prośbą o „przeszło” albo listę `plik:linia + przyczyna`). Commity kończą się linią `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Hook `lint-staged` przeformatowuje pliki prettierem przy commicie (to normalne).

## Rozstrzygnięcia planu (względem specu)

1. **Mignięcie PL po F5 (§3, §7 specu): bramka w `I18nProvider`.** Provider renderuje `children` dopiero po tym, jak zapisany język został zastosowany (`await applyStoredLanguage()` w `useEffect`). Dzięki temu użytkownik EN nigdy nie widzi PL. Wariant „skrypt jak `ThemeScript`” odrzucony: skrypt nie zmieni zasobów i18next przed hydracją, a hydracja z EN rozjechałaby się z HTML z serwera. Koszt bramki: pierwszy kadr to pusta strona. Aplikacja i tak jest klientowa (`/` przekierowuje na `/dashboard`, `DashboardPage` to `"use client"`), więc nic nie traci SEO.
2. **`ShellStatusBar` sam nie ma tekstów**: wszystkie teksty paska leżą we wspólnym `StatusBar.tsx`, którego używa też Kokpit. Tłumaczymy `StatusBar.tsx` (zmiana widoczna i w Kokpicie; to zamierzone).
3. **Plural w etapie 1 = „ostrzeżenia” w pasku statusu** (jedyny plural w powłoce). Zmienia to dziś błędne „1 ostrzeżeń” na „1 ostrzeżenie”: jeden istniejący test (`HomeView.test.tsx:735`) dostaje nową oczekiwaną wartość. Plural „zadań” z J7 przychodzi z Kokpitem (etap 2).
4. **`format.ts` ma tylko `formatDate`.** W powłoce nie ma dat; jest wyłącznie godzina `hhmm` (24 h w obu językach, bez zmian). `formatTime` dopiszemy, gdy któraś karta go potrzebuje. `formatDate` powstaje teraz (spec §5 pkt 1 i test), jego pierwszy użytkownik to etap 2.
5. **`label` znika z `CARDS`**: etykiety kart to klucze `shell:cards.<id>` (jedno źródło prawdy). Test `cards.test.ts:43` traci `label` w `toMatchObject`.
6. **Typy kluczy** z PL przez `CustomTypeOptions`. EN nie jest typowany wobec PL, bo PL ma 4 formy plural (`_one/_few/_many/_other`), a EN 2; parytet pilnuje test uruchomieniowy (suffiksy plural są normalizowane).

---

## Mapa plików

| Plik                                                | Zmiana                                                                                                                                                                                                            |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`, `package-lock.json`                 | `i18next`, `react-i18next`                                                                                                                                                                                        |
| `src/i18n/index.ts` (nowy)                          | instancja, `Lang`, `LANG_KEY`, `isLang`, `readStoredLanguage`, `setLanguage`, `applyStoredLanguage`, `currentLang`                                                                                                |
| `src/i18n/resources.ts` (nowy)                      | `resources = { pl: {common, shell}, en: {common, shell} }`                                                                                                                                                        |
| `src/i18n/locales/{pl,en}/{common,shell}.ts` (nowe) | słowniki                                                                                                                                                                                                          |
| `src/i18n/i18next.d.ts` (nowy)                      | `CustomTypeOptions` (klucze według PL)                                                                                                                                                                            |
| `src/i18n/useLang.ts` (nowy)                        | `useLang()` → `{ lang, setLang, toggleLang }`                                                                                                                                                                     |
| `src/i18n/format.ts` (nowy)                         | `formatDate(date, lang?)`                                                                                                                                                                                         |
| `src/i18n/I18nProvider.tsx` (nowy)                  | provider z bramką                                                                                                                                                                                                 |
| `app/layout.tsx`                                    | `<I18nProvider>` wewnątrz `<ThemeProvider>`                                                                                                                                                                       |
| `tests/setup.ts`                                    | import `@/src/i18n`, reset języka i storage przed każdym testem                                                                                                                                                   |
| `src/features/cards/cards.ts`                       | bez `label`; `buildCardCommands(selectCard, t)`                                                                                                                                                                   |
| `src/features/cards/CardRail.tsx`, `cards.css`      | teksty z `t`, przycisk PL/EN                                                                                                                                                                                      |
| `src/features/cards/CommandPalette.tsx`             | teksty z `t`                                                                                                                                                                                                      |
| `src/features/cards/appCommands.ts`                 | teksty z `t`                                                                                                                                                                                                      |
| `src/features/home/StatusBar.tsx`                   | teksty z `t`, plural                                                                                                                                                                                              |
| `src/components/layout/MobileNav.tsx`               | bez `lang`, klucze                                                                                                                                                                                                |
| `src/components/layout/MobileMoreDrawer.tsx`        | bez `lang`, klucze                                                                                                                                                                                                |
| `src/components/layout/FeedbackModal.tsx`           | bez propa `title`, teksty z `t`                                                                                                                                                                                   |
| `src/App.tsx`                                       | `useLang()` zamiast `useState`, most do `translations`                                                                                                                                                            |
| testy                                               | nowe: `tests/unit/i18n/{language,parity,format,I18nProvider,shell-language}.test.*`; zmienione: `CardRail`, `cards`, `cardCommands`, `CommandPalette`, `appCommands`, `MobileNav`, `MobileMoreDrawer`, `HomeView` |

Bez zmian: `contexts/bc_*`, `lib/*`, `app/api/*`, `src/translations.ts`, `PlanowanieView` i reszta kart, `tests/unit/architecture.static.test.ts`.

---

## Task 0: Gałąź

Gałąź `docs/jezyk-pl-en-spec` zawiera commit specu (`71bdb38`). Implementację robimy na osobnej gałęzi od niej (spec i plan jadą razem w PR).

- [ ] **Step 1: Utwórz gałąź i sprawdź stan**

Run: `git checkout -b feat/jezyk-pl-en-etap-1 && git status --short && git log --oneline -1`
Expected: brak zmian w drzewie (plan może być jedynym nieśledzonym plikiem), ostatni commit `71bdb38 docs(i18n): spec języka PL/EN…`.

- [ ] **Step 2: Zacommituj plan**

```bash
git add docs/superpowers/plans/2026-11-15-jezyk-pl-en-etap-1.md
git commit -m "docs(i18n): plan etapu 1 języka PL/EN (fundament i powłoka)"
```

(z linią `Co-Authored-By`, jak w konwencjach)

---

## Task 1: Fundament `src/i18n/` (instancja, słowniki, format, setup testów)

**Files:**

- Modify: `package.json`, `package-lock.json`
- Create: `src/i18n/index.ts`, `src/i18n/resources.ts`, `src/i18n/i18next.d.ts`, `src/i18n/useLang.ts`, `src/i18n/format.ts`
- Create: `src/i18n/locales/pl/common.ts`, `src/i18n/locales/pl/shell.ts`, `src/i18n/locales/en/common.ts`, `src/i18n/locales/en/shell.ts`
- Modify: `tests/setup.ts`
- Test: `tests/unit/i18n/language.test.ts`, `tests/unit/i18n/parity.test.ts`, `tests/unit/i18n/format.test.ts`

- [ ] **Step 1: Zainstaluj zależności i sprawdź nazwę opcji synchronicznego initu**

Run: `npm install i18next@^27 react-i18next@^18 && grep -rn "initAsync" node_modules/i18next/typescript/options.d.ts | head -3`
Expected: pakiety w `package.json` (`dependencies`); grep znajduje `initAsync?: boolean` (jeśli nazwa jest inna, np. `initImmediate`, użyj jej w Step 5 zamiast `initAsync`).

- [ ] **Step 2: Napisz czerwone testy**

`tests/unit/i18n/language.test.ts`:

```ts
import { afterEach, describe, expect, test, vi } from "vitest";
import i18n, { LANG_KEY, currentLang, readStoredLanguage, setLanguage } from "@/src/i18n";

afterEach(() => vi.restoreAllMocks());

describe("setLanguage / readStoredLanguage", () => {
  test("setLanguage('en') zapisuje wybór i ustawia <html lang>", async () => {
    await setLanguage("en");
    expect(window.localStorage.getItem(LANG_KEY)).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    expect(currentLang()).toBe("en");
  });

  test("zapisany 'en' jest odczytany", () => {
    window.localStorage.setItem(LANG_KEY, "en");
    expect(readStoredLanguage()).toBe("en");
  });

  test("nieznana wartość w storage → pl", () => {
    window.localStorage.setItem(LANG_KEY, "de");
    expect(readStoredLanguage()).toBe("pl");
  });

  test("brak wartości → pl", () => {
    expect(readStoredLanguage()).toBe("pl");
  });

  test("wyjątek odczytu → pl", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(readStoredLanguage()).toBe("pl");
  });

  test("wyjątek zapisu nie psuje przełączenia języka", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    await setLanguage("en");
    expect(currentLang()).toBe("en");
    expect(document.documentElement.lang).toBe("en");
  });
});

describe("plural ostrzeżeń (shell:statusbar.warnings)", () => {
  const pl = (count: number) => i18n.t("shell:statusbar.warnings", { count, lng: "pl" });
  const en = (count: number) => i18n.t("shell:statusbar.warnings", { count, lng: "en" });

  test("PL: 1 → ostrzeżenie, 2 → ostrzeżenia, 5 → ostrzeżeń, 22 → ostrzeżenia", () => {
    expect(pl(1)).toBe("1 ostrzeżenie");
    expect(pl(2)).toBe("2 ostrzeżenia");
    expect(pl(5)).toBe("5 ostrzeżeń");
    expect(pl(22)).toBe("22 ostrzeżenia");
  });

  test("EN: 1 → warning, 2 → warnings", () => {
    expect(en(1)).toBe("1 warning");
    expect(en(2)).toBe("2 warnings");
  });
});
```

`tests/unit/i18n/parity.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { resources } from "@/src/i18n/resources";

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

function flatten(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === "string"
      ? [`${prefix}${k}`.replace(PLURAL_SUFFIX, "")]
      : flatten(v as Record<string, unknown>, `${prefix}${k}.`)
  );
}

const unique = (xs: string[]) => [...new Set(xs)].sort();

describe("parytet słowników PL/EN", () => {
  test("te same namespace'y", () => {
    expect(Object.keys(resources.en).sort()).toEqual(Object.keys(resources.pl).sort());
  });

  test.each(Object.keys(resources.pl))(
    "namespace %s: te same klucze (bez sufiksów plural)",
    (ns) => {
      const pl = unique(flatten(resources.pl[ns as keyof typeof resources.pl]));
      const en = unique(flatten(resources.en[ns as keyof typeof resources.en]));
      expect(en).toEqual(pl);
    }
  );

  test("żadna wartość nie jest pusta", () => {
    for (const lang of ["pl", "en"] as const) {
      for (const [ns, dict] of Object.entries(resources[lang])) {
        const empty = JSON.stringify(dict).includes('":""');
        expect(empty, `${lang}/${ns} ma pustą wartość`).toBe(false);
      }
    }
  });
});
```

`tests/unit/i18n/format.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { setLanguage } from "@/src/i18n";
import { formatDate } from "@/src/i18n/format";

const MONDAY = new Date(2026, 10, 16);

describe("formatDate", () => {
  test("PL: poniedziałek, 16 listopada", () => {
    expect(formatDate(MONDAY, "pl")).toBe("poniedziałek, 16 listopada");
  });

  test("EN: Monday, November 16", () => {
    expect(formatDate(MONDAY, "en")).toBe("Monday, November 16");
  });

  test("bez drugiego argumentu bierze bieżący język", async () => {
    expect(formatDate(MONDAY)).toBe("poniedziałek, 16 listopada");
    await setLanguage("en");
    expect(formatDate(MONDAY)).toBe("Monday, November 16");
  });
});
```

- [ ] **Step 3: Uruchom testy: mają paść**

Run: `npx vitest run tests/unit/i18n`
Expected: FAIL (`Failed to resolve import "@/src/i18n"`).

- [ ] **Step 4: Słowniki**

`src/i18n/locales/pl/common.ts`:

```ts
export const common = {
  close: "Zamknij",
  feedback: "Feedback",
  feedbackFrameTitle: "Feedback – Monolith BETA",
  theme: "Motyw",
  lang: {
    switchToEn: "Zmień język na angielski (EN)",
    switchToPl: "Zmień język na polski (PL)",
    /** Kod języka, na który przełączy przycisk (szufladka „Więcej”). */
    nextCode: "EN",
  },
};
```

`src/i18n/locales/en/common.ts`:

```ts
export const common = {
  close: "Close",
  feedback: "Feedback",
  feedbackFrameTitle: "Feedback – Monolith BETA",
  theme: "Theme",
  lang: {
    switchToEn: "Switch language to English (EN)",
    switchToPl: "Switch language to Polish (PL)",
    nextCode: "PL",
  },
};
```

`src/i18n/locales/pl/shell.ts`:

```ts
export const shell = {
  cards: {
    kokpit: "Kokpit",
    kalendarz: "Kalendarz",
    zadania: "Zadania",
    projekty: "Projekty",
    notatki: "Notatki",
    plotno: "Płótno",
    arsenal: "Arsenał",
    mapa: "Mapa",
    kodeks: "Kodeks",
  },
  rail: {
    aria: "Karty",
    cardTitle: "{{label}} (Alt+{{hotkey}})",
    palette: "Paleta poleceń (Ctrl+K)",
  },
  palette: {
    aria: "Paleta poleceń",
    inputAria: "Polecenie",
    placeholder: "Wpisz polecenie lub nazwę…",
    listAria: "Polecenia",
    empty: "Brak wyników",
    goTo: "Przejdź: {{card}}",
    toggleTheme: "Przełącz motyw jasny / ciemny",
    sendFeedback: "Wyślij feedback",
  },
  statusbar: {
    aria: "Pasek statusu",
    project: "projekt",
    branch: "branch",
    vault: "vault",
    synced: "zsynchronizowany",
    warnings_one: "{{count}} ostrzeżenie",
    warnings_few: "{{count}} ostrzeżenia",
    warnings_many: "{{count}} ostrzeżeń",
    warnings_other: "{{count}} ostrzeżenia",
    hints: "Alt+1…9 karty · Alt+I inbox · Ctrl+K polecenia",
  },
  mobileNav: {
    home: "Home",
    tasks: "Zadania",
    notes: "Notatki",
    calendar: "Kalendarz",
    more: "Więcej",
  },
  drawer: {
    activity: "Moja praca",
    tags: "Tagi",
    resources: "Zasoby",
    skills: "Skille i prompty",
    mindmaps: "Mapy myśli",
    board: "Tablica",
  },
};
```

`src/i18n/locales/en/shell.ts`:

```ts
export const shell = {
  cards: {
    kokpit: "Cockpit",
    kalendarz: "Calendar",
    zadania: "Tasks",
    projekty: "Projects",
    notatki: "Notes",
    plotno: "Canvas",
    arsenal: "Arsenal",
    mapa: "Map",
    kodeks: "Codex",
  },
  rail: {
    aria: "Cards",
    cardTitle: "{{label}} (Alt+{{hotkey}})",
    palette: "Command palette (Ctrl+K)",
  },
  palette: {
    aria: "Command palette",
    inputAria: "Command",
    placeholder: "Type a command or name…",
    listAria: "Commands",
    empty: "No results",
    goTo: "Go to: {{card}}",
    toggleTheme: "Toggle light / dark theme",
    sendFeedback: "Send feedback",
  },
  statusbar: {
    aria: "Status bar",
    project: "project",
    branch: "branch",
    vault: "vault",
    synced: "in sync",
    warnings_one: "{{count}} warning",
    warnings_other: "{{count}} warnings",
    hints: "Alt+1…9 cards · Alt+I inbox · Ctrl+K commands",
  },
  mobileNav: {
    home: "Home",
    tasks: "Tasks",
    notes: "Notes",
    calendar: "Calendar",
    more: "More",
  },
  drawer: {
    activity: "My Work",
    tags: "Tags",
    resources: "Resources",
    skills: "Skills & prompts",
    mindmaps: "Mind Maps",
    board: "Board",
  },
};
```

- [ ] **Step 5: Instancja, zasoby, typy, hook, format**

`src/i18n/resources.ts`:

```ts
import { common as plCommon } from "./locales/pl/common";
import { shell as plShell } from "./locales/pl/shell";
import { common as enCommon } from "./locales/en/common";
import { shell as enShell } from "./locales/en/shell";

export const resources = {
  pl: { common: plCommon, shell: plShell },
  en: { common: enCommon, shell: enShell },
};
```

`src/i18n/index.ts`:

```ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { resources } from "./resources";

export type Lang = "pl" | "en";
export const DEFAULT_LANG: Lang = "pl";
export const LANG_KEY = "monolith.lang";

export function isLang(value: unknown): value is Lang {
  return value === "pl" || value === "en";
}

/** Zapisany wybór; nieznana wartość, brak `window` albo wyjątek odczytu → `pl`. */
export function readStoredLanguage(): Lang {
  try {
    const value = window.localStorage.getItem(LANG_KEY);
    return isLang(value) ? value : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

export function currentLang(): Lang {
  return isLang(i18n.language) ? i18n.language : DEFAULT_LANG;
}

/** Zmienia język, zapisuje wybór (błąd zapisu jest ignorowany) i ustawia `<html lang>`. */
export async function setLanguage(lang: Lang): Promise<void> {
  await i18n.changeLanguage(lang);
  try {
    window.localStorage.setItem(LANG_KEY, lang);
  } catch {
    // preferencja nie jest krytyczna: język działa do końca sesji
  }
  document.documentElement.lang = lang;
}

/** Stosuje zapisany wybór bez ponownego zapisu (start aplikacji). */
export async function applyStoredLanguage(): Promise<void> {
  const lang = readStoredLanguage();
  await i18n.changeLanguage(lang);
  document.documentElement.lang = lang;
}

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources,
    lng: DEFAULT_LANG,
    fallbackLng: DEFAULT_LANG,
    defaultNS: "common",
    ns: ["common", "shell"],
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    initAsync: false,
  });
}

export default i18n;
```

`src/i18n/i18next.d.ts`:

```ts
import "i18next";
import type { resources } from "./resources";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    resources: (typeof resources)["pl"];
  }
}
```

`src/i18n/useLang.ts`:

```ts
"use client";

import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { DEFAULT_LANG, isLang, setLanguage, type Lang } from "./index";

export function useLang() {
  const { i18n } = useTranslation();
  const lang: Lang = isLang(i18n.language) ? i18n.language : DEFAULT_LANG;
  const setLang = useCallback((next: Lang) => {
    void setLanguage(next);
  }, []);
  const toggleLang = useCallback(() => {
    void setLanguage(lang === "pl" ? "en" : "pl");
  }, [lang]);
  return { lang, setLang, toggleLang };
}
```

`src/i18n/format.ts`:

```ts
import { currentLang, type Lang } from "./index";

const LOCALE: Record<Lang, string> = { pl: "pl-PL", en: "en-US" };

/** „poniedziałek, 16 listopada” / „Monday, November 16”. */
export function formatDate(date: Date, lang: Lang = currentLang()): string {
  return new Intl.DateTimeFormat(LOCALE[lang], {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}
```

- [ ] **Step 6: Setup testów (i18n w PL, czysty storage)**

Zastąp `tests/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
import { beforeEach } from "vitest";
import i18n, { LANG_KEY } from "@/src/i18n";

// Każdy test startuje po polsku i bez zapisanego wyboru (część testów działa w środowisku node).
beforeEach(async () => {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(LANG_KEY);
    document.documentElement.lang = "pl";
  }
  if (i18n.language !== "pl") await i18n.changeLanguage("pl");
});
```

- [ ] **Step 7: Testy mają przejść; typy i pełny zestaw bez regresji**

Run: `npx vitest run tests/unit/i18n && npx tsc --noEmit && npx vitest run`
Expected: nowe testy PASS, `tsc` bez błędów, cały zestaw zielony (nic jeszcze nie zmienia komponentów).

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/i18n tests/setup.ts tests/unit/i18n
git commit -m "feat(i18n): fundament języka PL/EN (i18next, słowniki common i shell, format dat)"
```

---

## Task 2: `I18nProvider` z bramką i podpięcie w layoucie

**Files:**

- Create: `src/i18n/I18nProvider.tsx`
- Modify: `app/layout.tsx:25`
- Test: `tests/unit/i18n/I18nProvider.test.tsx`

- [ ] **Step 1: Napisz czerwony test**

`tests/unit/i18n/I18nProvider.test.tsx`:

```tsx
import React from "react";
import { describe, expect, test } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import i18n, { LANG_KEY } from "@/src/i18n";
import { I18nProvider } from "@/src/i18n/I18nProvider";
import { useLang } from "@/src/i18n/useLang";
import { useTranslation } from "react-i18next";

function Probe({ seen }: { seen: string[] }) {
  const { t } = useTranslation("shell");
  const { toggleLang } = useLang();
  const label = t("rail.aria");
  seen.push(label);
  return (
    <button type="button" onClick={toggleLang}>
      {label}
    </button>
  );
}

describe("I18nProvider", () => {
  test("zapisany 'en': dzieci nigdy nie renderują się po polsku (brak mignięcia)", async () => {
    window.localStorage.setItem(LANG_KEY, "en");
    const seen: string[] = [];
    render(
      <I18nProvider>
        <Probe seen={seen} />
      </I18nProvider>
    );
    expect(await screen.findByRole("button", { name: "Cards" })).toBeInTheDocument();
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((label) => label === "Cards")).toBe(true);
    expect(document.documentElement.lang).toBe("en");
  });

  test("bez zapisu: renderuje po polsku", async () => {
    render(
      <I18nProvider>
        <Probe seen={[]} />
      </I18nProvider>
    );
    expect(await screen.findByRole("button", { name: "Karty" })).toBeInTheDocument();
  });

  test("przełączenie zmienia teksty bez przeładowania, a po ponownym zamontowaniu wybór zostaje", async () => {
    const { unmount } = render(
      <I18nProvider>
        <Probe seen={[]} />
      </I18nProvider>
    );
    (await screen.findByRole("button", { name: "Karty" })).click();
    expect(await screen.findByRole("button", { name: "Cards" })).toBeInTheDocument();
    expect(window.localStorage.getItem(LANG_KEY)).toBe("en");

    unmount();
    cleanup();
    // symulacja F5: pamięć wraca do PL, zostaje tylko storage
    await act(async () => {
      await i18n.changeLanguage("pl");
    });
    render(
      <I18nProvider>
        <Probe seen={[]} />
      </I18nProvider>
    );
    expect(await screen.findByRole("button", { name: "Cards" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Uruchom test: ma paść**

Run: `npx vitest run tests/unit/i18n/I18nProvider.test.tsx`
Expected: FAIL (`Failed to resolve import "@/src/i18n/I18nProvider"`).

- [ ] **Step 3: Implementacja**

`src/i18n/I18nProvider.tsx`:

```tsx
"use client";

import React, { useEffect, useState } from "react";
import { I18nextProvider } from "react-i18next";
import i18n, { applyStoredLanguage } from "./index";

/**
 * Renderuje `children` dopiero po zastosowaniu zapisanego języka, żeby użytkownik EN
 * nie widział mignięcia PL po F5 (HTML z serwera jest pusty; aplikacja jest klientowa).
 */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void applyStoredLanguage().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return <I18nextProvider i18n={i18n}>{ready ? children : null}</I18nextProvider>;
}
```

W `app/layout.tsx` dodaj import `import { I18nProvider } from "@/src/i18n/I18nProvider";` obok importu `ThemeProvider` i zmień:

```tsx
<ThemeProvider>{children}</ThemeProvider>
```

na:

```tsx
<ThemeProvider>
  <I18nProvider>{children}</I18nProvider>
</ThemeProvider>
```

- [ ] **Step 4: Test ma przejść**

Run: `npx vitest run tests/unit/i18n && npx tsc --noEmit`
Expected: PASS, brak błędów typów.

- [ ] **Step 5: Commit**

```bash
git add src/i18n/I18nProvider.tsx app/layout.tsx tests/unit/i18n/I18nProvider.test.tsx
git commit -m "feat(i18n): I18nProvider z bramką po odczycie języka, podpięty w layoucie"
```

---

## Task 3: Rail kart i karty z kluczy (przycisk PL/EN)

**Files:**

- Modify: `src/features/cards/cards.ts:23-45,105-112`, `src/features/cards/CardRail.tsx`, `src/features/cards/cards.css` (po `.card-rail__cmd:hover`, ok. linia 139), `src/App.tsx:50`
- Test: `tests/unit/features/cards/CardRail.test.tsx`, `tests/unit/features/cards/cards.test.ts:43`, `tests/unit/features/cards/cardCommands.test.ts`

- [ ] **Step 1: Zmień testy na czerwone**

`tests/unit/features/cards/cards.test.ts:43`: usuń `label: "Kodeks"` z `toMatchObject` → `expect(CARDS[CARDS.length - 1]).toMatchObject({ id: "kodeks", hotkey: 9 });`.

`tests/unit/features/cards/cardCommands.test.ts` (cały plik):

```ts
import { test, expect, vi } from "vitest";
import i18n from "@/src/i18n";
import { buildCardCommands } from "@/src/features/cards/cards";

test("buduje 9 komend Przejdź z podpowiedzią skrótu", () => {
  const selectCard = vi.fn();
  const cmds = buildCardCommands(selectCard, i18n.t);
  expect(cmds).toHaveLength(9);
  expect(cmds[5]).toMatchObject({ id: "go-plotno", label: "Przejdź: Płótno", hint: "Alt+6" });
  cmds[5].run();
  expect(selectCard).toHaveBeenCalledWith("plotno");
});

test("ostatnia komenda przechodzi do Kodeksu z hintem Alt+9", () => {
  const selectCard = vi.fn();
  const cmds = buildCardCommands(selectCard, i18n.t);
  expect(cmds[8]).toMatchObject({ id: "go-kodeks", label: "Przejdź: Kodeks", hint: "Alt+9" });
  cmds[8].run();
  expect(selectCard).toHaveBeenCalledWith("kodeks");
});

test("po angielsku: Go to: Canvas", () => {
  const cmds = buildCardCommands(vi.fn(), i18n.getFixedT("en"));
  expect(cmds[5]).toMatchObject({ id: "go-plotno", label: "Go to: Canvas", hint: "Alt+6" });
});
```

W `tests/unit/features/cards/CardRail.test.tsx` zmień importy na:

```tsx
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { CardRail } from "@/src/features/cards/CardRail";
import { setLanguage } from "@/src/i18n";
```

i dopisz na końcu `describe`:

```tsx
test("po angielsku: aria-label „Cards” i angielskie etykiety kart", async () => {
  await act(async () => {
    await setLanguage("en");
  });
  render(<CardRail activeCard="kokpit" onSelect={vi.fn()} onOpenPalette={vi.fn()} />);
  expect(screen.getByRole("navigation", { name: "Cards" })).toBeInTheDocument();
  const labels = [...document.querySelectorAll(".card-rail__label")].map((n) => n.textContent);
  expect(labels).toEqual([
    "Cockpit",
    "Calendar",
    "Tasks",
    "Projects",
    "Notes",
    "Canvas",
    "Arsenal",
    "Map",
    "Codex",
  ]);
  expect(screen.getByRole("button", { name: /Canvas/ })).toHaveAttribute("title", "Canvas (Alt+6)");
  expect(screen.getByRole("button", { name: "Command palette (Ctrl+K)" })).toBeInTheDocument();
});

test("przycisk PL/EN przełącza język i zapisuje wybór", async () => {
  render(<CardRail activeCard="kokpit" onSelect={vi.fn()} onOpenPalette={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Zmień język na angielski (EN)" }));
  expect(await screen.findByRole("navigation", { name: "Cards" })).toBeInTheDocument();
  expect(window.localStorage.getItem("monolith.lang")).toBe("en");
  fireEvent.click(screen.getByRole("button", { name: "Switch language to Polish (PL)" }));
  expect(await screen.findByRole("navigation", { name: "Karty" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Uruchom: mają paść**

Run: `npx vitest run tests/unit/features/cards/CardRail.test.tsx tests/unit/features/cards/cardCommands.test.ts`
Expected: FAIL (CardRail bez tłumaczeń, `buildCardCommands` ignoruje 2. argument, brak przycisku języka).

- [ ] **Step 3: `cards.ts`**

W `CardDef` usuń pole `label`:

```ts
export interface CardDef {
  id: CardId;
  hotkey: number;
  target: CardTarget;
}
```

W `CARDS` usuń `label: "…",` z każdej z 9 pozycji (zostają `id`, `hotkey`, `target`), np. `{ id: "kokpit", hotkey: 1, target: { kind: "home" } },` oraz `{ id: "plotno", hotkey: 6, target: { kind: "planning", tab: "board" } },`.

Na górze pliku dodaj `import type { TFunction } from "i18next";`, a `buildCardCommands` zastąp:

```ts
export function buildCardCommands(
  selectCard: (id: CardId) => void,
  t: TFunction
): PaletteCommand[] {
  return CARDS.map((card) => ({
    id: `go-${card.id}`,
    label: t("shell:palette.goTo", { card: t(`shell:cards.${card.id}`) }),
    hint: `Alt+${card.hotkey}`,
    run: () => selectCard(card.id),
  }));
}
```

- [ ] **Step 4: `CardRail.tsx`**

Zastąp plik:

```tsx
"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import { useLang } from "@/src/i18n/useLang";
import { CARDS, type CardId } from "./cards";

export interface CardRailProps {
  activeCard: CardId;
  onSelect: (id: CardId) => void;
  onOpenPalette: () => void;
}

export function CardRail({ activeCard, onSelect, onOpenPalette }: CardRailProps) {
  const { t } = useTranslation(["shell", "common"]);
  const { lang, toggleLang } = useLang();
  const langLabel = lang === "pl" ? t("common:lang.switchToEn") : t("common:lang.switchToPl");
  return (
    <nav className="card-rail" aria-label={t("shell:rail.aria")}>
      <div className="card-rail__logo" aria-hidden="true">
        M
      </div>
      {CARDS.map((card) => {
        const label = t(`shell:cards.${card.id}`);
        return (
          <button
            key={card.id}
            type="button"
            data-card-id={card.id}
            className="card-rail__item"
            style={{ "--c": `var(--c-${card.id})` } as React.CSSProperties}
            aria-current={card.id === activeCard ? "page" : undefined}
            title={t("shell:rail.cardTitle", { label, hotkey: card.hotkey })}
            onClick={() => onSelect(card.id)}
          >
            <span className="card-rail__num" aria-hidden="true">
              {card.hotkey}
            </span>
            <span className="card-rail__label">{label}</span>
          </button>
        );
      })}
      <div className="card-rail__spacer" />
      <button
        type="button"
        className="card-rail__lang"
        aria-label={langLabel}
        title={langLabel}
        onClick={toggleLang}
      >
        <span className={lang === "pl" ? "is-active" : undefined}>PL</span>
        <span className={lang === "en" ? "is-active" : undefined}>EN</span>
      </button>
      <button
        type="button"
        className="card-rail__cmd"
        aria-label={t("shell:rail.palette")}
        title={t("shell:rail.palette")}
        onClick={onOpenPalette}
      >
        ⌘K
      </button>
    </nav>
  );
}
```

- [ ] **Step 5: CSS przycisku**

W `src/features/cards/cards.css` zaraz po bloku `.card-rail__cmd:hover { … }` dodaj:

```css
.card-rail__lang {
  width: 44px;
  height: 28px;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 1px solid var(--shell-line);
  border-radius: 10px;
  background: transparent;
  color: var(--shell-muted);
  font: 500 10px/1 var(--font-mono);
  cursor: pointer;
}

.card-rail__lang:hover {
  color: var(--shell-text);
}

.card-rail__lang .is-active {
  color: var(--shell-text);
  font-weight: 700;
}
```

- [ ] **Step 6: `App.tsx`: tymczasowo podaj `t` do `buildCardCommands`**

W `src/App.tsx` dodaj import `import { useTranslation } from "react-i18next";`, w `App()` po `const t = translations[lang];` dodaj `const { t: tShell } = useTranslation();`, a w `paletteCommands` zmień pierwszą pozycję i zależności:

```tsx
const paletteCommands = useMemo(
  () => [
    ...buildCardCommands(selectCard, tShell),
    ...buildAppCommands({ lang, toggleLang, toggleTheme, openFeedback }),
  ],
  [selectCard, tShell, lang, toggleLang, toggleTheme, openFeedback]
);
```

(`lang` w `App` na razie nadal z `useState`; most z `useLang()` dopiero w Task 6.)

- [ ] **Step 7: Testy, typy**

Run: `npx vitest run tests/unit/features/cards && npx tsc --noEmit`
Expected: PASS, brak błędów typów (jeśli `tsc` zgłasza klucz `shell:cards.${…}` jako nieznany, zawęź `card.id` do `CardId` w wywołaniu: `t(\`shell:cards.${card.id as CardId}\`)`).

- [ ] **Step 8: Commit**

```bash
git add src/features/cards src/App.tsx tests/unit/features/cards
git commit -m "feat(i18n): rail kart i etykiety kart z kluczy, widoczny przycisk PL/EN"
```

---

## Task 4: Paleta poleceń i polecenia ustawień

**Files:**

- Modify: `src/features/cards/CommandPalette.tsx`, `src/features/cards/appCommands.ts`, `src/App.tsx` (wywołanie `buildAppCommands`)
- Test: `tests/unit/features/cards/CommandPalette.test.tsx`, `tests/unit/features/cards/appCommands.test.ts`

- [ ] **Step 1: Zmień testy na czerwone**

`tests/unit/features/cards/appCommands.test.ts` (cały plik):

```ts
import { describe, expect, test, vi } from "vitest";
import i18n from "@/src/i18n";
import { buildAppCommands } from "@/src/features/cards/appCommands";
import { filterCommands } from "@/src/features/cards/cards";

const make = (lang: "pl" | "en") => {
  const actions = {
    lang,
    toggleLang: vi.fn(),
    toggleTheme: vi.fn(),
    openFeedback: vi.fn(),
    t: i18n.getFixedT(lang),
  };
  return { actions, commands: buildAppCommands(actions) };
};

describe("buildAppCommands", () => {
  test("trzy polecenia ustawień wołają odpowiednie akcje", () => {
    const { actions, commands } = make("pl");
    expect(commands.map((c) => c.id)).toEqual(["toggle-lang", "toggle-theme", "open-feedback"]);
    commands.forEach((c) => c.run());
    expect(actions.toggleLang).toHaveBeenCalledTimes(1);
    expect(actions.toggleTheme).toHaveBeenCalledTimes(1);
    expect(actions.openFeedback).toHaveBeenCalledTimes(1);
  });

  test("etykieta języka zależy od bieżącego języka", () => {
    expect(make("pl").commands[0].label).toBe("Zmień język na angielski (EN)");
    expect(make("en").commands[0].label).toBe("Switch language to Polish (PL)");
  });

  test("etykiety po angielsku", () => {
    const labels = make("en").commands.map((c) => c.label);
    expect(labels).toEqual([
      "Switch language to Polish (PL)",
      "Toggle light / dark theme",
      "Send feedback",
    ]);
  });

  test("da się je znaleźć w palecie po słowie kluczowym", () => {
    const { commands } = make("pl");
    expect(filterCommands(commands, "motyw").map((c) => c.id)).toEqual(["toggle-theme"]);
    expect(filterCommands(commands, "feedback").map((c) => c.id)).toEqual(["open-feedback"]);
  });
});
```

W `tests/unit/features/cards/CommandPalette.test.tsx` dopisz na końcu głównego `describe` (dodaj `act` do importów z `@testing-library/react` i `import { setLanguage } from "@/src/i18n";`; `cmds()` to istniejąca w pliku funkcja zwracająca listę poleceń):

```tsx
test("po angielsku: etykiety okna, pola i pustego wyniku", async () => {
  await act(async () => {
    await setLanguage("en");
  });
  render(<CommandPalette commands={cmds()} onClose={vi.fn()} />);
  expect(screen.getByRole("dialog", { name: "Command palette" })).toBeInTheDocument();
  const input = screen.getByRole("textbox", { name: "Command" });
  expect(input).toHaveAttribute("placeholder", "Type a command or name…");
  expect(screen.getByRole("listbox", { name: "Commands" })).toBeInTheDocument();
  fireEvent.change(input, { target: { value: "zzzz" } });
  expect(screen.getByText("No results")).toBeInTheDocument();
});
```

- [ ] **Step 2: Uruchom: mają paść**

Run: `npx vitest run tests/unit/features/cards/appCommands.test.ts tests/unit/features/cards/CommandPalette.test.tsx`
Expected: FAIL (angielskie etykiety, brak parametru `t`).

- [ ] **Step 3: `appCommands.ts`**

Zastąp plik:

```ts
import type { TFunction } from "i18next";
import type { PaletteCommand } from "./cards";

export interface AppCommandActions {
  lang: "en" | "pl";
  toggleLang: () => void;
  toggleTheme: () => void;
  openFeedback: () => void;
  t: TFunction;
}

/** Polecenia ustawień w palecie Ctrl+K (zastępują dawny górny pasek). */
export function buildAppCommands(actions: AppCommandActions): PaletteCommand[] {
  const { t } = actions;
  return [
    {
      id: "toggle-lang",
      label: actions.lang === "pl" ? t("common:lang.switchToEn") : t("common:lang.switchToPl"),
      run: actions.toggleLang,
    },
    { id: "toggle-theme", label: t("shell:palette.toggleTheme"), run: actions.toggleTheme },
    { id: "open-feedback", label: t("shell:palette.sendFeedback"), run: actions.openFeedback },
  ];
}
```

- [ ] **Step 4: `CommandPalette.tsx`**

Dodaj import `import { useTranslation } from "react-i18next";`, na początku komponentu (przed `useState`) `const { t } = useTranslation("shell");` i podmień teksty:

- `aria-label="Paleta poleceń"` → `aria-label={t("palette.aria")}`
- `aria-label="Polecenie"` → `aria-label={t("palette.inputAria")}`
- `placeholder="Wpisz polecenie lub nazwę…"` → `placeholder={t("palette.placeholder")}`
- `aria-label="Polecenia"` → `aria-label={t("palette.listAria")}`
- `Brak wyników` → `{t("palette.empty")}`

- [ ] **Step 5: `App.tsx`: przekaż `t` do `buildAppCommands`**

```tsx
      ...buildAppCommands({ lang, toggleLang, toggleTheme, openFeedback, t: tShell }),
```

- [ ] **Step 6: Testy, typy**

Run: `npx vitest run tests/unit/features/cards && npx tsc --noEmit`
Expected: PASS, brak błędów typów.

- [ ] **Step 7: Commit**

```bash
git add src/features/cards src/App.tsx tests/unit/features/cards
git commit -m "feat(i18n): paleta poleceń i polecenia ustawień z kluczy"
```

---

## Task 5: Pasek statusu (`StatusBar`) z pluralem

**Files:**

- Modify: `src/features/home/StatusBar.tsx`
- Test: `tests/unit/features/home/HomeView.test.tsx:735`, `tests/unit/features/home/statusBar.test.tsx` (nowy)

- [ ] **Step 1: Zmień/dopisz testy na czerwone**

`tests/unit/features/home/HomeView.test.tsx:735`: zmień oczekiwanie na `toHaveTextContent("1 ostrzeżenie")` (poprawny plural zamiast „1 ostrzeżeń”).

`tests/unit/features/home/statusBar.test.tsx`:

```tsx
import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";
import { setLanguage } from "@/src/i18n";
import { StatusBar } from "@/src/features/home/StatusBar";

const NOW = new Date(2026, 10, 16, 14, 5);

beforeEach(() => cleanup());

describe("StatusBar", () => {
  test("PL: projekt, branch, vault zsynchronizowany, podpowiedź skrótów i godzina", () => {
    render(<StatusBar projectId="monolith" branch="main" warningsCount={0} now={NOW} />);
    const bar = screen.getByLabelText("Pasek statusu");
    expect(bar).toHaveTextContent("projekt monolith");
    expect(bar).toHaveTextContent("branch main");
    expect(bar).toHaveTextContent("vault zsynchronizowany");
    expect(bar).toHaveTextContent("Alt+1…9 karty · Alt+I inbox · Ctrl+K polecenia");
    expect(bar).toHaveTextContent("14:05");
  });

  test.each([
    [1, "1 ostrzeżenie"],
    [2, "2 ostrzeżenia"],
    [5, "5 ostrzeżeń"],
    [22, "22 ostrzeżenia"],
  ])("PL: %i ostrzeżeń → %s", (count, text) => {
    render(<StatusBar projectId={null} warningsCount={count} now={NOW} />);
    expect(screen.getByLabelText("Pasek statusu")).toHaveTextContent(text);
  });

  test("EN: etykiety, plural i godzina 24 h", async () => {
    await act(async () => {
      await setLanguage("en");
    });
    const { rerender } = render(
      <StatusBar projectId="monolith" branch="main" warningsCount={0} now={NOW} />
    );
    const bar = screen.getByLabelText("Status bar");
    expect(bar).toHaveTextContent("project monolith");
    expect(bar).toHaveTextContent("vault in sync");
    expect(bar).toHaveTextContent("Alt+1…9 cards · Alt+I inbox · Ctrl+K commands");
    expect(bar).toHaveTextContent("14:05");
    rerender(<StatusBar projectId="monolith" branch="main" warningsCount={1} now={NOW} />);
    expect(screen.getByLabelText("Status bar")).toHaveTextContent("1 warning");
    rerender(<StatusBar projectId="monolith" branch="main" warningsCount={3} now={NOW} />);
    expect(screen.getByLabelText("Status bar")).toHaveTextContent("3 warnings");
  });

  test("bez projektu i brancha ukrywa te pozycje", () => {
    render(<StatusBar projectId={null} warningsCount={0} now={NOW} />);
    const bar = screen.getByLabelText("Pasek statusu");
    expect(bar).not.toHaveTextContent("projekt");
    expect(bar).not.toHaveTextContent("branch");
  });
});
```

- [ ] **Step 2: Uruchom: mają paść**

Run: `npx vitest run tests/unit/features/home/statusBar.test.tsx`
Expected: FAIL na przypadkach EN i plural (teksty wpisane na stałe).

- [ ] **Step 3: `StatusBar.tsx`**

Dodaj `import { useTranslation } from "react-i18next";`, w komponencie `const { t } = useTranslation("shell");` i zastąp zwracany JSX:

```tsx
return (
  <footer className="kok-statusbar" aria-label={t("statusbar.aria")}>
    <div className="kok-statusbar__left">
      {projectId ? (
        <span>
          {t("statusbar.project")} <b>{projectId}</b>
        </span>
      ) : null}
      {branch ? (
        <span>
          {t("statusbar.branch")} <b>{branch}</b>
        </span>
      ) : null}
      <span className={`kok-statusbar__vault ${ok ? "is-ok" : "is-warn"}`}>
        <i aria-hidden="true" />
        {t("statusbar.vault")}{" "}
        <b>{ok ? t("statusbar.synced") : t("statusbar.warnings", { count: warningsCount })}</b>
      </span>
    </div>
    <div className="kok-statusbar__right">
      <span>{t("statusbar.hints")}</span>
      <b>{hhmm(now.getHours() * 60 + now.getMinutes())}</b>
    </div>
  </footer>
);
```

- [ ] **Step 4: Testy, typy, cały HomeView**

Run: `npx vitest run tests/unit/features/home && npx tsc --noEmit`
Expected: PASS (wszystkie testy `HomeView`, w tym zmieniony „1 ostrzeżenie”), brak błędów typów.

- [ ] **Step 5: Commit**

```bash
git add src/features/home/StatusBar.tsx tests/unit/features/home
git commit -m "feat(i18n): pasek statusu z kluczy, poprawny plural ostrzeżeń (1 ostrzeżenie)"
```

---

## Task 6: Dolna nawigacja, szufladka „Więcej”, feedback i most w `App`

Te trzy komponenty tracą prop `lang` / `title`, więc razem z `App.tsx` muszą wejść w jednym commicie (`tsc` ma przechodzić po każdym commicie).

**Files:**

- Modify: `src/components/layout/MobileNav.tsx`, `src/components/layout/MobileMoreDrawer.tsx`, `src/components/layout/FeedbackModal.tsx`, `src/App.tsx`
- Test: `tests/unit/components/layout/MobileNav.test.tsx`, `tests/unit/components/layout/MobileMoreDrawer.test.tsx`, `tests/unit/components/layout/FeedbackModal.test.tsx` (nowy)

- [ ] **Step 1: Zmień/dopisz testy na czerwone**

`tests/unit/components/layout/MobileNav.test.tsx`: usuń linię `lang="pl"` z każdego z trzech `<MobileNav … />`, dodaj do importów `act` (z `@testing-library/react`) i `import { setLanguage } from "@/src/i18n";` i dopisz na końcu pliku:

```tsx
test("po angielsku etykiety zakładek są angielskie", async () => {
  await act(async () => {
    await setLanguage("en");
  });
  render(
    <MobileNav
      appMode="home"
      setAppMode={vi.fn()}
      planningTab="tasks"
      setPlanningTab={vi.fn()}
      onMoreOpen={vi.fn()}
    />
  );
  expect(screen.getByLabelText("Home")).toBeInTheDocument();
  expect(screen.getByLabelText("Tasks")).toBeInTheDocument();
  expect(screen.getByLabelText("Notes")).toBeInTheDocument();
  expect(screen.getByLabelText("Calendar")).toBeInTheDocument();
  expect(screen.getByLabelText("More")).toBeInTheDocument();
});
```

`tests/unit/components/layout/MobileMoreDrawer.test.tsx`: usuń `lang="pl"` z każdego `<MobileMoreDrawer … />` (w tym w `rerender`), dodaj `act` do importów z `@testing-library/react`, `import { setLanguage } from "@/src/i18n";` i dopisz na końcu:

```tsx
test("po angielsku: pozycje menu i przyciski ustawień są angielskie", async () => {
  await act(async () => {
    await setLanguage("en");
  });
  render(
    <MobileMoreDrawer
      isOpen={true}
      onClose={vi.fn()}
      onSelectTab={vi.fn()}
      onToggleLang={vi.fn()}
      onToggleTheme={vi.fn()}
      onFeedback={vi.fn()}
    />
  );
  expect(screen.getByText("My Work")).toBeInTheDocument();
  expect(screen.getByText("Resources")).toBeInTheDocument();
  expect(screen.getByText("Skills & prompts")).toBeInTheDocument();
  expect(screen.getByText("Mind Maps")).toBeInTheDocument();
  expect(screen.getByText("Board")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "PL" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Theme" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Feedback" })).toBeInTheDocument();
});
```

Istniejący test o ustawieniach (po polsku) oczekuje przycisku „EN” i „Motyw”; zostaje bez zmian poza usunięciem `lang="pl"`.

`tests/unit/components/layout/FeedbackModal.test.tsx`:

```tsx
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { setLanguage } from "@/src/i18n";
import { FeedbackModal } from "@/src/components/layout/FeedbackModal";

beforeEach(() => cleanup());

test("PL: okno „Feedback”, przycisk „Zamknij” zamyka", () => {
  const onClose = vi.fn();
  render(<FeedbackModal onClose={onClose} />);
  expect(screen.getByRole("dialog", { name: "Feedback" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Zamknij" }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("EN: przycisk „Close”", async () => {
  await act(async () => {
    await setLanguage("en");
  });
  render(<FeedbackModal onClose={vi.fn()} />);
  expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  expect(screen.getByTitle("Feedback – Monolith BETA")).toBeInTheDocument();
});
```

- [ ] **Step 2: Uruchom: mają paść**

Run: `npx vitest run tests/unit/components/layout`
Expected: FAIL (`MobileNav` wymaga `lang`, angielskie etykiety, `FeedbackModal` wymaga `title`).

- [ ] **Step 3: `MobileNav.tsx`**

Dodaj `import { useTranslation } from "react-i18next";`. W `MobileNavProps` usuń `lang`. `NavTab` zastąp:

```tsx
type NavTabId = "home" | "tasks" | "notes" | "calendar" | "more";

interface NavTab {
  id: NavTabId;
  icon: React.ReactNode;
  action: () => void;
  active: boolean;
}
```

W destrukturyzacji propsów usuń `lang`, na początku funkcji dodaj `const { t } = useTranslation("shell");`. W tablicy `tabs` usuń z każdej pozycji pola `labelPl` i `labelEn` (zostają `id`, `icon`, `action`, `active`). W `map` zamień obliczanie etykiety:

```tsx
const label = t(`mobileNav.${tab.id}`);
```

- [ ] **Step 4: `MobileMoreDrawer.tsx`**

Dodaj `import { useTranslation } from "react-i18next";`. W `MobileMoreDrawerProps` usuń `lang`, w destrukturyzacji też. Na początku funkcji dodaj `const { t } = useTranslation(["shell", "common"]);`. Zastąp `settings` i `items`:

```tsx
const settings = [
  { id: "lang", label: t("common:lang.nextCode"), run: onToggleLang },
  { id: "theme", label: t("common:theme"), run: onToggleTheme },
  { id: "feedback", label: t("common:feedback"), run: onFeedback },
].filter((s) => s.run);
const items: Array<{
  id: DrawerTab;
  icon: React.ReactNode;
}> = [
  { id: "activity", icon: <Briefcase className="w-5 h-5" /> },
  { id: "tags", icon: <Tag className="w-5 h-5" /> },
  { id: "resources", icon: <Link className="w-5 h-5" /> },
  { id: "skills", icon: <Sparkles className="w-5 h-5" /> },
  { id: "mindmaps", icon: <Map className="w-5 h-5" /> },
  { id: "board", icon: <LayoutDashboard className="w-5 h-5" /> },
];
```

Przed komponentem dodaj `type DrawerTab = "activity" | "tags" | "resources" | "skills" | "mindmaps" | "board";`, a w `items.map` zamień `const label = lang === "pl" ? item.labelPl : item.labelEn;` na `const label = t(\`shell:drawer.${item.id}\`);`. (`onSelectTab(item.id)`dalej przyjmuje`PlanningTab`; `DrawerTab` jest jego podzbiorem.)

- [ ] **Step 5: `FeedbackModal.tsx`**

Zastąp początek pliku i użycia tekstów:

```tsx
"use client";

import React from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

export function FeedbackModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation("common");
  const title = t("feedback");
  return (
```

Dalej bez zmian poza dwoma miejscami: `aria-label="Zamknij"` → `aria-label={t("close")}` oraz `title="Feedback – Monolith BETA"` → `title={t("feedbackFrameTitle")}`.

- [ ] **Step 6: `App.tsx`: język z `useLang()`, bez propów `lang` i `title`**

Zmień importy: usuń `useState` tylko jeśli nieużywany (jest używany: zostaje), dodaj `import { useLang } from "@/src/i18n/useLang";`. Zastąp na początku `App()`:

```tsx
const { lang, toggleLang } = useLang();
const t = translations[lang];
const { t: tShell } = useTranslation();
```

Usuń linię `const [lang, setLang] = useState<"en" | "pl">("pl");` oraz `const toggleLang = useCallback(() => setLang((l) => (l === "en" ? "pl" : "en")), []);`. W JSX:

- `<MobileNav … lang={lang} … />` → usuń `lang={lang}`,
- `<MobileMoreDrawer … lang={lang} … />` → usuń `lang={lang}` (`onToggleLang={toggleLang}` zostaje),
- `{feedbackOpen && <FeedbackModal title={t.feedback} onClose={…} />}` → `{feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} />}`.

`PlanowanieView` dalej dostaje `lang={lang}` i `t={t}` (most do etapu 4).

- [ ] **Step 7: Testy, typy, lint plików**

Run: `npx vitest run tests/unit/components tests/unit/features/cards && npx tsc --noEmit`
Expected: PASS, brak błędów typów.

- [ ] **Step 8: Commit**

```bash
git add src/components/layout src/App.tsx tests/unit/components/layout
git commit -m "feat(i18n): MobileNav, szufladka Więcej i feedback z kluczy; App bierze język z i18next (most do translations)"
```

---

## Task 7: Test integracyjny powłoki, aktualizacja specu, pełna weryfikacja

**Files:**

- Create: `tests/unit/i18n/shell-language.test.tsx`
- Modify: `docs/superpowers/specs/2026-11-15-jezyk-pl-en-design.md` (§5 „Wchodzi” i §7)

- [ ] **Step 1: Test integracyjny (przełączenie bez przeładowania w trzech miejscach naraz)**

`tests/unit/i18n/shell-language.test.tsx`:

```tsx
import React from "react";
import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { I18nProvider } from "@/src/i18n/I18nProvider";
import { CardRail } from "@/src/features/cards/CardRail";
import { MobileNav } from "@/src/components/layout/MobileNav";
import { ShellStatusBar } from "@/src/features/home/ShellStatusBar";

// zwykła funkcja (nie vi.fn): `resetMocks` czyści implementacje vi.fn przed każdym testem
const apiFetch = async () => ({ ok: false }) as Response;

function Shell() {
  return (
    <>
      <CardRail activeCard="kokpit" onSelect={vi.fn()} onOpenPalette={vi.fn()} />
      <MobileNav
        appMode="home"
        setAppMode={vi.fn()}
        planningTab="tasks"
        setPlanningTab={vi.fn()}
        onMoreOpen={vi.fn()}
      />
      <ShellStatusBar apiFetch={apiFetch} refreshKey="kokpit" />
    </>
  );
}

describe("przełączenie języka w powłoce", () => {
  test("jedno kliknięcie PL/EN zmienia CardRail, MobileNav i pasek statusu", async () => {
    render(
      <I18nProvider>
        <Shell />
      </I18nProvider>
    );
    expect(await screen.findByRole("navigation", { name: "Karty" })).toBeInTheDocument();
    expect(screen.getByLabelText("Zadania")).toBeInTheDocument();
    expect(screen.getByLabelText("Pasek statusu")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Zmień język na angielski (EN)" }));

    expect(await screen.findByRole("navigation", { name: "Cards" })).toBeInTheDocument();
    expect(screen.getByLabelText("Tasks")).toBeInTheDocument();
    expect(screen.getByLabelText("Status bar")).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("en");
  });
});
```

- [ ] **Step 2: Uruchom test**

Run: `npx vitest run tests/unit/i18n/shell-language.test.tsx`
Expected: PASS (zachowanie dostarczone w Task 1–6; test pilnuje spójności całości).

- [ ] **Step 3: Zaktualizuj spec**

W `docs/superpowers/specs/2026-11-15-jezyk-pl-en-design.md`:

- §3, akapit „Ryzyko do rozstrzygnięcia…”: zastąp zdaniem „**Rozstrzygnięte w planie etapu 1:** bramka w `I18nProvider` (render dzieci dopiero po zastosowaniu zapisanego języka); skrypt jak `ThemeScript` odrzucony, bo nie zmieni zasobów i18next przed hydracją.”
- §5 pkt 4 („Daty w powłoce przez `format.ts`”): dopisz „W powłoce nie ma dat (jest tylko godzina `hhmm`, bez zmian); `format.ts` ma w etapie 1 tylko `formatDate`, bez użytkownika do etapu 2.”
- §5 pkt 2: przy `ShellStatusBar` dopisz „(teksty leżą we wspólnym `StatusBar.tsx`)”.
- §7: zastąp oba punkty zdaniem „Brak otwartych punktów etapu 1.”

- [ ] **Step 4: Pełna weryfikacja**

Run (każde osobno, bez przekierowań): `npx tsc --noEmit`, `npx vitest run`, `npm run lint`, `npm run build`
Expected: wszystko przechodzi; w `npx vitest run` także `tests/unit/architecture.static.test.ts` (nic z `src/i18n/` nie importuje z `contexts/`, `lib/nexus` ani `fs`). Jeśli test architektury pęka, napraw kod, nie test.

Kontrola zakresu: `git diff --stat main...HEAD` nie pokazuje zmian w `contexts/`, `lib/`, `app/api/`, `src/translations.ts` ani `tests/unit/architecture.static.test.ts`.

- [ ] **Step 5: Oględziny w przeglądarce (kopia vaulta, nie port 3100)**

Zrób kopię vaulta poza repozytoriami i uruchom aplikację na innym porcie:

```bash
cp -r ~/projects/Brain_7224/NEXUS/Vault /tmp/vault-i18n-copy
NEXUS_VAULT_PATH=/tmp/vault-i18n-copy npx next dev -p 3105 -H 127.0.0.1
```

Sprawdź na http://127.0.0.1:3105/dashboard:

1. Start po polsku; przycisk PL/EN nad `⌘K` w railu zmienia etykiety kart, `aria-label` rail, pasek statusu i (po zawężeniu okna < 768 px) dolną nawigację bez przeładowania.
2. Wybierz EN, odśwież F5: od pierwszego kadru po angielsku, bez mignięcia PL; `document.documentElement.lang === "en"`; w DevTools → Application → Local Storage `monolith.lang = "en"`.
3. Ctrl+K: lista „Go to: …”, pole „Type a command or name…”, polecenie „Switch language to Polish (PL)” działa.
4. Mobile: szufladka „More” (pozycje angielskie, przycisk „PL”), okno „Feedback” zamykane „Close”.
5. Karty spoza powłoki (Kokpit, Projekty…) zostają po polsku (to zamierzone do etapów 2–5); Planowanie nadal przełącza się razem z językiem (most).

Po oględzinach zatrzymaj serwer i usuń kopię: `rm -r /tmp/vault-i18n-copy`.

- [ ] **Step 6: Commit**

```bash
git add tests/unit/i18n/shell-language.test.tsx docs/superpowers/specs/2026-11-15-jezyk-pl-en-design.md
git commit -m "test(i18n): przełączenie języka w powłoce; spec etapu 1 uzupełniony o rozstrzygnięcia planu"
```

---

## Po etapie 1

- PR z gałęzi `feat/jezyk-pl-en-etap-1` (spec + plan + implementacja). W opisie: lista świadomych zmian widocznych dla użytkownika (przycisk PL/EN w railu; „1 ostrzeżenie” zamiast „1 ostrzeżeń”; angielskie etykiety kart).
- Wpis „Język PL/EN w całej aplikacji” w `Vault/Projects/monolith/tasks.md` aktualizuje agent/użytkownik po merge'u (zapis do vaulta nie należy do tego planu).
- Etap 2 (Kokpit i Inbox) dostaje własny krótki plan: lista tekstów `src/features/home/` do namespace `home`, plural „zadań” (`CockpitSections.tsx:690`, `TasksSection.tsx:142`), pierwszy użytkownik `formatDate`.

## Self-review planu

- **Pokrycie specu §5:** zależności, `index.ts`/`I18nProvider`/`format.ts`, namespace `common` i `shell`, setup testów, parytet (Task 1–2); powłoka: `CardRail`, etykiety kart, `appCommands`, `CommandPalette`, `buildCardCommands`, `ShellStatusBar`/`StatusBar`, `MobileNav`, `MobileMoreDrawer`, `FeedbackModal` (Task 3–6); widoczny przycisk (Task 3); daty (Task 1, z zastrzeżeniem w rozstrzygnięciu 4); wszystkie przypadki testowe ze specu: storage + `<html lang>` (language), nieznana wartość i wyjątek (language), parytet (parity), plural (language; ostrzeżenia zamiast zadań, rozstrzygnięcie 3), `formatDate` (format), `aria-label` Cards/Karty i etykiety kart (CardRail), kliknięcie PL/EN w trzech komponentach + zachowanie po zamontowaniu (shell-language, I18nProvider), dostosowane testy `MobileNav`/`MobileMoreDrawer`/`appCommands`/`cardCommands` (Task 3–6). Otwarte punkty §7 rozstrzygnięte (bramka; inwentaryzacja tekstów w Task 1 Step 4).
- **Placeholdery:** brak.
- **Spójność typów:** `Lang`, `LANG_KEY`, `setLanguage`, `applyStoredLanguage`, `currentLang`, `readStoredLanguage` (Task 1) używane identycznie w Task 2–7; `buildCardCommands(selectCard, t)` i `AppCommandActions.t` (Task 3–4) zgodne z wywołaniami w `App.tsx`; `useLang()` zwraca `{ lang, setLang, toggleLang }` (Task 1) i tak jest używane w Task 3 i 6.
- **Ryzyka dla wykonawcy:** nazwa opcji `initAsync` (Step 1 Task 1 to sprawdza); typowane klucze z szablonów `t(\`shell:cards.${id}\`)`(Task 3 Step 7 podaje obejście); testy działające w środowisku node dostają i18n przez`tests/setup.ts`(guard`typeof window`).
