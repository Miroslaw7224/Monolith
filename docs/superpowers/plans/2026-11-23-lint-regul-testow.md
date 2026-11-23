# Lint reguł testów (Kodeks TDD-7, ASERCJE-1, ASERCJE-6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Część checklisty „DoD: zawsze” sprawdza linter w `npm run lint` (czyli w `/verify`), zamiast odhaczania ręcznego: `.only`, `.skip`/`xit`, zakomentowane testy, `expect` bez `await` na obietnicy, `expect` w `if`/`catch`.

**Architecture:** Dwie zmiany konfiguracji: (1) `npm run lint` obejmuje katalog `tests/`, którego dziś nie lintuje; (2) override w `.eslintrc.json` dla plików testów z regułami `@vitest/eslint-plugin`. Konfigurację pilnuje test, który woła ESLint przez API na tekstach przykładowych (kanarek w obie strony).

**Tech Stack:** ESLint 8.57.1 (eslintrc), `eslint-config-next` 14.2.35, `@typescript-eslint` 8.56.1, Vitest 3.2.4, nowa zależność dev `@vitest/eslint-plugin`.

---

## Fakty (sprawdzone przy pisaniu planu)

- `package.json:11` `"lint": "next lint"` bez `--dir`. Next 14.2.35 lintuje wtedy tylko `ESLINT_DEFAULT_DIRS` = `app, pages, components, lib, src` (`node_modules/next/dist/lib/constants.js:246-252`). **`tests/` i `contexts/` nie są dziś lintowane przez `/verify`**, więc reguły ASERCJE-4 (`no-explicit-any`, `ban-ts-comment`, `.eslintrc.json:8-18`) w testach pilnuje tylko ręczne `npm run lint:tests` (`package.json:12`).
- `pages/` i `components/` nie istnieją; istnieją `app/`, `lib/`, `src/`, `contexts/`, `tests/`.
- Brak `@vitest/eslint-plugin` w `node_modules/@vitest/` (są tylko `coverage-v8, expect, mocker, pretty-format, runner, snapshot, spy, utils`).
- `/verify` i `scripts/approve-check.py` znają tylko `npm run lint`, więc zakres lintu zmieniamy w skrypcie `lint`, nie w nowej komendzie.

## Decyzje do potwierdzenia przez użytkownika (przed Task 1)

- **D1. `contexts/` w lincie:** kod domeny też dziś nie jest lintowany. Propozycja: **nie w tym planie** (ZAKRES-1); osobne zadanie w `Projects/monolith/tasks.md`. Ten plan dodaje tylko `tests/`.
- **D2. `no-floating-promises` (ASERCJE-6, `waitFor` bez `await`):** wymaga lintu z typami (`parserOptions.project`) dla 337 plików testów, co spowalnia lint i komplikuje test konfiguracji. Propozycja: **pominąć w tym planie**; `valid-expect` łapie `expect(p).resolves/rejects` bez `await`. `waitFor` bez `await` zostaje w checkliście ręcznej.
- **D3. Nowa zależność** `@vitest/eslint-plugin` (devDependency, oficjalny plugin Vitest; AGENT-2: nowa zależność tylko po uzgodnieniu). Akceptacja planu = zgoda na tę jedną zależność; `npm install` uruchamia człowiek albo wykonawca za zgodą (AGENT-5).
- **Poza zakresem:** `retry` i podbite timeouty (TDD-7), `expect` w pętli (ASERCJE-1) — o ile reguła pluginu ich nie łapie (Task 2, krok 2); zostają w checkliście ręcznej.

## Pliki

- Modify: `package.json` (skrypt `lint`, devDependency)
- Modify: `package-lock.json` (tylko przez `npm install`, ZAKRES-5)
- Modify: `.eslintrc.json` (override dla testów)
- Create: `tests/unit/lint/testLintRules.test.ts` (strażnik konfiguracji)
- Ewentualnie: pliki testów z naruszeniami (Task 5, tylko po decyzji użytkownika)

Gałąź: `test/lint-regul-testow` od `main` (worktree według `superpowers:using-git-worktrees`).

---

### Task 0: Stan wyjściowy

- [ ] **Step 1:** `git switch -c test/lint-regul-testow origin/main` (albo worktree).
- [ ] **Step 2:** `npm run lint` → zapisz exit i liczbę problemów (oczekiwane: `exit 0`).
- [ ] **Step 3:** `npx eslint tests/` → zapisz exit i listę `plik:linia reguła` (to naruszenia ASERCJE-4 niewidoczne dziś w `/verify`). Nic nie naprawiaj; lista idzie do Task 1.

### Task 1: `npm run lint` obejmuje `tests/`

**Files:** Modify: `package.json:11`

- [ ] **Step 1:** Zmień skrypt:

```json
"lint": "next lint --dir app --dir lib --dir src --dir tests",
```

- [ ] **Step 2:** `npm run lint` → ten sam wynik co `npx eslint tests/` z Task 0 plus stare katalogi. Dowód (DOWODY-1, zmiana konfiguracji bez logiki): exit i liczba problemów przed i po.
- [ ] **Step 3:** Jeśli Task 0 Step 3 dał naruszenia: **stop**, pokaż listę użytkownikowi (naprawa w tym PR osobnym commitem albo osobne zadanie). Bez wyłączania reguł i bez `eslint-disable`.
- [ ] **Step 4:** Commit: `git add package.json && git commit -m "chore(lint): npm run lint obejmuje tests/"`.

### Task 2: Zależność `@vitest/eslint-plugin`

**Files:** Modify: `package.json`, `package-lock.json`

- [ ] **Step 1:** `npm view @vitest/eslint-plugin version peerDependencies` → wybierz najnowszą wersję z `eslint` 8.57 w peerDependencies (jeśli najnowsza wymaga ESLint 9, najnowszą zgodną z 8; zapisz wersję i źródło, DOWODY-5). Jeśli żadna nie wspiera ESLint 8: **UTKNĄŁEM** z wynikiem komendy.
- [ ] **Step 2:** Z dokumentacji zainstalowanej wersji (`node_modules/@vitest/eslint-plugin/README.md` albo `docs/rules/`) potwierdź nazwy reguł: `no-focused-tests`, `no-disabled-tests`, `no-commented-out-tests`, `valid-expect`, `no-conditional-expect`, oraz czy `no-conditional-in-test` łapie pętle. Nazwa, której nie ma: usuń jej przypadki z Task 3 i zgłoś.
- [ ] **Step 3:** `npm install -D @vitest/eslint-plugin@<wersja>` (za zgodą, AGENT-5). `git diff --stat` → tylko `package.json` i `package-lock.json`.
- [ ] **Step 4:** Commit: `git add package.json package-lock.json && git commit -m "chore(deps): @vitest/eslint-plugin dla lintu testów"`.

### Task 3: Strażnik konfiguracji (czerwony)

**Files:** Create: `tests/unit/lint/testLintRules.test.ts`

Test woła ESLint z konfiguracją repozytorium na tekstach przykładowych. `filePath` nie musi istnieć na dysku (lint bez typów). Porównanie całej posortowanej listy `ruleId` z literałem (ASERCJE-5), przypadki przez `it.each` (ASERCJE-1).

- [ ] **Step 1:** Napisz test:

```ts
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint({ cwd: process.cwd() });
const TEST_FILE = "tests/unit/lint/__sample__.test.ts";
const SOURCE_FILE = "src/lint-sample.ts";
const VITEST_RULES = new Set([
  "@vitest/no-focused-tests",
  "@vitest/no-disabled-tests",
  "@vitest/no-commented-out-tests",
  "@vitest/valid-expect",
  "@vitest/no-conditional-expect",
]);

async function vitestRuleIds(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages
    .map((m) => m.ruleId ?? "")
    .filter((id) => VITEST_RULES.has(id))
    .sort();
}

const header = `import { describe, expect, it } from "vitest";\n`;

describe("lint plików testów (Kodeks TDD-7, ASERCJE-1, ASERCJE-6)", () => {
  it.each([
    ["it.only", `it.only("a", () => { expect(1).toBe(1); });`, ["@vitest/no-focused-tests"]],
    [
      "describe.only",
      `describe.only("a", () => { it("b", () => { expect(1).toBe(1); }); });`,
      ["@vitest/no-focused-tests"],
    ],
    ["it.skip", `it.skip("a", () => { expect(1).toBe(1); });`, ["@vitest/no-disabled-tests"]],
    [
      "zakomentowany test",
      `// it("a", () => { expect(1).toBe(1); });\nit("b", () => { expect(1).toBe(1); });`,
      ["@vitest/no-commented-out-tests"],
    ],
    [
      "resolves bez await",
      `it("a", async () => { expect(Promise.resolve(1)).resolves.toBe(1); });`,
      ["@vitest/valid-expect"],
    ],
    [
      "expect w if",
      `it("a", () => { const x = 1; if (x) { expect(x).toBe(1); } });`,
      ["@vitest/no-conditional-expect"],
    ],
    [
      "expect tylko w catch",
      `it("a", () => { try { JSON.parse("{"); } catch (e) { expect(e).toBeInstanceOf(SyntaxError); } });`,
      ["@vitest/no-conditional-expect"],
    ],
  ])("zgłasza: %s", async (_name, body, expected) => {
    expect(await vitestRuleIds(header + body, TEST_FILE)).toEqual(expected);
  });

  it.each([
    ["zwykły it", `it("a", () => { expect(1).toBe(1); });`],
    [
      "resolves z await",
      `it("a", async () => { await expect(Promise.resolve(1)).resolves.toBe(1); });`,
    ],
    [
      "rejects z await",
      `it("a", async () => { await expect(Promise.reject(new Error("x"))).rejects.toThrow("x"); });`,
    ],
  ])("nie zgłasza poprawnego testu: %s", async (_name, body) => {
    expect(await vitestRuleIds(header + body, TEST_FILE)).toEqual([]);
  });

  it("reguły Vitest nie obejmują kodu spoza tests/", async () => {
    expect(
      await vitestRuleIds(header + `it.only("a", () => { expect(1).toBe(1); });`, SOURCE_FILE)
    ).toEqual([]);
  });
});
```

- [ ] **Step 2:** `npx vitest run tests/unit/lint/testLintRules.test.ts` → **czerwony**: 7 przypadków „zgłasza” pada na asercji (`[]` zamiast oczekiwanej listy); 4 pozostałe zielone. Jeśli pada z innego powodu (import, parser, konfiguracja ESLint), to błąd testu: popraw test (TDD-3).
- [ ] **Step 3:** Commit (sam test, osobno od konfiguracji): `git add tests/unit/lint/testLintRules.test.ts && git commit -m "test(lint): strażnik reguł Vitest dla plików testów (czerwony)"`.

### Task 4: Konfiguracja (zielony)

**Files:** Modify: `.eslintrc.json` (nowy element `overrides`)

- [ ] **Step 1:** Dopisz override po istniejącym:

```json
{
  "files": ["tests/**/*.test.ts?(x)"],
  "plugins": ["@vitest"],
  "rules": {
    "@vitest/no-focused-tests": "error",
    "@vitest/no-disabled-tests": "error",
    "@vitest/no-commented-out-tests": "error",
    "@vitest/valid-expect": ["error", { "alwaysAwait": true }],
    "@vitest/no-conditional-expect": "error"
  }
}
```

(Opcje `valid-expect` potwierdź w dokumentacji z Task 2 Step 2; jeśli `alwaysAwait` nie istnieje, usuń opcję.)

- [ ] **Step 2:** `npx vitest run tests/unit/lint/testLintRules.test.ts` → 11/11, `exit 0`.
- [ ] **Step 3:** Kanarek (TDD-3): usuń chwilowo jedną regułę (np. `no-conditional-expect`) → padają dokładnie 2 przypadki z nią; przywróć.
- [ ] **Step 4:** `npm run lint` → zapisz exit i listę naruszeń w istniejących testach.
- [ ] **Step 5:** Commit: `git add .eslintrc.json && git commit -m "chore(lint): reguły Vitest w testach (TDD-7, ASERCJE-1, ASERCJE-6)"`.

### Task 5: Naruszenia w istniejących testach (tylko po decyzji)

- [ ] **Step 1:** Jeśli Task 4 Step 4 ma naruszenia: **stop**, pokaż użytkownikowi listę `plik:linia reguła` i liczbę na regułę.
- [ ] **Step 2 (po zgodzie):** naprawa osobnym commitem na regułę. `expect` w `if`/`catch` → `await expect(…).rejects` albo `expect(() => …).toThrow(…)` z tą samą precyzją (ASERCJE-2); bez osłabiania asercji (ZAKRES-4); każdy poprawiony test nadal przechodzi i pada po zepsuciu kodu, który sprawdza.
- [ ] **Step 3:** Bez `eslint-disable` i bez obniżania reguły do `warn`.

### Task 6: Weryfikacja i PR

- [ ] **Step 1:** `/verify` → `PRZESZŁO: tsc (exit 0), vitest (N testów, exit 0), lint (exit 0)`.
- [ ] **Step 2:** Dowód, że lint widzi testy (DOWODY-1): w kopii roboczej dopisz `it.only` w dowolnym teście → `npm run lint` `exit ≠ 0` z `@vitest/no-focused-tests`; cofnij (`git diff` czysty).
- [ ] **Step 3:** PR do `main` z linią dowodu (DOWODY-2), listą „poza zakresem” (D1, D2, retry/timeout, pętle) i zadaniem dla D1 w `Projects/monolith/tasks.md` (po zgodzie użytkownika na wpis).
