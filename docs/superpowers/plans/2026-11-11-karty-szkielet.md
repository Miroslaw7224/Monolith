# Szkielet kart (pasek kart, Alt+1…8, Ctrl+K) — plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pasek 8 kart po lewej, skróty `Alt+1…8` i paleta poleceń `Ctrl+K`, które sterują istniejącymi widokami aplikacji; karty bez kodu (Projekty, Mapa) pokazują zaślepkę.

**Architecture:** Nowy moduł `src/features/cards/` z rejestrem kart (czyste funkcje), hookiem nawigacji, który mapuje kartę na istniejący stan `appMode` / `planningTab`, hookiem skrótów i dwoma komponentami (pasek, paleta). `src/App.tsx` przechodzi na hook nawigacji i renderuje pasek przed obecnymi widokami. Bez zmian w danych, Firebase i vaulcie. Motywy kart (pełne `tokens.css`) wchodzą później, karta po karcie; tu tylko akcenty `--c-<karta>`.

**Tech Stack:** Next.js 14 (app router, komponenty klienckie), React 19, TypeScript, zwykły CSS (`src/features/cards/cards.css`), Vitest + Testing Library (jsdom).

**Powiązane:** spec `docs/superpowers/specs/2026-11-11-asystent-lokalny-nexus-design.md` §6.6; makiety `docs/mockups/karty/` (`shell.css` sekcja `.rail`, `shell.js` skróty i paleta).

---

## Struktura plików

| Plik                                      | Odpowiedzialność                                                                  |
| ----------------------------------------- | --------------------------------------------------------------------------------- |
| `src/features/cards/cards.ts`             | rejestr 8 kart, typy, mapowanie karta ↔ widok, odczyt z `#hash`, filtr palety     |
| `src/features/cards/useCardNavigation.ts` | stan `appMode` / `planningTab` / zaślepki, `selectCard`, synchronizacja z `#hash` |
| `src/features/cards/useCardHotkeys.ts`    | `Alt+1…8` i `Ctrl+K` na `window`                                                  |
| `src/features/cards/CardRail.tsx`         | pasek kart (numer, nazwa, akcent aktywnej karty, przycisk palety)                 |
| `src/features/cards/CommandPalette.tsx`   | paleta: filtrowanie, strzałki, Enter, Esc, klik w tło                             |
| `src/features/cards/CardPlaceholder.tsx`  | zaślepka karty, która jeszcze nie ma kodu                                         |
| `src/features/cards/cards.css`            | akcenty `--c-*`, style paska, palety i zaślepki                                   |
| `src/App.tsx` (modyfikacja)               | użycie hooków, pasek, paleta, zaślepka                                            |
| `app/layout.tsx` (modyfikacja)            | import `cards.css`                                                                |
| `tests/unit/features/cards/*.test.ts(x)`  | testy jednostkowe powyższych                                                      |

Mapowanie kart na obecny stan (źródło: `docs/mockups/karty/STAN-W-KODZIE.md`):

| Karta     | Cel                        | Widoki wracające do tej karty |
| --------- | -------------------------- | ----------------------------- |
| kokpit    | `appMode = "home"`         | home, zakładka `activity`     |
| kalendarz | `planowanie` + `calendar`  | `calendar`                    |
| zadania   | `planowanie` + `tasks`     | `tasks`                       |
| projekty  | zaślepka (etap 1)          | —                             |
| notatki   | `planowanie` + `notes`     | `notes`                       |
| plotno    | `planowanie` + `board`     | `board`, `mindmaps`           |
| arsenal   | `planowanie` + `resources` | `resources`, `tags`           |
| mapa      | zaślepka (etap 4)          | —                             |

Komendy testów: `npx vitest run tests/unit/features/cards` (delegowane do `cursor` zgodnie z `CLAUDE.md`: „przeszło" albo lista `plik:linia + przyczyna`).

---

### Task 1: Rejestr kart i czyste funkcje

**Files:**

- Create: `src/features/cards/cards.ts`
- Test: `tests/unit/features/cards/cards.test.ts`

- [ ] **Step 1: Napisz test, który nie przejdzie**

```ts
import { describe, test, expect } from "vitest";
import {
  CARDS,
  getCard,
  cardByHotkey,
  cardForView,
  cardFromHash,
  filterCommands,
} from "@/src/features/cards/cards";

describe("CARDS", () => {
  test("ma 8 kart z klawiszami 1..8 w kolejności", () => {
    expect(CARDS.map((c) => c.hotkey)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(CARDS.map((c) => c.id)).toEqual([
      "kokpit",
      "kalendarz",
      "zadania",
      "projekty",
      "notatki",
      "plotno",
      "arsenal",
      "mapa",
    ]);
  });

  test("projekty i mapa to zaślepki", () => {
    expect(getCard("projekty").target).toEqual({ kind: "placeholder", stage: "etap 1" });
    expect(getCard("mapa").target).toEqual({ kind: "placeholder", stage: "etap 4" });
  });
});

describe("cardByHotkey", () => {
  test("zwraca kartę dla 1..8 i undefined poza zakresem", () => {
    expect(cardByHotkey(3)?.id).toBe("zadania");
    expect(cardByHotkey(9)).toBeUndefined();
    expect(cardByHotkey(0)).toBeUndefined();
  });
});

describe("cardForView", () => {
  test("home to kokpit niezależnie od zakładki", () => {
    expect(cardForView("home", "notes")).toBe("kokpit");
  });

  test("zakładki planowania mapują się na karty", () => {
    expect(cardForView("planowanie", "calendar")).toBe("kalendarz");
    expect(cardForView("planowanie", "tasks")).toBe("zadania");
    expect(cardForView("planowanie", "notes")).toBe("notatki");
    expect(cardForView("planowanie", "board")).toBe("plotno");
    expect(cardForView("planowanie", "mindmaps")).toBe("plotno");
    expect(cardForView("planowanie", "resources")).toBe("arsenal");
    expect(cardForView("planowanie", "tags")).toBe("arsenal");
    expect(cardForView("planowanie", "activity")).toBe("kokpit");
  });
});

describe("cardFromHash", () => {
  test("rozpoznaje znane karty z # i bez", () => {
    expect(cardFromHash("#notatki")).toBe("notatki");
    expect(cardFromHash("mapa")).toBe("mapa");
  });

  test("zwraca null dla pustego i nieznanego", () => {
    expect(cardFromHash("")).toBeNull();
    expect(cardFromHash("#settings")).toBeNull();
  });
});

describe("filterCommands", () => {
  const cmds = [
    { id: "a", label: "Przejdź: Płótno", run: () => {} },
    { id: "b", label: "Przejdź: Arsenał", run: () => {} },
  ];

  test("pusta fraza zwraca wszystko", () => {
    expect(filterCommands(cmds, "  ")).toHaveLength(2);
  });

  test("ignoruje wielkość liter i polskie znaki", () => {
    expect(filterCommands(cmds, "PLOTNO").map((c) => c.id)).toEqual(["a"]);
    expect(filterCommands(cmds, "arsenal").map((c) => c.id)).toEqual(["b"]);
  });
});
```

- [ ] **Step 2: Uruchom test i sprawdź, że nie przechodzi**

Run: `npx vitest run tests/unit/features/cards/cards.test.ts`
Expected: FAIL, `Failed to resolve import "@/src/features/cards/cards"`.

- [ ] **Step 3: Implementacja**

```ts
import type { PlanningTab } from "@/src/features/planowanie/PlanowanieSidebarContent";

export type CardId =
  | "kokpit"
  | "kalendarz"
  | "zadania"
  | "projekty"
  | "notatki"
  | "plotno"
  | "arsenal"
  | "mapa";

export type AppMode = "home" | "planowanie";

export type CardTarget =
  | { kind: "home" }
  | { kind: "planning"; tab: PlanningTab }
  | { kind: "placeholder"; stage: string };

export interface CardDef {
  id: CardId;
  label: string;
  hotkey: number;
  target: CardTarget;
}

export const CARDS: readonly CardDef[] = [
  { id: "kokpit", label: "Kokpit", hotkey: 1, target: { kind: "home" } },
  { id: "kalendarz", label: "Kalendarz", hotkey: 2, target: { kind: "planning", tab: "calendar" } },
  { id: "zadania", label: "Zadania", hotkey: 3, target: { kind: "planning", tab: "tasks" } },
  {
    id: "projekty",
    label: "Projekty",
    hotkey: 4,
    target: { kind: "placeholder", stage: "etap 1" },
  },
  { id: "notatki", label: "Notatki", hotkey: 5, target: { kind: "planning", tab: "notes" } },
  { id: "plotno", label: "Płótno", hotkey: 6, target: { kind: "planning", tab: "board" } },
  { id: "arsenal", label: "Arsenał", hotkey: 7, target: { kind: "planning", tab: "resources" } },
  { id: "mapa", label: "Mapa", hotkey: 8, target: { kind: "placeholder", stage: "etap 4" } },
];

const TAB_TO_CARD: Record<PlanningTab, CardId> = {
  calendar: "kalendarz",
  tasks: "zadania",
  notes: "notatki",
  board: "plotno",
  mindmaps: "plotno",
  resources: "arsenal",
  tags: "arsenal",
  activity: "kokpit",
};

export function getCard(id: CardId): CardDef {
  const card = CARDS.find((c) => c.id === id);
  if (!card) throw new Error(`Nieznana karta: ${id}`);
  return card;
}

export function cardByHotkey(n: number): CardDef | undefined {
  return CARDS.find((c) => c.hotkey === n);
}

export function cardForView(appMode: AppMode, tab: PlanningTab): CardId {
  return appMode === "home" ? "kokpit" : TAB_TO_CARD[tab];
}

export function cardFromHash(hash: string): CardId | null {
  const id = hash.replace(/^#/, "");
  return CARDS.some((c) => c.id === id) ? (id as CardId) : null;
}

export interface PaletteCommand {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

function fold(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l");
}

export function filterCommands(commands: PaletteCommand[], query: string): PaletteCommand[] {
  const q = fold(query.trim());
  if (!q) return commands;
  return commands.filter((c) => fold(c.label).includes(q));
}
```

`ł` nie rozkłada się w NFD, stąd osobna zamiana.

- [ ] **Step 4: Uruchom test i sprawdź, że przechodzi**

Run: `npx vitest run tests/unit/features/cards/cards.test.ts`
Expected: PASS (9 testów).

- [ ] **Step 5: Commit**

```bash
git add src/features/cards/cards.ts tests/unit/features/cards/cards.test.ts
git commit -m "feat(cards): card registry and view mapping"
```

---

### Task 2: Hook nawigacji kart

**Files:**

- Create: `src/features/cards/useCardNavigation.ts`
- Test: `tests/unit/features/cards/useCardNavigation.test.ts`

Hook przejmuje stan `appMode` i `planningTab` z `App.tsx` oraz dokłada stan zaślepki. Settery przekazywane do starych widoków czyszczą zaślepkę, więc kliknięcie w stary pasek boczny zawsze wraca do prawdziwego widoku. Aktywna karta trafia do `location.hash` (`replaceState`, bez wpisów w historii), a przy starcie hook czyta `#hash`, więc odświeżenie strony zostaje na tej samej karcie.

- [ ] **Step 1: Napisz test, który nie przejdzie**

```ts
import { describe, test, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCardNavigation } from "@/src/features/cards/useCardNavigation";

beforeEach(() => {
  window.history.replaceState(null, "", "/dashboard");
});

describe("useCardNavigation", () => {
  test("startuje na kokpicie", () => {
    const { result } = renderHook(() => useCardNavigation());
    expect(result.current.appMode).toBe("home");
    expect(result.current.activeCard).toBe("kokpit");
    expect(result.current.placeholder).toBeNull();
  });

  test("selectCard ustawia widok planowania i zakładkę", () => {
    const { result } = renderHook(() => useCardNavigation());
    act(() => result.current.selectCard("kalendarz"));
    expect(result.current.appMode).toBe("planowanie");
    expect(result.current.planningTab).toBe("calendar");
    expect(result.current.activeCard).toBe("kalendarz");
  });

  test("karta bez kodu ustawia zaślepkę, kolejna karta ją zdejmuje", () => {
    const { result } = renderHook(() => useCardNavigation());
    act(() => result.current.selectCard("mapa"));
    expect(result.current.placeholder).toBe("mapa");
    expect(result.current.activeCard).toBe("mapa");
    act(() => result.current.selectCard("kokpit"));
    expect(result.current.placeholder).toBeNull();
    expect(result.current.appMode).toBe("home");
  });

  test("setter starego widoku zdejmuje zaślepkę", () => {
    const { result } = renderHook(() => useCardNavigation());
    act(() => result.current.selectCard("projekty"));
    act(() => result.current.setPlanningTab("mindmaps"));
    expect(result.current.placeholder).toBeNull();
    act(() => result.current.setAppMode("planowanie"));
    expect(result.current.activeCard).toBe("plotno");
  });

  test("zapisuje aktywną kartę w hashu", () => {
    const { result } = renderHook(() => useCardNavigation());
    act(() => result.current.selectCard("notatki"));
    expect(window.location.hash).toBe("#notatki");
  });

  test("przy starcie czyta kartę z hasha", () => {
    window.history.replaceState(null, "", "/dashboard#arsenal");
    const { result } = renderHook(() => useCardNavigation());
    expect(result.current.activeCard).toBe("arsenal");
    expect(result.current.planningTab).toBe("resources");
  });

  test("nieznany hash zostawia kokpit", () => {
    window.history.replaceState(null, "", "/dashboard#xyz");
    const { result } = renderHook(() => useCardNavigation());
    expect(result.current.activeCard).toBe("kokpit");
  });
});
```

- [ ] **Step 2: Uruchom test i sprawdź, że nie przechodzi**

Run: `npx vitest run tests/unit/features/cards/useCardNavigation.test.ts`
Expected: FAIL, `Failed to resolve import "@/src/features/cards/useCardNavigation"`.

- [ ] **Step 3: Implementacja**

```ts
"use client";

import { useCallback, useEffect, useState } from "react";
import type { PlanningTab } from "@/src/features/planowanie/PlanowanieSidebarContent";
import { type AppMode, type CardId, cardForView, cardFromHash, getCard } from "./cards";

export interface CardNavigation {
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;
  planningTab: PlanningTab;
  setPlanningTab: (tab: PlanningTab) => void;
  placeholder: CardId | null;
  activeCard: CardId;
  selectCard: (id: CardId) => void;
}

export function useCardNavigation(): CardNavigation {
  const [appMode, setAppModeRaw] = useState<AppMode>("home");
  const [planningTab, setPlanningTabRaw] = useState<PlanningTab>("tasks");
  const [placeholder, setPlaceholder] = useState<CardId | null>(null);

  const setAppMode = useCallback((mode: AppMode) => {
    setPlaceholder(null);
    setAppModeRaw(mode);
  }, []);

  const setPlanningTab = useCallback((tab: PlanningTab) => {
    setPlaceholder(null);
    setPlanningTabRaw(tab);
  }, []);

  const selectCard = useCallback((id: CardId) => {
    const { target } = getCard(id);
    if (target.kind === "placeholder") {
      setPlaceholder(id);
      return;
    }
    setPlaceholder(null);
    if (target.kind === "home") {
      setAppModeRaw("home");
    } else {
      setAppModeRaw("planowanie");
      setPlanningTabRaw(target.tab);
    }
  }, []);

  const activeCard = placeholder ?? cardForView(appMode, planningTab);

  useEffect(() => {
    const fromHash = cardFromHash(window.location.hash);
    if (fromHash) selectCard(fromHash);
  }, [selectCard]);

  useEffect(() => {
    const url = `${window.location.pathname}${window.location.search}#${activeCard}`;
    window.history.replaceState(window.history.state, "", url);
  }, [activeCard]);

  return {
    appMode,
    setAppMode,
    planningTab,
    setPlanningTab,
    placeholder,
    activeCard,
    selectCard,
  };
}
```

Uwaga do kolejności efektów: pierwszy efekt czyta hash, zanim drugi go nadpisze (efekty biegną w kolejności deklaracji, a drugi przy pierwszym renderze zapisze `#kokpit` dopiero po odczycie). Test „przy starcie czyta kartę z hasha" to sprawdza.

- [ ] **Step 4: Uruchom test i sprawdź, że przechodzi**

Run: `npx vitest run tests/unit/features/cards/useCardNavigation.test.ts`
Expected: PASS (7 testów).

- [ ] **Step 5: Commit**

```bash
git add src/features/cards/useCardNavigation.ts tests/unit/features/cards/useCardNavigation.test.ts
git commit -m "feat(cards): navigation hook mapping cards to existing views"
```

---

### Task 3: Skróty klawiszowe

**Files:**

- Create: `src/features/cards/useCardHotkeys.ts`
- Test: `tests/unit/features/cards/useCardHotkeys.test.ts`

Zasady: `Alt+cyfra` po `event.code` (`Digit1`…`Digit8`), bez Ctrl i Meta (AltGr na polskiej klawiaturze to Ctrl+Alt). `Ctrl+K` lub `Cmd+K` bez Alt otwiera paletę. Przy `disabled: true` (otwarta paleta) hook nic nie robi, bo paleta obsługuje własne klawisze.

- [ ] **Step 1: Napisz test, który nie przejdzie**

```ts
import { describe, test, expect, vi } from "vitest";
import { renderHook, fireEvent } from "@testing-library/react";
import { useCardHotkeys } from "@/src/features/cards/useCardHotkeys";

function setup(disabled = false) {
  const onSelectCard = vi.fn();
  const onOpenPalette = vi.fn();
  const hook = renderHook(() => useCardHotkeys({ onSelectCard, onOpenPalette, disabled }));
  return { onSelectCard, onOpenPalette, ...hook };
}

describe("useCardHotkeys", () => {
  test("Alt+3 wybiera zadania", () => {
    const { onSelectCard } = setup();
    fireEvent.keyDown(window, { key: "3", code: "Digit3", altKey: true });
    expect(onSelectCard).toHaveBeenCalledWith("zadania");
  });

  test("Alt+9 i Alt+0 nic nie robią", () => {
    const { onSelectCard } = setup();
    fireEvent.keyDown(window, { key: "9", code: "Digit9", altKey: true });
    fireEvent.keyDown(window, { key: "0", code: "Digit0", altKey: true });
    expect(onSelectCard).not.toHaveBeenCalled();
  });

  test("AltGr (Ctrl+Alt) jest ignorowany", () => {
    const { onSelectCard } = setup();
    fireEvent.keyDown(window, { key: "1", code: "Digit1", altKey: true, ctrlKey: true });
    expect(onSelectCard).not.toHaveBeenCalled();
  });

  test("sama cyfra bez Alt nic nie robi", () => {
    const { onSelectCard } = setup();
    fireEvent.keyDown(window, { key: "1", code: "Digit1" });
    expect(onSelectCard).not.toHaveBeenCalled();
  });

  test("Ctrl+K i Cmd+K otwierają paletę", () => {
    const { onOpenPalette } = setup();
    fireEvent.keyDown(window, { key: "k", code: "KeyK", ctrlKey: true });
    fireEvent.keyDown(window, { key: "K", code: "KeyK", metaKey: true });
    expect(onOpenPalette).toHaveBeenCalledTimes(2);
  });

  test("Ctrl+K blokuje domyślną akcję przeglądarki", () => {
    setup();
    const ev = new KeyboardEvent("keydown", { key: "k", ctrlKey: true, cancelable: true });
    window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });

  test("disabled wyłącza skróty", () => {
    const { onSelectCard, onOpenPalette } = setup(true);
    fireEvent.keyDown(window, { key: "1", code: "Digit1", altKey: true });
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(onSelectCard).not.toHaveBeenCalled();
    expect(onOpenPalette).not.toHaveBeenCalled();
  });

  test("odpina nasłuch po odmontowaniu", () => {
    const { onSelectCard, unmount } = setup();
    unmount();
    fireEvent.keyDown(window, { key: "1", code: "Digit1", altKey: true });
    expect(onSelectCard).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Uruchom test i sprawdź, że nie przechodzi**

Run: `npx vitest run tests/unit/features/cards/useCardHotkeys.test.ts`
Expected: FAIL, `Failed to resolve import "@/src/features/cards/useCardHotkeys"`.

- [ ] **Step 3: Implementacja**

```ts
"use client";

import { useEffect } from "react";
import { type CardId, cardByHotkey } from "./cards";

export interface CardHotkeysOptions {
  onSelectCard: (id: CardId) => void;
  onOpenPalette: () => void;
  disabled?: boolean;
}

export function useCardHotkeys({
  onSelectCard,
  onOpenPalette,
  disabled = false,
}: CardHotkeysOptions) {
  useEffect(() => {
    if (disabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenPalette();
        return;
      }
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const match = /^Digit([1-8])$/.exec(e.code);
        const card = match ? cardByHotkey(Number(match[1])) : undefined;
        if (card) {
          e.preventDefault();
          onSelectCard(card.id);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onSelectCard, onOpenPalette, disabled]);
}
```

- [ ] **Step 4: Uruchom test i sprawdź, że przechodzi**

Run: `npx vitest run tests/unit/features/cards/useCardHotkeys.test.ts`
Expected: PASS (8 testów).

- [ ] **Step 5: Commit**

```bash
git add src/features/cards/useCardHotkeys.ts tests/unit/features/cards/useCardHotkeys.test.ts
git commit -m "feat(cards): Alt+1..8 and Ctrl+K hotkeys"
```

---

### Task 4: Pasek kart

**Files:**

- Create: `src/features/cards/CardRail.tsx`
- Test: `tests/unit/features/cards/CardRail.test.tsx`

- [ ] **Step 1: Napisz test, który nie przejdzie**

```tsx
import React from "react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { CardRail } from "@/src/features/cards/CardRail";

beforeEach(() => cleanup());

describe("CardRail", () => {
  test("pokazuje 8 kart w nawigacji", () => {
    render(<CardRail activeCard="kokpit" onSelect={vi.fn()} onOpenPalette={vi.fn()} />);
    const nav = screen.getByRole("navigation", { name: "Karty" });
    expect(nav.querySelectorAll("[data-card-id]")).toHaveLength(8);
    expect(screen.getByRole("button", { name: /Płótno/ })).toHaveAttribute(
      "title",
      "Płótno (Alt+6)"
    );
  });

  test("oznacza aktywną kartę", () => {
    render(<CardRail activeCard="zadania" onSelect={vi.fn()} onOpenPalette={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Zadania/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: /Kokpit/ })).not.toHaveAttribute("aria-current");
  });

  test("klik wybiera kartę", () => {
    const onSelect = vi.fn();
    render(<CardRail activeCard="kokpit" onSelect={onSelect} onOpenPalette={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Mapa/ }));
    expect(onSelect).toHaveBeenCalledWith("mapa");
  });

  test("przycisk palety otwiera paletę", () => {
    const onOpenPalette = vi.fn();
    render(<CardRail activeCard="kokpit" onSelect={vi.fn()} onOpenPalette={onOpenPalette} />);
    fireEvent.click(screen.getByRole("button", { name: "Paleta poleceń (Ctrl+K)" }));
    expect(onOpenPalette).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Uruchom test i sprawdź, że nie przechodzi**

Run: `npx vitest run tests/unit/features/cards/CardRail.test.tsx`
Expected: FAIL, `Failed to resolve import "@/src/features/cards/CardRail"`.

- [ ] **Step 3: Implementacja**

```tsx
"use client";

import React from "react";
import { CARDS, type CardId } from "./cards";

export interface CardRailProps {
  activeCard: CardId;
  onSelect: (id: CardId) => void;
  onOpenPalette: () => void;
}

export function CardRail({ activeCard, onSelect, onOpenPalette }: CardRailProps) {
  return (
    <nav className="card-rail" aria-label="Karty">
      <div className="card-rail__logo" aria-hidden="true">
        M
      </div>
      {CARDS.map((card) => (
        <button
          key={card.id}
          type="button"
          data-card-id={card.id}
          className="card-rail__item"
          style={{ "--c": `var(--c-${card.id})` } as React.CSSProperties}
          aria-current={card.id === activeCard ? "page" : undefined}
          title={`${card.label} (Alt+${card.hotkey})`}
          onClick={() => onSelect(card.id)}
        >
          <span className="card-rail__num" aria-hidden="true">
            {card.hotkey}
          </span>
          <span className="card-rail__label">{card.label}</span>
        </button>
      ))}
      <div className="card-rail__spacer" />
      <button
        type="button"
        className="card-rail__cmd"
        aria-label="Paleta poleceń (Ctrl+K)"
        title="Paleta poleceń (Ctrl+K)"
        onClick={onOpenPalette}
      >
        ⌘K
      </button>
    </nav>
  );
}
```

Logo „M” = Monolith (decyzja D8); pełna zmiana nazwy to osobne zadanie.

- [ ] **Step 4: Uruchom test i sprawdź, że przechodzi**

Run: `npx vitest run tests/unit/features/cards/CardRail.test.tsx`
Expected: PASS (4 testy).

- [ ] **Step 5: Commit**

```bash
git add src/features/cards/CardRail.tsx tests/unit/features/cards/CardRail.test.tsx
git commit -m "feat(cards): card rail component"
```

---

### Task 5: Paleta poleceń

**Files:**

- Create: `src/features/cards/CommandPalette.tsx`
- Test: `tests/unit/features/cards/CommandPalette.test.tsx`

Paleta jest montowana tylko wtedy, gdy jest otwarta (`{open && <CommandPalette …/>}`), więc każde otwarcie zaczyna od pustej frazy i pierwszej pozycji bez ręcznego resetu. Na razie zawiera tylko polecenia „Przejdź: …” (YAGNI: kolejne komendy dochodzą razem z funkcjami, np. inbox w etapie 2).

- [ ] **Step 1: Napisz test, który nie przejdzie**

```tsx
import React from "react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { CommandPalette } from "@/src/features/cards/CommandPalette";
import type { PaletteCommand } from "@/src/features/cards/cards";

beforeEach(() => cleanup());

function cmds(): PaletteCommand[] {
  return [
    { id: "a", label: "Przejdź: Kokpit", hint: "Alt+1", run: vi.fn() },
    { id: "b", label: "Przejdź: Kalendarz", hint: "Alt+2", run: vi.fn() },
    { id: "c", label: "Przejdź: Płótno", hint: "Alt+6", run: vi.fn() },
  ];
}

describe("CommandPalette", () => {
  test("ustawia fokus na polu i zaznacza pierwszą pozycję", () => {
    render(<CommandPalette commands={cmds()} onClose={vi.fn()} />);
    expect(screen.getByLabelText("Polecenie")).toHaveFocus();
    expect(screen.getAllByRole("option")[0]).toHaveAttribute("aria-selected", "true");
  });

  test("filtruje po frazie bez polskich znaków", () => {
    render(<CommandPalette commands={cmds()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Polecenie"), { target: { value: "plotno" } });
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("Przejdź: Płótno");
  });

  test("brak wyników pokazuje komunikat", () => {
    render(<CommandPalette commands={cmds()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Polecenie"), { target: { value: "zzz" } });
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("Brak wyników")).toBeInTheDocument();
  });

  test("strzałki i Enter uruchamiają wybraną komendę i zamykają paletę", () => {
    const list = cmds();
    const onClose = vi.fn();
    render(<CommandPalette commands={list} onClose={onClose} />);
    const input = screen.getByLabelText("Polecenie");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(list[1].run).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("klik w pozycję uruchamia komendę", () => {
    const list = cmds();
    render(<CommandPalette commands={list} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Przejdź: Płótno"));
    expect(list[2].run).toHaveBeenCalledTimes(1);
  });

  test("Escape i klik w tło zamykają bez uruchamiania", () => {
    const list = cmds();
    const onClose = vi.fn();
    render(<CommandPalette commands={list} onClose={onClose} />);
    fireEvent.keyDown(screen.getByLabelText("Polecenie"), { key: "Escape" });
    fireEvent.click(screen.getByTestId("palette-overlay"));
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(list[0].run).not.toHaveBeenCalled();
  });

  test("klik w okno palety nie zamyka", () => {
    const onClose = vi.fn();
    render(<CommandPalette commands={cmds()} onClose={onClose} />);
    fireEvent.click(screen.getByRole("dialog", { name: "Paleta poleceń" }));
    expect(onClose).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Uruchom test i sprawdź, że nie przechodzi**

Run: `npx vitest run tests/unit/features/cards/CommandPalette.test.tsx`
Expected: FAIL, `Failed to resolve import "@/src/features/cards/CommandPalette"`.

- [ ] **Step 3: Implementacja**

```tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { filterCommands, type PaletteCommand } from "./cards";

export interface CommandPaletteProps {
  commands: PaletteCommand[];
  onClose: () => void;
}

export function CommandPalette({ commands, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const shown = filterCommands(commands, query);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const run = (cmd: PaletteCommand | undefined) => {
    if (!cmd) return;
    onClose();
    cmd.run();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((i) => Math.min(i + 1, shown.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(shown[selected]);
    }
  };

  return (
    <div
      className="card-palette__overlay"
      data-testid="palette-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="card-palette" role="dialog" aria-modal="true" aria-label="Paleta poleceń">
        <input
          ref={inputRef}
          className="card-palette__input"
          aria-label="Polecenie"
          placeholder="Wpisz polecenie lub nazwę…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(0);
          }}
          onKeyDown={onKeyDown}
        />
        <ul className="card-palette__list" role="listbox" aria-label="Polecenia">
          {shown.map((cmd, i) => (
            <li
              key={cmd.id}
              role="option"
              aria-selected={i === selected}
              className="card-palette__item"
              onMouseEnter={() => setSelected(i)}
              onClick={() => run(cmd)}
            >
              <span>{cmd.label}</span>
              {cmd.hint && <kbd className="card-palette__kbd">{cmd.hint}</kbd>}
            </li>
          ))}
          {shown.length === 0 && <li className="card-palette__empty">Brak wyników</li>}
        </ul>
      </div>
    </div>
  );
}
```

`onClose()` przed `cmd.run()`: komenda może zmienić widok, a paleta nie powinna zostać otwarta nad nowym widokiem.

- [ ] **Step 4: Uruchom test i sprawdź, że przechodzi**

Run: `npx vitest run tests/unit/features/cards/CommandPalette.test.tsx`
Expected: PASS (7 testów).

- [ ] **Step 5: Commit**

```bash
git add src/features/cards/CommandPalette.tsx tests/unit/features/cards/CommandPalette.test.tsx
git commit -m "feat(cards): command palette"
```

---

### Task 6: Zaślepka karty

**Files:**

- Create: `src/features/cards/CardPlaceholder.tsx`
- Test: `tests/unit/features/cards/CardPlaceholder.test.tsx`

- [ ] **Step 1: Napisz test, który nie przejdzie**

```tsx
import React from "react";
import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CardPlaceholder } from "@/src/features/cards/CardPlaceholder";

test("pokazuje nazwę karty, etap i ścieżkę makiety", () => {
  render(<CardPlaceholder cardId="mapa" />);
  expect(screen.getByRole("heading", { name: "Mapa" })).toBeInTheDocument();
  expect(screen.getByText(/etap 4/)).toBeInTheDocument();
  expect(screen.getByText("docs/mockups/karty/cards/08-mapa.html")).toBeInTheDocument();
});
```

- [ ] **Step 2: Uruchom test i sprawdź, że nie przechodzi**

Run: `npx vitest run tests/unit/features/cards/CardPlaceholder.test.tsx`
Expected: FAIL, `Failed to resolve import "@/src/features/cards/CardPlaceholder"`.

- [ ] **Step 3: Implementacja**

```tsx
"use client";

import React from "react";
import { type CardId, getCard } from "./cards";

export function CardPlaceholder({ cardId }: { cardId: CardId }) {
  const card = getCard(cardId);
  const stage = card.target.kind === "placeholder" ? card.target.stage : "";
  const mockup = `docs/mockups/karty/cards/0${card.hotkey}-${card.id}.html`;
  return (
    <section className="card-placeholder" aria-labelledby="card-placeholder-title">
      <h1 id="card-placeholder-title" className="card-placeholder__title">
        {card.label}
      </h1>
      <p>Ta karta powstanie w etapie wdrożenia ({stage}).</p>
      <p>
        Makieta: <code>{mockup}</code>
      </p>
    </section>
  );
}
```

- [ ] **Step 4: Uruchom test i sprawdź, że przechodzi**

Run: `npx vitest run tests/unit/features/cards/CardPlaceholder.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/cards/CardPlaceholder.tsx tests/unit/features/cards/CardPlaceholder.test.tsx
git commit -m "feat(cards): placeholder for cards without code"
```

---

### Task 7: Style szkieletu

**Files:**

- Create: `src/features/cards/cards.css`
- Modify: `app/layout.tsx:2` (import obok `./globals.css`)

Wartości akcentów i paska są przeniesione z `docs/mockups/karty/tokens.css` i `shell.css` (sekcja `.rail`). Nie definiujemy tu `--bg`, `--text`, `--accent`: to zmienne obecnej aplikacji (`app/globals.css`), a motywy kart wchodzą przy przenoszeniu kart. Pasek jest ukryty poniżej 768 px (telefon poza zakresem, tam zostaje `MobileNav`).

- [ ] **Step 1: Utwórz `src/features/cards/cards.css`**

```css
/* Szkielet kart: akcenty i pasek z docs/mockups/karty/ (tokens.css, shell.css). */
:root {
  --c-kokpit: #ff9f1c;
  --c-kalendarz: #ff3b1f;
  --c-zadania: #b6ff2e;
  --c-projekty: #3d95ff;
  --c-notatki: #f3ff3a;
  --c-plotno: #22d3ee;
  --c-arsenal: #b47bff;
  --c-mapa: #ff2bd6;
  --shell-bg: #0d0d10;
  --shell-line: #26262c;
  --shell-text: #e8e8ec;
  --shell-muted: #9a9aa6;
  --shell-ease: cubic-bezier(0.2, 0.7, 0.2, 1);
}

.card-rail {
  display: none;
}

@media (min-width: 768px) {
  .card-rail {
    flex: 0 0 76px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 12px 0;
    background: var(--shell-bg);
    border-right: 1px solid var(--shell-line);
    color: var(--shell-text);
    z-index: 2;
  }
}

.card-rail__logo {
  width: 40px;
  height: 40px;
  margin-bottom: 12px;
  display: grid;
  place-items: center;
  font: 700 15px/1 var(--font-mono);
  border: 1px solid var(--shell-line);
  border-radius: 10px;
}

.card-rail__item {
  --c: var(--shell-muted);
  position: relative;
  width: 60px;
  padding: 7px 0 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  background: transparent;
  border: 0;
  border-radius: 10px;
  color: var(--shell-muted);
  cursor: pointer;
  transition:
    background 0.15s var(--shell-ease),
    color 0.15s var(--shell-ease);
}

.card-rail__item:hover {
  background: #18181d;
  color: var(--shell-text);
}

.card-rail__item:focus-visible,
.card-rail__cmd:focus-visible {
  outline: 2px solid var(--c, var(--shell-text));
  outline-offset: 2px;
}

.card-rail__num {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  font: 600 13px/1 var(--font-mono);
  border: 1px solid var(--shell-line);
  border-radius: 8px;
}

.card-rail__label {
  font-size: 10px;
  letter-spacing: 0.2px;
}

.card-rail__item[aria-current="page"] {
  color: var(--shell-text);
}

.card-rail__item[aria-current="page"] .card-rail__num {
  background: var(--c);
  border-color: var(--c);
  color: #0d0d10;
  box-shadow: 0 0 14px color-mix(in srgb, var(--c) 60%, transparent);
}

.card-rail__item[aria-current="page"]::before {
  content: "";
  position: absolute;
  left: -8px;
  top: 10px;
  bottom: 10px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--c);
}

.card-rail__spacer {
  flex: 1;
}

.card-rail__cmd {
  width: 44px;
  height: 32px;
  border: 1px solid var(--shell-line);
  border-radius: 10px;
  background: transparent;
  color: var(--shell-muted);
  font: 500 11px/1 var(--font-mono);
  cursor: pointer;
}

.card-rail__cmd:hover {
  color: var(--shell-text);
}

.card-palette__overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 12vh 16px 16px;
  background: rgba(5, 5, 8, 0.6);
  backdrop-filter: blur(4px);
}

.card-palette {
  width: min(560px, 100%);
  background: #16171a;
  border: 1px solid var(--shell-line);
  border-radius: 16px;
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6);
  color: var(--shell-text);
  overflow: hidden;
}

.card-palette__input {
  width: 100%;
  padding: 14px 16px;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--shell-line);
  color: var(--shell-text);
  font-size: 15px;
  outline: none;
}

.card-palette__list {
  max-height: 50vh;
  overflow-y: auto;
  margin: 0;
  padding: 6px;
  list-style: none;
}

.card-palette__item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 9px 10px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}

.card-palette__item[aria-selected="true"] {
  background: #24252b;
}

.card-palette__kbd {
  padding: 2px 6px;
  border: 1px solid var(--shell-line);
  border-radius: 6px;
  color: var(--shell-muted);
  font: 500 11px/1.4 var(--font-mono);
}

.card-palette__empty {
  padding: 9px 10px;
  color: var(--shell-muted);
  font-size: 14px;
}

.card-placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 8px;
  padding: 32px 16px;
  color: var(--text2);
  text-align: center;
}

.card-placeholder__title {
  color: var(--text);
  font-size: 24px;
  font-weight: 700;
}
```

- [ ] **Step 2: Zaimportuj style w `app/layout.tsx`**

Zmień:

```tsx
import "./globals.css";
```

na:

```tsx
import "./globals.css";
import "@/src/features/cards/cards.css";
```

- [ ] **Step 3: Sprawdź, że build widzi plik**

Run: `npx tsc --noEmit`
Expected: brak nowych błędów (przez `cursor`: „przeszło" albo lista błędów).

- [ ] **Step 4: Commit**

```bash
git add src/features/cards/cards.css app/layout.tsx
git commit -m "feat(cards): shell styles from mockups"
```

---

### Task 8: Podpięcie szkieletu w `App.tsx`

**Files:**

- Modify: `src/App.tsx` (importy; stan w liniach 58–59; główny `return` w liniach 303–356)
- Test: `tests/unit/features/cards/cardCommands.test.ts`
- Modify: `src/features/cards/cards.ts` (funkcja `buildCardCommands`)

Hooki muszą stać przed wczesnymi `return` w `App` (ekran ładowania i logowania), czyli zaraz pod istniejącymi `useState`.

- [ ] **Step 1: Napisz test komend palety, który nie przejdzie**

`tests/unit/features/cards/cardCommands.test.ts`:

```ts
import { test, expect, vi } from "vitest";
import { buildCardCommands } from "@/src/features/cards/cards";

test("buduje 8 komend Przejdź z podpowiedzią skrótu", () => {
  const selectCard = vi.fn();
  const cmds = buildCardCommands(selectCard);
  expect(cmds).toHaveLength(8);
  expect(cmds[5]).toMatchObject({ id: "go-plotno", label: "Przejdź: Płótno", hint: "Alt+6" });
  cmds[5].run();
  expect(selectCard).toHaveBeenCalledWith("plotno");
});
```

- [ ] **Step 2: Uruchom test i sprawdź, że nie przechodzi**

Run: `npx vitest run tests/unit/features/cards/cardCommands.test.ts`
Expected: FAIL, `buildCardCommands is not a function` (albo błąd eksportu).

- [ ] **Step 3: Dopisz `buildCardCommands` na końcu `src/features/cards/cards.ts`**

```ts
export function buildCardCommands(selectCard: (id: CardId) => void): PaletteCommand[] {
  return CARDS.map((card) => ({
    id: `go-${card.id}`,
    label: `Przejdź: ${card.label}`,
    hint: `Alt+${card.hotkey}`,
    run: () => selectCard(card.id),
  }));
}
```

- [ ] **Step 4: Uruchom test i sprawdź, że przechodzi**

Run: `npx vitest run tests/unit/features/cards/cardCommands.test.ts`
Expected: PASS.

- [ ] **Step 5: Importy w `src/App.tsx`**

Pod linią `import type { PlanningTab } from "@/src/features/planowanie/PlanowanieSidebarContent";` dopisz:

```tsx
import { useCardNavigation } from "@/src/features/cards/useCardNavigation";
import { useCardHotkeys } from "@/src/features/cards/useCardHotkeys";
import { CardRail } from "@/src/features/cards/CardRail";
import { CommandPalette } from "@/src/features/cards/CommandPalette";
import { CardPlaceholder } from "@/src/features/cards/CardPlaceholder";
import { buildCardCommands } from "@/src/features/cards/cards";
```

Jeśli po zmianie z kroku 6 import `PlanningTab` nie jest już używany w `App.tsx`, usuń go (lint `no-unused-vars`).

- [ ] **Step 6: Stan nawigacji w `App`**

Zamień linie:

```tsx
const [appMode, setAppMode] = useState<"home" | "planowanie">("home");
const [planningTab, setPlanningTab] = useState<PlanningTab>("tasks");
```

na:

```tsx
const { appMode, setAppMode, planningTab, setPlanningTab, placeholder, activeCard, selectCard } =
  useCardNavigation();
const [paletteOpen, setPaletteOpen] = useState(false);
const openPalette = useCallback(() => setPaletteOpen(true), []);
const closePalette = useCallback(() => setPaletteOpen(false), []);
const cardCommands = React.useMemo(() => buildCardCommands(selectCard), [selectCard]);
useCardHotkeys({ onSelectCard: selectCard, onOpenPalette: openPalette, disabled: paletteOpen });
```

(`useCallback` jest już zaimportowany w linii 6.)

- [ ] **Step 7: Główny widok**

W końcowym `return` (linia ~303) zamień otwierający fragment:

```tsx
    <div className="flex h-screen bg-[var(--bg)] text-[var(--text)] font-sans overflow-hidden">
      {appMode === "home" ? (
```

na:

```tsx
    <div
      className="flex h-screen bg-[var(--bg)] text-[var(--text)] font-sans overflow-hidden"
      data-card={activeCard}
    >
      <CardRail activeCard={activeCard} onSelect={selectCard} onOpenPalette={openPalette} />
      {placeholder ? (
        <CardPlaceholder cardId={placeholder} />
      ) : appMode === "home" ? (
```

a przed zamykającym `</div>` (po `<MobileMoreDrawer … />`) dopisz:

```tsx
{
  paletteOpen && <CommandPalette commands={cardCommands} onClose={closePalette} />;
}
```

Reszta (`HomeView`, `PlanowanieView`, `MobileNav`, `MobileMoreDrawer`) zostaje bez zmian: dostaje `setAppMode` / `setPlanningTab` z hooka, które same zdejmują zaślepkę.

- [ ] **Step 8: Testy, typy, lint (przez `cursor`)**

Run: `npx vitest run && npx tsc --noEmit && npm run lint`
Expected: wszystko przechodzi; w szczególności `tests/unit/components/layout/*` i `tests/unit/features/home/*` bez zmian.

- [ ] **Step 9: Ręczne sprawdzenie w przeglądarce**

Run: `npm run dev` i otwórz `http://localhost:3100/dashboard` (zaloguj się jak dotąd; auth znika dopiero w etapie 0).

Sprawdź:

1. Pasek 8 kart po lewej, Kokpit podświetlony bursztynem, adres kończy się `#kokpit`.
2. `Alt+2` → kalendarz, czerwony akcent na „2”, adres `#kalendarz`. Tak samo `Alt+3`, `Alt+5`, `Alt+6`, `Alt+7`.
3. `Alt+4` i `Alt+8` → zaślepki z etapem i ścieżką makiety; klik w stary pasek boczny wraca do widoku.
4. Klik „Mapy myśli” w starym pasku bocznym → aktywna karta Płótno.
5. `Ctrl+K` → paleta; „plotno” + Enter → Płótno; `Esc` zamyka; klik w tło zamyka.
6. Odśwież stronę na `#notatki` → zostajesz na Notatkach.
7. W edytorze notatki `Alt+1` przełącza na Kokpit, a pisanie polskich znaków (AltGr) działa normalnie.
8. Okno węższe niż 768 px: pasek kart znika, działa `MobileNav`.

Jeśli `Alt+cyfra` przełącza karty przeglądarki zamiast aplikacji (Chrome na Linuksie), zapisz to w §6.6 specu jako potwierdzone ryzyko i zostaw decyzję o innym skrócie użytkownikowi.

- [ ] **Step 10: Commit**

```bash
git add src/App.tsx src/features/cards/cards.ts tests/unit/features/cards/cardCommands.test.ts
git commit -m "feat(cards): wire card rail, hotkeys and palette into App"
```

---

### Task 9: Review i zamknięcie

- [ ] **Step 1:** Niezależny review diffa przez `agy` (`scripts/ask-helper.sh --role review agy "…"`): zakres `git diff main...HEAD -- src/features/cards src/App.tsx app/layout.tsx`, pytania: zgodność z §6.6, wycieki nasłuchów, kolizje skrótów, dostępność paska i palety. Uwagi weryfikuję w kodzie przed zmianą.
- [ ] **Step 2:** Zaktualizuj `docs/mockups/karty/STAN-W-KODZIE.md` w sekcji Kokpit: wiersz „Ctrl+K i Alt+1…8” na **JEST** (`src/features/cards/`).
- [ ] **Step 3: Commit**

```bash
git add docs/mockups/karty/STAN-W-KODZIE.md
git commit -m "docs(cards): mark shell hotkeys as implemented"
```

---

## Poza tym planem (kolejne plany)

- **Etap 0** (odpięcie Firebase, `lib/nexus/`): osobny spec i plan zgodnie z §7 specu; zaczyna się od skryptu eksportu Firestore.
- **Pasek stanu** (projekt, vault, branch): po etapie 0, bo czyta `lib/nexus/`.
- **Przenoszenie kart** (motyw `data-card` z pełnych `tokens.css`, układ z makiety): jeden plan na kartę, kolejność Kokpit → Zadania → Kalendarz → Notatki → Płótno → Arsenał; Projekty w etapie 1, Mapa w etapie 4.
- **Usunięcie starego paska bocznego i `MobileNav`**: po przeniesieniu wszystkich kart.
