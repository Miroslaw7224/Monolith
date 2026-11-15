# Rodzaje projektów (kolor i znacznik) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kolor i znacznik rodzaju projektu (etat = zielony, własny = niebieski, biblioteka = fioletowy) w karcie Projekty i przy zadaniach oraz tematach powiązanych z projektem w Kokpicie; `type: etat` dokłada znacznik i ostrzeżenie „Dane z firmy”.

**Architecture:** Dwie czyste reguły (`projectKind`, `hasCompanyData`) żyją w `contexts/bc_projects/services` (używa ich `bc_cockpit` przez `services`) i, z powodu reguły R3 testu architektury, powtórzone w `toSummaryDto` w `schemas.ts`; ten sam zestaw przypadków (plik `projectKindCases.ts`) pilnuje obu. DTO dostają pola `kind` i `companyData`; UI tylko je czyta. Kolory rodzajów to globalne tokeny w `src/features/cards/cards.css`.

**Tech Stack:** Next.js 14, TypeScript (`strict: false`), Vitest (+ Testing Library), CSS bez Tailwinda w kartach.

**Spec:** `docs/superpowers/specs/2026-11-15-rodzaje-projektow-design.md` (decyzje D1–D8). **Zasady repo:** `CLAUDE.md` (Struktura kodu); `tests/unit/architecture.static.test.ts` NIE jest zmieniany w tym planie (a zmiany testu architektury zawsze osobnym commitem).

**Konwencje komend:** testy `npx vitest run <ścieżka>`, typy `npx tsc --noEmit`, lint `npm run lint`, build `npm run build`. Commity kończą się linią `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Hook `lint-staged` przeformatowuje pliki prettierem przy commicie (to normalne).

---

## Mapa plików

| Plik                                                          | Zmiana                                                                                                                              |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `contexts/bc_projects/services/index.ts`                      | `projectKind`, `hasCompanyData` (eksport); `buildContextPack` używa `hasCompanyData`; `listNowTasks` dopisuje `kind`, `companyData` |
| `contexts/bc_projects/models.ts`                              | `NowTask` + `kind`, `companyData`                                                                                                   |
| `contexts/bc_projects/schemas.ts`                             | `ProjectSummaryDto` + `kind`, `companyData`; `toSummaryDto`; `PROJECT_KIND_LABELS`                                                  |
| `contexts/bc_cockpit/models.ts`                               | `ProjectKind`; `Topic`/`QueueGroup` + `kind`, `companyData`                                                                         |
| `contexts/bc_cockpit/services.ts`                             | `toTopic`, `QueueEntry`, `groupQueue`, `loadQueue` niosą rodzaj                                                                     |
| `contexts/bc_cockpit/schemas.ts`                              | `toCockpitDto` kopiuje pola                                                                                                         |
| `src/features/cards/cards.css`                                | tokeny `--kind-*`                                                                                                                   |
| `src/features/projects/projects.css`                          | pasek, znaczniki, zaznaczenie wg rodzaju                                                                                            |
| `src/features/projects/ProjectList.tsx`                       | klasa i znacznik rodzaju                                                                                                            |
| `src/features/projects/ProjectDossier.tsx`                    | pasek nagłówka, „Dane z firmy” z `title`                                                                                            |
| `src/features/projects/useProjects.ts`                        | kopiuje `kind`, `companyData` po mutacji                                                                                            |
| `src/features/projects/useContextPack.ts`, `ProjectsView.tsx` | odświeżenie paczki po zmianie `companyData`                                                                                         |
| `src/features/projects/projectTiles.ts`                       | kafelek po `kind`                                                                                                                   |
| `src/features/home/InboxMoveForm.tsx`                         | „Dane z firmy” wg `companyData`                                                                                                     |
| `src/features/home/CockpitSections.tsx`, `home.css`           | kolor i znaczniki grup i tematów                                                                                                    |
| `tests/unit/contexts/bc_projects/projectKindCases.ts`         | NOWY: wspólna tabela przypadków                                                                                                     |
| testy                                                         | zob. kolejne zadania                                                                                                                |

---

### Task 0: Gałąź robocza

**Files:** brak.

- [ ] **Step 1: Utwórz gałąź z gałęzi ze specem i planem**

Run: `git checkout docs/rodzaje-projektow-spec && git checkout -b feat/rodzaje-projektow && git status --short`
Expected: `Switched to a new branch 'feat/rodzaje-projektow'`, brak zmian w drzewie.

---

### Task 1: Reguły `projectKind` i `hasCompanyData` w serwisie

**Files:**

- Create: `tests/unit/contexts/bc_projects/projectKindCases.ts`
- Modify: `contexts/bc_projects/services/index.ts` (obok `isWorkProject`, ok. linii 337)
- Test: `tests/unit/contexts/bc_projects/services.test.ts`

- [ ] **Step 1: Utwórz wspólną tabelę przypadków**

`tests/unit/contexts/bc_projects/projectKindCases.ts`:

```ts
import type { Owner, ProjectType } from "@/contexts/bc_projects/models";

/** [owner, type, oczekiwany kind, oczekiwane companyData]: ta sama tabela pilnuje `services` i `toSummaryDto`. */
export const PROJECT_KIND_CASES: [Owner, ProjectType | undefined, ProjectType, boolean][] = [
  ["personal", undefined, "wlasny", false],
  ["work", undefined, "etat", true],
  ["personal", "etat", "etat", true],
  ["personal", "wlasny", "wlasny", false],
  ["personal", "biblioteka", "biblioteka", false],
  ["work", "wlasny", "wlasny", true],
  ["work", "biblioteka", "biblioteka", true],
];
```

- [ ] **Step 2: Napisz failujący test**

W `services.test.ts` dopisz `hasCompanyData` i `projectKind` do importu z `@/contexts/bc_projects/services` (lista na górze pliku, obok `isWorkProject`), dodaj import `import { PROJECT_KIND_CASES } from "./projectKindCases";` pod pozostałymi importami, a na końcu pliku nowy blok:

```ts
describe("projectKind i hasCompanyData", () => {
  it.each(PROJECT_KIND_CASES)(
    "owner=%s type=%s → kind=%s, companyData=%s",
    (owner, type, kind, companyData) => {
      expect(projectKind(owner, type)).toBe(kind);
      expect(hasCompanyData(owner, type)).toBe(companyData);
    }
  );

  it("isWorkProject zależy tylko od owner: type: etat nie włącza blokad (D3)", () => {
    const etatOsobisty = { owner: "personal" as const, type: "etat" as const };
    expect(isWorkProject(etatOsobisty)).toBe(false);
    expect(isWorkProject({ owner: "work" })).toBe(true);
  });
});
```

- [ ] **Step 3: Uruchom test, zobacz porażkę**

Run: `npx vitest run tests/unit/contexts/bc_projects/services.test.ts -t "projectKind"`
Expected: FAIL (`projectKind is not a function` albo błąd importu).

- [ ] **Step 4: Implementacja**

W `contexts/bc_projects/services/index.ts` dopisz `type Owner` do bloku importu z `../models` (ten, w którym jest `type ProjectType`), a pod `isWorkProject` dodaj:

```ts
/** Rodzaj projektu do koloru i znacznika: `type` z `index.md`, a gdy go brak, z `owner` (`work` → etat). */
export function projectKind(owner: Owner, type?: ProjectType): ProjectType {
  return type ?? (owner === "work" ? "etat" : "wlasny");
}

/**
 * Czy pokazywać „Dane z firmy” i ostrzeżenie w paczce: `owner: work` albo etykieta `type: etat`.
 * Nie jest to blokada: blokady (Mapa, Notatki, przyszłe AI i eksport) zostają przy `isWorkProject`
 * (tylko `owner`, spec rodzajów D3). Ta sama reguła jest w `toSummaryDto` (`schemas.ts`), bo `services`
 * nie importuje `schemas`; zgodność pilnuje wspólna tabela `projectKindCases.ts`.
 */
export function hasCompanyData(owner: Owner, type?: ProjectType): boolean {
  return owner === "work" || type === "etat";
}
```

- [ ] **Step 5: Uruchom test, zobacz sukces**

Run: `npx vitest run tests/unit/contexts/bc_projects/services.test.ts`
Expected: PASS (wszystkie testy pliku).

- [ ] **Step 6: Commit**

```bash
git add tests/unit/contexts/bc_projects/projectKindCases.ts tests/unit/contexts/bc_projects/services.test.ts contexts/bc_projects/services/index.ts
git commit -m "feat(projekty): reguły projectKind i hasCompanyData w serwisie

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `kind` i `companyData` w `ProjectSummaryDto`

**Files:**

- Modify: `contexts/bc_projects/schemas.ts` (typ `ProjectSummaryDto` ok. linii 270, `toSummaryDto` ok. linii 312)
- Test: `tests/unit/contexts/bc_projects/schemas.test.ts`
- Fixtury testowe: zob. Step 5

- [ ] **Step 1: Napisz failujący test**

W `schemas.test.ts` dodaj import `import { PROJECT_KIND_CASES } from "./projectKindCases";` i w bloku `describe("bc_projects schemas", …)` test:

```ts
it.each(PROJECT_KIND_CASES)(
  "toSummaryDto: owner=%s type=%s → kind=%s, companyData=%s",
  (owner, type, kind, companyData) => {
    const dto = toSummaryDto({ ...base, owner, ...(type ? { type } : {}) });
    expect(dto.kind).toBe(kind);
    expect(dto.companyData).toBe(companyData);
  }
);
```

- [ ] **Step 2: Uruchom, zobacz porażkę**

Run: `npx vitest run tests/unit/contexts/bc_projects/schemas.test.ts -t "toSummaryDto: owner"`
Expected: FAIL (`dto.kind` jest `undefined`).

- [ ] **Step 3: Implementacja w `schemas.ts`**

W typie `ProjectSummaryDto` po `type?: ProjectType;` dopisz:

```ts
/** Rodzaj do koloru i znacznika: `type`, a bez niego z `owner` (spec rodzajów D2). */
kind: ProjectType;
/** `owner: work` albo `type: etat`: znacznik „Dane z firmy” (spec rodzajów D4). */
companyData: boolean;
```

W `toSummaryDto` do literału `const dto: ProjectSummaryDto = { … }` dopisz po `freshness: p.freshness,`:

```ts
    // Ta sama reguła co `projectKind` i `hasCompanyData` w `services` (R3: `schemas` nie importuje ich); pilnuje `projectKindCases.ts`.
    kind: p.type ?? (p.owner === "work" ? "etat" : "wlasny"),
    companyData: p.owner === "work" || p.type === "etat",
```

Pod `export type { ContextPackRole, Owner, ProjectType };` nie zmieniaj nic. Na końcu bloku DTO (np. pod `toSummaryDto`) dodaj stałą etykiet:

```ts
/** Etykiety rodzajów w UI (karta Projekty, Kokpit). */
export const PROJECT_KIND_LABELS: Record<ProjectType, string> = {
  etat: "Etat",
  wlasny: "Własny",
  biblioteka: "Biblioteka",
};
```

- [ ] **Step 4: Uruchom test, zobacz sukces**

Run: `npx vitest run tests/unit/contexts/bc_projects/schemas.test.ts`
Expected: PASS.

- [ ] **Step 5: Napraw fixtury, które typ teraz wymaga**

Run: `npx tsc --noEmit 2>&1 | head -60`
Expected: lista błędów „missing properties `kind`, `companyData`” w testach. Napraw każdy zgodnie z regułą: w helperach buduj pola z `type`/`owner`, w literałach dopisz `kind: "wlasny", companyData: false`. Trzy znane helpery (`summary()` w `ProjectsView.test.tsx`, `p()` w `projectTiles.test.ts`, a w `useProjects.test.tsx` fabryka z linii ok. 16) zmień tak:

```ts
function summary(
  partial: Partial<ProjectSummaryDto> & Pick<ProjectSummaryDto, "id">
): ProjectSummaryDto {
  const owner = partial.owner ?? "personal";
  return {
    name: partial.id,
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
```

(w `projectTiles.test.ts` ten sam kształt pod nazwą `p`; w `useProjects.test.tsx` dopasuj do tamtejszej fabryki). Pozostałe pliki z listy tsc (`ProjectLinks.test.tsx`, `ProjectSaveState.test.tsx`, `ProjectTasksBoard.test.tsx`) dostają `kind: "wlasny", companyData: false` w literale.
Powtarzaj `npx tsc --noEmit`, aż nie będzie błędów dotyczących `kind`/`companyData` (błędy z `bc_cockpit` i `home` pojawią się dopiero w Task 5; jeśli tsc zgłasza coś poza zakresem tego zadania, odłóż do właściwego zadania).

- [ ] **Step 6: Testy projektów**

Run: `npx vitest run tests/unit/contexts/bc_projects tests/unit/features/projects`
Expected: PASS. Jeśli pada test sprawdzający asercję `getByText("Firma")` albo kafelek „bez typu” (Task 6 i 8 je poprawiają), zapisz które i przejdź dalej; po Task 8 wszystko ma być zielone.

- [ ] **Step 7: Commit**

```bash
git add contexts/bc_projects/schemas.ts tests/unit
git commit -m "feat(projekty): pola kind i companyData w ProjectSummaryDto

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Ostrzeżenie w paczce kontekstu wg `hasCompanyData`

**Files:**

- Modify: `contexts/bc_projects/services/index.ts` (`buildContextPack`, ok. linii 353)
- Test: `tests/unit/contexts/bc_projects/services.context-pack.test.ts` (pod testem „owner work: ostrzeżenie jest pierwsze…”, ok. linii 94–104)

- [ ] **Step 1: Napisz failujący test**

```ts
it.each([
  ["personal", "etat", true],
  ["personal", "wlasny", false],
  ["personal", undefined, false],
  ["work", undefined, true],
  ["work", "wlasny", true],
  ["work", "biblioteka", true],
] as const)("ostrzeżenie „Dane z firmy”: owner=%s type=%s → %s", (owner, type, expected) => {
  mockReadRegistry.mockReturnValue({ entries: [{ ...entry, owner }], warnings: [] });
  mockReadProjectIndex.mockReturnValue({
    whereIStopped: null,
    lastWorked: "2026-11-01",
    ...(type ? { type } : {}),
  });
  const pack = buildContextPack("a", TODAY);
  expect(pack.warnings.includes(OWNER_WORK_WARNING)).toBe(expected);
  if (expected) expect(pack.warnings[0]).toBe(OWNER_WORK_WARNING);
});
```

- [ ] **Step 2: Uruchom, zobacz porażkę**

Run: `npx vitest run tests/unit/contexts/bc_projects/services.context-pack.test.ts -t "Dane z firmy"`
Expected: FAIL dla `personal` + `etat` (brak ostrzeżenia).

- [ ] **Step 3: Implementacja**

W `buildContextPack` zmień linię

```ts
const warnings: string[] = isWorkProject(entry) ? [OWNER_WORK_WARNING] : [];
```

na

```ts
const warnings: string[] = hasCompanyData(entry.owner, project.type) ? [OWNER_WORK_WARNING] : [];
```

- [ ] **Step 4: Uruchom, zobacz sukces**

Run: `npx vitest run tests/unit/contexts/bc_projects`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add contexts/bc_projects/services/index.ts tests/unit/contexts/bc_projects/services.context-pack.test.ts
git commit -m "feat(projekty): ostrzeżenie Dane z firmy w paczce także dla type: etat

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `kind` i `companyData` w `NowTask` (`listNowTasks`)

**Files:**

- Modify: `contexts/bc_projects/models.ts` (`NowTask`, ok. linii 126)
- Modify: `contexts/bc_projects/services/index.ts` (`listNowTasks`, ok. linii 164)
- Test: `tests/unit/contexts/bc_projects/services.test.ts` (test „zbiera niezakończone zadania Teraz…”, ok. linii 593)

- [ ] **Step 1: Zmień istniejący test i dodaj nowe (failujące)**

Zastąp wskazany test:

```ts
it("zbiera niezakończone zadania Teraz ze wszystkich projektów razem z nazwą, owner i rodzajem", () => {
  mockReadRegistry.mockReturnValue({
    entries: [
      entry({ id: "nexus", name: "NEXUS" }),
      entry({ id: "firma", name: "Firma", owner: "work" }),
    ],
    warnings: [],
  });
  mockReadProjectIndex.mockReturnValue({ whereIStopped: null });
  mockReadProjectBoard.mockImplementation((e: RegistryEntry) =>
    e.id === "nexus"
      ? board([{ text: "Plan 2-1", done: false }])
      : board([{ text: "Raport", done: false }])
  );

  const { tasks, warnings } = listNowTasks();

  expect(tasks).toEqual([
    {
      projectId: "nexus",
      projectName: "NEXUS",
      owner: "personal",
      kind: "wlasny",
      companyData: false,
      priority: "medium",
      text: "Plan 2-1",
      occurrence: 0,
    },
    {
      projectId: "firma",
      projectName: "Firma",
      owner: "work",
      kind: "etat",
      companyData: true,
      priority: "medium",
      text: "Raport",
      occurrence: 0,
    },
  ]);
  expect(warnings).toEqual([]);
});

it("rodzaj zadania z `type` w index.md: personal + etat → etat i Dane z firmy", () => {
  mockReadRegistry.mockReturnValue({ entries: [entry({ id: "a" })], warnings: [] });
  mockReadProjectIndex.mockReturnValue({ whereIStopped: null, type: "etat" });
  mockReadProjectBoard.mockReturnValue(board([{ text: "Zadanie", done: false }]));

  const { tasks } = listNowTasks();

  expect(tasks[0]).toMatchObject({ kind: "etat", companyData: true, owner: "personal" });
});

it("uszkodzony index.md nie przerywa listy: rodzaj z samego owner", () => {
  mockReadRegistry.mockReturnValue({
    entries: [entry({ id: "a", owner: "work" })],
    warnings: [],
  });
  mockReadProjectIndex.mockImplementation(() => {
    throw new Error("zepsuty frontmatter");
  });
  mockReadProjectBoard.mockReturnValue(board([{ text: "Zadanie", done: false }]));

  const { tasks, warnings } = listNowTasks();

  expect(tasks[0]).toMatchObject({ kind: "etat", companyData: true });
  expect(warnings).toEqual([]);
});
```

- [ ] **Step 2: Uruchom, zobacz porażkę**

Run: `npx vitest run tests/unit/contexts/bc_projects/services.test.ts -t "zadania Teraz|rodzaj zadania|uszkodzony index"`
Expected: FAIL (brak pól `kind`, `companyData`).

- [ ] **Step 3: Implementacja**

W `models.ts` w `NowTask` po `owner: Owner;` dopisz:

```ts
/** Rodzaj projektu do koloru w Kokpicie (`type` z `index.md`, a bez niego z `owner`). */
kind: ProjectType;
/** `owner: work` albo `type: etat` (znacznik „Dane z firmy”). */
companyData: boolean;
```

W `services/index.ts`, nad `listNowTasks`, dodaj:

```ts
/** `type` z `index.md` projektu; błąd odczytu indeksu nie przerywa listy zadań (rodzaj wtedy z samego `owner`). */
function typeOf(entry: RegistryEntry): ProjectType | undefined {
  try {
    return readProjectIndex(entry).type;
  } catch {
    return undefined;
  }
}
```

W `listNowTasks`, w pętli `for (const entry of entries) { try {` tuż po `const seen = new Map<string, number>();` dodaj `const type = typeOf(entry);`, a w `tasks.push({ … })` po `owner: entry.owner,` dopisz:

```ts
          kind: projectKind(entry.owner, type),
          companyData: hasCompanyData(entry.owner, type),
```

- [ ] **Step 3b: Zaktualizuj literały `NowTask` w testach**

Run: `npx tsc --noEmit 2>&1 | grep -i "NowTask\|kind\|companyData" | head -20`
Literały NowTask w `tests/unit/contexts/bc_cockpit/services.test.ts` (mocki `listNowTasks`, wiele miejsc) nie są sprawdzane typami (zwracają `unknown` przez `vi.fn`), więc nic nie trzeba zmieniać; zmiany tam robi Task 5 tylko tam, gdzie test dotyczy rodzaju.

- [ ] **Step 4: Uruchom, zobacz sukces**

Run: `npx vitest run tests/unit/contexts/bc_projects`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add contexts/bc_projects/models.ts contexts/bc_projects/services/index.ts tests/unit/contexts/bc_projects/services.test.ts
git commit -m "feat(projekty): NowTask niesie kind i companyData

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Rodzaj w tematach i grupach kolejki (`bc_cockpit`)

**Files:**

- Modify: `contexts/bc_cockpit/models.ts` (`Topic` ok. linii 14, `QueueGroup` ok. linii 59)
- Modify: `contexts/bc_cockpit/services.ts` (`toTopic` ok. 55, `QueueEntry` ok. 129, `groupQueue` ok. 143, `loadQueue` ok. 163)
- Modify: `contexts/bc_cockpit/schemas.ts` (`toCockpitDto` ok. 63–112)
- Test: `tests/unit/contexts/bc_cockpit/services.test.ts`, `tests/unit/contexts/bc_cockpit/schemas.test.ts`

- [ ] **Step 1: Mock `bc_projects/services` w teście serwisu**

W `tests/unit/contexts/bc_cockpit/services.test.ts`, w fabryce `vi.mock("@/contexts/bc_projects/services", () => ({ … }))` dopisz (po `rewriteNowTask: mockRewriteNowTask,`):

```ts
  projectKind: (owner: string, type?: string) => type ?? (owner === "work" ? "etat" : "wlasny"),
  hasCompanyData: (owner: string, type?: string) => owner === "work" || type === "etat",
```

- [ ] **Step 2: Napisz failujące testy serwisu**

W `services.test.ts` zmień oczekiwanie w teście „ze state.md: nextStep i blocker…” (ok. linii 138–157): w obiekcie tematu po `owner: "personal",` dopisz `kind: "wlasny", companyData: false,`. Następnie w bloku `describe("tematy: dane do karty skupienia", …)` dodaj:

```ts
it("temat niesie rodzaj: type: etat przy owner personal → etat i Dane z firmy", async () => {
  mockGetProject.mockReturnValue(project({ type: "etat" }));
  const { topics } = await getCockpit(TODAY);
  expect(topics[0]).toMatchObject({ kind: "etat", companyData: true, owner: "personal" });
});

it("temat owner work bez type → etat", async () => {
  mockGetProject.mockReturnValue(project({ owner: "work" }));
  const { topics } = await getCockpit(TODAY);
  expect(topics[0]).toMatchObject({ kind: "etat", companyData: true });
});
```

oraz nowy blok na końcu pliku:

```ts
describe("kolejka: rodzaj grupy (D8)", () => {
  const nowTask = (over: Record<string, unknown> = {}) => ({
    projectId: "p",
    projectName: "P",
    owner: "personal",
    kind: "biblioteka",
    companyData: false,
    priority: "high",
    text: "Zadanie",
    occurrence: 0,
    ...over,
  });

  it("grupa projektowa niesie kind i companyData z NowTask, grupa ogólna ich nie ma", async () => {
    mockListNowTasks.mockReturnValue({ tasks: [nowTask()], warnings: [] });
    mockGetTasks.mockResolvedValue([task({ title: "Ogólne zadanie" })]);
    const { queue } = await getCockpit(TODAY);
    const project = queue.find((g) => g.projectId === "p");
    const general = queue.find((g) => g.projectId === null);
    expect(project).toMatchObject({ kind: "biblioteka", companyData: false });
    expect(general).toBeDefined();
    expect("kind" in general!).toBe(false);
    expect("companyData" in general!).toBe(false);
  });
});
```

- [ ] **Step 3: Uruchom, zobacz porażkę**

Run: `npx vitest run tests/unit/contexts/bc_cockpit/services.test.ts`
Expected: FAIL w trzech nowych/zmienionych testach.

- [ ] **Step 4: Implementacja modeli**

W `contexts/bc_cockpit/models.ts` pod `export type Owner = …;` dodaj:

```ts
/** Rodzaj projektu (etykieta z `index.md` albo z `owner`), do koloru w Kokpicie; zob. spec rodzajów projektów. */
export type ProjectKind = "etat" | "wlasny" | "biblioteka";
```

W `Topic` po `owner: Owner;` dopisz `kind: ProjectKind; companyData: boolean;`. W `QueueGroup` po `owner: Owner;` dopisz:

```ts
  /** Tylko grupy projektowe; grupa ogólna (`projectId: null`) nie ma rodzaju (brak koloru). */
  kind?: ProjectKind;
  companyData?: boolean;
```

- [ ] **Step 5: Implementacja serwisu**

W `services.ts`: dopisz `type ProjectKind` do istniejącego importu z `./models` (obok `type Owner`). W `toTopic` po `owner: p.owner,`:

```ts
    kind: projectsServices.projectKind(p.owner, p.type),
    companyData: projectsServices.hasCompanyData(p.owner, p.type),
```

`QueueEntry`:

```ts
type QueueEntry = {
  projectId: string | null;
  name: string;
  owner: Owner;
  kind?: ProjectKind;
  companyData?: boolean;
  item: QueueItem;
};
```

W `groupQueue` zastąp tworzenie grupy:

```ts
group = {
  projectId: entry.projectId,
  name: entry.name,
  owner: entry.owner,
  ...(entry.kind !== undefined
    ? { kind: entry.kind, companyData: entry.companyData ?? false }
    : {}),
  items: [],
};
```

W `loadQueue`, w `entries.push({ … })` dla zadań projektów po `owner: t.owner,` dopisz `kind: t.kind, companyData: t.companyData,`. Wpis zadań ogólnych (z `owner: "personal"`) nie zmienia się.

- [ ] **Step 6: Implementacja DTO i test schemas**

W `schemas.ts` w `toCockpitDto`: w `topics: c.topics.map((t) => ({ … }))` po `owner: t.owner,` dopisz `kind: t.kind, companyData: t.companyData,`; w `queue: c.queue.map((g) => ({ … }))` po `owner: g.owner,`:

```ts
      ...(g.kind !== undefined ? { kind: g.kind, companyData: g.companyData ?? false } : {}),
```

W `tests/unit/contexts/bc_cockpit/schemas.test.ts` w `const model: Cockpit` zaktualizuj temat (po `owner: "personal",` dopisz `kind: "wlasny", companyData: false,`) i dodaj do `queue` drugą grupę przed grupą ogólną:

```ts
      {
        projectId: "nexus",
        name: "NEXUS",
        owner: "personal",
        kind: "etat",
        companyData: true,
        items: [],
      },
```

(test `toCockpitDto zachowuje kształt…` wymaga `expect(dto).toEqual(model)`, więc zweryfikuje kopiowanie pól).

- [ ] **Step 7: Uruchom, zobacz sukces**

Run: `npx vitest run tests/unit/contexts/bc_cockpit tests/unit/architecture.static.test.ts`
Expected: PASS (testy architektury bez zmian i zielone: `bc_cockpit` woła tylko `services` kontekstu projektów).

- [ ] **Step 8: Commit**

```bash
git add contexts/bc_cockpit tests/unit/contexts/bc_cockpit
git commit -m "feat(kokpit): tematy i grupy kolejki niosą rodzaj projektu

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Tokeny kolorów i karta Projekty (lista, teczka)

**Files:**

- Modify: `src/features/cards/cards.css` (`:root`)
- Modify: `src/features/projects/projects.css`
- Modify: `src/features/projects/ProjectList.tsx`
- Modify: `src/features/projects/ProjectDossier.tsx`
- Test: `tests/unit/features/projects/ProjectsView.test.tsx`

- [ ] **Step 1: Napisz failujące testy**

W `ProjectsView.test.tsx` na końcu pliku dopisz:

```tsx
describe("ProjectsView: rodzaj projektu", () => {
  it("lista: klasa i znacznik rodzaju; żółty „Firma” tylko przy owner work", async () => {
    const list = [
      summary({ id: "e", type: "etat" }),
      summary({ id: "w" }),
      summary({ id: "b", type: "biblioteka" }),
      summary({ id: "ew", owner: "work" }),
      summary({ id: "wf", owner: "work", type: "wlasny" }),
    ];
    const apiFetch = makeApiFetch(list, Object.fromEntries(list.map((p) => [p.id, detail(p)])));
    render(<ProjectsView apiFetch={apiFetch} />);
    await screen.findByText("e", { selector: ".prj-item__name" });

    expect(itemButton("e")).toHaveClass("prj-item--kind-etat");
    expect(within(itemButton("e")).getByText("Etat")).toBeInTheDocument();
    expect(within(itemButton("e")).queryByText("Firma")).not.toBeInTheDocument();

    expect(itemButton("w")).toHaveClass("prj-item--kind-wlasny");
    expect(within(itemButton("w")).getByText("Własny")).toBeInTheDocument();

    expect(itemButton("b")).toHaveClass("prj-item--kind-biblioteka");
    expect(within(itemButton("b")).getByText("Biblioteka")).toBeInTheDocument();

    expect(itemButton("ew")).toHaveClass("prj-item--kind-etat");
    expect(within(itemButton("ew")).getByText("Etat")).toBeInTheDocument();
    expect(within(itemButton("ew")).getByText("Firma")).toBeInTheDocument();

    expect(itemButton("wf")).toHaveClass("prj-item--kind-wlasny");
    expect(within(itemButton("wf")).getByText("Własny")).toBeInTheDocument();
    expect(within(itemButton("wf")).getByText("Firma")).toBeInTheDocument();
  });

  it("teczka: „Dane z firmy” z podpowiedzią wg powodu i pasek rodzaju", async () => {
    const etat = summary({ id: "e", type: "etat" });
    const work = summary({ id: "w", owner: "work" });
    const apiFetch = makeApiFetch([etat, work], { e: detail(etat), w: detail(work) });
    render(<ProjectsView apiFetch={apiFetch} />);
    await screen.findByText("e", { selector: ".prj-item__name" });

    await userEvent.click(itemMain("e"));
    const etatCard = await screen.findByRole("region", { name: "Teczka projektu e" });
    expect(within(etatCard).getByText("Dane z firmy")).toHaveAttribute(
      "title",
      expect.stringContaining("Etykieta")
    );
    expect(etatCard.querySelector(".prj-card--kind-etat")).not.toBeNull();

    await userEvent.click(itemMain("w"));
    const workCard = await screen.findByRole("region", { name: "Teczka projektu w" });
    expect(within(workCard).getByText("Dane z firmy")).toHaveAttribute(
      "title",
      expect.stringContaining("Chronione")
    );
  });
});
```

- [ ] **Step 2: Uruchom, zobacz porażkę**

Run: `npx vitest run tests/unit/features/projects/ProjectsView.test.tsx -t "rodzaj projektu"`
Expected: FAIL (brak klas i znaczników).

- [ ] **Step 3: Tokeny w `cards.css`**

W bloku `:root { … }` po `--c-kodeks: #3ddc84;` dopisz:

```css
/* Rodzaje projektów (etat / własny / biblioteka): stałe, niezależne od `--accent` karty. */
--kind-etat: #34d399;
--kind-wlasny: #3d95ff;
--kind-biblioteka: #a78bfa;
```

- [ ] **Step 4: `ProjectList.tsx`**

Zmień import: `import type { ProjectStatusChangeDto, ProjectSummaryDto } from "@/contexts/bc_projects/schemas";` na

```tsx
import { PROJECT_KIND_LABELS } from "@/contexts/bc_projects/schemas";
import type { ProjectStatusChangeDto, ProjectSummaryDto } from "@/contexts/bc_projects/schemas";
```

Pod `const classes = ["prj-item"];` dopisz `if (project.kind) classes.push(\`prj-item--kind-${project.kind}\`);` i w rzędzie znaczników przed blokiem „Firma”:

```tsx
{
  project.kind ? (
    <span className={`prj-badge prj-badge--kind-${project.kind}`}>
      {PROJECT_KIND_LABELS[project.kind]}
    </span>
  ) : null;
}
```

(blok `project.owner === "work" ? <span className="prj-badge prj-badge--firm">Firma</span>` zostaje bez zmian, D5).

- [ ] **Step 5: `ProjectDossier.tsx`**

Nad funkcją komponentu dodaj stałe:

```tsx
const COMPANY_TITLE_PROTECTED = "Chronione: owner: work w rejestrze";
const COMPANY_TITLE_LABEL =
  "Etykieta z typu Etat; ochronę (Mapa, Notatki, przyszłe AI i eksport) włącza owner: work w rejestrze";
```

Zastąp otwarcie nagłówka (unikalny fragment):

```tsx
    <section className="prj-main" aria-label={`Teczka projektu ${project.name}`}>
      <article className="prj-card">
        <div className="prj-card__head">
```

na

```tsx
    <section className="prj-main" aria-label={`Teczka projektu ${project.name}`}>
      <article
        className={`prj-card${project.kind ? ` prj-card--kind prj-card--kind-${project.kind}` : ""}`}
      >
        <div className="prj-card__head">
```

i blok znacznika:

```tsx
{
  project.owner === "work" ? <span className="prj-card__owner">Dane z firmy</span> : null;
}
```

na

```tsx
{
  project.companyData ? (
    <span
      className="prj-card__owner"
      title={project.owner === "work" ? COMPANY_TITLE_PROTECTED : COMPANY_TITLE_LABEL}
    >
      Dane z firmy
    </span>
  ) : null;
}
```

- [ ] **Step 6: `projects.css`**

Zastąp regułę zaznaczenia:

```css
.prj-item--sel {
  border-color: var(--prj-kind, var(--accent));
  box-shadow:
    0 0 0 1px var(--prj-kind, var(--accent)),
    0 0 18px -4px var(--glow);
  background: color-mix(in srgb, var(--surface-2) 90%, var(--accent-soft));
}
```

i dopisz za `.prj-item--done { … }`:

```css
/* Rodzaj projektu: pasek po lewej (::before, żeby nie kolidował z ramką zaznaczenia i alertem „>14 dni”). */
.prj-item {
  position: relative;
}

.prj-item::before {
  content: "";
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 3px;
  border-radius: 0 2px 2px 0;
  background: var(--prj-kind, transparent);
}

.prj-item--kind-etat,
.prj-card--kind-etat {
  --prj-kind: var(--kind-etat);
}

.prj-item--kind-wlasny,
.prj-card--kind-wlasny {
  --prj-kind: var(--kind-wlasny);
}

.prj-item--kind-biblioteka,
.prj-card--kind-biblioteka {
  --prj-kind: var(--kind-biblioteka);
}

.prj-card--kind {
  border-left: 4px solid var(--prj-kind);
}

.prj-badge--kind-etat,
.prj-badge--kind-wlasny,
.prj-badge--kind-biblioteka {
  font-weight: 700;
}

.prj-badge--kind-etat {
  border-color: var(--kind-etat);
  color: var(--kind-etat);
}

.prj-badge--kind-wlasny {
  border-color: var(--kind-wlasny);
  color: var(--kind-wlasny);
}

.prj-badge--kind-biblioteka {
  border-color: var(--kind-biblioteka);
  color: var(--kind-biblioteka);
}
```

- [ ] **Step 7: Uruchom, zobacz sukces**

Run: `npx vitest run tests/unit/features/projects/ProjectsView.test.tsx`
Expected: PASS (w tym istniejący test z asercją `getByText("Firma")` dla `owner: work`: obok „Firma” jest teraz też „Etat”, ale `getByText("Firma")` szuka dokładnego tekstu, więc nadal jednoznaczne).

- [ ] **Step 8: Commit**

```bash
git add src/features/cards/cards.css src/features/projects tests/unit/features/projects/ProjectsView.test.tsx
git commit -m "feat(projekty): kolor i znacznik rodzaju w liście rejestru i teczce

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Odświeżanie listy i paczki po zmianie rodzaju

**Files:**

- Modify: `src/features/projects/useProjects.ts` (mutacja, ok. linii 98–109)
- Modify: `src/features/projects/useContextPack.ts` (sygnatura i efekt)
- Modify: `src/features/projects/ProjectsView.tsx` (ok. linii 53)
- Test: `tests/unit/features/projects/ProjectsView.test.tsx` (w `makeRwApiFetch` i nowy test)

- [ ] **Step 1: Failujący test i serwer testowy liczący `kind`**

W `makeRwApiFetch` zastąp obsługę PATCH:

```ts
if (url === "/api/projects/a" && method === "PATCH") {
  if (patchResponse) return patchResponse;
  const type = JSON.parse(String(options?.body)).type;
  current = {
    ...current,
    type,
    kind: type,
    companyData: type === "etat" || current.owner === "work",
  };
  return new Response(JSON.stringify(current), { status: 200 });
}
```

W bloku `describe("ProjectsView: rodzaj projektu", …)` (z Task 6) dopisz:

```tsx
it("zmiana rodzaju w teczce odświeża kolor listy, nagłówek, znaczniki i paczkę", async () => {
  const apiFetch = makeRwApiFetch(detail({ id: "a" }));
  render(<ProjectsView apiFetch={apiFetch} />);
  await screen.findByRole("region", { name: "Teczka projektu a" });
  expect(itemButton("a")).toHaveClass("prj-item--kind-wlasny");
  const packCalls = () =>
    apiFetch.mock.calls.filter(([url]) => String(url).endsWith("/context-pack")).length;
  await waitFor(() => expect(packCalls()).toBeGreaterThan(0));
  const before = packCalls();

  await userEvent.selectOptions(screen.getByLabelText("Typ projektu"), "etat");

  await waitFor(() => expect(itemButton("a")).toHaveClass("prj-item--kind-etat"));
  const card = screen.getByRole("region", { name: "Teczka projektu a" });
  expect(within(card).getByText("Dane z firmy")).toBeInTheDocument();
  expect(card.querySelector(".prj-card--kind-etat")).not.toBeNull();
  await waitFor(() => expect(packCalls()).toBeGreaterThan(before));
});
```

- [ ] **Step 2: Uruchom, zobacz porażkę**

Run: `npx vitest run tests/unit/features/projects/ProjectsView.test.tsx -t "zmiana rodzaju"`
Expected: FAIL (lista zostaje `prj-item--kind-wlasny`).

- [ ] **Step 3: `useProjects.ts`**

W kopiowaniu elementu listy po `...(updated.type !== undefined ? { type: updated.type } : {}),` dopisz:

```ts
                  kind: updated.kind,
                  companyData: updated.companyData,
```

- [ ] **Step 4: `useContextPack.ts` i `ProjectsView.tsx`**

Sygnatura: dodaj trzeci, opcjonalny parametr:

```ts
export function useContextPack(
  projectId: string | null,
  load: (role: ContextPackRole) => Promise<ContextPackResult>,
  /** Zmiana wartości przeładowuje paczkę (np. `companyData` po zmianie rodzaju: zmienia się `warnings`). */
  refreshKey?: unknown
): {
```

i w zależnościach efektu ładującego paczkę (`}, [projectId, load, role]);`) zmień na `}, [projectId, load, role, refreshKey]);`. W `ProjectsView.tsx` zmień `useContextPack(detail?.id ?? null, loadContextPack)` na

```tsx
const pack = useContextPack(detail?.id ?? null, loadContextPack, detail?.companyData);
```

- [ ] **Step 5: Uruchom, zobacz sukces**

Run: `npx vitest run tests/unit/features/projects`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/projects tests/unit/features/projects
git commit -m "feat(projekty): zmiana rodzaju odświeża listę i paczkę kontekstu

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Kafelek „N własne · N etat” po `kind`

**Files:**

- Modify: `src/features/projects/projectTiles.ts` (ok. linii 15–19 i 55–61)
- Test: `tests/unit/features/projects/projectTiles.test.ts` (ok. linii 31–48)

- [ ] **Step 1: Zmień test (failujący)**

Zastąp test:

```ts
it("aktywne projekty: liczy status active (bez wielkości liter) i rozbija po rodzaju", () => {
  const tiles = buildProjectTiles(
    [
      p({ id: "a", type: "wlasny" }),
      p({ id: "b", status: "Active", type: "wlasny" }),
      p({ id: "c", type: "biblioteka" }),
      p({ id: "d", status: "done", type: "wlasny" }),
      p({ id: "e" }),
      p({ id: "f", owner: "work" }),
    ],
    null
  );
  expect(tiles[0]).toMatchObject({
    id: "active",
    value: "5",
    meta: "3 własne · 1 biblioteka · 1 etat",
  });
});
```

W helperze `p()` tego pliku zastosuj wersję z Task 2 Step 5 (`kind` i `companyData` wyliczane z `owner`/`type`), jeśli jeszcze jej nie ma.

- [ ] **Step 2: Uruchom, zobacz porażkę**

Run: `npx vitest run tests/unit/features/projects/projectTiles.test.ts`
Expected: FAIL (aktualnie „2 własne · 1 biblioteka · 1 etat · 2 bez typu” lub podobnie).

- [ ] **Step 3: Implementacja**

W `projectTiles.ts` zastąp `TYPE_LABELS` i wyliczenie:

```ts
const KIND_LABELS: [ProjectSummaryDto["kind"], string][] = [
  ["wlasny", "własne"],
  ["biblioteka", "biblioteka"],
  ["etat", "etat"],
];
```

```ts
const kindParts = KIND_LABELS.map(
  ([kind, label]) => [active.filter((p) => p.kind === kind).length, label] as const
);
const parts = kindParts.filter(([n]) => n > 0).map(([n, label]) => `${n} ${label}`);
```

(usuń `const untyped …` i `if (untyped > 0) parts.push(…)`).

- [ ] **Step 4: Uruchom, zobacz sukces**

Run: `npx vitest run tests/unit/features/projects`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/projects/projectTiles.ts tests/unit/features/projects/projectTiles.test.ts
git commit -m "feat(projekty): kafelek aktywnych projektów liczy po rodzaju

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: „Dane z firmy” w oknie „Przenieś do…”

**Files:**

- Modify: `src/features/home/InboxMoveForm.tsx` (typ `ProjectOption` linia 13, znacznik ok. linii 94)
- Test: `tests/unit/features/home/HomeView.test.tsx` (mock `/api/projects` ok. linii 237–242, test ok. linii 911)

- [ ] **Step 1: Zmień mock i dodaj test (failujący)**

W mocku `/api/projects` zastąp listę:

```ts
          projects: [
            { id: "nexus", name: "NEXUS", status: "active", owner: "personal" },
            {
              id: "firma",
              name: "Projekt firmowy",
              status: "active",
              owner: "work",
              companyData: true,
            },
            {
              id: "etatowy",
              name: "Projekt etatowy",
              status: "active",
              owner: "personal",
              companyData: true,
            },
            { id: "monolith", name: "Monolith", status: "active", owner: "personal" },
            { id: "inny", name: "Inny", status: "active", owner: "personal" },
          ],
```

Pod testem „projekt i kolumna Backlog: ciało move; projekt z firmy pokazuje „Dane z firmy”” dodaj:

```tsx
test("projekt z type: etat przy owner personal też pokazuje „Dane z firmy”", async () => {
  const dialog = await openEntry("Code Sensei: pusty stan listy");
  const select = await within(dialog).findByLabelText("Projekt");
  await within(dialog).findByRole("option", { name: "Projekt etatowy" });
  fireEvent.change(select, { target: { value: "etatowy" } });
  expect(within(dialog).getByText("Dane z firmy")).toBeInTheDocument();
});
```

- [ ] **Step 2: Uruchom, zobacz porażkę**

Run: `npx vitest run tests/unit/features/home/HomeView.test.tsx -t "Dane z firmy"`
Expected: FAIL w nowym teście (znacznik zależy jeszcze od `owner`).

- [ ] **Step 3: Implementacja**

`type ProjectOption = { id: string; name: string; owner?: "personal" | "work"; companyData?: boolean };` oraz `{selected?.owner === "work" ? (` → `{selected?.companyData ? (`.

- [ ] **Step 4: Uruchom, zobacz sukces**

Run: `npx vitest run tests/unit/features/home/HomeView.test.tsx`
Expected: PASS. Jeśli któryś inny test zlicza opcje listy projektów (dodany „Projekt etatowy”), zaktualizuj jego oczekiwaną liczbę o 1.

- [ ] **Step 5: Commit**

```bash
git add src/features/home/InboxMoveForm.tsx tests/unit/features/home/HomeView.test.tsx
git commit -m "feat(inbox): Dane z firmy w oknie Przenieś do… wg companyData

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Kolor i znaczniki w Kokpicie (grupy kolejki i tematy)

**Files:**

- Modify: `src/features/home/CockpitSections.tsx` (temat ok. linii 66–86, grupa ok. linii 166–182)
- Modify: `src/features/home/home.css`
- Test: `tests/unit/features/home/HomeView.test.tsx` (fixtura `FULL`, test ok. linii 280)

- [ ] **Step 1: Zaktualizuj fixturę `FULL` i dodaj test (failujący)**

W `FULL`: w temacie `nexus` po `owner: "personal",` dopisz `kind: "wlasny", companyData: false,`; w temacie `firma` po `owner: "work",` dopisz `kind: "etat", companyData: true,`; w grupie kolejki `firma` (ok. linii 83–85) po `owner: "work",` dopisz `kind: "etat", companyData: true,`. W teście „znacznik „Dane z firmy” przy temacie i grupie kolejki…” asercja `toHaveLength(2)` zostaje (jeden na temat, jeden na grupę). Dodaj test:

```tsx
test("kolor rodzaju: temat i grupa projektu mają modyfikator i znacznik, grupa ogólna nie", async () => {
  respond(FULL);
  render(<HomeView {...defaultProps} />);
  await screen.findByText("NEXUS");

  expect(screen.getByRole("article", { name: "Temat Projekt firmowy" })).toHaveClass(
    "kok-topic--kind-etat"
  );
  expect(screen.getByRole("article", { name: "Temat NEXUS" })).toHaveClass(
    "kok-topic--kind-wlasny"
  );

  const firma = screen.getByRole("region", { name: "Kolejka: Projekt firmowy" });
  expect(firma).toHaveClass("kok-group--kind-etat");
  expect(within(firma).getByText("Etat")).toBeInTheDocument();

  const ogolne = screen.getByRole("region", { name: "Kolejka: Ogólne" });
  expect(ogolne.className).not.toMatch(/kind/);
});
```

- [ ] **Step 2: Uruchom, zobacz porażkę**

Run: `npx vitest run tests/unit/features/home/HomeView.test.tsx -t "kolor rodzaju|Dane z firmy"`
Expected: FAIL (brak klas; „Dane z firmy” nadal po `owner`, więc test „znacznik” może przejść, a nowy nie).

- [ ] **Step 3: `CockpitSections.tsx`**

Dodaj import (obok istniejących importów z kontekstów): `import { PROJECT_KIND_LABELS } from "@/contexts/bc_projects/schemas";`.

Temat: zmień `className` artykułu na

```tsx
      className={`kok-topic kok-panel${lead ? " kok-topic--lead" : ""}${
        topic.kind ? ` kok-topic--kind kok-topic--kind-${topic.kind}` : ""
      }`}
```

oraz blok znaczników:

```tsx
{
  topic.owner === "work" ? (
    <span className="kok-badge kok-badge--warn">Dane z firmy</span>
  ) : (
    <span className="kok-badge">własny</span>
  );
}
```

na

```tsx
{
  topic.kind ? (
    <span className={`kok-badge kok-badge--kind-${topic.kind}`}>
      {PROJECT_KIND_LABELS[topic.kind]}
    </span>
  ) : null;
}
{
  topic.companyData ? <span className="kok-badge kok-badge--warn">Dane z firmy</span> : null;
}
```

Grupa: zastąp `<section className="kok-group" aria-label={\`Kolejka: ${group.name}\`}>` przez

```tsx
    <section
      className={`kok-group${group.kind ? ` kok-group--kind kok-group--kind-${group.kind}` : ""}`}
      aria-label={`Kolejka: ${group.name}`}
    >
```

i blok w nagłówku grupy:

```tsx
{
  group.owner === "work" ? <span className="kok-badge kok-badge--warn">Dane z firmy</span> : null;
}
```

na

```tsx
<span className="kok-group__badges">
  {group.kind ? (
    <span className={`kok-badge kok-badge--kind-${group.kind}`}>
      {PROJECT_KIND_LABELS[group.kind]}
    </span>
  ) : null}
  {group.companyData ? <span className="kok-badge kok-badge--warn">Dane z firmy</span> : null}
</span>
```

- [ ] **Step 4: `home.css`**

Dopisz pod regułami `.kok-group__head`/`.kok-badge--accent`:

```css
/* Rodzaj projektu (spec rodzajów, D8): pasek po lewej grupy i tematu oraz znacznik; kolory z tokenów `--kind-*`. */
.kok-topic,
.kok-group {
  position: relative;
}

.kok-topic--kind::before,
.kok-group--kind::before {
  content: "";
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 3px;
  border-radius: 0 2px 2px 0;
  background: var(--kok-kind, transparent);
}

.kok-topic--kind-etat,
.kok-group--kind-etat {
  --kok-kind: var(--kind-etat);
}

.kok-topic--kind-wlasny,
.kok-group--kind-wlasny {
  --kok-kind: var(--kind-wlasny);
}

.kok-topic--kind-biblioteka,
.kok-group--kind-biblioteka {
  --kok-kind: var(--kind-biblioteka);
}

.kok-group__badges {
  display: inline-flex;
  align-items: center;
  gap: var(--s-2);
}

.kok-badge--kind-etat {
  border-color: var(--kind-etat);
  color: var(--kind-etat);
  background: color-mix(in srgb, var(--kind-etat) 12%, transparent);
}

.kok-badge--kind-wlasny {
  border-color: var(--kind-wlasny);
  color: var(--kind-wlasny);
  background: color-mix(in srgb, var(--kind-wlasny) 12%, transparent);
}

.kok-badge--kind-biblioteka {
  border-color: var(--kind-biblioteka);
  color: var(--kind-biblioteka);
  background: color-mix(in srgb, var(--kind-biblioteka) 12%, transparent);
}
```

- [ ] **Step 5: Uruchom, zobacz sukces**

Run: `npx vitest run tests/unit/features/home`
Expected: PASS. Jeśli inny test w `HomeView.test.tsx` oczekiwał tekstu „własny” przy temacie (nie znaleziono w inwentarzu, ale sprawdź), zaktualizuj na „Własny”.

- [ ] **Step 6: Commit**

```bash
git add src/features/home/CockpitSections.tsx src/features/home/home.css tests/unit/features/home/HomeView.test.tsx
git commit -m "feat(kokpit): kolor i znacznik rodzaju przy zadaniach i tematach projektów

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Pełna weryfikacja i oględziny w przeglądarce

**Files:** brak (poprawki tylko, gdy coś wyjdzie).

- [ ] **Step 1: Typy, lint, testy, build (do pomocnika)**

Run (zlecenie dla `cursor`, tier light; pełny output czytaj tylko, gdy podsumowanie nie wystarcza):
`scripts/ask-helper.sh --role task --tier light --approve-allowed cursor "Uruchom kolejno w katalogu Monolith: npx tsc --noEmit; npx vitest run; npm run lint; npm run lint:tests; npm run build. Dla każdego napisz 'przeszło' albo listę plik:linia + przyczyna. Nic nie edytuj."`
Expected: wszystkie „przeszło” (w tym `tests/unit/architecture.static.test.ts`). `npm run lint:tests` nie jest na liście zgód `--approve-allowed`: jeśli pomocnik zgłosi `blocked`, uruchom to polecenie sam.

- [ ] **Step 2: Oględziny wizualne**

Wzorzec z 2026-11-15 (nie ruszamy prawdziwego vaulta ani portu 3100/3101): skopiuj vault do scratchpada (`rsync -a --exclude Work ../NEXUS/Vault/ $SCRATCH/vault/`), w kopii ustaw w `Projects/gen-podsum-ai/index.md` frontmatter `type: etat`, a w `Projects/english-agent/index.md` `type: biblioteka`; wolny port, np.:
`NEXT_DIST_DIR=.next-ogledziny NEXUS_VAULT_PATH=$SCRATCH/vault PORT=3177 npx next dev -p 3177 -H 127.0.0.1`.
Sprawdź w przeglądarce (Playwright headless lub ręcznie): (a) Alt+4: zielony pasek i znacznik „Etat” przy Gen Podsum AI, fioletowy „Biblioteka” przy English Agent, niebieskie „Własny” pozostałe, zaznaczenie w kolorze rodzaju, czerwona ramka „>14 dni” nadal widoczna razem z paskiem; (b) po wyborze Gen Podsum AI zielony pasek nagłówka teczki i „Dane z firmy” z `title`; zmiana przełącznika „Typ projektu” zmienia kolor listy bez przeładowania; (c) Alt+1: przypnij oba projekty i dodaj im zadanie `[now::]`: grupy kolejki i tematy mają ten sam kolor rodzaju (nie pomarańczowy akcent Kokpitu), grupa „Ogólne” bez paska; (d) kontrast tekstu znaczników na ciemnym tle czytelny (WCAG AA ≥ 4.5:1 dla znaczników).
Po oględzinach: zatrzymaj serwer, `git checkout tsconfig.json` (Next dev go przeformatowuje), `rm -rf .next-ogledziny`, `git status --short` ma być czysty.

- [ ] **Step 3: Commit poprawek (jeśli były)**

```bash
git add -A
git commit -m "fix(projekty): poprawki po oględzinach rodzajów projektów

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 12: PR i porządki w NEXUS (za zgodą użytkownika)

**Files:** `../NEXUS/Vault/Projects/monolith/tasks.md`, `index.md` (osobne repo).

- [ ] **Step 1: Wypchnij gałąź i otwórz PR**

Run: `git push -u origin feat/rodzaje-projektow` i `gh pr create --base main --title "feat(projekty): kolor i znacznik rodzaju projektu (etat/własny/biblioteka)"` z opisem: streszczenie, D1–D8 (link do specu), „Poza zakresem” ze specu §3, wyniki weryfikacji (tsc, vitest, lint, build, oględziny). Opis kończy się linią `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

- [ ] **Step 2: Po merge’u zaktualizuj `tasks.md` i `index.md` w NEXUS**

Odhacz etap (PR #NN, data); dopisz zadania z „Poza zakresem” (spec §3): odczyt i zapis `Work/` dla projektów wrażliwych, kalendarz etatu, `color:` nadpisywalny, kolor zdarzeń kalendarza i osi dnia, „(etat)” w `DeployPanel`, aktualizacja specu asystenta (linia 150 i §10); zaktualizuj „Gdzie skończyłem” w `index.md`. Commit i push w NEXUS tylko za zgodą użytkownika.

---

## Self-review (autor planu)

- **Pokrycie specu:** D1 (bez `Work/`): brak zadań na `Work/` (świadomie); D2: tokeny i `projectKind` (T1, T6); D3: `isWorkProject` bez zmian i jego test (T1); D4: `hasCompanyData` w paczce, teczce, oknie „Przenieś do…”, Kokpicie (T3, T6, T9, T10); D5: „Firma” bez zmian i testy (T6); D6: istniejący test `listNowTasks` rozszerzony (T4); D7: kafelek (T8); D8: Kokpit (T4, T5, T10). Odświeżanie listy i paczki (T7), fixtury (T2 Step 5), kontrast i oględziny (T11), tokeny globalne (T6).
- **Placeholdery:** brak „TBD”; miejsca zależne od stanu repo (lista błędów `tsc`, ewentualne zliczanie opcji w teście Inboxu) mają jawną regułę naprawy.
- **Spójność typów:** `projectKind(owner, type?)` i `hasCompanyData(owner, type?)` (T1) używane identycznie w T3, T4, T5; `kind: ProjectType`/`companyData: boolean` w `ProjectSummaryDto` (T2) i `NowTask` (T4); w `bc_cockpit` własny `ProjectKind` (T5) o tych samych wartościach; `PROJECT_KIND_LABELS` (T2) używane w T6 i T10; klasy `prj-item--kind-*`, `prj-card--kind(-*)`, `kok-topic--kind(-*)`, `kok-group--kind(-*)`, `prj-badge--kind-*`, `kok-badge--kind-*` spójne między TSX, CSS i testami.
