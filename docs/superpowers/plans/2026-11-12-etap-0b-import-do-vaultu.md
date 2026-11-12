# Etap 0b: import zrzutu do vaulta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Skrypt `scripts/import-to-vault.ts`, który zamienia zawężony zrzut z 0a (`notes`, `tasks`, `resources`, `user_tags`, `task_templates` jednego konta) na pliki vaulta: dry-run domyślnie, zapis tylko z `--write`, atomowo, idempotentnie po `id`, z bramką round-trip i raportem strat konwersji.

**Architecture:** Cienki CLI wywołuje małe moduły w `scripts/import-to-vault/` (`read-dump` → `records` → `plan` → `write` → `verify` → `report`, orkiestracja w `run`). Formaty plików (linia zadania, listy YAML, frontmatter) leżą w `lib/nexus/`, bo ten sam kod przejmie warstwa plikowa 0c; round-trip testuje więc dokładnie ten kod, który potem działa w aplikacji. Planowanie zapisu jest czystą funkcją nad widokiem vaulta tylko do odczytu (`VaultView`), więc testuje się je bez dysku.

**Tech Stack:** TypeScript (tsx), Vitest 3 (`tests/unit`, środowisko `node`), nowe pakiety: `turndown` (HTML → Markdown), `yaml` (już w lockfile jako zależność pośrednia; dodajemy jako bezpośrednią, `js-yaml` nie), `fast-check` (property test).

**Spec:** `docs/superpowers/specs/2026-11-12-etap-0b-import-do-vaultu-design.md`; nadrzędny `2026-11-12-etap-0-odpiecie-firebase-design.md` (§1.1, §5).

**Zasady przekrojowe (w każdym zadaniu):**

- Plan nie zawiera pełnego kodu modułów skryptu. Dla każdego modułu podane są: ścieżka, sygnatury, reguły i przypadki testowe z oczekiwanymi wartościami. Implementację piszesz w TDD: czerwony test (uruchom, zobacz błąd), minimalny kod, zielony test. Pełny kod jest tylko dla trzech małych formatów w `lib/nexus/` (Task 2 i 3).
- Każdy plik testowy `tests/unit/**` zaczyna się od `// @vitest-environment node` (domyślne środowisko to jsdom).
- Testy używają wyłącznie danych syntetycznych (prawdziwych nie wolno wkładać do repo). Katalogi tymczasowe przez `fs.mkdtempSync(path.join(os.tmpdir(), ...))`, sprzątane w `afterEach`.
- Skrypt czyta tylko katalog zrzutu (`--dump`) i vault (`--vault`, odczyt potrzebny do idempotencji po `id`). Zapisuje tylko w vaulcie (pliki) i w katalogu zrzutu (raport szczegółowy). Niczego nie kasuje poza własnym plikiem tymczasowym, niczego nie commituje, nie uruchamia procesów. Wymusza to test statyczny (Task 13). Dlatego w komentarzach i kodzie modułów skryptu nie używaj słów `firebase`, `backups`, `homedir`.
- Importy w `scripts/` względne (jak w 0a), w testach alias `@/`.
- Komendy ciężkie w outputcie (`npx tsc --noEmit`, `npm run lint`, pełne `npm run test:run`) zleca się pomocnikowi `cursor` (`scripts/ask-helper.sh --role task cursor "..."`, prośba: „przeszło” albo lista `plik:linia + przyczyna`). Pojedyncze pliki testowe uruchamiasz sam.
- Commity: dopisz trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Hook `lint-staged` uruchomi prettier. Nie pushuj.

## Decyzje formatu przyjęte w tym planie (część 1 specu nie została zapisana; do akceptacji)

| Co                             | Decyzja                                                                                                                                                                                                                                                                    |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Linia zadania                  | `- [ ] Tytuł [id:: …] [status:: in_progress] [due:: …] [priority:: …] [order:: …] [link:: …] [desc:: …] [created:: …] [updated:: …]`. Kratka `[x]` tylko dla `done`; źródłem prawdy jest pole `status`. Pola puste (`null`, `""`) są pomijane. Jedna linia = jedno zadanie |
| Ucieczka w liniach zadań       | `\\`, `\[`, `\]`, `\n`, `\r` w tytule i wartościach pól. `::` w wartości nie wymaga ucieczki                                                                                                                                                                               |
| Zadania                        | `Tasks/tasks.md`: frontmatter `generated_by: import-to-vault`, nagłówek `# Zadania`, potem linie zadań. Kolejność: `order` (brak na końcu), `created`, `id`                                                                                                                |
| Zasoby, tagi, szablony         | `Resources/resources.yaml` (klucz `resources`), `Resources/tags.yaml` (`tags`), `Tasks/templates.yaml` (`templates`); każdy plik: `version: 1`, `generated_by: import-to-vault`, lista map. Klucze rekordów w snake_case, pola puste pomijane                              |
| Notatki                        | `Notes/<slug>.md`, frontmatter w kolejności `id`, `title`, `created`, `updated`, `tags` (`tags: []` gdy brak), potem treść Markdown. Oryginał HTML: `Notes/.html/<id>.html`                                                                                                |
| Czas                           | jedno pole `created`/`updated` jako tekst ISO. Źródło: `created_at` (tekst), a gdy brak, `createdAt` (Timestamp z zrzutu)                                                                                                                                                  |
| Własność plików „pojedynczych” | plik jest „nasz”, gdy ma `generated_by: import-to-vault`. Istniejący plik bez znacznika dostaje obok wersję z sufiksem (`tasks-2.md`) i ostrzeżenie. Skutek uboczny: po przepisaniu pliku przez aplikację (0c) ponowny import nie nadpisze go, tylko zapisze obok          |
| Nieznany status zadania        | zamieniany na `todo` z ostrzeżeniem w raporcie (zadanie nie ginie); round-trip porównuje ze statusem po normalizacji                                                                                                                                                       |
| Kody wyjścia                   | 0 ok; 1 błędne użycie; 2 błąd zrzutu (manifest, status, SHA, struktura); 3 ścieżka poza vaultem; 4 round-trip lub bilans rekordów niezgodny                                                                                                                                |

Pliki tworzone przez ten krok kończą się znakiem nowej linii, używają `\n`, i nie zawierają znaczników czasu importu (inaczej drugi przebieg zmieniałby pliki).

---

## File Structure

| Plik                                            | Odpowiedzialność                                                                             |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `lib/nexus/task-line.ts`                        | `formatTaskLine`, `parseTaskLine`, `parseTaskLines`, typ `TaskLine`, `TaskLineError`         |
| `lib/nexus/yaml-lists.ts`                       | `formatYamlList`, `parseYamlList`, `GENERATED_BY_IMPORT`                                     |
| `lib/nexus/frontmatter.ts`                      | `formatFrontmatter`, `parseFrontmatter`                                                      |
| `scripts/import-to-vault.ts`                    | tylko CLI: argumenty, wypisanie raportu, `process.exitCode`                                  |
| `scripts/import-to-vault/types.ts`              | stałe `EXIT`, `HANDLED_TYPES`, typy współdzielone (kontrakt poniżej)                         |
| `scripts/import-to-vault/args.ts`               | `parseImportArgs`                                                                            |
| `scripts/import-to-vault/read-dump.ts`          | `readDump`, `DumpError`: wczytanie i weryfikacja SHA                                         |
| `scripts/import-to-vault/records.ts`            | normalizacja rekordów zrzutu → rekordy vaulta (+ ostrzeżenia)                                |
| `scripts/import-to-vault/slug.ts`               | `slugify`, `allocateName`, `htmlFileName`                                                    |
| `scripts/import-to-vault/notes.ts`              | `htmlToMarkdown`, `detectLosses`, `buildNoteFiles`                                           |
| `scripts/import-to-vault/plan.ts`               | `buildPlan`: czysta funkcja `Converted` + `VaultView` → `PlannedFile[]`                      |
| `scripts/import-to-vault/write.ts`              | `resolveInsideVault`, `atomicWrite`, `createVaultView`, `applyPlan`, `PathOutsideVaultError` |
| `scripts/import-to-vault/verify.ts`             | `verifyVault` (round-trip)                                                                   |
| `scripts/import-to-vault/report.ts`             | `formatScreenReport`, `writeDetailedReport`                                                  |
| `scripts/import-to-vault/run.ts`                | `runImport`: orkiestracja i kody wyjścia                                                     |
| `tests/unit/lib/nexus/*.test.ts`                | testy formatów                                                                               |
| `tests/unit/scripts/import-to-vault/helpers.ts` | `makeDump`, `ts`, `sampleCollections` (dane syntetyczne)                                     |
| `tests/unit/scripts/import-to-vault/*.test.ts`  | testy modułów, integracyjny `run.test.ts`, statyczny `static.test.ts`                        |

### Kontrakt typów (`scripts/import-to-vault/types.ts`)

Ten plik tworzysz w Task 4 dokładnie w tej postaci; następne zadania zakładają te nazwy.

```ts
import type { TaskLine } from "../../lib/nexus/task-line";

export const EXIT = { OK: 0, USAGE: 1, DUMP: 2, PATH: 3, VERIFY: 4 } as const;

export const HANDLED_TYPES = [
  "notes",
  "tasks",
  "resources",
  "user_tags",
  "task_templates",
] as const;
export type HandledType = (typeof HANDLED_TYPES)[number];

/** Jedna linia JSONL zrzutu: {"_id","_path","data"}. */
export type DumpRow = { id: string; path: string; data: Record<string, unknown> };

/** Kolekcja (lub jej część) pominięta świadomie, z powodem. `type` ustawione, gdy to kolekcja obsługiwana innego konta. */
export type SkippedGroup = {
  path: string;
  count: number;
  reason: string;
  type: HandledType | null;
};

export type DumpData = {
  dumpDir: string;
  uid: string;
  exportedAt: string;
  rows: Record<HandledType, DumpRow[]>;
  skipped: SkippedGroup[];
};

export type VaultNote = {
  id: string;
  title: string;
  html: string;
  created: string | null;
  updated: string | null;
  tags: string[];
};
export type VaultResource = {
  id: string;
  title: string;
  url: string;
  description: string;
  tags: string[];
  favorite: boolean;
  thumbnail_url?: string;
  note_id?: string;
  created?: string;
  updated?: string;
};
export type VaultTag = { id: string; tag: string; title: string; color?: string; created?: string };
export type VaultTemplate = {
  id: string;
  label: string;
  title: string;
  link: string;
  created?: string;
};

export type Converted = {
  notes: VaultNote[];
  tasks: TaskLine[];
  resources: VaultResource[];
  tags: VaultTag[];
  templates: VaultTemplate[];
  warnings: string[];
};

/** Widok vaulta tylko do odczytu. Ścieżki względne, separator "/". */
export interface VaultView {
  read(rel: string): string | null; // null, gdy plik nie istnieje
  list(relDir: string): string[]; // nazwy plików (bez katalogów); [] gdy katalog nie istnieje
}

export type PlannedKind = "note" | "note-html" | "tasks" | "resources" | "tags" | "templates";
export type PlannedFile = {
  relPath: string;
  content: string;
  kind: PlannedKind;
  action: "create" | "update" | "unchanged";
};

export type NoteLoss = { id: string; relPath: string; losses: string[] };

export type PlanResult = {
  files: PlannedFile[];
  /** Ścieżki plików pojedynczych (mogą mieć sufiks). Brak klucza = brak rekordów danego typu. */
  targets: { tasks?: string; resources?: string; tags?: string; templates?: string };
  /** Ścieżka pliku każdej notatki po id. */
  noteFiles: Record<string, string>;
  noteLosses: NoteLoss[];
  warnings: string[];
};
```

---

### Task 1: Gałąź i zależności

**Files:** Modify: `package.json`, `package-lock.json`.

- [ ] **Step 1: Gałąź**

```bash
cd ~/projects/Brain_7224/Second_brain
git switch -c feat/etap-0b-import-do-vaultu
git status --short   # spec 0b i plan mogą być nieśledzone: to normalne
```

- [ ] **Step 2: Zależności**

```bash
npm install turndown yaml
npm install -D @types/turndown fast-check
grep -nE '"(turndown|yaml|@types/turndown|fast-check)"' package.json
```

Expected: cztery wpisy (`yaml` w `dependencies`). Nie dodawaj `js-yaml`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json docs/superpowers/specs/2026-11-12-etap-0b-import-do-vaultu-design.md docs/superpowers/plans/2026-11-12-etap-0b-import-do-vaultu.md
git commit -m "chore(0b): add turndown, yaml, fast-check; spec and plan for the vault import"
```

(dopisz trailer `Co-Authored-By`)

---

### Task 2: `lib/nexus/task-line.ts` (format linii zadania)

**Files:** Create: `lib/nexus/task-line.ts`, `tests/unit/lib/nexus/task-line.test.ts`.

- [ ] **Step 1: Napisz test** (`tests/unit/lib/nexus/task-line.test.ts`)

```ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  TASK_STATUSES,
  TaskLineError,
  formatTaskLine,
  parseTaskLine,
  parseTaskLines,
  type TaskLine,
} from "@/lib/nexus/task-line";

function task(overrides: Partial<TaskLine> = {}): TaskLine {
  return {
    id: "t1",
    title: "Zadanie",
    status: "todo",
    link: "",
    description: "",
    due_date: null,
    priority: null,
    order: null,
    created_at: null,
    updated_at: null,
    ...overrides,
  };
}

describe("formatTaskLine", () => {
  it("writes a minimal task with id and status as inline fields", () => {
    expect(formatTaskLine(task())).toBe("- [ ] Zadanie [id:: t1] [status:: todo]");
  });

  it("ticks the box only for done and keeps the four-state status in a field", () => {
    expect(formatTaskLine(task({ status: "done" }))).toBe(
      "- [x] Zadanie [id:: t1] [status:: done]"
    );
    expect(formatTaskLine(task({ status: "in_progress" }))).toBe(
      "- [ ] Zadanie [id:: t1] [status:: in_progress]"
    );
  });

  it("writes optional fields in a fixed order and omits empty ones", () => {
    const line = formatTaskLine(
      task({
        due_date: "2026-11-12",
        priority: 2,
        order: 1.5,
        link: "https://example.com/a",
        description: "opis",
        created_at: "2026-05-01T10:00:00.000Z",
        updated_at: "2026-05-02T10:00:00.000Z",
      })
    );
    expect(line).toBe(
      "- [ ] Zadanie [id:: t1] [status:: todo] [due:: 2026-11-12] [priority:: 2] [order:: 1.5]" +
        " [link:: https://example.com/a] [desc:: opis] [created:: 2026-05-01T10:00:00.000Z]" +
        " [updated:: 2026-05-02T10:00:00.000Z]"
    );
  });

  it("always produces a single line, even for multi-line descriptions", () => {
    const line = formatTaskLine(task({ description: "a\nb\r\nc" }));
    expect(line).not.toMatch(/[\r\n]/);
    expect(line).toContain("[desc:: a\\nb\\r\\nc]");
  });
});

describe("parseTaskLine", () => {
  it("returns null for lines that are not tasks", () => {
    expect(parseTaskLine("# Zadania")).toBeNull();
    expect(parseTaskLine("")).toBeNull();
    expect(parseTaskLine("- zwykły punkt")).toBeNull();
  });

  it("falls back to the checkbox when a hand-written line has no status field", () => {
    expect(parseTaskLine("- [ ] Kupić mleko")?.status).toBe("todo");
    expect(parseTaskLine("- [x] Kupić mleko")?.status).toBe("done");
    expect(parseTaskLine("- [x] Kupić mleko")?.id).toBe("");
  });

  it("keeps square brackets that do not start a field as literal text", () => {
    expect(parseTaskLine("- [ ] Napraw [wip] błąd")?.title).toBe("Napraw [wip] błąd");
  });

  it("throws TaskLineError for an unknown status, a bad number and an unterminated field", () => {
    expect(() => parseTaskLine("- [ ] A [id:: 1] [status:: archived]")).toThrow(TaskLineError);
    expect(() => parseTaskLine("- [ ] A [id:: 1] [priority:: abc]")).toThrow(TaskLineError);
    expect(() => parseTaskLine("- [ ] A [id:: 1")).toThrow(TaskLineError);
    expect(() => parseTaskLine("- [ ] A [id:: 1] tekst po polach")).toThrow(TaskLineError);
  });
});

describe("round trip on tricky values", () => {
  const cases: Array<[string, Partial<TaskLine>]> = [
    ["polish characters", { title: "Zażółć gęślą jaźń", description: "ŁÓDŹ" }],
    [
      "closing bracket and double colon in every field",
      {
        title: "a ] b :: c",
        link: "https://x.y/?q=[1]&r=a::b",
        description: "opis ] z :: i [id:: fałszywe]",
      },
    ],
    ["empty title", { title: "" }],
    ["title with leading and trailing spaces", { title: "  spacje  " }],
    ["backslashes", { title: "ścieżka C:\\temp\\nowy", description: "\\n to nie nowa linia" }],
    ["multi-line description", { description: "linia 1\nlinia 2\r\nlinia 3" }],
    ["title that looks like a field", { title: "[status:: done]" }],
  ];
  it.each(cases)("%s", (_name, overrides) => {
    const original = task(overrides);
    expect(parseTaskLine(formatTaskLine(original))).toEqual(original);
  });
});

describe("parseTaskLines", () => {
  it("collects only task lines from a markdown file", () => {
    const text = [
      "---",
      "generated_by: import-to-vault",
      "---",
      "",
      "# Zadania",
      "",
      formatTaskLine(task({ id: "a" })),
      "zwykły tekst",
      formatTaskLine(task({ id: "b", status: "done" })),
      "",
    ].join("\n");
    expect(parseTaskLines(text).map((t) => t.id)).toEqual(["a", "b"]);
  });
});

describe("property: parse(format(x)) == x", () => {
  const text = fc.string({ unit: "binary", maxLength: 40 });
  const finiteNumber = fc
    .double({ noNaN: true, noDefaultInfinity: true })
    .map((n) => (n === 0 ? 0 : n));
  const arbitraryTask: fc.Arbitrary<TaskLine> = fc.record({
    id: text,
    title: text,
    status: fc.constantFrom(...TASK_STATUSES),
    link: text,
    description: text,
    due_date: fc.option(text, { nil: null }),
    priority: fc.option(finiteNumber, { nil: null }),
    order: fc.option(finiteNumber, { nil: null }),
    created_at: fc.option(text, { nil: null }),
    updated_at: fc.option(text, { nil: null }),
  });

  it("holds for arbitrary tasks, and the line never contains a line break", () => {
    fc.assert(
      fc.property(arbitraryTask, (original) => {
        const line = formatTaskLine(original);
        expect(line).not.toMatch(/[\r\n]/);
        expect(parseTaskLine(line)).toEqual(original);
      }),
      { numRuns: 2000 }
    );
  });
});
```

- [ ] **Step 2: Uruchom, zobacz czerwony**

Run: `npx vitest run tests/unit/lib/nexus/task-line.test.ts`
Expected: FAIL (brak modułu `@/lib/nexus/task-line`).

- [ ] **Step 3: Zaimplementuj** (`lib/nexus/task-line.ts`)

```ts
export const TASK_STATUSES = ["todo", "in_progress", "to_review", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export type TaskLine = {
  id: string;
  title: string;
  status: TaskStatus;
  link: string;
  description: string;
  due_date: string | null;
  priority: number | null;
  order: number | null;
  created_at: string | null;
  updated_at: string | null;
};

export class TaskLineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaskLineError";
  }
}

const LINE = /^- \[( |x|X)\](?: ([\s\S]*))?$/;
const FIELD_START = /^\[([A-Za-z_][\w-]*)::/;

function esc(value: string): string {
  return value.replace(/[\\[\]\n\r]/g, (c) => (c === "\n" ? "\\n" : c === "\r" ? "\\r" : `\\${c}`));
}

/** Znaczenie sekwencji `\x`; nieznane sekwencje zostają dosłownie (ręcznie pisany tekst). */
function unescapePair(next: string): string {
  if (next === "n") return "\n";
  if (next === "r") return "\r";
  if (next === "\\" || next === "[" || next === "]") return next;
  return `\\${next}`;
}

/** Czyta tekst z sekwencjami ucieczki aż do pierwszego nieucieczkowanego `stop` (lub końca). */
function readEscaped(
  s: string,
  from: number,
  stop: string
): { text: string; end: number; stopped: boolean } {
  let out = "";
  let i = from;
  while (i < s.length) {
    const c = s[i];
    if (c === "\\" && i + 1 < s.length) {
      out += unescapePair(s[i + 1]);
      i += 2;
      continue;
    }
    if (c === stop) return { text: out, end: i, stopped: true };
    out += c;
    i++;
  }
  return { text: out, end: i, stopped: false };
}

export function formatTaskLine(task: TaskLine): string {
  const fields: Array<[string, string]> = [
    ["id", task.id],
    ["status", task.status],
  ];
  if (task.due_date !== null) fields.push(["due", task.due_date]);
  if (task.priority !== null) fields.push(["priority", String(task.priority)]);
  if (task.order !== null) fields.push(["order", String(task.order)]);
  if (task.link !== "") fields.push(["link", task.link]);
  if (task.description !== "") fields.push(["desc", task.description]);
  if (task.created_at !== null) fields.push(["created", task.created_at]);
  if (task.updated_at !== null) fields.push(["updated", task.updated_at]);
  const box = task.status === "done" ? "x" : " ";
  return `- [${box}] ${esc(task.title)}` + fields.map(([k, v]) => ` [${k}:: ${esc(v)}]`).join("");
}

function numberField(raw: string | undefined, name: string): number | null {
  if (raw === undefined) return null;
  const n = Number(raw);
  if (raw.trim() === "" || Number.isNaN(n)) {
    throw new TaskLineError(`pole ${name}: "${raw}" nie jest liczbą`);
  }
  return n;
}

/** Zwraca `null`, gdy linia nie jest zadaniem; rzuca `TaskLineError`, gdy pola są uszkodzone. */
export function parseTaskLine(line: string): TaskLine | null {
  const m = LINE.exec(line);
  if (!m) return null;
  const rest = m[2] ?? "";

  let title = "";
  let i = 0;
  while (i < rest.length) {
    const c = rest[i];
    if (c === "\\" && i + 1 < rest.length) {
      title += unescapePair(rest[i + 1]);
      i += 2;
      continue;
    }
    if (c === "[" && FIELD_START.test(rest.slice(i))) break;
    title += c;
    i++;
  }
  // Format dopisuje jedną spację przed pierwszym polem; tylko ją usuwamy.
  if (i < rest.length && title.endsWith(" ")) title = title.slice(0, -1);

  const fields: Record<string, string> = {};
  while (i < rest.length) {
    const start = FIELD_START.exec(rest.slice(i));
    if (!start) {
      throw new TaskLineError(`nieoczekiwany tekst po polach: "${rest.slice(i, i + 20)}"`);
    }
    let j = i + start[0].length;
    if (rest[j] === " ") j++;
    const value = readEscaped(rest, j, "]");
    if (!value.stopped) throw new TaskLineError(`niezamknięte pole [${start[1]}::`);
    fields[start[1]] = value.text;
    i = value.end + 1;
    while (rest[i] === " ") i++;
  }

  const status = fields.status ?? (m[1] === " " ? "todo" : "done");
  if (!(TASK_STATUSES as readonly string[]).includes(status)) {
    throw new TaskLineError(`nieznany status "${status}"`);
  }
  return {
    id: fields.id ?? "",
    title,
    status: status as TaskStatus,
    link: fields.link ?? "",
    description: fields.desc ?? "",
    due_date: fields.due ?? null,
    priority: numberField(fields.priority, "priority"),
    order: numberField(fields.order, "order"),
    created_at: fields.created ?? null,
    updated_at: fields.updated ?? null,
  };
}

/** Wszystkie linie zadań z pliku Markdown; pozostałe linie (nagłówki, puste) są pomijane. */
export function parseTaskLines(text: string): TaskLine[] {
  const out: TaskLine[] = [];
  for (const line of text.split(/\r?\n/)) {
    const task = parseTaskLine(line);
    if (task) out.push(task);
  }
  return out;
}
```

- [ ] **Step 4: Zielony**

Run: `npx vitest run tests/unit/lib/nexus/task-line.test.ts`
Expected: PASS. Jeśli property test znajdzie kontrprzykład, nie zmieniaj generatora: popraw `esc`/parser.

- [ ] **Step 5: Commit** `feat(nexus): task line format with escaping and round-trip property test`

---

### Task 3: `lib/nexus/yaml-lists.ts` i `lib/nexus/frontmatter.ts`

**Files:** Create: `lib/nexus/yaml-lists.ts`, `lib/nexus/frontmatter.ts`, `tests/unit/lib/nexus/yaml-lists.test.ts`, `tests/unit/lib/nexus/frontmatter.test.ts`.

- [ ] **Step 1: Napisz testy**

`yaml-lists.test.ts` (nagłówek `// @vitest-environment node`), przypadki:

| Test                                                   | Oczekiwanie                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `formatYamlList("tags", [], "import-to-vault")`        | tekst zawiera `version: 1`, `generated_by: import-to-vault`, `tags: []`; `parseYamlList(..., "tags")` → `{ generatedBy: "import-to-vault", items: [] }`                                                                                                                                                                                        |
| round-trip jednego rekordu z trudnymi wartościami      | `parseYamlList(formatYamlList("resources", [r], X), "resources").items[0]` `toEqual(r)` dla `r = { id: "123", title: "yes", url: "https://x.y/?a=1&b=[2]::3", description: "linia 1\nlinia 2", note: " spacja", empty: "", nullish: "null", iso: "2026-05-01T10:00:00.000Z", tags: ["a: b", "# c"], favorite: true, pl: "Zażółć gęślą jaźń" }` |
| `id: "123"` pozostaje tekstem (nie liczbą) po odczycie | `typeof items[0].id === "string"`                                                                                                                                                                                                                                                                                                              |
| pole `undefined`                                       | pominięte w tekście i brak klucza po odczycie                                                                                                                                                                                                                                                                                                  |
| brak `generated_by`                                    | `generatedBy === null`                                                                                                                                                                                                                                                                                                                         |
| `parseYamlList("- a\n- b", "x")`                       | rzuca błąd (nie mapa)                                                                                                                                                                                                                                                                                                                          |
| `parseYamlList("x: 5", "x")`                           | rzuca błąd (`klucz "x" nie jest listą`)                                                                                                                                                                                                                                                                                                        |
| `parseYamlList("x:\n  - 1", "x")`                      | rzuca błąd (element nie jest mapą)                                                                                                                                                                                                                                                                                                             |
| `parseYamlList("version: 1", "x").items`               | `[]`                                                                                                                                                                                                                                                                                                                                           |

`frontmatter.test.ts`:

| Test                                                                    | Oczekiwanie                                                                                                                                                                                                               |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `formatFrontmatter({ id: "n1", title: "A: b", tags: [] }, "Treść\n\n")` | zaczyna się od `---\n`, kończy `Treść\n`, między nimi pusta linia po `---`                                                                                                                                                |
| round-trip                                                              | `parseFrontmatter(formatFrontmatter(meta, body))` → `{ meta, body: "Treść" + "\n" }` dla `meta = { id: "1", title: "Zażółć: [x] # y", created: "2026-05-01T10:00:00.000Z", tags: ["a", "b"] }`; `meta.id` zostaje tekstem |
| tekst bez frontmattera                                                  | `parseFrontmatter("# Nagłówek")` → `null`                                                                                                                                                                                 |
| frontmatter niebędący mapą (`---\n- a\n---\n`)                          | `null`                                                                                                                                                                                                                    |
| uszkodzony YAML                                                         | `null`                                                                                                                                                                                                                    |
| `\r\n` w pliku                                                          | parsuje poprawnie                                                                                                                                                                                                         |
| `undefined` w `meta`                                                    | pomijane                                                                                                                                                                                                                  |

- [ ] **Step 2: Uruchom, zobacz czerwony** (`npx vitest run tests/unit/lib/nexus`): FAIL na brakujących modułach.

- [ ] **Step 3: Zaimplementuj** `lib/nexus/yaml-lists.ts`:

```ts
import YAML from "yaml";

/** Znacznik w plikach tworzonych przez import (krok 0b); pliki bez niego uznajemy za ręczne. */
export const GENERATED_BY_IMPORT = "import-to-vault";

export type YamlRecord = Record<string, unknown>;

/**
 * Plik z listą rekordów: `version`, opcjonalnie `generated_by`, potem lista pod kluczem `listKey`.
 * Wartości `undefined` są pomijane. Wersja 1.1 wymusza cudzysłowy przy wartościach, które
 * parsery YAML 1.1 (np. Obsidian) czytałyby jako liczby, daty lub booleany.
 */
export function formatYamlList(listKey: string, items: YamlRecord[], generatedBy?: string): string {
  const doc: Record<string, unknown> = { version: 1 };
  if (generatedBy) doc.generated_by = generatedBy;
  doc[listKey] = items;
  return YAML.stringify(doc, { lineWidth: 0, version: "1.1" });
}

export function parseYamlList(
  text: string,
  listKey: string
): { generatedBy: string | null; items: YamlRecord[] } {
  const doc = YAML.parse(text);
  if (doc === null || typeof doc !== "object" || Array.isArray(doc)) {
    throw new Error("plik YAML nie jest mapą z listą");
  }
  const record = doc as Record<string, unknown>;
  const raw = record[listKey];
  if (raw !== undefined && !Array.isArray(raw)) {
    throw new Error(`klucz "${listKey}" nie jest listą`);
  }
  const items = (raw ?? []) as unknown[];
  for (const item of items) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`element listy "${listKey}" nie jest mapą`);
    }
  }
  return {
    generatedBy: typeof record.generated_by === "string" ? record.generated_by : null,
    items: items as YamlRecord[],
  };
}
```

`lib/nexus/frontmatter.ts`:

```ts
import YAML from "yaml";

export type Frontmatter = Record<string, unknown>;

/** `---\n<yaml>---\n\n<treść>\n`. Wartości `undefined` w `meta` są pomijane. */
export function formatFrontmatter(meta: Frontmatter, body: string): string {
  const yamlText = YAML.stringify(meta, { lineWidth: 0, version: "1.1" });
  const trimmed = body.replace(/^\n+/, "").replace(/\s+$/, "");
  return `---\n${yamlText}---\n\n${trimmed}\n`;
}

/** Zwraca `null`, gdy tekst nie zaczyna się poprawnym frontmatterem (mapa YAML). */
export function parseFrontmatter(text: string): { meta: Frontmatter; body: string } | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)([\s\S]*)$/.exec(text);
  if (!match) return null;
  let meta: unknown;
  try {
    meta = YAML.parse(match[1]);
  } catch {
    return null;
  }
  if (meta === null || typeof meta !== "object" || Array.isArray(meta)) return null;
  return { meta: meta as Frontmatter, body: match[2].replace(/^\r?\n/, "") };
}
```

Uwaga do implementacji: dla pustej treści `formatFrontmatter` daje `---\n…---\n\n\n`; jeśli test na pustej treści tego wymaga, ustal i zapisz w teście jeden jawny kształt (zalecany: `---\n…---\n\n` + `""` + `\n`).

- [ ] **Step 4: Zielony:** `npx vitest run tests/unit/lib/nexus`. Jeśli któryś rekord nie przechodzi round-tripu, zapisz kontrprzykład jako test i popraw format (nie osłabiaj testu).

- [ ] **Step 5: Commit** `feat(nexus): yaml list and frontmatter formats shared with the file layer`

---

### Task 4: `types.ts`, `args.ts`, `helpers.ts`

**Files:** Create: `scripts/import-to-vault/types.ts` (treść z „Kontrakt typów”), `scripts/import-to-vault/args.ts`, `tests/unit/scripts/import-to-vault/helpers.ts`, `tests/unit/scripts/import-to-vault/args.test.ts`.

`args.ts`: `parseImportArgs(argv: string[], env: Record<string, string | undefined>): { ok: true; dump: string; vault: string; write: boolean; uid?: string } | { ok: false; error: string }`. Użyj `util.parseArgs` (`strict: true`, opcje: `dump` string, `vault` string, `write` boolean, `uid` string, `help` boolean). Reguły: `--dump` wymagane; vault z `--vault`, a gdy brak, z `env.NEXUS_VAULT_PATH`; brak obu → błąd z podpowiedzią; nieznana opcja → `{ ok: false }` (nie rzucaj).

- [ ] **Step 1: Test `args.test.ts`** (przypadki z oczekiwaniami):
  - `["--dump","d","--vault","v"]`, env `{}` → `{ ok: true, dump: "d", vault: "v", write: false }`
  - `["--dump","d","--write"]`, env `{ NEXUS_VAULT_PATH: "/x/Vault" }` → `ok`, `vault: "/x/Vault"`, `write: true`
  - `["--vault","v"]` → `ok: false`, `error` zawiera `--dump`
  - `["--dump","d"]`, env `{}` → `ok: false`, `error` zawiera `NEXUS_VAULT_PATH`
  - `["--dump","d","--vault","v","--nope"]` → `ok: false`
  - `["--dump","d","--vault","v","--uid","u1"]` → `uid: "u1"`
- [ ] **Step 2: Czerwony → Step 3: implementacja → Step 4: zielony** (`npx vitest run tests/unit/scripts/import-to-vault/args.test.ts`).
- [ ] **Step 5: `helpers.ts`** (kod pomocniczy testów, nie ma własnych testów):
  - `ts(iso: string)` → `{ __type: "timestamp", iso, seconds: Math.floor(Date.parse(iso)/1000), nanos: 0 }`
  - `makeDump(dir: string, collections: Record<string, Array<{ id: string; data: Record<string, unknown> }>>, manifestPatch?: object): void` — dla ścieżki zaczynającej się od `users/` plik to `<ścieżka>.jsonl`, dla pozostałych `root/<ścieżka>.jsonl`; wiersz JSONL `{"_id","_path":"<kolekcja>/<id>","data"}`; liczy SHA-256 (`crypto.createHash("sha256")`) i liczbę linii; zapisuje `manifest.json` w kształcie z `scripts/export-firestore/types.ts` (`version: 1`, `tool: "export-firestore"`, `exportedAt: "2026-11-12T10:00:00.000Z"`, `projectId: null`, `pageSize: 500`, `uid: null`, `only: null`, `status: "ok"`, `collections: [{path,file,known:true,before:n,lines:n,after:n,sha256}]`, `ghosts: []`, `auth: {skipped:true}`, `totals`), po czym nakłada `manifestPatch` (`Object.assign`).
  - `sampleCollections()` zwraca dane syntetyczne używane w Task 12 (opis w tamtym zadaniu).
- [ ] **Step 6: Commit** `feat(import): shared types, CLI args, test helpers`

---

### Task 5: `read-dump.ts`

**Files:** Create: `scripts/import-to-vault/read-dump.ts`, `tests/unit/scripts/import-to-vault/read-dump.test.ts`.

Interfejs: `export class DumpError extends Error {}`; `export function readDump(dumpDir: string, uidOverride?: string): DumpData`.

Reguły:

1. `manifest.json` musi istnieć i być poprawnym JSON-em z `version === 1`, `tool === "export-firestore"`, `status === "ok"`; inaczej `DumpError` (komunikat zawiera faktyczny status).
2. Dla każdego wpisu `collections[]`: ścieżka `file` rozwiązana względem `dumpDir` musi leżeć wewnątrz `dumpDir` (odrzuć `..` i ścieżki absolutne), plik istnieje, SHA-256 zawartości równa `sha256`, liczba niepustych linii równa `lines`. Każda linia to JSON `{_id: string, _path: string, data: object}` i `_path === entry.path + "/" + _id`. Komunikaty błędów zawierają nazwę pliku i numer linii, nigdy treść rekordu.
3. Obsługiwane kolekcje to ścieżki `users/<uid>/<typ>` dla `typ` ∈ `HANDLED_TYPES`. Konto wybierasz tak: `uidOverride` (musi występować, inaczej `DumpError`); w przeciwnym razie `manifest.uid`; w przeciwnym razie jedyny uid obsługiwanych kolekcji; przy kilku uid bez wskazania `DumpError` z prośbą o `--uid`. Brak jakiejkolwiek obsługiwanej kolekcji → `DumpError`.
4. Wszystko inne trafia do `skipped` z powodem i liczbą linii: obsługiwany typ innego konta → powód `inne konto`, `type` ustawione; `users/<uid>/<inna kolekcja>` oraz zagnieżdżone → `poza zakresem etapu 0 (§1.1)`, `type: null`; ścieżki spoza `users/` → `kolekcja główna, poza zakresem`, `type: null`. Wpisy z 0 linii też trafiają na listę (count 0).
5. `exportedAt` przepisane z manifestu.

Przypadki testowe (każdy na `makeDump` w katalogu tymczasowym):

- poprawny zrzut z `users/u1/notes` (2 wiersze), `users/u1/tasks` (1), `users/u1/calendar_events` (3), `users/u2/notes` (1), `waitlist` (1): `rows.notes.length === 2`, `rows.tasks[0].id` i `.path` zgodne, `uid === "u1"` po `uidOverride: "u1"`; `skipped` zawiera `{path:"users/u1/calendar_events",count:3,type:null}`, `{path:"users/u2/notes",count:1,type:"notes",reason:"inne konto"}`, `waitlist`.
- bez `uidOverride` przy dwóch uid z obsługiwanymi kolekcjami → `DumpError` zawiera `--uid`.
- `manifestPatch: { uid: "u1" }` wybiera `u1` bez `uidOverride`.
- `manifestPatch: { status: "needs-review" }` → `DumpError` zawiera `needs-review`.
- zmiana jednego bajtu w pliku `.jsonl` po zapisaniu manifestu → `DumpError` zawiera nazwę pliku.
- obcięta ostatnia linia (inna liczba linii, ale zmienione SHA też) → `DumpError`.
- `manifest.json` nie istnieje → `DumpError`.
- wpis z `file: "../poza.jsonl"` → `DumpError` (ucieczka z katalogu).
- wiersz z `_path` niezgodnym z kolekcją → `DumpError`, komunikat bez treści `data` (sprawdź, że nie zawiera sentynelowego tekstu `SEKRET` umieszczonego w `data`).
- zrzut bez żadnej obsługiwanej kolekcji → `DumpError`.

- [ ] Kroki: test (czerwony) → implementacja → zielony (`npx vitest run tests/unit/scripts/import-to-vault/read-dump.test.ts`) → commit `feat(import): read and verify the dump`.

---

### Task 6: `records.ts` (normalizacja rekordów)

**Files:** Create: `scripts/import-to-vault/records.ts`, `tests/unit/scripts/import-to-vault/records.test.ts`.

Interfejs:

- `toIso(value: unknown): string | null` — tekst zwraca bez zmian; obiekt `{__type: "timestamp", iso}` zwraca `iso`; reszta `null`. (Nie importuj `firebase-admin`; nie dekoduj całego zrzutu.)
- `convertDump(dump: DumpData): Converted` — woła normalizatory dla każdego wiersza i zbiera `warnings`.
- Normalizatory (eksportowane do testów): `normalizeTask(row, warnings)`, `normalizeNote`, `normalizeResource`, `normalizeTag`, `normalizeTemplate`.

Reguły (id zawsze z `row.id`, czyli `_id`, nie z `data.id`):

- **Zadanie** → `TaskLine`: `title` tekst (nie-tekst → `""` + ostrzeżenie), `status` jeden z czterech, inaczej `todo` + ostrzeżenie `zadanie <id>: nieznany status "<wartość>", ustawiono todo`, `link`/`description` tekst lub `""`, `due_date` niepusty tekst lub `null`, `priority`/`order` skończone liczby lub `null`, `created_at` = `toIso(data.created_at) ?? toIso(data.createdAt)`, `updated_at` analogicznie z `updated_at`/`updatedAt`.
- **Notatka** → `VaultNote`: `title` tekst lub `""`, `html` = `data.content` jeśli tekst, inaczej `""` (+ostrzeżenie, gdy to nie `undefined`), `created`/`updated` jak wyżej, `tags` = tablica tekstów z `data.tags` lub `[]`.
- **Zasób** → `VaultResource`: `url`, `title`, `description` tekst lub `""`, `tags` tablica tekstów, `favorite = data.isFavorite === true`, opcjonalne `thumbnail_url` (z `thumbnailUrl`), `note_id` (z `noteId`), `created`/`updated` (z `created_at`/`createdAt`, `updated_at`/`updatedAt`; brak → klucz nieustawiony).
- **Tag** → `{ id, tag, title, color?, created? }`; **szablon** → `{ id, label, title, link, created? }` (teksty lub `""`).
- Klucze opcjonalne ustawiaj tylko, gdy wartość istnieje (nie zapisuj `undefined`).

Przypadki testowe:

- `toIso("2026-05-01 10:00:00")` → ten sam tekst; `toIso({__type:"timestamp",iso:"2026-05-01T10:00:00.000Z",seconds:1,nanos:0})` → `"2026-05-01T10:00:00.000Z"`; `toIso(undefined)`, `toIso(5)`, `toIso({})` → `null`.
- Zadanie pełne: wszystkie pola przepisane; `createdAt` jako Timestamp trafia do `created_at`, gdy brak `created_at`.
- Zadanie ze statusem `"archived"` → `status: "todo"`, jedno ostrzeżenie zawierające id i `archived`; `priority: "3"` (tekst) → `null`; `due_date: ""` → `null`; `order: 1.5` zachowane.
- Notatka: `content` HTML w `html`; `tags: "x"` → `[]`; `createdAt` Timestamp → `created`.
- Zasób: `isFavorite: true` → `favorite: true`; brak `thumbnailUrl` → brak klucza `thumbnail_url` (`"thumbnail_url" in rec === false`).
- `convertDump` na `DumpData` z po jednym wierszu każdego typu zwraca po jednym rekordzie i puste `warnings`.

- [ ] Kroki: test → czerwony → implementacja → zielony → commit `feat(import): normalize dump records`.

---

### Task 7: `slug.ts` i `notes.ts`

**Files:** Create: `scripts/import-to-vault/slug.ts`, `scripts/import-to-vault/notes.ts`, `tests/unit/scripts/import-to-vault/slug.test.ts`, `tests/unit/scripts/import-to-vault/notes.test.ts`.

`slug.ts`:

- `slugify(title: string): string` — kolejność: zamień `łŁđĐøØßæÆœŒ` na `l L d D o O ss ae AE oe OE`; `normalize("NFD")` i usuń znaki łączące `\u0300-\u036f`; małe litery; każdy ciąg znaków spoza `[a-z0-9]` → jeden `-`; przytnij `-` z obu końców; ogranicz do 80 znaków i znów przytnij końcowe `-`; pusty wynik → `bez-tytulu`; nazwy zarezerwowane Windows (`con prn aux nul com1..9 lpt1..9`) dostają dopisek `-`.
- `allocateName(base: string, isTaken: (name: string) => boolean): string` — `base`, a gdy zajęte `base-2`, `base-3`, …
- `htmlFileName(id: string): string` — `id`, gdy pasuje do `^[A-Za-z0-9_-]{1,128}$`; inaczej znaki spoza zbioru zamienione na `_` plus `-` plus pierwsze 8 znaków hex SHA-1 oryginalnego `id`.

Przypadki `slug.test.ts`: `"Zażółć gęślą jaźń"` → `"zazolc-gesla-jazn"`; `"  Hello,  World!! "` → `"hello-world"`; `""`, `"???"`, `"日本語"` → `"bez-tytulu"`; `"CON"` → `"con-"`; `"a".repeat(100)` → długość 80; `"a".repeat(79) + " b"` → `"a".repeat(79)`; `allocateName("x", n => n === "x")` → `"x-2"`; `allocateName("x", n => ["x","x-2"].includes(n))` → `"x-3"`; `htmlFileName("abc_DEF-123")` → to samo; `htmlFileName("a/b")` pasuje do `^a_b-[0-9a-f]{8}$` i jest deterministyczne (dwa wywołania równe); `htmlFileName("a/b") !== htmlFileName("a_b")`.

`notes.ts`:

- `detectLosses(html: string): string[]` — wykrywa na tekście HTML (regex, bez DOM) i zwraca nazwy w stałej kolejności: `kolor czcionki` (atrybut `style` z `color:` niepoprzedzonym `-` lub literą/cyfrą, albo `<font color=`), `kolor tła` (`background` / `background-color` w `style`), `wyrównanie` (`text-align`), `krój czcionki` (`font-family` lub `<font face=`), `rozmiar czcionki` (`font-size`), `podkreślenie` (`text-decoration` z `underline` w `style` lub tag `<u>`), `zakreślenie` (`<mark>`), `indeks górny/dolny` (`<sup>`, `<sub>`), `tabela` (`<table>`), `lista zadań` (`data-type="taskList"` lub `type="checkbox"`), `osadzone media` (`<iframe|video|audio|embed|object>`). Wzorce muszą działać dla cudzysłowów `"` i `'` oraz bez rozróżniania wielkości liter. Tekst „color: red” poza atrybutem `style` nie jest stratą.
- `htmlToMarkdown(html: string): string` — `TurndownService` z opcjami `{ headingStyle: "atx", bulletListMarker: "-", codeBlockStyle: "fenced", emDelimiter: "*" }` oraz regułą dla `s`, `del`, `strike` → `~~treść~~`; wynik przycięty (`trim`).
- `buildNoteFiles(note: VaultNote): { markdown: string; html: string; losses: string[] }` — `markdown` to `formatFrontmatter({ id, title, created, updated, tags }, htmlToMarkdown(html))` (pola `created`/`updated` pominięte, gdy `null` — przekaż `undefined`); `html` to `note.html` bez zmian; `losses = detectLosses(note.html)`.

Przypadki `notes.test.ts`:

- `htmlToMarkdown("<h1>Tytuł</h1><p>Akapit <strong>gruby</strong> i <em>kursywa</em></p>")` → `"# Tytuł\n\nAkapit **gruby** i *kursywa*"`.
- `htmlToMarkdown("<ul><li>jeden</li><li>dwa</li></ul>")` pasuje do `/^-\s+jeden$/m` i `/^-\s+dwa$/m`.
- `htmlToMarkdown("<p>a <s>b</s></p>")` → `"a ~~b~~"`.
- `htmlToMarkdown("")` → `""`; tekst bez tagów z polskimi znakami przechodzi bez utraty liter.
- `detectLosses`: `<p style="color: red; text-align: center">x</p><u>y</u>` → `["kolor czcionki","wyrównanie","podkreślenie"]`; `<span style="background-color: #fff">x</span>` → `["kolor tła"]`; `<span style='font-family: Arial; font-size: 12px'>x</span>` → `["krój czcionki","rozmiar czcionki"]`; `<font color="red">x</font>` → `["kolor czcionki"]`; `<table><tr><td>x</td></tr></table>` → `["tabela"]`; `<ul data-type="taskList"><li>x</li></ul>` → `["lista zadań"]`; `<p>color: red</p>` → `[]`; `<mark>x</mark><sup>2</sup>` → `["zakreślenie","indeks górny/dolny"]`.
- `buildNoteFiles` dla notatki o tytule `"A: b ] c"` i tagach `["x"]`: `parseFrontmatter(markdown)` zwraca `meta` równe `{ id, title: "A: b ] c", created, updated, tags: ["x"] }` (klucze w tej kolejności), `html` identyczny z wejściem; `created: null` → brak klucza `created` w `meta`.

- [ ] Kroki: testy → czerwone → implementacja → zielone → commit `feat(import): slugs and HTML to Markdown with loss report`.

---

### Task 8: `write.ts` (zapis atomowy i ochrona ścieżki)

**Files:** Create: `scripts/import-to-vault/write.ts`, `tests/unit/scripts/import-to-vault/write.test.ts`.

Interfejs:

- `export class PathOutsideVaultError extends Error {}`
- `resolveInsideVault(vaultRoot: string, rel: string): string` — zwraca ścieżkę absolutną. Odrzuca (`PathOutsideVaultError`): pustą ścieżkę, ścieżkę absolutną, każdy segment `..`, wynik poza `realpath(vaultRoot)`, oraz ścieżkę, której najbliższy istniejący przodek (po `realpath`) leży poza vaultem (symlink). Root musi istnieć i być katalogiem (inaczej zwykły `Error`).
- `atomicWrite(abs: string, content: string): void` — plik tymczasowy w tym samym katalogu (`.<nazwa>.<pid>.<losowe>.tmp`, flaga `wx`), potem `renameSync`; przy błędzie usuń plik tymczasowy (`rmSync(tmp, { force: true })`, jedyne dozwolone kasowanie w skrypcie) i rzuć dalej.
- `createVaultView(vaultRoot: string): VaultView` — `read` zwraca `null` dla `ENOENT`, `list` zwraca tylko pliki (nie katalogi) posortowane, `[]` dla `ENOENT`; obie przechodzą przez `resolveInsideVault`.
- `applyPlan(vaultRoot: string, files: PlannedFile[]): { created: number; updated: number; unchanged: number }` — najpierw sprawdza wszystkie ścieżki (jeśli którakolwiek jest niedozwolona, nic nie zapisuje), potem dla każdego pliku: `unchanged` pomijany (nie dotykaj pliku, mtime ma zostać), `create`/`update` tworzy katalogi (`mkdirSync recursive`) i woła `atomicWrite`.

Przypadki:

- `resolveInsideVault(root, "Notes/a.md")` → `path.join(realRoot, "Notes", "a.md")`.
- Odrzucone: `"../x.md"`, `"Notes/../../x.md"`, `"/etc/passwd"`, `""`, `"Notes/.."` (wskazuje root), oraz `"link/x.md"`, gdzie `link` to dowiązanie symboliczne w vaulcie do katalogu poza nim.
- `resolveInsideVault` dla nieistniejącej, zagnieżdżonej, dozwolonej ścieżki (`Notes/.html/a.html`) przechodzi.
- `atomicWrite` zapisuje dokładną treść (w tym polskie znaki) i nie zostawia plików `*.tmp`.
- `applyPlan` z planem zawierającym `{ relPath: "../evil.md" }` na końcu listy rzuca `PathOutsideVaultError` i **żaden** wcześniejszy plik nie powstał.
- `applyPlan` ustawia mtime istniejącego pliku `unchanged` na stary (`utimesSync`) i po wywołaniu mtime nadal jest stary; zwraca poprawne liczniki.
- `createVaultView`: `read("Nie/ma.md")` → `null`; `list("Notes")` nie zwraca podkatalogu `.html`; `list("Brak")` → `[]`; `read("../x")` rzuca.

- [ ] Kroki: test → czerwony → implementacja → zielony → commit `feat(import): atomic vault writer with path guard`.

---

### Task 9: `plan.ts` (plan zapisu, czysta funkcja)

**Files:** Create: `scripts/import-to-vault/plan.ts`, `tests/unit/scripts/import-to-vault/plan.test.ts`.

Interfejs: `buildPlan(converted: Converted, vault: VaultView): PlanResult`. Test używa `VaultView` w pamięci (obiekt z mapą `ścieżka → treść`; `list(dir)` zwraca nazwy plików bezpośrednio w `dir`).

Reguły:

1. **Notatki.** Indeks istniejących: dla każdego `*.md` w `Notes/` sparsuj frontmatter; `meta.id` tekstowe → `idToRel[id]`; pozostałe pliki (brak frontmattera lub `id`) są „obce”. Zajęte nazwy porównuj bez rozróżniania wielkości liter (vault może leżeć na dysku Windows). Notatki sortuj po (`created ?? ""`, `id`). Notatka z `id` w indeksie zachowuje swoją ścieżkę (też gdy tytuł się zmienił). Nowa dostaje `Notes/<allocateName(slugify(title))>.md`. Gdy bazowa nazwa kolidowała z plikiem obcym, dodaj ostrzeżenie zawierające ścieżkę obcego pliku; kolizja z inną notatką z tego samego importu (duplikat tytułu) to tylko sufiks, bez ostrzeżenia. Każda notatka daje dwa `PlannedFile`: `note` (`buildNoteFiles(...).markdown`) i `note-html` w `Notes/.html/<htmlFileName(id)>.html`. `noteFiles[id]` = ścieżka `.md`. `noteLosses` zawiera tylko notatki z niepustymi stratami.
2. **Pliki pojedyncze.** `tasks` → `Tasks/tasks.md` (treść: `formatFrontmatter({ generated_by: GENERATED_BY_IMPORT }, "# Zadania\n\n" + linie zadań połączone \n)`), `resources` → `Resources/resources.yaml`, `tags` → `Resources/tags.yaml`, `templates` → `Tasks/templates.yaml` (`formatYamlList(klucz, rekordy, GENERATED_BY_IMPORT)`, kluczem listy jest `resources`, `tags`, `templates`). Brak rekordów danego typu → brak pliku i brak klucza w `targets`. Własność: istniejący plik jest „nasz”, gdy `generated_by === "import-to-vault"` (dla `tasks.md` z frontmattera, dla YAML z `parseYamlList`; błąd parsowania = obcy). Kandydaci: `base`, `base-2`, `base-3`, … (przed rozszerzeniem); wybierz pierwszy nieistniejący lub nasz; gdy wybrany ≠ `base`, dodaj ostrzeżenie z obiema ścieżkami.
3. **Kolejność rekordów** (deterministyczna): zadania po (`order` rosnąco, brak na końcu, `created_at ?? ""`, `id`); zasoby po (`created ?? ""`, `id`); tagi po (`tag`, `id`); szablony po (`label`, `id`).
4. **Klucze rekordów YAML** w kolejności: zasób `id,title,url,description,tags,favorite,thumbnail_url,note_id,created,updated`; tag `id,tag,title,color,created`; szablon `id,label,title,link,created` (pola nieustawione pomijane).
5. `action` każdego pliku: `create` gdy `vault.read` zwraca `null`, `unchanged` gdy treść identyczna, inaczej `update`.

Przypadki:

- trzy nowe notatki „Zażółć gęślą jaźń”, „Duplikat” (starsza), „Duplikat” (nowsza), pusty tytuł → ścieżki `Notes/zazolc-gesla-jazn.md`, `Notes/duplikat.md` (starsza), `Notes/duplikat-2.md`, `Notes/bez-tytulu.md`; wszystkie `create`; brak ostrzeżeń.
- istniejący `Notes/stara-nazwa.md` z frontmatterem `id: n1` → notatka `n1` ma `noteFiles.n1 === "Notes/stara-nazwa.md"`, `action: "update"` (lub `unchanged`, gdy treść ta sama); nie powstaje `Notes/<slug-tytułu>.md`.
- obcy `Notes/duplikat.md` bez frontmattera → nowa „Duplikat” ląduje w `Notes/duplikat-2.md`, ostrzeżenie zawiera `Notes/duplikat.md`.
- obcy `Notes/Duplikat.md` (wielka litera) blokuje `duplikat` tak samo.
- drugi przebieg: plan zbudowany na widoku zawierającym pliki z pierwszego planu daje same `unchanged`.
- `Tasks/tasks.md` nieistniejący → `create`, `targets.tasks === "Tasks/tasks.md"`; istniejący z `generated_by: import-to-vault` → `update`/`unchanged`; istniejący bez znacznika → `Tasks/tasks-2.md` + ostrzeżenie; gdy i `tasks-2.md` obcy → `tasks-3.md`.
- brak tagów w `Converted` → brak `targets.tags` i brak pliku.
- zadania: dwa z `order` 2 i 1 oraz jedno bez `order` → w pliku w kolejności 1, 2, bez `order`; `parseTaskLines(treść pliku)` zwraca dokładnie te rekordy.
- `noteLosses` dla notatki z `<u>` zawiera `{ id, relPath, losses: ["podkreślenie"] }`, a notatka bez strat nie występuje.

- [ ] Kroki: test → czerwony → implementacja → zielony → commit `feat(import): idempotent write plan`.

---

### Task 10: `verify.ts` (round-trip)

**Files:** Create: `scripts/import-to-vault/verify.ts`, `tests/unit/scripts/import-to-vault/verify.test.ts`.

Interfejs: `verifyVault(expected: Converted, plan: Pick<PlanResult, "targets" | "noteFiles">, vault: VaultView): { ok: boolean; problems: string[]; found: Record<HandledType, number> }`.

Reguły (czyta wyłącznie z `vault`, niezależnie od `plan.files`):

- **Notatki:** przeskanuj `Notes/*.md`, zbuduj `id → {title}` z frontmattera. Dla każdej oczekiwanej notatki: istnieje (inaczej `brak notatki id=<id>`), `title` zgodny (`niezgodne pola notatki id=<id>: title`), plik `Notes/.html/<htmlFileName(id)>.html` istnieje i jest identyczny z oczekiwanym HTML (`niezgodne pola notatki id=<id>: html`). Ten sam `id` w dwóch plikach → problem `zduplikowane id notatki <id>`. Notatki w vaulcie spoza oczekiwanych `id` są ignorowane (ręczne).
- **Zadania:** gdy są oczekiwane, odczytaj `plan.targets.tasks`, `parseTaskLines`; porównaj po `id` cały rekord (`toEqual`) i zgłoś `niezgodne pola zadania id=<id>: <lista nazw pól>` (nigdy wartości); brakujące `brak zadania id=<id>`; zdublowane `id` w pliku → problem; błąd `TaskLineError` → problem z numerem linii.
- **Zasoby, tagi, szablony:** analogicznie z `parseYamlList`; porównanie rekordu z oczekiwanym po normalizacji `JSON.parse(JSON.stringify(rec))` (usuwa `undefined`) i porównaniu każdego klucza osobno; brak pliku z `targets` → `brak pliku <ścieżka>`.
- `found[typ]` = liczba znalezionych oczekiwanych rekordów danego typu (`user_tags` ↔ `tags`, `task_templates` ↔ `templates`).
- `ok === (problems.length === 0)`.

Przypadki (stan vaulta przygotuj przez `buildPlan` + `applyPlan` w katalogu tymczasowym, `createVaultView`):

- nietknięty wynik → `ok: true`, `found` równe liczbom oczekiwanym.
- usunięty plik notatki → problem zawiera `brak notatki id=<id>` i `ok: false`.
- zmieniony tytuł w frontmatterze → problem z `title`, bez wartości tytułu w komunikacie (sprawdź brak sentynelu).
- zmieniony plik `.html` → problem z `html`.
- w `tasks.md` zmieniony status jednego zadania → problem `niezgodne pola zadania id=<id>: status`.
- usunięta linia zadania → `brak zadania id=<id>`.
- usunięty `resources.yaml` → `brak pliku Resources/resources.yaml`.
- ręczna notatka w `Notes/` z innym `id` nie wpływa na wynik.
- ten sam `id` w dwóch plikach notatek → `zduplikowane id notatki`.

- [ ] Kroki: test → czerwony → implementacja → zielony → commit `feat(import): round-trip verification`.

---

### Task 11: `report.ts`

**Files:** Create: `scripts/import-to-vault/report.ts`, `tests/unit/scripts/import-to-vault/report.test.ts`.

Interfejs:

```ts
export type TypeCount = { dump: number; written: number; skipped: number };
export type RunReport = {
  mode: "dry-run" | "write";
  uid: string;
  counts: Record<HandledType, TypeCount>;
  outOfScope: SkippedGroup[]; // skipped z type === null
  fileActions: { create: number; update: number; unchanged: number };
  warnings: string[];
  noteLosses: NoteLoss[];
  verify: { ran: boolean; ok: boolean; problems: string[] };
  /** Tylko do raportu szczegółowego: tytuły notatek po id. */
  noteTitles: Record<string, string>;
};
export function formatScreenReport(report: RunReport): string;
export function writeDetailedReport(dumpDir: string, report: RunReport, now: Date): string; // zwraca ścieżkę pliku
```

Reguły:

- `formatScreenReport`: tryb (`DRY-RUN: nic nie zapisano` albo `ZAPIS`), tabela liczb per typ (`zrzut / zapisane / pominięte`), osobno kolekcje poza zakresem (ścieżka, liczba, powód), liczniki plików (create/update/unchanged), ostrzeżenia (każde w osobnej linii), lista notatek ze stratami jako `ścieżka (id): strata1, strata2`, wynik round-tripu (`round-trip: OK` / `NIEZGODNY` z listą problemów albo `nie uruchamiano (dry-run)`). **Bez tytułów, treści i HTML.**
- `writeDetailedReport`: plik `<dumpDir>/import-report-<RRRR-MM-DDTGGMMSS>.json` (z `now`, UTC), `mode 0o600`, treść to cały `report` jako JSON z wcięciem (łącznie z `noteTitles`). Nie zmienia uprawnień katalogu. Jeśli katalog ma uprawnienia dla grupy lub innych (`mode & 0o077`), dodaje do `report.warnings` ostrzeżenie przed zapisem.

Przypadki:

- raport z notatką, której tytuł i HTML zawierają `SEKRET`: `formatScreenReport(...)` nie zawiera `SEKRET`, zawiera `Notes/x.md`, `kolor czcionki, wyrównanie`.
- `formatScreenReport` pokazuje `dry-run` w trybie dry-run i `NIEZGODNY` przy `verify.ok === false`.
- `writeDetailedReport` tworzy plik o trybie `0600` (`fs.statSync(...).mode & 0o777`), poprawny JSON, nazwa pasuje do `^import-report-2026-11-12T\d{6}\.json$` dla `now = 2026-11-12T10:20:30Z` (czyli `import-report-2026-11-12T102030.json`); zawiera `SEKRET` (szczegółowy raport go ma).
- katalog `0755` → ostrzeżenie w `report.warnings` o uprawnieniach.

- [ ] Kroki: test → czerwony → implementacja → zielony → commit `feat(import): screen and detailed reports`.

---

### Task 12: `run.ts`, CLI i test integracyjny

**Files:** Create: `scripts/import-to-vault/run.ts`, `scripts/import-to-vault.ts`, `tests/unit/scripts/import-to-vault/run.test.ts`; Modify: `tests/unit/scripts/import-to-vault/helpers.ts` (dopisz `sampleCollections`).

`run.ts`: `runImport(opts: { dumpDir: string; vaultRoot: string; write: boolean; uid?: string; now?: Date }): { exitCode: number; screen: string }`.

Przebieg:

1. `readDump` → `DumpError` → `exitCode: EXIT.DUMP`, ekran z komunikatem.
2. `convertDump`; `createVaultView(vaultRoot)` (błąd roota → `EXIT.USAGE`); `buildPlan`.
3. Sprawdź `resolveInsideVault` dla każdej ścieżki planu (także w dry-run) → `PathOutsideVaultError` → `EXIT.PATH`, nic nie zapisane.
4. **Bilans:** dla każdego typu `dump = rows[typ].length + skipped(type===typ).count` oraz `written = converted[typ].length`; wymaganie `rows[typ].length === converted[typ].length`; niezgodność → `EXIT.VERIFY`.
5. `write`: `applyPlan`, potem `verifyVault(converted, plan, createVaultView(vaultRoot))`; `!ok` → `EXIT.VERIFY`. Dry-run: bez zapisu i bez weryfikacji (`verify.ran=false`).
6. Zbuduj `RunReport`, `writeDetailedReport` (obie wersje trybu), `formatScreenReport`; ekran dopisuje ścieżkę raportu szczegółowego.
7. Kod wyjścia `EXIT.OK` tylko gdy wszystko zgodne.

CLI `scripts/import-to-vault.ts`: `parseImportArgs(process.argv.slice(2), process.env)`; błąd → `console.error(error)`, `process.exitCode = EXIT.USAGE`; w przeciwnym razie `runImport`, `console.log(screen)`, `process.exitCode = exitCode`. Żadnej logiki poza tym.

`sampleCollections()` (dane syntetyczne, do użycia przez `makeDump`):

| Kolekcja                   | Wiersze                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `users/u1/notes`           | `n1`: tytuł „Zażółć gęślą jaźń”, `content` `<h1>Nagłówek</h1><p style="color: red; text-align: center">Tekst <strong>gruby</strong> i <u>podkreślony</u></p><ul><li>jeden</li><li>dwa</li></ul>`, `createdAt` = `ts("2026-05-01T10:00:00.000Z")`; `n2`: tytuł „Duplikat”, `created_at: "2026-05-02T10:00:00.000Z"`, `content: "<p>pierwszy</p>"`; `n3`: tytuł „Duplikat”, `created_at: "2026-05-03T10:00:00.000Z"`, `content: "<p>drugi</p>"`; `n4`: `title: ""`, `content: "<p>bez tytułu</p>"` |
| `users/u1/tasks`           | `t1`: `title: "Napraw ] i :: błąd"`, `link: "https://x.y/?q=[1]&r=a::b"`, `description: "linia 1\nlinia 2"`, `status: "in_progress"`, `due_date: "2026-11-20"`, `priority: 2`, `order: 1.5`; `t2`: `status: "done"`, `title: "Zrobione"`; `t3`: `status: "archived"`, `title: "Stare"`; `t4`: `title: ""`, `status: "todo"`                                                                                                                                                                      |
| `users/u1/resources`       | `r1`: `title: "Doc: cz. 1"`, `url: "https://example.com/a::b"`, `description: "opis\nwielolinijkowy"`, `tags: ["a", "b: c"]`, `isFavorite: true`, `createdAt`/`updatedAt` jako `ts(...)`                                                                                                                                                                                                                                                                                                         |
| `users/u1/user_tags`       | `g1`: `tag: "pilne"`, `title: "Pilne"`, `color: "#ff0000"`; `g2`: `tag: "yes"`, `title: "Tak"`                                                                                                                                                                                                                                                                                                                                                                                                   |
| `users/u1/task_templates`  | `m1`: `label: "Szablon"`, `title: "Tytuł: [x]"`, `link: ""`                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `users/u1/calendar_events` | 2 wiersze (poza zakresem)                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `users/u2/notes`           | 1 wiersz (inne konto)                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

Przypadki `run.test.ts` (zrzut `makeDump(dumpDir, sampleCollections())`, pusty vault w katalogu tymczasowym z podkatalogiem `Notes` niepotrzebnym — `applyPlan` tworzy katalogi):

- **dry-run:** `exitCode 0`; lista plików i mtime vaulta bez zmian (migawka przed i po: pusta); ekran zawiera `DRY-RUN`, nie zawiera `Zażółć` ani `SEKRET`; plik `import-report-*.json` powstał w katalogu zrzutu.
- **zapis:** `exitCode 0`; istnieją `Notes/zazolc-gesla-jazn.md`, `Notes/duplikat.md`, `Notes/duplikat-2.md`, `Notes/bez-tytulu.md`, cztery pliki `Notes/.html/<id>.html`, `Tasks/tasks.md`, `Resources/resources.yaml`, `Resources/tags.yaml`, `Tasks/templates.yaml`; `Notes/duplikat.md` zawiera `pierwszy`, a `duplikat-2.md` `drugi` (kolejność po dacie); ekran zawiera linię o stratach z `kolor czcionki, wyrównanie, podkreślenie` przy `Notes/zazolc-gesla-jazn.md` i ostrzeżenie o statusie `archived` (po id `t3`); `parseTaskLines` na `tasks.md` daje 4 zadania, `t3` ze statusem `todo`.
- **idempotencja:** drugi przebieg `--write` daje `exitCode 0`, a migawka (ścieżka → treść + mtime) jest identyczna z pierwszą; ekran pokazuje `unchanged` równe liczbie plików i `create`/`update` równe 0.
- **ochrona ręcznej pracy:** przed importem w vaulcie leży `Notes/duplikat.md` z frontmatterem `id: reczna`; po zapisie ten plik jest bajt w bajt nietknięty, obie „Duplikat” trafiły do `duplikat-2.md` i `duplikat-3.md`, ekran zawiera ostrzeżenie.
- **aktualizacja po id:** po pierwszym zapisie zmień tytuł notatki `n1` w zrzucie (nowy `makeDump`) i uruchom ponownie: plik zachowuje nazwę `zazolc-gesla-jazn.md`, ma nowy tytuł, nie powstaje drugi plik.
- **zapis poza vaultem odrzucony:** `applyPlan` testowany w Task 8; tutaj dodatkowo vault, w którym `Notes` jest dowiązaniem symbolicznym do katalogu poza vaultem → `exitCode 3` i brak plików poza vaultem.
- **uszkodzony zrzut:** zmieniony bajt w `users/u1/notes.jsonl` → `exitCode 2`, vault pusty.
- **zrzut z dwoma kontami bez `uid`:** (dodaj `users/u2/tasks`) → `exitCode 2`, komunikat o `--uid`; z `uid: "u1"` → `exitCode 0`.
- **bilans:** zrzut ma 4 notatki konta `u1` i 1 innego konta, więc na ekranie oczekiwane `notes: zrzut 5 / zapisane 4 / pominięte 1`, `tasks 4 / 4 / 0`, `resources 1 / 1 / 0`, `user_tags 2 / 2 / 0`, `task_templates 1 / 1 / 0`, a w „poza zakresem” `users/u1/calendar_events` (2).
- **wykrycie utraty:** po udanym zapisie usuń plik notatki i wywołaj `verifyVault` na wyniku `buildPlan` (patrz Task 10) — ten przypadek jest już w Task 10, tu nie powtarzaj.

- [ ] Kroki: dopisz `sampleCollections` → test (czerwony) → `run.ts` + CLI → zielony (`npx vitest run tests/unit/scripts/import-to-vault/run.test.ts`) → ręczna kontrola CLI na zrzucie z testu:

```bash
npx tsx scripts/import-to-vault.ts --dump <katalog_tmp_zrzutu> --vault <katalog_tmp_vaultu>        # dry-run
echo $?   # 0
```

→ commit `feat(import): orchestration, CLI and end-to-end tests`.

---

### Task 13: Test statyczny

**Files:** Create: `tests/unit/scripts/import-to-vault/static.test.ts`.

Skanuje źródła: `scripts/import-to-vault.ts`, wszystkie `scripts/import-to-vault/*.ts`, `lib/nexus/task-line.ts`, `lib/nexus/yaml-lists.ts`, `lib/nexus/frontmatter.ts`.

Asercje:

1. Żaden z tych plików nie zawiera (regex, bez rozróżniania wielkości liter): `backups`, `homedir`, `firebase`, `child_process`, `execSync`, `spawn`, `git commit`, `node:os`, `process.env` (z jednym wyjątkiem: `scripts/import-to-vault.ts` może zawierać `process.env` przekazywane do `parseImportArgs`; `NEXUS_VAULT_PATH` jako tekst dozwolony tylko w `args.ts`).
2. Import `node:fs` występuje tylko w `read-dump.ts`, `write.ts` i `report.ts`; pozostałe moduły (w tym `lib/nexus/*`, `plan.ts`, `verify.ts`, `notes.ts`, `records.ts`) go nie importują.
3. `rmSync`, `unlinkSync`, `rmdirSync`, `rename` poza `write.ts` nie występują; w `write.ts` dozwolone jest tylko `rmSync(tmp, { force: true })` (sprawdź, że `rmSync(` występuje dokładnie raz).
4. Żaden plik nie zapisuje do ścieżek zrzutu poza `report.ts` (`writeFileSync` występuje tylko w `write.ts` i `report.ts`).
5. Test czyta źródła z `process.cwd()` i `fs.readFileSync`; lista plików pochodzi z `fs.readdirSync("scripts/import-to-vault")`, żeby nowe moduły też były skanowane.

- [ ] Kroki: napisz test → uruchom (`npx vitest run tests/unit/scripts/import-to-vault/static.test.ts`) → popraw źródła tak, by przechodził (nie osłabiaj test) → commit `test(import): static guards for paths, fs and side effects`.

---

### Task 14: Weryfikacja końcowa i dokumentacja

- [ ] **Step 1: Pełna weryfikacja (zleć `cursor`)**

```bash
scripts/ask-helper.sh --role task cursor "W katalogu Second_brain uruchom: npx vitest run tests/unit/lib/nexus tests/unit/scripts/import-to-vault, potem npx tsc --noEmit i npm run lint. Odpowiedz 'przeszło' albo listą plik:linia + przyczyna. Nie edytuj plików."
```

Expected: „przeszło”. Po wszystkich poprawkach także pełny `npm run test:run` (zleć `cursor`), żeby upewnić się, że nic innego się nie zepsuło.

- [ ] **Step 2: Przegląd niezależny** (`scripts/ask-helper.sh --role review agy "Zrób review diffa gałęzi feat/etap-0b-import-do-vaultu względem feat/etap-0a-eksport-firestore ... skup się na: ochronie ścieżki zapisu, idempotencji, ochronie ręcznych plików, kompletności bilansu rekordów"`). Opinie traktuj jak hipotezy: zweryfikuj w kodzie, zanim zmienisz.

- [ ] **Step 3: Dokumentacja.** W `docs/superpowers/specs/2026-11-12-etap-0b-import-do-vaultu-design.md` uzupełnij §2 przyjętymi formatami z sekcji „Decyzje formatu” tego planu, a §10 faktycznymi kodami wyjścia; w `2026-11-12-etap-0-odpiecie-firebase-design.md` zaktualizuj linię „Stan” w §3 (0b zaimplementowane, jeszcze nieuruchomione na prawdziwym zrzucie).

- [ ] **Step 4: Commit** `docs: record stage 0b formats and exit codes`.

- [ ] **Step 5: Uruchomienie na prawdziwych danych (robi użytkownik, nie agent).** Dane osobiste: agent nie czyta zrzutu ani raportu szczegółowego.

```bash
export NEXUS_VAULT_PATH=~/projects/Brain_7224/NEXUS/Vault
npx tsx scripts/import-to-vault.ts --dump <katalog zrzutu zawężonego>            # dry-run, przejrzyj liczby i straty
npx tsx scripts/import-to-vault.ts --dump <katalog zrzutu zawężonego> --write     # zapis + round-trip
npx tsx scripts/import-to-vault.ts --dump <katalog zrzutu zawężonego> --write     # drugi przebieg: same unchanged
cd ~/projects/Brain_7224/NEXUS && git status                                      # przegląd i decyzja o commicie (skrypt niczego nie commituje)
```

Kryteria z §12 specu: dry-run bez błędów; zapis przechodzi round-trip; drugi przebieg bez zmian; w raporcie brak rekordów nieuwzględnionych; straty konwersji zaakceptowane przez użytkownika.

---

## Self-Review

**Pokrycie specu:** dry-run domyślnie (Task 12, test „dry-run”); zapis tylko w `Vault/` i atomowo (Task 8); idempotencja po `id` (Tasks 9, 12); ochrona przed nadpisaniem (Tasks 9, 12); bez commitów (Task 13, brak `child_process`); round-trip: liczba rekordów, zestaw `id`, pola kluczowe, kod ≠ 0 (Tasks 10, 12); raport ekranowy bez treści i szczegółowy 0600 w katalogu zrzutu (Task 11); straty per notatka i oryginał HTML w `Notes/.html/` (Tasks 7, 9, 10); podział kodu zgodny z §6 specu plus `types/args/records/plan/run` oraz `frontmatter.ts` (zapisane w specu); testy: jednostkowe (polskie znaki, duplikaty, pusty tytuł, `]` i `::`, opis wielowierszowy, HTML ze stylami, listami i nagłówkami w `sampleCollections`), property (Task 2), integracyjny (Task 12), statyczny (Task 13); zależności `turndown`, `yaml`, `fast-check` (Task 1).

**Odstępstwa i rzeczy do świadomej akceptacji:** (1) formaty z sekcji „Decyzje formatu” są propozycją tego planu, bo część 1 specu nie została zapisana; (2) statyczny test dopuszcza odczyt vaulta (idempotencja wymaga indeksu `id`), co doprecyzowano w specu §8; (3) po przepisaniu `tasks.md` przez aplikację (0c) ponowny import zapisze obok, nie nadpisze.

**Spójność nazw:** typy i sygnatury pochodzą z „Kontrakt typów” (`VaultView`, `PlannedFile`, `PlanResult`, `Converted`, `NoteLoss`); `plan.targets`/`plan.noteFiles` używane w `verifyVault` i `runImport`; `GENERATED_BY_IMPORT` w `yaml-lists.ts` używane w `plan.ts`; kody `EXIT` używane w `run.ts` i CLI.
