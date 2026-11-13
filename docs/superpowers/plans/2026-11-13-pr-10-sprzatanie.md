# PR 10: sprzątanie po migracji kontekstów Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Domknąć migrację do `contexts/`: usunąć z testu architektury reguły i fixtury dla nieistniejącej starej warstwy, scalić `repos-static` z testem architektury, uporządkować helper testowy oraz uaktualnić dokumentację (ADR-021, `CLAUDE.md`, `README.md`, `STAN-W-KODZIE.md`) do stanu faktycznego.

**Architecture:** Zero zmian w kodzie produkcyjnym. Zmiany dotyczą tylko testów i dokumentów. Zgodnie z `CLAUDE.md` zmiany `tests/unit/architecture.static.test.ts` idą w osobnych commitach, nigdy razem z innym kodem. Kolejność commitów: plan → helper testowy → test architektury (martwe reguły) → test architektury (scalenie `repos-static`) → dokumentacja.

**Tech Stack:** vitest, TypeScript, Markdown.

Spec: `docs/superpowers/specs/2026-11-12-struktura-kontekstow-design.md` (§7, „PR 10: sprzątanie”). Osobnego specu nie ma, decyzje poniżej.

## Stan wyjściowy (zweryfikowany odczytem na `main` po #33 i #34)

- Stara warstwa już nie istnieje: nie ma `services/`, `types/`, `lib/validation/`, `lib/nexus/repos/` (poza plikiem testowym, patrz niżej), `lib/firestore-db.ts`. PR 9 usunął je wcześniej, niż zakładał spec (plan PR 9, decyzja 6).
- `tests/unit/architecture.static.test.ts` (528 l.) nadal zawiera martwe elementy:
  - R1: `within(e.to, "services")`; R3: `!within(e.from, "services")` i `!within(e.from, "types")`; R5: klauzula `lib/firestore-db → lib/nexus/repos`; R6: `services`, `types`; R7 i R9 w całości; `SCAN` z `"services"`, `"types"`;
  - fixtury: `r1c` (krawędź `services/x`), `r4` i `r5` (źródło `services/x`), `r5d`, `r7`, `r7b`, `r9`, `r9b`, końcowy test „stare trasy” (`services/x`);
  - `BASELINE = []` razem z `keyOf` i testem „każdy wyjątek nadal występuje”.
- `tests/unit/lib/nexus/repos-static.test.ts` (70 l.): ręczne listy plików (`REPOS`, `FILE_REPOS`), które każdy PR migracyjny edytował. Strażnicy: brak firebase / `fs` / `process.env` / mutacji plików, zapis do vaulta tylko przez `vault-fs` z wyjątkiem znanych plików, `markdown-edit` jest czystym tekstem, brak katalogu `lib/firestore`.
- `tests/unit/lib/nexus/repos/helpers.ts` (`useTempVault`) siedzi w katalogu o nazwie starej warstwy; importuje go 10 testów w `tests/unit/contexts/**` ścieżką `../../lib/nexus/repos/helpers`.
- Dokumenty z nieaktualnym stanem: `CLAUDE.md` (reguły 1–9, baseline, „stary kod jest migrowany”), `docs/adr/021-struktura-kontekstow-wg-vaulta-nexus.md` (R1, R5–R9, baseline, `types/records.ts` w tabeli), `README.md` (sekcja „Moduły”: ścieżki sprzed migracji, zasoby „w Firestore”), `docs/mockups/karty/STAN-W-KODZIE.md` (ścieżki `src/components/...`, `types/records.ts`, „zapis jeszcze w Firestore”), `docs/nexus-vault-formaty-yaml.md:3` (`lib/nexus/repos/`), `tests/docs_tech/test_workflow.md:11` (mocki `lib/firestore-db.js`).
- Faktyczne runtime'owe importy `vault-fs` w `contexts/**` i `lib/nexus/**` (sprawdzone `grep`): `lib/nexus/yaml-store.ts`, `lib/nexus/markdown-dir.ts`, `contexts/bc_board/repositories.ts`, `contexts/bc_calendar/repositories/index.ts`, `contexts/bc_mind_maps/repositories.ts`, `contexts/bc_projects/repositories/index.ts`, `contexts/bc_tasks/repositories/tasks.ts`. Wzmianki w komentarzach (`bc_projects/models.ts:19`, `markdown-edit.ts:3`) nie są importami. W `contexts/**` i `lib/nexus/**` nie ma słowa `firebase`.

## Decyzje projektowe

1. **Numeracja reguł.** Po usunięciu R7 i R9 dawna R8 (brak cykli między `services`) staje się **R7**. Reguły R1–R6 bez zmian numerów (komentarze w kodzie odwołują się m.in. do R5). Aktualne źródło prawdy: ADR-021 i `CLAUDE.md`; spec §6 dostaje jednozdaniową notkę.
2. **Brak starej warstwy pilnuje test, nie reguły importów.** Reguły R7/R9 znikają razem z warstwą, a zamiast nich w scalonej części C test sprawdza, że `services/`, `types/`, `lib/validation/`, `lib/nexus/repos/`, `lib/firestore/`, `lib/firestore-db.ts` nie istnieją (rozszerzenie dzisiejszego testu „the old Firestore directory is gone”).
3. **Baseline znika.** Jest pusty od PR 9, a spec każe go usunąć. Test sprawdza `expect(violations).toEqual([])`. Gdyby kiedyś trzeba było wprowadzić wyjątek, mechanizm wraca osobnym commitem testu i z wpisem w ADR-021.
4. **Scalenie `repos-static` zamiast ręcznych list.** Część C testu architektury skanuje pliki dynamicznie: wszystkie `lib/nexus/*.ts` oprócz warstwy I/O (`vault-fs.ts`, `vault-path.ts`, objętych `static.test.ts`) oraz wszystkie `contexts/*/repositories*`. Dozwolone importy `vault-fs` to jawna, sortowana lista 7 plików (patrz wyżej); nowe repozytorium importujące `vault-fs` musi dopisać się do listy świadomie (osobny commit testu, jak przy baseline). Dzięki temu PR domenowe nie muszą już ręcznie edytować list.
5. **Helper `useTempVault`** przechodzi do `tests/unit/helpers/tempVault.ts` (`git mv`, treść bez zmian), bo nazwa katalogu `lib/nexus/repos/` opisuje nieistniejącą warstwę.
6. **`STAN-W-KODZIE.md`:** aktualizujemy ścieżki i oczywiste przestarzałe statusy (tablica w vaulcie), usuwamy numery linii (`File.tsx:257`), bo gniją przy każdej zmianie. Oceny „JEST/BRAK” funkcji względem makiet nie są przedmiotem tego PR.

**Poza zakresem:** `looseObject` → `strict` (osobna decyzja po PR 10, ADR-021), usunięcie Firebase (`lib/firebase-admin.ts`, `scripts/*firestore*`, `FIREBASE_*` w README: plan 0e), `tests/integration/**`, ADR-011/014/017/ADR-017-mind-maps i `docs/refactoring/PLAN.md` (dokumenty historyczne; ADR-014 jest już oznaczony jako zastąpiony przez ADR-021), `static.test.ts` dla `vault-path`/`vault-fs` (zostaje bez zmian).

## Mapa plików

| Plik                                                                            | Zmiana                                           |
| ------------------------------------------------------------------------------- | ------------------------------------------------ |
| `tests/unit/lib/nexus/repos/helpers.ts`                                         | `git mv` → `tests/unit/helpers/tempVault.ts`     |
| 10 testów w `tests/unit/contexts/**`                                            | zmiana jednej ścieżki importu                    |
| `tests/unit/no-model-api.static.test.ts`                                        | `"services"` z `SCAN_DIRS`                       |
| `tests/unit/architecture.static.test.ts`                                        | martwe reguły i fixtury, baseline; potem część C |
| `tests/unit/lib/nexus/repos-static.test.ts`                                     | usunięty (scalony)                               |
| `docs/adr/021-…md`, `CLAUDE.md`, `README.md`, `STAN-W-KODZIE.md`                | opis stanu faktycznego                           |
| `docs/nexus-vault-formaty-yaml.md`, `tests/docs_tech/test_workflow.md`, spec §7 | po jednej linii                                  |

## Konwencje wykonania

- Testy, `tsc`, lint, build: przez `cursor` (`scripts/ask-helper.sh --role task cursor "…"`), z prośbą „przeszło” albo lista `plik:linia + przyczyna`.
- Branch: `feat/pr-10-sprzatanie` (już utworzony z `main` po #34).
- Każdy z commitów 2–4 (test architektury i helper) jest osobny. **Nie łącz ich w jeden.** Commit z kodem nie dotyka testu architektury.
- Trailer commitów: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

---

### Task 0: Commit planu

**Files:** `docs/superpowers/plans/2026-11-13-pr-10-sprzatanie.md`

- [ ] **Step 1:** `git add docs/superpowers/plans/2026-11-13-pr-10-sprzatanie.md && git commit -m "docs(plan): PR 10 sprzątanie po migracji kontekstów"` (+ trailer).

---

### Task 1: Helper testowy i martwa ścieżka w `no-model-api`

**Files:**

- Move: `tests/unit/lib/nexus/repos/helpers.ts` → `tests/unit/helpers/tempVault.ts`
- Modify: 10 testów w `tests/unit/contexts/**` (lista z `grep`), `tests/unit/no-model-api.static.test.ts:7`

- [ ] **Step 1: Znajdź wszystkich importujących.**

Run: `grep -rn "repos/helpers" tests`
Expected: 10 trafień, wszystkie `import { useTempVault } from "../../lib/nexus/repos/helpers";` w `tests/unit/contexts/bc_*/…test.ts` (bc_tasks ×2, bc_mind_maps, bc_calendar, bc_projects ×2, bc_notes, bc_board, bc_tags, bc_resources). Jeśli trafień jest więcej albo wzorzec ścieżki jest inny (np. `./repos/helpers` w `tests/unit/lib/nexus/`), dopasuj `sed` z kroku 3 do faktycznych ścieżek względnych.

- [ ] **Step 2: Przenieś plik.**

```bash
mkdir -p tests/unit/helpers
git mv tests/unit/lib/nexus/repos/helpers.ts tests/unit/helpers/tempVault.ts
```

Katalog `tests/unit/lib/nexus/repos/` znika (był jedynym plikiem). Treść pliku bez zmian (importuje tylko `node:*` i `vitest`).

- [ ] **Step 3: Przepnij importy** (z `tests/unit/contexts/bc_*/` do `tests/unit/helpers/` jest to `../../helpers/tempVault`).

```bash
grep -rl "lib/nexus/repos/helpers" tests/unit/contexts \
  | xargs sed -i 's#"../../lib/nexus/repos/helpers"#"../../helpers/tempVault"#'
grep -rn "repos/helpers" tests
```

Expected drugiego polecenia: brak wyników.

- [ ] **Step 4: Usuń nieistniejący katalog ze skanu.** W `tests/unit/no-model-api.static.test.ts:7` zmień

```ts
const SCAN_DIRS = ["app", "src", "services", "lib", "scripts", "contexts"];
```

na

```ts
const SCAN_DIRS = ["app", "src", "lib", "scripts", "contexts"];
```

Wyrażenie regularne z `services/(?:agentService|planService|mindMapAIService)` zostaje: wykrywa wzmianki o usuniętych usługach w tekście.

- [ ] **Step 5: Uruchom** (cursor): `npx vitest run tests/unit/contexts tests/unit/no-model-api.static.test.ts` i `npx tsc --noEmit`.
      Expected: przechodzi (testy z `useTempVault` działają bez zmian zachowania).

- [ ] **Step 6: Commit.**

```bash
git add -A tests/unit
git commit -m "refactor(tests): useTempVault do tests/unit/helpers (PR 10)"
```

(Sprawdź `git status` przed commitem: w indeksie tylko `tests/unit/helpers/tempVault.ts` (rename), 10 testów kontekstów i `no-model-api.static.test.ts`; `architecture.static.test.ts` nietknięty.)

---

### Task 2: Test architektury, martwe reguły, fixtury i baseline (commit tylko testu)

**Files:** Modify: `tests/unit/architecture.static.test.ts`. Nic innego w tym commicie.

Wszystkie edycje to dokładne zamiany tekstu (numery linii z `main` po #34; użyj `Edit` po tekście, nie po numerze).

- [ ] **Step 1: Nagłówek pliku (linie 2–6).** Zamień

```ts
/**
 * Test architektury: reguły importów 1–9 ze specu struktury kontekstów (§6).
 * Część A sprawdza silnik reguł na sztucznych danych; część B skanuje prawdziwe repo
 * z zamkniętą listą znanych wyjątków (BASELINE).
 */
```

na

```ts
/**
 * Test architektury: reguły importów 1–7 (ADR-021).
 * Część A sprawdza silnik reguł na sztucznych danych; część B skanuje prawdziwe repo
 * (bez listy wyjątków: każde naruszenie jest błędem).
 */
```

- [ ] **Step 2: R1 (linie 86–95).** W warunku usuń linię `within(e.to, "services") ||`, tak by zostało:

```ts
if (
  within(e.from, "src") &&
  ((t && t.layer !== "schemas") || within(e.to, "lib/nexus") || within(e.to, "lib/http"))
) {
  add(e, 1);
}
```

- [ ] **Step 3: R3, część „spoza kontekstu” (linie 108–113).** Zamień blok na

```ts
// Spoza kontekstu: `repositories`/`models` nigdy; `services` tylko z innych kontekstów (R2);
// z `src/` pilnuje R1.
if (t && !(f && f.ctx === t.ctx) && !within(e.from, "src")) {
  if (t.layer === "repositories" || t.layer === "models") add(e, 3);
  if (t.layer === "services" && !f) add(e, 3);
}
```

- [ ] **Step 4: R5 (linie 130–139).** Zamień komentarz i klauzulę:

```ts
// R5: `lib/nexus/**` tylko z repozytoriów kontekstów, wnętrza `lib/nexus/` i `lib/workGuard` (z `src/` pilnuje R1).
if (within(e.to, "lib/nexus") && !within(e.from, "src")) {
  const allowed =
    f?.layer === "repositories" ||
    within(e.from, "lib/nexus") ||
    (e.from === "lib/workGuard" &&
      (e.to === "lib/nexus/vault-path" || (e.to === "lib/nexus/vault-fs" && e.typeOnly)));
  if (!allowed) add(e, 5);
}
```

- [ ] **Step 5: R6 (linie 141–151).** Zamień na

```ts
// R6: backend nie importuje UI.
if (
  (within(e.from, "app/api") || within(e.from, "lib") || within(e.from, "contexts")) &&
  within(e.to, "src")
) {
  add(e, 6);
}
```

- [ ] **Step 6: Usuń R7 i R9.** Skasuj w całości blok od `// R7: konteksty nie sięgają…` do zamykającego `}` tego `if` oraz blok `// R9: \`types/records\` nie zależy…`z jego jednolinijkowym`if`. Po zmianie pętla `for (const e of edges)` kończy się po R6.

- [ ] **Step 7: R8 → R7.** Zamień komentarz `// R8: brak cykli…` na `// R7: brak cykli między \`services\` kontekstów (węzeł = kontekst).`i w`out.add(\`cykl: ${c} (reguła 8)\`)`zmień`8`na`7`.

- [ ] **Step 8: Fixtury (część A).**
  - `r1c`: zmień nazwę na `"r1c: UI → http, lib/nexus"`; usuń `e("src/features/x/A", "services/x")` z krawędzi i `rule("src/features/x/A", "services/x", 1)` z oczekiwań (zostają dwa: `lib/http/apiError`, `lib/nexus/vault-fs`, w tej kolejności alfabetycznej).
  - `r4`: nazwa `"r4: lib → router"`, `e("lib/x", "contexts/bc_a/router")`, oczekiwanie `rule("lib/x", "contexts/bc_a/router", 4)`.
  - `r5`: nazwa `"r5: lib → lib/nexus/vault-fs"`, `e("lib/x", "lib/nexus/vault-fs")`, oczekiwanie `rule("lib/x", "lib/nexus/vault-fs", 5)`.
  - Usuń przypadki: `r5d`, `r7`, `r7b`, `r9`, `r9b`.
  - `r8`: nazwa `"r7: cykl services"`; oczekiwany tekst kończy się `(reguła 7)` zamiast `(reguła 8)`.
  - Ostatni test części A: nazwa `"trasa bez krawędzi do contexts/ nie podlega kontroli treści"`, ciało:

```ts
const routes = new Map([["app/api/old/route", 'import { x } from "zod";']]);
expect(violations([e("app/api/old/route", "lib/x")], routes)).toEqual([]);
```

- [ ] **Step 9: Część B, skan i baseline.**
  - `const SCAN = ["app", "contexts", "lib", "src"]; // + plik middleware.ts`.
  - Usuń stałą `BASELINE` razem z komentarzem `/** Znane wyjątki … */` oraz funkcję `keyOf`.
  - W `describe("repo", …)` zostaw test „skanuje kod źródłowy”, a dwa pozostałe zastąp jednym:

```ts
it("brak naruszeń reguł 1–7", () => {
  expect(found).toEqual([]);
});
```

- [ ] **Step 10: Sprawdź, czy nie została martwa nazwa.**

Run: `grep -nE "firestore-db|repos/|types/records|BASELINE|keyOf|reguła [89]|R[89]\b|\"services/|\"types" tests/unit/architecture.static.test.ts`
Expected: brak wyników. (Warstwa `"services"` w `LAYER_ALLOWED`/`ctxInfo` to warstwa kontekstu, zostaje.)

- [ ] **Step 11: Zielony test.** (cursor) `npx vitest run tests/unit/architecture.static.test.ts`
      Expected: przechodzi; liczba testów mniejsza o 6 (usunięte fixtury `r5d`, `r7`, `r7b`, `r9`, `r9b` i jeden z dwóch testów baseline zastąpionych jednym).

- [ ] **Step 12: Sprawdzenie, że reguły nadal gryzą (czerwona faza).** Tymczasowo utwórz plik naruszający reguły i potwierdź czerwony wynik, potem go usuń:

```bash
printf 'import { x } from "@/src/features/tags/TagsSection";\nimport "@/contexts/bc_tags/repositories";\nexport const y = x;\n' > lib/zz-tmp-violation.ts
npx vitest run tests/unit/architecture.static.test.ts
rm lib/zz-tmp-violation.ts
```

Expected: test „brak naruszeń reguł 1–7” pada z listą zawierającą `lib/zz-tmp-violation → src/features/tags/TagsSection (reguła 6)` i `lib/zz-tmp-violation → contexts/bc_tags/repositories (reguła 3)`. Po `rm` `git status` nie pokazuje pliku. Jeśli `@/src/...` nie rozwiąże się na `src/features/tags/TagsSection` (alias `@/` = korzeń repo, więc powinno), popraw importy, nie test.

- [ ] **Step 13: Commit (tylko test).**

```bash
git add tests/unit/architecture.static.test.ts
git commit -m "test(arch): usunięcie martwych reguł 7 i 9, fixtur starej warstwy i baseline (PR 10)"
```

---

### Task 3: Scalenie `repos-static` z testem architektury (commit tylko testów)

**Files:** Modify: `tests/unit/architecture.static.test.ts`; Delete: `tests/unit/lib/nexus/repos-static.test.ts`.

- [ ] **Step 1: Hoist skanu.** W części B zamień `describe("repo", () => { const { files, edges, routeFiles } = loadRepo(); const found = violations(edges, routeFiles);` na stałą modułu, by część C użyła tego samego skanu:

```ts
const REPO = loadRepo();

describe("repo", () => {
  const { files, edges, routeFiles } = REPO;
  const found = violations(edges, routeFiles);
```

(reszta `describe("repo")` bez zmian po Tasku 2.)

- [ ] **Step 2: Nagłówek.** W komentarzu pliku dopisz po zdaniu o części B: ` * Część C pilnuje warstwy plikowej (dawny repos-static): bez firebase/fs/mutacji, zapis do vaulta tylko znanymi ścieżkami.`

- [ ] **Step 3: Dopisz część C na końcu pliku.**

```ts
// ─── część C: warstwa plikowa (dawny repos-static) ───────────────────────────

/** Warstwa I/O (`fs`, `process.env`) pilnowana osobno przez `tests/unit/lib/nexus/static.test.ts`. */
const IO_LAYER = ["lib/nexus/vault-fs.ts", "lib/nexus/vault-path.ts"];
/**
 * Jedyne pliki z runtime'owym importem `vault-fs` (zapis do vaulta). Pozostałe repozytoria
 * piszą przez `yaml-store` / `markdown-dir`. Nowy wpis = świadoma decyzja, osobny commit testu.
 */
const VAULT_FS_IMPORTERS = [
  "contexts/bc_board/repositories",
  "contexts/bc_calendar/repositories",
  "contexts/bc_mind_maps/repositories",
  "contexts/bc_projects/repositories",
  "contexts/bc_tasks/repositories/tasks",
  "lib/nexus/markdown-dir",
  "lib/nexus/yaml-store",
];
/** Pliki warstwy plikowej: `lib/nexus/*` poza I/O oraz każde `contexts/*/repositories*`. */
const FILE_LAYER = (files: string[]) =>
  files.filter(
    (f) =>
      !IO_LAYER.includes(f) &&
      (/^lib\/nexus\/[^/]+\.ts$/.test(f) || /^contexts\/[^/]+\/repositories(?:\.ts|\/)/.test(f))
  );

const lineOf = (text: string, index: number) => text.slice(0, index).split("\n").length;

function hits(pattern: RegExp, rels: string[]): string[] {
  const out: string[] = [];
  const global = new RegExp(pattern.source, pattern.flags.replace("g", "") + "g");
  for (const rel of rels) {
    const text = fs.readFileSync(path.join(ROOT, rel), "utf8");
    for (const m of text.matchAll(global))
      out.push(`${rel}:${lineOf(text, m.index ?? 0)} (${m[0]})`);
  }
  return out;
}

describe("warstwa plikowa", () => {
  const layer = FILE_LAYER(REPO.files);

  it("skanuje repozytoria i silnik plików", () => {
    expect(layer.length).toBeGreaterThan(15);
    for (const f of [
      "lib/nexus/yaml-store.ts",
      "lib/nexus/record-helpers.ts",
      "contexts/bc_tags/repositories.ts",
      "contexts/bc_tasks/repositories/tasks.ts",
      "contexts/bc_resources/repositories/resources.ts",
    ]) {
      expect(layer).toContain(f);
    }
  });

  it("nie ma firebase, bezpośredniego fs, process.env ani mutacji plików", () => {
    expect(hits(/firebase/i, layer)).toEqual([]);
    expect(
      hits(/from\s+["'](?:node:)?fs(?:\/promises)?["']|require\(\s*["'](?:node:)?fs/, layer)
    ).toEqual([]);
    expect(hits(/process\.env/, layer)).toEqual([]);
    expect(
      hits(
        /writeFileSync|renameSync|rmSync|mkdirSync|appendFileSync|unlinkSync|createWriteStream/,
        layer
      )
    ).toEqual([]);
  });

  it("zapis do vaulta (vault-fs) tylko ze znanych plików", () => {
    const importers = REPO.edges
      .filter(
        (edge) =>
          edge.to === "lib/nexus/vault-fs" &&
          !edge.typeOnly &&
          (within(edge.from, "contexts") || within(edge.from, "lib/nexus"))
      )
      .map((edge) => edge.from);
    expect([...new Set(importers)].sort()).toEqual(VAULT_FS_IMPORTERS);
  });

  it("stara warstwa nie istnieje", () => {
    for (const gone of [
      "services",
      "types",
      "lib/validation",
      "lib/nexus/repos",
      "lib/firestore",
      "lib/firestore-db.ts",
    ]) {
      expect(fs.existsSync(path.join(ROOT, gone)), gone).toBe(false);
    }
  });
});
```

- [ ] **Step 4: Usuń stary test.** `git rm tests/unit/lib/nexus/repos-static.test.ts`.

- [ ] **Step 5: Uruchom** (cursor): `npx vitest run tests/unit/architecture.static.test.ts tests/unit/lib/nexus`.
      Expected: przechodzi, nowy `describe("warstwa plikowa")` z 4 testami zielony. Jeśli „nie ma firebase…” zgłosi trafienie w pliku, którego stary test nie skanował (np. `frontmatter.ts`, `bc_projects/repositories`), przeczytaj trafienie: komentarz z odpowiednim słowem popraw w kodzie; nie rozluźniaj wzorca ani listy. Jeśli lista importerów `vault-fs` się różni, porównaj z `grep -rn "vault-fs" contexts lib/nexus` (sekcja „Stan wyjściowy”); różnica oznacza, że `main` zmienił się od planu, i wtedy zaktualizuj `VAULT_FS_IMPORTERS` zgodnie z grepem.

- [ ] **Step 6: Czerwona faza.** Dodaj tymczasowo `import fs from "node:fs";` do `contexts/bc_tags/repositories.ts`, uruchom test (oczekiwane: pada „nie ma firebase, bezpośredniego fs…” z `contexts/bc_tags/repositories.ts:1`), potem `git checkout contexts/bc_tags/repositories.ts`; `git status` bez zmian w tym pliku. Analogicznie `mkdir services` + plik `services/x.ts` → pada „stara warstwa nie istnieje” (potem `rm -r services`).

- [ ] **Step 7: Commit (tylko testy).**

```bash
git add tests/unit/architecture.static.test.ts
git commit -m "test(arch): scalenie repos-static z testem architektury (PR 10)"
```

(`git rm` z kroku 4 jest już w indeksie; `git status` ma pokazać `deleted: tests/unit/lib/nexus/repos-static.test.ts` w tym samym commicie.)

---

### Task 4: Dokumentacja

**Files:** `docs/adr/021-struktura-kontekstow-wg-vaulta-nexus.md`, `CLAUDE.md`, `README.md`, `docs/mockups/karty/STAN-W-KODZIE.md`, `docs/nexus-vault-formaty-yaml.md`, `tests/docs_tech/test_workflow.md`, `docs/superpowers/specs/2026-11-12-struktura-kontekstow-design.md`. Commit osobny (nie dotyka testów).

- [ ] **Step 1: ADR-021.**
  - Status: dopisz `Wdrożony w całości (PR 1–10, 2026-11-13).`
  - Tabela „Siatka kontekstu”, wiersz `schemas.ts`, kolumna „Kto może importować”: usuń `i `types/records.ts` (przejściowo)`; wynik: `własny `router.ts`; UI (`src/\*\*`), także runtime, bo plik jest „bezpieczny dla klienta”`.
  - „Infrastruktura wspólna”, pierwszy punkt: zdanie `Importowany tylko przez `repositories` kontekstów (oraz wyjątki z reguły 5).` → `Importowany tylko przez `repositories`kontekstów, inne pliki`lib/nexus/`i`lib/workGuard.ts` (reguła 5).`
  - Reguły: R1 bez `services/**` (`src/**` nie importuje `contexts/**` poza `contexts/*/schemas*`, ani `lib/nexus/**`, `lib/http/**`); R5 bez członu `oraz, do PR 10, …` (kończy się na `lib/workGuard.ts (dziś: …)`; `scripts/**` nie jest skanowany); R6: `app/api/**`, `lib/**`, `contexts/**` nie importują `src/**`; usuń punkty 7 i 9; punkt 8 staje się 7.
  - Sekcję `**Baseline** (5 par …)` z listą zastąp: `**Baseline:** pusty od PR 9 i usunięty w PR 10; test nie ma listy wyjątków. Wprowadzenie wyjątku wymaga osobnego commitu testu i wpisu w tym ADR.` Zdanie `Zmiany testu architektury i baseline idą osobnym commitem…` zamień na `Zmiany testu architektury idą osobnym commitem, przed albo po commicie z kodem, nigdy razem z nim.`
  - „Konsekwencje”: `PR 10 = sprzątanie starej warstwy` → `PR 10 = sprzątanie (usunięta stara warstwa, martwe reguły, scalenie `repos-static`)`. Dopisz zdanie: `Część C testu architektury pilnuje, by `services/`, `types/`, `lib/validation/`, `lib/nexus/repos/`, `lib/firestore-db.ts`nie wróciły, oraz lista plików z zapisem przez`vault-fs`.`
  - Sekcja „Kontekst” opisuje stan sprzed migracji: zostaje jako historia.

- [ ] **Step 2: `CLAUDE.md`, sekcja „Struktura kodu”.**
  - `Nowy kod domeny leży w` → `Kod domeny leży w`.
  - Zdanie o teście: `pilnuje reguł 1–9; **zmiany testu i listy wyjątków (baseline) zawsze osobnym commitem, nigdy razem z kodem**, a pękający test naprawia się kodem, nie testem.` → `pilnuje reguł 1–7 oraz warstwy plikowej (bez listy wyjątków); **zmiany testu zawsze osobnym commitem, nigdy razem z kodem**, a pękający test naprawia się kodem, nie testem.`
  - Zdanie `Stary kod (`services/`, `lib/nexus/repos/`, `lib/validation/`) jest migrowany po jednej domenie na PR.` → `Starej warstwy (`services/`, `types/`, `lib/validation/`, `lib/nexus/repos/`, `lib/firestore-db.ts`) już nie ma; test pilnuje, żeby nie wróciła.`
  - Użytkownik powinien przejrzeć diff `CLAUDE.md` przed mergem (to instrukcja agenta).

- [ ] **Step 3: `README.md`, sekcja „Moduły i kluczowe funkcje”.** Zastąp pierwszy akapit (`Struktura frontendu … ADR-019 …`) tekstem:

```
Struktura repo i reguły importów: [ADR-021](docs/adr/021-struktura-kontekstow-wg-vaulta-nexus.md) (logika domen w `contexts/bc_*/`, trasy `app/api/**/route.ts` tylko re-eksportują handlery, UI w `src/features/<moduł>/`, wspólne komponenty w `src/components/`). Podział dużych plików frontendu: ADR-019. Wspólna utilita klas CSS: `src/lib/cn.ts`.
```

Punkt „**Konteksty domenowe**” zastąp:

```
- **Konteksty domenowe** (`contexts/`): `bc_projects`, `bc_tags`, `bc_tasks`, `bc_calendar`, `bc_notes`, `bc_resources`, `bc_board`, `bc_mind_maps`. Każdy ma siatkę `router` / `schemas` / `models` / `services` / `repositories`; zapis do vaulta wyłącznie w `repositories`, UI importuje z kontekstu tylko `schemas`. Test `tests/unit/architecture.static.test.ts` pilnuje kierunku zależności.
```

Zmień ścieżki w punktach Planowania: Kalendarz → `src/features/calendar/CalendarView.tsx` (usuń `+ src/components/calendar/`); Zadania, tagi → `src/features/tasks/`, `src/features/tags/`; Zasoby → `src/features/resources/`; w podpunkcie zasobów wiersz `Lista linków w Firestore (`users/{userId}/resources`)…` → `Lista linków w vaulcie (`Resources/resources.yaml`)…`, a `Ulubione (`isFavorite`) zapisywane w Firestore` → `Ulubione (`favorite`) zapisywane w vaulcie`. Dodaj punkt `**Tablica** (`src/features/board/`): płótno z kafelkami, ramkami i strzałkami (`contexts/bc*board`, plik w `Vault/`).` — nazwę pliku i katalogu sprawdź w `contexts/bc_board/repositories.ts` przed wpisaniem; jeśli nie jest jednoznaczna, napisz tylko `zapis w vaulcie`. Nie ruszaj `FIREBASE*\*`i skryptu`migrate:sqlite-to-firestore` (zakres planu 0e).

- [ ] **Step 4: `docs/mockups/karty/STAN-W-KODZIE.md`.** Zamiany (numery linii `Plik.tsx:NNN` usuń wszędzie, zostaw nazwę pliku):

| Było                                                                                                                                                  | Ma być                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| nagłówek `(stan 2026-11-11)`                                                                                                                          | `(ścieżki zaktualizowane 2026-11-13 po migracji do contexts/; statusy funkcji z 2026-11-11)`                                              |
| `src/lib/activeSession.ts`                                                                                                                            | `src/components/sessions/activeSession.ts`                                                                                                |
| `src/components/CalendarView.tsx`, `CalendarEventForm.tsx` (§2)                                                                                       | `src/features/calendar/CalendarView.tsx`, `CalendarEventForm.tsx`                                                                         |
| `src/components/TasksSection.tsx`, `src/components/tasks/`, `tasks/TaskCard.tsx`, `TaskTemplatesModal.tsx`, `TaskDetailModal.tsx`, `useTasksBoard.ts` | `src/features/tasks/…` (te same nazwy plików)                                                                                             |
| `types/records.ts:69`, `types/records.ts:70` (termin, priorytet)                                                                                      | `contexts/bc_tasks/models.ts`                                                                                                             |
| `src/components/NoteEditor.tsx`, `NoteEditor.tsx:16`                                                                                                  | `src/components/note-editor/NoteEditor.tsx`                                                                                               |
| `src/components/ResourceSection.tsx, useResources.ts`                                                                                                 | `src/features/resources/ResourceSection.tsx, useResources.ts`                                                                             |
| `JEST (scalone do main 2026-11-11, zapis jeszcze w Firestore)` (tablica, §6)                                                                          | `JEST (zapis w vaulcie, contexts/bc_board)`                                                                                               |
| nagłówek §1 `(src/features/home/HomeView.tsx)` i §4, §5 `src/features/notes/`                                                                         | bez zmian (ścieżki poprawne)                                                                                                              |
| §„Wnioski”, punkt `Do przeniesienia na karty: …`                                                                                                      | `Przeniesione do src/features/* (PR 3–9 migracji kontekstów); zostaje do zrobienia wyłącznie to, co w tabelach ma status BRAK/CZĘŚCIOWO.` |

Kontrola (ma nic nie zwrócić):

```bash
grep -nE "src/components/(CalendarView|CalendarEventForm|TasksSection|tasks/|NoteEditor|ResourceSection|resources/|calendar/)|src/lib/activeSession|types/records|Firestore|\.tsx?:[0-9]+" docs/mockups/karty/STAN-W-KODZIE.md
```

Przed zamianą wiersza z `types/records.ts` otwórz `contexts/bc_tasks/models.ts` i potwierdź, że są w nim pola terminu i priorytetu; jeśli pole nazywa się inaczej, opis w kolumnie „Gdzie / uwagi” popraw na faktyczną nazwę.

- [ ] **Step 5: Pozostałe linie.**
  - `docs/nexus-vault-formaty-yaml.md:3`: `Kod: `lib/nexus/yaml-store.ts`, `lib/nexus/repos/`.` → `Kod: `lib/nexus/yaml-store.ts`, repozytoria w `contexts/_/repositories_`.`
  - `tests/docs_tech/test_workflow.md:11`: `Baza: brak — używane są tylko mocki (`lib/firestore-db.js`).` → `Baza: brak. Repozytoria testuje się na tymczasowym vaulcie (`tests/unit/helpers/tempVault.ts`), serwisy mockami `repositories` własnego kontekstu.`
  - Spec §7 „PR 10: sprzątanie”: dopisz na końcu akapitu: `Zrealizowane w PR 10 (stara warstwa znikła już w PR 9). Po PR 10 reguły 7 i 9 usunięto, dawna reguła 8 to reguła 7; aktualny opis reguł: ADR-021.`

- [ ] **Step 6: Kontrola dokumentów.**

```bash
grep -rnE "firestore-db|lib/nexus/repos|lib/validation|types/records" README.md CLAUDE.md docs/adr/021-struktura-kontekstow-wg-vaulta-nexus.md docs/nexus-vault-formaty-yaml.md tests/docs_tech/test_workflow.md docs/mockups/karty/STAN-W-KODZIE.md
```

Expected: tylko trafienia w ADR-021 w sekcji „Kontekst” (opis stanu sprzed migracji, celowo zostaje) i w nowym zdaniu `CLAUDE.md` o nieistniejącej starej warstwie; poza tym brak.
Uruchom też `npx prettier --check` na zmienionych `.md` (cursor), bo repo ma formatowanie tabel; ewentualne poprawki formatowania tylko w tych plikach.

- [ ] **Step 7: Commit.**

```bash
git add docs CLAUDE.md README.md tests/docs_tech
git commit -m "docs: stan po migracji kontekstów w ADR-021, CLAUDE.md, README i STAN-W-KODZIE (PR 10)"
```

---

### Task 5: Weryfikacja końcowa, review, PR

- [ ] **Step 1: Pełna weryfikacja** (cursor, jedno zlecenie): `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npm run build`. Oczekiwane: „przeszło” (lub lista `plik:linia + przyczyna`; pełny output czytam tylko przy porażce).

- [ ] **Step 2: Czy commit z kodem nie dotyka testu architektury.** `git log --stat main..HEAD --oneline`: `architecture.static.test.ts` występuje tylko w dwóch commitach testowych (Task 2 i 3), w żadnym innym.

- [ ] **Step 3: Review diffa** (`--role review`, agy, `--fresh`): `git diff main...HEAD` z pytaniem o (a) czy usunięte reguły/fixtury nie osłabiły żadnej żywej reguły, (b) czy część C jest równoważna dawnemu `repos-static` poza świadomie rozszerzonym zakresem skanu, (c) rozbieżności dokumentów z kodem. Opinie weryfikuję w kodzie, zanim cokolwiek zmienię.

- [ ] **Step 4: Push i PR** (`gh pr create`, base `main`, opis z listą commitów i adnotacją „zero zmian w kodzie produkcyjnym”; do przeglądu przez użytkownika: diff `CLAUDE.md`).

- [ ] **Step 5: Po mergu** w `../NEXUS/Vault/Projects/monolith/tasks.md`: odhaczyć „PR 9” (PR #34, 2026-11-13) i „PR 10” (PR #NN), dopisać wpisy w Backlogu; commit tylko `tasks.md` (niezacommitowany `index.md` w NEXUS nie jest mój). Następny krok w kolejce wyłącznie za zgodą użytkownika: decyzja o `looseObject` → `strict` albo plan 0e.

---

## Odchylenia przy wykonaniu

- Task 1: `useTempVault` importowało 12 testów, nie 10: oprócz 10 w `tests/unit/contexts/**` także `tests/unit/lib/nexus/markdown-dir.test.ts` i `yaml-store.test.ts` (import `./repos/helpers`). Wszystkie przepięte na `../../helpers/tempVault`.
- Task 3: w kodzie części C komentarz `/** … `contexts/_/repositories_` */` zamykał się przedwcześnie (`*/` w ścieżce). Zamieniony na komentarz `//`.
- Task 4: w `STAN-W-KODZIE.md` poza zamianami ścieżek poprawiono dwa jawnie nieprawdziwe zdania (czat agenta w §8, „szkielet kart nie istnieje”).
