# Plan wdrożenia: Opis projektu „Po co i dlaczego” w karcie Projekty

Cel w 1 zdaniu: Dodanie sekcji „Po co i dlaczego” do karty projektu w teczce inżynierskiej (Alt+4) wyświetlającej cel projektu i motywację autora odczytywane z pliku `index.md` w vaulcie NEXUS.
Architektura w 2–3 zdaniach: Sekcja `## Po co i dlaczego` w `index.md` jest parsowana przez `readProjectIndex` w `contexts/bc_projects/repositories` jako pole `purpose: string | null` w modelu `ProjectIndex`. Następnie mapper `toDetailDto` przekazuje je do `ProjectDetailDto` (z pominięciem `ProjectSummaryDto`), skąd komponent `ProjectDossier` w `src/features/projects/` renderuje dedykowaną kartę przed `ProjectSaveState` tylko wtedy, gdy treść nie jest pusta (`purpose !== null`). Architektura warstwowa (router → services → repositories) oraz reguły ADR-021 pozostają w pełni zachowane.
Stos technologiczny: TypeScript, React, Next.js App Router, Vitest, Testing Library, CSS Modules/BEM (`.prj-*`), i18n (lokalizacje PL/EN).

---

### Task 1: models.ts, repositories/index.ts oraz services/index.ts — odczyt sekcji „Po co i dlaczego”

**Pliki do modyfikacji:**

- Modify: `contexts/bc_projects/models.ts` (linie 63–68)
- Modify: `contexts/bc_projects/repositories/index.ts` (linie 156–158 oraz 172–177)
- Modify: `contexts/bc_projects/services/index.ts` (linie 146–151)
- Test: `tests/unit/contexts/bc_projects/repositories.test.ts` (linie 157–161, 181 oraz nowe testy na końcu bloku `bc_projects repositories`)

- [ ] **Krok 1: Napisz testy jednostkowe odczytu `purpose` w `repositories.test.ts`**
      W pliku `tests/unit/contexts/bc_projects/repositories.test.ts` dopisz przypadki testowe sprawdzające odczyt sekcji `## Po co i dlaczego`:

```typescript
it("readProjectIndex: index.md z sekcją ## Po co i dlaczego + tekst", () => {
  const e = entry({ id: "p", folder: "Projects/p/" });
  vault.write(
    "Projects/p/index.md",
    "---\nname: P\n---\n\n## Po co i dlaczego\nProjekt służy do nauki programowania.\n\n## O projekcie\nOpis aplikacji.\n"
  );
  const index = readProjectIndex(e);
  expect(index.purpose).toBe("Projekt służy do nauki programowania.");
});

it("readProjectIndex: index.md bez tej sekcji zwraca purpose === null", () => {
  const e = entry({ id: "p", folder: "Projects/p/" });
  vault.write("Projects/p/index.md", "---\nname: P\n---\n\n## O projekcie\nOpis aplikacji.\n");
  const index = readProjectIndex(e);
  expect(index.purpose).toBeNull();
});

it("readProjectIndex: sekcja z samym nagłówkiem lub białymi znakami zwraca purpose === null", () => {
  const e = entry({ id: "p", folder: "Projects/p/" });
  vault.write(
    "Projects/p/index.md",
    "---\nname: P\n---\n\n## Po co i dlaczego\n   \n\n## O projekcie\nOpis aplikacji.\n"
  );
  const index = readProjectIndex(e);
  expect(index.purpose).toBeNull();
});

it("readProjectIndex: przy dwóch sekcjach wygrywa pierwsza", () => {
  const e = entry({ id: "p", folder: "Projects/p/" });
  vault.write(
    "Projects/p/index.md",
    "---\nname: P\n---\n\n## Po co i dlaczego\nPierwsza.\n\n## Po co i dlaczego\nDruga.\n"
  );
  expect(readProjectIndex(e).purpose).toBe("Pierwsza.");
});

it("readProjectIndex: nagłówek w innej wielkości liter nie jest rozpoznany", () => {
  const e = entry({ id: "p", folder: "Projects/p/" });
  vault.write("Projects/p/index.md", "---\nname: P\n---\n\n## po co i dlaczego\nTekst.\n");
  expect(readProjectIndex(e).purpose).toBeNull();
});

it("readProjectIndex: linia ## w środku treści obcina tekst (znane ograniczenie parsera)", () => {
  const e = entry({ id: "p", folder: "Projects/p/" });
  vault.write(
    "Projects/p/index.md",
    "---\nname: P\n---\n\n## Po co i dlaczego\nPrzed.\n## Coś innego\nPo.\n"
  );
  expect(readProjectIndex(e).purpose).toBe("Przed.");
});

it("readProjectIndex: brak pliku index.md zwraca purpose === null", () => {
  const e = entry({ id: "missing", folder: "Projects/missing/" });
  const index = readProjectIndex(e);
  expect(index.purpose).toBeNull();
  expect(index.whereIStopped).toBeNull();
});
```

- [ ] **Krok 2: Uruchom test i potwierdź, że PADA**
      Uruchom polecenie:

```bash
npx vitest run tests/unit/contexts/bc_projects/repositories.test.ts -t "readProjectIndex"
```

Oczekiwany błąd: `TypeError` lub `AssertionError: expected undefined to be 'Projekt służy do nauki programowania.'` (pole `purpose` nie istnieje jeszcze w obiekcie zwracanym przez `readProjectIndex`).

- [ ] **Krok 3: Dodaj pole `purpose` do `ProjectIndex` w `models.ts`**
      W pliku `contexts/bc_projects/models.ts` zmień definicję typu `ProjectIndex`:

Przed:

```typescript
export type ProjectIndex = {
  lastWorked?: string;
  stateConfidence?: string;
  type?: ProjectType;
  whereIStopped: string | null;
};
```

Po:

```typescript
export type ProjectIndex = {
  lastWorked?: string;
  stateConfidence?: string;
  type?: ProjectType;
  whereIStopped: string | null;
  purpose: string | null;
};
```

- [ ] **Krok 4: Zaimplementuj odczyt sekcji `## Po co i dlaczego` w `repositories/index.ts`**
      W pliku `contexts/bc_projects/repositories/index.ts` zaktualizuj `readProjectIndex`:

Przed (linie 156–158):

```typescript
if (file === null) {
  return { whereIStopped: null };
}
```

Po (linie 156–158):

```typescript
if (file === null) {
  return { whereIStopped: null, purpose: null };
}
```

Oraz przed (linie 172–177):

```typescript
const whereSection = parseSections(body).find((s) => s.heading === "Gdzie skończyłem");
const whereBody = whereSection?.body.trim() ?? "";

const index: ProjectIndex = {
  whereIStopped: whereBody === "" ? null : whereBody,
};
```

Po (linie 172–181):

```typescript
const sections = parseSections(body);
const whereSection = sections.find((s) => s.heading === "Gdzie skończyłem");
const whereBody = whereSection?.body.trim() ?? "";

const purposeSection = sections.find((s) => s.heading === "Po co i dlaczego");
const purposeBody = purposeSection?.body.trim() ?? "";

const index: ProjectIndex = {
  whereIStopped: whereBody === "" ? null : whereBody,
  purpose: purposeBody === "" ? null : purposeBody,
};
```

- [ ] **Krok 5: Zaktualizuj gałąź awaryjną w `services/index.ts`**
      W pliku `contexts/bc_projects/services/index.ts` w funkcji `listProjects` w bloku `catch`:

Przed (linie 146–150):

```typescript
projects.push({
  ...entry,
  whereIStopped: null,
  freshness: "unknown",
});
```

Po (linie 146–151):

```typescript
projects.push({
  ...entry,
  whereIStopped: null,
  purpose: null,
  freshness: "unknown",
});
```

- [ ] **Krok 6: Zaktualizuj istniejące asercje w `repositories.test.ts`**
      W pliku `tests/unit/contexts/bc_projects/repositories.test.ts` zaktualizuj istniejące asercje `toEqual`:

W linii 157–161:

```typescript
expect(readProjectIndex(e)).toEqual({
  lastWorked: "2026-05-19",
  stateConfidence: "verified",
  whereIStopped: "Koniec X.",
  purpose: null,
});
```

W linii 181:

```typescript
expect(readProjectIndex(e)).toEqual({ whereIStopped: null, purpose: null });
```

- [ ] **Krok 7: Uruchom test i potwierdź, że PRZECHODZI**
      Uruchom polecenie:

```bash
npx vitest run tests/unit/contexts/bc_projects/repositories.test.ts -t "readProjectIndex"
```

Oczekiwany wynik: wszystkie 7 nowych testów oraz istniejące testy w `repositories.test.ts` są zielone (PASS).

Commit: wykonuje Claude (komunikat: `feat(projects): dodanie odczytu sekcji Po co i dlaczego w readProjectIndex`)

---

### Task 2: schemas.ts — pole `purpose` w `ProjectDetailDto` i mapper `toDetailDto`

**Pliki do modyfikacji:**

- Modify: `contexts/bc_projects/schemas.ts` (linie 290–299 oraz 360–377)
- Test: `tests/unit/contexts/bc_projects/schemas.test.ts` (linie 23–36, 48–58 oraz 60–75)

- [ ] **Krok 1: Napisz testy maperów w `schemas.test.ts`**
      W pliku `tests/unit/contexts/bc_projects/schemas.test.ts` zaktualizuj obiekt `base` oraz dopisz asercje do istniejących testów `toSummaryDto` i `toDetailDto`:

W obiekcie `base: Project` (linie 23–36) dopisz `purpose: "Projekt demonstracyjny"`:

```typescript
const base: Project = {
  id: "a",
  name: "Alpha",
  status: "active",
  priority: "high",
  folder: "Projects/a/",
  localPath: "/tmp/a",
  github: "https://g",
  owner: "personal",
  lastWorked: "2026-11-05",
  stateConfidence: "verified",
  whereIStopped: "tu",
  purpose: "Projekt demonstracyjny",
  freshness: "fresh",
};
```

W teście `toSummaryDto bez folder i whereIStopped` (linie 48–58) dopisz asercję sprawdzającą, że `purpose` NIE trafiło do `ProjectSummaryDto`:

```typescript
it("toSummaryDto bez folder i whereIStopped", () => {
  const dto = toSummaryDto(base);
  expect("folder" in dto).toBe(false);
  expect(dto).toMatchObject({
    id: "a",
    localPath: "/tmp/a",
    freshness: "fresh",
    lastWorked: "2026-11-05",
  });
  expect("whereIStopped" in dto).toBe(false);
  expect("purpose" in dto).toBe(false);
});
```

W teście `toDetailDto z tasks, bugs, whereIStopped bez folder` (linie 60–75) dopisz asercję sprawdzającą pole `purpose`:

```typescript
it("toDetailDto z tasks, bugs, whereIStopped bez folder", () => {
  const full: ProjectWithContent = {
    ...base,
    tasks: [{ heading: "Next", items: [{ text: "A", done: false }] }],
    bugs: [{ id: "B-1", title: "x", section: "Aktywne" }],
    board: { blockers: [], now: [], next: [], icebox: [], version: null },
    state: null,
    stateVersion: null,
    devlog: [],
  };
  const dto = toDetailDto(full);
  expect("folder" in dto).toBe(false);
  expect(dto.whereIStopped).toBe("tu");
  expect(dto.purpose).toBe("Projekt demonstracyjny");
  expect(dto.tasks).toEqual(full.tasks);
  expect(dto.bugs).toEqual(full.bugs);
});
```

- [ ] **Krok 2: Uruchom test i potwierdź, że PADA**
      Uruchom polecenie:

```bash
npx vitest run tests/unit/contexts/bc_projects/schemas.test.ts -t "toDetailDto"
```

Oczekiwany błąd: `AssertionError: expected undefined to be 'Projekt demonstracyjny'`.

- [ ] **Krok 3: Dodaj pole `purpose` do `ProjectDetailDto` w `schemas.ts`**
      W pliku `contexts/bc_projects/schemas.ts` w typie `ProjectDetailDto` (linie 290–299):

Przed:

```typescript
export type ProjectDetailDto = ProjectSummaryDto & {
  tasks: ChecklistSectionDto[];
  board: TasksBoardDto;
  bugs: BugEntryDto[];
  whereIStopped: string | null;
  state: ProjectStateDto | null;
  /** `"<size>:<hash>"` pliku `state.md` (do odesłania w PUT); `null`, gdy pliku nie ma. */
  stateVersion: string | null;
  devlog: DevlogEntryDto[];
};
```

Po:

```typescript
export type ProjectDetailDto = ProjectSummaryDto & {
  tasks: ChecklistSectionDto[];
  board: TasksBoardDto;
  bugs: BugEntryDto[];
  whereIStopped: string | null;
  purpose: string | null;
  state: ProjectStateDto | null;
  /** `"<size>:<hash>"` pliku `state.md` (do odesłania w PUT); `null`, gdy pliku nie ma. */
  stateVersion: string | null;
  devlog: DevlogEntryDto[];
};
```

- [ ] **Krok 4: Zaktualizuj mapper `toDetailDto` w `schemas.ts`**
      W pliku `contexts/bc_projects/schemas.ts` w funkcji `toDetailDto` (linie 360–377):

Przed:

```typescript
export function toDetailDto(p: ProjectWithContent): ProjectDetailDto {
  return {
    ...toSummaryDto(p),
    tasks: p.tasks,
    board: {
      blockers: p.board.blockers,
      now: p.board.now,
      next: p.board.next,
      icebox: p.board.icebox,
      version: p.board.version ? `${p.board.version.size}:${p.board.version.hash}` : null,
    },
    bugs: p.bugs.map(toBugDto),
    whereIStopped: p.whereIStopped,
    state: p.state ? toStateDto(p.state) : null,
    stateVersion: p.stateVersion ? `${p.stateVersion.size}:${p.stateVersion.hash}` : null,
    devlog: p.devlog.slice(0, DEVLOG_LIMIT),
  };
}
```

Po:

```typescript
export function toDetailDto(p: ProjectWithContent): ProjectDetailDto {
  return {
    ...toSummaryDto(p),
    tasks: p.tasks,
    board: {
      blockers: p.board.blockers,
      now: p.board.now,
      next: p.board.next,
      icebox: p.board.icebox,
      version: p.board.version ? `${p.board.version.size}:${p.board.version.hash}` : null,
    },
    bugs: p.bugs.map(toBugDto),
    whereIStopped: p.whereIStopped,
    purpose: p.purpose,
    state: p.state ? toStateDto(p.state) : null,
    stateVersion: p.stateVersion ? `${p.stateVersion.size}:${p.stateVersion.hash}` : null,
    devlog: p.devlog.slice(0, DEVLOG_LIMIT),
  };
}
```

- [ ] **Krok 5: Uruchom test i potwierdź, że PRZECHODZI**
      Uruchom polecenie:

```bash
npx vitest run tests/unit/contexts/bc_projects/schemas.test.ts -t "toDetailDto"
```

Oczekiwany wynik: testy `toDetailDto` oraz `toSummaryDto` w `schemas.test.ts` są zielone (PASS).

Commit: wykonuje Claude (komunikat: `feat(projects): dodanie pola purpose do ProjectDetailDto i toDetailDto`)

---

### Task 3: Uzupełnienie `purpose: null` w fixturach i mockach istniejących testów

**Pliki do modyfikacji:**

- Modify: `tests/unit/contexts/bc_projects/services.test.ts`
- Modify: `tests/unit/contexts/bc_projects/services.archive.test.ts`
- Modify: `tests/unit/contexts/bc_projects/services.complete-now.test.ts`
- Modify: `tests/unit/contexts/bc_projects/services.context-pack.test.ts`
- Modify: `tests/unit/contexts/bc_projects/router.test.ts`
- Modify: `tests/unit/contexts/bc_projects/router.archive.test.ts`
- Modify: `tests/unit/contexts/bc_projects/schemas.archive.test.ts`
- Modify: `tests/unit/contexts/bc_projects/context-pack.compose.test.ts`
- Modify: `tests/unit/contexts/bc_projects/context-pack.roles.test.ts`
- Modify: `tests/unit/contexts/bc_projects/context-pack.bugs.test.ts`
- Modify: `tests/unit/features/projects/ProjectsView.test.tsx`
- Modify: `tests/unit/features/projects/ProjectLinks.test.tsx`
- Modify: `tests/unit/features/projects/ProjectSaveState.test.tsx`
- Modify: `tests/unit/features/projects/ProjectTasksBoard.test.tsx`
- Modify: `tests/unit/features/projects/projectTiles.test.ts`
- Modify: `tests/unit/features/projects/useProjects.test.tsx`
- Modify: `tests/unit/contexts/bc_cockpit/services.test.ts`

- [ ] **Krok 1: Zaktualizuj fixtury w testach serwisów `bc_projects`**
      W `tests/unit/contexts/bc_projects/services.test.ts`:
- W generatorze `fullProject` (ok. linii 70): dopisz `purpose: partial.purpose ?? null`.
- We wszystkich wywołaniach `mockReadProjectIndex.mockReturnValue(...)` (linie 187, 246, 277, 321, 343, 363, 373, 467, 605, 641): uzupełnij zwracane obiekty o `purpose: null`.

W `tests/unit/contexts/bc_projects/services.archive.test.ts`:

- W linii 42: `mockReadProjectIndex.mockReturnValue({ whereIStopped: null, purpose: null });`.

W `tests/unit/contexts/bc_projects/services.complete-now.test.ts`:

- W linii 49: `mockReadProjectIndex.mockReturnValue({ lastWorked: "2026-11-05", whereIStopped: null, purpose: null });`.

W `tests/unit/contexts/bc_projects/services.context-pack.test.ts`:

- W linii 63: `mockReadProjectIndex.mockReturnValue({ whereIStopped: null, purpose: null, lastWorked: "2026-11-01" });`.
- W linii 116 (w fixturze `fullProject`): dopisz `purpose: null`.

- [ ] **Krok 2: Zaktualizuj fixtury w testach routera, schemas i context-pack**
      W `tests/unit/contexts/bc_projects/router.test.ts`:
- W obiekcie `summaryProject: Project` (ok. linii 33): dopisz `purpose: null`.

W `tests/unit/contexts/bc_projects/router.archive.test.ts`:

- W obiekcie `project: ProjectWithContent` (ok. linii 14): dopisz `purpose: null`.

W `tests/unit/contexts/bc_projects/schemas.archive.test.ts`:

- W obiekcie `project: ProjectWithContent` (ok. linii 56): dopisz `purpose: null`.

W `tests/unit/contexts/bc_projects/context-pack.compose.test.ts`:

- W obiekcie `project: ProjectWithContent` (ok. linii 13): dopisz `purpose: null`.

W `tests/unit/contexts/bc_projects/context-pack.roles.test.ts`:

- W obiekcie `project: ProjectWithContent` (ok. linii 12): dopisz `purpose: null`.

W `tests/unit/contexts/bc_projects/context-pack.bugs.test.ts`:

- W funkcji `project(bugs: BugEntry[]): ProjectWithContent` (ok. linii 24): dopisz `purpose: null`.

- [ ] **Krok 3: Zaktualizuj fixtury w testach UI (`tests/unit/features/projects/`)**
      W `tests/unit/features/projects/ProjectsView.test.tsx`:
- W funkcji `detail(...)` (ok. linii 28): dopisz `purpose: null`.

W `tests/unit/features/projects/ProjectLinks.test.tsx`:

- W funkcji `project(...)` (ok. linii 10): dopisz `purpose: null`.

W `tests/unit/features/projects/ProjectSaveState.test.tsx`:

- W funkcji `project(...)` (ok. linii 11): dopisz `purpose: null`.

W `tests/unit/features/projects/ProjectTasksBoard.test.tsx`:

- W funkcji `detail(...)` (ok. linii 26): dopisz `purpose: null`.

W `tests/unit/features/projects/projectTiles.test.ts`:

- W funkcji `d(...)` (ok. linii 20): dopisz `purpose: null`.

W `tests/unit/features/projects/useProjects.test.tsx`:

- W funkcji `detail(...)` (ok. linii 34): dopisz `purpose: null`.

- [ ] **Krok 4: Zaktualizuj fixturę w testach `bc_cockpit`**
      W `tests/unit/contexts/bc_cockpit/services.test.ts`:
- W generatorze `project` (ok. linii 74): dopisz `purpose: null`.

- [ ] **Krok 5: Znajdź pominięte fixtury przez typecheck**
      Numery linii powyżej są przybliżone. Uruchom `npx tsc --noEmit`; każdy błąd „Property 'purpose' is missing” w `tests/` popraw dopisaniem `purpose: null` (nie zmieniaj typów w kodzie produkcyjnym ani w teście architektury). Powtarzaj do 0 błędów.

- [ ] **Krok 6: Uruchom wszystkie testy kontekstów i widoków projektów**
      Uruchom polecenie:

```bash
npx vitest run tests/unit/contexts tests/unit/features/projects
```

Oczekiwany wynik: wszystkie testy przechodzą pomyślnie bez błędów typowania TypeScript i asercji Vitest (PASS).

Commit: wykonuje Claude (komunikat: `test(projects): uzupełnienie fixtur testowych o pole purpose: null`)

---

### Task 4: UI — ProjectDossier.tsx, projects.css, i18n oraz testy w ProjectsView(.en).test.tsx

**Pliki do modyfikacji:**

- Modify: `src/i18n/locales/pl/projects.ts` (sekcja `dossier`, linie 169–184)
- Modify: `src/i18n/locales/en/projects.ts` (sekcja `dossier`, linie 159–174)
- Modify: `src/features/projects/projects.css` (po regule `.prj-where` ok. linii 555 lub w sekcji kart)
- Modify: `src/features/projects/ProjectDossier.tsx` (linie 123–126)
- Test: `tests/unit/features/projects/ProjectsView.test.tsx` (dopisanie testów renderowania karty purpose)
- Test: `tests/unit/features/projects/ProjectsView.en.test.tsx` (dopisanie testu renderowania po angielsku)

- [ ] **Krok 1: Napisz testy integracyjne karty „Po co i dlaczego” w `ProjectsView.test.tsx`**
      W pliku `tests/unit/features/projects/ProjectsView.test.tsx` dopisz testy sprawdzające renderowanie sekcji, kolejność DOM, obsługę tekstu wieloliniowego, traktowanie HTML jako czystego tekstu oraz brak karty przy `purpose === null`:

```tsx
it("renderuje kartę „Po co i dlaczego”, gdy purpose !== null, przed kartą Save State", async () => {
  const a = summary({ id: "a" });
  const apiFetch = makeApiFetch([a], {
    a: detail({
      id: "a",
      purpose: "Pierwsza linia celu.\nDruga linia motywacji.",
    }),
  });
  const { container } = render(<ProjectsView apiFetch={apiFetch} />);

  await waitFor(() => {
    expect(screen.getByText("Po co i dlaczego")).toBeInTheDocument();
  });

  const purposeCard = container.querySelector("article.prj-purpose");
  expect(purposeCard).not.toBeNull();
  expect(within(purposeCard!).getByText(/Pierwsza linia celu/)).toBeInTheDocument();
  expect(within(purposeCard!).getByText(/Druga linia motywacji/)).toBeInTheDocument();

  // Sprawdzenie kolejności w DOM: prj-purpose musi występować przed kartą Save State
  const allCards = Array.from(container.querySelectorAll("article.prj-card"));
  const purposeIndex = allCards.findIndex((el) => el.classList.contains("prj-purpose"));
  const saveStateIndex = allCards.findIndex((el) => within(el).queryByText("Save State") !== null);
  expect(purposeIndex).toBeGreaterThan(-1);
  expect(saveStateIndex).toBeGreaterThan(-1);
  expect(purposeIndex).toBeLessThan(saveStateIndex);
});

it("renderuje tekst z tagami HTML jako surowy tekst (bez parsowania HTML)", async () => {
  const a = summary({ id: "a" });
  const apiFetch = makeApiFetch([a], {
    a: detail({
      id: "a",
      purpose: "Tekst z <b>tagiem HTML</b> i <script>alert(1)</script>",
    }),
  });
  const { container } = render(<ProjectsView apiFetch={apiFetch} />);

  await waitFor(() => {
    expect(
      screen.getByText("Tekst z <b>tagiem HTML</b> i <script>alert(1)</script>")
    ).toBeInTheDocument();
  });
  expect(container.querySelector("b")).toBeNull();
  expect(container.querySelector("script")).toBeNull();
});

it("nie renderuje karty „Po co i dlaczego”, gdy purpose === null", async () => {
  const a = summary({ id: "a" });
  const apiFetch = makeApiFetch([a], {
    a: detail({ id: "a", purpose: null }),
  });
  render(<ProjectsView apiFetch={apiFetch} />);

  await waitFor(() => {
    expect(screen.getByRole("region", { name: "Teczka projektu a" })).toBeInTheDocument();
  });
  expect(screen.queryByText("Po co i dlaczego")).toBeNull();
  expect(document.querySelector("article.prj-purpose")).toBeNull();
});
```

- [ ] **Krok 2: Napisz test wersji angielskiej w `ProjectsView.en.test.tsx`**
      W pliku `tests/unit/features/projects/ProjectsView.en.test.tsx` dopisz test:

```tsx
test("karta celu projektu po angielsku ma tytuł „Why this exists”", async () => {
  await act(async () => {
    await setLanguage("en");
  });
  const a = summary({ id: "a", name: "Alpha" });
  const apiFetch = makeApiFetch([a], {
    a: detail({ id: "a", name: "Alpha", purpose: "Application purpose text." }),
  });
  render(<ProjectsView apiFetch={apiFetch} />);

  expect(await screen.findByText("Why this exists")).toBeInTheDocument();
  expect(screen.getByText("Application purpose text.")).toBeInTheDocument();
  expect(screen.queryByText("Po co i dlaczego")).toBeNull();
});
```

- [ ] **Krok 3: Uruchom testy i potwierdź, że PADAJĄ**
      Uruchom polecenie:

```bash
npx vitest run tests/unit/features/projects/ProjectsView.test.tsx -t "Po co i dlaczego"
```

Oczekiwany błąd: `TestingLibraryElementError: Unable to find an element with the text: Po co i dlaczego`.

- [ ] **Krok 4: Dodaj klucze i18n do plików lokalizacyjnych**
      W `src/i18n/locales/pl/projects.ts` w obiekcie `dossier` (ok. linii 182):

```typescript
    purposeTitle: "Po co i dlaczego",
    tasksTitle: "Tablica zadań · tasks.md",
```

W `src/i18n/locales/en/projects.ts` w obiekcie `dossier` (ok. linii 172):

```typescript
    purposeTitle: "Why this exists",
    tasksTitle: "Task board · tasks.md",
```

- [ ] **Krok 5: Dodaj styl CSS w `src/features/projects/projects.css`**
      W pliku `src/features/projects/projects.css` dopisz regułę dla tekstu opisu:

```css
.prj-purpose__text {
  margin: 0;
  font: 500 var(--fs-sm) / 1.45 var(--font-mono);
  color: var(--text);
  white-space: pre-wrap;
}
```

- [ ] **Krok 6: Zaimplementuj renderowanie karty w `src/features/projects/ProjectDossier.tsx`**
      W pliku `src/features/projects/ProjectDossier.tsx` wstaw kartę pomiędzy pierwszym artykułem `<article className="prj-card...">` a komponentem `<ProjectSaveState>`:

Przed (linie 123–130):

```tsx
        {typeError ? (
          <p className="prj-alert" role="alert">
            {typeError}
          </p>
        ) : null}
      </article>

      <ProjectSaveState
        key={project.id}
        project={project}
        onSave={actions.saveState}
        onReload={actions.reloadDetail}
      />
```

Po:

```tsx
        {typeError ? (
          <p className="prj-alert" role="alert">
            {typeError}
          </p>
        ) : null}
      </article>

      {project.purpose !== null ? (
        <article className="prj-card prj-purpose">
          <div className="prj-card__head">
            <h3 className="prj-section-title">{t("projects:dossier.purposeTitle")}</h3>
          </div>
          <p className="prj-purpose__text">{project.purpose}</p>
        </article>
      ) : null}

      <ProjectSaveState
        key={project.id}
        project={project}
        onSave={actions.saveState}
        onReload={actions.reloadDetail}
      />
```

- [ ] **Krok 7: Uruchom testy i potwierdź, że PRZECHODZĄ**
      Uruchom polecenia:

```bash
npx vitest run tests/unit/features/projects/ProjectsView.test.tsx -t "Po co i dlaczego"
npx vitest run tests/unit/features/projects/ProjectsView.en.test.tsx -t "Why this exists"
```

Oczekiwany wynik: wszystkie testy jednostkowe i integracyjne UI są zielone (PASS).

Commit: wykonuje Claude (komunikat: `feat(projects): renderowanie sekcji Po co i dlaczego w ProjectDossier`)

---

### Task 5: Końcowa weryfikacja statyczna, testy i test architektury

**Pliki do weryfikacji:**

- Całe repozytorium (odczyt i kontrola reguł)

- [ ] **Krok 1: Weryfikacja statycznego typowania TypeScript**
      Uruchom polecenie:

```bash
npx tsc --noEmit
```

Oczekiwany wynik: 0 błędów typowania (`exit code 0`).

- [ ] **Krok 2: Weryfikacja lintera ESLint**
      Uruchom polecenie:

```bash
npm run lint
```

Oczekiwany wynik: brak naruszeń reguł lintingu (`exit code 0`).

- [ ] **Krok 3: Uruchomienie pełnego zestawu testów jednostkowych**
      Uruchom polecenie:

```bash
npx vitest run
```

Oczekiwany wynik: wszystkie testy w projekcie przechodzą pomyślnie (`exit code 0`).

- [ ] **Krok 4: Weryfikacja nienaruszalności testu architektury**
      Upewnij się, że plik `tests/unit/architecture.static.test.ts` nie został zmodyfikowany (`git status tests/unit/architecture.static.test.ts` nie wykazuje zmian), a następnie uruchom:

```bash
npx vitest run tests/unit/architecture.static.test.ts
```

Oczekiwany wynik: wszystkie reguły architektoniczne ADR-021 (brak zakazanych importów między kontekstami i warstwami) są zielone (PASS).

Brak commita w tym zadaniu (tylko weryfikacja). Wynik komend (przeszło / lista `plik:linia + przyczyna`) zgłoś Claude.
