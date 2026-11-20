# Atrapy pod ASERCJE-3: plan wdrożenia

> **Dla wykonawcy:** wymagany sub-skill: superpowers:subagent-driven-development (zalecany) albo superpowers:executing-plans.
> Kroki mają pola wyboru (`- [ ]`) do śledzenia postępu.

**Cel:** testy serwisów spełniają ASERCJE-3 Kodeksu (`../NEXUS/Vault/Knowledge/kodeks.md`, sekcja 2): każda atrapa granicy
ma typ prawdziwego kontraktu, logika domenowa nie jest przepisywana w mocku, a każda granica między kontekstami ma co najmniej
jeden test bez atrapy.

**Architektura:** dwie warstwy, tylko kod testów (produkcja bez zmian).
Warstwa A: typowanie istniejących atrap (`vi.fn<typeof fn>()` + fabryka `vi.mock` z `satisfies Partial<typeof Moduł>`), a czyste
funkcje domeny są brane z oryginału (`importOriginal`) zamiast kopii.
Warstwa B: nowe testy granic na tymczasowym vaulcie (`tests/unit/helpers/tempVault.ts`), w których obie strony granicy działają
naprawdę; atrapy zostają tylko na podprocesach i sieci (`lib/git`, `lib/github`, `lib/ports`).

**Technologie:** Vitest `^3.2.4` (obsługuje `vi.fn<T>()`), TypeScript `~5.8` (`satisfies`), `tsc --noEmit` obejmuje `tests/**`
(`tsconfig.json` → `"include": ["**/*.ts", …]`).

---

## Ustalenia wejściowe (sprawdzone 2026-11-20)

- 29 plików `tests/unit/contexts/**/services*.test.ts`. Bez atrap (nie ruszamy): `bc_codex/services.test.ts`,
  `bc_map/services.test.ts`, `bc_projects/services.bugs.test.ts`, `bc_projects/services.context-pack.changelog.test.ts`.
- Pozostałe 25 plików używa gołych `vi.hoisted(() => vi.fn())` bez typu.
- Kopie logiki domenowej w fabrykach mocków (oryginał: `contexts/bc_projects/services/index.ts:424-441`):
  - `bc_cockpit/services.test.ts:50-51`: `projectKind`, `hasCompanyData`;
  - `bc_arsenal/services.deploy.test.ts:8`, `services.deployed.test.ts` (ok. l. 9), `services.list.test.ts` (ok. l. 8): `hasCompanyData`;
  - `bc_nexus_docs/services.test.ts:10`, `services.linkIndex.test.ts:8`: `isWorkProject`.
- Słabe asercje (ASERCJE-1): `bc_cockpit/services.test.ts:1827` (`resolves.toBeDefined()`), `bc_inbox/services.test.ts:253`
  (`r.warning` tylko zdefiniowany). `bc_cockpit/services.test.ts:1506` to strażnik przed kolejnymi asercjami: nie ruszać.
- Granice między kontekstami w produkcji (import `…/services` innego kontekstu):

  | Konsument        | Dostawcy                                                                                | Test granicy bez atrap dziś                           |
  | ---------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------- |
  | `bc_cockpit`     | `bc_projects`, `bc_tasks`, `bc_calendar`, `bc_inbox`                                    | brak                                                  |
  | `bc_arsenal`     | `bc_projects` (`listProjects`, `hasCompanyData`)                                        | brak                                                  |
  | `bc_nexus_docs`  | `bc_projects` (`listProjects`, `isWorkProject`)                                         | brak                                                  |
  | `bc_inbox`       | `bc_projects`, `bc_tasks`, `bc_notes`                                                   | brak                                                  |
  | `bc_calendar`    | `bc_tasks`, `bc_tags`                                                                   | brak                                                  |
  | `bc_resources`   | `bc_nexus_docs` (`buildKnowledgeLinkIndex`, `normalizeHost`), `bc_tags` (`resolveTags`) | brak                                                  |
  | `bc_diagnostics` | `bc_projects` (`listProjects`, `isWorkProject`)                                         | brak                                                  |
  | `bc_map`         | `bc_projects` (`listProjects`, `isWorkProject`)                                         | brak (testy `bc_map` sprawdzają tylko czyste funkcje) |

- `vitest.config.ts`: `resetMocks: true` i `clearMocks: true`. Implementacje `vi.fn` są czyszczone przed każdym testem, więc
  czyste funkcje w fabryce mocka podawaj jako **funkcję** (`actual.hasCompanyData`), nie jako `vi.fn(actual.hasCompanyData)`
  (tę reset by wyczyścił).
- Pułapki repo: pamięć `pulapki-ts-i-vitest-w-monolith.md` (`x.ok === false` zamiast `!x.ok` przy zawężaniu, `beforeEach` z klamrami).

## Wzorzec warstwy A (obowiązuje we wszystkich zadaniach A)

Atrapa serwisu innego kontekstu, z czystymi funkcjami z oryginału:

```ts
import type * as ProjectsServices from "@/contexts/bc_projects/services";

const mockListProjects = vi.hoisted(() => vi.fn<typeof ProjectsServices.listProjects>());
vi.mock("@/contexts/bc_projects/services", async (importOriginal) => {
  const actual = await importOriginal<typeof ProjectsServices>();
  return {
    listProjects: mockListProjects,
    hasCompanyData: actual.hasCompanyData,
  } satisfies Partial<typeof ProjectsServices>;
});
```

Atrapa repozytorium własnego kontekstu (granica warstwy):

```ts
import type * as NotesRepo from "@/contexts/bc_notes/repositories";

const mockGetNotes = vi.hoisted(() => vi.fn<typeof NotesRepo.getNotes>());
vi.mock(
  "@/contexts/bc_notes/repositories",
  () =>
    ({
      getNotes: mockGetNotes,
    }) satisfies Partial<typeof NotesRepo>
);
```

Wariant „obiekt w `vi.hoisted`” (`bc_board`, `bc_mind_maps`):

```ts
import type * as BoardRepo from "@/contexts/bc_board/repositories";

const repo = vi.hoisted(
  () =>
    ({
      readBoard: vi.fn<typeof BoardRepo.readBoard>(),
      // …pozostałe funkcje, każda z typem
    }) satisfies Partial<typeof BoardRepo>
);
vi.mock("@/contexts/bc_board/repositories", () => repo);
```

Zasady:

0. Fabryka zwraca **wszystkie klucze, które ma dziś** (przykłady wyżej są skrócone). Vitest udostępnia tylko klucze
   z fabryki, więc zgubiony klucz to `undefined` przy imporcie testowanego modułu. Po zmianie porównaj listę kluczy
   fabryki przed i po (ta sama). **Nigdy `...actual`** w fabryce: wpuściłoby prawdziwe odczyty vaulta do testu jednostkowego.
   `importOriginal` tylko tam, gdzie fabryka bierze czystą funkcję (`actual.x`); bez tego fabryka zostaje synchroniczna.
1. `import type` jest wymazywany przy kompilacji, więc używanie go w `vi.hoisted` jest bezpieczne (nie łamie hoistingu).
2. `satisfies` na literale obiektu zgłasza nadmiarowe klucze: atrapa funkcji, której moduł już nie eksportuje, daje błąd `tsc`.
   Granica `Partial`: **brakujący** w fabryce eksport, którego testowany kod zaczął używać, `tsc` przepuszcza; wykrywa go
   dopiero przebieg testu (`undefined is not a function`) i testy granic z warstwy B.
3. Błędy `tsc` po typowaniu to ujawniony rozjazd fixture'ów z kontraktem. Naprawiaj je **danymi testowymi** (brakujące pola,
   poprawne literały), nigdy `as any`, `as never`, `// @ts-expect-error` ani `as unknown as T`. Gdy rekord w wielu testach
   wymaga tych samych pól, dodaj w pliku testu lokalny builder `const entry = (o: Partial<E> = {}): E => ({ …pełne pola…, ...o })`,
   gdzie `E` wyprowadzasz z kontraktu, np. `type E = ReturnType<typeof ProjectsServices.listProjects>["projects"][number]`.
4. Asercje testów nie zmieniają się w warstwie A (poza dwiema słabymi asercjami z ustaleń). Jeśli test zmienia wynik po
   typowaniu, zatrzymaj się i zgłoś: to znaczy, że fixture testował coś, czego kontrakt nie dopuszcza.
5. Jeśli `tsc` pokazuje, że funkcja asynchroniczna była mockowana przez `mockReturnValue` z wartością zwykłą (albo odwrotnie),
   popraw na `mockResolvedValue` / `mockReturnValue` zgodnie z sygnaturą i sprawdź, że test dalej przechodzi.

Weryfikacja każdego zadania A (kanarek TDD-1, raz na plik): w jednym `mockReturnValue` / `mockResolvedValue` tymczasowo zmień
nazwę pola (np. `projects` → `projectz`), uruchom `npx tsc --noEmit` i potwierdź błąd w tej linii, cofnij zmianę.
Bez czerwonego `tsc` typowanie niczego nie pilnuje.

---

### Zadanie 0: gałąź robocza

- [ ] **Krok 1:** worktree z `main` (skill `using-git-worktrees`): gałąź `test/atrapy-asercje-3`.
- [ ] **Krok 2:** przenieś ten plan do worktree, `git add docs/superpowers/plans/2026-11-20-atrapy-asercje-3.md`,
      commit `docs(plan): atrapy w testach serwisów pod ASERCJE-3`.
- [ ] **Krok 3:** stan wyjściowy: `npx tsc --noEmit` i `npx vitest run tests/unit/contexts` przechodzą (przez `/verify`).
      Zapisz liczbę testów w `tests/unit/contexts` (dla porównania po warstwie A: ta sama liczba, wszystkie zielone).

### Zadanie A1: `bc_cockpit` (wzorzec, wykonuje Claude)

**Pliki:** modyfikuj `tests/unit/contexts/bc_cockpit/services.test.ts:1-60` (atrapy) i fixture'y w treści testów według `tsc`.

- [ ] **Krok 1:** dodaj `import type * as CockpitRepo from "@/contexts/bc_cockpit/repositories"`, `ProjectsServices`
      (`bc_projects/services`), `InboxServices`, `TasksServices`, `CalendarServices`.
- [ ] **Krok 2:** otypuj 22 atrapy z l. 6–27 według kontraktu modułu, który podmieniają (np.
      `mockReadPinned = vi.hoisted(() => vi.fn<typeof CockpitRepo.readPinned>())`,
      `mockCountOpen = vi.hoisted(() => vi.fn<typeof InboxServices.countOpen>())`).
- [ ] **Krok 3:** pięć fabryk `vi.mock` (l. 29–58) z `satisfies Partial<typeof …>`; w fabryce `bc_projects/services`
      zamień kopie z l. 50–51 na `projectKind: actual.projectKind, hasCompanyData: actual.hasCompanyData` z `importOriginal`.
- [ ] **Krok 4:** `npx tsc --noEmit 2>&1 | grep bc_cockpit/services.test` i naprawiaj fixture'y danymi (zasada 3) aż do zera błędów.
- [ ] **Krok 5:** l. 1827: zamień `resolves.toBeDefined()` na asercję konkretnej wartości zwracanej przez wywołanie w tym teście
      (przeczytaj test i ustal, co funkcja zwraca dla jego danych; `toEqual` z pełnym obiektem albo `toMatchObject` z polami, o
      które test pyta). Uruchom kanarek ASERCJE-1: zepsuj na chwilę tę wartość w fixture'ze, test ma być czerwony, cofnij.
- [ ] **Krok 6:** kanarek typów (patrz „Weryfikacja każdego zadania A”).
- [ ] **Krok 7:** `npx vitest run tests/unit/contexts/bc_cockpit/services.test.ts`: ta sama liczba testów co przed zmianą, wszystkie PASS.
- [ ] **Krok 8:** commit `test(cockpit): atrapy z typem kontraktu i czyste funkcje z oryginału (ASERCJE-3)`.
- [ ] **Krok 9:** pokaż użytkownikowi diff wzorca, zanim zadania A2–A5 pójdą dalej (może chcieć poprawić wzorzec).

### Zadanie A2: `bc_arsenal` i `bc_nexus_docs` (kopie logiki domenowej)

**Pliki:** `tests/unit/contexts/bc_arsenal/services.{deploy,deployed,list}.test.ts`,
`tests/unit/contexts/bc_nexus_docs/services.test.ts`, `tests/unit/contexts/bc_nexus_docs/services.linkIndex.test.ts`.

- [ ] **Krok 1:** w każdym pliku `mockListProjects` → `vi.fn<typeof ProjectsServices.listProjects>()`.
- [ ] **Krok 2:** fabryka z `importOriginal`: `hasCompanyData: actual.hasCompanyData` (arsenal) i
      `isWorkProject: actual.isWorkProject` (nexus_docs), `satisfies Partial<typeof ProjectsServices>`.
- [ ] **Krok 3:** fixture'y `mockReturnValue({ projects: [...] })` uzupełnij do pełnego typu wpisu (zasada 3, lokalny builder `entry`).
- [ ] **Krok 4:** `tsc` bez błędów w tych plikach; kanarek typów w jednym pliku z każdego kontekstu.
- [ ] **Krok 5:** `npx vitest run tests/unit/contexts/bc_arsenal tests/unit/contexts/bc_nexus_docs`: wszystkie PASS.
- [ ] **Krok 6:** commit `test(arsenal,nexus-docs): atrapy listProjects z typem, reguły projektu z oryginału (ASERCJE-3)`.

### Zadanie A3: `bc_inbox`, `bc_calendar`, `bc_resources`, `bc_diagnostics` (cursor `--role task --tier light`)

**Pliki:** `tests/unit/contexts/bc_inbox/services.test.ts`, `bc_calendar/services.test.ts`,
`bc_resources/services.resources.test.ts`, `bc_diagnostics/services.test.ts`.

Atrapy do otypowania (moduł → funkcje):

- inbox: `bc_inbox/repositories` (6 funkcji z l. 5–10), `bc_projects/services` (`getProject`, `applyTaskOp`),
  `bc_tasks/services` (`createTask`), `bc_notes/services` (`createNote`);
- calendar: `bc_calendar/repositories` (4 funkcje), `bc_tasks/services` (`getTasks`), `bc_tags/services` (`resolveTags`);
- resources: `bc_resources/repositories` (4), `bc_nexus_docs/services` (`buildKnowledgeLinkIndex`; jeśli fabryka podaje
  `normalizeHost`, ma to być `actual.normalizeHost`), `bc_tags/services` (`resolveTags`);
- diagnostics: `bc_projects/services` (`listProjects`, `isWorkProject` → `actual.isWorkProject`), `bc_diagnostics/repositories`.

- [ ] **Krok 1:** zlecenie cursorowi: wzorzec z sekcji „Wzorzec warstwy A” + diff zadania A1 jako przykład + zasady 1–5,
      jeden plik na zlecenie, raport `GOTOWE: …` / `UTKNĄŁEM: …` z liczbą błędów `tsc` przed i po.
- [ ] **Krok 2 (Claude):** l. 253 `bc_inbox/services.test.ts`: zamień sprawdzenie samego istnienia `r.warning` na
      `expect(r).toEqual({ target: …, ref: …, warning: MOVE_WARNING })` z wartościami z tego testu (`MOVE_WARNING` z
      `contexts/bc_inbox/services.ts`; jeśli nie jest eksportowany, porównaj z dosłownym tekstem stałej).
- [ ] **Krok 3 (Claude):** po każdym pliku `git diff --stat` (zmienia się tylko ten plik testu), przegląd diffu pod kątem
      zakazanych rzutowań (`grep -n "as any\|as never\|as unknown\|ts-expect-error\|ts-ignore"` w zmienionych liniach: zero).
- [ ] **Krok 4:** `/verify tests/unit/contexts/bc_inbox tests/unit/contexts/bc_calendar tests/unit/contexts/bc_resources tests/unit/contexts/bc_diagnostics`.
- [ ] **Krok 5:** kanarek typów w każdym z 4 plików (Claude).
- [ ] **Krok 6:** commit `test(inbox,calendar,resources,diagnostics): atrapy z typem kontraktu (ASERCJE-3)`.

### Zadanie A4: `bc_projects` (atrapy repozytoriów, cursor)

**Pliki:** `tests/unit/contexts/bc_projects/services.{archive,code-sync,complete-now,context-pack,git-activity,week-review-data}.test.ts`
i `services.test.ts`. Wszystkie mockują `@/contexts/bc_projects/repositories` (folder, import `…/repositories` wskazuje `index.ts`).

- [ ] **Krok 1:** zlecenie cursorowi jak w A3, jeden plik na zlecenie; typ: `import type * as ProjectsRepo from "@/contexts/bc_projects/repositories"`.
- [ ] **Krok 2 (Claude):** kontrola jak w A3 kroki 3 i 5.
- [ ] **Krok 3:** `/verify tests/unit/contexts/bc_projects`.
- [ ] **Krok 4:** commit `test(projects): atrapy repozytoriów z typem kontraktu (ASERCJE-3)`.

### Zadanie A5: pozostałe konteksty (cursor)

**Pliki:** `bc_board/services.test.ts`, `bc_browser/services.test.ts`, `bc_mind_maps/services.test.ts`,
`bc_notes/services.test.ts`, `bc_tags/services.test.ts`, `bc_tags/services.resolve.test.ts`,
`bc_tasks/services.tasks.test.ts`, `bc_tasks/services.templates.test.ts` (wszystkie w `tests/unit/contexts/`).

- [ ] **Krok 1:** zlecenia cursorowi jak w A3 (`bc_board` i `bc_mind_maps`: wariant „obiekt w `vi.hoisted`”).
- [ ] **Krok 2 (Claude):** kontrola jak w A3 kroki 3 i 5.
- [ ] **Krok 3:** `/verify tests/unit/contexts`; liczba testów równa tej z zadania 0, krok 3.
- [ ] **Krok 4:** `grep -rn "vi.hoisted(() => vi.fn())" tests/unit/contexts/*/services*.test.ts`: zero trafień.
- [ ] **Krok 5:** commit `test(board,browser,mind-maps,notes,tags,tasks): atrapy z typem kontraktu (ASERCJE-3)`.

---

## Wzorzec warstwy B

Miejsce: `tests/unit/boundaries/<konsument>-<dostawca>.boundary.test.ts` (wewnątrz `tests/unit`, więc obejmuje je zwykły
`vitest run` i `tsc`). Nagłówek `// @vitest-environment node`, `const vault = setupTempVault();`.

Zasady:

1. **Zero `vi.mock` na `contexts/**`.** Wolno mockować tylko podprocesy i sieć, i to konkretne moduły (katalogi `lib/\*`nie mają pliku`index`): `@/lib/ports/wsl`, `@/lib/ports/windows`, `@/lib/ports/proc`, `@/lib/herdr/hc-ls`, `@/lib/git/project-git`,
globalny `fetch`przez`vi.stubGlobal("fetch", …)`(z typem kontraktu jak w warstwie A). Dla gita lepszy od atrapy jest
prawdziwy tymczasowy repozytorium z`tests/unit/helpers/tempGit.ts` (`setupTempRepos().create()`). Każdy plik B ma
   w nagłówku komentarz, które moduły są atrapą i dlaczego.
2. **Dane dostawcy przez jego publiczne serwisy**, gdy taki zapis istnieje (`bc_tasks` `createTask`, `bc_inbox` `addItem`,
   `bc_calendar` `createCalendarEvent`, `bc_notes` `createNote`, `bc_tags` `createUserTag` / `resolveTags`). Tylko pliki bez
   serwisu zapisu (`Projects/_registry.yaml`, `Projects/<id>/index.md`, `Projects/<id>/tasks.md`, notatki `Knowledge/**`,
   `Arsenal/*.yaml`) piszesz `vault.write` według `docs/nexus-vault-formaty-yaml.md` i istniejących testów repozytoriów
   (rejestr: `tests/unit/contexts/bc_projects/repositories.test.ts:63-80`; tablica projektu:
   `tests/unit/contexts/bc_projects/fixtures/monolith-tasks.fixture.txt`).
3. **Test charakteryzujący przechodzi od razu**, więc czerwień (TDD-1) pokazujesz mutacją: w każdym pliku B wskazany niżej
   kanarek w **kodzie produkcyjnym** zmieniasz na chwilę, uruchamiasz plik, widzisz FAIL na właściwej asercji, cofasz zmianę
   (`git diff contexts/` pusty przed commitem). Wynik kanarka (nazwa testu + komunikat) wpisz do opisu commita.
4. Asercje na wartościach (`toEqual` / `toMatchObject` z konkretnymi polami), nie `toBeDefined`.
5. Jeden plik = jedna para (konsument, dostawca) albo jeden konsument z kilkoma dostawcami, gdy jedno wywołanie konsumenta
   czyta je razem (`getCockpit`).

Rejestr używany w kilku plikach (dwa projekty: własny i etatowy; `owner: personal|work` parsuje
`contexts/bc_projects/repositories/index.ts:82-94,138-146`). `local_path` jest potrzebny w B1, B3, B7, B8 (arsenal rzuca 409
bez niego), więc rejestr powstaje z funkcji w pliku testu, a ścieżki to katalogi z `fs.mkdtempSync` albo repozytoria z `tempGit`:

```ts
const registry = (alfaPath: string, betaPath: string): string =>
  [
    "projects:",
    "  - id: alfa",
    "    name: Alfa",
    "    status: active",
    "    priority: high",
    "    folder: Projects/alfa/",
    "    owner: personal",
    `    local_path: '${alfaPath}'`,
    "  - id: beta",
    "    name: Beta",
    "    status: active",
    "    priority: medium",
    "    folder: Projects/beta/",
    "    owner: work",
    `    local_path: '${betaPath}'`,
    "",
  ].join("\n");
// vault.write("Projects/_registry.yaml", registry(alfaDir, betaDir));
```

Pierwszy test w B1 sprawdza sam rejestr: `listProjects().projects.map((p) => [p.id, p.owner])` równe
`[["alfa", "personal"], ["beta", "work"]]`.

### Zadanie B1: `bc_diagnostics` ↔ `bc_projects`

**Plik:** utwórz `tests/unit/boundaries/diagnostics-projects.boundary.test.ts`. Atrapy (podprocesy `ss` / PowerShell / `/proc`):
`@/lib/ports/wsl` (`listWslListeners`), `@/lib/ports/windows` (`listWindowsListeners` → wynik `ok: false`, żeby nie dublować),
`@/lib/ports/proc` (`listSubdirectories`), wszystkie z typem. WSL zwraca dwa porty LISTEN: jeden z `cwd` w `<alfaDir>/app`,
drugi w `<betaDir>/app`. Reguła produkcji: `loadProjectRoots` pomija projekty `isWorkProject` (`contexts/bc_diagnostics/services.ts:133-147`, D7).

- [ ] **Krok 1:** test rejestru (patrz wzorzec B), potem test „port w projekcie etatowym nie dostaje projektu”: w wyniku
      `listPorts({ home: <tmp> })` (opcje z `ListPortsOptions`, l. 209) port z `alfaDir` ma przypisany projekt `alfa`
      (`toMatchObject` z polami projektu z typu wpisu portu w `contexts/bc_diagnostics/models.ts`), port z `betaDir` nie ma
      przypisanego projektu (pola projektu `undefined`/`null` według typu).
- [ ] **Krok 2:** uruchom: PASS.
- [ ] **Krok 3:** kanarek: w `contexts/bc_projects/services/index.ts` `isWorkProject` zwraca na chwilę `false`; test FAIL; cofnij.
- [ ] **Krok 4:** commit `test(boundaries): diagnostics ↔ projects bez atrap kontekstów (ASERCJE-3)`.

### Zadanie B2: `bc_nexus_docs` ↔ `bc_projects`

**Plik:** `tests/unit/boundaries/nexus-docs-projects.boundary.test.ts`. Bez atrap.

- [ ] **Krok 1:** vault: rejestr jak wyżej, `Projects/alfa/notatka.md`, `Projects/beta/notatka.md`, `Knowledge/ogolna.md`.
      Test: `listDocs()` zawiera `Projects/alfa/notatka.md` i `Knowledge/ogolna.md`, nie zawiera żadnej ścieżki `Projects/beta/`
      (asercja na liście ścieżek, `toEqual` po posortowaniu).
- [ ] **Krok 2:** test: `getDoc(["Projects", "beta", "notatka.md"])` rzuca `NotFoundError` z komunikatem
      `"Nie znaleziono dokumentu"`, tak samo jak dla nieistniejącego dokumentu (`contexts/bc_nexus_docs/services.ts:138-141`).
- [ ] **Krok 3:** PASS; kanarek: `isWorkProject` → `false`; oba testy FAIL; cofnij.
- [ ] **Krok 4:** commit `test(boundaries): nexus_docs ↔ projects bez atrap (ASERCJE-3)`.

### Zadanie B3: `bc_arsenal` ↔ `bc_projects`

**Plik:** `tests/unit/boundaries/arsenal-projects.boundary.test.ts`. Bez atrap.

- [ ] **Krok 1:** vault: rejestr jak wyżej (z `local_path`) + minimalny skill w `Arsenal/` (format z
      `tests/unit/contexts/bc_arsenal/services.deploy.test.ts`). Test: `getDeployInstructions(<slug>, "beta", "full")` ma
      `note: WORK_TARGET_NOTE` (`contexts/bc_arsenal/models`), a `getDeployInstructions(<slug>, "alfa", "full")` nie ma klucza `note`
      (`contexts/bc_arsenal/services.ts:261-277`; tu decyduje `owner`, który przychodzi z `listProjects`).
- [ ] **Krok 2:** test: `listArsenal()` zwraca cele z `companyData: true` dla `beta` i `false` dla `alfa`
      (`contexts/bc_arsenal/services.ts:170-177`, `hasCompanyData` z `bc_projects`). Dodatkowo projekt `gamma` z `owner: personal`
      i `type: etat` w `Projects/gamma/index.md` (frontmatter `type: etat`) ma `companyData: true`: to sprawdza, że `type` z vaulta
      dochodzi przez granicę.
- [ ] **Krok 3:** PASS; kanarki: (a) `hasCompanyData` w `bc_projects` zwraca na chwilę `false` → krok 2 FAIL;
      (b) mapowanie `owner` w `listProjects` (`bc_projects`) na chwilę zawsze `"personal"` → krok 1 FAIL; cofnij oba.
- [ ] **Krok 4:** commit `test(boundaries): arsenal ↔ projects bez atrap (ASERCJE-3)`.

### Zadanie B4: `bc_inbox` ↔ `bc_projects` / `bc_tasks` / `bc_notes`

**Plik:** `tests/unit/boundaries/inbox-move.boundary.test.ts`. Bez atrap.

- [ ] **Krok 1:** test „do projektu”: `addItem("kupić domenę")`, potem
      `moveItem(id, { target: "project", projectId: "alfa", column: "next", text: "kupić domenę" })`; oczekiwane:
      wynik `{ target: "project", ref: "alfa" }` (bez `warning`), `vault.read("Projects/alfa/tasks.md")` zawiera linię z
      `kupić domenę` w sekcji `## Next`, `listItems()` nie zawiera już wpisu jako otwartego.
- [ ] **Krok 2:** test „do zadań”: `moveItem(id, { target: "task", text: "zadzwonić" })`; `ref` równy `id` zadania, które
      zwraca `getTasks()` z `bc_tasks` z tytułem `zadzwonić`.
- [ ] **Krok 3:** test „do notatki”: `moveItem(id, { target: "note", title: "Pomysł", text: "treść" })`; `ref` wskazuje
      notatkę, którą zwraca `getNotes()` z `bc_notes`, z tytułem `Pomysł` i treścią `treść`.
- [ ] **Krok 4:** test „nieznany projekt”: `projectId: "nie-ma"` → błąd (typ z `bc_projects`), a wpis inboxu zostaje otwarty.
- [ ] **Krok 5:** PASS; kanarek: w `contexts/bc_inbox/services.ts` `writeTarget` dla `project` podaje na chwilę `column: "icebox"`
      zamiast `input.column`; test z kroku 1 FAIL; cofnij.
- [ ] **Krok 6:** commit `test(boundaries): przenoszenie z inboxu bez atrap kontekstów (ASERCJE-3)`.

### Zadanie B5: `bc_calendar` ↔ `bc_tasks` / `bc_tags`

**Plik:** `tests/unit/boundaries/calendar-tasks-tags.boundary.test.ts`. Bez atrap.

- [ ] **Krok 1:** test: `createTask({ title: "Raport", due_date: "2026-11-20" })` i
      `createTask({ title: "Odłożone", due_date: "2026-11-20", status: "deferred" })` (`contexts/bc_tasks/services.ts:25-32`);
      `getCalendarEvents(<opcje zakresu listopada 2026 z sygnatury, l. 55>)` zawiera termin zadania `Raport` w dniu `2026-11-20`,
      a `Odłożone` nie (filtr `deferred`: `contexts/bc_calendar/services.ts:62`).
- [ ] **Krok 2:** test: `createCalendarEvent({ date: "2026-11-20", start_minutes: 600, duration_minutes: 30, title: "X",
    tags: ["praca"], color: "#00802b" })`, gdy słownik tagów (format: `docs/nexus-vault-formaty-yaml.md`, sekcja „Tagi: słownik
      i synonimy”) ma tag `Praca` z synonimem `praca` → w `Calendar/2026-11.yaml` (`vault.read`) wydarzenie ma `tags: [Praca]`.
- [ ] **Krok 3:** PASS; kanarek: w `contexts/bc_calendar/services.ts` pominięcie filtru zadań odłożonych (albo
      `resolveTags` zastąpione tożsamością); właściwy test FAIL; cofnij.
- [ ] **Krok 4:** commit `test(boundaries): calendar ↔ tasks/tags bez atrap (ASERCJE-3)`.

### Zadanie B6: `bc_resources` ↔ `bc_nexus_docs` / `bc_tags`

**Plik:** `tests/unit/boundaries/resources-docs-tags.boundary.test.ts`. Atrapa: tylko sieć. `addResource` zawsze woła
`fetch` w `fetchPageMetadata` (`contexts/bc_resources/services.ts:8-14,105-107`), więc
`vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => new Response("<html><head><title>Strona</title></head></html>", { headers: { "content-type": "text/html" } })))`
w `beforeEach` i `vi.unstubAllGlobals()` w `afterEach`.

- [ ] **Krok 1:** vault: `Knowledge/narzedzia.md` z linkiem `https://www.example.com/docs`. Test: `addResource({ description: "d", url: "https://example.com/x" })`
      i `getResources()` → zasób ma powiązanie z notatką `Knowledge/narzedzia.md` (pole ustal z typu `Resource`), bo
      `normalizeHost` zrównuje `www.example.com` i `example.com`.
- [ ] **Krok 2:** test: tagi zasobu przechodzą przez słownik tagów (synonim → postać kanoniczna), jak w B5 krok 2.
- [ ] **Krok 3:** PASS; kanarek: `normalizeHost` w `bc_nexus_docs` przestaje obcinać `www.`; test 1 FAIL; cofnij.
- [ ] **Krok 4:** commit `test(boundaries): resources ↔ nexus_docs/tags bez atrap (ASERCJE-3)`.

### Zadanie B7: `bc_cockpit` ↔ `bc_projects` / `bc_tasks` / `bc_calendar` / `bc_inbox`

**Plik:** `tests/unit/boundaries/cockpit.boundary.test.ts`. Bez atrap: `getCockpit` nie woła `lib/github`
(`contexts/bc_cockpit/services.ts:501-530`), a git dają prawdziwe repozytoria z `tempGit` (`local_path` w rejestrze = `repo.dir`,
po jednym commicie z dnia `2026-11-20`). Data: `const today = new Date(2026, 10, 20, 9, 0)`.

- [ ] **Krok 1:** vault: rejestr jak wyżej; `Projects/alfa/tasks.md` i `Projects/beta/tasks.md` z jednym zadaniem w sekcji, z której
      `listNowTasks` (`bc_projects`) bierze kolejkę (nagłówek i format linii skopiuj z
      `tests/unit/contexts/bc_projects/fixtures/monolith-tasks.fixture.txt` i parsera `contexts/bc_projects/repositories/tasks-file.ts`);
      `createTask({ title: "Ogólne", due_date: "2026-11-20" })`; `createCalendarEvent({ date: "2026-11-20", start_minutes: 600,
    duration_minutes: 30, title: "Spotkanie", tags: [], color: "#00802b", type: "meeting" })`; dwa `addItem(...)` w inboxie.
- [ ] **Krok 2:** test: `getCockpit(today)` →
      `queue` zawiera (`toMatchObject`) zadanie projektu `alfa` i zadanie ogólne `Ogólne`;
      `events` zawiera `Spotkanie` z `start_minutes: 600`;
      `nextMeeting` pasuje do `{ date: "2026-11-20", title: "Spotkanie" }`;
      `inbox` równe `{ open: 2 }` (`contexts/bc_cockpit/services.ts:446`);
      `git` zawiera aktywność obu projektów z dnia `2026-11-20` (kształt z typu `Cockpit`).
- [ ] **Krok 3:** test: wpisy projektu `beta` (etat) mają `kind: "etat"` i `companyData: true`, wpisy `alfa` mają
      `kind: "wlasny"` i `companyData: false` (pola `kind`/`companyData` z `contexts/bc_cockpit/models.ts:20-21,52-53`; sprawdź
      w tematach i w kolejce, wszędzie gdzie typ je ma).
- [ ] **Krok 4:** PASS; kanarek: `projectKind` w `bc_projects` zwraca na chwilę zawsze `"wlasny"`; test z kroku 3 FAIL; cofnij.
- [ ] **Krok 5:** commit `test(boundaries): cockpit ↔ projects/tasks/calendar/inbox bez atrap (ASERCJE-3)`.

### Zadanie B8: `bc_map` ↔ `bc_projects`

**Plik:** `tests/unit/boundaries/map-projects.boundary.test.ts`. Atrapa: `@/lib/herdr/hc-ls` (`listTerminals`, podproces `hc ls`),
z typem. Reguła produkcji: `getAgents()` ukrywa `projectId`/`status`/`where` agentów w projektach `isWorkProject`
(`contexts/bc_map/services.ts:318-321,343-350`); `getGraph()` tej reguły nie stosuje i nie jest tu sprawdzany.

- [ ] **Krok 1:** test: `listTerminals` zwraca `{ available: true, terminals: [...] }` z dwoma terminalami, których katalog
      (pole z typu `HerdrTerminal`) leży w `alfaDir` i `betaDir`. `getAgents()` → agent z `alfaDir` ma `projectId: "alfa"`,
      agent z `betaDir` nie ma klucza `projectId` ani `where`.
- [ ] **Krok 2:** test: `getGraph()` z rejestrem zawiera węzły projektów `alfa` i `beta` (nazwy `"Alfa"`, `"Beta"`), a
      `warnings` jest puste: dane rejestru dochodzą przez granicę.
- [ ] **Krok 3:** PASS; kanarek: `isWorkProject` → `false`; krok 1 FAIL; cofnij.
- [ ] **Krok 3:** commit `test(boundaries): map ↔ projects bez atrap (ASERCJE-3)`.

---

### Zadanie C: weryfikacja końcowa i PR

- [ ] **Krok 1:** `git diff main --stat -- contexts lib src app`: pusto (produkcja bez zmian).
- [ ] **Krok 2:** `/verify` (tsc + vitest + lint, całość).
- [ ] **Krok 3:** review diffu przez pomocników (agy `--role review`, `AGY_DEEP_TAG=Hydrogen` do 2026-11-21; cursor
      `--role review --tier light`): zgodność z ASERCJE-3, zakazane rzutowania, czy kanarki opisane w commitach.
- [ ] **Krok 4:** skill `finishing-a-development-branch`; PR z checklistą Kodeksu (ASERCJE-3, DOWODY-2: komenda weryfikacji
      i czas w opisie). Commit/push tylko za zgodą użytkownika.

## Poza zakresem

- Testy routerów (22 pliki mockują `services` własnego kontekstu): to granica warstwy, dopuszczona przez ASERCJE-3; typowanie
  tych atrap można dodać osobnym planem, jeśli review wykaże potrzebę.
- Zmiany kodu produkcyjnego. Jeśli test granicy ujawni błąd w produkcji: zatrzymaj się, zgłoś użytkownikowi, dopisz bug
  (skill `bug-projektu`), nie naprawiaj w tej gałęzi.
- Przegląd sekcji 3–6 Kodeksu (wraca po zakończeniu tego planu).
