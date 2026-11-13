# Etap 2-1: Kokpit Dnia (odczyt) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Karta Kokpit pokazuje aktywne tematy (maks. 3, przypinane ręcznie), kolejkę zadań na dziś i dzisiejsze wydarzenia, z odczytu istniejących danych; jedyny nowy zapis to `Vault/Cockpit/pinned.yaml`.

**Architecture:** Nowy kontekst `contexts/bc_cockpit/` (ADR-021) składa widok wyłącznie z `services` innych kontekstów (`bc_projects`, `bc_tasks`, `bc_calendar`); `repositories` czyta i zapisuje `pinned.yaml` przez `lib/nexus/yaml-store`. `bc_projects` dostaje jedną nową funkcję `listNowTasks()`. `HomeView` przepisany na trzy sekcje, importuje tylko `bc_cockpit/schemas`. Każde źródło danych degraduje się osobno (ostrzeżenie zamiast 500).

**Tech Stack:** Next.js 14, TypeScript, zod, vitest + Testing Library, `yaml` przez `lib/nexus/yaml-lists`.

**Spec:** `docs/superpowers/specs/2026-11-13-etap-2-1-kokpit-odczyt-design.md` (zatwierdzony 2026-11-13).

## Wyniki weryfikacji dwóch zgodności ze specu (odczyt kodu, 2026-11-13)

1. **Kontrola wersji przy PUT przypięć: spec jest nieścisły.** `lib/nexus/yaml-store.ts` nie przyjmuje `expected` od klienta. `updateList` → `updateVaultFile` odczytuje plik, stosuje `fn` i zapisuje z kontrolą wersji; przy zmianie zewnętrznej **ponawia** na świeżej treści (domyślnie 3 razy), a po wyczerpaniu prób rzuca `ConflictError` (409). Istniejące testy to potwierdzają: `tests/unit/lib/nexus/yaml-store.test.ts` (`re-applies fn to fresh content after an external change`, `throws ConflictError when retries are exhausted`, `never overwrites an unparsable file`). `expected` od klienta mają tylko operacje indeksowe (`tasks.md` w `bc_projects`). `PUT` przypięć zastępuje całą listę, więc `expected` od klienta nie jest potrzebny. Task 1 poprawia spec.
2. **`yaml-store` bez zmiany listy w teście architektury: potwierdzone.** Test „zapis do vaulta (vault-fs) tylko ze znanych plików” zbiera krawędzie `to === "lib/nexus/vault-fs"`; nowy `bc_cockpit/repositories.ts` importuje tylko `@/lib/nexus/yaml-store`, więc `VAULT_FS_IMPORTERS` zostaje bez zmian. Nowy plik wpada do „warstwy plikowej” (brak `fs`, `process.env`, mutacji plików: spełnione). Task 6 kończy się uruchomieniem tego testu jako czerwono-zielonej weryfikacji; **test architektury nie jest zmieniany**, a gdyby pękł, naprawiamy kod.

## Ustalenia z odczytu kodu, które wiążą wykonawcę

- **R2 (kontekst → inny kontekst tylko przez `services`)** dotyczy też typów: `bc_cockpit` nie może importować `bc_projects/models` ani innych cudzych `models`. Własne typy w `bc_cockpit/models.ts`; typ zwracany cudzych funkcji bierzemy przez `ReturnType<typeof ...>` (tak robi `bc_calendar` z `bc_tasks`).
- **`schemas.ts` nie importuje wartości z `models.ts`** (tylko `import type`). Stała `MAX_PINNED` jest w `models.ts`, a `schemas.ts` ma literał `3`; test w Tasku 3 pilnuje zgodności.
- **Trasa** `app/api/**/route.ts` to jeden re-eksport routera; `export const dynamic = "force-dynamic"` jest dozwolone (jak w `app/api/projects/route.ts`).
- **Data „dziś”** liczona lokalnie w `bc_cockpit/services` (`localDate`), wstrzykiwalna `today: Date`.
- **Zła data `due`:** `0006-08-26` jest poprawną datą kalendarzową, więc samo sprawdzenie kalendarza nie wystarcza. Poprawna data to `RRRR-MM-DD`, rok 2000–2099, istniejący dzień.
- **Testy usług** mockują `services` innych kontekstów i `./repositories` (jak `tests/unit/contexts/bc_projects/services.test.ts`); żaden test nie dotyka prawdziwego vaulta ani rejestru. Testy repozytorium używają `useTempVault()`.
- **Polecenia testowe/lint/build** wykonawca może zlecić `cursor` (`scripts/ask-helper.sh --role task --tier light --approve-allowed cursor "..."`) zgodnie z CLAUDE.md; poniżej podane są dosłowne komendy i oczekiwany wynik.
- **Commity:** po każdym tasku. Zmian `tests/unit/architecture.static.test.ts` nie ma w tym planie. Trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Mapa plików

| Plik                                                          | Akcja  | Odpowiedzialność                                                  |
| ------------------------------------------------------------- | ------ | ----------------------------------------------------------------- |
| `docs/superpowers/specs/2026-11-13-etap-2-1-...md`            | Modify | korekta opisu kontroli wersji                                     |
| `contexts/bc_projects/models.ts`                              | Modify | typ `NowTask`                                                     |
| `contexts/bc_projects/services/index.ts`                      | Modify | `listNowTasks()`                                                  |
| `tests/unit/contexts/bc_projects/services.test.ts`            | Modify | testy `listNowTasks`                                              |
| `contexts/bc_cockpit/models.ts`                               | Create | typy domeny, `MAX_PINNED`                                         |
| `contexts/bc_cockpit/schemas.ts`                              | Create | zod `PUT`, DTO, mapery                                            |
| `contexts/bc_cockpit/repositories.ts`                         | Create | `Cockpit/pinned.yaml` przez `yaml-store`                          |
| `contexts/bc_cockpit/services.ts`                             | Create | `getCockpit`, `setPinned`                                         |
| `contexts/bc_cockpit/router.ts`                               | Create | handlery HTTP                                                     |
| `app/api/cockpit/route.ts`, `app/api/cockpit/pinned/route.ts` | Create | re-eksporty                                                       |
| `tests/unit/contexts/bc_cockpit/*.test.ts`                    | Create | schemas, repositories, services, router                           |
| `src/features/home/CockpitSections.tsx`                       | Create | prezentacja: tematy, kolejka, oś dnia, ostrzeżenia                |
| `src/features/home/PinPicker.tsx`                             | Create | wybór do 3 projektów, zapis `PUT`                                 |
| `src/features/home/HomeView.tsx`                              | Modify | `GET /api/cockpit`, układ według makiety, `ActivityLog` bez zmian |
| `tests/unit/features/home/HomeView.test.tsx`                  | Modify | testy nowego widoku                                               |

---

### Task 1: Korekta specu (kontrola wersji)

**Files:**

- Modify: `docs/superpowers/specs/2026-11-13-etap-2-1-kokpit-odczyt-design.md:30`

- [ ] **Step 1: Poprawić zdanie o kontroli wersji**

Zamienić w §3 (punkt `repositories.ts`) tekst
`Zapis z kontrolą wersji jak istniejące zapisy (`expected`, konflikt = 409).`
na:

```
Zapis przez `updateList` (`PUT` zastępuje całą listę): `yaml-store` przy zmianie zewnętrznej ponawia zapis na świeżej treści (maks. 3 razy), a po wyczerpaniu prób rzuca `ConflictError` (409); klient nie wysyła `expected` (to dotyczy tylko operacji indeksowych na `tasks.md`). Plik, który się nie parsuje, nie jest nadpisywany: `PUT` kończy się błędem z nazwą pliku, a poprawia go użytkownik ręcznie.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-11-13-etap-2-1-kokpit-odczyt-design.md
git commit -m "docs(2-1): spec: kontrola wersji pinned.yaml przez ponawianie yaml-store, bez expected od klienta

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `bc_projects.listNowTasks()`

**Files:**

- Modify: `contexts/bc_projects/models.ts` (dopisać na końcu sekcji zadań, po `TaskOp`)
- Modify: `contexts/bc_projects/services/index.ts` (import typu + nowa funkcja po `listProjects`)
- Test: `tests/unit/contexts/bc_projects/services.test.ts` (nowy `describe` na końcu pliku, import `listNowTasks`)

- [ ] **Step 1: Napisać czerwone testy**

Dodać `listNowTasks` do importu z `@/contexts/bc_projects/services` i na końcu pliku:

```ts
describe("listNowTasks", () => {
  beforeEach(() => {
    mockReadRegistry.mockReset();
    mockReadProjectBoard.mockReset();
  });

  const board = (now: BoardTask[]): TasksBoard => ({ ...EMPTY_BOARD, now });

  it("zbiera niezakończone zadania Teraz ze wszystkich projektów razem z nazwą i owner", () => {
    mockReadRegistry.mockReturnValue({
      entries: [
        entry({ id: "nexus", name: "NEXUS" }),
        entry({ id: "firma", name: "Firma", owner: "work" }),
      ],
      warnings: [],
    });
    mockReadProjectBoard.mockImplementation((e: RegistryEntry) =>
      e.id === "nexus"
        ? board([{ text: "Plan 2-1", done: false }])
        : board([{ text: "Raport", done: false }])
    );

    const { tasks, warnings } = listNowTasks();

    expect(tasks).toEqual([
      { projectId: "nexus", projectName: "NEXUS", owner: "personal", text: "Plan 2-1" },
      { projectId: "firma", projectName: "Firma", owner: "work", text: "Raport" },
    ]);
    expect(warnings).toEqual([]);
  });

  it("pomija ukończone zadania", () => {
    mockReadRegistry.mockReturnValue({ entries: [entry({ id: "a" })], warnings: [] });
    mockReadProjectBoard.mockReturnValue(
      board([
        { text: "Zrobione", done: true, doneDate: "2026-11-12" },
        { text: "Do zrobienia", done: false },
      ])
    );
    expect(listNowTasks().tasks.map((t) => t.text)).toEqual(["Do zrobienia"]);
  });

  it("błąd odczytu tablicy jednego projektu to ostrzeżenie, reszta zostaje", () => {
    mockReadRegistry.mockReturnValue({
      entries: [entry({ id: "zly" }), entry({ id: "dobry" })],
      warnings: ["rejestr: ostrzeżenie"],
    });
    mockReadProjectBoard.mockImplementation((e: RegistryEntry) => {
      if (e.id === "zly") throw new Error("pęknięty tasks.md");
      return board([{ text: "Ok", done: false }]);
    });

    const { tasks, warnings } = listNowTasks();

    expect(tasks.map((t) => t.projectId)).toEqual(["dobry"]);
    expect(warnings).toEqual(["rejestr: ostrzeżenie", "zly: pęknięty tasks.md"]);
  });
});
```

- [ ] **Step 2: Uruchomić i zobaczyć porażkę**

Run: `npx vitest run tests/unit/contexts/bc_projects/services.test.ts -t listNowTasks`
Expected: FAIL (`listNowTasks is not a function` / brak eksportu).

- [ ] **Step 3: Implementacja**

`contexts/bc_projects/models.ts`, po typie `TaskOp`:

```ts
/** Niezakończone zadanie z kolumny „Teraz” jednego projektu (widok zbiorczy Kokpitu, etap 2-1). */
export type NowTask = { projectId: string; projectName: string; owner: Owner; text: string };
```

`contexts/bc_projects/services/index.ts`: dodać `type NowTask` do importu z `@/contexts/bc_projects/models` i po `listProjects`:

```ts
/**
 * Niezakończone zadania `[now::]` ze wszystkich projektów rejestru (bez limitu 3: ten dotyczy
 * tablicy jednego projektu). Błąd jednego `tasks.md` to ostrzeżenie; błąd rejestru leci wyżej.
 */
export function listNowTasks(): { tasks: NowTask[]; warnings: string[] } {
  const { entries, warnings: registryWarnings } = readRegistry();
  const warnings = [...registryWarnings];
  const tasks: NowTask[] = [];
  for (const entry of entries) {
    try {
      for (const task of readProjectBoard(entry).now) {
        if (task.done) continue;
        tasks.push({
          projectId: entry.id,
          projectName: entry.name,
          owner: entry.owner,
          text: task.text,
        });
      }
    } catch (err) {
      warnings.push(`${entry.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { tasks, warnings };
}
```

- [ ] **Step 4: Uruchomić do zielonego**

Run: `npx vitest run tests/unit/contexts/bc_projects/services.test.ts`
Expected: PASS (cały plik).

- [ ] **Step 5: Commit**

```bash
git add contexts/bc_projects/models.ts contexts/bc_projects/services/index.ts tests/unit/contexts/bc_projects/services.test.ts
git commit -m "feat(2-1): bc_projects.listNowTasks: zadania Teraz ze wszystkich projektów

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `bc_cockpit` models i schemas

**Files:**

- Create: `contexts/bc_cockpit/models.ts`
- Create: `contexts/bc_cockpit/schemas.ts`
- Test: `tests/unit/contexts/bc_cockpit/schemas.test.ts`

- [ ] **Step 1: Napisać czerwony test**

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { MAX_PINNED, type Cockpit } from "@/contexts/bc_cockpit/models";
import { PinnedInputSchema, toCockpitDto, toPinnedDto } from "@/contexts/bc_cockpit/schemas";

describe("PinnedInputSchema", () => {
  it("przyjmuje 0..3 różnych niepustych id i przycina spacje", () => {
    expect(PinnedInputSchema.parse({ ids: [] })).toEqual({ ids: [] });
    expect(PinnedInputSchema.parse({ ids: [" nexus ", "monolith"] })).toEqual({
      ids: ["nexus", "monolith"],
    });
  });

  it("odrzuca więcej niż MAX_PINNED id (literał 3 w schemas zgodny z models)", () => {
    const ok = Array.from({ length: MAX_PINNED }, (_, i) => `p${i}`);
    expect(PinnedInputSchema.safeParse({ ids: ok }).success).toBe(true);
    expect(PinnedInputSchema.safeParse({ ids: [...ok, "extra"] }).success).toBe(false);
  });

  it("odrzuca duplikaty, puste id, brak pola i nie-tablicę", () => {
    expect(PinnedInputSchema.safeParse({ ids: ["a", "a"] }).success).toBe(false);
    expect(PinnedInputSchema.safeParse({ ids: ["  "] }).success).toBe(false);
    expect(PinnedInputSchema.safeParse({}).success).toBe(false);
    expect(PinnedInputSchema.safeParse({ ids: "nexus" }).success).toBe(false);
    expect(PinnedInputSchema.safeParse({ ids: [1] }).success).toBe(false);
  });
});

describe("mapery DTO", () => {
  const model: Cockpit = {
    date: "2026-11-13",
    topics: [
      {
        id: "nexus",
        name: "NEXUS",
        owner: "personal",
        freshness: "fresh",
        source: "state",
        nextStep: "Plan",
        blocker: null,
        whereIStopped: null,
      },
    ],
    queue: [
      {
        projectId: null,
        name: "Ogólne",
        owner: "personal",
        items: [{ kind: "today", title: "Faktura", due: "2026-11-13" }],
      },
    ],
    events: [
      {
        id: "e1",
        title: "Spotkanie",
        startMinutes: 570,
        durationMinutes: 30,
        type: "meeting",
        color: "#fff",
      },
    ],
    warnings: ["uwaga"],
  };

  it("toCockpitDto zachowuje kształt i nie wpuszcza dodatkowych pól", () => {
    const dto = toCockpitDto({ ...model, extra: "x" } as Cockpit);
    expect(dto).toEqual(model);
    expect(Object.keys(dto).sort()).toEqual(["date", "events", "queue", "topics", "warnings"]);
  });

  it("toPinnedDto", () => {
    expect(toPinnedDto({ ids: ["a"] })).toEqual({ ids: ["a"] });
  });
});
```

- [ ] **Step 2: Uruchomić i zobaczyć porażkę**

Run: `npx vitest run tests/unit/contexts/bc_cockpit/schemas.test.ts`
Expected: FAIL (brak modułów).

- [ ] **Step 3: Implementacja `models.ts`**

```ts
/** Maksymalna liczba aktywnych tematów (limit skupienia, spec asystenta §6.2). */
export const MAX_PINNED = 3;

export type Owner = "personal" | "work";
export type Freshness = "fresh" | "stale" | "unknown";

export type Pinned = { ids: string[] };

/** Skąd pochodzą treści tematu: `state.md`, `index.md` („Gdzie skończyłem”) albo nigdzie. */
export type TopicSource = "state" | "index" | "none";

export type Topic = {
  id: string;
  name: string;
  owner: Owner;
  freshness: Freshness;
  source: TopicSource;
  nextStep: string | null;
  blocker: string | null;
  whereIStopped: string | null;
};

/** `overdue`: `due` < dziś, `today`: `due` = dziś, `now`: zadanie `[now::]` projektu. */
export type QueueKind = "overdue" | "today" | "now";
export type QueueItem = { kind: QueueKind; title: string; due: string | null };
/** Grupa kolejki: projekt albo „Ogólne” (`projectId: null`). */
export type QueueGroup = {
  projectId: string | null;
  name: string;
  owner: Owner;
  items: QueueItem[];
};

export type DayEvent = {
  id: string;
  title: string;
  startMinutes: number;
  durationMinutes: number;
  type: "work" | "meeting";
  color: string;
};

export type Cockpit = {
  /** Dzień `RRRR-MM-DD` w strefie lokalnej serwera. */
  date: string;
  topics: Topic[];
  queue: QueueGroup[];
  events: DayEvent[];
  warnings: string[];
};
```

- [ ] **Step 4: Implementacja `schemas.ts`**

```ts
import { z } from "zod";
import { looseObject } from "@/lib/schema/looseObject";
import type { Cockpit, DayEvent, Pinned, QueueGroup, Topic } from "./models";

// ── wejście ────────────────────────────────────────────────────────────────────

/** Limit 3 = `MAX_PINNED` z `models` (schemas nie importuje wartości z models; zgodność pilnuje test). */
export const PinnedInputSchema = looseObject({
  ids: z.array(z.string().trim().min(1, "id required")).max(3, "Maksymalnie 3 aktywne tematy"),
}).superRefine((body, ctx) => {
  if (new Set(body.ids).size !== body.ids.length) ctx.addIssue("Powtórzone id projektu");
});

// ── wyjście (DTO) ──────────────────────────────────────────────────────────────

export type TopicDto = Topic;
export type QueueGroupDto = QueueGroup;
export type DayEventDto = DayEvent;
export type CockpitDto = Cockpit;
export type PinnedDto = Pinned;

export function toCockpitDto(c: Cockpit): CockpitDto {
  return {
    date: c.date,
    topics: c.topics.map((t) => ({
      id: t.id,
      name: t.name,
      owner: t.owner,
      freshness: t.freshness,
      source: t.source,
      nextStep: t.nextStep,
      blocker: t.blocker,
      whereIStopped: t.whereIStopped,
    })),
    queue: c.queue.map((g) => ({
      projectId: g.projectId,
      name: g.name,
      owner: g.owner,
      items: g.items.map((i) => ({ kind: i.kind, title: i.title, due: i.due })),
    })),
    events: c.events.map((e) => ({
      id: e.id,
      title: e.title,
      startMinutes: e.startMinutes,
      durationMinutes: e.durationMinutes,
      type: e.type,
      color: e.color,
    })),
    warnings: [...c.warnings],
  };
}

export function toPinnedDto(p: Pinned): PinnedDto {
  return { ids: [...p.ids] };
}
```

- [ ] **Step 5: Zielony test + architektura**

Run: `npx vitest run tests/unit/contexts/bc_cockpit/schemas.test.ts tests/unit/architecture.static.test.ts`
Expected: PASS oba (schemas importuje tylko `zod`, `lib/schema`, `import type` z `./models`).

- [ ] **Step 6: Commit**

```bash
git add contexts/bc_cockpit/models.ts contexts/bc_cockpit/schemas.ts tests/unit/contexts/bc_cockpit/schemas.test.ts
git commit -m "feat(2-1): bc_cockpit: modele i schematy (PUT przypięć, DTO)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `bc_cockpit/repositories.ts` (`Cockpit/pinned.yaml`)

**Files:**

- Create: `contexts/bc_cockpit/repositories.ts`
- Test: `tests/unit/contexts/bc_cockpit/repositories.test.ts`

- [ ] **Step 1: Napisać czerwony test**

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readPinned, writePinned } from "@/contexts/bc_cockpit/repositories";
import { formatYamlList } from "@/lib/nexus/yaml-lists";
import { useTempVault } from "../../helpers/tempVault";

const REL = "Cockpit/pinned.yaml";
const vault = useTempVault();

describe("readPinned", () => {
  it("brak pliku to pusta lista", () => {
    expect(readPinned()).toEqual({ ids: [] });
  });

  it("czyta `projects: [{id}]` w kolejności z pliku", () => {
    vault.write(REL, formatYamlList("projects", [{ id: "nexus" }, { id: "monolith" }]));
    expect(readPinned()).toEqual({ ids: ["nexus", "monolith"] });
  });

  it("pomija wpisy bez tekstowego id i duplikaty (ręcznie edytowany plik)", () => {
    vault.write(
      REL,
      formatYamlList("projects", [
        { id: "a" },
        { name: "bez id" },
        { id: 5 },
        { id: " " },
        { id: "a" },
      ])
    );
    expect(readPinned()).toEqual({ ids: ["a"] });
  });

  it("uszkodzony YAML to błąd z nazwą pliku (serwis zamienia go na ostrzeżenie)", () => {
    vault.write(REL, "projects: [unclosed\n");
    expect(() => readPinned()).toThrow(REL);
  });
});

describe("writePinned", () => {
  it("tworzy plik w formacie yaml-lists (version 1, bez generated_by) i da się go odczytać", async () => {
    await writePinned(["nexus", "monolith"]);
    expect(vault.read(REL)).toBe(formatYamlList("projects", [{ id: "nexus" }, { id: "monolith" }]));
    expect(readPinned()).toEqual({ ids: ["nexus", "monolith"] });
  });

  it("zastępuje całą listę, także pustą", async () => {
    await writePinned(["a", "b"]);
    await writePinned([]);
    expect(readPinned()).toEqual({ ids: [] });
  });

  it("nigdy nie nadpisuje pliku, który się nie parsuje", async () => {
    const broken = "projects: [unclosed\n";
    vault.write(REL, broken);
    await expect(writePinned(["a"])).rejects.toThrow(REL);
    expect(vault.read(REL)).toBe(broken);
  });
});
```

- [ ] **Step 2: Uruchomić i zobaczyć porażkę**

Run: `npx vitest run tests/unit/contexts/bc_cockpit/repositories.test.ts`
Expected: FAIL (brak modułu).

- [ ] **Step 3: Implementacja**

```ts
import { readList, updateList } from "@/lib/nexus/yaml-store";
import type { Pinned } from "./models";

const FILE = "Cockpit/pinned.yaml";
const LIST_KEY = "projects";

/** Brak pliku = pusta lista. Uszkodzony YAML rzuca błąd z nazwą pliku (serwis robi z niego ostrzeżenie). */
export function readPinned(): Pinned {
  const ids: string[] = [];
  for (const item of readList(FILE, LIST_KEY)) {
    const id = typeof item.id === "string" ? item.id.trim() : "";
    if (id !== "" && !ids.includes(id)) ids.push(id);
  }
  return { ids };
}

/**
 * Zastępuje całą listę przez `updateList` (ponawianie na świeżej treści przy zmianie zewnętrznej,
 * po wyczerpaniu prób `ConflictError` = 409; plik, który się nie parsuje, nie jest nadpisywany).
 */
export async function writePinned(ids: string[]): Promise<void> {
  await updateList(FILE, LIST_KEY, () => ids.map((id) => ({ id })));
}
```

- [ ] **Step 4: Zielony test + zgodność nr 2 (czerwono-zielona weryfikacja architektury)**

Run: `npx vitest run tests/unit/contexts/bc_cockpit/repositories.test.ts tests/unit/architecture.static.test.ts tests/unit/lib/nexus/yaml-store.test.ts`
Expected: PASS wszystkie. Jeśli `architecture.static.test.ts` pęka na „zapis do vaulta (vault-fs) tylko ze znanych plików”, założenie ze specu jest fałszywe: **nie edytować testu**, tylko sprawdzić, czy repozytorium nie importuje `vault-fs` bezpośrednio, i zgłosić użytkownikowi.

- [ ] **Step 5: Commit**

```bash
git add contexts/bc_cockpit/repositories.ts tests/unit/contexts/bc_cockpit/repositories.test.ts
git commit -m "feat(2-1): bc_cockpit: repozytorium Cockpit/pinned.yaml przez yaml-store

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `bc_cockpit/services.ts`

**Files:**

- Create: `contexts/bc_cockpit/services.ts`
- Test: `tests/unit/contexts/bc_cockpit/services.test.ts`

- [ ] **Step 1: Napisać czerwone testy**

```ts
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError, NotFoundError } from "@/lib/errors";

const mockReadPinned = vi.hoisted(() => vi.fn());
const mockWritePinned = vi.hoisted(() => vi.fn());
const mockGetProject = vi.hoisted(() => vi.fn());
const mockListNowTasks = vi.hoisted(() => vi.fn());
const mockListProjects = vi.hoisted(() => vi.fn());
const mockGetTasks = vi.hoisted(() => vi.fn());
const mockGetCalendarEvents = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/bc_cockpit/repositories", () => ({
  readPinned: mockReadPinned,
  writePinned: mockWritePinned,
}));
vi.mock("@/contexts/bc_projects/services", () => ({
  getProject: mockGetProject,
  listNowTasks: mockListNowTasks,
  listProjects: mockListProjects,
}));
vi.mock("@/contexts/bc_tasks/services", () => ({ getTasks: mockGetTasks }));
vi.mock("@/contexts/bc_calendar/services", () => ({ getCalendarEvents: mockGetCalendarEvents }));

import { getCockpit, isPlausibleDate, localDate, setPinned } from "@/contexts/bc_cockpit/services";

/** 00:30 lokalnie: jedyna data „dziś” ma być 2026-11-13 (UTC byłoby 12-go). */
const TODAY = new Date(2026, 10, 13, 0, 30);

const task = (over: Record<string, unknown>) => ({
  id: "t",
  title: "Zadanie",
  link: "",
  description: "",
  status: "todo",
  due_date: null,
  priority: null,
  ...over,
});

const project = (over: Record<string, unknown> = {}) => ({
  id: "nexus",
  name: "NEXUS",
  owner: "personal",
  freshness: "fresh",
  whereIStopped: null,
  state: null,
  ...over,
});

const state = (over: Record<string, unknown> = {}) => ({
  nextStep: "",
  blocker: "",
  ...over,
});

beforeEach(() => {
  vi.resetAllMocks();
  mockReadPinned.mockReturnValue({ ids: [] });
  mockListNowTasks.mockReturnValue({ tasks: [], warnings: [] });
  mockGetTasks.mockResolvedValue([]);
  mockGetCalendarEvents.mockResolvedValue([]);
  mockListProjects.mockReturnValue({
    projects: [{ id: "nexus" }, { id: "monolith" }],
    warnings: [],
  });
});

describe("daty", () => {
  it("localDate liczy dzień lokalny (00:30 nie przesuwa dnia)", () => {
    expect(localDate(TODAY)).toBe("2026-11-13");
  });

  it("isPlausibleDate: poprawny format, istniejący dzień, rok 2000-2099", () => {
    expect(isPlausibleDate("2026-11-13")).toBe(true);
    expect(isPlausibleDate("0006-08-26")).toBe(false);
    expect(isPlausibleDate("2026-13-40")).toBe(false);
    expect(isPlausibleDate("2026-02-30")).toBe(false);
    expect(isPlausibleDate("jutro")).toBe(false);
    expect(isPlausibleDate("2026-11-13T10:00")).toBe(false);
    expect(isPlausibleDate(null)).toBe(false);
  });

  it("getCockpit zwraca jedną wspólną datę i pyta kalendarz o ten sam dzień", async () => {
    const result = await getCockpit(TODAY);
    expect(result.date).toBe("2026-11-13");
    expect(mockGetCalendarEvents).toHaveBeenCalledWith({
      startDate: "2026-11-13",
      endDate: "2026-11-13",
    });
  });
});

describe("tematy", () => {
  beforeEach(() => mockReadPinned.mockReturnValue({ ids: ["nexus"] }));

  it("ze state.md: nextStep i blocker, puste pola to null", async () => {
    mockGetProject.mockReturnValue(
      project({ state: state({ nextStep: " Zrobić X ", blocker: "" }), whereIStopped: "stare" })
    );
    const { topics } = await getCockpit(TODAY);
    expect(topics).toEqual([
      {
        id: "nexus",
        name: "NEXUS",
        owner: "personal",
        freshness: "fresh",
        source: "state",
        nextStep: "Zrobić X",
        blocker: null,
        whereIStopped: null,
      },
    ]);
    expect(mockGetProject).toHaveBeenCalledWith("nexus", TODAY);
  });

  it("bez state.md: fallback do „Gdzie skończyłem” z index.md", async () => {
    mockGetProject.mockReturnValue(project({ whereIStopped: "Skończyłem na Y" }));
    const { topics } = await getCockpit(TODAY);
    expect(topics[0]).toMatchObject({
      source: "index",
      whereIStopped: "Skończyłem na Y",
      nextStep: null,
      blocker: null,
    });
  });

  it("bez state.md i index.md: source none", async () => {
    mockGetProject.mockReturnValue(project());
    expect((await getCockpit(TODAY)).topics[0].source).toBe("none");
  });

  it("stary last_worked: temat zostaje, freshness stale", async () => {
    mockGetProject.mockReturnValue(project({ freshness: "stale", whereIStopped: "x" }));
    const { topics } = await getCockpit(TODAY);
    expect(topics).toHaveLength(1);
    expect(topics[0].freshness).toBe("stale");
  });

  it("owner work przechodzi do tematu", async () => {
    mockGetProject.mockReturnValue(project({ owner: "work" }));
    expect((await getCockpit(TODAY)).topics[0].owner).toBe("work");
  });

  it("przypięty id spoza rejestru jest pomijany z ostrzeżeniem", async () => {
    mockGetProject.mockImplementation(() => {
      throw new NotFoundError("Nie ma projektu o id nexus");
    });
    const { topics, warnings } = await getCockpit(TODAY);
    expect(topics).toEqual([]);
    expect(warnings).toEqual(["Przypięty projekt nexus nie istnieje już w rejestrze"]);
  });

  it("inny błąd odczytu projektu to ostrzeżenie, nie wyjątek", async () => {
    mockGetProject.mockImplementation(() => {
      throw new Error("zły state.md");
    });
    const { topics, warnings } = await getCockpit(TODAY);
    expect(topics).toEqual([]);
    expect(warnings).toEqual(["Projekt nexus: zły state.md"]);
  });

  it("w pliku więcej niż 3 id (ręczna edycja): pokazuje 3 i ostrzega", async () => {
    mockReadPinned.mockReturnValue({ ids: ["a", "b", "c", "d"] });
    mockGetProject.mockImplementation((id: string) => project({ id, name: id }));
    const { topics, warnings } = await getCockpit(TODAY);
    expect(topics.map((t) => t.id)).toEqual(["a", "b", "c"]);
    expect(warnings).toEqual(["Przypięto 4 projekty, pokazuję pierwsze 3"]);
  });

  it("uszkodzony pinned.yaml: pusta sekcja i ostrzeżenie, reszta Kokpitu działa", async () => {
    mockReadPinned.mockImplementation(() => {
      throw new Error("Nie można odczytać pliku Cockpit/pinned.yaml: zły YAML");
    });
    mockListNowTasks.mockReturnValue({
      tasks: [{ projectId: "p", projectName: "P", owner: "personal", text: "Zadanie" }],
      warnings: [],
    });
    const result = await getCockpit(TODAY);
    expect(result.topics).toEqual([]);
    expect(result.warnings).toEqual([
      "Przypięte projekty: Nie można odczytać pliku Cockpit/pinned.yaml: zły YAML",
    ]);
    expect(result.queue).toHaveLength(1);
  });
});

describe("kolejka na dziś", () => {
  it("kolejność: zaległe, dzisiejsze due, potem [now::]; grupy per projekt, ogólne jako „Ogólne”", async () => {
    mockListNowTasks.mockReturnValue({
      tasks: [
        { projectId: "p1", projectName: "Projekt 1", owner: "personal", text: "Plan" },
        { projectId: "p2", projectName: "Projekt 2", owner: "work", text: "Raport" },
      ],
      warnings: [],
    });
    mockGetTasks.mockResolvedValue([
      task({ id: "b", title: "Dziś", due_date: "2026-11-13" }),
      task({ id: "a", title: "Zaległe", due_date: "2026-11-10", status: "in_progress" }),
      task({ id: "c", title: "Jutro", due_date: "2026-11-14" }),
      task({ id: "d", title: "Zrobione", due_date: "2026-11-13", status: "done" }),
      task({ id: "e", title: "Bez terminu" }),
    ]);

    const { queue } = await getCockpit(TODAY);

    expect(queue).toEqual([
      {
        projectId: null,
        name: "Ogólne",
        owner: "personal",
        items: [
          { kind: "overdue", title: "Zaległe", due: "2026-11-10" },
          { kind: "today", title: "Dziś", due: "2026-11-13" },
        ],
      },
      {
        projectId: "p1",
        name: "Projekt 1",
        owner: "personal",
        items: [{ kind: "now", title: "Plan", due: null }],
      },
      {
        projectId: "p2",
        name: "Projekt 2",
        owner: "work",
        items: [{ kind: "now", title: "Raport", due: null }],
      },
    ]);
  });

  it("zadania [now::] kilku projektów nie mieszają grup, kilka zadań jednego projektu w jednej grupie", async () => {
    mockListNowTasks.mockReturnValue({
      tasks: [
        { projectId: "p1", projectName: "P1", owner: "personal", text: "A" },
        { projectId: "p2", projectName: "P2", owner: "personal", text: "B" },
        { projectId: "p1", projectName: "P1", owner: "personal", text: "C" },
      ],
      warnings: [],
    });
    const { queue } = await getCockpit(TODAY);
    expect(queue.map((g) => [g.projectId, g.items.map((i) => i.title)])).toEqual([
      ["p1", ["A", "C"]],
      ["p2", ["B"]],
    ]);
  });

  it("złe daty due (0006-08-26 i inne) są pomijane z ostrzeżeniem, poprawne zostają", async () => {
    mockGetTasks.mockResolvedValue([
      task({ id: "1", title: "Stare", due_date: "0006-08-26" }),
      task({ id: "2", title: "Nie data", due_date: "jutro" }),
      task({ id: "3", title: "Nie ma takiego dnia", due_date: "2026-02-30" }),
      task({ id: "4", title: "Ok", due_date: "2026-11-13" }),
    ]);
    const { queue, warnings } = await getCockpit(TODAY);
    expect(queue[0].items.map((i) => i.title)).toEqual(["Ok"]);
    expect(warnings).toEqual([
      'Zadanie "Stare": pominięto błędny termin 0006-08-26',
      'Zadanie "Nie data": pominięto błędny termin jutro',
      'Zadanie "Nie ma takiego dnia": pominięto błędny termin 2026-02-30',
    ]);
  });

  it("ostrzeżenia listNowTasks trafiają do warnings", async () => {
    mockListNowTasks.mockReturnValue({ tasks: [], warnings: ["zly: pęknięty tasks.md"] });
    expect((await getCockpit(TODAY)).warnings).toEqual(["zly: pęknięty tasks.md"]);
  });
});

describe("oś dnia", () => {
  it("odrzuca task_deadline (kolejka już je pokazuje), zachowuje kolejność z kalendarza", async () => {
    mockGetCalendarEvents.mockResolvedValue([
      {
        id: "e1",
        date: "2026-11-13",
        start_minutes: 570,
        duration_minutes: 30,
        title: "Spotkanie",
        tags: [],
        color: "#111",
        type: "meeting",
      },
      {
        id: "task:1",
        date: "2026-11-13",
        start_minutes: 1410,
        duration_minutes: 30,
        title: "Termin",
        tags: [],
        color: "#666",
        type: "task_deadline",
      },
      {
        id: "e2",
        date: "2026-11-13",
        start_minutes: 780,
        duration_minutes: 60,
        title: "Praca",
        tags: [],
        color: "#222",
        type: "work",
      },
    ]);
    const { events } = await getCockpit(TODAY);
    expect(events).toEqual([
      {
        id: "e1",
        title: "Spotkanie",
        startMinutes: 570,
        durationMinutes: 30,
        type: "meeting",
        color: "#111",
      },
      {
        id: "e2",
        title: "Praca",
        startMinutes: 780,
        durationMinutes: 60,
        type: "work",
        color: "#222",
      },
    ]);
  });
});

describe("awaria jednego źródła nie wywraca reszty", () => {
  it("getTasks rzuca: kolejka z projektów, oś i tematy działają, jest ostrzeżenie", async () => {
    mockReadPinned.mockReturnValue({ ids: ["nexus"] });
    mockGetProject.mockReturnValue(project({ whereIStopped: "x" }));
    mockListNowTasks.mockReturnValue({
      tasks: [{ projectId: "p1", projectName: "P1", owner: "personal", text: "A" }],
      warnings: [],
    });
    mockGetTasks.mockRejectedValue(new Error("zły tasks.md"));
    mockGetCalendarEvents.mockResolvedValue([
      {
        id: "e1",
        date: "2026-11-13",
        start_minutes: 600,
        duration_minutes: 15,
        title: "E",
        tags: [],
        color: "#1",
        type: "work",
      },
    ]);

    const result = await getCockpit(TODAY);

    expect(result.topics).toHaveLength(1);
    expect(result.queue.map((g) => g.projectId)).toEqual(["p1"]);
    expect(result.events).toHaveLength(1);
    expect(result.warnings).toEqual(["Zadania ogólne: zły tasks.md"]);
  });

  it("kalendarz rzuca: pusta oś i ostrzeżenie", async () => {
    mockGetCalendarEvents.mockRejectedValue(new Error("zły kalendarz"));
    const result = await getCockpit(TODAY);
    expect(result.events).toEqual([]);
    expect(result.warnings).toEqual(["Kalendarz: zły kalendarz"]);
  });

  it("listNowTasks rzuca (zły rejestr): zadania ogólne nadal są w kolejce", async () => {
    mockListNowTasks.mockImplementation(() => {
      throw new Error("zły rejestr");
    });
    mockGetTasks.mockResolvedValue([task({ title: "Dziś", due_date: "2026-11-13" })]);
    const result = await getCockpit(TODAY);
    expect(result.queue[0].name).toBe("Ogólne");
    expect(result.warnings).toEqual(["Zadania projektów: zły rejestr"]);
  });
});

describe("setPinned", () => {
  it("zapisuje poprawną listę (kolejność zachowana) i zwraca ją", async () => {
    mockWritePinned.mockResolvedValue(undefined);
    await expect(setPinned(["monolith", "nexus"])).resolves.toEqual({ ids: ["monolith", "nexus"] });
    expect(mockWritePinned).toHaveBeenCalledWith(["monolith", "nexus"]);
  });

  it("pusta lista jest dozwolona (odpięcie wszystkich)", async () => {
    await expect(setPinned([])).resolves.toEqual({ ids: [] });
    expect(mockWritePinned).toHaveBeenCalledWith([]);
  });

  it.each([
    ["nieznane id", ["nexus", "nie-ma"]],
    ["4 id", ["a", "b", "c", "d"]],
    ["duplikaty", ["nexus", "nexus"]],
  ])("%s: DomainError 400, nic nie zapisano", async (_name, ids) => {
    const err = await setPinned(ids).catch((e) => e);
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).statusCode).toBe(400);
    expect(mockWritePinned).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Uruchomić i zobaczyć porażkę**

Run: `npx vitest run tests/unit/contexts/bc_cockpit/services.test.ts`
Expected: FAIL (brak modułu `services`).

- [ ] **Step 3: Implementacja**

```ts
import * as calendarServices from "@/contexts/bc_calendar/services";
import * as projectsServices from "@/contexts/bc_projects/services";
import * as tasksServices from "@/contexts/bc_tasks/services";
import { DomainError, NotFoundError } from "@/lib/errors";
import {
  MAX_PINNED,
  type Cockpit,
  type DayEvent,
  type Owner,
  type Pinned,
  type QueueGroup,
  type QueueItem,
  type Topic,
} from "./models";
import * as repositories from "./repositories";

const GENERAL_NAME = "Ogólne";
/** Terminy poza tym zakresem to najpewniej literówki (np. `0006-08-26`). */
const MIN_YEAR = 2000;
const MAX_YEAR = 2099;

const pad = (n: number) => String(n).padStart(2, "0");

/** Dzień w strefie lokalnej serwera (`RRRR-MM-DD`); jedyne źródło „dziś” dla Kokpitu. */
export function localDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** `RRRR-MM-DD`, istniejący dzień kalendarzowy, rok 2000–2099. */
export function isPlausibleDate(value: string | null | undefined): value is string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (year < MIN_YEAR || year > MAX_YEAR) return false;
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
}

const reason = (err: unknown) => (err instanceof Error ? err.message : String(err));

// ── aktywne tematy ─────────────────────────────────────────────────────────────

function toTopic(p: ReturnType<typeof projectsServices.getProject>): Topic {
  const source: Topic["source"] = p.state ? "state" : p.whereIStopped ? "index" : "none";
  return {
    id: p.id,
    name: p.name,
    owner: p.owner,
    freshness: p.freshness,
    source,
    nextStep: source === "state" ? p.state?.nextStep.trim() || null : null,
    blocker: source === "state" ? p.state?.blocker.trim() || null : null,
    whereIStopped: source === "index" ? p.whereIStopped : null,
  };
}

function loadTopics(today: Date, warnings: string[]): Topic[] {
  let ids: string[];
  try {
    ids = repositories.readPinned().ids;
  } catch (err) {
    warnings.push(`Przypięte projekty: ${reason(err)}`);
    return [];
  }
  if (ids.length > MAX_PINNED) {
    warnings.push(`Przypięto ${ids.length} projekty, pokazuję pierwsze ${MAX_PINNED}`);
  }
  const topics: Topic[] = [];
  for (const id of ids.slice(0, MAX_PINNED)) {
    try {
      topics.push(toTopic(projectsServices.getProject(id, today)));
    } catch (err) {
      warnings.push(
        err instanceof NotFoundError
          ? `Przypięty projekt ${id} nie istnieje już w rejestrze`
          : `Projekt ${id}: ${reason(err)}`
      );
    }
  }
  return topics;
}

// ── kolejka na dziś ────────────────────────────────────────────────────────────

type QueueEntry = { projectId: string | null; name: string; owner: Owner; item: QueueItem };

const KIND_RANK: Record<QueueItem["kind"], number> = { overdue: 0, today: 1, now: 2 };

/** Sortuje (zaległe → dziś → now; w obrębie rodzaju po `due`), potem grupuje wg kolejności pierwszego wystąpienia. */
function groupQueue(entries: QueueEntry[]): QueueGroup[] {
  const sorted = [...entries].sort(
    (a, b) =>
      KIND_RANK[a.item.kind] - KIND_RANK[b.item.kind] ||
      (a.item.due ?? "").localeCompare(b.item.due ?? "")
  );
  const groups = new Map<string, QueueGroup>();
  for (const entry of sorted) {
    const key = entry.projectId === null ? "general:" : `project:${entry.projectId}`;
    let group = groups.get(key);
    if (!group) {
      group = { projectId: entry.projectId, name: entry.name, owner: entry.owner, items: [] };
      groups.set(key, group);
    }
    group.items.push(entry.item);
  }
  return [...groups.values()];
}

async function loadQueue(date: string, warnings: string[]): Promise<QueueGroup[]> {
  const entries: QueueEntry[] = [];

  try {
    const { tasks, warnings: nowWarnings } = projectsServices.listNowTasks();
    warnings.push(...nowWarnings);
    for (const t of tasks) {
      entries.push({
        projectId: t.projectId,
        name: t.projectName,
        owner: t.owner,
        item: { kind: "now", title: t.text, due: null },
      });
    }
  } catch (err) {
    warnings.push(`Zadania projektów: ${reason(err)}`);
  }

  try {
    for (const t of await tasksServices.getTasks()) {
      if (t.status === "done" || !t.due_date) continue;
      if (!isPlausibleDate(t.due_date)) {
        warnings.push(`Zadanie "${t.title}": pominięto błędny termin ${t.due_date}`);
        continue;
      }
      if (t.due_date > date) continue;
      // Zadania ogólne nie mają pola `owner`: w 2-1 traktowane jako prywatne (spec D7).
      entries.push({
        projectId: null,
        name: GENERAL_NAME,
        owner: "personal",
        item: { kind: t.due_date < date ? "overdue" : "today", title: t.title, due: t.due_date },
      });
    }
  } catch (err) {
    warnings.push(`Zadania ogólne: ${reason(err)}`);
  }

  return groupQueue(entries);
}

// ── dzisiejsze wydarzenia ──────────────────────────────────────────────────────

async function loadEvents(date: string, warnings: string[]): Promise<DayEvent[]> {
  try {
    const entries = await calendarServices.getCalendarEvents({ startDate: date, endDate: date });
    return entries.flatMap((e) =>
      e.type === "task_deadline"
        ? []
        : [
            {
              id: e.id,
              title: e.title,
              startMinutes: e.start_minutes,
              durationMinutes: e.duration_minutes,
              type: e.type,
              color: e.color,
            },
          ]
    );
  } catch (err) {
    warnings.push(`Kalendarz: ${reason(err)}`);
    return [];
  }
}

// ── API serwisu ────────────────────────────────────────────────────────────────

/** Każde źródło w osobnym try/catch: awaria daje pustą sekcję i wpis w `warnings`, nie wyjątek. */
export async function getCockpit(today: Date = new Date()): Promise<Cockpit> {
  const date = localDate(today);
  const warnings: string[] = [];
  const topics = loadTopics(today, warnings);
  const queue = await loadQueue(date, warnings);
  const events = await loadEvents(date, warnings);
  return { date, topics, queue, events, warnings };
}

export async function setPinned(ids: string[]): Promise<Pinned> {
  if (ids.length > MAX_PINNED) {
    throw new DomainError(`Maksymalnie ${MAX_PINNED} aktywne tematy`);
  }
  if (new Set(ids).size !== ids.length) throw new DomainError("Powtórzone id projektu");
  const known = new Set(projectsServices.listProjects().projects.map((p) => p.id));
  const unknown = ids.filter((id) => !known.has(id));
  if (unknown.length > 0) throw new DomainError(`Nieznany projekt: ${unknown.join(", ")}`);
  await repositories.writePinned(ids);
  return { ids };
}
```

Test oczekuje dokładnie `"Przypięto 4 projekty, pokazuję pierwsze 3"`. Dla 5 i więcej przypiętych polska liczba mnoga („projektów”) jest kosmetyką i nie blokuje.

- [ ] **Step 4: Uruchomić do zielonego**

Run: `npx vitest run tests/unit/contexts/bc_cockpit/services.test.ts tests/unit/architecture.static.test.ts`
Expected: PASS oba. Architektura: `services` woła tylko `services` innych kontekstów (R2), brak cyklu (R7: `bc_cockpit → bc_projects/bc_tasks/bc_calendar`, `bc_calendar → bc_tasks`; nic nie wraca do `bc_cockpit`).

- [ ] **Step 5: Commit**

```bash
git add contexts/bc_cockpit/services.ts tests/unit/contexts/bc_cockpit/services.test.ts
git commit -m "feat(2-1): bc_cockpit: getCockpit (tematy, kolejka, wydarzenia) i setPinned

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Router i trasy API

**Files:**

- Create: `contexts/bc_cockpit/router.ts`
- Create: `app/api/cockpit/route.ts`
- Create: `app/api/cockpit/pinned/route.ts`
- Test: `tests/unit/contexts/bc_cockpit/router.test.ts`

- [ ] **Step 1: Napisać czerwony test**

```ts
// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError } from "@/lib/errors";

const mockGetCockpit = vi.hoisted(() => vi.fn());
const mockSetPinned = vi.hoisted(() => vi.fn());
vi.mock("@/contexts/bc_cockpit/services", () => ({
  getCockpit: mockGetCockpit,
  setPinned: mockSetPinned,
}));

import { getCockpit, putPinned } from "@/contexts/bc_cockpit/router";

const put = (body: unknown) =>
  new NextRequest("http://localhost/api/cockpit/pinned", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

beforeEach(() => vi.resetAllMocks());

describe("GET /api/cockpit", () => {
  it("200 z DTO", async () => {
    mockGetCockpit.mockResolvedValue({
      date: "2026-11-13",
      topics: [],
      queue: [],
      events: [],
      warnings: ["x"],
    });
    const res = await getCockpit();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      date: "2026-11-13",
      topics: [],
      queue: [],
      events: [],
      warnings: ["x"],
    });
  });

  it("nieoczekiwany wyjątek to 500 przez handleServiceError", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetCockpit.mockRejectedValue(new Error("boom"));
    expect((await getCockpit()).status).toBe(500);
  });
});

describe("PUT /api/cockpit/pinned", () => {
  it("200 i zwraca zapisaną listę", async () => {
    mockSetPinned.mockResolvedValue({ ids: ["nexus"] });
    const res = await putPinned(put({ ids: ["nexus"] }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ids: ["nexus"] });
    expect(mockSetPinned).toHaveBeenCalledWith(["nexus"]);
  });

  it.each([
    ["4 id", { ids: ["a", "b", "c", "d"] }],
    ["duplikaty", { ids: ["a", "a"] }],
    ["brak ids", {}],
    ["zły JSON", "{nie json"],
  ])("400 dla: %s, serwis nie jest wołany", async (_name, body) => {
    const res = await putPinned(put(body));
    expect(res.status).toBe(400);
    expect(mockSetPinned).not.toHaveBeenCalled();
  });

  it("ConflictError z yaml-store (wyczerpane ponowienia) to 409", async () => {
    mockSetPinned.mockRejectedValue(new ConflictError("Plik zmienił się w międzyczasie"));
    const res = await putPinned(put({ ids: ["nexus"] }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Plik zmienił się w międzyczasie" });
  });
});
```

- [ ] **Step 2: Uruchomić i zobaczyć porażkę**

Run: `npx vitest run tests/unit/contexts/bc_cockpit/router.test.ts`
Expected: FAIL (brak `router`).

- [ ] **Step 3: Implementacja**

`contexts/bc_cockpit/router.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { handleServiceError } from "@/lib/http/apiError";
import { parseBody } from "@/lib/http/parseBody";
import { PinnedInputSchema, toCockpitDto, toPinnedDto } from "./schemas";
import * as services from "./services";

export async function getCockpit(): Promise<NextResponse> {
  try {
    return NextResponse.json(toCockpitDto(await services.getCockpit()));
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function putPinned(request: NextRequest): Promise<NextResponse> {
  const parsed = await parseBody(request, PinnedInputSchema, { details: false });
  if (parsed.success === false) return parsed.response;
  try {
    return NextResponse.json(toPinnedDto(await services.setPinned(parsed.data.ids)));
  } catch (err) {
    return handleServiceError(err);
  }
}
```

`app/api/cockpit/route.ts`:

```ts
export { getCockpit as GET } from "@/contexts/bc_cockpit/router";

// Dane z vaulta i „dziś” liczymy przy każdym żądaniu; bez tego Next mógłby wyrenderować trasę statycznie przy buildzie.
export const dynamic = "force-dynamic";
```

`app/api/cockpit/pinned/route.ts`:

```ts
export { putPinned as PUT } from "@/contexts/bc_cockpit/router";

export const dynamic = "force-dynamic";
```

- [ ] **Step 4: Zielony test + pełna architektura (zgodność nr 2, finał)**

Run: `npx vitest run tests/unit/contexts/bc_cockpit tests/unit/architecture.static.test.ts tests/unit/lib/nexus`
Expected: PASS wszystko, `tests/unit/architecture.static.test.ts` **bez żadnej zmiany** (`git diff --stat -- tests/unit/architecture.static.test.ts` puste).

- [ ] **Step 5: Commit**

```bash
git add contexts/bc_cockpit/router.ts app/api/cockpit tests/unit/contexts/bc_cockpit/router.test.ts
git commit -m "feat(2-1): trasy GET /api/cockpit i PUT /api/cockpit/pinned

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: UI Kokpitu (`src/features/home/`)

Pliki UI importują z kontekstu tylko `schemas` (R1). Styl jak obecny `HomeView`: klasy Tailwind z tokenami `--surface`, `--border`, `--text`, `--text2`, `--text3`, `--accent`, `--green`; bez nowego CSS. Znacznik „Dane z firmy” używa obwódki `var(--danger, #ff7272)` jak w karcie projektu (`prj-card__owner`). Układ sekcji według `docs/mockups/karty/cards/01-kokpit.html`; wykonawca zagląda do makiety przy dopasowaniu detali, ale testy pilnują treści i zachowania, nie pikseli.

**Files:**

- Create: `src/features/home/CockpitSections.tsx`
- Create: `src/features/home/PinPicker.tsx`
- Modify: `src/features/home/HomeView.tsx`
- Test: `tests/unit/features/home/HomeView.test.tsx` (przepisany)

- [ ] **Step 1: Przepisać test (czerwony)**

Zastąpić całą zawartość `tests/unit/features/home/HomeView.test.tsx`:

```tsx
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi, beforeEach, test, expect } from "vitest";
import HomeView from "@/src/features/home/HomeView";
import { translations } from "@/src/translations";
import type { CockpitDto } from "@/contexts/bc_cockpit/schemas";

vi.mock("@/src/components/sessions/ActivityLog", () => ({
  ActivityLog: () => <div data-testid="activity-log" />,
}));
vi.mock("@/src/components/layout/AppSidebar", () => ({
  AppSidebar: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar">{children}</div>
  ),
}));
vi.mock("@/src/components/layout/AppHeader", () => ({
  AppHeader: () => <div data-testid="header" />,
}));

const t = translations["pl"];

const EMPTY: CockpitDto = { date: "2026-11-13", topics: [], queue: [], events: [], warnings: [] };

const FULL: CockpitDto = {
  date: "2026-11-13",
  topics: [
    {
      id: "nexus",
      name: "NEXUS",
      owner: "personal",
      freshness: "fresh",
      source: "state",
      nextStep: "Napisać plan 2-1",
      blocker: "Brak decyzji o energii",
      whereIStopped: null,
    },
    {
      id: "firma",
      name: "Projekt firmowy",
      owner: "work",
      freshness: "stale",
      source: "index",
      nextStep: null,
      blocker: null,
      whereIStopped: "Skończyłem na raporcie",
    },
  ],
  queue: [
    {
      projectId: null,
      name: "Ogólne",
      owner: "personal",
      items: [
        { kind: "overdue", title: "Zaległa faktura", due: "2026-11-10" },
        { kind: "today", title: "Wysłać wniosek", due: "2026-11-13" },
      ],
    },
    {
      projectId: "firma",
      name: "Projekt firmowy",
      owner: "work",
      items: [{ kind: "now", title: "Przejrzeć raport", due: null }],
    },
  ],
  events: [
    {
      id: "e1",
      title: "Spotkanie zespołu",
      startMinutes: 570,
      durationMinutes: 30,
      type: "meeting",
      color: "#111",
    },
  ],
  warnings: ['Zadanie "Stare": pominięto błędny termin 0006-08-26'],
};

const mockApiFetch = vi.fn();

function respond(cockpit: CockpitDto | "fail") {
  mockApiFetch.mockImplementation((url: string, init?: RequestInit) => {
    if (url === "/api/cockpit") {
      return cockpit === "fail"
        ? Promise.resolve({ ok: false, status: 500, json: async () => ({ error: "boom" }) })
        : Promise.resolve({ ok: true, json: async () => cockpit });
    }
    if (url === "/api/projects") {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          projects: [
            { id: "nexus", name: "NEXUS", status: "active", owner: "personal" },
            { id: "firma", name: "Projekt firmowy", status: "active", owner: "work" },
            { id: "monolith", name: "Monolith", status: "active", owner: "personal" },
            { id: "inny", name: "Inny", status: "active", owner: "personal" },
          ],
          warnings: [],
        }),
      });
    }
    if (url === "/api/cockpit/pinned" && init?.method === "PUT") {
      return Promise.resolve({ ok: true, json: async () => ({ ids: [] }) });
    }
    return Promise.resolve({ ok: true, json: async () => [] });
  });
}

const defaultProps = {
  apiFetch: mockApiFetch,
  lang: "pl" as const,
  t,
  isSidebarOpen: true,
  setIsSidebarOpen: vi.fn(),
  appMode: "home" as const,
  setAppMode: vi.fn(),
  planningTab: "tasks" as const,
  setPlanningTab: vi.fn(),
  setLang: vi.fn(),
};

beforeEach(() => {
  mockApiFetch.mockReset();
  respond(EMPTY);
});

test("pokazuje aktywne tematy: nazwa, następny krok i blokadę", async () => {
  respond(FULL);
  render(<HomeView {...defaultProps} />);
  expect(await screen.findByText("NEXUS")).toBeInTheDocument();
  expect(screen.getByText("Napisać plan 2-1")).toBeInTheDocument();
  expect(screen.getByText("Brak decyzji o energii")).toBeInTheDocument();
  expect(screen.getByText("Skończyłem na raporcie")).toBeInTheDocument();
});

test("pusty stan tematów: Przypnij projekty", async () => {
  render(<HomeView {...defaultProps} />);
  expect(await screen.findByText("Przypnij projekty")).toBeInTheDocument();
});

test("znacznik „Dane z firmy” przy temacie i grupie kolejki oraz „do sprawdzenia” przy starych danych", async () => {
  respond(FULL);
  render(<HomeView {...defaultProps} />);
  await screen.findByText("NEXUS");
  expect(screen.getAllByText("Dane z firmy")).toHaveLength(2);
  expect(screen.getAllByText("do sprawdzenia")).toHaveLength(1);
});

test("kolejka: grupy, zaległe z datą, bez znacznika firmy dla ogólnych", async () => {
  respond(FULL);
  render(<HomeView {...defaultProps} />);
  expect(await screen.findByText("Zaległa faktura")).toBeInTheDocument();
  expect(screen.getByText("2026-11-10")).toBeInTheDocument();
  expect(screen.getByText("Wysłać wniosek")).toBeInTheDocument();
  expect(screen.getByText("Ogólne")).toBeInTheDocument();
  expect(screen.getByText("Przejrzeć raport")).toBeInTheDocument();
});

test("oś dnia: godzina i tytuł; pusty stan", async () => {
  respond(FULL);
  const { unmount } = render(<HomeView {...defaultProps} />);
  expect(await screen.findByText("Spotkanie zespołu")).toBeInTheDocument();
  expect(screen.getByText("09:30")).toBeInTheDocument();
  unmount();

  respond(EMPTY);
  render(<HomeView {...defaultProps} />);
  expect(await screen.findByText("Brak wydarzeń na dziś")).toBeInTheDocument();
});

test("pokazuje ostrzeżenia z serwera", async () => {
  respond(FULL);
  render(<HomeView {...defaultProps} />);
  expect(
    await screen.findByText('Zadanie "Stare": pominięto błędny termin 0006-08-26')
  ).toBeInTheDocument();
});

test("błąd GET /api/cockpit: komunikat, a ActivityLog nadal jest", async () => {
  respond("fail");
  render(<HomeView {...defaultProps} />);
  expect(await screen.findByText(/Nie udało się wczytać Kokpitu/)).toBeInTheDocument();
  expect(screen.getByTestId("activity-log")).toBeInTheDocument();
});

test("ActivityLog jest renderowany pod sekcjami", async () => {
  respond(FULL);
  render(<HomeView {...defaultProps} />);
  await screen.findByText("NEXUS");
  expect(screen.getByTestId("activity-log")).toBeInTheDocument();
});

test("„Zmień aktywne”: wybór, zapis PUT i odświeżenie Kokpitu", async () => {
  respond(FULL);
  render(<HomeView {...defaultProps} />);
  await screen.findByText("NEXUS");

  fireEvent.click(screen.getByRole("button", { name: "Zmień aktywne" }));
  const monolith = await screen.findByLabelText("Monolith");
  fireEvent.click(monolith);
  fireEvent.click(screen.getByRole("button", { name: "Zapisz" }));

  await waitFor(() => {
    const put = mockApiFetch.mock.calls.find(
      ([url, init]) => url === "/api/cockpit/pinned" && init?.method === "PUT"
    );
    expect(put).toBeTruthy();
    expect(JSON.parse(put![1].body)).toEqual({ ids: ["nexus", "firma", "monolith"] });
  });
  await waitFor(() => {
    const cockpitCalls = mockApiFetch.mock.calls.filter(([url]) => url === "/api/cockpit");
    expect(cockpitCalls.length).toBe(2);
  });
});

test("picker: po wybraniu 3 projektów pozostałe są zablokowane", async () => {
  respond(FULL);
  render(<HomeView {...defaultProps} />);
  await screen.findByText("NEXUS");
  fireEvent.click(screen.getByRole("button", { name: "Zmień aktywne" }));
  await screen.findByLabelText("Monolith");
  fireEvent.click(screen.getByLabelText("Monolith"));
  expect(screen.getByLabelText("Inny")).toBeDisabled();
});

test("picker: błąd PUT (np. 409) pokazuje komunikat serwera i nie zamyka okna", async () => {
  respond(FULL);
  render(<HomeView {...defaultProps} />);
  await screen.findByText("NEXUS");
  const base = mockApiFetch.getMockImplementation()!;
  mockApiFetch.mockImplementation((url: string, init?: RequestInit) =>
    url === "/api/cockpit/pinned" && init?.method === "PUT"
      ? Promise.resolve({
          ok: false,
          status: 409,
          json: async () => ({ error: "Plik zmienił się w międzyczasie" }),
        })
      : base(url, init)
  );
  fireEvent.click(screen.getByRole("button", { name: "Zmień aktywne" }));
  await screen.findByLabelText("Monolith");
  fireEvent.click(screen.getByRole("button", { name: "Zapisz" }));
  expect(await screen.findByText("Plik zmienił się w międzyczasie")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Zapisz" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Uruchomić i zobaczyć porażkę**

Run: `npx vitest run tests/unit/features/home/HomeView.test.tsx`
Expected: FAIL (stary `HomeView` nie woła `/api/cockpit`, brak przycisku „Zmień aktywne”).

- [ ] **Step 3: `CockpitSections.tsx`**

```tsx
// src/features/home/CockpitSections.tsx
import React from "react";
import type {
  CockpitDto,
  DayEventDto,
  QueueGroupDto,
  TopicDto,
} from "@/contexts/bc_cockpit/schemas";

const CARD = "bg-[var(--surface)] border border-[var(--border)] rounded-xl";
const SECTION_TITLE = "text-xs font-bold uppercase tracking-widest text-[var(--text2)]";
const BADGE =
  "ml-2 px-2 py-px text-[11px] font-normal rounded border border-[var(--danger,#ff7272)] text-[var(--text)]";

const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

function Line({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <p className="text-sm text-[var(--text2)] mt-1">
      <span className="text-[var(--text3)]">{label}: </span>
      {value}
    </p>
  );
}

function TopicCard({ topic }: { topic: TopicDto }) {
  return (
    <article className={`${CARD} p-4`} aria-label={`Temat ${topic.name}`}>
      <h4 className="text-sm font-bold text-[var(--text)]">
        {topic.name}
        {topic.owner === "work" ? <span className={BADGE}>Dane z firmy</span> : null}
        {topic.freshness === "stale" ? <span className={BADGE}>do sprawdzenia</span> : null}
      </h4>
      {topic.source === "state" ? (
        <>
          <Line label="Następny krok" value={topic.nextStep} />
          <Line label="Blokada" value={topic.blocker} />
        </>
      ) : topic.source === "index" ? (
        <Line label="Gdzie skończyłem" value={topic.whereIStopped} />
      ) : (
        <p className="text-sm text-[var(--text3)] mt-1">Brak zapisanego stanu</p>
      )}
    </article>
  );
}

function QueueGroup({ group }: { group: QueueGroupDto }) {
  return (
    <section className={`${CARD} p-3`} aria-label={`Kolejka: ${group.name}`}>
      <h4 className="text-sm font-bold text-[var(--text)] mb-2">
        {group.name}
        {group.owner === "work" ? <span className={BADGE}>Dane z firmy</span> : null}
      </h4>
      <ul className="space-y-1">
        {group.items.map((item, i) => (
          <li key={`${item.kind}-${i}`} className="flex items-center gap-3 text-sm">
            <div className="w-3 h-3 rounded border-2 border-[var(--accent)] flex-shrink-0" />
            <span className="text-[var(--text)] flex-1">{item.title}</span>
            {item.kind === "overdue" && item.due ? (
              <span className="text-xs text-[var(--danger,#ff7272)]">{item.due}</span>
            ) : null}
            {item.kind === "today" ? (
              <span className="text-xs text-[var(--accent)]">dziś</span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function EventRow({ event }: { event: DayEventDto }) {
  return (
    <li className={`${CARD} flex items-center gap-3 p-3`}>
      <span className="text-xs text-[var(--text2)] tabular-nums">{hhmm(event.startMinutes)}</span>
      <span className="text-sm text-[var(--text)] flex-1">{event.title}</span>
    </li>
  );
}

export function CockpitSections({
  data,
  onChangeActive,
}: {
  data: CockpitDto;
  onChangeActive: () => void;
}) {
  return (
    <>
      <section aria-label="Aktywne tematy">
        <div className="flex items-center justify-between mb-3">
          <h3 className={SECTION_TITLE}>Aktywne tematy</h3>
          <button
            type="button"
            onClick={onChangeActive}
            className="text-xs text-[var(--accent)] hover:underline"
          >
            Zmień aktywne
          </button>
        </div>
        {data.topics.length === 0 ? (
          <p className="text-sm text-[var(--text3)]">Przypnij projekty</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {data.topics.map((topic) => (
              <TopicCard key={topic.id} topic={topic} />
            ))}
          </div>
        )}
      </section>

      <section aria-label="Kolejka na dziś">
        <h3 className={`${SECTION_TITLE} mb-3`}>Kolejka na dziś</h3>
        {data.queue.length === 0 ? (
          <p className="text-sm text-[var(--text3)]">Nic w kolejce</p>
        ) : (
          <div className="space-y-3">
            {data.queue.map((group) => (
              <QueueGroup key={group.projectId ?? "general"} group={group} />
            ))}
          </div>
        )}
      </section>

      <section aria-label="Oś dnia">
        <h3 className={`${SECTION_TITLE} mb-3`}>Oś dnia</h3>
        {data.events.length === 0 ? (
          <p className="text-sm text-[var(--text3)]">Brak wydarzeń na dziś</p>
        ) : (
          <ul className="space-y-2">
            {data.events.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </ul>
        )}
      </section>

      {data.warnings.length > 0 ? (
        <ul className="text-xs text-[var(--text3)] space-y-1" aria-label="Ostrzeżenia">
          {data.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
```

(Nazwa komponentu `QueueGroup` koliduje z typem tylko w obrębie pliku, typ jest importowany jako `QueueGroupDto`, więc nie ma konfliktu.)

- [ ] **Step 4: `PinPicker.tsx`**

```tsx
// src/features/home/PinPicker.tsx
import React, { useEffect, useState } from "react";

const MAX_PINNED = 3;

type ProjectOption = { id: string; name: string };

export function PinPicker({
  apiFetch,
  currentIds,
  onSaved,
  onCancel,
}: {
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  currentIds: string[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selected, setSelected] = useState<string[]>(currentIds);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch("/api/projects")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: { projects?: ProjectOption[] }) =>
        setProjects(Array.isArray(data.projects) ? data.projects : [])
      )
      .catch(() => setError("Nie udało się wczytać listy projektów"));
  }, [apiFetch]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch("/api/cockpit/pinned", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selected }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się zapisać");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        role="dialog"
        aria-label="Zmień aktywne tematy"
        className="bg-[var(--bg2)] rounded-2xl p-6 w-full max-w-md shadow-2xl"
      >
        <h3 className="text-base font-bold text-[var(--text)] mb-1">Zmień aktywne tematy</h3>
        <p className="text-xs text-[var(--text3)] mb-4">
          Wybrano {selected.length} z {MAX_PINNED}
        </p>
        <ul className="space-y-2 max-h-72 overflow-y-auto">
          {projects.map((p) => {
            const checked = selected.includes(p.id);
            const locked = !checked && selected.length >= MAX_PINNED;
            return (
              <li key={p.id}>
                <label className="flex items-center gap-2 text-sm text-[var(--text)]">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={locked}
                    onChange={() => toggle(p.id)}
                  />
                  {p.name}
                </label>
              </li>
            );
          })}
        </ul>
        {error ? <p className="text-sm text-red-500 mt-3">{error}</p> : null}
        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-[var(--text2)]"
          >
            Anuluj
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-[var(--accent)] text-white"
          >
            Zapisz
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Przepisać `HomeView.tsx`**

Zmiany względem obecnego pliku (reszta bez zmian: sidebar, header, sesje, `ActivityLog`, modal sesji, `goToTab`, `sidebarT`):

1. Importy: dodać
   ```tsx
   import type { CockpitDto } from "@/contexts/bc_cockpit/schemas";
   import { CockpitSections } from "./CockpitSections";
   import { PinPicker } from "./PinPicker";
   ```
2. Usunąć interfejsy `HomeTask`, `HomeEvent`, funkcje `todayISO`, `in48hISO`, stany `tasks`, `events`, `notesCount`, `resourcesCount`, `mindMapsCount`, cały pierwszy `useEffect` (pobieranie pięciu kolekcji) oraz obliczenia `today`, `limit48h`, `todayTasks`, `upcomingEvents`.
3. Dodać stany i ładowanie:

   ```tsx
   const [cockpit, setCockpit] = useState<CockpitDto | null>(null);
   const [cockpitError, setCockpitError] = useState<string | null>(null);
   const [loading, setLoading] = useState(true);
   const [pickerOpen, setPickerOpen] = useState(false);

   const loadCockpit = useCallback(async () => {
     setLoading(true);
     try {
       const res = await apiFetch("/api/cockpit");
       if (!res.ok) throw new Error(`HTTP ${res.status}`);
       setCockpit((await res.json()) as CockpitDto);
       setCockpitError(null);
     } catch (err) {
       setCockpitError(err instanceof Error ? err.message : "Błąd");
     } finally {
       setLoading(false);
     }
   }, [apiFetch]);

   useEffect(() => {
     void loadCockpit();
   }, [loadCockpit]);
   ```

4. W `<div className="flex-1 overflow-y-auto ...">` zostawić nagłówek z powitaniem i datą (`dateStr`), a między nim a blokiem `ActivityLog` zastąpić kafle KPI, „Dzisiejsze zadania” i „Nadchodzące wydarzenia” przez:

   ```tsx
   {
     loading && cockpit === null ? (
       <p className="text-sm text-[var(--text3)]">…</p>
     ) : cockpitError !== null ? (
       <p className="text-sm text-red-500">Nie udało się wczytać Kokpitu ({cockpitError})</p>
     ) : cockpit !== null ? (
       <CockpitSections data={cockpit} onChangeActive={() => setPickerOpen(true)} />
     ) : null;
   }

   {
     pickerOpen && (
       <PinPicker
         apiFetch={apiFetch}
         currentIds={cockpit?.topics.map((t) => t.id) ?? []}
         onCancel={() => setPickerOpen(false)}
         onSaved={() => {
           setPickerOpen(false);
           void loadCockpit();
         }}
       />
     );
   }
   ```

   Blok „Szybkie akcje” (`homeQuickActions`) zostaje bez zmian (to nawigacja, spec jej nie usuwa); `ActivityLog` i modal sesji bez zmian.

5. Powitanie: `dateStr` liczone z `new Date()` tylko do wyświetlenia nagłówka jest dopuszczalne; **żadna logika filtrowania nie używa daty w kliencie** (D8).

- [ ] **Step 6: Zielony test + typy**

Run: `npx vitest run tests/unit/features/home/HomeView.test.tsx && npx tsc --noEmit`
Expected: PASS i brak błędów typów (nieużywane tłumaczenia `homeTodayTasks` itd. zostają w `translations`; nie sprzątać).
Run: `npx vitest run tests/unit/architecture.static.test.ts`
Expected: PASS (UI importuje z kontekstu tylko `schemas`).

- [ ] **Step 7: Commit**

```bash
git add src/features/home tests/unit/features/home/HomeView.test.tsx
git commit -m "feat(2-1): Kokpit Dnia: aktywne tematy, kolejka, oś dnia, Zmień aktywne

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Weryfikacja końcowa i domknięcie

- [ ] **Step 1: Pełne sprawdzenia (zlecić `cursor --role task --tier light --approve-allowed`, wynik: „przeszło” albo lista `plik:linia + przyczyna`)**

```bash
npx tsc --noEmit
npx vitest run
npm run lint
npm run build
```

Expected: wszystkie przechodzą. Po buildzie w trasach `/api/cockpit` i `/api/cockpit/pinned` ma być oznaczenie dynamiczne (`ƒ`). Sprawdzić `git status`: build zapisuje tylko `.next/`.

- [ ] **Step 2: Test architektury niezmieniony**

Run: `git diff main --stat -- tests/unit/architecture.static.test.ts`
Expected: puste (reguła CLAUDE.md: zmiany testu osobnym commitem, tu ich nie ma).

- [ ] **Step 3: Niezależne review diffa (`agy`, nie podagenci Claude)**

```bash
scripts/ask-helper.sh --role review agy "Review diffa gałęzi feat/etap-2-1-kokpit-odczyt względem main (git diff main...HEAD). Spec: docs/superpowers/specs/2026-11-13-etap-2-1-kokpit-odczyt-design.md, plan: docs/superpowers/plans/2026-11-13-etap-2-1-kokpit-odczyt.md. Szukaj: błędów logiki kolejki i dat, naruszeń reguł R1-R7 (ADR-021), wycieku danych owner=work, niezłapanych wyjątków w getCockpit, luk w testach. Odpowiedz listą plik:linia + problem; bez przepisywania kodu."
```

Opinie traktować jak hipotezy: zweryfikować w kodzie, zanim cokolwiek się zmieni.

- [ ] **Step 4: Sprawdzenie w przeglądarce na kopii vaulta**

Nie dotykać `../NEXUS/Vault` (zapisy tylko do kopii):

```bash
SCRATCH=/tmp/claude-1000/-home-miro7224-projects-Brain-7224-Monolith/edbd5547-ceee-4d38-aff5-4a4fbe88eabf/scratchpad
rm -rf "$SCRATCH/vault-copy" && cp -r ../NEXUS/Vault "$SCRATCH/vault-copy"
NEXUS_VAULT_PATH="$SCRATCH/vault-copy" npm run dev -- -p 3100
```

Sprawdzić (Playwright lub ręcznie): Kokpit (Alt+1) pokazuje pusty stan „Przypnij projekty”; „Zmień aktywne” → wybór → zapis tworzy `$SCRATCH/vault-copy/Cockpit/pinned.yaml` w formacie `version: 1` / `projects:` / `- id: ...`; po odświeżeniu tematy są widoczne; zadanie `due:: 0006-08-26` z `Tasks/tasks.md` nie trafia do kolejki, a w sekcji ostrzeżeń jest wpis; `ActivityLog` nadal działa. **Jeśli tego kroku nie da się wykonać, napisać to wprost w opisie PR** (spec §4).

- [ ] **Step 5: Push i PR (tylko za zgodą użytkownika)**

Gałąź zawiera też niewypchnięty commit `766047b` (zrzuty). Zapytać użytkownika o zgodę na `git push` i otwarcie PR; opis kończy się linią `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

- [ ] **Step 6: NEXUS (tylko za zgodą użytkownika, osobny commit tylko `tasks.md`)**

W `../NEXUS/Vault/Projects/monolith/tasks.md` odhaczyć „Etap 2-1” (PR #NN, data) i dopisać do Backlogu: etap 2-2 (inbox i rytuał zamknięcia), pole energii i planer slotów, kalendarz etatu (`Work/`), `owner` dla zadań ogólnych.

---

## Self-review (spec → zadania)

| Wymaganie specu                                               | Task                                      |
| ------------------------------------------------------------- | ----------------------------------------- |
| D2/D6 przypinanie, maks. 3, `PUT`, `pinned.yaml`              | 3, 4, 5, 6, 7                             |
| D3 źródło tematu (state → index), znacznik „do sprawdzenia”   | 5 (`toTopic`), 7                          |
| D4 kolejka: `[now::]` + ogólne `due` ≤ dziś, kolejność, grupy | 2, 5 (`groupQueue`), 7                    |
| D5 wydarzenia bez `task_deadline`                             | 5 (`loadEvents`), 7                       |
| D7 „Dane z firmy”, ogólne jako prywatne                       | 5, 7                                      |
| D8 jedna data lokalna po stronie serwera                      | 5 (`localDate`), 7 (brak logiki dat w UI) |
| D9 osobny try/catch per źródło, `warnings`                    | 5 (testy awarii), 6                       |
| D10 `ActivityLog` zostaje, wypadają kafle KPI i liczniki      | 7                                         |
| `bc_projects.listNowTasks()`                                  | 2                                         |
| Złe daty `due` (np. `0006-08-26`)                             | 5 (`isPlausibleDate`)                     |
| Test architektury bez zmian; weryfikacja `yaml-store`         | 4 (krok 4), 6 (krok 4), 8                 |
| Weryfikacja mechanizmu 409                                    | 1 (korekta), 4, 6 (test 409)              |
| Sprawdzenie w przeglądarce na kopii vaulta, uczciwa adnotacja | 8                                         |
| Po wykonaniu: `tasks.md` w NEXUS                              | 8 (za zgodą)                              |

Spójność nazw: `readPinned`/`writePinned` (Task 4) = użycie w Task 5; `listNowTasks` → `{ tasks, warnings }` (Task 2) = Task 5; `getCockpit`/`setPinned` (Task 5) = router (Task 6); DTO `CockpitDto`, `TopicDto`, `QueueGroupDto`, `DayEventDto` (Task 3) = UI (Task 7); `MAX_PINNED` = 3 w `models` i literał w `schemas` (test w Tasku 3).
