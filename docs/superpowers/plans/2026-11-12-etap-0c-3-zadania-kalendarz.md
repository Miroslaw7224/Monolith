# Etap 0c-3: zadania i kalendarz w vaulcie — plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Cel:** Kolekcje `tasks` i `calendar_events` przestają używać Firestore. Zadania żyją w `Tasks/tasks.md` (linie w formacie z 0b), wydarzenia kalendarza w `Calendar/RRRR-MM.yaml`. Serwisy, trasy API i UI działają bez zmian zachowania (poza kodami 404 opisanymi niżej).

**Architektura:** Nowy `lib/nexus/markdown-edit.ts` (czyste funkcje na tekście: punktowa zmiana jednej linii zadania po `id`), `listVaultFiles` w `vault-fs`, dwa repozytoria `lib/nexus/repos/tasks.ts` i `calendarEvents.ts`. Repozytorium zadań zapisuje przez `updateVaultFile` (linia po linii, reszta pliku bajtowo bez zmian), repozytorium kalendarza przez istniejący `yaml-store` (jeden plik YAML na miesiąc). Barrel `lib/firestore-db.ts` zmienia dwie grupy eksportów; stare pliki `lib/firestore/{tasks,calendar}.ts` znikają.

**Stack:** Next.js 14, TypeScript, Vitest, ESLint, Prettier (lint-staged w hooku commita), biblioteka `yaml`.

**Źródła:** `docs/superpowers/specs/2026-11-12-etap-0c-warstwa-plikowa-design.md` (§3.2, §3.3, §5, §7, P1) oraz `2026-11-12-etap-0c-2-tagi-szablony-zasoby-design.md` (wzorzec: `yaml-store`, `repos/common.ts`, D2, D4, D5).

**Zasady wykonania (CLAUDE.md):** testy, `tsc`, lint i build zleca się `cursor` (`scripts/ask-helper.sh --role advice`, prośba o „przeszło" albo listę `plik:linia + przyczyna`). Review diffa przez `agy` (`--role review`) jest wymagany po 0c-3 (logika zapisu).

---

## Stan wyjściowy i zależności

- **Etap A-1 musi być zmergowany do `main` (PR #10), a 0c-2 jest w `main` (PR #9).** Po A-1 nie istnieją już `services/planService.ts`, `services/agent*`, `lib/agent/*` ani `agentLog`, więc punkt z nadrzędnego specu „`planService` przez API `calendarService`" **jest bezprzedmiotowy**: nic poza `calendarService` nie woła kalendarza.
- Konsumenci `getTasks`/`getCalendarEvents`/`createTask`/… po A-1: tylko `services/taskService.ts` i `services/calendarService.ts` (przez barrel `@/lib/firestore-db`) oraz trasy `app/api/tasks/*`, `app/api/calendar/events/*`. Serwisy i trasy **nie zmieniają się**.
- Dane: zadania są już zaimportowane (37 linii w `NEXUS/Vault/Tasks/tasks.md`, plik ma frontmatter `generated_by: import-to-vault`, nagłówek `# Zadania`, repo NEXUS bez zmian w momencie pisania planu). Kalendarz startuje **pusty** (decyzja 1.1 etapu 0): katalog `Calendar/` nie istnieje i powstaje przy pierwszym zapisie.
- Brak `NEXUS_VAULT_PATH` to `VaultConfigError` (HTTP 500 z czytelnym komunikatem, jak w 0c-2).

## Decyzje (rozstrzygnięte w planie)

| Id  | Decyzja                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | Linie zadań bez `id` albo z uszkodzonymi polami (`TaskLineError`) są **pomijane przy odczycie i zachowane bajtowo przy zapisie**. Inne linie pliku (nagłówki, tekst, puste) też zostają bez zmian. Duplikat `id`: obowiązuje pierwsza linia (odczyt i zapis).                                                                                                                                                                               |
| T2  | Zmieniana jest tylko jedna linia: jest ponownie formatowana przez `formatTaskLine` (normalizuje kolejność pól i ucieczki **tej linii**). Nieznane pola inline w tej linii (np. `[project:: x]` dopisane w Obsidianie) giną; reszta pliku jest nietknięta. Zapisane w dokumentacji i ryzykach. Linia, której funkcja zmiany nie zmienia (np. `order` już równe), nie jest w ogóle przepisywana.                                              |
| T3  | Pierwszy zapis aplikacji usuwa klucz `generated_by` z frontmattera `tasks.md` (spójnie z `yaml-store`; w przeciwnym razie ponowny import 0b nadpisałby plik). Gdy frontmatter zostaje pusty, cały blok `---` jest usuwany.                                                                                                                                                                                                                  |
| T4  | `reorderTasks` zmienia tylko pole `order` i tylko w liniach, w których wartość się zmienia (pozostałe nie są przepisywane; pole `updated` zostaje, żeby `git diff` vaulta był minimalny; to świadoma różnica względem Firestore). Któryś `id` nieznany → `DomainError(404)` **bez zapisu** (Firestore też odrzucał cały batch).                                                                                                             |
| T5  | `updateTask` na nieistniejącym `id` → `DomainError("Task not found", 404)`; `deleteTask` jest idempotentny (bez zapisu). Jak D4 z 0c-2.                                                                                                                                                                                                                                                                                                     |
| T6  | Nowe zadanie ma `order: 0`, `created` = `updated` = bieżący ISO, trafia na **koniec** pliku. Kolejność odczytu jak w Firestore: `order` rosnąco (brak = 999999), potem `created_at` malejąco, potem `id` (nowy deterministyczny remis).                                                                                                                                                                                                     |
| T7  | **P1 (schemat kalendarza).** Plik `Calendar/RRRR-MM.yaml`, klucz listy `events`, miesiąc wg `date` (data początku). Wydarzenie przechodzące przez północ lub granicę miesiąca to **jeden rekord w pliku miesiąca początku**. Odczyt zawsze skanuje wszystkie pliki miesięcy (patrz T8).                                                                                                                                                     |
| T8  | `getCalendarEvents` czyta wszystkie `Calendar/RRRR-MM.yaml` i filtruje tak jak dziś (`eventOverlapsInclusiveRange`, a przy samym `startDate`/`endDate` porównanie samej daty). Pliki o innych nazwach (np. `notes.yaml`, pliki tymczasowe `.*.tmp`) są ignorowane. Nowa funkcja `listVaultFiles`.                                                                                                                                           |
| T9  | Zmiana `date` na inny miesiąc: najpierw zapis rekordu w pliku nowego miesiąca, potem usunięcie ze starego (awaria w środku zostawia duplikat, nie gubi danych). Każda edycja ustawia w rekordzie `updated` (ISO), a przeniesiony rekord ma go świeższego niż stary. Odczyt deduplikuje po `id`: wygrywa rekord z późniejszym `updated` (brak = `created`), przy remisie ten z późniejszego pliku; `delete` usuwa `id` ze wszystkich plików. |
| T10 | Repozytorium kalendarza waliduje `date` (`RRRR-MM-DD`, miesiąc 01–12, dzień 01–31) i rzuca `DomainError(400)`; nazwa pliku powstaje z daty, a trasy dziś nie walidują formatu. Wielokrotność 15 minut sprawdza nadal tylko `calendarService` (bez duplikatu w repozytorium).                                                                                                                                                                |
| T11 | `updateCalendarEvent` na nieistniejącym `id` → `DomainError("Calendar event not found", 404)`; `deleteCalendarEvent` idempotentny.                                                                                                                                                                                                                                                                                                          |
| T12 | Typy: z `TaskRecord` znikają `createdAt`/`updatedAt` (`Timestamp`), z `CalendarEventRecord` znika `createdAt`. Zostają pola tekstowe `created_at`/`updated_at`. Typ `Timestamp` zostaje w pliku dla `notes`, `documents`, `mindMaps` (0c-4).                                                                                                                                                                                                |

## Mapa plików

**Nowe**

- `lib/nexus/markdown-edit.ts`: czyste funkcje na tekście `tasks.md`
- `lib/nexus/repos/tasks.ts`, `lib/nexus/repos/calendarEvents.ts`
- `tests/unit/lib/nexus/markdown-edit.test.ts`, `tests/unit/lib/nexus/repos/tasks.test.ts`, `tests/unit/lib/nexus/repos/calendarEvents.test.ts`

**Modyfikowane**

- `lib/nexus/vault-fs.ts` (+ `listVaultFiles`), `tests/unit/lib/nexus/vault-fs.test.ts`, `tests/unit/lib/nexus/static.test.ts`
- `lib/firestore-db.ts` (dwie grupy eksportów), `lib/firestore/collections.ts` (usunięte `tasksCol`, `calendarEventsCol`)
- `types/records.ts` (T12)
- `tests/unit/lib/nexus/repos-static.test.ts`
- `docs/nexus-vault-formaty-yaml.md`, `docs/superpowers/specs/2026-11-12-etap-0c-warstwa-plikowa-design.md` (status, P1)

**Usuwane**

- `lib/firestore/tasks.ts`, `lib/firestore/calendar.ts`

**Bez zmian (zweryfikowane greppem):** `services/taskService.ts`, `services/calendarService.ts`, ich testy (mockują `lib/firestore-db`), trasy `app/api/tasks/**`, `app/api/calendar/**`, UI. `lib/calendarRange.ts` jest używany przez repozytorium, nie zmieniamy go.

---

### Task 0: Gałąź i punkt wyjścia

- [ ] **Krok 1: Sprawdź, że A-1 jest w `main`**

```bash
git fetch origin main
git log origin/main --oneline -8 | cat
test ! -e services/planService.ts && echo "A-1 present"   # po checkout main
```

Oczekiwane: na `main` jest merge PR #10 (A-1). Jeśli go nie ma, **zatrzymaj się** i zgłoś użytkownikowi (gałąź 0c-3 nie powinna powstać przed A-1, bo `planService` wołałby kalendarz bezpośrednio).

- [ ] **Krok 2: Gałąź wykonawcza**

```bash
git checkout main && git pull --ff-only
git checkout -b feat/etap-0c-3-zadania-kalendarz
```

- [ ] **Krok 3: Stan vaulta (człowiek lub agent poza aplikacją).** Upewnij się, że repo NEXUS ma `Vault/Tasks/tasks.md` zacommitowane i czyste drzewo (`git -C ../NEXUS status -s` puste), żeby każdy zapis aplikacji był widoczny w `git diff` i odwracalny. Sprawdź `NEXUS_VAULT_PATH` w `.env` (wskazuje na `.../NEXUS/Vault`).

- [ ] **Krok 4: Punkt odniesienia testów** (zleć `cursor`): `npx vitest run` → zapisz liczbę testów (po A-1 było 690 w 98 plikach, plus testy 0c-2).

---

### Task 1: `listVaultFiles` w `vault-fs`

**Pliki:** Modify `lib/nexus/vault-fs.ts`, `tests/unit/lib/nexus/vault-fs.test.ts`, `tests/unit/lib/nexus/static.test.ts`

Interfejs (dopisz na końcu `vault-fs.ts`):

```ts
/**
 * Nazwy zwykłych plików (bez katalogów i dowiązań) bezpośrednio w katalogu `relDir` vaulta,
 * posortowane rosnąco. Brak katalogu daje []. Ścieżka przechodzi przez resolveInsideVault.
 */
export function listVaultFiles(relDir: string, opts?: VaultFsOptions): string[];
```

Reguły: `abs = resolveInsideVault(rootOf(opts), relDir)`; `fs.readdirSync(abs, { withFileTypes: true })`; kody `ENOENT` i `ENOTDIR` → `[]`, każdy inny błąd propaguje; wynik: `entries.filter((e) => e.isFile()).map((e) => e.name).sort()`.

- [ ] **Krok 1: Testy (czerwone)** w `vault-fs.test.ts` (użyj istniejących pomocników pliku do tymczasowego vaulta; opcja `{ root }`):
  - katalog z plikami `b.yaml`, `a.yaml`, podkatalogiem `sub/` i plikiem `sub/c.yaml` → `listVaultFiles("Dir", { root })` równa się `["a.yaml", "b.yaml"]`;
  - brak katalogu → `[]`; `relDir` wskazujące na zwykły plik → `[]`;
  - `listVaultFiles("../x", { root })` rzuca `PathOutsideVaultError`; `listVaultFiles("", { root })` też (pusta ścieżka);
  - dowiązanie symboliczne do pliku wewnątrz katalogu nie jest na liście (`isFile()` jest fałszem dla dowiązania).
- [ ] **Krok 2: Uruchom** `npx vitest run tests/unit/lib/nexus/vault-fs.test.ts` → FAIL (brak eksportu).
- [ ] **Krok 3: Implementacja** wg interfejsu powyżej.
- [ ] **Krok 4: `static.test.ts`, test 4.** Dodaj `"listVaultFiles"` do listy `["readVaultFile", "writeVaultFile", "updateVaultFile"]` (każda funkcja musi wołać `resolveInsideVault`). Test 3 (`rmSync` dokładnie raz, zakaz `unlinkSync`) nie jest naruszony, bo `readdirSync` nie mutuje.
- [ ] **Krok 5: Uruchom** `npx vitest run tests/unit/lib/nexus` → PASS.
- [ ] **Krok 6: Commit**

```bash
git add lib/nexus/vault-fs.ts tests/unit/lib/nexus
git commit -m "feat(nexus): add listVaultFiles to vault-fs" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `markdown-edit.ts` (czyste funkcje na tekście zadań)

**Pliki:** Create `lib/nexus/markdown-edit.ts`, `tests/unit/lib/nexus/markdown-edit.test.ts`

Moduł nie dotyka systemu plików. Operuje na tekście znormalizowanym przez `vault-fs` (LF). Linia zadania to taka, którą `parseTaskLine` rozpoznaje **i** która ma niepusty `id` (T1).

- [ ] **Krok 1: Testy (czerwone).** Cały plik testu:

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  appendTaskLine,
  readTasks,
  removeTaskLine,
  stripGeneratedBy,
  updateTaskLines,
} from "@/lib/nexus/markdown-edit";
import { formatTaskLine, type TaskLine } from "@/lib/nexus/task-line";

const A = "- [ ] Alfa [id:: a1] [status:: todo] [order:: 1] [created:: 2026-01-01T00:00:00.000Z]";
const B = "- [x] Beta [id:: b2] [status:: done] [order:: 0] [desc:: opis]";
const NOID = "- [ ] Bez identyfikatora [status:: todo]";
const BROKEN = "- [ ] Zepsute [id:: c3] [order:: abc]";
const HAND = "Notatka ręczna, nie zadanie.";
const TEXT = ["# Zadania", "", A, B, HAND, NOID, BROKEN, ""].join("\n");

const task = (over: Partial<TaskLine>): TaskLine => ({
  id: "n1",
  title: "Nowe",
  status: "todo",
  link: "",
  description: "",
  due_date: null,
  priority: null,
  order: 0,
  created_at: "2026-11-12T10:00:00.000Z",
  updated_at: null,
  ...over,
});

describe("readTasks", () => {
  it("returns [] for null and for text without tasks", () => {
    expect(readTasks(null)).toEqual([]);
    expect(readTasks("# Zadania\n\nnic\n")).toEqual([]);
  });
  it("skips lines without id and lines with broken fields", () => {
    expect(readTasks(TEXT).map((t) => t.id)).toEqual(["a1", "b2"]);
  });
  it("keeps only the first of duplicated ids", () => {
    const dup = [A, A.replace("Alfa", "Druga")].join("\n");
    expect(readTasks(dup).map((t) => t.title)).toEqual(["Alfa"]);
  });
});

describe("appendTaskLine", () => {
  it("creates heading and one line for a missing or blank file", () => {
    const line = formatTaskLine(task({}));
    expect(appendTaskLine(null, task({}))).toBe(`# Zadania\n\n${line}\n`);
    expect(appendTaskLine("  \n", task({}))).toBe(`# Zadania\n\n${line}\n`);
  });
  it("appends after the last line and leaves the rest byte-identical", () => {
    const line = formatTaskLine(task({}));
    expect(appendTaskLine(TEXT, task({}))).toBe(`${TEXT}${line}\n`);
  });
  it("adds a missing trailing newline and collapses extra trailing newlines", () => {
    const line = formatTaskLine(task({}));
    expect(appendTaskLine(A, task({}))).toBe(`${A}\n${line}\n`);
    expect(appendTaskLine(`${A}\n\n\n`, task({}))).toBe(`${A}\n${line}\n`);
  });
});

describe("updateTaskLines", () => {
  it("rewrites only the matching line", () => {
    const { text, missing } = updateTaskLines(TEXT, ["a1"], (t) => ({ ...t, status: "done" }));
    expect(missing).toEqual([]);
    expect(text).toBe(TEXT.replace(A, formatTaskLine({ ...readTasks(A)[0], status: "done" })));
    expect(text).toContain("- [x] Alfa [id:: a1] [status:: done]");
  });
  it("reports unknown ids and leaves the text unchanged", () => {
    const { text, missing } = updateTaskLines(TEXT, ["zz"], (t) => t);
    expect(missing).toEqual(["zz"]);
    expect(text).toBe(TEXT);
  });
  it("returns the original text when any id is missing", () => {
    const res = updateTaskLines(TEXT, ["a1", "zz"], (t) => ({ ...t, status: "done" }));
    expect(res).toEqual({ text: TEXT, missing: ["zz"] });
  });
  it("keeps a line byte-identical when apply returns the same task", () => {
    const hand = "- [ ] Ręczna [id:: h1] [status:: todo] [project:: x]";
    const src = `${hand}\n${A}\n`;
    const { text } = updateTaskLines(src, ["h1", "a1"], (t) =>
      t.id === "a1" ? { ...t, order: 9 } : t
    );
    expect(text.split("\n")[0]).toBe(hand);
    expect(text).toContain("[id:: a1] [status:: todo] [order:: 9]");
  });
  it("applies different results to several ids in one pass", () => {
    const order = new Map([
      ["b2", 5],
      ["a1", 6],
    ]);
    const { text } = updateTaskLines(TEXT, ["b2", "a1"], (t) => ({
      ...t,
      order: order.get(t.id)!,
    }));
    expect(text).toContain("[id:: b2] [status:: done] [order:: 5]");
    expect(text).toContain("[id:: a1] [status:: todo] [order:: 6]");
    expect(text).toContain(HAND);
    expect(text).toContain(NOID);
    expect(text).toContain(BROKEN);
  });
  it("does not touch a line without id even when ids is empty", () => {
    expect(updateTaskLines(TEXT, [], (t) => t)).toEqual({ text: TEXT, missing: [] });
  });
});

describe("removeTaskLine", () => {
  it("removes only the matching line", () => {
    expect(removeTaskLine(TEXT, "a1")).toBe(TEXT.replace(`${A}\n`, ""));
  });
  it("returns null for an unknown id", () => {
    expect(removeTaskLine(TEXT, "zz")).toBeNull();
  });
});

describe("stripGeneratedBy", () => {
  it("drops the whole block when generated_by was the only key", () => {
    const src = "---\ngenerated_by: import-to-vault\n---\n\n# Zadania\n\n" + A + "\n";
    expect(stripGeneratedBy(src)).toBe("# Zadania\n\n" + A + "\n");
  });
  it("keeps other frontmatter keys", () => {
    const src = "---\ngenerated_by: import-to-vault\ntags: x\n---\n\n# Zadania\n";
    expect(stripGeneratedBy(src)).toBe("---\ntags: x\n---\n\n# Zadania\n");
  });
  it("returns the text unchanged without frontmatter or without the key", () => {
    expect(stripGeneratedBy(TEXT)).toBe(TEXT);
    const other = "---\ntags: x\n---\n\n# Zadania\n";
    expect(stripGeneratedBy(other)).toBe(other);
  });
});
```

- [ ] **Krok 2: Uruchom** `npx vitest run tests/unit/lib/nexus/markdown-edit.test.ts` → FAIL (brak modułu).

- [ ] **Krok 3: Implementacja** (cały plik; napisany bez uruchamiania, popraw tylko jeśli test wskaże błąd):

```ts
import { formatTaskLine, parseTaskLine, type TaskLine } from "./task-line";

/** Tekst z `vault-fs` jest już znormalizowany do LF. */
const FRONTMATTER = /^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/;

type Entry = { index: number; task: TaskLine };

/** Linie zadań z niepustym `id`; uszkodzone linie i duplikaty `id` (poza pierwszym) są pomijane. */
function scan(lines: string[]): Entry[] {
  const seen = new Set<string>();
  const out: Entry[] = [];
  lines.forEach((line, index) => {
    let task: TaskLine | null;
    try {
      task = parseTaskLine(line);
    } catch {
      return;
    }
    if (task === null || task.id === "" || seen.has(task.id)) return;
    seen.add(task.id);
    out.push({ index, task });
  });
  return out;
}

export function readTasks(text: string | null): TaskLine[] {
  if (text === null) return [];
  return scan(text.split("\n")).map((entry) => entry.task);
}

/** Dopisuje linię na końcu; brak pliku lub sam biały tekst daje nagłówek `# Zadania` i jedną linię. */
export function appendTaskLine(text: string | null, task: TaskLine): string {
  const line = formatTaskLine(task);
  if (text === null || text.trim() === "") return `# Zadania\n\n${line}\n`;
  return `${text.replace(/\n*$/, "\n")}${line}\n`;
}

/**
 * Przepisuje (przez `formatTaskLine`) tylko linie o podanych `id`, dla których `apply` zwraca inny
 * obiekt niż dostał (ta sama referencja = linia zostaje bajtowo); reszta tekstu zostaje bajtowo.
 * `missing` to `id`, których nie znaleziono; gdy jest niepuste, zwracany tekst jest nietknięty.
 */
export function updateTaskLines(
  text: string,
  ids: readonly string[],
  apply: (task: TaskLine) => TaskLine
): { text: string; missing: string[] } {
  const lines = text.split("\n");
  const entries = scan(lines);
  const missing: string[] = [];
  for (const id of ids) {
    const entry = entries.find((e) => e.task.id === id);
    if (!entry) {
      missing.push(id);
      continue;
    }
    const next = apply(entry.task);
    if (next !== entry.task) lines[entry.index] = formatTaskLine(next);
  }
  if (missing.length > 0) return { text, missing };
  return { text: lines.join("\n"), missing };
}

/** Usuwa linię o danym `id`; `null`, gdy jej nie ma. */
export function removeTaskLine(text: string, id: string): string | null {
  const lines = text.split("\n");
  const entry = scan(lines).find((e) => e.task.id === id);
  if (!entry) return null;
  lines.splice(entry.index, 1);
  return lines.join("\n");
}

/** Usuwa klucz `generated_by` z frontmattera (T3); pusty frontmatter znika razem z blokiem `---`. */
export function stripGeneratedBy(text: string): string {
  const match = FRONTMATTER.exec(text);
  if (!match) return text;
  const all = match[1].split("\n");
  const kept = all.filter((line) => !/^generated_by\s*:/.test(line));
  if (kept.length === all.length) return text;
  const rest = text.slice(match[0].length);
  if (kept.every((line) => line.trim() === "")) return rest.replace(/^\n+/, "");
  return `---\n${kept.join("\n")}\n---\n${rest}`;
}
```

- [ ] **Krok 4: Uruchom** `npx vitest run tests/unit/lib/nexus/markdown-edit.test.ts` → PASS.
- [ ] **Krok 5: Commit**

```bash
git add lib/nexus/markdown-edit.ts tests/unit/lib/nexus/markdown-edit.test.ts
git commit -m "feat(nexus): add markdown-edit for single task line edits" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Repozytorium zadań

**Pliki:** Create `lib/nexus/repos/tasks.ts`, `tests/unit/lib/nexus/repos/tasks.test.ts`

Plik: `Tasks/tasks.md` (stała `FILE`). Eksporty o **dokładnie tych sygnaturach** co dziś w `lib/firestore/tasks.ts` (parametr `userId` pozostaje, nieużywany jako `_userId`):

```ts
export async function getTasks(_userId: string): Promise<TaskRecord[]>;
export async function createTask(
  _userId: string,
  data: {
    title: string;
    link?: string;
    description?: string;
    status?: TaskRecord["status"];
    due_date?: string | null;
    priority?: number | null;
  }
): Promise<TaskRecord>;
export async function updateTask(
  _userId: string,
  taskId: string,
  data: Partial<{
    title: string;
    link: string;
    description: string;
    status: TaskRecord["status"];
    due_date: string | null;
    priority: number | null;
    order: number;
  }>
): Promise<void>;
export async function reorderTasks(_userId: string, taskIds: string[]): Promise<void>;
export async function deleteTask(_userId: string, taskId: string): Promise<void>;
```

Reguły implementacji:

- Pomocnik prywatny `edit(fn: (current: string | null) => string | null): Promise<void>`: woła `updateVaultFile(FILE, (current) => { const next = fn(current); if (next === null) throw new NoChange(); return stripGeneratedBy(next); })` i łapie wartownika: lokalna klasa `class NoChange extends Error {}` zdefiniowana w `tasks.ts` (ta z `yaml-store.ts` jest prywatna), wszystkie inne błędy propaguje. Import `updateVaultFile`, `readVaultFile` z `../vault-fs`.
- `getTasks`: `readTasks(readVaultFile(FILE)?.text ?? null)` → mapowanie `TaskLine` → `TaskRecord` (`order: t.order ?? undefined`, `created_at: t.created_at ?? undefined`, `updated_at: t.updated_at ?? undefined`, reszta 1:1), sortowanie wg T6. Bez `Timestamp`.
- `createTask`: w `edit` zbuduj `TaskLine` (`id: generateId(new Set(readTasks(current).map((t) => t.id)))`, `title: data.title ?? ""`, `status: data.status ?? "todo"`, `link/description: ?? ""`, `due_date/priority: ?? null`, `order: 0`, `created_at = updated_at = nowIso()`), zwróć `appendTaskLine(current, line)`; zwracany rekord pochodzi z linii zbudowanej **w ostatnim wykonaniu** `fn` (zmienna przypisywana wewnątrz, jak w `appendRecord`).
- `updateTask`: patch tylko z kluczy `!== undefined`; `edit` → `updateTaskLines(current ?? "", [taskId], (t) => ({ ...t, ...patch, updated_at: nowIso() }))`; `missing.length > 0` → `throw new DomainError("Task not found", 404)`. Pole `order: number` z patcha trafia do `TaskLine.order`.
- `reorderTasks`: puste `taskIds` → `return` bez dotykania pliku; w `edit` mapa `id → indeks` (przy powtórzonym `id` wygrywa ostatni), `updateTaskLines(current ?? "", taskIds, (t) => { const order = index.get(t.id)!; return t.order === order ? t : { ...t, order }; })` (bez zmiany `updated_at`, T4; linie z niezmienionym `order` nie są przepisywane); `missing.length > 0` → `DomainError("Task not found: <id,id>", 404)`.
- `deleteTask`: `removeTaskLine(current ?? "", taskId)` (`null` → brak zapisu).
- `lib/nexus/repos/tasks.ts` nie importuje `fs`, `firebase`, `process.env`.

Przypadki testowe (tymczasowy vault przez `useTempVault()` z `repos/helpers.ts`; seed zapisany przez `vault.write("Tasks/tasks.md", SEED)`):

```
SEED =
---\ngenerated_by: import-to-vault\n---\n\n# Zadania\n\n
- [ ] Kurs Playwright [id:: t1] [status:: todo] [due:: 2026-08-06] [order:: 1] [created:: 2026-02-26T16:58:41.794Z] [updated:: 2026-11-11T22:19:18.163Z]\n
- [x] Review PR [id:: t2] [status:: done] [order:: 0] [desc:: https://example.com/pr] [created:: 2026-08-03T19:45:42.870Z]\n
\nNotatka ręczna poza listą.\n
- [ ] Linia bez id [status:: todo]\n
```

- [ ] **Krok 1: Testy (czerwone)** — lista przypadków z oczekiwanymi wartościami:
  1. `getTasks` bez pliku → `[]`.
  2. `getTasks` na SEED → dokładnie `[t2, t1]`; `t2` równa się `{ id: "t2", title: "Review PR", link: "", description: "https://example.com/pr", status: "done", due_date: null, priority: null, order: 0, created_at: "2026-08-03T19:45:42.870Z", updated_at: undefined }`; linia bez `id` nie jest zwrócona.
  3. Sortowanie: trzy zadania `order` brak/brak/2 z różnymi `created` → kolejność `order` 2, potem brak `order` malejąco po `created`, remis `created` po `id`.
  4. `createTask` bez pliku → plik to `# Zadania\n\n- [ ] Nowe [id:: <20 znaków [A-Za-z0-9]>] [status:: todo] [order:: 0] [created:: <ISO>] [updated:: <ten sam ISO>]\n`; zwrócony rekord: `status: "todo"`, `link: ""`, `description: ""`, `due_date: null`, `priority: null`, `order: 0`, `created_at === updated_at`.
  5. `createTask` na SEED → plik nie zawiera `generated_by` i zaczyna się od `# Zadania`; dwie dotychczasowe linie zadań, notatka ręczna i linia bez `id` są w pliku bajtowo takie same; nowa linia jest ostatnia.
  6. Round-trip znaków specjalnych: tytuł `Ala [x] \ i "cudzysłów" #tag`, opis `a\nb [c]` → `getTasks` zwraca identyczne wartości.
  7. `updateTask("t1", { status: "done" })` → w pliku linia `t1` zaczyna się od `- [x] Kurs Playwright`, ma `[status:: done]`, to samo `[due:: 2026-08-06]`, nowe `[updated:: …]` większe od poprzedniego; linia `t2`, notatka i linia bez `id` bajtowo bez zmian; `generated_by` zniknął.
  8. `updateTask("t1", { due_date: null })` usuwa `[due::` z linii; `updateTask("t1", { priority: 3, order: 7 })` dodaje `[priority:: 3]` i ustawia `[order:: 7]`; pola nieprzekazane zostają.
  9. `updateTask("nie-ma", { title: "x" })` odrzuca `DomainError` ze `statusCode === 404`; plik bajtowo identyczny z SEED (w tym `generated_by`).
  10. `reorderTasks(["t1", "t2"])` → `t1` ma `[order:: 0]`, `t2` ma `[order:: 1]`; pola `[updated::` w obu liniach **bez zmian**; notatka i linia bez `id` bez zmian. `reorderTasks(["t2", "t1"])` (kolejność już zgodna) zostawia obie linie bajtowo (poza usunięciem `generated_by`). `reorderTasks([])` nie zmienia pliku (bajtowo SEED). `reorderTasks(["t1", "nie-ma"])` → 404, plik bajtowo SEED.
  11. `deleteTask("t2")` usuwa tylko tę linię; `deleteTask("nie-ma")` → plik bajtowo SEED (brak zapisu, `generated_by` zostaje).
  12. Zmiana zewnętrzna: po seedzie dopisz `vault.write` linię `- [ ] Z Obsidiana [id:: ext1] [status:: todo]` na końcu, potem `updateTask("t1", …)` → linia `ext1` przeżywa.
  13. Równoległość: `await Promise.all([updateTask(u,"t1",{title:"A"}), updateTask(u,"t2",{title:"B"})])` → oba tytuły zapisane.
  14. Plik z uszkodzoną linią (`- [ ] Zepsute [id:: c3] [order:: abc]`) nie psuje odczytu pozostałych i nie jest zmieniany przy zapisie innej linii.
  15. Bez `NEXUS_VAULT_PATH` `getTasks` rzuca `VaultConfigError` (usuń zmienną w teście jak w `yaml-store.test.ts`).
- [ ] **Krok 2: Uruchom** `npx vitest run tests/unit/lib/nexus/repos/tasks.test.ts` → FAIL (brak modułu).
- [ ] **Krok 3: Implementacja** wg reguł powyżej.
- [ ] **Krok 4: Uruchom** ten test → PASS, potem `npx vitest run tests/unit/lib/nexus` → PASS.
- [ ] **Krok 5: Commit**

```bash
git add lib/nexus/repos/tasks.ts tests/unit/lib/nexus/repos/tasks.test.ts
git commit -m "feat(nexus): add task repository backed by Tasks/tasks.md" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Repozytorium wydarzeń kalendarza

**Pliki:** Create `lib/nexus/repos/calendarEvents.ts`, `tests/unit/lib/nexus/repos/calendarEvents.test.ts`

Pliki `Calendar/RRRR-MM.yaml`, klucz listy `events` (T7). Format rekordu (kolejność kluczy przy tworzeniu):

```yaml
version: 1
events:
  - id: aB3dE5fG7hJ9kL1mN2pQ
    date: "2026-11-30" # tekst; cudzysłów dodaje formatYamlList (YAML 1.1)
    start_minutes: 1380
    duration_minutes: 120
    title: Nocna sesja
    tags: [praca]
    color: "#3B82F6"
    type: work # work | meeting
    created: 2026-11-12T10:00:00.000Z
    updated: 2026-11-12T11:00:00.000Z # opcjonalne, ustawiane przy edycji
```

Mapowanie plik → `CalendarEventRecord` (jak w `lib/firestore/calendar.ts`): `date: str(r.date)`, `start_minutes: Number(r.start_minutes) || 0`, `duration_minutes: Number(r.duration_minutes) || 0`, `title: str(r.title)`, `tags: Array.isArray(r.tags) ? r.tags.map(String) : r.tags ? [String(r.tags)] : []`, `color: optStr(r.color) ?? "#3B82F6"`, `type: r.type === "meeting" ? "meeting" : "work"`, `created_at: optStr(r.created)`. Pomocniki `str`, `optStr`, `generateId`, `nowIso`, `appendRecord`, `patchRecord`, `removeRecord` z `./common`.

Eksporty (sygnatury jak dziś w `lib/firestore/calendar.ts`, `userId` jako `_userId`):

```ts
export async function getCalendarEvents(
  _userId: string,
  options?: { startDate?: string; endDate?: string }
): Promise<CalendarEventRecord[]>;
export async function createCalendarEvent(
  _userId: string,
  data: {
    date: string;
    start_minutes: number;
    duration_minutes: number;
    title: string;
    tags: string[];
    color: string;
    type?: "work" | "meeting";
  }
): Promise<CalendarEventRecord>;
export async function updateCalendarEvent(
  _userId: string,
  eventId: string,
  data: Partial<{
    date: string;
    start_minutes: number;
    duration_minutes: number;
    title: string;
    tags: string[];
    color: string;
    type: "work" | "meeting";
  }>
): Promise<void>;
export async function deleteCalendarEvent(_userId: string, eventId: string): Promise<void>;
```

Reguły:

- `monthFile(date)`: wyrażenie `^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$`; niezgodne → `DomainError("date must be YYYY-MM-DD", 400)`; wynik `Calendar/${date.slice(0, 7)}.yaml`.
- `monthFiles()`: `listVaultFiles("Calendar")` przefiltrowane `^\d{4}-(0[1-9]|1[0-2])\.yaml$` → `Calendar/<nazwa>`.
- `readAll()`: dla każdego pliku miesiąca `readList(file, "events")` → pary `{ file, record }`; uszkodzony plik przerywa odczyt błędem z nazwą pliku (jak `yaml-store`). Deduplikacja po `id` wg T9: wygrywa rekord z późniejszym `updated` (brak = `created`), przy remisie z późniejszego pliku.
- `getCalendarEvents`: filtr dokładnie jak dziś: oba końce → `eventOverlapsInclusiveRange(e, startDate, endDate)` z `@/lib/calendarRange`; sam `startDate` → `e.date >= startDate`; sam `endDate` → `e.date <= endDate`; sortowanie `date`, potem `start_minutes`, potem `id`.
- `createCalendarEvent`: `appendRecord(monthFile(data.date), "events", (taken) => ({ id: generateId(taken), date: data.date, start_minutes, duration_minutes, title, tags: data.tags ?? [], color: data.color ?? "#3B82F6", type: data.type === "meeting" ? "meeting" : "work", created: nowIso() }))`; zwraca zmapowany rekord. Brak sprawdzania wielokrotności 15 (T10).
- `updateCalendarEvent`: patch z kluczy `!== undefined` (`type` normalizowany do `work`/`meeting`); pusty patch → return bez dotykania plików; do patcha dopisz `updated: nowIso()`. Znajdź rekord w `readAll()`; brak → `DomainError("Calendar event not found", 404)`. Jeśli `patch.date` jest `undefined` albo `monthFile(patch.date)` jest tym samym plikiem co plik rekordu → `patchRecord(file, "events", id, patch, "Calendar event not found")`. W przeciwnym razie przeniesienie (T9): `appendRecord(newFile, "events", () => ({ ...existingRecord, ...patch }))`, potem `removeRecord(oldFile, "events", id)`; `existingRecord` to surowy rekord z pliku (nieznane klucze przeżywają).
- `deleteCalendarEvent`: dla każdego pliku miesiąca zawierającego `id` → `removeRecord(file, "events", id)`; brak → bez zapisu.
- Moduł importuje `listVaultFiles` z `../vault-fs` (tylko odczyt katalogu); zapisy wyłącznie przez `yaml-store`/`common`.

Seed testowy (`formatYamlList("events", …)`):

```
Calendar/2026-11.yaml: e1 { date "2026-11-30", start_minutes 1380, duration_minutes 120, title "Nocna sesja", tags ["praca"], color "#111111", type "work", created "2026-11-01T08:00:00.000Z", x_note "ręcznie" }
                       e2 { date "2026-11-02", start_minutes 540,  duration_minutes 60,  title "Spotkanie",   tags ["a"],     color "#222222", type "meeting", created "2026-11-01T09:00:00.000Z" }
Calendar/2026-12.yaml: e3 { date "2026-12-01", start_minutes 600,  duration_minutes 30,  title "Rano",        tags [],         color "#333333", type "work", created "2026-11-01T10:00:00.000Z" }
```

- [ ] **Krok 1: Testy (czerwone)** — przypadki z oczekiwanymi wartościami:
  1. Brak katalogu `Calendar/` → `getCalendarEvents` zwraca `[]`.
  2. Seed, bez zakresu → kolejność `e2, e1, e3`; `e1` ma `tags: ["praca"]`, `type: "work"`, `created_at: "2026-11-01T08:00:00.000Z"`.
  3. Zakres `{ startDate: "2026-12-01", endDate: "2026-12-01" }` → `e1` (kończy się 01:00 dnia 1 grudnia) i `e3`; bez `e2`.
  4. Tylko `startDate: "2026-12-01"` → `[e3]` (porównanie samej daty, jak dziś). Tylko `endDate: "2026-11-02"` → `[e2]`.
  5. Pliki `Calendar/notes.yaml` i `Calendar/.2026-11.yaml.1.abc.tmp` są ignorowane (nie psują odczytu, nie wpływają na wynik).
  6. `createCalendarEvent` (`date: "2026-11-05"`, `start_minutes: 600`, `duration_minutes: 60`, `title: "T"`, `tags: ["x"]`, `color: "#abcdef"`) bez pliku → powstaje `Calendar/2026-11.yaml` z `version: 1` i jednym rekordem; zwrócony rekord ma `type: "work"` (domyślnie), `id` zgodne z `^[A-Za-z0-9]{20}$`, `created_at` w ISO; `type: "meeting"` zachowane; na seedzie rekord dopisany bez zmiany pozostałych (w tym `x_note` w `e1`).
  7. `createCalendarEvent` z `date` `"2026-13-01"`, `"11/02/2026"`, `"2026-11-5"` → `DomainError` ze `statusCode === 400`; żaden plik nie powstaje.
  8. `updateCalendarEvent("e2", { title: "Zmiana" })` zmienia tylko `title`; `date`, `start_minutes`, `created` bez zmian; `x_note` w `e1` nietknięte.
  9. `updateCalendarEvent("e2", { date: "2026-12-05" })` → w `2026-11.yaml` nie ma `e2`, w `2026-12.yaml` jest `e2` z tym samym `id`, `created` i `date: "2026-12-05"` oraz nowym `updated` (ISO); `getCalendarEvents()` zwraca go dokładnie raz.
  10. `updateCalendarEvent("e1", { date: "2026-11-29" })` (ten sam miesiąc) → rekord zostaje w `2026-11.yaml`, bez zmiany kolejności pozostałych.
  11. `updateCalendarEvent("nie-ma", { title: "x" })` → `DomainError` 404, pliki bajtowo bez zmian. `updateCalendarEvent("e2", {})` → pliki bajtowo bez zmian.
  12. Duplikat `id` w dwóch plikach miesięcy (ten sam `e2` w obu) → odczyt zwraca jeden rekord: ten z późniejszym `updated` (także gdy leży we wcześniejszym pliku), a bez `updated` w obu — z późniejszego pliku; `deleteCalendarEvent("e2")` usuwa go z obu plików.
  13. `deleteCalendarEvent("e1")` usuwa tylko `e1`; `deleteCalendarEvent("nie-ma")` → pliki bajtowo bez zmian.
  14. Pięć równoległych `createCalendarEvent` w tym samym miesiącu (`Promise.all`) → pięć rekordów w pliku.
  15. Uszkodzony `Calendar/2026-11.yaml` (`events: [unclosed`) → `getCalendarEvents` odrzuca błędem zawierającym `Calendar/2026-11.yaml`; plik bajtowo bez zmian; `createCalendarEvent` na tym miesiącu też odrzuca i nie nadpisuje pliku.
- [ ] **Krok 2: Uruchom** `npx vitest run tests/unit/lib/nexus/repos/calendarEvents.test.ts` → FAIL (brak modułu).
- [ ] **Krok 3: Implementacja** wg reguł powyżej.
- [ ] **Krok 4: Uruchom** ten test → PASS, potem `npx vitest run tests/unit/lib/nexus` → PASS.
- [ ] **Krok 5: Commit**

```bash
git add lib/nexus/repos/calendarEvents.ts tests/unit/lib/nexus/repos/calendarEvents.test.ts
git commit -m "feat(nexus): add calendar event repository backed by Calendar/YYYY-MM.yaml" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Typy, barrel, usunięcie Firestore dla tasks i calendar

**Pliki:** Modify `types/records.ts`, `lib/firestore-db.ts`, `lib/firestore/collections.ts`, `tests/unit/lib/nexus/repos-static.test.ts`; Delete `lib/firestore/tasks.ts`, `lib/firestore/calendar.ts`

- [ ] **Krok 1: Test statyczny najpierw (czerwony).** W `tests/unit/lib/nexus/repos-static.test.ts`:
  - `FILES` dopisz: `lib/nexus/markdown-edit.ts`, `lib/nexus/repos/tasks.ts`, `lib/nexus/repos/calendarEvents.ts` (reguły „bez firebase, bez bezpośredniego `fs`, bez `process.env`, bez operacji mutujących pliki" obejmują je automatycznie).
  - Stała `REPOS` (używana w teście „repozytoria nie importują `vault-fs`") zostaje tylko dla `common`, `tags`, `taskTemplates`, `resources`. Dodaj test: `markdown-edit.ts` nie importuje `vault-fs` (czysty tekst), a `vault-fs` importują wyłącznie `yaml-store.ts`, `repos/tasks.ts` i `repos/calendarEvents.ts` (sprawdź `grep`-em po `lib/nexus/**/*.ts`: trafienia `from "…/vault-fs"` tylko w tych trzech plikach i w testach).
  - Test „stare repozytoria i helpery zniknęły": dopisz `tasks` i `calendar` do pętli sprawdzającej brak `lib/firestore/<nazwa>.ts`, a `collections.ts` nie może zawierać `tasksCol|calendarEventsCol`.
  - Test barrela: `lib/firestore-db.ts` zawiera `@/lib/nexus/repos/tasks` i `@/lib/nexus/repos/calendarEvents` i nie zawiera `lib/firestore/(tasks|calendar)`.
  - Uruchom `npx vitest run tests/unit/lib/nexus/repos-static.test.ts` → FAIL (stare pliki i barrel).
- [ ] **Krok 2: Typy (`types/records.ts`).** `TaskRecord`: usuń `createdAt?: Timestamp;` i `updatedAt?: Timestamp;`. `CalendarEventRecord`: usuń `createdAt?: Timestamp;`. `CalendarEvent`: zmień `Omit<CalendarEventRecord, "type" | "createdAt">` na `Omit<CalendarEventRecord, "type">`. Zaktualizuj komentarze nad typami (usuń wzmianki o zapisach Firestore). Import `Timestamp` zostaje (używają go `notes`, `documents`, `mindMaps`).
- [ ] **Krok 3: Barrel (`lib/firestore-db.ts`).** Zastąp blok eksportów z `@/lib/firestore/calendar` blokiem z `@/lib/nexus/repos/calendarEvents` (te same cztery nazwy), a linię `export { getTasks, createTask, updateTask, reorderTasks, deleteTask } from "@/lib/firestore/tasks";` linią z `@/lib/nexus/repos/tasks`.
- [ ] **Krok 4: Usuń pliki i helpery**

```bash
git rm lib/firestore/tasks.ts lib/firestore/calendar.ts
```

W `lib/firestore/collections.ts` usuń funkcje `calendarEventsCol` i `tasksCol` (wraz z pustą linią przed każdą). Nie ruszaj pozostałych helperów.

- [ ] **Krok 5: Sprawdź, że nic nie zostało**

Run: `grep -rn "firestore/tasks\|firestore/calendar\|tasksCol\|calendarEventsCol" --include=*.ts --include=*.tsx app src services lib tests scripts`
Oczekiwane: brak trafień.

- [ ] **Krok 6: Uruchom** `npx vitest run tests/unit/lib/nexus tests/unit/services/taskService.test.ts tests/unit/services/calendarService.test.ts` → PASS.
- [ ] **Krok 7: Weryfikacja** (zleć `cursor`): `npx tsc --noEmit` i `npx vitest run`. Oczekiwane: tsc bez błędów (jeśli zgłosi stary cache `.next/types`, usuń odpowiedni fragment `.next/types`, jak w A-1), wszystkie testy zielone. Błędy dotyczące `createdAt` na zadaniach/wydarzeniach naprawiasz w miejscu użycia, nie przywracając pól.
- [ ] **Krok 8: Commit**

```bash
git add -A types lib tests
git commit -m "refactor: move tasks and calendar events to vault files, drop Firestore repos" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Dokumentacja formatu i specu

**Pliki:** Modify `docs/nexus-vault-formaty-yaml.md`, `docs/superpowers/specs/2026-11-12-etap-0c-warstwa-plikowa-design.md`

- [ ] **Krok 1: `docs/nexus-vault-formaty-yaml.md`.** Zmień nagłówek na `# Format plików w vaulcie (tagi, szablony, zasoby, zadania, kalendarz)` i pierwsze zdanie na „Aplikacja czyta i zapisuje pliki w `NEXUS/Vault/` …". Dopisz na końcu pliku dwie sekcje:

```markdown
## Zadania: `Tasks/tasks.md`

Frontmatter (po pierwszym zapisie aplikacji bez `generated_by`), nagłówek `# Zadania`, potem jedna linia na zadanie:

`- [ ] Tytuł [id:: …] [status:: todo] [due:: RRRR-MM-DD] [priority:: n] [order:: n] [link:: …] [desc:: …] [created:: ISO] [updated:: ISO]`

- Pola `due`, `priority`, `link`, `desc` są pomijane, gdy puste. `status`: `todo`, `in_progress`, `to_review`, `done`; pole wyboru `[x]` oznacza `done`.
- W tytule i wartościach pól ucieczki: `\[`, `\]`, `\\`, `\n`. Parser: `lib/nexus/task-line.ts`, edycja: `lib/nexus/markdown-edit.ts`.
- Aplikacja zmienia **tylko** linię zadania, którego dotyczy żądanie; reszta pliku (nagłówki, notatki, inne linie) zostaje bajtowo. Dodane zadanie trafia na koniec pliku.
- Linie bez `id` lub z uszkodzonymi polami nie pojawiają się w aplikacji i nie są zmieniane. Przy duplikacie `id` obowiązuje pierwsza linia.
- Edytowana linia jest formatowana od nowa: **nieznane pola inline w tej linii giną** (np. `[project:: x]`). Dodatkowe informacje wpisuj w `desc`.
- Przeciąganie zadań (`reorder`) zmienia tylko `order` i tylko w liniach, w których wartość się zmienia; edycja zmienia `updated`.

## Kalendarz: `Calendar/RRRR-MM.yaml`

Jeden plik na miesiąc **daty początku** wydarzenia. Klucz listy `events`, pola rekordu: `id`, `date` (`RRRR-MM-DD`), `start_minutes`, `duration_minutes` (wielokrotność 15), `title`, `tags` (lista), `color`, `type` (`work` lub `meeting`), `created`, `updated` (opcjonalne, ustawiane przy edycji).

- Wydarzenie przechodzące przez północ lub granicę miesiąca jest jednym rekordem w pliku miesiąca początku. Aplikacja czyta wszystkie pliki miesięcy; pliki o innych nazwach są ignorowane.
- Zmiana `date` na inny miesiąc przenosi rekord do pliku tego miesiąca.
- Zasady zapisu jak w pozostałych plikach YAML (nieznane klucze rekordu przeżywają, komentarze giną, uszkodzony plik nie jest nadpisywany).
- Terminy zadań (`due`) nie są zapisywane w kalendarzu: aplikacja dolicza je w locie.
```

- [ ] **Krok 2: Nadrzędny spec 0c.** W linii `Status:` zapisz, że 0c-3 jest zaimplementowany (plan: `docs/superpowers/plans/2026-11-12-etap-0c-3-zadania-kalendarz.md`; ręczny przegląd UI i PR czekają). W §5 w wierszu 0c-3 dopisz w „Uwagi": „`planService` został usunięty w A-1, więc punkt o jego przepięciu jest bezprzedmiotowy". W §8 oznacz **P1** jako rozstrzygnięte: „schemat opisany w planie 0c-3 (T7–T9): jeden rekord w pliku miesiąca początku, odczyt skanuje wszystkie pliki".
- [ ] **Krok 3: Prettier** `npx prettier --check docs/nexus-vault-formaty-yaml.md docs/superpowers` (popraw przez `--write`).
- [ ] **Krok 4: Commit**

```bash
git add docs
git commit -m "docs: document tasks.md and Calendar yaml formats, mark 0c-3 implemented" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Weryfikacja, review, ręczny przegląd, PR

- [ ] **Krok 1: Pełna weryfikacja** (zleć `cursor`, prośba „przeszło" albo `plik:linia + przyczyna`): `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npm run build`. Jeśli `cursor` nie ma zgody na `npx`/`npm`, uruchom sam i przekaż użytkownikowi, co przeszło. Oczekiwane: wszystko przechodzi; liczba testów = punkt odniesienia z Tasku 0 + nowe.
- [ ] **Krok 2: Review diffa przez `agy`** (wymagane przez nadrzędny spec po 0c-3): `scripts/ask-helper.sh --role review agy "…"` z prośbą o: błędy w `markdown-edit.ts` i `repos/tasks.ts` (utrata danych w `tasks.md`, linie zachowane bajtowo, ucieczki), `repos/calendarEvents.ts` (przenoszenie między miesiącami, deduplikacja, wydarzenia przez granicę miesiąca, walidacja daty), wyścigi i konflikty (`updateVaultFile`), pozostałości po Firestore. Opinie traktuj jak hipotezy i weryfikuj w kodzie.
- [ ] **Krok 3: Ręczny przegląd UI** (`npm run dev`, port 3100; zapisy trafiają do **prawdziwego** vaulta NEXUS, więc po przeglądzie obejrzyj `git -C ../NEXUS diff --stat` i wycofaj zmiany testowe; wycofanie i usunięcie plików robi człowiek):
  - Zadania: lista pokazuje 37 zadań z vaulta w tej samej kolejności co wcześniej; dodaj zadanie (pojawia się na końcu pliku, `order: 0`), zmień status, termin i notatkę (`desc`), przeciągnij kolejność, usuń; odśwież stronę.
  - `git -C ../NEXUS diff Vault/Tasks/tasks.md`: zmieniają się tylko linie dotkniętych zadań, `generated_by` znika po pierwszym zapisie, reszta pliku bez zmian.
  - Kalendarz: dodaj wydarzenie, przenieś je do innego miesiąca (powstaje `Calendar/RRRR-MM.yaml`), wydarzenie przez północ i przez granicę miesiąca widoczne w obu widokach, usuń; terminy zadań (`due`) widać jako szare wpisy 23:30; zakończenie sesji pracy tworzy wydarzenie.
  - `curl` na trasy tasks/calendar bez zalogowania zwraca 401 (bez zmian względem wcześniej).
- [ ] **Krok 4: Vercel.** Potwierdź, że auto-deploy z Git jest wyłączony (warunek z 0c-2: zapisy plikowe nie działają na Vercelu).
- [ ] **Krok 5: PR** do `main` zwykłym merge commitem (jak PR #9). Opis: tasks i calendar_events na plikach, decyzje T1–T12 w skrócie, że kalendarz startuje pusty, że `planService` nie wymagał zmian (usunięty w A-1), że dane w Firestore nie są ruszane do 0e. Po merge'u następny jest 0c-4.

---

## Samoocena planu względem specu

- **Spec 0c §3.3 i §5 (tasks, calendar_events):** Taski 2–5. **Reguły zapisu §3.2** (zapis atomowy, kontrola konfliktu, C5, `reorderTasks` tylko `order`): `updateVaultFile` + T4, testy 10 i 12–14 w Tasku 3. **Reguła nakładania C5** realizuje `updateVaultFile` (ponowny odczyt i ponowne zastosowanie zmiany do świeżej linii, `ConflictError` po wyczerpaniu ponowień), tak jak w 0c-2; osobne porównanie bajtów linii nie jest potrzebne, bo UI nie przekazuje wersji.
- **P1 (schemat `Calendar/RRRR-MM.yaml`):** T7–T9, Task 4, dokumentacja w Tasku 6.
- **§4 testy:** repozytoria na tymczasowym vaulcie (Taski 3–4), zgodność z 0b (SEED w formacie 0b), konflikty/równoległość, testy statyczne (Task 5), ręczny przegląd (Task 7), testy usług bez zmian.
- **§6 kryteria:** pliki `lib/firestore/{tasks,calendar}.ts` usunięte (Task 5), format opisany (Task 6), osobna gałąź i PR (Taski 0 i 7).
- **Zmiana względem specu:** `planService` pominięty (A-1); `reorderTasks` nie dotyka `updated` (T4); 404 przy `update` nieistniejącego rekordu (T5, T11) zamiast surowego błędu Firestore.
- **Poza zakresem (0c-4):** `notes`, `documents`, `mindMaps`, `board`, `agent_log` (po A-1 bez writera), `chunks`, `Timestamp` w pozostałych typach.
