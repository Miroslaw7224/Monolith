# Karta Kodeks, część A (szkielet) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dodać do szkieletu kart dziewiątą kartę **Kodeks** (zaślepka): wpis w rejestrze, skrót `Alt+9`, komenda w palecie, akcent zieleni `#3ddc84`, motyw w makietach i zaktualizowana dokumentacja.

**Architecture:** Zmiana jest czysto dodająca. Rejestr `CARDS` w `src/features/cards/cards.ts` jest jedynym źródłem prawdy: pasek, paleta, nawigacja i zaślepka czytają go generycznie (po `target.kind`), więc dochodzi jeden wpis i poszerzenie wyrażenia skrótu z `[1-8]` na `[1-9]`. Reszta to CSS (akcent, przewijanie paska), makiety `docs/mockups/karty/` (mają własną kopię logiki szkieletu) i dokumenty.

**Tech Stack:** Next.js 14, React, TypeScript, Vitest + Testing Library (jsdom), CSS, statyczne makiety HTML.

**Spec:** `docs/superpowers/specs/2026-11-12-karta-kodeks-design.md` §3 (część A). Część A nic nie zapisuje w Firestore ani w vaulcie.

**Gałąź:** `feat/karty-szkielet` (już istnieje, commity lokalne, bez pusha). Wszystkie komendy z katalogu `~/projects/Brain_7224/Second_brain`.

**Uruchamianie testów:** krótkie, celowane uruchomienia (`npx vitest run <plik>`) wolno odpalać bezpośrednio. Pełny zestaw (`npx vitest run`), `npx tsc --noEmit` i `npm run lint` w Zadaniu 6 zleca się pomocnikowi `cursor` (`scripts/ask-helper.sh --role task cursor "..."`), który zwraca „przeszło" albo listę `plik:linia + przyczyna`. Commity formatuje `lint-staged` (prettier), więc nie trzeba formatować ręcznie.

---

## Decyzje podjęte w planie (spoza specu, do potwierdzenia przy review)

1. **Zaślepka makiety `09-kodeks.html`.** Spec §3 każe linkować `cards/09-kodeks.html` z `shell.js` i `index.html`, a `CardPlaceholder` wyświetla tę ścieżkę, ale pełna makieta powstaje dopiero w części B (§4.7). Bez pliku skrót `Alt+9` w makietach i kafelek w `index.html` prowadziłyby w 404. Plan dodaje **minimalną zaślepkę** (nagłówek + informacja), którą część B nadpisze pełną makietą.
2. **Odcień `--ok` w motywie Kodeksu.** Spec dopuszcza „inny odcień albo dodatkowy znak". Plan wybiera **inny odcień** (`#5eead4`, teal, ok. 24° od akcentu `#3ddc84`), a wymóg dodatkowej ikony odznaki sukcesu zostaje zapisany jako uwaga dla części B. Zadanie 3 ma skrypt liczący kontrast i różnicę odcieni.
3. **Krój nagłówków `--font-display: "Manrope"`.** Spec go nie wskazuje. Czytelny, bezszeryfowy (STYLEGUIDE zabrania szeryfów), nieużywany przez inną kartę. Można podmienić przy makiecie w części B.
4. **Test spójności CSS** (Zadanie 2): każda karta z rejestru musi mieć `--c-<id>` w `cards.css` i `tokens.css` oraz blok `[data-card="<id>"]` w `tokens.css`. Chroni przed zapomnieniem koloru przy 10. karcie.

---

## Mapa plików

| Plik                                                                 | Zmiana                                                          |
| -------------------------------------------------------------------- | --------------------------------------------------------------- |
| `src/features/cards/cards.ts`                                        | `CardId` + `"kodeks"`, 9. wpis w `CARDS`                        |
| `src/features/cards/useCardHotkeys.ts`                               | `Digit([1-8])` → `Digit([1-9])`                                 |
| `src/features/cards/cards.css`                                       | `--c-kodeks`, `overflow-y: auto` dla `.card-rail`               |
| `tests/unit/features/cards/cards.test.ts`                            | dziewięć kart, `cardByHotkey(9/10/0)`, `#kodeks`                |
| `tests/unit/features/cards/cardCommands.test.ts`                     | dziewięć komend, ostatnia `go-kodeks`                           |
| `tests/unit/features/cards/useCardHotkeys.test.ts`                   | `Alt+9` wybiera Kodeks, `Alt+0` nie                             |
| `tests/unit/features/cards/CardRail.test.tsx`                        | dziewięć kart, Kodeks ostatni                                   |
| `tests/unit/features/cards/CardPlaceholder.test.tsx`                 | zaślepka Kodeksu                                                |
| `tests/unit/features/cards/useCardNavigation.test.ts`                | placeholder → placeholder                                       |
| `tests/unit/features/cards/cardsCss.test.ts` (nowy)                  | spójność CSS z rejestrem                                        |
| `docs/mockups/karty/tokens.css`                                      | `--c-kodeks`, blok `[data-card="kodeks"]`, nagłówek „9 motywów" |
| `docs/mockups/karty/shell.js`                                        | 9. wpis, `Digit[1-9]`, napis `Alt+1…9`                          |
| `docs/mockups/karty/index.html`                                      | kafelek 9. karty, „9 kart", `Alt+1…9`                           |
| `docs/mockups/karty/cards/09-kodeks.html` (nowy)                     | minimalna zaślepka makiety                                      |
| `docs/mockups/karty/STYLEGUIDE.md`                                   | „palety 9 kart", prefiks `.kod-`                                |
| `docs/mockups/karty/STAN-W-KODZIE.md`                                | `Alt+1…9`, sekcja „9. Kodeks"                                   |
| `docs/superpowers/specs/2026-11-11-asystent-lokalny-nexus-design.md` | §6.6: 9 kart, wiersz `Alt+9`, `Alt+1…9`                         |

Nie zmieniamy: `CardRail.tsx`, `CardPlaceholder.tsx`, `useCardNavigation.ts`, `App.tsx`, `MobileNav` (czytają rejestr generycznie albo go nie używają), planu `2026-11-11-karty-szkielet.md` (zapis historyczny).

---

### Task 1: Rejestr kart i skrót Alt+9 (TDD)

**Files:**

- Modify: `tests/unit/features/cards/cards.test.ts`
- Modify: `tests/unit/features/cards/cardCommands.test.ts`
- Modify: `tests/unit/features/cards/useCardHotkeys.test.ts`
- Modify: `tests/unit/features/cards/CardRail.test.tsx`
- Modify: `tests/unit/features/cards/CardPlaceholder.test.tsx`
- Modify: `tests/unit/features/cards/useCardNavigation.test.ts`
- Modify: `src/features/cards/cards.ts`
- Modify: `src/features/cards/useCardHotkeys.ts:26`

- [ ] **Step 1: Zaktualizuj `cards.test.ts` (czerwony test)**

W `tests/unit/features/cards/cards.test.ts` zastąp blok `describe("CARDS", ...)` oraz `describe("cardByHotkey", ...)` oraz test `rozpoznaje znane karty z # i bez`:

```ts
describe("CARDS", () => {
  test("ma 9 kart z klawiszami 1..9 w kolejności", () => {
    expect(CARDS.map((c) => c.hotkey)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(CARDS.map((c) => c.id)).toEqual([
      "kokpit",
      "kalendarz",
      "zadania",
      "projekty",
      "notatki",
      "plotno",
      "arsenal",
      "mapa",
      "kodeks",
    ]);
  });

  test("projekty, mapa i kodeks to zaślepki", () => {
    expect(getCard("projekty").target).toEqual({ kind: "placeholder", stage: "etap 1" });
    expect(getCard("mapa").target).toEqual({ kind: "placeholder", stage: "etap 4" });
    expect(getCard("kodeks").target).toEqual({ kind: "placeholder", stage: "po etapie 0c" });
  });

  test("Kodeks jest ostatnią kartą z etykietą Kodeks", () => {
    expect(CARDS[CARDS.length - 1]).toMatchObject({ id: "kodeks", label: "Kodeks", hotkey: 9 });
  });
});

describe("cardByHotkey", () => {
  test("zwraca kartę dla 1..9 i undefined poza zakresem", () => {
    expect(cardByHotkey(3)?.id).toBe("zadania");
    expect(cardByHotkey(9)?.id).toBe("kodeks");
    expect(cardByHotkey(10)).toBeUndefined();
    expect(cardByHotkey(0)).toBeUndefined();
  });
});
```

W `describe("cardFromHash", ...)` w pierwszym teście dodaj asercję (przed zamykającym `});` testu):

```ts
expect(cardFromHash("#kodeks")).toBe("kodeks");
```

- [ ] **Step 2: Zaktualizuj `cardCommands.test.ts` (czerwony test)**

Zastąp całą zawartość `tests/unit/features/cards/cardCommands.test.ts`:

```ts
import { test, expect, vi } from "vitest";
import { buildCardCommands } from "@/src/features/cards/cards";

test("buduje 9 komend Przejdź z podpowiedzią skrótu", () => {
  const selectCard = vi.fn();
  const cmds = buildCardCommands(selectCard);
  expect(cmds).toHaveLength(9);
  expect(cmds[5]).toMatchObject({ id: "go-plotno", label: "Przejdź: Płótno", hint: "Alt+6" });
  cmds[5].run();
  expect(selectCard).toHaveBeenCalledWith("plotno");
});

test("ostatnia komenda przechodzi do Kodeksu z hintem Alt+9", () => {
  const selectCard = vi.fn();
  const cmds = buildCardCommands(selectCard);
  expect(cmds[8]).toMatchObject({ id: "go-kodeks", label: "Przejdź: Kodeks", hint: "Alt+9" });
  cmds[8].run();
  expect(selectCard).toHaveBeenCalledWith("kodeks");
});
```

- [ ] **Step 3: Zaktualizuj `useCardHotkeys.test.ts` (czerwony test)**

W `tests/unit/features/cards/useCardHotkeys.test.ts` zastąp test `"Alt+9 i Alt+0 nic nie robią"` dwoma:

```ts
test("Alt+9 wybiera Kodeks", () => {
  const { onSelectCard } = setup();
  fireEvent.keyDown(window, { key: "9", code: "Digit9", altKey: true });
  expect(onSelectCard).toHaveBeenCalledWith("kodeks");
});

test("Alt+0 nic nie robi", () => {
  const { onSelectCard } = setup();
  fireEvent.keyDown(window, { key: "0", code: "Digit0", altKey: true });
  expect(onSelectCard).not.toHaveBeenCalled();
});
```

- [ ] **Step 4: Zaktualizuj `CardRail.test.tsx` (czerwony test)**

W `tests/unit/features/cards/CardRail.test.tsx` zastąp pierwszy test (`"pokazuje 8 kart w nawigacji"`):

```tsx
test("pokazuje 9 kart w nawigacji, Kodeks ostatni", () => {
  render(<CardRail activeCard="kokpit" onSelect={vi.fn()} onOpenPalette={vi.fn()} />);
  const nav = screen.getByRole("navigation", { name: "Karty" });
  const items = nav.querySelectorAll("[data-card-id]");
  expect(items).toHaveLength(9);
  expect(items[items.length - 1]).toHaveAttribute("data-card-id", "kodeks");
  expect(screen.getByRole("button", { name: /Płótno/ })).toHaveAttribute("title", "Płótno (Alt+6)");
  expect(screen.getByRole("button", { name: /Kodeks/ })).toHaveAttribute("title", "Kodeks (Alt+9)");
});
```

- [ ] **Step 5: Zaktualizuj `CardPlaceholder.test.tsx` (czerwony test)**

Dopisz na końcu `tests/unit/features/cards/CardPlaceholder.test.tsx`:

```tsx
test("zaślepka Kodeksu pokazuje etap i ścieżkę makiety 09", () => {
  render(<CardPlaceholder cardId="kodeks" />);
  expect(screen.getByRole("heading", { name: "Kodeks" })).toBeInTheDocument();
  expect(screen.getByText(/po etapie 0c/)).toBeInTheDocument();
  expect(screen.getByText("docs/mockups/karty/cards/09-kodeks.html")).toBeInTheDocument();
});
```

- [ ] **Step 6: Zaktualizuj `useCardNavigation.test.ts` (czerwony test)**

W `tests/unit/features/cards/useCardNavigation.test.ts` dopisz test na końcu bloku `describe("useCardNavigation", ...)` (przed jego zamykającym `});`):

```ts
test("przejście zaślepka → zaślepka ustawia Kodeks i adres #kodeks", () => {
  const { result } = renderHook(() => useCardNavigation());
  act(() => result.current.selectCard("projekty"));
  expect(result.current.placeholder).toBe("projekty");
  act(() => result.current.selectCard("kodeks"));
  expect(result.current.placeholder).toBe("kodeks");
  expect(result.current.activeCard).toBe("kodeks");
  expect(window.location.hash).toBe("#kodeks");
});

test("przy starcie czyta Kodeks z hasha", () => {
  window.history.replaceState(null, "", "/dashboard#kodeks");
  const { result } = renderHook(() => useCardNavigation());
  expect(result.current.activeCard).toBe("kodeks");
  expect(result.current.placeholder).toBe("kodeks");
});
```

- [ ] **Step 7: Uruchom testy i potwierdź czerwień**

Run: `npx vitest run tests/unit/features/cards`
Expected: FAIL. Padają m.in. `ma 9 kart...` (długość 8 ≠ 9), `ostatnia komenda przechodzi do Kodeksu`, `Alt+9 wybiera Kodeks`, `pokazuje 9 kart...`, `zaślepka Kodeksu...` (`Nieznana karta: kodeks`), oba nowe testy nawigacji. Zapisz w raporcie, że przyczyną jest brak wpisu `kodeks` w rejestrze, a nie literówka w teście. Jeśli któryś nowy test przechodzi, popraw go, zanim ruszysz kod.

- [ ] **Step 8: Dodaj kartę do rejestru**

W `src/features/cards/cards.ts` w unii `CardId` dopisz wariant po `"mapa"`:

```ts
export type CardId =
  | "kokpit"
  | "kalendarz"
  | "zadania"
  | "projekty"
  | "notatki"
  | "plotno"
  | "arsenal"
  | "mapa"
  | "kodeks";
```

W tablicy `CARDS` dopisz po wpisie `mapa`:

```ts
  { id: "mapa", label: "Mapa", hotkey: 8, target: { kind: "placeholder", stage: "etap 4" } },
  {
    id: "kodeks",
    label: "Kodeks",
    hotkey: 9,
    target: { kind: "placeholder", stage: "po etapie 0c" },
  },
];
```

`TAB_TO_CARD` nie zmienia się: Kodeks nie jest zakładką `PlanningTab` (w części B dostanie wariant `CardTarget` `codex`).

- [ ] **Step 9: Poszerz wyrażenie skrótu**

W `src/features/cards/useCardHotkeys.ts` linia 26:

```ts
const match = /^Digit([1-9])$/.exec(e.code);
```

- [ ] **Step 10: Uruchom testy i potwierdź zieleń**

Run: `npx vitest run tests/unit/features/cards`
Expected: PASS, wszystkie pliki w `tests/unit/features/cards/` zielone (7 plików).

- [ ] **Step 11: Commit**

```bash
git add tests/unit/features/cards src/features/cards/cards.ts src/features/cards/useCardHotkeys.ts
git commit -m "feat: add Kodeks as the 9th card (registry, Alt+9, palette command)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Test spójności CSS z rejestrem kart (TDD)

**Files:**

- Create: `tests/unit/features/cards/cardsCss.test.ts`

Test czyta pliki CSS jako tekst i pilnuje, że każda karta z rejestru ma kolor w pasku aplikacji i w makietach oraz blok motywu w `tokens.css`. Po Zadaniu 1 jest czerwony dla `kodeks`, co jest oczekiwane.

- [ ] **Step 1: Napisz test**

Utwórz `tests/unit/features/cards/cardsCss.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, test, expect } from "vitest";
import { CARDS } from "@/src/features/cards/cards";

const root = resolve(__dirname, "../../../..");
const read = (rel: string) => readFileSync(resolve(root, rel), "utf8");

const appCss = read("src/features/cards/cards.css");
const tokensCss = read("docs/mockups/karty/tokens.css");

describe("spójność CSS z rejestrem kart", () => {
  test.each(CARDS.map((c) => c.id))("%s ma --c-<id> w cards.css", (id) => {
    expect(appCss).toMatch(new RegExp(`--c-${id}:\\s*#[0-9a-fA-F]{6};`));
  });

  test.each(CARDS.map((c) => c.id))("%s ma --c-<id> i blok motywu w tokens.css", (id) => {
    expect(tokensCss).toMatch(new RegExp(`--c-${id}:\\s*#[0-9a-fA-F]{6};`));
    expect(tokensCss).toContain(`[data-card="${id}"] {`);
  });

  test.each(CARDS.map((c) => c.id))("%s ma ten sam akcent w cards.css i tokens.css", (id) => {
    const pick = (css: string) =>
      new RegExp(`--c-${id}:\\s*(#[0-9a-fA-F]{6});`).exec(css)?.[1]?.toLowerCase();
    expect(pick(appCss)).toBeDefined();
    expect(pick(appCss)).toBe(pick(tokensCss));
  });

  test("Kodeks ma akcent #3ddc84 (decyzja K6)", () => {
    expect(appCss).toMatch(/--c-kodeks:\s*#3ddc84;/i);
  });
});
```

- [ ] **Step 2: Uruchom i potwierdź czerwień**

Run: `npx vitest run tests/unit/features/cards/cardsCss.test.ts`
Expected: FAIL tylko dla `kodeks` (trzy testy `kodeks ma ...` oraz `Kodeks ma akcent #3ddc84`); wszystkie testy dla ośmiu istniejących kart zielone. Jeśli padają testy istniejących kart, popraw test (regex), a nie CSS.

- [ ] **Step 3: Nie commituj jeszcze**

Test przejdzie po Zadaniach 3 i 4. Commit razem z Zadaniem 3 (żeby historia nie miała czerwonego testu).

---

### Task 3: Akcent i motyw Kodeksu w CSS (aplikacja + makiety)

**Files:**

- Modify: `src/features/cards/cards.css:3-10` i `:18-31`
- Modify: `docs/mockups/karty/tokens.css` (nagłówek, `:root`, nowy blok na końcu)

- [ ] **Step 1: Akcent w `cards.css`**

W `src/features/cards/cards.css` w `:root` po `--c-mapa: #ff2bd6;` dopisz:

```css
--c-kodeks: #3ddc84;
```

- [ ] **Step 2: Przewijanie paska przy dziewięciu przyciskach**

W `src/features/cards/cards.css` w bloku `@media (min-width: 768px) { .card-rail { ... } }` dopisz po `z-index: 2;`:

```css
overflow-y: auto;
```

Uwaga z review `agy`: klasyczny pasek przewijania (15 px) zwęża obszar zawartości do 60 px, przycisk ląduje przy x=0, a wskaźnik `::before` (`left: -8px`) wypada poza obszar przewijania. Dlatego pasek dostaje też `overflow-x: hidden` i `scrollbar-width: none` (przewijanie kółkiem i klawiaturą działa dalej).

- [ ] **Step 3: Akcent i nagłówek w `tokens.css`**

W `docs/mockups/karty/tokens.css`:

1. Linia 3: `Wspólne zmienne + 8 motywów włączanych atrybutem data-card na <html>.` → `Wspólne zmienne + 9 motywów włączanych atrybutem data-card na <html>.`
2. W `:root` po `--c-mapa: #ff2bd6;` dopisz `  --c-kodeks: #3ddc84;`

- [ ] **Step 4: Blok motywu na końcu `tokens.css`**

Dopisz na końcu `docs/mockups/karty/tokens.css`:

```css
/* ---------- Alt+9 Kodeks: wspólny grafit + zieleń ---------- */
/* Zieleń leży blisko --ok (decyzja K6): --ok jest tu teal (#5eead4), nie zielony,
   a odznaka sukcesu w części B dostaje dodatkowo ikonę (nie sam kolor). */
[data-card="kodeks"] {
  --bg: #15161a;
  --surface: #1e1f24;
  --surface-2: #282a30;
  --line: #373a42;
  --text: #f0f0f2;
  --muted: #a8aab2;
  --accent: #3ddc84;
  --accent-text: #5ee89b;
  --accent-ink: #03150a;
  --accent-soft: rgba(61, 220, 132, 0.14);
  --glow: rgba(61, 220, 132, 0.5);
  --ok: #5eead4;
  --warn: #facc15;
  --danger: #ff6b6b;
  --font-display: "Manrope", var(--font-body);
  --pattern: radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.045) 1px, transparent 0) 0 0 /
    22px 22px;
  color-scheme: dark;
}
```

- [ ] **Step 5: Sprawdź kontrast i odcień skryptem**

Nagłówek `tokens.css` obiecuje WCAG AA. Run:

```bash
node -e '
const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255);
const lin=c=>c<=0.03928?c/12.92:((c+0.055)/1.055)**2.4;
const L=h=>{const [r,g,b]=hex(h).map(lin);return 0.2126*r+0.7152*g+0.0722*b};
const cr=(a,b)=>{const [x,y]=[L(a),L(b)].sort((p,q)=>q-p);return (x+0.05)/(y+0.05)};
const hue=h=>{const [r,g,b]=hex(h);const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;
 let H=mx===r?((g-b)/d)%6:mx===g?(b-r)/d+2:(r-g)/d+4;return (H*60+360)%360};
const out={
 "accent-text/bg":cr("#5ee89b","#15161a"),
 "accent-text/surface":cr("#5ee89b","#1e1f24"),
 "accent-ink/accent":cr("#03150a","#3ddc84"),
 "text/bg":cr("#f0f0f2","#15161a"),
 "muted/surface":cr("#a8aab2","#1e1f24"),
 "ok/surface":cr("#5eead4","#1e1f24"),
 "hue accent":hue("#3ddc84"),"hue ok":hue("#5eead4"),
 "hue diff":Math.abs(hue("#5eead4")-hue("#3ddc84"))};
for(const [k,v] of Object.entries(out))console.log(k.padEnd(22),v.toFixed(2));
const bad=Object.entries(out).filter(([k,v])=>!k.startsWith("hue")&&v<4.5);
if(bad.length||out["hue diff"]<20){console.log("FAIL",bad);process.exit(1)}console.log("OK")'
```

Expected: wszystkie wiersze kontrastu ≥ 4.5, `hue diff` ≥ 20 (ok. 24), na końcu `OK`. Jeśli `FAIL`: popraw odpowiednią wartość w bloku z Kroku 4 (np. jaśniejszy `--accent-text`, ciemniejszy `--accent-ink`, `--ok` dalej od odcienia 147°), uruchom ponownie, a zmianę zapisz w raporcie.

- [ ] **Step 6: Uruchom test spójności CSS i testy kart**

Run: `npx vitest run tests/unit/features/cards`
Expected: PASS (w tym `cardsCss.test.ts`: 3 × 9 testów + test K6).

- [ ] **Step 7: Sprawdź wizualnie pasek w niskim oknie**

Spec wymaga ręcznego sprawdzenia w oknie ok. 600 px wysokości. Run: `npm run dev`, otwórz aplikację w przeglądarce, zmniejsz wysokość okna do ok. 600 px.
Expected: dziewiąty przycisk (Kodeks, zielony akcent po wybraniu) osiągalny przewijaniem paska, brak poziomego paska przewijania, wskaźnik aktywnej karty przy lewej krawędzi widoczny. Brak możliwości obejrzenia w przeglądarce → napisz to w raporcie jako niesprawdzone, nie zaznaczaj kroku.

- [ ] **Step 8: Commit**

```bash
git add tests/unit/features/cards/cardsCss.test.ts src/features/cards/cards.css docs/mockups/karty/tokens.css
git commit -m "feat: Kodeks accent (#3ddc84), scrollable card rail, CSS consistency test

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Makiety: shell.js, index.html i zaślepka 09-kodeks.html

**Files:**

- Modify: `docs/mockups/karty/shell.js:11-20`, `:50`, `:179`
- Modify: `docs/mockups/karty/index.html:7`, `:65-66`, po `:107`
- Create: `docs/mockups/karty/cards/09-kodeks.html`

Makiety to statyczny HTML bez testów jednostkowych; weryfikacja przez `grep` (Krok 5) i ręczne otwarcie (Krok 6).

- [ ] **Step 1: `shell.js`: dziewiąty wpis**

W tablicy `CARDS` w `docs/mockups/karty/shell.js` po wpisie `mapa` dopisz:

```js
    { id: "mapa", label: "Mapa", file: "08-mapa.html" },
    { id: "kodeks", label: "Kodeks", file: "09-kodeks.html" },
  ];
```

- [ ] **Step 2: `shell.js`: napis paska stanu i regex skrótu**

Linia 50: `Alt+1…8 karty · Alt+0 źródła · Ctrl+K polecenia` → `Alt+1…9 karty · Alt+0 źródła · Ctrl+K polecenia`.

Linia 179: `if (e.altKey && /^Digit[1-8]$/.test(e.code)) {` → `if (e.altKey && /^Digit[1-9]$/.test(e.code)) {`.

- [ ] **Step 3: `index.html`: nagłówek i opis**

Linia 7 (komentarz): `siatka 8 żywych miniatur` → `siatka 9 żywych miniatur`.
Linia 65: `<h1>Second Brain: 8 kart</h1>` → `<h1>Second Brain: 9 kart</h1>`.
Linia 66: `skróty Alt+1…8` → `skróty Alt+1…9`.

- [ ] **Step 4: `index.html`: kafelek 9. karty**

Po zamykającym `</a>` kafelka Mapy (linia 107), przed `</div>` kończącym siatkę, dopisz:

```html
<a class="card" href="cards/09-kodeks.html" style="--c: #3ddc84">
  <div class="thumb">
    <iframe
      src="cards/09-kodeks.html"
      title="Podgląd: Kodeks"
      loading="lazy"
      tabindex="-1"
    ></iframe>
  </div>
  <div class="meta">
    <span class="num">9</span>
    <div>
      <h2>Kodeks</h2>
      <p>Zasady pracy nad kodem: czytnik kodeksu z regułami MUST/SHOULD i checklisty do zadań.</p>
    </div>
    <span class="key">Alt+9</span>
  </div>
</a>
```

- [ ] **Step 5: Zaślepka `09-kodeks.html`**

Utwórz `docs/mockups/karty/cards/09-kodeks.html`:

```html
<!doctype html>
<html lang="pl" data-card="kodeks" data-project="second-brain" data-branch="main">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Kodeks · Second Brain</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Manrope:wght@500;700;800&display=swap"
    />
    <link rel="stylesheet" href="../tokens.css" />
    <link rel="stylesheet" href="../shell.css" />
  </head>
  <body>
    <div class="app">
      <main class="view">
        <header class="view-head">
          <div>
            <p class="view-head__eyebrow">Alt+9 · Kodeks</p>
            <h1 class="view-head__title">Kodeks pracy nad kodem</h1>
            <p class="view-head__sub">
              Zaślepka makiety. Pełny układ (czytnik reguł z filtrem MUST/SHOULD i checklisty)
              powstaje w części B, po etapie 0c:
              <code>docs/superpowers/specs/2026-11-12-karta-kodeks-design.md</code> §4.7.
            </p>
          </div>
        </header>
      </main>
    </div>
    <script src="../shell.js"></script>
  </body>
</html>
```

- [ ] **Step 6: Zweryfikuj `grep`em, że w makietach nie został stary zakres**

Run:

```bash
grep -rn "Digit\[1-8\]\|Alt+1…8\|8 kart\|8 motyw\|8 żywych" docs/mockups/karty/shell.js docs/mockups/karty/index.html docs/mockups/karty/tokens.css
```

Expected: brak wyników (kod wyjścia 1).

Run: `grep -c "09-kodeks.html" docs/mockups/karty/shell.js docs/mockups/karty/index.html`
Expected: `shell.js:1`, `index.html:2` (linia z `href` i linia z `iframe src` kafelka; jeśli inna liczba, sprawdź kafelek).

- [ ] **Step 7: Obejrzyj makietę ręcznie**

Otwórz `docs/mockups/karty/index.html` i `docs/mockups/karty/cards/09-kodeks.html` w przeglądarce.
Expected: siatka pokazuje 9 kafelków, dziewiąty z zielonym akcentem i podglądem zaślepki; w `09-kodeks.html` pasek kart ma 9 pozycji, Kodeks podświetlony na zielono, `Alt+9` z innej makiety przechodzi do Kodeksu, w palecie `Ctrl+K` jest „Kodeks". Jeśli nie możesz otworzyć przeglądarki, napisz to w raporcie.

- [ ] **Step 8: Commit**

```bash
git add docs/mockups/karty/shell.js docs/mockups/karty/index.html docs/mockups/karty/cards/09-kodeks.html
git commit -m "docs: Kodeks in card mockups (shell, index grid, stub page)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Dokumentacja: STYLEGUIDE, STAN-W-KODZIE, spec §6.6

**Files:**

- Modify: `docs/mockups/karty/STYLEGUIDE.md:19`, `:97`
- Modify: `docs/mockups/karty/STAN-W-KODZIE.md:20`, po `:90`
- Modify: `docs/superpowers/specs/2026-11-11-asystent-lokalny-nexus-design.md:157`, tabela §6.6, `:170`, `:174`, `:190`

Zadanie dokumentacyjne: kontrola przez `grep` na starych wartościach.

- [ ] **Step 1: `STYLEGUIDE.md`**

Linia 19: `palety 8 kart + wspólne zmienne` → `palety 9 kart + wspólne zmienne` (zachowaj szerokość kolumny; prettier przy commicie wyrówna tabelę).

Linie 96–97: zamień

```
Notatki `.not-`, Płótno `.plo-`, Arsenał `.ars-`, Mapa `.map-`.
```

na

```
Notatki `.not-`, Płótno `.plo-`, Arsenał `.ars-`, Mapa `.map-`, Kodeks `.kod-`.
```

- [ ] **Step 2: `STAN-W-KODZIE.md`**

Linia 20: `Ctrl+K i Alt+1…8` → `Ctrl+K i Alt+1…9`. Kolumna „Gdzie / uwagi" tego wiersza dopisz po średniku: `; Alt+9 = Kodeks (zaślepka)`.

Po sekcji `## 8. Mapa` (po jej akapicie, przed `## Wnioski do planu wdrożenia`) dopisz:

```markdown
## 9. Kodeks

Wszystko **BRAK** poza zaślepką w szkielecie kart (`src/features/cards/`, `Alt+9`). Czytnik kodeksu
(`Vault/Knowledge/kodeks.md`) i checklisty to część B specu `2026-11-12-karta-kodeks-design.md`,
zależna od warstwy `lib/nexus/` (etap 0c).
```

Zdanie na końcu sekcji „Wnioski" (`Szkielet: pasek kart, Alt+1…8 i Ctrl+K nie istnieją...`) zostaje bez zmian: to opis stanu sprzed szkieletu (zapis historyczny).

- [ ] **Step 3: Spec nadrzędny §6.6**

W `docs/superpowers/specs/2026-11-11-asystent-lokalny-nexus-design.md`:

1. Linia 157: `Aplikacja dzieli się na 8 kart.` → `Aplikacja dzieli się na 9 kart.`
2. W tabeli po wierszu `Alt+8 | Mapa ...` dopisz wiersz:

```
| Alt+9 | Kodeks    | czytnik kodeksu pracy nad kodem (reguły MUST/SHOULD) i checklisty do zadań     | 0c+ (B)    | brak (nowa, na `lib/nexus/`; spec `2026-11-12-karta-kodeks-design.md`) |
```

3. Linia 170: `numerami 1–8` → `numerami 1–9`, `Alt+1…8 przełącza karty` → `Alt+1…9 przełącza karty`.
4. Linia 171–172 (punkt „Szkielet nie zależy od danych"): w zdaniu o kartach bez kodu zmień `(Projekty, Mapa)` na `(Projekty, Mapa, Kodeks)`.
5. Linia 174: `zajmuje \`Alt+1…8\` do przełączania kart`→`zajmuje \`Alt+1…9\` do przełączania kart`.
6. Linia 190: `\`Alt+1…8\``→`\`Alt+1…9\``.

- [ ] **Step 4: Zweryfikuj `grep`em**

Run:

```bash
grep -n "Alt+1…8\|1–8\|8 kart\|palety 8" docs/mockups/karty/STYLEGUIDE.md docs/superpowers/specs/2026-11-11-asystent-lokalny-nexus-design.md
grep -n "Alt+1…8" docs/mockups/karty/STAN-W-KODZIE.md
```

Expected: pierwsza komenda bez wyników; druga tylko linia „Szkielet: ... nie istnieją" w „Wnioskach" (zapis historyczny, celowo bez zmian).

Run: `grep -n "Kodeks" docs/superpowers/specs/2026-11-11-asystent-lokalny-nexus-design.md | head`
Expected: wiersz `Alt+9` w tabeli oraz `Kodeks` w zdaniu o zaślepkach.

- [ ] **Step 5: Commit**

```bash
git add docs/mockups/karty/STYLEGUIDE.md docs/mockups/karty/STAN-W-KODZIE.md docs/superpowers/specs/2026-11-11-asystent-lokalny-nexus-design.md
git commit -m "docs: nine cards (Alt+1…9, Kodeks row) in spec §6.6, STYLEGUIDE, STAN-W-KODZIE

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Weryfikacja końcowa

**Files:** brak zmian (chyba że weryfikacja wykaże błąd).

- [ ] **Step 1: Zleć pełny zestaw pomocnikowi `cursor`**

Run:

```bash
scripts/ask-helper.sh --role task --fresh cursor "W katalogu ~/projects/Brain_7224/Second_brain uruchom po kolei: (1) npx vitest run, (2) npx tsc --noEmit, (3) npm run lint. Niczego nie edytuj. Odpowiedz 'przeszło' dla każdej komendy albo podaj listę plik:linia + przyczyna dla porażek. Jeśli porażka dotyczy plików poza src/features/cards, tests/unit/features/cards i docs/mockups/karty, napisz też, czy występuje na czystym main (git stash niepotrzebny: porównaj z 'git diff main --stat')."
```

Expected: trzy razy „przeszło". Jeśli padają testy spoza `cards` i nie dotykają naszych plików (`git diff main --stat`), to porażka wcześniejsza: zgłoś użytkownikowi, nie naprawiaj w tym planie.

- [ ] **Step 2: Sprawdź, że zmiana nie wyszła poza zakres**

Run: `git diff main --stat -- src ':!src/features/cards'`
Expected: brak plików (część A nie dotyka niczego w `src/` poza `src/features/cards/`; zmiany z wcześniejszych commitów gałęzi `feat/karty-szkielet` mogą się pojawić, wtedy porównaj z `git diff d11870f --stat`).

Run: `git diff d11870f --stat`
Expected: tylko pliki z „Mapy plików" powyżej (17 plików, w tym 2 nowe: `cardsCss.test.ts`, `09-kodeks.html`) oraz sam plan `docs/superpowers/plans/2026-11-12-karta-kodeks-czesc-a.md`, jeśli został już scommitowany.

- [ ] **Step 3: Review diffa przez pomocnika**

Run:

```bash
scripts/ask-helper.sh --role review agy "Zrób niezależny review zmian w katalogu ~/projects/Brain_7224/Second_brain od commitu d11870f do HEAD (git diff d11870f). Kontekst: dodanie dziewiątej karty Kodeks (zaślepka) do szkieletu kart; spec docs/superpowers/specs/2026-11-12-karta-kodeks-design.md §3. Sprawdź tylko: (a) czy gdziekolwiek w src/ lub docs/mockups/karty/ został zakres 1–8 / Digit[1-8] / '8 kart', (b) czy testy naprawdę sprawdzają zachowanie (nie przechodzą pustą asercją), (c) czy overflow-y: auto na .card-rail nie ucina wskaźnika aktywnej karty (::before left:-8px) ani poświaty, (d) czy 09-kodeks.html jest spójna z innymi makietami (ładowanie shell.js, data-card). Odpowiedz listą plik:linia + problem, albo 'brak uwag'. Max 25 linii."
```

Expected: „brak uwag" albo lista. Każdą uwagę zweryfikuj w kodzie, zanim cokolwiek zmienisz (opinie to hipotezy).

- [ ] **Step 4: Zakończ**

Po zielonej weryfikacji użyj `superpowers:verification-before-completion`, a potem `superpowers:finishing-a-development-branch`. Bez pusha: PR #6 nie zmienia się bez decyzji użytkownika.

---

## Self-Review (wykonany po napisaniu planu)

**Pokrycie specu §3 (część A):**

| Wymaganie specu                                                                                      | Zadanie                                        |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `cards.ts`: `CardId`, wpis `kodeks`, hotkey 9, placeholder `po etapie 0c`                            | 1 (kroki 8)                                    |
| `useCardHotkeys.ts` `[1-9]`                                                                          | 1 (krok 9)                                     |
| `cards.css` `--c-kodeks`                                                                             | 3 (krok 1)                                     |
| `tokens.css` akcent + blok `[data-card="kodeks"]` + zasada `--ok`                                    | 3 (kroki 3–5)                                  |
| `CardPlaceholder.tsx` bez zmian, ścieżka `09-kodeks.html`                                            | 1 (krok 5, test), Zadanie 4 (plik)             |
| Paleta `Ctrl+K` automatycznie                                                                        | 1 (krok 2, test)                               |
| Spec §6.6, `STYLEGUIDE.md`, „9 motywów"                                                              | 3 (krok 3), 5                                  |
| `shell.js` (wpis, regex, napis)                                                                      | 4 (kroki 1–2)                                  |
| `index.html` kafelek                                                                                 | 4 (kroki 3–4)                                  |
| `STAN-W-KODZIE.md`                                                                                   | 5 (krok 2)                                     |
| Testy: `cards`, `useCardHotkeys`, `CardRail`, `cardCommands`, `useCardNavigation`, `CardPlaceholder` | 1                                              |
| `overflow-y: auto` + ręczna kontrola ~600 px                                                         | 3 (kroki 2, 7)                                 |
| MobileNav bez zmian, plan szkieletu bez zmian                                                        | „Nie zmieniamy"                                |
| Ryzyko `Alt+9` w Chrome                                                                              | opisane w specu §6.6 (Zadanie 5, krok 3 pkt 5) |

Dodatki spoza specu: zaślepka `09-kodeks.html`, test spójności CSS, wybór `--ok` i kroju (sekcja „Decyzje podjęte w planie").

**Placeholdery:** brak „TBD/TODO"; każdy krok kodu ma kod, każda komenda oczekiwany wynik.

**Spójność nazw:** `kodeks` (id), `Kodeks` (etykieta), `go-kodeks` (id komendy), `--c-kodeks`, `[data-card="kodeks"]`, `09-kodeks.html`, `.kod-` używane tak samo w zadaniach 1–5.
