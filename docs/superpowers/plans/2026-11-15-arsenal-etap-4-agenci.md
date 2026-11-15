# Arsenał, etap 4: Agenci i polecenia — plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zakładka „Agenci i polecenia” w karcie Arsenał: trzy sekcje z `Vault/Arsenal/agents.yaml` (kto do czego, presety poleceń `ask-helper`, skrypty), z dodawaniem, edycją, usuwaniem i kopiowaniem do schowka. Aplikacja niczego nie uruchamia.

**Architecture:** Dalszy ciąg etapu 3 w tym samym kontekście `contexts/bc_arsenal/`: nowy plik `repositories/agents.ts` na `lib/nexus/yaml-store`, reguły w `services.ts`, handlery w `router.ts`, trasy `app/api/arsenal/agents/**`. UI: zakładka `agents`, widok `AgentsView` z jednym formularzem wspólnym dla trzech rodzajów wpisu. Dane początkowe (z `CLAUDE.md` i `scripts/`) wpisuje się do Vaulta ręcznie w ostatnim zadaniu; aplikacja nie parsuje `CLAUDE.md`.

**Tech Stack:** Next.js 14, TypeScript, zod 4, `lib/nexus/yaml-store.ts`, i18next (namespace `agents`), Vitest + Testing Library.

Spec: `docs/superpowers/specs/2026-11-14-karta-arsenal-design.md` (§4.2, §6, §7 etap 4).

**Warunek wstępny:** etap 3 (Kursy) jest na `main`. Ten plan korzysta z jego wyników: folder `contexts/bc_arsenal/repositories/` (`index.ts` z `export *`), pomocnik `optionalText` w `schemas.ts`, `src/features/arsenal/apiError.ts`, `ApiFetch` z `useArsenal.ts`, zakładka `courses` w `CARD_SUBTABS`. Jeśli go nie ma, najpierw wykonaj plan `2026-11-15-arsenal-etap-3-kursy.md`.

## Decyzje podjęte w planie (do spec §4.2)

| #   | Decyzja                                                                                                                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| G1  | `yaml-store` zapisuje plik jako `version` + **jedna** lista (inne klucze najwyższego poziomu giną, `docs/nexus-vault-formaty-yaml.md`). Spec chce jednego pliku z trzema sekcjami, więc: jedna lista `items` z polem `kind` = `agent` / `preset` / `script`. |
| G2  | Pola: agent `name`, `role`, `model`\*, `when`\*; preset `name`, `command`, `description`\*; skrypt `name`, `path`, `description`\*, `example`\*. (\* opcjonalne). Wymagane są nazwa i pole główne (`role` / `command` / `path`).                             |
| G3  | Kolejność w UI = kolejność w pliku w obrębie rodzaju (lista „kto do czego” jest redagowana ręcznie, nie alfabetycznie). Sekcje zawsze w kolejności agenci, presety, skrypty.                                                                                 |
| G4  | Wpis bez `id`, `name`, nieznanym `kind` albo bez pola głównego jest pomijany z licznikiem „pominięto N”; reszta się ładuje (spec §6).                                                                                                                        |
| G5  | `PUT` przyjmuje pełny wpis (z `kind`); pola niedotyczące rodzaju są czyszczone w pliku. Formularz nie pozwala zmieniać rodzaju istniejącego wpisu.                                                                                                           |
| G6  | Presety i przykłady skryptów tylko kopiowane do schowka (`CopyButton`); nigdzie nie ma przycisku „uruchom”. Test to pilnuje.                                                                                                                                 |
| G7  | Test architektury nie zmienia się (nowy plik w już dozwolonym folderze `repositories/`).                                                                                                                                                                     |

## Struktura plików

| Plik                                                                                        | Zmiana      | Odpowiedzialność                                                         |
| ------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------ |
| `contexts/bc_arsenal/models.ts`                                                             | edycja      | typy wpisów, stałe, `AgentsOverview`                                     |
| `contexts/bc_arsenal/schemas.ts`                                                            | edycja      | `AgentEntryInputSchema` (union po `kind`), DTO i mapery                  |
| `contexts/bc_arsenal/repositories/agents.ts`, `repositories/index.ts`                       | nowy/edycja | `Arsenal/agents.yaml` ↔ modele                                           |
| `contexts/bc_arsenal/services.ts`                                                           | edycja      | `listAgents`, `createAgentEntry`, `updateAgentEntry`, `removeAgentEntry` |
| `contexts/bc_arsenal/router.ts`                                                             | edycja      | `getAgents`, `postAgentEntry`, `putAgentEntry`, `deleteAgentEntry`       |
| `app/api/arsenal/agents/route.ts`, `…/[entryId]/route.ts`                                   | nowe        | re-eksport handlerów                                                     |
| `src/features/arsenal/useAgents.ts`, `AgentsView.tsx`, `AgentEntryForm.tsx`                 | nowe        | widok zakładki                                                           |
| `src/features/arsenal/arsenal.css`                                                          | edycja      | klasy `.ag-*`                                                            |
| `src/i18n/locales/{pl,en}/agents.ts`, `resources.ts`, `index.ts`, `planning.ts`, `shell.ts` | nowe/edycja | namespace `agents`, etykiety zakładki                                    |
| `planningTab.ts`, `cards/cards.ts`, `PlanowanieView.tsx`, `MobileMoreDrawer.tsx`            | edycja      | zakładka `agents`                                                        |
| `docs/nexus-vault-formaty-yaml.md`                                                          | edycja      | format `Arsenal/agents.yaml`                                             |
| `NEXUS/Vault/Arsenal/agents.yaml`                                                           | nowy        | dane początkowe (osobne repo NEXUS, commit i push od razu)               |

Gałąź: `feat/arsenal-etap-4-agenci` z aktualnego `main`.

---

### Task 1: Gałąź, model i schematy wpisu

**Files:**

- Modify: `contexts/bc_arsenal/models.ts`, `contexts/bc_arsenal/schemas.ts`
- Test: `tests/unit/contexts/bc_arsenal/agents.schemas.test.ts`

- [ ] **Step 1: Gałąź i zielony punkt wyjścia**

```bash
cd ~/projects/Brain_7224/Monolith
git checkout main && git pull --ff-only
git checkout -b feat/arsenal-etap-4-agenci
npx vitest run tests/unit/contexts/bc_arsenal
```

Expected: PASS.

- [ ] **Step 2: Czerwony test**

`tests/unit/contexts/bc_arsenal/agents.schemas.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { AgentEntryInputSchema, toAgentEntryDto, toAgentsDto } from "@/contexts/bc_arsenal/schemas";

describe("AgentEntryInputSchema", () => {
  it("agent: wymaga nazwy i roli, przycina, puste pola opcjonalne = undefined", () => {
    const parsed = AgentEntryInputSchema.parse({
      kind: "agent",
      name: " agy ",
      role: " Review ",
      model: " ",
    });
    expect(parsed).toMatchObject({ kind: "agent", name: "agy", role: "Review" });
    expect("model" in parsed ? parsed.model : "x").toBeUndefined();
  });

  it("preset: wymaga polecenia; skrypt: wymaga ścieżki", () => {
    expect(
      AgentEntryInputSchema.safeParse({ kind: "preset", name: "P", command: " " }).success
    ).toBe(false);
    expect(AgentEntryInputSchema.safeParse({ kind: "script", name: "S", path: "" }).success).toBe(
      false
    );
    expect(
      AgentEntryInputSchema.safeParse({ kind: "preset", name: "P", command: "x" }).success
    ).toBe(true);
    expect(
      AgentEntryInputSchema.safeParse({ kind: "script", name: "S", path: "scripts/x.sh" }).success
    ).toBe(true);
  });

  it("odrzuca nieznany rodzaj i pustą nazwę", () => {
    expect(AgentEntryInputSchema.safeParse({ kind: "inny", name: "x" }).success).toBe(false);
    expect(AgentEntryInputSchema.safeParse({ kind: "agent", name: "", role: "r" }).success).toBe(
      false
    );
  });
});

describe("DTO", () => {
  it("pomija nieustawione pola opcjonalne i grupuje rodzaje", () => {
    const overview = {
      agents: [{ kind: "agent" as const, id: "a", name: "agy", role: "Review" }],
      presets: [
        { kind: "preset" as const, id: "p", name: "P", command: "cmd", description: "opis" },
      ],
      scripts: [{ kind: "script" as const, id: "s", name: "S", path: "scripts/x.sh" }],
      skipped: 2,
    };
    expect(toAgentEntryDto(overview.agents[0])).toEqual({
      kind: "agent",
      id: "a",
      name: "agy",
      role: "Review",
    });
    expect(toAgentsDto(overview)).toEqual({
      agents: [{ kind: "agent", id: "a", name: "agy", role: "Review" }],
      presets: [{ kind: "preset", id: "p", name: "P", command: "cmd", description: "opis" }],
      scripts: [{ kind: "script", id: "s", name: "S", path: "scripts/x.sh" }],
      skipped: 2,
    });
  });
});
```

- [ ] **Step 3: Czerwono**

Run: `npx vitest run tests/unit/contexts/bc_arsenal/agents.schemas.test.ts`
Expected: FAIL (brak eksportów).

- [ ] **Step 4: Modele**

Na końcu `contexts/bc_arsenal/models.ts`:

```ts
// ── agenci i polecenia (`Arsenal/agents.yaml`) ────────────────────────────────────

export const AGENTS_FILE = "Arsenal/agents.yaml";
/** Jedna lista na cały plik (G1): rodzaj wpisu w polu `kind`. */
export const AGENTS_KEY = "items";

export const AGENT_KINDS = ["agent", "preset", "script"] as const;
export type AgentKind = (typeof AGENT_KINDS)[number];

/** Kto do czego: agent, rola, model/tier, kiedy używać. */
export type AgentRow = {
  kind: "agent";
  id: string;
  name: string;
  role: string;
  model?: string;
  when?: string;
};

/** Szablon polecenia `ask-helper`; tylko do kopiowania. */
export type PresetRow = {
  kind: "preset";
  id: string;
  name: string;
  command: string;
  description?: string;
};

export type ScriptRow = {
  kind: "script";
  id: string;
  name: string;
  path: string;
  description?: string;
  example?: string;
};

export type AgentsEntry = AgentRow | PresetRow | ScriptRow;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
/** Pola edytowalne (formularz i `PUT`). */
export type AgentsEntryInput = DistributiveOmit<AgentsEntry, "id">;

export type AgentsOverview = {
  agents: AgentRow[];
  presets: PresetRow[];
  scripts: ScriptRow[];
  skipped: number;
};
```

- [ ] **Step 5: Schematy**

W `contexts/bc_arsenal/schemas.ts` dopisz na końcu (pomocnik `optionalText` powstał w etapie 3 w tym samym pliku):

```ts
// ── agenci i polecenia ───────────────────────────────────────────────────────────

const requiredText = (max: number) => z.string().trim().min(1).max(max);

const AgentInputSchema = z.object({
  kind: z.literal("agent"),
  name: requiredText(100),
  role: requiredText(500),
  model: optionalText(200),
  when: optionalText(1000),
});
const PresetInputSchema = z.object({
  kind: z.literal("preset"),
  name: requiredText(100),
  command: requiredText(2000),
  description: optionalText(1000),
});
const ScriptInputSchema = z.object({
  kind: z.literal("script"),
  name: requiredText(100),
  path: requiredText(300),
  description: optionalText(1000),
  example: optionalText(2000),
});

/** Body `POST /api/arsenal/agents` i `PUT /api/arsenal/agents/[entryId]`. */
export const AgentEntryInputSchema = z.discriminatedUnion("kind", [
  AgentInputSchema,
  PresetInputSchema,
  ScriptInputSchema,
]);
export type AgentEntryInputDto = z.input<typeof AgentEntryInputSchema>;

const AgentRowDtoSchema = z.object({
  kind: z.literal("agent"),
  id: z.string(),
  name: z.string(),
  role: z.string(),
  model: z.string().optional(),
  when: z.string().optional(),
});
const PresetRowDtoSchema = z.object({
  kind: z.literal("preset"),
  id: z.string(),
  name: z.string(),
  command: z.string(),
  description: z.string().optional(),
});
const ScriptRowDtoSchema = z.object({
  kind: z.literal("script"),
  id: z.string(),
  name: z.string(),
  path: z.string(),
  description: z.string().optional(),
  example: z.string().optional(),
});

export const AgentEntryDtoSchema = z.discriminatedUnion("kind", [
  AgentRowDtoSchema,
  PresetRowDtoSchema,
  ScriptRowDtoSchema,
]);
export const AgentsDtoSchema = z.object({
  agents: z.array(AgentRowDtoSchema),
  presets: z.array(PresetRowDtoSchema),
  scripts: z.array(ScriptRowDtoSchema),
  skipped: z.number(),
});

export type AgentEntryDto = z.infer<typeof AgentEntryDtoSchema>;
export type AgentRowDto = z.infer<typeof AgentRowDtoSchema>;
export type PresetRowDto = z.infer<typeof PresetRowDtoSchema>;
export type ScriptRowDto = z.infer<typeof ScriptRowDtoSchema>;
export type AgentsDto = z.infer<typeof AgentsDtoSchema>;

export function toAgentEntryDto(entry: AgentsEntry): AgentEntryDto {
  const optional = (key: string, value: string | undefined) =>
    value === undefined ? {} : { [key]: value };
  switch (entry.kind) {
    case "agent":
      return {
        kind: "agent",
        id: entry.id,
        name: entry.name,
        role: entry.role,
        ...optional("model", entry.model),
        ...optional("when", entry.when),
      };
    case "preset":
      return {
        kind: "preset",
        id: entry.id,
        name: entry.name,
        command: entry.command,
        ...optional("description", entry.description),
      };
    case "script":
      return {
        kind: "script",
        id: entry.id,
        name: entry.name,
        path: entry.path,
        ...optional("description", entry.description),
        ...optional("example", entry.example),
      };
  }
}

export function toAgentsDto(overview: AgentsOverview): AgentsDto {
  return {
    agents: overview.agents.map((e) => toAgentEntryDto(e) as AgentRowDto),
    presets: overview.presets.map((e) => toAgentEntryDto(e) as PresetRowDto),
    scripts: overview.scripts.map((e) => toAgentEntryDto(e) as ScriptRowDto),
    skipped: overview.skipped,
  };
}
```

Importy na górze `schemas.ts` rozszerz o `type AgentsEntry, type AgentsOverview` z `./models`.

- [ ] **Step 6: Zielono**

Run: `npx vitest run tests/unit/contexts/bc_arsenal/agents.schemas.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add contexts/bc_arsenal tests/unit/contexts/bc_arsenal/agents.schemas.test.ts
git commit -m "feat(arsenal): model i schematy wpisów agentów, presetów i skryptów

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Repozytorium `agents.yaml`

**Files:**

- Create: `contexts/bc_arsenal/repositories/agents.ts`
- Modify: `contexts/bc_arsenal/repositories/index.ts`
- Test: `tests/unit/contexts/bc_arsenal/agents.repositories.test.ts`

- [ ] **Step 1: Czerwony test**

`tests/unit/contexts/bc_arsenal/agents.repositories.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseYamlList } from "@/lib/nexus/yaml-lists";
import {
  deleteAgentEntry,
  insertAgentEntry,
  readAgentEntries,
  replaceAgentEntry,
} from "@/contexts/bc_arsenal/repositories";
import { setupTempVault } from "../../helpers/tempVault";

const FILE = "Arsenal/agents.yaml";
const vault = setupTempVault();

const HAND_WRITTEN = `version: 1
items:
  - id: a1
    kind: agent
    name: agy
    role: Review i wyszukiwanie
    model: Gemini Flash
    when: Pytania o kod
    x_extra: zostaje
  - id: p1
    kind: preset
    name: Review diffa
    command: scripts/ask-helper.sh --role review agy "<co sprawdzić>"
  - id: s1
    kind: script
    name: ask-helper
    path: scripts/ask-helper.sh
    description: Wysyła prompt do pomocnika
    example: scripts/ask-helper.sh agy "pytanie"
  - id: b1
    kind: agent
    name: Bez roli
  - id: b2
    kind: nieznany
    name: X
  - name: Bez id
    kind: preset
    command: x
`;

const stored = () => parseYamlList(vault.read(FILE)!, "items").items;

describe("readAgentEntries", () => {
  it("brak pliku = pusta lista", () => {
    expect(readAgentEntries()).toEqual({ entries: [], skipped: 0 });
  });

  it("mapuje trzy rodzaje w kolejności pliku i liczy pominięte", () => {
    vault.write(FILE, HAND_WRITTEN);
    const { entries, skipped } = readAgentEntries();
    expect(skipped).toBe(3);
    expect(entries).toEqual([
      {
        kind: "agent",
        id: "a1",
        name: "agy",
        role: "Review i wyszukiwanie",
        model: "Gemini Flash",
        when: "Pytania o kod",
      },
      {
        kind: "preset",
        id: "p1",
        name: "Review diffa",
        command: 'scripts/ask-helper.sh --role review agy "<co sprawdzić>"',
      },
      {
        kind: "script",
        id: "s1",
        name: "ask-helper",
        path: "scripts/ask-helper.sh",
        description: "Wysyła prompt do pomocnika",
        example: 'scripts/ask-helper.sh agy "pytanie"',
      },
    ]);
  });
});

describe("insertAgentEntry", () => {
  it("dopisuje wpis z id i z kluczami w kolejności kind, name, pola; bez pustych", async () => {
    const entry = await insertAgentEntry({ kind: "preset", name: "P", command: "cmd" });
    expect(entry.id).toMatch(/^[A-Za-z0-9]{20}$/);
    const [item] = stored();
    expect(Object.keys(item)).toEqual(["id", "kind", "name", "command"]);
  });
});

describe("replaceAgentEntry", () => {
  it("zmiana rodzaju czyści pola poprzedniego rodzaju, nieznane klucze zostają", async () => {
    vault.write(FILE, HAND_WRITTEN);
    await replaceAgentEntry("a1", { kind: "preset", name: "Z agenta", command: "cmd" });
    const item = stored().find((i) => i.id === "a1")!;
    expect(item).toMatchObject({
      kind: "preset",
      name: "Z agenta",
      command: "cmd",
      x_extra: "zostaje",
    });
    for (const key of ["role", "model", "when"]) expect(key in item).toBe(false);
    expect(stored()).toHaveLength(6); // pominięte wpisy przeżywają zapis
  });

  it("puste pola opcjonalne kasują klucze", async () => {
    vault.write(FILE, HAND_WRITTEN);
    await replaceAgentEntry("s1", {
      kind: "script",
      name: "ask-helper",
      path: "scripts/ask-helper.sh",
    });
    const item = stored().find((i) => i.id === "s1")!;
    expect("description" in item).toBe(false);
    expect("example" in item).toBe(false);
  });

  it("nieistniejące id to błąd 404", async () => {
    vault.write(FILE, HAND_WRITTEN);
    await expect(
      replaceAgentEntry("brak", { kind: "agent", name: "x", role: "r" })
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("deleteAgentEntry", () => {
  it("usuwa wpis; brak wpisu nie zmienia pliku", async () => {
    vault.write(FILE, HAND_WRITTEN);
    await deleteAgentEntry("p1");
    expect(stored().map((i) => i.id)).not.toContain("p1");
    const before = vault.read(FILE);
    await deleteAgentEntry("brak");
    expect(vault.read(FILE)).toBe(before);
  });
});
```

- [ ] **Step 2: Czerwono**

Run: `npx vitest run tests/unit/contexts/bc_arsenal/agents.repositories.test.ts`
Expected: FAIL (brak eksportów).

- [ ] **Step 3: Implementacja**

`contexts/bc_arsenal/repositories/agents.ts`:

```ts
import type { YamlRecord } from "@/lib/nexus/yaml-lists";
import { readList } from "@/lib/nexus/yaml-store";
import {
  appendRecord,
  generateId,
  optStr,
  patchRecord,
  removeRecord,
} from "@/lib/nexus/record-helpers";
import { AGENTS_FILE, AGENTS_KEY, type AgentsEntry, type AgentsEntryInput } from "../models";

/** `null` = wpis uszkodzony (brak id/nazwy, nieznany rodzaj albo brak pola głównego). */
function toEntry(record: YamlRecord): AgentsEntry | null {
  const id = optStr(record.id);
  const name = optStr(record.name);
  if (id === undefined || name === undefined) return null;
  const description = optStr(record.description);
  switch (record.kind) {
    case "agent": {
      const role = optStr(record.role);
      if (role === undefined) return null;
      const model = optStr(record.model);
      const when = optStr(record.when);
      return {
        kind: "agent",
        id,
        name,
        role,
        ...(model !== undefined && { model }),
        ...(when !== undefined && { when }),
      };
    }
    case "preset": {
      const command = optStr(record.command);
      if (command === undefined) return null;
      return {
        kind: "preset",
        id,
        name,
        command,
        ...(description !== undefined && { description }),
      };
    }
    case "script": {
      const path = optStr(record.path);
      if (path === undefined) return null;
      const example = optStr(record.example);
      return {
        kind: "script",
        id,
        name,
        path,
        ...(description !== undefined && { description }),
        ...(example !== undefined && { example }),
      };
    }
    default:
      return null;
  }
}

/** Wszystkie klucze rodzajów; `undefined` kasuje klucz przy `patchRecord` i jest pomijane przy dopisywaniu. */
const CLEARED = {
  role: undefined,
  model: undefined,
  when: undefined,
  command: undefined,
  path: undefined,
  description: undefined,
  example: undefined,
};

/** Kolejność kluczy: `kind`, `name`, potem pola w kolejności `CLEARED` (stały układ pliku). */
function toFields(input: AgentsEntryInput): Record<string, unknown> {
  const base = { kind: input.kind, name: input.name, ...CLEARED };
  switch (input.kind) {
    case "agent":
      return { ...base, role: input.role, model: input.model, when: input.when };
    case "preset":
      return { ...base, command: input.command, description: input.description };
    case "script":
      return { ...base, path: input.path, description: input.description, example: input.example };
  }
}

export function readAgentEntries(): { entries: AgentsEntry[]; skipped: number } {
  const entries: AgentsEntry[] = [];
  let skipped = 0;
  for (const record of readList(AGENTS_FILE, AGENTS_KEY)) {
    const entry = toEntry(record);
    if (entry === null) skipped += 1;
    else entries.push(entry);
  }
  return { entries, skipped };
}

export async function insertAgentEntry(input: AgentsEntryInput): Promise<AgentsEntry> {
  const record = await appendRecord(AGENTS_FILE, AGENTS_KEY, (taken) => ({
    id: generateId(taken),
    ...toFields(input),
  }));
  const entry = toEntry(record);
  if (entry === null) throw new Error("Zapisany wpis jest niepoprawny"); // walidacja jest w schemacie
  return entry;
}

export async function replaceAgentEntry(id: string, input: AgentsEntryInput): Promise<void> {
  await patchRecord(AGENTS_FILE, AGENTS_KEY, id, toFields(input), "Wpis nie istnieje");
}

export async function deleteAgentEntry(id: string): Promise<void> {
  await removeRecord(AGENTS_FILE, AGENTS_KEY, id);
}
```

`contexts/bc_arsenal/repositories/index.ts` (po etapie 3 ma dwa wiersze, dopisz trzeci):

```ts
export * from "./skills";
export * from "./courses";
export * from "./agents";
```

- [ ] **Step 4: Zielono**

Run: `npx vitest run tests/unit/contexts/bc_arsenal tests/unit/architecture.static.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add contexts/bc_arsenal tests/unit/contexts/bc_arsenal/agents.repositories.test.ts
git commit -m "feat(arsenal): repozytorium agents.yaml (jedna lista, rodzaj w polu kind)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Serwis

**Files:**

- Modify: `contexts/bc_arsenal/services.ts`
- Test: `tests/unit/contexts/bc_arsenal/agents.services.test.ts`

- [ ] **Step 1: Czerwony test**

`tests/unit/contexts/bc_arsenal/agents.services.test.ts`:

```ts
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({
  readAgentEntries: vi.fn(),
  insertAgentEntry: vi.fn(),
  replaceAgentEntry: vi.fn(),
  deleteAgentEntry: vi.fn(),
}));
vi.mock("@/contexts/bc_arsenal/repositories", () => ({
  readPromptFiles: vi.fn(),
  readSkillFiles: vi.fn(),
  readTemplates: vi.fn(),
  writeDeployed: vi.fn(),
  readCourses: vi.fn(),
  insertCourse: vi.fn(),
  replaceCourse: vi.fn(),
  removeCourse: vi.fn(),
  certificateExists: vi.fn(),
  ...repo,
}));
vi.mock("@/contexts/bc_projects/services", () => ({
  listProjects: vi.fn(),
  hasCompanyData: vi.fn(),
}));

import {
  createAgentEntry,
  listAgents,
  removeAgentEntry,
  updateAgentEntry,
} from "@/contexts/bc_arsenal/services";

const agent = { kind: "agent" as const, id: "a1", name: "agy", role: "Review" };
const preset = { kind: "preset" as const, id: "p1", name: "P", command: "cmd" };
const script = { kind: "script" as const, id: "s1", name: "S", path: "scripts/x.sh" };

beforeEach(() => Object.values(repo).forEach((fn) => fn.mockReset()));

describe("listAgents", () => {
  it("grupuje wg rodzaju z zachowaniem kolejności pliku i przekazuje licznik pominiętych", () => {
    const agent2 = { ...agent, id: "a2", name: "cursor" };
    repo.readAgentEntries.mockReturnValue({ entries: [script, agent, preset, agent2], skipped: 4 });
    expect(listAgents()).toEqual({
      agents: [agent, agent2],
      presets: [preset],
      scripts: [script],
      skipped: 4,
    });
  });
});

describe("createAgentEntry", () => {
  it("zwraca wpis z repozytorium", async () => {
    repo.insertAgentEntry.mockResolvedValue(preset);
    const input = { kind: "preset" as const, name: "P", command: "cmd" };
    expect(await createAgentEntry(input)).toEqual(preset);
    expect(repo.insertAgentEntry).toHaveBeenCalledWith(input);
  });
});

describe("updateAgentEntry", () => {
  it("zapisuje i zwraca świeży wpis", async () => {
    repo.replaceAgentEntry.mockResolvedValue(undefined);
    repo.readAgentEntries.mockReturnValue({ entries: [agent], skipped: 0 });
    const input = { kind: "agent" as const, name: "agy", role: "Review" };
    expect(await updateAgentEntry("a1", input)).toEqual(agent);
    expect(repo.replaceAgentEntry).toHaveBeenCalledWith("a1", input);
  });

  it("wpis, który zniknął po zapisie, to 404", async () => {
    repo.replaceAgentEntry.mockResolvedValue(undefined);
    repo.readAgentEntries.mockReturnValue({ entries: [], skipped: 0 });
    await expect(
      updateAgentEntry("a1", { kind: "agent", name: "x", role: "r" })
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("removeAgentEntry", () => {
  it("deleguje do repozytorium", async () => {
    repo.deleteAgentEntry.mockResolvedValue(undefined);
    await removeAgentEntry("a1");
    expect(repo.deleteAgentEntry).toHaveBeenCalledWith("a1");
  });
});
```

- [ ] **Step 2: Czerwono**

Run: `npx vitest run tests/unit/contexts/bc_arsenal/agents.services.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementacja**

W `contexts/bc_arsenal/services.ts` do importu typów z `./models` dodaj `type AgentRow, type AgentsEntry, type AgentsEntryInput, type AgentsOverview, type PresetRow, type ScriptRow`, a do importu z `./repositories` dodaj `deleteAgentEntry, insertAgentEntry, readAgentEntries, replaceAgentEntry` (zachowaj kolejność alfabetyczną jak w istniejącym imporcie). Na końcu pliku dopisz:

```ts
// ── agenci i polecenia ───────────────────────────────────────────────────────────

export function listAgents(): AgentsOverview {
  const { entries, skipped } = readAgentEntries();
  return {
    agents: entries.filter((e): e is AgentRow => e.kind === "agent"),
    presets: entries.filter((e): e is PresetRow => e.kind === "preset"),
    scripts: entries.filter((e): e is ScriptRow => e.kind === "script"),
    skipped,
  };
}

export async function createAgentEntry(input: AgentsEntryInput): Promise<AgentsEntry> {
  return insertAgentEntry(input);
}

export async function updateAgentEntry(id: string, input: AgentsEntryInput): Promise<AgentsEntry> {
  await replaceAgentEntry(id, input);
  const found = readAgentEntries().entries.find((entry) => entry.id === id);
  if (found === undefined) throw new DomainError("Wpis nie istnieje", 404);
  return found;
}

export async function removeAgentEntry(id: string): Promise<void> {
  await deleteAgentEntry(id);
}
```

- [ ] **Step 4: Zielono**

Run: `npx vitest run tests/unit/contexts/bc_arsenal tests/unit/architecture.static.test.ts && npx tsc --noEmit`
Expected: PASS. (Testy serwisów kursów z etapu 3 mockują `repositories` bez funkcji agentów; to nie przeszkadza, bo odwołanie do brakującego eksportu mocka rzuca dopiero przy wywołaniu.)

- [ ] **Step 5: Commit**

```bash
git add contexts/bc_arsenal tests/unit/contexts/bc_arsenal/agents.services.test.ts
git commit -m "feat(arsenal): serwis agentów i poleceń

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Router i trasy API

**Files:**

- Modify: `contexts/bc_arsenal/router.ts`
- Create: `app/api/arsenal/agents/route.ts`, `app/api/arsenal/agents/[entryId]/route.ts`
- Test: `tests/unit/contexts/bc_arsenal/agents.router.test.ts`

- [ ] **Step 1: Czerwony test**

`tests/unit/contexts/bc_arsenal/agents.router.test.ts`:

```ts
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "@/lib/errors";

const svc = vi.hoisted(() => ({
  listAgents: vi.fn(),
  createAgentEntry: vi.fn(),
  updateAgentEntry: vi.fn(),
  removeAgentEntry: vi.fn(),
}));
vi.mock("@/contexts/bc_arsenal/services", () => svc);

import {
  deleteAgentEntry,
  getAgents,
  postAgentEntry,
  putAgentEntry,
} from "@/contexts/bc_arsenal/router";

const preset = { kind: "preset" as const, id: "p1", name: "P", command: "cmd" };
const ctx = { params: Promise.resolve({ entryId: "p1" }) };
const req = (body: unknown, method = "POST") =>
  new Request("http://localhost/api/arsenal/agents", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const valid = { kind: "preset", name: " P ", command: "cmd" };

beforeEach(() => Object.values(svc).forEach((fn) => fn.mockReset()));

describe("getAgents", () => {
  it("200 z DTO", async () => {
    svc.listAgents.mockReturnValue({ agents: [], presets: [preset], scripts: [], skipped: 1 });
    const res = await getAgents();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ agents: [], presets: [preset], scripts: [], skipped: 1 });
  });

  it("błąd domenowy zachowuje status", async () => {
    svc.listAgents.mockImplementation(() => {
      throw new DomainError("źle", 409);
    });
    expect((await getAgents()).status).toBe(409);
  });
});

describe("postAgentEntry", () => {
  it("201 i przycięte dane do serwisu", async () => {
    svc.createAgentEntry.mockResolvedValue(preset);
    const res = await postAgentEntry(req(valid));
    expect(res.status).toBe(201);
    expect(svc.createAgentEntry).toHaveBeenCalledWith(expect.objectContaining({ name: "P" }));
  });

  it("400 dla nieznanego rodzaju i braku pola głównego", async () => {
    expect((await postAgentEntry(req({ kind: "x", name: "N" }))).status).toBe(400);
    expect((await postAgentEntry(req({ kind: "preset", name: "N" }))).status).toBe(400);
    expect(svc.createAgentEntry).not.toHaveBeenCalled();
  });
});

describe("putAgentEntry", () => {
  it("200 z DTO", async () => {
    svc.updateAgentEntry.mockResolvedValue(preset);
    const res = await putAgentEntry(req(valid, "PUT"), ctx);
    expect(res.status).toBe(200);
    expect(svc.updateAgentEntry).toHaveBeenCalledWith("p1", expect.objectContaining({ name: "P" }));
  });

  it("404 gdy serwis zgłasza brak wpisu", async () => {
    svc.updateAgentEntry.mockRejectedValue(new DomainError("Wpis nie istnieje", 404));
    expect((await putAgentEntry(req(valid, "PUT"), ctx)).status).toBe(404);
  });
});

describe("deleteAgentEntry", () => {
  it("204", async () => {
    svc.removeAgentEntry.mockResolvedValue(undefined);
    const res = await deleteAgentEntry(
      new Request("http://localhost/x", { method: "DELETE" }),
      ctx
    );
    expect(res.status).toBe(204);
    expect(svc.removeAgentEntry).toHaveBeenCalledWith("p1");
  });
});
```

- [ ] **Step 2: Czerwono**

Run: `npx vitest run tests/unit/contexts/bc_arsenal/agents.router.test.ts`
Expected: FAIL.

- [ ] **Step 3: Router**

W `contexts/bc_arsenal/router.ts` dodaj do importu z `./schemas`: `AgentEntryInputSchema, toAgentEntryDto, toAgentsDto` i dopisz na końcu pliku:

```ts
type EntryContext = { params: Promise<{ entryId: string }> };

export async function getAgents(): Promise<NextResponse> {
  try {
    return NextResponse.json(toAgentsDto(services.listAgents()));
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function postAgentEntry(request: Request): Promise<NextResponse> {
  const parsed = await parseBody(request, AgentEntryInputSchema);
  if (parsed.success === false) return parsed.response;
  try {
    return NextResponse.json(toAgentEntryDto(await services.createAgentEntry(parsed.data)), {
      status: 201,
    });
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function putAgentEntry(request: Request, ctx: EntryContext): Promise<NextResponse> {
  const parsed = await parseBody(request, AgentEntryInputSchema);
  if (parsed.success === false) return parsed.response;
  try {
    const { entryId } = await ctx.params;
    return NextResponse.json(
      toAgentEntryDto(await services.updateAgentEntry(entryId, parsed.data))
    );
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function deleteAgentEntry(
  _request: Request,
  ctx: EntryContext
): Promise<NextResponse> {
  try {
    const { entryId } = await ctx.params;
    await services.removeAgentEntry(entryId);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleServiceError(err);
  }
}
```

- [ ] **Step 4: Trasy**

`app/api/arsenal/agents/route.ts`:

```ts
export { getAgents as GET, postAgentEntry as POST } from "@/contexts/bc_arsenal/router";
```

`app/api/arsenal/agents/[entryId]/route.ts`:

```ts
export { putAgentEntry as PUT, deleteAgentEntry as DELETE } from "@/contexts/bc_arsenal/router";
```

- [ ] **Step 5: Zielono**

Run: `npx vitest run tests/unit/contexts/bc_arsenal tests/unit/architecture.static.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add contexts/bc_arsenal app/api/arsenal/agents tests/unit/contexts/bc_arsenal/agents.router.test.ts
git commit -m "feat(arsenal): API agentów i poleceń (/api/arsenal/agents)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Tłumaczenia (namespace `agents`) i etykiety zakładki

**Files:**

- Create: `src/i18n/locales/pl/agents.ts`, `src/i18n/locales/en/agents.ts`
- Modify: `src/i18n/resources.ts`, `src/i18n/index.ts`, `src/i18n/locales/{pl,en}/planning.ts`, `src/i18n/locales/{pl,en}/shell.ts`

Czerwony test: `tests/unit/i18n/parity.test.ts`.

- [ ] **Step 1: Zarejestruj namespace**

W `src/i18n/resources.ts` dodaj importy `agents as plAgents` / `agents as enAgents` z `./locales/{pl,en}/agents`, w obiektach `pl` i `en` wpisy `agents: plAgents,` / `agents: enAgents,` (po `courses`). W `src/i18n/index.ts` dodaj `"agents"` do `ns` (po `"courses"`).

Run: `npx vitest run tests/unit/i18n/parity.test.ts`
Expected: FAIL (brak plików).

- [ ] **Step 2: Słowniki**

`src/i18n/locales/pl/agents.ts`:

```ts
export const agents = {
  title: "Agenci i polecenia",
  count_one: "{{count}} wpis",
  count_few: "{{count}} wpisy",
  count_many: "{{count}} wpisów",
  count_other: "{{count}} wpisu",
  skippedSuffix: " · pominięto {{count}} (uszkodzone wpisy)",
  loading: "Ładowanie",
  copyHint: "Tylko do kopiowania: aplikacja niczego nie uruchamia.",
  sectionAgents: "Kto do czego",
  sectionPresets: "Presety poleceń",
  sectionScripts: "Skrypty",
  addAgent: "Dodaj agenta",
  addPreset: "Dodaj preset",
  addScript: "Dodaj skrypt",
  emptyAgents: "Brak agentów.",
  emptyPresets: "Brak presetów.",
  emptyScripts: "Brak skryptów.",
  edit: "Edytuj",
  delete: "Usuń",
  deleteConfirm: "Usunąć wpis „{{name}}”?",
  save: "Zapisz",
  cancel: "Anuluj",
  kindAgent: "agent",
  kindPreset: "preset",
  kindScript: "skrypt",
  formAddTitle: "Nowy wpis: {{kind}}",
  formEditTitle: "Edycja wpisu: {{kind}}",
  fieldName: "Nazwa",
  fieldRole: "Rola",
  fieldModel: "Model / tier",
  fieldWhen: "Kiedy używać",
  fieldCommand: "Szablon polecenia",
  fieldDescription: "Opis",
  fieldPath: "Ścieżka skryptu",
  fieldExample: "Przykład użycia",
  copyCommand: "Kopiuj polecenie",
  copyExample: "Kopiuj przykład",
};
```

`src/i18n/locales/en/agents.ts`:

```ts
export const agents = {
  title: "Agents and commands",
  count_one: "{{count}} entry",
  count_other: "{{count}} entries",
  skippedSuffix: " · skipped {{count}} (corrupt entries)",
  loading: "Loading",
  copyHint: "Copy only: the app never runs anything.",
  sectionAgents: "Who does what",
  sectionPresets: "Command presets",
  sectionScripts: "Scripts",
  addAgent: "Add agent",
  addPreset: "Add preset",
  addScript: "Add script",
  emptyAgents: "No agents.",
  emptyPresets: "No presets.",
  emptyScripts: "No scripts.",
  edit: "Edit",
  delete: "Delete",
  deleteConfirm: "Delete the entry “{{name}}”?",
  save: "Save",
  cancel: "Cancel",
  kindAgent: "agent",
  kindPreset: "preset",
  kindScript: "script",
  formAddTitle: "New entry: {{kind}}",
  formEditTitle: "Edit entry: {{kind}}",
  fieldName: "Name",
  fieldRole: "Role",
  fieldModel: "Model / tier",
  fieldWhen: "When to use",
  fieldCommand: "Command template",
  fieldDescription: "Description",
  fieldPath: "Script path",
  fieldExample: "Usage example",
  copyCommand: "Copy command",
  copyExample: "Copy example",
};
```

- [ ] **Step 3: Etykiety zakładki**

`src/i18n/locales/pl/planning.ts`: po `tabCourses` dodaj `tabAgents: "Agenci i polecenia",`; `en/planning.ts`: `tabAgents: "Agents & commands",`. `pl/shell.ts` w `drawer` po `courses` dodaj `agents: "Agenci i polecenia",`; `en/shell.ts`: `agents: "Agents & commands",`.

- [ ] **Step 4: Zielono**

Run: `npx vitest run tests/unit/i18n && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/i18n
git commit -m "feat(i18n): namespace agents (PL/EN) i etykiety zakładki Agenci i polecenia

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Hook `useAgents`

**Files:**

- Create: `src/features/arsenal/useAgents.ts`
- Test: `tests/unit/features/arsenal/useAgents.test.tsx`

- [ ] **Step 1: Czerwony test**

`tests/unit/features/arsenal/useAgents.test.tsx`:

```ts
import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useAgents } from "@/src/features/arsenal/useAgents";

const overview = {
  agents: [{ kind: "agent", id: "a1", name: "agy", role: "Review" }],
  presets: [],
  scripts: [],
  skipped: 1,
};
const json = (body: unknown, ok = true, status = 200) =>
  ({ ok, status, json: async () => body }) as Response;

function setup(handler?: (url: string, init?: RequestInit) => Response) {
  const apiFetch = vi.fn(async (url: string, init?: RequestInit) =>
    handler ? handler(url, init) : json(overview)
  );
  return { apiFetch, ...renderHook(() => useAgents(apiFetch)) };
}

const input = { kind: "preset" as const, name: "P", command: "cmd" };

describe("useAgents", () => {
  it("ładuje trzy sekcje i licznik pominiętych", async () => {
    const { result, apiFetch } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(apiFetch).toHaveBeenCalledWith("/api/arsenal/agents");
    expect(result.current.agents.map((a) => a.id)).toEqual(["a1"]);
    expect(result.current.presets).toEqual([]);
    expect(result.current.skipped).toBe(1);
  });

  it("błąd ładowania trafia do `error`", async () => {
    const { result } = setup(() => json({ error: "Zepsute" }, false, 500));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Zepsute");
  });

  it("save bez id robi POST, z id robi PUT, potem odświeża listę", async () => {
    const { result, apiFetch } = setup((_url, init) => json(init?.method ? {} : overview));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.save(input));
    const post = apiFetch.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(post[0]).toBe("/api/arsenal/agents");
    expect(JSON.parse(post[1]!.body as string)).toEqual(input);
    await act(() => result.current.save(input, "a1"));
    expect(
      apiFetch.mock.calls.some(
        ([url, init]) => url === "/api/arsenal/agents/a1" && init?.method === "PUT"
      )
    ).toBe(true);
    expect(apiFetch.mock.calls.filter(([, init]) => init === undefined)).toHaveLength(3);
  });

  it("save przy błędzie serwera rzuca z komunikatem serwera", async () => {
    const { result } = setup((_url, init) =>
      init?.method === "POST" ? json({ error: "Brak roli" }, false, 400) : json(overview)
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    await expect(act(() => result.current.save(input))).rejects.toThrow("Brak roli");
  });

  it("remove robi DELETE i odświeża listę", async () => {
    const { result, apiFetch } = setup((_url, init) =>
      init?.method === "DELETE" ? ({ ok: true, status: 204 } as Response) : json(overview)
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.remove("a1"));
    expect(
      apiFetch.mock.calls.some(
        ([url, init]) => url === "/api/arsenal/agents/a1" && init?.method === "DELETE"
      )
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Czerwono**

Run: `npx vitest run tests/unit/features/arsenal/useAgents.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Hook**

`src/features/arsenal/useAgents.ts`:

```ts
import { useCallback, useEffect, useState } from "react";
import {
  AgentsDtoSchema,
  type AgentEntryInputDto,
  type AgentRowDto,
  type PresetRowDto,
  type ScriptRowDto,
} from "@/contexts/bc_arsenal/schemas";
import { errorText, messageOf } from "./apiError";
import type { ApiFetch } from "./useArsenal";

const BASE = "/api/arsenal/agents";

export function useAgents(apiFetch: ApiFetch) {
  const [agents, setAgents] = useState<AgentRowDto[]>([]);
  const [presets, setPresets] = useState<PresetRowDto[]>([]);
  const [scripts, setScripts] = useState<ScriptRowDto[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const res = await apiFetch(BASE);
    if (!res.ok) throw new Error(await errorText(res));
    const data = AgentsDtoSchema.parse(await res.json());
    setAgents(data.agents);
    setPresets(data.presets);
    setScripts(data.scripts);
    setSkipped(data.skipped);
    setError(null);
  }, [apiFetch]);

  useEffect(() => {
    refetch()
      .catch((err) => setError(messageOf(err)))
      .finally(() => setLoading(false));
  }, [refetch]);

  /** Bez `id` tworzy wpis (POST), z `id` zapisuje zmiany (PUT); błąd rzuca z komunikatem serwera. */
  const save = useCallback(
    async (input: AgentEntryInputDto, id?: string): Promise<void> => {
      const res = await apiFetch(id === undefined ? BASE : `${BASE}/${encodeURIComponent(id)}`, {
        method: id === undefined ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await errorText(res));
      await refetch();
    },
    [apiFetch, refetch]
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      const res = await apiFetch(`${BASE}/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await errorText(res));
      await refetch();
    },
    [apiFetch, refetch]
  );

  return { agents, presets, scripts, skipped, loading, error, save, remove };
}
```

- [ ] **Step 4: Zielono**

Run: `npx vitest run tests/unit/features/arsenal/useAgents.test.tsx && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/arsenal/useAgents.ts tests/unit/features/arsenal/useAgents.test.tsx
git commit -m "feat(arsenal): hook useAgents

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Widok `AgentsView` i formularz

**Files:**

- Create: `src/features/arsenal/AgentsView.tsx`, `src/features/arsenal/AgentEntryForm.tsx`
- Modify: `src/features/arsenal/arsenal.css` (dopisz na końcu)
- Test: `tests/unit/features/arsenal/AgentsView.test.tsx`

- [ ] **Step 1: Czerwony test**

`tests/unit/features/arsenal/AgentsView.test.tsx`:

```tsx
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AgentsView } from "@/src/features/arsenal/AgentsView";
import { setLanguage } from "@/src/i18n";

afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  await act(async () => {
    await setLanguage("pl");
  });
});

const overview = {
  agents: [
    {
      kind: "agent",
      id: "a1",
      name: "agy",
      role: "Review i wyszukiwanie",
      model: "Gemini Flash",
      when: "Pytania o kod",
    },
  ],
  presets: [
    {
      kind: "preset",
      id: "p1",
      name: "Review diffa",
      command: 'scripts/ask-helper.sh --role review agy "x"',
      description: "Niezależna opinia",
    },
  ],
  scripts: [
    {
      kind: "script",
      id: "s1",
      name: "ask-helper",
      path: "scripts/ask-helper.sh",
      description: "Wysyła prompt",
      example: 'scripts/ask-helper.sh agy "pytanie"',
    },
  ],
  skipped: 2,
};

const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;

function setup() {
  const apiFetch = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === "DELETE"
      ? ({ ok: true, status: 204 } as Response)
      : json(init?.method ? {} : overview)
  );
  render(<AgentsView apiFetch={apiFetch} />);
  return apiFetch;
}

describe("AgentsView", () => {
  it("pokazuje trzy sekcje z wpisami i licznik pominiętych", async () => {
    setup();
    expect(await screen.findByRole("heading", { name: "Kto do czego" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Presety poleceń" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Skrypty" })).toBeInTheDocument();
    expect(screen.getByText("Review i wyszukiwanie")).toBeInTheDocument();
    expect(screen.getByText("scripts/ask-helper.sh")).toBeInTheDocument();
    expect(screen.getByText(/pominięto 2/)).toBeInTheDocument();
  });

  it("kopiuje polecenie presetu i przykład skryptu do schowka; nie ma przycisku uruchamiania", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    setup();
    const preset = (await screen.findByText("Review diffa")).closest("article")!;
    await userEvent.click(within(preset).getByRole("button", { name: "Kopiuj polecenie" }));
    expect(writeText).toHaveBeenCalledWith('scripts/ask-helper.sh --role review agy "x"');
    const script = screen.getByText("ask-helper").closest("article")!;
    await userEvent.click(within(script).getByRole("button", { name: "Kopiuj przykład" }));
    expect(writeText).toHaveBeenLastCalledWith('scripts/ask-helper.sh agy "pytanie"');
    expect(screen.queryByRole("button", { name: /uruchom|run|execute/i })).toBeNull();
  });

  it("dodawanie presetu: formularz wysyła POST z rodzajem preset", async () => {
    const apiFetch = setup();
    await screen.findByText("Review diffa");
    await userEvent.click(screen.getByRole("button", { name: "Dodaj preset" }));
    await userEvent.type(screen.getByLabelText("Nazwa"), "Testy");
    await userEvent.type(screen.getByLabelText("Szablon polecenia"), "npx vitest run");
    await userEvent.click(screen.getByRole("button", { name: "Zapisz" }));
    await waitFor(() => {
      const post = apiFetch.mock.calls.find(([, init]) => init?.method === "POST");
      expect(JSON.parse(post![1]!.body as string)).toMatchObject({
        kind: "preset",
        name: "Testy",
        command: "npx vitest run",
      });
    });
    await waitFor(() => expect(screen.queryByLabelText("Nazwa")).toBeNull());
  });

  it("błąd zapisu zostawia formularz i pokazuje komunikat", async () => {
    const apiFetch = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "POST"
        ? ({ ok: false, status: 400, json: async () => ({ error: "Brak roli" }) } as Response)
        : json(overview)
    );
    render(<AgentsView apiFetch={apiFetch} />);
    await screen.findByText("Review diffa");
    await userEvent.click(screen.getByRole("button", { name: "Dodaj agenta" }));
    await userEvent.type(screen.getByLabelText("Nazwa"), "X");
    await userEvent.type(screen.getByLabelText("Rola"), "Y");
    await userEvent.click(screen.getByRole("button", { name: "Zapisz" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Brak roli");
    expect(screen.getByLabelText("Nazwa")).toBeInTheDocument();
  });

  it("edycja agenta: formularz startuje z danymi i wysyła PUT z kind agent", async () => {
    const apiFetch = setup();
    const card = (await screen.findByText("Review i wyszukiwanie")).closest("article")!;
    await userEvent.click(within(card).getByRole("button", { name: "Edytuj" }));
    expect(screen.getByLabelText("Rola")).toHaveValue("Review i wyszukiwanie");
    await userEvent.clear(screen.getByLabelText("Rola"));
    await userEvent.type(screen.getByLabelText("Rola"), "Tylko review");
    await userEvent.click(screen.getByRole("button", { name: "Zapisz" }));
    await waitFor(() => {
      const put = apiFetch.mock.calls.find(([, init]) => init?.method === "PUT");
      expect(put![0]).toBe("/api/arsenal/agents/a1");
      expect(JSON.parse(put![1]!.body as string)).toMatchObject({
        kind: "agent",
        role: "Tylko review",
      });
    });
  });

  it("usuwanie: po potwierdzeniu wysyła DELETE, po odmowie nic", async () => {
    const apiFetch = setup();
    const card = (await screen.findByText("Review diffa")).closest("article")!;
    const confirm = vi
      .spyOn(window, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    await userEvent.click(within(card).getByRole("button", { name: "Usuń" }));
    expect(apiFetch.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);
    await userEvent.click(within(card).getByRole("button", { name: "Usuń" }));
    await waitFor(() =>
      expect(
        apiFetch.mock.calls.some(
          ([url, init]) => url === "/api/arsenal/agents/p1" && init?.method === "DELETE"
        )
      ).toBe(true)
    );
    expect(confirm).toHaveBeenCalledWith("Usunąć wpis „Review diffa”?");
  });

  it("po angielsku: etykiety EN", async () => {
    await act(async () => {
      await setLanguage("en");
    });
    setup();
    expect(await screen.findByRole("heading", { name: "Who does what" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add agent" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Czerwono**

Run: `npx vitest run tests/unit/features/arsenal/AgentsView.test.tsx`
Expected: FAIL (brak modułu).

- [ ] **Step 3: Formularz**

`src/features/arsenal/AgentEntryForm.tsx`:

```tsx
import React, { useState } from "react";
import type { AgentEntryDto, AgentEntryInputDto } from "@/contexts/bc_arsenal/schemas";
import { useT } from "@/src/i18n/useT";
import { messageOf } from "./apiError";

type Kind = AgentEntryDto["kind"];

const KIND_KEY = {
  agent: "agents:kindAgent",
  preset: "agents:kindPreset",
  script: "agents:kindScript",
} as const;

type Props = {
  kind: Kind;
  initial?: AgentEntryDto;
  onSubmit: (input: AgentEntryInputDto) => Promise<void>;
  onCancel: () => void;
};

const textOf = (initial: AgentEntryDto | undefined, key: string): string => {
  const value = initial === undefined ? undefined : (initial as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
};

export function AgentEntryForm({ kind, initial, onSubmit, onCancel }: Props) {
  const t = useT();
  const [values, setValues] = useState<Record<string, string>>(() => ({
    name: textOf(initial, "name"),
    role: textOf(initial, "role"),
    model: textOf(initial, "model"),
    when: textOf(initial, "when"),
    command: textOf(initial, "command"),
    description: textOf(initial, "description"),
    path: textOf(initial, "path"),
    example: textOf(initial, "example"),
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  const build = (): AgentEntryInputDto => {
    const v = values;
    if (kind === "agent") return { kind, name: v.name, role: v.role, model: v.model, when: v.when };
    if (kind === "preset")
      return { kind, name: v.name, command: v.command, description: v.description };
    return { kind, name: v.name, path: v.path, description: v.description, example: v.example };
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit(build());
    } catch (err) {
      setError(messageOf(err));
      setSaving(false);
    }
  };

  const field = (
    key: string,
    label: string,
    opts: { required?: boolean; multiline?: boolean } = {}
  ) => (
    <label className="crs-field">
      <span>{label}</span>
      {opts.multiline ? (
        <textarea rows={2} required={opts.required} value={values[key]} onChange={set(key)} />
      ) : (
        <input required={opts.required} value={values[key]} onChange={set(key)} />
      )}
    </label>
  );

  return (
    <form className="crs-form" onSubmit={submit}>
      <h3 className="crs-form__title">
        {t(initial === undefined ? "agents:formAddTitle" : "agents:formEditTitle", {
          kind: t(KIND_KEY[kind]),
        })}
      </h3>
      {field("name", t("agents:fieldName"), { required: true })}
      {kind === "agent" && (
        <>
          {field("role", t("agents:fieldRole"), { required: true })}
          {field("model", t("agents:fieldModel"))}
          {field("when", t("agents:fieldWhen"), { multiline: true })}
        </>
      )}
      {kind === "preset" && (
        <>
          {field("command", t("agents:fieldCommand"), { required: true, multiline: true })}
          {field("description", t("agents:fieldDescription"))}
        </>
      )}
      {kind === "script" && (
        <>
          {field("path", t("agents:fieldPath"), { required: true })}
          {field("description", t("agents:fieldDescription"))}
          {field("example", t("agents:fieldExample"), { multiline: true })}
        </>
      )}
      {error !== null && (
        <p role="alert" className="asv-error">
          {error}
        </p>
      )}
      <div className="crs-form__actions">
        <button type="submit" className="asv-btn asv-btn--primary" disabled={saving}>
          {t("agents:save")}
        </button>
        <button type="button" className="asv-btn" onClick={onCancel}>
          {t("agents:cancel")}
        </button>
      </div>
    </form>
  );
}
```

(Formularz używa klas `.crs-*` z etapu 3; stąd warunek wstępny.)

- [ ] **Step 4: Widok**

`src/features/arsenal/AgentsView.tsx`:

```tsx
import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import type {
  AgentEntryDto,
  AgentEntryInputDto,
  AgentRowDto,
  PresetRowDto,
  ScriptRowDto,
} from "@/contexts/bc_arsenal/schemas";
import { useT } from "@/src/i18n/useT";
import "@/src/features/resources/resources.css";
import "./arsenal.css";
import { AgentEntryForm } from "./AgentEntryForm";
import { CopyButton } from "./CopyButton";
import { messageOf } from "./apiError";
import type { ApiFetch } from "./useArsenal";
import { useAgents } from "./useAgents";

type Kind = AgentEntryDto["kind"];
/** `id` wpisu w edycji albo `new:<rodzaj>` dla nowego. */
type Editing = string | null;

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const t = useT();
  return (
    <div className="crs-card__actions">
      <button type="button" className="asv-btn" onClick={onEdit}>
        {t("agents:edit")}
      </button>
      <button type="button" className="asv-btn" onClick={onDelete}>
        {t("agents:delete")}
      </button>
    </div>
  );
}

export function AgentsView({ apiFetch }: { apiFetch: ApiFetch }) {
  const t = useT();
  const a = useAgents(apiFetch);
  const [editing, setEditing] = useState<Editing>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const total = a.agents.length + a.presets.length + a.scripts.length;
  const save = async (input: AgentEntryInputDto, id?: string) => {
    await a.save(input, id);
    setEditing(null);
  };
  const remove = async (entry: AgentEntryDto) => {
    if (!window.confirm(t("agents:deleteConfirm", { name: entry.name }))) return;
    setActionError(null);
    try {
      await a.remove(entry.id);
    } catch (err) {
      setActionError(messageOf(err));
    }
  };
  const formFor = (kind: Kind, entry?: AgentEntryDto) => (
    <AgentEntryForm
      key={entry?.id ?? `new:${kind}`}
      kind={kind}
      initial={entry}
      onSubmit={(input) => save(input, entry?.id)}
      onCancel={() => setEditing(null)}
    />
  );
  const rowOrForm = (entry: AgentEntryDto, row: React.ReactNode) =>
    editing === entry.id ? formFor(entry.kind, entry) : row;

  const section = (
    kind: Kind,
    title: string,
    addLabel: string,
    emptyText: string,
    rows: React.ReactNode[]
  ) => (
    <section className="ag-section" aria-label={title}>
      <div className="ag-section__head">
        <h2 className="ag-section__title">{title}</h2>
        <button type="button" className="asv-btn" onClick={() => setEditing(`new:${kind}`)}>
          {addLabel}
        </button>
      </div>
      {editing === `new:${kind}` && formFor(kind)}
      {rows.length === 0 && editing !== `new:${kind}` ? (
        <p className="asv-empty">{emptyText}</p>
      ) : (
        <div className="crs-list">{rows}</div>
      )}
    </section>
  );

  const agentRow = (e: AgentRowDto) =>
    rowOrForm(
      e,
      <article key={e.id} className="crs-card ag-card" data-kind="agent">
        <div className="crs-card__head">
          <span className="crs-card__title">{e.name}</span>
          {e.model !== undefined && <span className="asv-chip-static">{e.model}</span>}
        </div>
        <p className="crs-card__meta">{e.role}</p>
        {e.when !== undefined && <p className="crs-card__note">{e.when}</p>}
        <RowActions onEdit={() => setEditing(e.id)} onDelete={() => void remove(e)} />
      </article>
    );

  const presetRow = (e: PresetRowDto) =>
    rowOrForm(
      e,
      <article key={e.id} className="crs-card ag-card" data-kind="preset">
        <div className="crs-card__head">
          <span className="crs-card__title">{e.name}</span>
        </div>
        {e.description !== undefined && <p className="crs-card__meta">{e.description}</p>}
        <pre className="ag-code">{e.command}</pre>
        <div className="crs-card__actions">
          <CopyButton text={e.command} label={t("agents:copyCommand")} primary />
          <RowActions onEdit={() => setEditing(e.id)} onDelete={() => void remove(e)} />
        </div>
      </article>
    );

  const scriptRow = (e: ScriptRowDto) =>
    rowOrForm(
      e,
      <article key={e.id} className="crs-card ag-card" data-kind="script">
        <div className="crs-card__head">
          <span className="crs-card__title">{e.name}</span>
          <code className="ag-path">{e.path}</code>
        </div>
        {e.description !== undefined && <p className="crs-card__meta">{e.description}</p>}
        {e.example !== undefined && <pre className="ag-code">{e.example}</pre>}
        <div className="crs-card__actions">
          {e.example !== undefined && (
            <CopyButton text={e.example} label={t("agents:copyExample")} primary />
          )}
          <RowActions onEdit={() => setEditing(e.id)} onDelete={() => void remove(e)} />
        </div>
      </article>
    );

  return (
    <div className="ars asv" data-card="arsenal">
      <header className="ars-head">
        <div>
          <p className="ars-eyebrow">{`Alt+7 · ${t("shell:cards.arsenal")}`}</p>
          <h1 className="ars-title">{t("agents:title")}</h1>
          <p className="ars-sub">
            {t("agents:count", { count: total })}
            {a.skipped > 0 ? t("agents:skippedSuffix", { count: a.skipped }) : ""}
          </p>
        </div>
      </header>

      {a.loading ? (
        <Loader2 className="animate-spin" aria-label={t("agents:loading")} />
      ) : a.error !== null ? (
        <p role="alert" className="asv-error">
          {a.error}
        </p>
      ) : (
        <>
          <p className="asv-hint">{t("agents:copyHint")}</p>
          {actionError !== null && (
            <p role="alert" className="asv-error">
              {actionError}
            </p>
          )}
          {section(
            "agent",
            t("agents:sectionAgents"),
            t("agents:addAgent"),
            t("agents:emptyAgents"),
            a.agents.map(agentRow)
          )}
          {section(
            "preset",
            t("agents:sectionPresets"),
            t("agents:addPreset"),
            t("agents:emptyPresets"),
            a.presets.map(presetRow)
          )}
          {section(
            "script",
            t("agents:sectionScripts"),
            t("agents:addScript"),
            t("agents:emptyScripts"),
            a.scripts.map(scriptRow)
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 5: CSS**

Na końcu `src/features/arsenal/arsenal.css`:

```css
/* Agenci i polecenia */
.ag-section {
  margin-bottom: var(--s-5);
}
.ag-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--s-3);
}
.ag-section__title {
  margin: 0;
  font: 600 var(--fs-md) / 1.3 var(--font-display);
}
.ag-code {
  margin: 0;
  padding: var(--s-3);
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  font: var(--fs-xs) / 1.5 var(--font-mono);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.ag-path {
  font: var(--fs-xs) / 1 var(--font-mono);
  color: var(--muted);
}
```

- [ ] **Step 6: Zielono**

Run: `npx vitest run tests/unit/features/arsenal && npx tsc --noEmit && npm run lint`
Expected: PASS. Przy niejednoznacznych zapytaniach w teście (np. dwa przyciski „Edytuj”) zawężaj `within(article)`, nie zmieniaj komponentu.

- [ ] **Step 7: Commit**

```bash
git add src/features/arsenal tests/unit/features/arsenal/AgentsView.test.tsx
git commit -m "feat(arsenal): widok Agenci i polecenia (trzy sekcje, formularz, kopiowanie)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Zakładka `agents` w rejestrze kart, widoku i szufladce mobilnej

**Files:**

- Modify: `src/features/planowanie/planningTab.ts`, `src/features/cards/cards.ts`, `src/features/planowanie/PlanowanieView.tsx`, `src/components/layout/MobileMoreDrawer.tsx`
- Test: `tests/unit/features/cards/cards.test.ts`, `tests/unit/components/layout/MobileMoreDrawer.test.tsx`

- [ ] **Step 1: Czerwone testy**

W `tests/unit/features/cards/cards.test.ts`: oczekiwanie `["skills", "resources", "courses", "tags"]` (w `subtabsForCard("arsenal")` i w `CARD_SUBTABS`, oraz w tytule testu) zmień na `["skills", "resources", "courses", "agents", "tags"]`; obok `cardForView("planowanie", "courses")` dodaj `expect(cardForView("planowanie", "agents")).toBe("arsenal");`.

W `tests/unit/components/layout/MobileMoreDrawer.test.tsx` dopisz:

```tsx
test("calls onSelectTab for agents", () => {
  const onSelectTab = vi.fn();
  render(<MobileMoreDrawer isOpen={true} onClose={vi.fn()} onSelectTab={onSelectTab} />);
  fireEvent.click(screen.getByText("Agenci i polecenia"));
  expect(onSelectTab).toHaveBeenCalledWith("agents");
});
```

Run: `npx vitest run tests/unit/features/cards tests/unit/components/layout`
Expected: FAIL.

- [ ] **Step 2: Implementacja**

`src/features/planowanie/planningTab.ts`: dodaj `| "agents"` po `| "courses"`.

`src/features/cards/cards.ts`: w `TAB_TO_CARD` dodaj `agents: "arsenal",`; `CARD_SUBTABS.arsenal` = `["skills", "resources", "courses", "agents", "tags"]`.

`src/features/planowanie/PlanowanieView.tsx`: w `TAB_LABEL_KEY` dodaj `agents: "planning:tabAgents",`; obok importu `CoursesView` dodaj `import { AgentsView } from "@/src/features/arsenal/AgentsView";`; po gałęzi `planningTab === "courses"` dodaj:

```tsx
        ) : planningTab === "agents" ? (
          <div className="flex-1 flex flex-col overflow-auto bg-[var(--bg)]">
            <AgentsView apiFetch={apiFetch} />
          </div>
```

`src/components/layout/MobileMoreDrawer.tsx`: import `Bot` z `lucide-react`; `DrawerTab` rozszerz o `"agents"`; w `items` po `courses` dodaj `{ id: "agents", icon: <Bot className="w-5 h-5" /> },`.

- [ ] **Step 3: Zielono (cały zestaw)**

Run: `npx tsc --noEmit && npx vitest run && npm run lint`
Expected: PASS (pęknięty test liczący zakładki lub pozycje szufladki popraw na nowy, zamierzony stan).

- [ ] **Step 4: Commit**

```bash
git add src tests
git commit -m "feat(arsenal): zakładka Agenci i polecenia w karcie Arsenał

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Dokumentacja formatu, dane początkowe i weryfikacja

**Files:**

- Modify: `docs/nexus-vault-formaty-yaml.md`
- Create (repo NEXUS): `Vault/Arsenal/agents.yaml`

- [ ] **Step 1: Format pliku**

W tabeli na górze `docs/nexus-vault-formaty-yaml.md` dodaj wiersz:

```
| `Arsenal/agents.yaml`      | `items`     | `id`, `kind`, `name`, potem pola rodzaju (niżej)                                                              |
```

i sekcję (po sekcji „Kursy”):

```markdown
## Agenci i polecenia: `Arsenal/agents.yaml`

Karta Arsenał, zakładka „Agenci i polecenia”. Zapis z aplikacji (`lib/nexus/yaml-store.ts`), plik można też edytować ręcznie. Jedna lista `items`; rodzaj wpisu w polu `kind`:

| `kind`   | Wymagane          | Opcjonalne               | Znaczenie                                                  |
| -------- | ----------------- | ------------------------ | ---------------------------------------------------------- |
| `agent`  | `name`, `role`    | `model`, `when`          | kto do czego: rola, model lub tier, kiedy używać           |
| `preset` | `name`, `command` | `description`            | szablon polecenia `ask-helper`; tylko do kopiowania        |
| `script` | `name`, `path`    | `description`, `example` | skrypt z `scripts/` i przykład użycia; tylko do kopiowania |

- Kolejność w UI: sekcje agenci, presety, skrypty; w sekcji kolejność z pliku (lista jest redagowana ręcznie).
- Wpis bez `id`, `name`, z nieznanym `kind` albo bez pola wymaganego jest pomijany (licznik „pominięto N”); reszta się ładuje.
- Aplikacja niczego nie uruchamia: `command` i `example` tylko trafiają do schowka.
- Dane początkowe pochodzą z `CLAUDE.md` (tabela agentów, `ask-helper`) i `scripts/`; aplikacja nie parsuje `CLAUDE.md`, więc przy zmianie tamtych reguł zaktualizuj wpisy tu.
```

- [ ] **Step 2: Dane początkowe w NEXUS**

Utwórz `~/projects/Brain_7224/NEXUS/Vault/Arsenal/agents.yaml` (jeśli plik już istnieje, najpierw go przeczytaj i nie nadpisuj):

```yaml
version: 1
items:
  - id: agent-claude-code
    kind: agent
    name: Claude Code
    role: "Główny wykonawca: planowanie, implementacja, decyzje, commity, końcowa odpowiedzialność"
    model: "Sonnet 5.5 (Opus 5.5 przy architekturze i trudnych bugach)"
    when: "Zawsze jako wykonawca; mocniejszy model tylko na prośbę użytkownika"
  - id: agent-agy
    kind: agent
    name: agy (Antigravity)
    role: "Pomocnik: wyszukiwanie i pytania o kod (tylko odczyt), review, doradztwo"
    model: "light: Gemini 3.8 Flash; deep: Gemini 4 Argon"
    when: "Szukanie w wielu plikach, niezależny review diffa, druga opinia. Review domyślnie na tierze deep"
  - id: agent-cursor
    kind: agent
    name: cursor (Cursor Agent)
    role: "Pomocnik: testy, lint, build z podsumowaniem, drobne edycje (--role task)"
    model: "light: Composer 2.5 (zawsze light, także przy review); deep: Auto"
    when: "tsc, vitest, lint, build z krótkim wynikiem; mechaniczne edycje w wielu plikach"
  - id: preset-agy-advice
    kind: preset
    name: Pytanie o kod (agy)
    command: 'scripts/ask-helper.sh --role advice agy "<pytanie; ścieżki względem katalogu Monolith>"'
    description: "Pomocnik tylko czyta i odpowiada"
  - id: preset-agy-review
    kind: preset
    name: Review diffa (agy)
    command: 'scripts/ask-helper.sh --role review agy "<co sprawdzić; git diff main...HEAD; oczekiwany format odpowiedzi>"'
    description: "Niezależna opinia, czyści kontekst pomocnika; opinie traktować jak hipotezy"
  - id: preset-cursor-checks
    kind: preset
    name: Testy, lint i typy (cursor)
    command: 'scripts/ask-helper.sh --role task --approve-allowed cursor "Uruchom npx tsc --noEmit i npx vitest run. Odpowiedz: przeszło albo lista plik:linia + przyczyna"'
    description: "Tylko polecenia z listy zgód w CLAUDE.md"
  - id: preset-cursor-edit
    kind: preset
    name: Drobna edycja (cursor)
    command: 'scripts/ask-helper.sh --role task cursor "<dokładny opis zmiany i lista plików>"'
    description: "Po zadaniu sprawdź git diff i testy"
  - id: preset-keep
    kind: preset
    name: Dopytanie bez czyszczenia kontekstu
    command: 'scripts/ask-helper.sh --keep agy "<dopytanie>"'
    description: "Kontynuacja poprzedniego zadania; nie powtarzaj kontekstu w prompcie"
  - id: script-ask-helper
    kind: script
    name: ask-helper.sh
    path: scripts/ask-helper.sh
    description: "Wysyła prompt do pomocnika (agy, cursor) w panelu herdr i wypisuje odpowiedź"
    example: 'scripts/ask-helper.sh [--role review|advice|task] [--timeout S] <agy|cursor> "prompt"'
  - id: script-agy-ask
    kind: script
    name: agy-ask.sh
    path: scripts/agy-ask.sh
    description: "Skrót zgodności: deleguje do ask-helper.sh z pomocnikiem agy"
    example: 'scripts/agy-ask.sh [opcje ask-helper] "prompt"'
  - id: script-clear-helpers
    kind: script
    name: clear-helpers.sh
    path: scripts/clear-helpers.sh
    description: "Wysyła /clear do pomocników działających w sesji herdr"
    example: "scripts/clear-helpers.sh [cursor|agy|all]"
  - id: script-deploy-skill
    kind: script
    name: deploy-skill.sh
    path: scripts/deploy-skill.sh
    description: "Kopiuje skill z Vaulta do repozytorium projektu (uruchamia użytkownik; Monolith tylko generuje polecenie)"
    example: "scripts/deploy-skill.sh <slug> <katalog-projektu> [--force]"
  - id: script-import-to-vault
    kind: script
    name: import-to-vault
    path: scripts/import-to-vault.ts
    description: "Jednorazowy import zrzutu danych do Vaulta (krok 0b)"
    example: "npx tsx scripts/import-to-vault.ts --dump <katalog-zrzutu> [--vault <ścieżka>]"
```

Sprawdź, że plik się parsuje i aplikacja go czyta:

```bash
cd ~/projects/Brain_7224/Monolith
NEXUS_VAULT_PATH=~/projects/Brain_7224/NEXUS/Vault npx tsx -e 'import { readList } from "./lib/nexus/yaml-store"; console.log(readList("Arsenal/agents.yaml", "items").length)'
```

Expected: `13`. Jeśli `tsx` nie rozwiąże aliasów, sprawdź parsowanie samym `node -e 'require("yaml").parse(require("fs").readFileSync(process.env.F,"utf8")).items.length'` z `F=<ścieżka>` (oczekiwane 13).

Potem w repo NEXUS (zasada: zmiany NEXUS commit i push od razu):

```bash
cd ~/projects/Brain_7224/NEXUS
git add Vault/Arsenal/agents.yaml
git commit -m "Arsenal: dane początkowe agents.yaml (agenci, presety ask-helper, skrypty)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git push
```

- [ ] **Step 3: Pełna weryfikacja**

Run (w katalogu Monolith): `npx tsc --noEmit && npx vitest run && npm run lint && npm run lint:tests && npm run build`
Expected: wszystko zielone. (Można zlecić `cursor --tier light --role task --approve-allowed` z prośbą o „przeszło” albo listę `plik:linia + przyczyna`.)

- [ ] **Step 4: Przegląd diffa**

Zlecić `agy --role review` przegląd `git diff main...HEAD`; opinie traktować jak hipotezy i weryfikować w kodzie.

- [ ] **Step 5: Sprawdzenie w przeglądarce**

`npm run dev` (na kopii vaulta w `NEXUS_VAULT_PATH`, nie na prawdziwym, jeśli sprawdzasz zapis): `Alt+7` → „Agenci i polecenia”: widać 3 agentów, 5 presetów, 5 skryptów; skopiować preset i przykład skryptu; dodać agenta, edytować jego rolę, usunąć go; przełączyć PL/EN. Sprawdzić, że `agents.yaml` po zapisie nadal ma `version: 1` i listę `items` oraz że nieznane klucze przeżyły.

- [ ] **Step 6: Commit i backlog**

```bash
cd ~/projects/Brain_7224/Monolith
git add docs/nexus-vault-formaty-yaml.md
git commit -m "docs: format Arsenal/agents.yaml

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

W `NEXUS/Vault/Projects/monolith/tasks.md` dopisz „Arsenał, etap 4: Agenci i polecenia” jako zrobione (numer PR, lista weryfikacji) i, jeśli etap 3 też jest zamknięty, odhacz oba; spec §7 po obu etapach ma docelowo cztery zakładki z listy A1 (plus Tagi, które zostają). Commit i push do NEXUS od razu.

---

## Samoprzegląd planu względem specu

- **§4.2 trzy sekcje** (kto do czego; presety `ask-helper` tylko do kopiowania; skrypty z ścieżką, opisem, przykładem): Tasks 1–2 (model, repozytorium), 7 (widok, `CopyButton`, brak „uruchom”, test G6).
- **Plik `Vault/Arsenal/agents.yaml`, zapis z aplikacji przez `yaml-store`**: G1 (jedna lista `items` z `kind`, bo `yaml-store` nie zachowuje innych kluczy), Task 2.
- **Dane początkowe ręcznie z `CLAUDE.md` i `scripts/`, bez parsowania `CLAUDE.md`**: Task 9 Step 2.
- **§6 uszkodzony wpis pomijany z licznikiem**: `readAgentEntries().skipped`, nagłówek widoku (Tasks 2, 7).
- **Zapisy przez `handleServiceError`**: Task 4.
- **Test architektury bez zmian** (G7): sprawdzane w Tasks 2–4.
- **Zakładki**: Task 8 (`agents` przed `tags`).
- Spójność nazw: repozytorium `readAgentEntries`/`insertAgentEntry`/`replaceAgentEntry`/`deleteAgentEntry`, serwis `listAgents`/`createAgentEntry`/`updateAgentEntry`/`removeAgentEntry`, router `getAgents`/`postAgentEntry`/`putAgentEntry`/`deleteAgentEntry`, UI `useAgents().save/remove`, DTO `AgentEntryDto`/`AgentsDto`/`AgentEntryInputDto`.
