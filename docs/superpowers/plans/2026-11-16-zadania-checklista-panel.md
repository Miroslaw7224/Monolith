# Zadania: checklista testów, panel roboczy, zwijane kolumny: plan implementacji

> **Dla wykonawcy:** REQUIRED SUB-SKILL: `superpowers:executing-plans` (sesja główna, Claude Code robi implementację i commity; pomocnicy wg sekcji „Podział pracy”). Kroki mają checkboksy `- [ ]`.

**Cel:** punkty testów (PASS/FAIL, komentarz, podpunkty, „Kopiuj jako Markdown”) w polu `desc` zadania, autozapis bez przycisku „Zapisz”, panel roboczy od 1024 px oraz zwijane kolumny z regulowaną wysokością.

**Architektura:** dane zostają w `desc` jako Markdown (zero zmian w `contexts/bc_tasks/`, `lib/nexus/`, `app/api/**`, teście architektury). Cała logika to czyste funkcje (`taskChecklist.ts`, `taskBoardLayout.ts`) plus cienkie komponenty w `src/features/tasks/`. Zapis częściowy `PUT /api/tasks/:id` (schemat ma pola opcjonalne); commit vaulta robi tylko `nexus-sync.timer`.

**Tech:** Next.js 14, React 18, Vitest + Testing Library (jsdom), Playwright, lucide-react, i18n `useT()` (`src/i18n/locales/{pl,en}/tasks.ts`).

**Spec:** `docs/superpowers/specs/2026-11-16-zadania-checklista-panel-design.md`.

**Gałąź:** `feat/zadania-checklista-panel` (już istnieje, spec zacommitowany). Commity per zadanie; `main` nie ruszamy.

**Linia cięcia (spec §7):** zadania 1–5 wystarczą na testy 17.11 o 8:30 (checklista w modalu). Po zadaniu 5 robimy punkt kontrolny: wszystko działa, zielone testy, ewentualnie PR; zadania 6–8 (panel, zwijanie) dopiero potem.

**Fakty z kodu (sprawdzone 2026-11-16):**

- Zadanie otwiera się **dwuklikiem** tytułu (`handleTitleAreaDoubleClick` w `useTasksBoard.ts`); pojedynczy klik zaczyna edycję tytułu. Zostawiamy ten gest (spec mówi „klik” potocznie); panel otwiera się tym samym gestem.
- `description` w `bc_tasks` to `z.unknown()`, w `contexts/bc_tasks/` i `lib/nexus/task-line.ts` **nie ma limitu długości** `desc` (grep po `length|slice|MAX`). Spec kazał to sprawdzić: wynik „brak limitu”, nic do pokazywania w panelu.
- Testy używają `@/` jako aliasu do rootu; `jsdom` nie ma `window.matchMedia` (hook szerokości ma wtedy zwracać `false` = modal, więc istniejące testy modala działają).
- `tests/unit/features/tasks/TasksSection.test.tsx:196-198` klika „Zapisz” w modalu: do zmiany w zadaniu 3.

## Podział pracy (CLAUDE.md, ekonomia tokenów)

- **Ja (Claude Code):** pisanie kodu i testów (TDD), commity, decyzje.
- **`cursor`** (`--tier light`, zawsze, także przy review; wg pamięci `cursor-composer-bez-fast`): uruchamianie `npx vitest run <ścieżki>`, `npx tsc --noEmit`, `npm run lint`, `npm run build` z podsumowaniem „przeszło” albo `plik:linia + przyczyna`:
  `scripts/ask-helper.sh --role task --approve-allowed --tier light cursor "Uruchom: npx vitest run tests/unit/features/tasks/. Odpowiedz: przeszło albo lista plik:linia + przyczyna."`
  Nie używam `hc wait` (wisi dla Cursora). Cursor **nie** dostaje migracji tekstów i18n (gubi cudzysłowy i ogonki): teksty piszę sam.
- **`agy`**: przeglądy po zadaniach 3, 5, 8 i końcowy: `scripts/ask-helper.sh --role review --fresh agy "<prompt>"` z `AGY_DEEP_TAG=Hydrogen` (Argon wyczerpany do ~2026-11-21, pamięć `agy-argon-wyczerpany-hydrogen`). Opinie traktuję jako hipotezy: weryfikuję w kodzie przed zmianą. Szukanie „gdzie jest X” też do `agy --tier light`.
- Przed każdym commitem: `git diff --stat` i zielone testy z odpowiedzi cursora.

---

## Zadanie 1: `taskChecklist.ts` (parser, statusy, eksport)

**Pliki:**

- Utwórz: `src/features/tasks/taskChecklist.ts`
- Test: `tests/unit/features/tasks/taskChecklist.test.ts`

- [ ] **Krok 1: Napisz test (czerwony)**

```ts
import { describe, it, expect } from "vitest";
import {
  parseChecklist,
  serializeChecklist,
  cycleStatus,
  setItemStatus,
  setItemComment,
  countItems,
  summarize,
  exportMarkdown,
  itemLevel,
  itemComment,
  type ItemLine,
} from "@/src/features/tasks/taskChecklist";

const CG_DESC = [
  "MB — plan testu stagingu na 17.11 jest na main. Testy 8:30–11:30, werdykt GO/NO-GO o 12:00.",
  "- [ ] T-01: pobieranie PDF z generatora CV (iPhone i iPad)",
  "- [ ] T-02: CV między kontami w tej samej karcie",
  "- [!] T-04d: nazwa firmy w „Język CV” po angielsku",
  "  > Kroki: otwórz CV. Oczekiwany: EN. Rzeczywisty: PL.",
  "- [ ] T-06 C i E (zapis profilu, #1468)",
  "  - [ ] import CV 1 i „Zastosuj do formularza”",
  "  - [x] okno o niezapisanych zmianach",
  "    > Safari pokazuje okno tylko przy zamknięciu karty",
  "- [ ] R-01 (regresja)",
].join("\n");

const item = (desc: string, i = 0): ItemLine => {
  const line = parseChecklist(desc).lines[i];
  if (line.type !== "item") throw new Error("to nie punkt");
  return line;
};

describe("parseChecklist", () => {
  it("rozpoznaje trzy statusy", () => {
    expect(item("- [ ] A").status).toBe("todo");
    expect(item("- [x] A").status).toBe("pass");
    expect(item("- [!] A").status).toBe("fail");
    expect(item("- [ ] A").text).toBe("A");
    expect(itemLevel(item("- [ ] A"))).toBe(0);
  });

  it("poziom = wcięcie / 2 w dół", () => {
    expect(itemLevel(item("  - [ ] A"))).toBe(1);
    expect(itemLevel(item("   - [ ] A"))).toBe(1);
    expect(itemLevel(item("    - [ ] A"))).toBe(2);
  });

  it("komentarz pod punktem; kilka linii > to jeden komentarz", () => {
    expect(itemComment(item("- [ ] A\n  > uwaga"))).toBe("uwaga");
    expect(itemComment(item("- [ ] A\n  > uwaga1\n  > uwaga2"))).toBe("uwaga1\nuwaga2");
  });

  it("> bez punktu powyżej to zwykły tekst", () => {
    const model = parseChecklist("> cytat\n- [ ] A");
    expect(model.lines[0]).toEqual({ type: "text", raw: "> cytat" });
    expect(model.lines[1].type).toBe("item");
  });

  it("tekst między punktem a komentarzem przerywa komentarz", () => {
    const model = parseChecklist("- [ ] A\nzwykły tekst\n> to już nie komentarz");
    expect((model.lines[0] as ItemLine).commentRaw).toEqual([]);
    expect(model.lines[2]).toEqual({ type: "text", raw: "> to już nie komentarz" });
  });

  it("opis bez punktów to same linie tekstu", () => {
    const model = parseChecklist("Zwykła notatka\ndruga linia");
    expect(model.lines.every((l) => l.type === "text")).toBe(true);
    expect(countItems(model)).toEqual({ pass: 0, fail: 0, todo: 0 });
  });
});

describe("serializeChecklist (round-trip)", () => {
  it("opis „Testy Manualne CG” wraca bajt w bajt", () => {
    expect(serializeChecklist(parseChecklist(CG_DESC))).toBe(CG_DESC);
  });
  it("opis bez punktów i pusty wracają bez zmian", () => {
    expect(serializeChecklist(parseChecklist("Zwykła notatka\n\n> a"))).toBe(
      "Zwykła notatka\n\n> a"
    );
    expect(serializeChecklist(parseChecklist(""))).toBe("");
  });
});

describe("zmiany", () => {
  it("cycleStatus: todo → pass → fail → todo", () => {
    expect(cycleStatus("todo")).toBe("pass");
    expect(cycleStatus("pass")).toBe("fail");
    expect(cycleStatus("fail")).toBe("todo");
  });

  it("setItemStatus zmienia tylko znak w nawiasie", () => {
    const next = serializeChecklist(setItemStatus(parseChecklist(CG_DESC), 1, "pass"));
    expect(next).toBe(CG_DESC.replace("- [ ] T-01", "- [x] T-01"));
  });

  it("setItemStatus na linii tekstu nic nie robi", () => {
    const model = parseChecklist(CG_DESC);
    expect(setItemStatus(model, 0, "pass")).toBe(model);
  });

  it("setItemComment dodaje komentarz pod właściwym punktem z wcięciem punktu + 2", () => {
    const next = serializeChecklist(
      setItemComment(parseChecklist("- [ ] A\n- [ ] B"), 1, "uwaga\ndruga")
    );
    expect(next).toBe("- [ ] A\n- [ ] B\n  > uwaga\n  >" + " druga");
  });

  it("setItemComment: puste usuwa komentarz, ten sam tekst zwraca ten sam model", () => {
    const model = parseChecklist("- [ ] A\n  > x");
    expect(serializeChecklist(setItemComment(model, 0, ""))).toBe("- [ ] A");
    expect(setItemComment(model, 0, "x")).toBe(model);
  });
});

describe("summarize", () => {
  it("5 PASS, 1 FAIL, 9 todo", () => {
    const desc = [...Array(5).fill("- [x] p"), "- [!] f", ...Array(9).fill("- [ ] t")].join("\n");
    expect(summarize(parseChecklist(desc))).toBe("PASS 5 · FAIL 1 · pozostało 9");
  });
});

describe("exportMarkdown", () => {
  it("nagłówek, wstęp, podsumowanie, punkty z komentarzami i wcięciami", () => {
    const desc = "Wstęp\n- [x] A\n  > ok\n- [!] B\n  - [ ] C";
    expect(exportMarkdown("Testy", desc)).toBe(
      [
        "# Testy",
        "",
        "Wstęp",
        "",
        "PASS 1 · FAIL 1 · pozostało 1",
        "",
        "- ✅ PASS A",
        "  > ok",
        "- ❌ FAIL B",
        "  - ⬜ nie sprawdzono C",
      ].join("\n")
    );
  });
  it("pusty desc daje sam tytuł", () => {
    expect(exportMarkdown("Testy", "")).toBe("# Testy");
  });
  it("opis bez punktów: tytuł i akapit, bez podsumowania", () => {
    expect(exportMarkdown("T", "Zwykła notatka")).toBe("# T\n\nZwykła notatka");
  });
});
```

- [ ] **Krok 2: Uruchom, ma paść**

Run (cursor): `npx vitest run tests/unit/features/tasks/taskChecklist.test.ts`
Expected: FAIL (`Failed to resolve import "@/src/features/tasks/taskChecklist"`).

- [ ] **Krok 3: Implementacja**

```ts
export type ItemStatus = "todo" | "pass" | "fail";

export interface TextLine {
  type: "text";
  raw: string;
}

export interface ItemLine {
  type: "item";
  /** Wcięcie dokładnie jak w źródle. */
  indent: string;
  status: ItemStatus;
  text: string;
  /** Linie komentarza dokładnie jak w źródle (round-trip bajt w bajt). */
  commentRaw: string[];
}

export type ChecklistLine = TextLine | ItemLine;

export interface ChecklistModel {
  lines: ChecklistLine[];
}

const ITEM_RE = /^(\s*)- \[( |x|!)\] (.*)$/;
const COMMENT_RE = /^(\s*)> ?(.*)$/;
const MARK: Record<ItemStatus, string> = { todo: " ", pass: "x", fail: "!" };
const FROM_MARK: Record<string, ItemStatus> = { " ": "todo", x: "pass", "!": "fail" };
const EXPORT_LABEL: Record<ItemStatus, string> = {
  pass: "✅ PASS",
  fail: "❌ FAIL",
  todo: "⬜ nie sprawdzono",
};

export function parseChecklist(desc: string): ChecklistModel {
  const lines: ChecklistLine[] = [];
  let current: ItemLine | null = null;
  for (const raw of desc.split("\n")) {
    const match = ITEM_RE.exec(raw);
    if (match) {
      current = {
        type: "item",
        indent: match[1],
        status: FROM_MARK[match[2]],
        text: match[3],
        commentRaw: [],
      };
      lines.push(current);
      continue;
    }
    if (current && COMMENT_RE.test(raw)) {
      current.commentRaw.push(raw);
      continue;
    }
    current = null;
    lines.push({ type: "text", raw });
  }
  return { lines };
}

export function serializeChecklist(model: ChecklistModel): string {
  return model.lines
    .flatMap((line) =>
      line.type === "text"
        ? [line.raw]
        : [`${line.indent}- [${MARK[line.status]}] ${line.text}`, ...line.commentRaw]
    )
    .join("\n");
}

export function itemLevel(item: ItemLine): number {
  return Math.floor(item.indent.length / 2);
}

export function itemComment(item: ItemLine): string {
  return item.commentRaw.map((raw) => COMMENT_RE.exec(raw)?.[2] ?? "").join("\n");
}

export function cycleStatus(status: ItemStatus): ItemStatus {
  if (status === "todo") return "pass";
  if (status === "pass") return "fail";
  return "todo";
}

function replaceLine(model: ChecklistModel, index: number, line: ChecklistLine): ChecklistModel {
  return { lines: model.lines.map((l, i) => (i === index ? line : l)) };
}

export function setItemStatus(
  model: ChecklistModel,
  index: number,
  status: ItemStatus
): ChecklistModel {
  const line = model.lines[index];
  if (!line || line.type !== "item" || line.status === status) return model;
  return replaceLine(model, index, { ...line, status });
}

export function setItemComment(
  model: ChecklistModel,
  index: number,
  comment: string
): ChecklistModel {
  const line = model.lines[index];
  if (!line || line.type !== "item" || itemComment(line) === comment) return model;
  const commentRaw =
    comment === "" ? [] : comment.split("\n").map((part) => `${line.indent}  > ${part}`);
  return replaceLine(model, index, { ...line, commentRaw });
}

export function countItems(model: ChecklistModel): { pass: number; fail: number; todo: number } {
  const counts = { pass: 0, fail: 0, todo: 0 };
  for (const line of model.lines) if (line.type === "item") counts[line.status] += 1;
  return counts;
}

export function summarize(model: ChecklistModel): string {
  const { pass, fail, todo } = countItems(model);
  return `PASS ${pass} · FAIL ${fail} · pozostało ${todo}`;
}

export function exportMarkdown(title: string, desc: string): string {
  const model = parseChecklist(desc);
  const intro = model.lines
    .flatMap((line) => (line.type === "text" ? [line.raw] : []))
    .join("\n")
    .trim();
  const items = model.lines.filter((line): line is ItemLine => line.type === "item");

  const parts = [`# ${title}`];
  if (intro) parts.push(intro);
  if (items.length > 0) {
    parts.push(summarize(model));
    const body = items.flatMap((it) => {
      const pad = "  ".repeat(itemLevel(it));
      const comment = itemComment(it);
      return [
        `${pad}- ${EXPORT_LABEL[it.status]} ${it.text}`,
        ...(comment ? comment.split("\n").map((part) => `${pad}  > ${part}`) : []),
      ];
    });
    parts.push(body.join("\n"));
  }
  return parts.join("\n\n");
}
```

- [ ] **Krok 4: Uruchom, ma przejść**

Run (cursor): `npx vitest run tests/unit/features/tasks/taskChecklist.test.ts`
Expected: PASS (wszystkie przypadki). Jeśli test „setItemComment dodaje komentarz” pada na spacji w `"  >" + " druga"`: to ta sama linia `"  > druga"`, napraw test, nie kod.

- [ ] **Krok 5: Commit**

```bash
git add src/features/tasks/taskChecklist.ts tests/unit/features/tasks/taskChecklist.test.ts
git commit -m "feat(tasks): parser i eksport checklisty w desc zadania

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Zadanie 2: zapis częściowy i `useTaskDraft` (autozapis)

**Pliki:**

- Zmień: `src/features/tasks/useTasksBoard.ts` (`saveTaskDetail` → `saveTaskPatch`, typ `TaskPatch`)
- Utwórz: `src/features/tasks/useTaskDraft.ts`
- Test: `tests/unit/features/tasks/useTaskDraft.test.ts`

- [ ] **Krok 1: Test hooka (czerwony)**

```ts
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useTaskDraft, buildDraftPatch } from "@/src/features/tasks/useTaskDraft";

const INITIAL = { title: "Tytuł", link: "", description: "Opis" };

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const setup = (save = vi.fn().mockResolvedValue(undefined)) => {
  const hook = renderHook(() => useTaskDraft({ taskId: "t1", initial: INITIAL, save }));
  return { ...hook, save };
};
const tick = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

describe("buildDraftPatch", () => {
  it("tylko zmienione pola, przycięte; pusty tytuł pomijany", () => {
    expect(buildDraftPatch({ ...INITIAL, description: " Nowy \n" }, INITIAL)).toEqual({
      description: "Nowy",
    });
    expect(buildDraftPatch({ ...INITIAL, title: "  " }, INITIAL)).toEqual({});
    expect(buildDraftPatch(INITIAL, INITIAL)).toEqual({});
  });
});

describe("useTaskDraft", () => {
  it("kilka zmian w ciągu 1,4 s → jeden zapis po 1,5 s od ostatniej", async () => {
    const { result, save } = setup();
    act(() => result.current.setField("description", "a"));
    await tick(700);
    act(() => result.current.setField("description", "ab"));
    await tick(700);
    expect(save).not.toHaveBeenCalled();
    await tick(800);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("t1", { description: "ab" });
    expect(result.current.state).toBe("saved");
  });

  it("brak zmiany treści → brak zapisu", async () => {
    const { result, save } = setup();
    act(() => result.current.setField("description", "Opis"));
    await tick(2000);
    expect(save).not.toHaveBeenCalled();
  });

  it("zapis zawiera tylko zmienione pola", async () => {
    const { result, save } = setup();
    act(() => result.current.setField("link", "https://x.pl"));
    await tick(1500);
    expect(save).toHaveBeenCalledWith("t1", { link: "https://x.pl" });
  });

  it("błąd serwera → stan error i ponowienie przy następnej zmianie (z polami, które padły)", async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error("HTTP 500")).mockResolvedValue(undefined);
    const { result } = setup(save);
    act(() => result.current.setField("description", "a"));
    await tick(1500);
    expect(result.current.state).toBe("error");
    act(() => result.current.setField("title", "Nowy"));
    await tick(1500);
    expect(save).toHaveBeenLastCalledWith("t1", { title: "Nowy", description: "a" });
    expect(result.current.state).toBe("saved");
  });

  it("flush() zapisuje od razu, bez czekania na timer", async () => {
    const { result, save } = setup();
    act(() => result.current.setField("description", "x"));
    await act(async () => {
      await result.current.flush();
    });
    expect(save).toHaveBeenCalledWith("t1", { description: "x" });
    await tick(2000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("odmontowanie (zamknięcie, zmiana zadania) zapisuje oczekującą zmianę dla starego id", async () => {
    const { result, save, unmount } = setup();
    act(() => result.current.setField("description", "x"));
    unmount();
    await tick(0);
    expect(save).toHaveBeenCalledWith("t1", { description: "x" });
  });

  it("pusty tytuł: titleEmpty = true i brak zapisu tytułu", async () => {
    const { result, save } = setup();
    act(() => result.current.setField("title", ""));
    await tick(1500);
    expect(result.current.titleEmpty).toBe(true);
    expect(save).not.toHaveBeenCalled();
  });

  it("saveNow wysyła jednopolowy zapis od razu i ustawia stan", async () => {
    const { result, save } = setup();
    await act(async () => {
      await result.current.saveNow({ status: "done" });
    });
    expect(save).toHaveBeenCalledWith("t1", { status: "done" });
    expect(result.current.state).toBe("saved");
  });
});
```

- [ ] **Krok 2: Uruchom, ma paść** (cursor): `npx vitest run tests/unit/features/tasks/useTaskDraft.test.ts` → FAIL (brak modułu).

- [ ] **Krok 3: `useTasksBoard.ts`: typ i `saveTaskPatch`**

Dodaj po `export type TaskProject = ...`:

```ts
/** Częściowa zmiana zadania wysyłana jednym `PUT /api/tasks/:id`. */
export type TaskPatch = Partial<{
  title: string;
  link: string;
  description: string;
  status: Task["status"];
  due_date: string | null;
  project: string | null;
}>;
```

Zastąp cały `saveTaskDetail` (linie 131–174) funkcją:

```ts
const saveTaskPatch = useCallback(
  async (id: string, patch: TaskPatch): Promise<void> => {
    const res = await apiFetch(`/api/tasks/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res && res.ok === false) throw new Error(`HTTP ${res.status}`);
    const { project, ...rest } = patch;
    setTasks((prev) =>
      prev.map((x) =>
        x.id === id
          ? {
              ...x,
              ...rest,
              ...(project !== undefined ? { project: project ?? undefined } : {}),
            }
          : x
      )
    );
  },
  [apiFetch]
);
```

W obiekcie zwracanym zamień `saveTaskDetail,` na `saveTaskPatch,`. Błąd leci do wywołującego (hook `useTaskDraft` pokazuje stan `error`), nie ma już cichego `console.error`.

- [ ] **Krok 4: `useTaskDraft.ts`**

```ts
import { useCallback, useEffect, useRef, useState } from "react";
import type { TaskPatch } from "./useTasksBoard";

export type DraftState = "idle" | "saving" | "saved" | "error";

export interface DraftFields {
  title: string;
  link: string;
  description: string;
}

const KEYS = ["title", "link", "description"] as const;

/** Tylko pola zmienione względem ostatnio zapisanych (po przycięciu); pusty tytuł się nie zapisuje. */
export function buildDraftPatch(
  values: DraftFields,
  saved: DraftFields
): Pick<TaskPatch, "title" | "link" | "description"> {
  const patch: Partial<DraftFields> = {};
  for (const key of KEYS) {
    const next = values[key].trim();
    if (key === "title" && next === "") continue;
    if (next !== saved[key].trim()) patch[key] = next;
  }
  return patch;
}

interface Options {
  taskId: string;
  initial: DraftFields;
  save: (taskId: string, patch: TaskPatch) => Promise<void>;
  delayMs?: number;
}

/**
 * Szkic pól tekstowych zadania z autozapisem. Komponent ma być montowany z `key={taskId}`:
 * odmontowanie (zamknięcie, zmiana zadania) zapisuje oczekującą zmianę.
 */
export function useTaskDraft({ taskId, initial, save, delayMs = 1500 }: Options) {
  const [values, setValues] = useState<DraftFields>(initial);
  const [state, setState] = useState<DraftState>("idle");
  const valuesRef = useRef(values);
  const savedRef = useRef<DraftFields>(initial);
  const saveRef = useRef(save);
  const idRef = useRef(taskId);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chainRef = useRef<Promise<void>>(Promise.resolve());
  saveRef.current = save;
  idRef.current = taskId;

  const run = useCallback(async (patch: TaskPatch, onOk?: () => void) => {
    setState("saving");
    try {
      await saveRef.current(idRef.current, patch);
      onOk?.();
      setState("saved");
    } catch {
      setState("error");
    }
  }, []);

  const flush = useCallback((): Promise<void> => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    chainRef.current = chainRef.current.then(async () => {
      const patch = buildDraftPatch(valuesRef.current, savedRef.current);
      if (Object.keys(patch).length === 0) return;
      await run(patch, () => {
        savedRef.current = { ...savedRef.current, ...patch };
      });
    });
    return chainRef.current;
  }, [run]);

  const saveNow = useCallback(
    (patch: TaskPatch): Promise<void> => {
      chainRef.current = chainRef.current.then(() => run(patch));
      return chainRef.current;
    },
    [run]
  );

  const setField = useCallback(
    (key: keyof DraftFields, value: string) => {
      const next = { ...valuesRef.current, [key]: value };
      valuesRef.current = next;
      setValues(next);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void flush();
      }, delayMs);
    },
    [delayMs, flush]
  );

  useEffect(
    () => () => {
      void flush();
    },
    [flush]
  );

  return { values, setField, state, flush, saveNow, titleEmpty: values.title.trim() === "" };
}
```

- [ ] **Krok 5: Uruchom** (cursor): `npx vitest run tests/unit/features/tasks/useTaskDraft.test.ts` → PASS. `npx tsc --noEmit` pokaże teraz błąd w `TasksSection.tsx` (`saveTaskDetail` już nie istnieje): to oczekiwane, naprawia go zadanie 3. **Zadanie 2 nie ma własnego commitu**: commit robimy po zadaniu 3 (jeden commit „autozapis zadania”), żeby każdy commit miał zielony `tsc`.

---

## Zadanie 3: wspólna treść zadania, modal bez „Zapisz”, i18n

**Pliki:**

- Utwórz: `src/features/tasks/TaskDetailContent.tsx`
- Zmień: `src/features/tasks/TaskDetailModal.tsx`, `src/features/tasks/TasksSection.tsx`, `src/features/tasks/tasks.css`, `src/i18n/locales/pl/tasks.ts`, `src/i18n/locales/en/tasks.ts`
- Zmień testy: `tests/unit/features/tasks/TaskDetailModal.test.tsx`, `tests/unit/features/tasks/TasksSection.test.tsx:196-198`

- [ ] **Krok 1: i18n (piszę sam, nie cursor)**

`pl/tasks.ts`, obok `tasksDetailSaving`:

```ts
  tasksDetailClose: "Zamknij",
  tasksDetailSaved: "Zapisano",
  tasksDetailSaveError: "Nie zapisano. Spróbuję przy następnej zmianie.",
  tasksDetailTitleRequired: "Tytuł nie może być pusty",
```

`en/tasks.ts`:

```ts
  tasksDetailClose: "Close",
  tasksDetailSaved: "Saved",
  tasksDetailSaveError: "Not saved. Will retry on the next change.",
  tasksDetailTitleRequired: "Title cannot be empty",
```

Klucze `tasksDetailSave` (przycisk) zostawiamy w słownikach, jeśli pliki testowe i18n sprawdzają parzystość PL/EN; nie usuwamy.

- [ ] **Krok 2: Testy modala (czerwone)**: zastąp zawartość `TaskDetailModal.test.tsx`

```tsx
import React from "react";
import { render, screen, cleanup, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, afterEach, beforeEach } from "vitest";

import { TaskDetailModal } from "@/src/features/tasks/TaskDetailModal";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const fakeTask = {
  id: "task-1",
  title: "Napisać testy",
  link: "https://example.com",
  description: "Opis zadania",
  status: "todo" as const,
  due_date: null,
  priority: null,
  order: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const PROJECTS = [
  { id: "monolith", name: "Monolith" },
  { id: "career-guide", name: "Career Guide" },
];

describe("TaskDetailModal", () => {
  let onPatch: ReturnType<typeof vi.fn>;
  let onClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onPatch = vi.fn().mockResolvedValue(undefined);
    onClose = vi.fn();
  });

  const renderModal = (task = fakeTask, extra: { projects?: typeof PROJECTS } = {}) =>
    render(<TaskDetailModal task={task} isOpen onClose={onClose} onPatch={onPatch} {...extra} />);

  it("pokazuje tytuł, link i notatkę", () => {
    renderModal();
    expect(screen.getByDisplayValue("Napisać testy")).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://example.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Opis zadania")).toBeInTheDocument();
  });

  it("nie renderuje się, gdy zamknięty albo bez zadania", () => {
    const { unmount } = render(
      <TaskDetailModal task={fakeTask} isOpen={false} onClose={onClose} onPatch={onPatch} />
    );
    expect(screen.queryByDisplayValue("Napisać testy")).not.toBeInTheDocument();
    unmount();
    render(<TaskDetailModal task={null} isOpen onClose={onClose} onPatch={onPatch} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("nie ma przycisku „Zapisz”; „Zamknij” (ikona i stopka) zamyka", async () => {
    const user = userEvent.setup();
    renderModal();
    expect(screen.queryByRole("button", { name: /^zapisz$/i })).not.toBeInTheDocument();
    const closeBtns = screen.getAllByRole("button", { name: "Zamknij" });
    await user.click(closeBtns[0]);
    await user.click(closeBtns[closeBtns.length - 1]);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("autozapis notatki: jeden zapis 1,5 s po ostatniej zmianie, tylko to pole", async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderModal();
    await user.type(screen.getByLabelText("Notatka"), "X");
    expect(onPatch).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(onPatch).toHaveBeenCalledTimes(1);
    expect(onPatch).toHaveBeenCalledWith("task-1", { description: "Opis zadaniaX" });
    expect(screen.getByText("Zapisano")).toBeInTheDocument();
  });

  it("zamknięcie modala zapisuje oczekującą zmianę (flush)", async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { rerender } = renderModal();
    await user.type(screen.getByLabelText("Notatka"), "Y");
    rerender(
      <TaskDetailModal task={fakeTask} isOpen={false} onClose={onClose} onPatch={onPatch} />
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(onPatch).toHaveBeenCalledWith("task-1", { description: "Opis zadaniaY" });
  });

  it("pusty tytuł nie jest zapisywany i pokazuje błąd", async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderModal();
    await user.clear(screen.getByDisplayValue("Napisać testy"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(onPatch).not.toHaveBeenCalled();
    expect(screen.getByText("Tytuł nie może być pusty")).toBeInTheDocument();
  });

  it("status zapisuje się od razu jednopolowym patchem", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole("button", { name: "W toku" }));
    expect(onPatch).toHaveBeenCalledWith("task-1", { status: "in_progress" });
    await user.click(screen.getByRole("button", { name: "Odłożone" }));
    expect(onPatch).toHaveBeenLastCalledWith("task-1", { status: "deferred" });
  });

  it("błąd zapisu pokazuje komunikat", async () => {
    vi.useFakeTimers();
    onPatch.mockRejectedValue(new Error("HTTP 500"));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderModal();
    await user.type(screen.getByLabelText("Notatka"), "Z");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(screen.getByText(/Nie zapisano/)).toBeInTheDocument();
  });

  it("tytuł okna z tłumaczeń", () => {
    renderModal();
    expect(screen.getByText("Zadanie")).toBeInTheDocument();
  });

  describe("projekt zadania", () => {
    it("zapisuje wybrany projekt od razu", async () => {
      const user = userEvent.setup();
      renderModal(fakeTask, { projects: PROJECTS });
      const select = screen.getByLabelText("Projekt");
      expect(select).toHaveValue("");
      await user.selectOptions(select, "monolith");
      expect(onPatch).toHaveBeenCalledWith("task-1", { project: "monolith" });
    });

    it("„Bez projektu” zdejmuje projekt (null)", async () => {
      const user = userEvent.setup();
      renderModal({ ...fakeTask, project: "monolith" }, { projects: PROJECTS });
      const select = screen.getByLabelText("Projekt");
      expect(select).toHaveValue("monolith");
      await user.selectOptions(select, "");
      expect(onPatch).toHaveBeenCalledWith("task-1", { project: null });
    });

    it("nieznane id projektu zostaje wybrane i nie jest wysyłane bez zmiany", async () => {
      renderModal({ ...fakeTask, project: "usuniety-projekt" }, { projects: PROJECTS });
      expect(screen.getByLabelText("Projekt")).toHaveValue("usuniety-projekt");
      expect(onPatch).not.toHaveBeenCalled();
    });
  });
});
```

Run (cursor): `npx vitest run tests/unit/features/tasks/TaskDetailModal.test.tsx` → FAIL (`onPatch` nieznany / brak „Zamknij”).

- [ ] **Krok 3: `TaskDetailContent.tsx`**

```tsx
import React, { useEffect, useState } from "react";
import type { Task } from "./TasksSection";
import { useT } from "@/src/i18n/useT";
import { useTaskDraft } from "./useTaskDraft";
import type { TaskPatch } from "./useTasksBoard";

export interface TaskDetailContentProps {
  task: Task;
  projects: { id: string; name: string }[];
  onPatch: (taskId: string, patch: TaskPatch) => Promise<void>;
}

/** Pola zadania z autozapisem; wspólne dla modala (< 1024 px) i panelu roboczego. Montować z `key={task.id}`. */
export function TaskDetailContent({ task, projects, onPatch }: TaskDetailContentProps) {
  const t = useT();
  const draft = useTaskDraft({
    taskId: task.id,
    initial: {
      title: task.title,
      link: task.link ?? "",
      description: task.description ?? "",
    },
    save: onPatch,
  });
  const [status, setStatus] = useState<Task["status"]>(task.status);
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [project, setProject] = useState(task.project ?? "");

  // zmiana z zewnątrz (przeciągnięcie karty, data na karcie) odświeża pola
  useEffect(() => setStatus(task.status), [task.status]);
  useEffect(() => setDueDate(task.due_date ?? ""), [task.due_date]);
  useEffect(() => setProject(task.project ?? ""), [task.project]);

  const statusOptions: { value: Task["status"]; label: string }[] = [
    { value: "deferred", label: t("tasks:tasksDeferred") },
    { value: "todo", label: t("tasks:tasksTodo") },
    { value: "in_progress", label: t("tasks:tasksInProgress") },
    { value: "to_review", label: t("tasks:tasksToReview") },
    { value: "done", label: t("tasks:tasksDone") },
  ];

  // projekt usunięty z rejestru: zostaje wybrany (samo id) i nie jest wysyłany bez zmiany
  const orphanProject = project !== "" && !projects.some((p) => p.id === project) ? project : null;

  const stateText =
    draft.state === "saving"
      ? t("tasks:tasksDetailSaving")
      : draft.state === "saved"
        ? t("tasks:tasksDetailSaved")
        : draft.state === "error"
          ? t("tasks:tasksDetailSaveError")
          : "";

  return (
    <>
      <div className="zad-field">
        <label htmlFor="task-detail-title-field" className="zad-label">
          {t("tasks:tasksDetailTitleFieldLabel")}
        </label>
        <input
          id="task-detail-title-field"
          type="text"
          value={draft.values.title}
          onChange={(e) => draft.setField("title", e.target.value)}
          aria-invalid={draft.titleEmpty}
          className="zad-input"
        />
        {draft.titleEmpty ? (
          <p className="zad-field__error" role="alert">
            {t("tasks:tasksDetailTitleRequired")}
          </p>
        ) : null}
      </div>

      <div className="zad-field">
        <label htmlFor="task-detail-link" className="zad-label">
          {t("tasks:tasksDetailLinkLabel")}
        </label>
        <input
          id="task-detail-link"
          type="url"
          value={draft.values.link}
          onChange={(e) => draft.setField("link", e.target.value)}
          placeholder={t("tasks:tasksDetailLinkPlaceholder")}
          className="zad-input"
        />
      </div>

      <div className="zad-field">
        <span className="zad-label">{t("tasks:tasksDetailStatusLabel")}</span>
        <div className="zad-status-group">
          {statusOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setStatus(opt.value);
                void draft.saveNow({ status: opt.value });
              }}
              className={["zad-status-btn", status === opt.value ? "zad-status-btn--active" : ""]
                .filter(Boolean)
                .join(" ")}
            >
              <span className={`zad-dot zad-dot--${opt.value}`} aria-hidden="true" />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="zad-field">
        <label htmlFor="task-detail-due" className="zad-label">
          {t("tasks:tasksDeadlineLabel")}
        </label>
        <input
          id="task-detail-due"
          type="date"
          value={dueDate}
          onChange={(e) => {
            const value = e.target.value;
            setDueDate(value);
            void draft.saveNow({ due_date: value === "" ? null : value });
          }}
          className="zad-input zad-due-input--field"
        />
      </div>

      <div className="zad-field">
        <label htmlFor="task-detail-project" className="zad-label">
          {t("tasks:tasksDetailProjectLabel")}
        </label>
        <select
          id="task-detail-project"
          value={project}
          onChange={(e) => {
            const value = e.target.value;
            setProject(value);
            void draft.saveNow({ project: value === "" ? null : value });
          }}
          className="zad-input"
        >
          <option value="">{t("tasks:tasksNoProject")}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          {orphanProject !== null && <option value={orphanProject}>{orphanProject}</option>}
        </select>
      </div>

      <div className="zad-field">
        <label htmlFor="task-detail-note" className="zad-label">
          {t("tasks:tasksDetailNoteLabel")}
        </label>
        <textarea
          id="task-detail-note"
          value={draft.values.description}
          onChange={(e) => draft.setField("description", e.target.value)}
          placeholder={t("tasks:tasksDetailNotePlaceholder")}
          rows={6}
          className="zad-textarea"
        />
      </div>

      <p className="zad-save-state" role="status" aria-live="polite">
        {stateText}
      </p>
    </>
  );
}
```

(`useEffect(() => setStatus(...), [...])`: strzałka zwraca wynik `setStatus` = `undefined`, więc OK dla Reacta; jeśli lint krzyczy, owiń w `{ }`.)

- [ ] **Krok 4: `TaskDetailModal.tsx`**: zastąp cały plik

```tsx
import React from "react";
import { X } from "lucide-react";
import type { Task } from "./TasksSection";
import { useT } from "@/src/i18n/useT";
import { TaskDetailContent } from "./TaskDetailContent";
import type { TaskPatch } from "./useTasksBoard";

export interface TaskDetailModalProps {
  task: Task | null;
  isOpen: boolean;
  /** Projekty z rejestru do wyboru; brak = sama opcja „Bez projektu”. */
  projects?: { id: string; name: string }[];
  onClose: () => void;
  onPatch: (taskId: string, patch: TaskPatch) => Promise<void>;
}

export function TaskDetailModal({
  task,
  isOpen,
  projects = [],
  onClose,
  onPatch,
}: TaskDetailModalProps) {
  const t = useT();
  if (!isOpen || !task) return null;
  const closeLabel = t("tasks:tasksDetailClose");

  return (
    <div
      className="zad-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-detail-title"
    >
      <div
        className="zad-modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          }
        }}
      >
        <div className="zad-modal__head">
          <h3 id="task-detail-title" className="zad-modal__title">
            {t("tasks:tasksDetailModalTitle")}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="zad-btn zad-btn--ghost zad-btn--sm"
            aria-label={closeLabel}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="zad-modal__body">
          <TaskDetailContent key={task.id} task={task} projects={projects} onPatch={onPatch} />
        </div>

        <div className="zad-modal__footer">
          <button type="button" onClick={onClose} className="zad-btn zad-btn--ghost">
            {closeLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Krok 5: `TasksSection.tsx`**: w destrukturyzacji `saveTaskDetail,` → `saveTaskPatch,`; w `<TaskDetailModal …>` zamień `onSave={saveTaskDetail}` na `onPatch={saveTaskPatch}`.

- [ ] **Krok 6: CSS** (`tasks.css`, po `.zad-modal__body--templates`)

```css
.zad-field__error {
  margin: var(--s-1) 0 0;
  font-size: var(--fs-xs);
  color: var(--danger);
}

.zad-save-state {
  margin: 0;
  min-height: 1.2em;
  font: 500 var(--fs-xs) / 1.2 var(--font-mono);
  color: var(--muted);
}
```

- [ ] **Krok 7: Napraw `TasksSection.test.tsx:196-198`.** Przeczytaj linie ~185–215. Zamiast kliknięcia „Zapisz” wpisz w `within(dialog).getByLabelText("Notatka")` tekst (`fireEvent.change(..., { target: { value: "Nowa notatka" } })`) i użyj `await waitFor(() => expect(apiFetch).toHaveBeenCalledWith("/api/tasks/<id>", expect.objectContaining({ method: "PUT", body: JSON.stringify({ description: "Nowa notatka" }) })), { timeout: 3000 })` (prawdziwe timery, autozapis 1,5 s). Oczekiwane wywołanie dopasuj do tego, co test sprawdzał wcześniej (id zadania, kształt body = tylko zmienione pole).

- [ ] **Krok 8: Uruchom** (cursor): `npx vitest run tests/unit/features/tasks/`, `npx tsc --noEmit`, `npm run lint`. Oczekiwane: wszystko przechodzi. Pełny output czytam tylko gdy podsumowanie nie wystarcza.

- [ ] **Krok 9: Review agy** (`--fresh`, Hydrogen): „Przejrzyj `git diff` (src/features/tasks/useTaskDraft.ts, TaskDetailContent.tsx, TaskDetailModal.tsx, useTasksBoard.ts): wyścigi autozapisu, utrata zmian przy zamknięciu, nadpisanie statusu przy przeciąganiu. Odpowiedz listą `plik:linia + problem`, max 15 linii.” Zweryfikuj każdy punkt w kodzie, napraw realne.

- [ ] **Krok 10: Commit** (zadania 2 i 3 razem)

```bash
git add src/features/tasks tests/unit/features/tasks src/i18n/locales
git commit -m "feat(tasks): autozapis zadania zamiast przycisku Zapisz, zapis częściowy PUT

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Zadanie 4: `TaskChecklist.tsx` (lista punktów, komentarze, kopiowanie)

**Pliki:**

- Utwórz: `src/features/tasks/TaskChecklist.tsx`
- Zmień: `src/features/tasks/TaskDetailContent.tsx` (podmiana pola „Notatka”), `tasks.css`, `src/i18n/locales/{pl,en}/tasks.ts`
- Test: `tests/unit/features/tasks/TaskChecklist.test.tsx`

- [ ] **Krok 1: i18n (sam)**

`pl`:

```ts
  tasksChecklistList: "Lista",
  tasksChecklistText: "Tekst",
  tasksChecklistCopy: "Kopiuj jako Markdown",
  tasksChecklistCopied: "Skopiowano",
  tasksChecklistCopyFailed: "Schowek niedostępny",
  tasksChecklistCommentPlaceholder: "Uwaga do punktu…",
  tasksChecklistStatusTodo: "Do sprawdzenia: kliknij, by oznaczyć PASS",
  tasksChecklistStatusPass: "PASS: kliknij, by oznaczyć FAIL",
  tasksChecklistStatusFail: "FAIL: kliknij, by wyczyścić",
  tasksChecklistCounter: "PASS {{pass}} · FAIL {{fail}} · pozostało {{todo}}",
```

`en`:

```ts
  tasksChecklistList: "List",
  tasksChecklistText: "Text",
  tasksChecklistCopy: "Copy as Markdown",
  tasksChecklistCopied: "Copied",
  tasksChecklistCopyFailed: "Clipboard unavailable",
  tasksChecklistCommentPlaceholder: "Note for this item…",
  tasksChecklistStatusTodo: "Unchecked: click to mark PASS",
  tasksChecklistStatusPass: "PASS: click to mark FAIL",
  tasksChecklistStatusFail: "FAIL: click to clear",
  tasksChecklistCounter: "PASS {{pass}} · FAIL {{fail}} · {{todo}} left",
```

- [ ] **Krok 2: Test (czerwony)**

```tsx
import React from "react";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, afterEach } from "vitest";
import { TaskChecklist } from "@/src/features/tasks/TaskChecklist";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const DESC = "Wstęp\n- [ ] A\n- [x] B\n  > ok\n  - [!] C";

function setup(value = DESC) {
  const onChange = vi.fn();
  render(<TaskChecklist title="Testy" value={value} onChange={onChange} />);
  return { onChange };
}

describe("TaskChecklist", () => {
  it("bez punktów pokazuje samo pole tekstowe (Notatka)", () => {
    setup("Zwykła notatka");
    expect(screen.getByLabelText("Notatka")).toHaveValue("Zwykła notatka");
    expect(screen.queryByRole("button", { name: "Lista" })).not.toBeInTheDocument();
  });

  it("z punktami domyślnie lista i licznik w nagłówku", () => {
    setup();
    expect(screen.getByText("PASS 1 · FAIL 1 · pozostało 1")).toBeInTheDocument();
    expect(screen.getAllByTestId("checklist-item")).toHaveLength(3);
  });

  it("klik statusu przechodzi todo → pass → fail → todo (zmienia tylko znak)", async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    await user.click(screen.getAllByRole("button", { name: /Do sprawdzenia/ })[0]);
    expect(onChange).toHaveBeenLastCalledWith(DESC.replace("- [ ] A", "- [x] A"));
  });

  it("PASS → FAIL oraz FAIL → todo", async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    await user.click(screen.getByRole("button", { name: /^PASS:/ }));
    expect(onChange).toHaveBeenLastCalledWith(DESC.replace("- [x] B", "- [!] B"));
    await user.click(screen.getByRole("button", { name: /^FAIL:/ }));
    expect(onChange).toHaveBeenLastCalledWith(DESC.replace("- [!] C", "- [ ] C"));
  });

  it("komentarz zapisuje się pod właściwym punktem", () => {
    const { onChange } = setup();
    const inputs = screen.getAllByPlaceholderText("Uwaga do punktu…");
    fireEvent.change(inputs[0], { target: { value: "nie działa" } });
    expect(onChange).toHaveBeenLastCalledWith(DESC.replace("- [ ] A", "- [ ] A\n  > nie działa"));
  });

  it("przełączenie Lista ↔ Tekst nie traci zmian", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button", { name: "Tekst" }));
    expect(screen.getByLabelText("Notatka")).toHaveValue(DESC);
    await user.click(screen.getByRole("button", { name: "Lista" }));
    expect(screen.getAllByTestId("checklist-item")).toHaveLength(3);
  });

  it("Kopiuj jako Markdown wysyła eksport do schowka", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    setup();
    await user.click(screen.getByRole("button", { name: "Kopiuj jako Markdown" }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("# Testy"));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("✅ PASS B"));
    expect(await screen.findByText("Skopiowano")).toBeInTheDocument();
  });

  it("niedostępny schowek: komunikat, bez cichej porażki", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    setup();
    await user.click(screen.getByRole("button", { name: "Kopiuj jako Markdown" }));
    expect(await screen.findByText("Schowek niedostępny")).toBeInTheDocument();
  });
});
```

Uwaga: `userEvent.setup()` podmienia `navigator.clipboard` własnym stubem; jeśli test schowka pada przez to, wywołaj `Object.defineProperty` **po** `userEvent.setup()` (jak wyżej) albo użyj `fireEvent.click`.

Run (cursor): `npx vitest run tests/unit/features/tasks/TaskChecklist.test.tsx` → FAIL.

- [ ] **Krok 3: `TaskChecklist.tsx`**

```tsx
import React, { useState } from "react";
import { useT } from "@/src/i18n/useT";
import {
  countItems,
  cycleStatus,
  exportMarkdown,
  itemComment,
  itemLevel,
  parseChecklist,
  serializeChecklist,
  setItemComment,
  setItemStatus,
  type ItemStatus,
} from "./taskChecklist";

interface Props {
  title: string;
  value: string;
  onChange: (next: string) => void;
}

const GLYPH: Record<ItemStatus, string> = { todo: "☐", pass: "✓", fail: "✕" };
type CopyState = "idle" | "ok" | "failed";

export function TaskChecklist({ title, value, onChange }: Props) {
  const t = useT();
  const model = parseChecklist(value);
  const counts = countItems(model);
  const hasItems = counts.pass + counts.fail + counts.todo > 0;
  const [mode, setMode] = useState<"list" | "text">(hasItems ? "list" : "text");
  const [copy, setCopy] = useState<CopyState>("idle");

  const statusLabel: Record<ItemStatus, string> = {
    todo: t("tasks:tasksChecklistStatusTodo"),
    pass: t("tasks:tasksChecklistStatusPass"),
    fail: t("tasks:tasksChecklistStatusFail"),
  };

  const copyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(exportMarkdown(title, value));
      setCopy("ok");
    } catch {
      setCopy("failed");
    }
  };

  const textarea = (
    <div className="zad-field">
      <label htmlFor="task-detail-note" className="zad-label">
        {t("tasks:tasksDetailNoteLabel")}
      </label>
      <textarea
        id="task-detail-note"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("tasks:tasksDetailNotePlaceholder")}
        rows={6}
        className="zad-textarea"
      />
    </div>
  );

  if (!hasItems) return textarea;

  return (
    <div className="zad-checklist">
      <div className="zad-checklist__head">
        <span className="zad-label">{t("tasks:tasksDetailNoteLabel")}</span>
        <span className="zad-checklist__counter">
          {t("tasks:tasksChecklistCounter", {
            pass: counts.pass,
            fail: counts.fail,
            todo: counts.todo,
          })}
        </span>
        <div className="zad-checklist__tools">
          {(["list", "text"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={["zad-btn zad-btn--ghost zad-btn--sm", mode === m ? "zad-btn--active" : ""]
                .filter(Boolean)
                .join(" ")}
            >
              {t(m === "list" ? "tasks:tasksChecklistList" : "tasks:tasksChecklistText")}
            </button>
          ))}
          <button
            type="button"
            onClick={() => void copyMarkdown()}
            className="zad-btn zad-btn--ghost zad-btn--sm"
          >
            {t("tasks:tasksChecklistCopy")}
          </button>
        </div>
      </div>
      <p className="zad-save-state" role="status" aria-live="polite">
        {copy === "ok"
          ? t("tasks:tasksChecklistCopied")
          : copy === "failed"
            ? t("tasks:tasksChecklistCopyFailed")
            : ""}
      </p>

      {mode === "text" ? (
        textarea
      ) : (
        <ul className="zad-checklist__list">
          {model.lines.map((line, index) => {
            if (line.type === "text") {
              return line.raw.trim() === "" ? null : (
                <li key={index} className="zad-checklist__text">
                  {line.raw}
                </li>
              );
            }
            return (
              <li
                key={index}
                data-testid="checklist-item"
                className={`zad-checklist__item zad-checklist__item--${line.status}`}
                style={{ paddingLeft: `${itemLevel(line) * 1.25}rem` }}
              >
                <div className="zad-checklist__row">
                  <button
                    type="button"
                    aria-label={statusLabel[line.status]}
                    onClick={() =>
                      onChange(
                        serializeChecklist(setItemStatus(model, index, cycleStatus(line.status)))
                      )
                    }
                    className={`zad-checklist__status zad-checklist__status--${line.status}`}
                  >
                    {GLYPH[line.status]}
                  </button>
                  <span className="zad-checklist__label">{line.text}</span>
                </div>
                <textarea
                  rows={1}
                  value={itemComment(line)}
                  placeholder={t("tasks:tasksChecklistCommentPlaceholder")}
                  onChange={(e) =>
                    onChange(serializeChecklist(setItemComment(model, index, e.target.value)))
                  }
                  className="zad-checklist__comment"
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
```

Uwaga: `t(...)` z interpolacją (`tasksChecklistCounter`) działa jak `tasksShowMore` (`t("tasks:tasksShowMore", { count })`). Test „Zwykła notatka” sprawdza label „Notatka” bez punktów: ten sam `id="task-detail-note"`.

- [ ] **Krok 4: Podmień pole w `TaskDetailContent.tsx`**: usuń cały blok `<div className="zad-field">…task-detail-note…</div>` i wstaw

```tsx
<TaskChecklist
  title={draft.values.title.trim() || task.title}
  value={draft.values.description}
  onChange={(next) => draft.setField("description", next)}
/>
```

oraz `import { TaskChecklist } from "./TaskChecklist";`. Zmiana statusu punktu to zwykła zmiana `description` (autozapis po 1,5 s; modal pokazuje „Zapisano”).

- [ ] **Krok 5: CSS** (`tasks.css`, na końcu bloku modala)

```css
.zad-checklist {
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
}

.zad-checklist__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s-2);
}

.zad-checklist__counter {
  font: 600 var(--fs-xs) / 1 var(--font-mono);
  color: var(--accent-text);
}

.zad-checklist__tools {
  margin-left: auto;
  display: flex;
  gap: var(--s-1);
}

.zad-btn--active {
  background: var(--accent-soft);
  border-color: var(--accent);
}

.zad-checklist__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
}

.zad-checklist__text {
  font-size: var(--fs-sm);
  color: var(--muted);
  white-space: pre-wrap;
}

.zad-checklist__row {
  display: flex;
  align-items: flex-start;
  gap: var(--s-2);
}

.zad-checklist__label {
  font-size: var(--fs-sm);
  line-height: 1.4;
}

.zad-checklist__status {
  flex: none;
  width: 1.75rem;
  height: 1.75rem;
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  background: var(--surface-2);
  color: var(--muted);
  font: 700 var(--fs-md) / 1 var(--font-mono);
  cursor: pointer;
}

.zad-checklist__status--pass {
  color: var(--ok);
  border-color: var(--ok);
}

.zad-checklist__status--fail {
  color: var(--danger);
  border-color: var(--danger);
}

.zad-checklist__comment {
  display: block;
  width: calc(100% - 2.25rem);
  margin: var(--s-1) 0 0 2.25rem;
  min-height: 1.75rem;
  resize: vertical;
  padding: 4px var(--s-2);
  background: transparent;
  border: 1px dashed var(--line);
  border-radius: var(--r-sm);
  color: var(--text);
  font: 400 var(--fs-xs) / 1.4 var(--font-body);
}
```

- [ ] **Krok 6: Uruchom** (cursor): `npx vitest run tests/unit/features/tasks/` oraz `npx tsc --noEmit` i `npm run lint` → przechodzi.

- [ ] **Krok 7: Commit**

```bash
git add src/features/tasks tests/unit/features/tasks src/i18n/locales
git commit -m "feat(tasks): checklista PASS/FAIL w opisie zadania, kopiowanie jako Markdown

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Zadanie 5: opis zadania „Testy Manualne CG” jako checklista (+ punkt kontrolny)

Dane użytkownika w vaulcie (`../NEXUS/Vault/Tasks/tasks.md`, linia 44, id `p6QsMBjfPq3fXsILVnpN`). Zmiana robiona **przez aplikację/API** (nie ręczną edycją pliku: ręczny `]` bez ucieczki psuje `task-line.ts`). Spec D9: tylko `Vault/Tasks/tasks.md`.

- [ ] **Krok 1: Uruchom aplikację** (`npm run dev`, skill `run`) i znajdź sposób zapisu. Jeśli API wymaga sesji, której agent nie ma: **nie obchodzić uwierzytelniania**, tylko przejść na krok 3 (użytkownik wkleja tekst w panelu Notatka, w trybie Tekst).
- [ ] **Krok 2: Zapis przez API** (tylko gdy krok 1 pozwala): `PUT /api/tasks/p6QsMBjfPq3fXsILVnpN` z `{ "description": <tekst poniżej> }`. Najpierw `GET /api/tasks`, zapisz obecny `description` do pliku w scratchpadzie jako kopię zapasową.

Tekst `description` (ten sam, co fixture round-trip w zadaniu 1, bez zmiany treści merytorycznej):

```
MB — plan testu stagingu na 17.11 jest na main: docs/qa/tb/plany/2026-11-17-plan-testu-stagingu-przed-kampania-TB.md. Testy 8:30–11:30, werdykt GO/NO-GO o 12:00. Twoja część to Safari na iPhonie i iPadzie, na własnym koncie testowym. Przy FAIL proszę o zrzut bez danych osobowych i krótki opis (kroki, oczekiwany, rzeczywisty). Wgrywamy tylko zmyślone CV z cv-testowe/. Wyniki zbieram ja, wpiszę je do planu.
- [ ] T-01: pobieranie PDF z generatora CV (iPhone i iPad)
- [ ] T-02: CV między kontami w tej samej karcie
- [ ] T-04d: nazwa firmy w „Język CV” po angielsku zostaje nieprzetłumaczona
- [ ] T-06 C i E (zapis profilu, #1468)
  - [ ] zaimportuj CV 1 z docs/qa/tb/plany/cv-testowe/ i kliknij „Zastosuj do formularza”, bez zapisu
  - [ ] przeładuj stronę albo zamknij kartę i zapisz, czy Safari pokazuje okno o niezapisanych zmianach
  - [ ] sprawdź pasek na dole i toasty: czy coś zasłania przyciski (zrzut)
  - [ ] wyjdź przez menu → „Porzuć zmiany i wyjdź”
- [ ] T-08: około 600 znaków w „Obowiązki” na telefonie
- [ ] T-09: polskie etykiety dopasowania
- [ ] R-01 (regresja)
- [ ] R-03 (regresja)
- [ ] R-05 (regresja)
```

- [ ] **Krok 3: Weryfikacja:** zadanie wczytuje się po przeładowaniu (nie znika z tablicy, czyli linia w `tasks.md` poprawnie ucieczkowana), dwuklik pokazuje listę z licznikiem „PASS 0 · FAIL 0 · pozostało 13”, odhaczenie punktu zapisuje się („Zapisano”), „Kopiuj jako Markdown” daje poprawny tekst. `git -C ../NEXUS status --short` pokazuje zmianę tylko w `Vault/Tasks/tasks.md`. Timer `nexus-sync` wypchnie zmianę (pamięć `nexus-push-automatycznie`: pusty commit = timer był szybszy).
- [ ] **Krok 4: Punkt kontrolny (linia cięcia).** Pełny przebieg: `npx vitest run`, `npx tsc --noEmit`, `npm run lint` (cursor). Review agy (`--role review --fresh`, Hydrogen) całego diffa gałęzi względem `main`. Jeśli czas przed 8:30 17.11 jest krótki: `finishing-a-development-branch` (PR), reszta (zadania 6–8) w osobnym PR. Dalej tylko, gdy użytkownik zdecyduje o kontynuacji.

---

## Zadanie 6: `taskBoardLayout.ts` (czyste funkcje układu) + `useBoardLayout`

**Pliki:**

- Utwórz: `src/features/tasks/taskBoardLayout.ts`, `src/features/tasks/useBoardLayout.ts`
- Test: `tests/unit/features/tasks/taskBoardLayout.test.ts`

- [ ] **Krok 1: Test (czerwony)**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  loadLayout,
  saveLayout,
  clampHeight,
  effectiveCollapsed,
  boardColumns,
  LAYOUT_KEY,
  DEFAULT_LAYOUT,
} from "@/src/features/tasks/taskBoardLayout";

beforeEach(() => localStorage.clear());

describe("loadLayout", () => {
  it("brak wpisu i błędny JSON → domyślne", () => {
    expect(loadLayout()).toEqual(DEFAULT_LAYOUT);
    localStorage.setItem(LAYOUT_KEY, "{nie json");
    expect(loadLayout()).toEqual(DEFAULT_LAYOUT);
  });

  it("wysokość przycinana do 80–1200, nieznane statusy pominięte", () => {
    localStorage.setItem(
      LAYOUT_KEY,
      JSON.stringify({
        collapsed: { done: true, nieznany: true },
        heights: { todo: 5, done: 5000, deferred: 300, xx: 400 },
      })
    );
    expect(loadLayout()).toEqual({
      collapsed: { done: true },
      heights: { todo: 80, done: 1200, deferred: 300 },
    });
  });

  it("wartości o złym typie są pomijane", () => {
    localStorage.setItem(
      LAYOUT_KEY,
      JSON.stringify({ collapsed: { todo: "tak" }, heights: { todo: "wysoko", done: NaN } })
    );
    expect(loadLayout()).toEqual(DEFAULT_LAYOUT);
  });

  it("zablokowany magazyn → domyślne, zapis nie rzuca", () => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error("blocked");
    };
    try {
      expect(loadLayout()).toEqual(DEFAULT_LAYOUT);
    } finally {
      Storage.prototype.getItem = original;
    }
  });
});

describe("saveLayout", () => {
  it("round-trip", () => {
    saveLayout({ collapsed: { todo: true }, heights: { done: 400 } });
    expect(loadLayout()).toEqual({ collapsed: { todo: true }, heights: { done: 400 } });
  });
});

describe("clampHeight", () => {
  it("przycina i zaokrągla", () => {
    expect(clampHeight(5)).toBe(80);
    expect(clampHeight(5000)).toBe(1200);
    expect(clampHeight(300.6)).toBe(301);
  });
});

describe("effectiveCollapsed", () => {
  it("tryb roboczy: Zrobione domyślnie zwinięte, o ile brak własnego ustawienia", () => {
    expect(effectiveCollapsed(DEFAULT_LAYOUT, "work").done).toBe(true);
    expect(effectiveCollapsed(DEFAULT_LAYOUT, "normal").done).toBe(false);
    expect(effectiveCollapsed({ collapsed: { done: false }, heights: {} }, "work").done).toBe(
      false
    );
  });
});

describe("boardColumns", () => {
  const none = effectiveCollapsed({ collapsed: { done: false }, heights: {} }, "work");
  it("tryb normalny: 5 kolumn, zwinięta = 3rem", () => {
    const all = effectiveCollapsed(DEFAULT_LAYOUT, "normal");
    expect(boardColumns("normal", all)).toBe("1fr 1fr 1fr 1fr 1fr");
    expect(boardColumns("normal", { ...all, todo: true, done: true })).toBe(
      "1fr 3rem 1fr 1fr 3rem"
    );
  });
  it("tryb roboczy: todo | stos | panel 2fr | done", () => {
    expect(boardColumns("work", none)).toBe("1fr 1fr 2fr 1fr");
    expect(boardColumns("work", effectiveCollapsed(DEFAULT_LAYOUT, "work"))).toBe(
      "1fr 1fr 2fr 3rem"
    );
    expect(boardColumns("work", { ...none, todo: true })).toBe("3rem 1fr 2fr 1fr");
  });
});
```

Kolejność kolumn w trybie normalnym to `deferred todo in_progress to_review done`.

Run (cursor): `npx vitest run tests/unit/features/tasks/taskBoardLayout.test.ts` → FAIL.

- [ ] **Krok 2: `taskBoardLayout.ts`**

```ts
import { TASK_STATUSES, type TaskStatus } from "./taskOrderUtils";

export const LAYOUT_KEY = "zad-board-layout-v1";
export const MIN_LIST_HEIGHT = 80;
export const MAX_LIST_HEIGHT = 1200;
export const COLLAPSED_TRACK = "3rem";

export type BoardMode = "normal" | "work";

export interface BoardLayout {
  /** Brak klucza = brak własnego ustawienia (decyduje domyślne dla trybu). */
  collapsed: Partial<Record<TaskStatus, boolean>>;
  /** Własna wysokość listy kart w px; brak klucza = automatyczna. */
  heights: Partial<Record<TaskStatus, number>>;
}

export const DEFAULT_LAYOUT: BoardLayout = { collapsed: {}, heights: {} };

export function clampHeight(px: number): number {
  return Math.min(MAX_LIST_HEIGHT, Math.max(MIN_LIST_HEIGHT, Math.round(px)));
}

const isStatus = (key: string): key is TaskStatus => (TASK_STATUSES as string[]).includes(key);

export function loadLayout(): BoardLayout {
  if (typeof window === "undefined") return DEFAULT_LAYOUT;
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw) as {
      collapsed?: Record<string, unknown>;
      heights?: Record<string, unknown>;
    };
    const collapsed: BoardLayout["collapsed"] = {};
    for (const [key, value] of Object.entries(parsed?.collapsed ?? {})) {
      if (isStatus(key) && typeof value === "boolean") collapsed[key] = value;
    }
    const heights: BoardLayout["heights"] = {};
    for (const [key, value] of Object.entries(parsed?.heights ?? {})) {
      if (isStatus(key) && typeof value === "number" && Number.isFinite(value)) {
        heights[key] = clampHeight(value);
      }
    }
    return { collapsed, heights };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export function saveLayout(layout: BoardLayout): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
  } catch {
    // zapamiętanie układu jest dodatkiem; zablokowany magazyn nie może psuć tablicy
  }
}

/** Stan zwinięcia każdej kolumny: własne ustawienie, a bez niego domyślne (tryb roboczy zwija Zrobione). */
export function effectiveCollapsed(
  layout: BoardLayout,
  mode: BoardMode
): Record<TaskStatus, boolean> {
  const result = {} as Record<TaskStatus, boolean>;
  for (const status of TASK_STATUSES) {
    result[status] = layout.collapsed[status] ?? (mode === "work" && status === "done");
  }
  return result;
}

/** Szablon `grid-template-columns`. Tryb roboczy: todo | stos (deferred, in_progress, to_review) | panel | done. */
export function boardColumns(mode: BoardMode, collapsed: Record<TaskStatus, boolean>): string {
  const track = (status: TaskStatus) => (collapsed[status] ? COLLAPSED_TRACK : "1fr");
  if (mode === "work") return [track("todo"), "1fr", "2fr", track("done")].join(" ");
  return TASK_STATUSES.map(track).join(" ");
}
```

- [ ] **Krok 3: `useBoardLayout.ts`**

```ts
import { useCallback, useEffect, useState } from "react";
import type { TaskStatus } from "./taskOrderUtils";
import {
  DEFAULT_LAYOUT,
  clampHeight,
  loadLayout,
  saveLayout,
  type BoardLayout,
} from "./taskBoardLayout";

/** Układ tablicy zapamiętany w localStorage; ładowany po montażu (bez rozjazdu hydracji). */
export function useBoardLayout() {
  const [layout, setLayout] = useState<BoardLayout>(DEFAULT_LAYOUT);

  useEffect(() => {
    setLayout(loadLayout());
  }, []);

  const update = useCallback((fn: (prev: BoardLayout) => BoardLayout) => {
    setLayout((prev) => {
      const next = fn(prev);
      saveLayout(next);
      return next;
    });
  }, []);

  const setCollapsed = useCallback(
    (status: TaskStatus, collapsed: boolean) =>
      update((prev) => ({ ...prev, collapsed: { ...prev.collapsed, [status]: collapsed } })),
    [update]
  );

  /** `null` przywraca automatyczną wysokość. */
  const setHeight = useCallback(
    (status: TaskStatus, px: number | null) =>
      update((prev) => {
        const heights = { ...prev.heights };
        if (px === null) delete heights[status];
        else heights[status] = clampHeight(px);
        return { ...prev, heights };
      }),
    [update]
  );

  return { layout, setCollapsed, setHeight };
}
```

- [ ] **Krok 4: Uruchom** (cursor): test layoutu + `npx tsc --noEmit` → przechodzi.
- [ ] **Krok 5: Commit** `feat(tasks): układ tablicy w localStorage (zwijanie, wysokość, szablon kolumn)`.

---

## Zadanie 7: stos kolumn i panel roboczy 2fr (od 1024 px)

**Pliki:**

- Utwórz: `src/features/tasks/useMinWidth.ts`, `src/features/tasks/TaskWorkPanel.tsx`
- Zmień: `src/features/tasks/TasksSection.tsx`, `src/features/tasks/tasks.css`, i18n
- Test: `tests/unit/features/tasks/TasksSection.panel.test.tsx`

- [ ] **Krok 1: i18n:** `pl`: `tasksPanelAria: "Panel zadania"`; `en`: `tasksPanelAria: "Task panel"`.

- [ ] **Krok 2: Test (czerwony).** Plik `TasksSection.panel.test.tsx` kopiuje mock `apiFetch` z `TasksSection.test.tsx` (dwa zadania Alpha/Beta w `todo`, `/api/projects` → `{ projects: [] }`, `/api/task-templates` → `[]`, reszta `{ ok: true, json: async () => ({}) }`) i dodaje stub szerokości:

```tsx
function stubWidth(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  cleanup();
  // @ts-expect-error sprzątanie stubu
  delete window.matchMedia;
});

test("od 1024 px dwuklik otwiera panel, nie modal", async () => {
  stubWidth(true);
  render(<TasksSection apiFetch={apiFetch} />);
  fireEvent.doubleClick(await screen.findByText("Alpha"));
  expect(await screen.findByRole("complementary", { name: "Panel zadania" })).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("poniżej 1024 px dwuklik otwiera modal", async () => {
  stubWidth(false);
  render(<TasksSection apiFetch={apiFetch} />);
  fireEvent.doubleClick(await screen.findByText("Alpha"));
  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
});

test("dwuklik innej karty przełącza panel i zapisuje poprzednią zmianę (flush)", async () => {
  stubWidth(true);
  render(<TasksSection apiFetch={apiFetch} />);
  fireEvent.doubleClick(await screen.findByText("Alpha"));
  const panel = await screen.findByRole("complementary", { name: "Panel zadania" });
  fireEvent.change(within(panel).getByLabelText("Notatka"), { target: { value: "zmiana" } });
  fireEvent.doubleClick(screen.getAllByText("Beta")[0]);
  await waitFor(() =>
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/tasks/a",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ description: "zmiana" }) })
    )
  );
  expect(within(screen.getByRole("complementary")).getByDisplayValue("Beta")).toBeInTheDocument();
});

test("w trybie roboczym Odłożone, W toku i Do sprawdzenia są w jednym stosie, a Zrobione zwinięte", async () => {
  stubWidth(true);
  const { container } = render(<TasksSection apiFetch={apiFetch} />);
  fireEvent.doubleClick(await screen.findByText("Alpha"));
  await screen.findByRole("complementary");
  const stack = container.querySelector(".zad-stack");
  expect(stack).not.toBeNull();
  expect(stack!.querySelectorAll(".zad-column")).toHaveLength(3);
  expect(container.querySelector(".zad-board")).toHaveStyle({
    "--zad-cols": "1fr 1fr 2fr 3rem",
  });
});

test("przycisk Zamknij zamyka panel", async () => {
  stubWidth(true);
  render(<TasksSection apiFetch={apiFetch} />);
  fireEvent.doubleClick(await screen.findByText("Alpha"));
  const panel = await screen.findByRole("complementary", { name: "Panel zadania" });
  fireEvent.click(within(panel).getAllByRole("button", { name: "Zamknij" })[0]);
  expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
});
```

(Id zadań w mocku: Alpha = `a`, jak w istniejącym teście.) Run (cursor) → FAIL.

- [ ] **Krok 3: `useMinWidth.ts`**

```ts
import { useEffect, useState } from "react";

/** `true`, gdy okno ma co najmniej `px` szerokości; bez `matchMedia` (SSR, jsdom) `false`. */
export function useMinWidth(px: number): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(`(min-width: ${px}px)`);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [px]);
  return matches;
}
```

- [ ] **Krok 4: `TaskWorkPanel.tsx`**

```tsx
import React from "react";
import { X } from "lucide-react";
import type { Task } from "./TasksSection";
import { useT } from "@/src/i18n/useT";
import { TaskDetailContent } from "./TaskDetailContent";
import type { TaskPatch } from "./useTasksBoard";

interface Props {
  task: Task;
  projects: { id: string; name: string }[];
  onClose: () => void;
  onPatch: (taskId: string, patch: TaskPatch) => Promise<void>;
}

/** Panel roboczy zadania w siatce tablicy (od 1024 px); ta sama treść co modal. */
export function TaskWorkPanel({ task, projects, onClose, onPatch }: Props) {
  const t = useT();
  const closeLabel = t("tasks:tasksDetailClose");
  return (
    <aside
      className="zad-work-panel"
      aria-label={t("tasks:tasksPanelAria")}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="zad-work-panel__head">
        <h3 className="zad-modal__title">{t("tasks:tasksDetailModalTitle")}</h3>
        <button
          type="button"
          onClick={onClose}
          className="zad-btn zad-btn--ghost zad-btn--sm"
          aria-label={closeLabel}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="zad-work-panel__body">
        <TaskDetailContent key={task.id} task={task} projects={projects} onPatch={onPatch} />
      </div>
    </aside>
  );
}
```

(Panel nie ma własnego `<div className="zad-modal">`, więc zmienne kolorów modala nie obowiązują: panel dziedziczy motyw `.zad`.)

- [ ] **Krok 5: `TasksSection.tsx`**

Importy: `import { TaskWorkPanel } from "./TaskWorkPanel";`, `import { useMinWidth } from "./useMinWidth";`, `import { useBoardLayout } from "./useBoardLayout";`, `import { boardColumns, effectiveCollapsed } from "./taskBoardLayout";`.

Pod `useTasksBoard(...)`:

```tsx
const wide = useMinWidth(1024);
const detailTask = detailTaskId ? (tasks.find((x) => x.id === detailTaskId) ?? null) : null;
const panelOpen = wide && detailTask !== null;
const mode = panelOpen ? "work" : "normal";
const { layout } = useBoardLayout();
const collapsedMap = effectiveCollapsed(layout, mode);
```

Wydziel render kolumny do lokalnej funkcji `renderColumn(status: TaskStatus)` (zawartość dotychczasowego `TASK_STATUSES.map(...)` bez zmian), a blok tablicy zamień na:

```tsx
<div
  className="zad-board"
  style={{ "--zad-cols": boardColumns(mode, collapsedMap) } as React.CSSProperties}
>
  {mode === "normal" ? (
    TASK_STATUSES.map(renderColumn)
  ) : (
    <>
      {renderColumn("todo")}
      <div className="zad-stack">
        {(["deferred", "in_progress", "to_review"] as const).map(renderColumn)}
      </div>
      {detailTask ? (
        <TaskWorkPanel
          task={detailTask}
          projects={projects}
          onClose={() => setDetailTaskId(null)}
          onPatch={saveTaskPatch}
        />
      ) : null}
      {renderColumn("done")}
    </>
  )}
</div>
```

Modal: `isOpen={detailTaskId !== null && !wide}`, `task={detailTask}`, `onPatch={saveTaskPatch}`.

`renderColumn` używa `status` jako `key` (`key={status}` w TaskColumn zostaje). Zbiór statusów w `map` przekazuje `(status, index, array)`: `renderColumn` przyjmuje tylko `status`, więc `TASK_STATUSES.map(renderColumn)` jest bezpieczne, ale dla przejrzystości użyj `.map((s) => renderColumn(s))`.

- [ ] **Krok 6: CSS** (`tasks.css`). W istniejącym bloku `@media (min-width: 1024px) { .zad-board { … } }` zamień regułę na:

```css
@media (min-width: 1024px) {
  .zad-board {
    grid-template-columns: var(--zad-cols, repeat(5, minmax(0, 1fr)));
  }
}
```

Dodaj:

```css
.zad-stack {
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
  min-width: 0;
}

.zad-work-panel {
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--accent);
  border-radius: var(--r-md);
  max-height: calc(100vh - 8rem);
  overflow: hidden;
}

.zad-work-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--s-3) var(--s-4);
  border-bottom: 1px solid var(--line);
}

.zad-work-panel__body {
  padding: var(--s-4);
  display: flex;
  flex-direction: column;
  gap: var(--s-4);
  overflow-y: auto;
}
```

- [ ] **Krok 7: Uruchom** (cursor): `npx vitest run tests/unit/features/tasks/`, tsc, lint → przechodzi. Sprawdź w przeglądarce (skill `run`): ≥ 1024 px dwuklik otwiera panel, < 1024 px modal. (Pamięć `powiadomienia-review-request-odlozone`: układ Kokpitu nie był sprawdzany w przeglądarce, więc tu sprawdzam ręcznie.)
- [ ] **Krok 8: Commit** `feat(tasks): panel roboczy zadania i stos kolumn od 1024 px`.

---

## Zadanie 8: zwijanie kolumn i regulowana wysokość listy

**Pliki:**

- Zmień: `src/features/tasks/TaskColumn.tsx`, `src/features/tasks/TasksSection.tsx`, `tasks.css`, i18n
- Test: `tests/unit/features/tasks/TaskColumn.test.tsx`

- [ ] **Krok 1: i18n:** `pl`: `tasksColumnCollapse: "Zwiń kolumnę", tasksColumnExpand: "Rozwiń kolumnę", tasksColumnResetHeight: "Przywróć automatyczną wysokość"`; `en`: `"Collapse column"`, `"Expand column"`, `"Reset to automatic height"`.

- [ ] **Krok 2: Test (czerwony)** `TaskColumn.test.tsx`

```tsx
import React from "react";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, afterEach } from "vitest";
import { TaskColumn } from "@/src/features/tasks/TaskColumn";

afterEach(cleanup);

const task = {
  id: "a",
  title: "Alpha",
  link: "",
  description: "",
  status: "todo" as const,
  due_date: null,
  priority: null,
  order: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

function props(over: Partial<React.ComponentProps<typeof TaskColumn>> = {}) {
  const noop = vi.fn();
  return {
    status: "todo" as const,
    title: "Do zrobienia",
    tasks: [task],
    collapseEnabled: true,
    isDragOverColumn: false,
    dragTaskId: null,
    dragOverTaskId: null,
    draggable: true,
    editingId: null,
    editTitle: "",
    labels: {
      startDateLabel: "Start",
      deadlineLabel: "Do",
      showMore: () => "więcej",
      showLess: "mniej",
    },
    projectsById: new Map(),
    formatDate: () => "",
    onColumnDragOver: noop,
    onColumnDrop: noop,
    onDragStart: noop,
    onDragOverTask: noop,
    onDragEnd: noop,
    onDropOnTask: noop,
    onTitleAreaClick: noop,
    onTitleAreaDoubleClick: noop,
    onEditTitleChange: noop,
    onEditTitleCommit: noop,
    onEditTitleCancel: noop,
    onDueDateChange: noop,
    onToggleEnergy: noop,
    onToggleUrgent: noop,
    now: new Date(),
    onDelete: noop,
    columnCollapsed: false,
    onToggleColumn: vi.fn(),
    listHeight: undefined,
    onListHeightChange: vi.fn(),
    ...over,
  };
}

describe("TaskColumn: zwijanie i wysokość", () => {
  it("przycisk zwijania woła onToggleColumn(status, true)", () => {
    const p = props();
    render(<TaskColumn {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Zwiń kolumnę" }));
    expect(p.onToggleColumn).toHaveBeenCalledWith("todo", true);
  });

  it("zwinięta kolumna pokazuje nazwę i liczbę, chowa karty i oferuje rozwinięcie", () => {
    const p = props({ columnCollapsed: true });
    render(<TaskColumn {...p} />);
    expect(screen.getByText("Do zrobienia")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Rozwiń kolumnę" }));
    expect(p.onToggleColumn).toHaveBeenCalledWith("todo", false);
  });

  it("zwinięta kolumna nadal przyjmuje upuszczenie", () => {
    const p = props({ columnCollapsed: true });
    const { container } = render(<TaskColumn {...p} />);
    fireEvent.drop(container.querySelector(".zad-column")!);
    expect(p.onColumnDrop).toHaveBeenCalledWith("todo");
  });

  it("własna wysokość listy ustawia style.height, a ↺ przywraca automatyczną", () => {
    const p = props({ listHeight: 300 });
    const { container } = render(<TaskColumn {...p} />);
    expect(container.querySelector(".zad-column__list")).toHaveStyle({ height: "300px" });
    fireEvent.click(screen.getByRole("button", { name: "Przywróć automatyczną wysokość" }));
    expect(p.onListHeightChange).toHaveBeenCalledWith("todo", null);
  });

  it("bez własnej wysokości nie ma przycisku ↺", () => {
    render(<TaskColumn {...props()} />);
    expect(
      screen.queryByRole("button", { name: "Przywróć automatyczną wysokość" })
    ).not.toBeInTheDocument();
  });
});
```

Run (cursor) → FAIL.

- [ ] **Krok 3: `TaskColumn.tsx`.** Do `TaskColumnProps` dodaj:

```ts
  /** Kolumna zwinięta do paska (poziomo) lub samego nagłówka (w stosie). */
  columnCollapsed: boolean;
  /** Kolumna w stosie trybu roboczego: zwija się w pionie. */
  stacked?: boolean;
  onToggleColumn: (status: TaskStatus, collapsed: boolean) => void;
  /** Własna wysokość listy kart w px; `undefined` = automatyczna. */
  listHeight: number | undefined;
  onListHeightChange: (status: TaskStatus, px: number | null) => void;
```

Importy: `useEffect, useRef` z Reacta; `ChevronLeft, ChevronRight, RotateCcw` z lucide-react; `useT` z `@/src/i18n/useT`; `clampHeight` z `./taskBoardLayout`.

W komponencie (po `useState(false)`):

```tsx
const t = useT();
const listRef = useRef<HTMLUListElement>(null);
const heightRef = useRef(listHeight);
heightRef.current = listHeight;

// użytkownik ciągnie uchwyt `resize: vertical`: przeglądarka ustawia inline `height`;
// zapisujemy po 300 ms ciszy. Zmiany wysokości od samej treści (bez inline height) ignorujemy.
useEffect(() => {
  const el = listRef.current;
  if (!el || typeof ResizeObserver === "undefined") return;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const observer = new ResizeObserver(() => {
    if (!el.style.height) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      const px = clampHeight(el.getBoundingClientRect().height);
      if (px !== heightRef.current) onListHeightChange(status, px);
    }, 300);
  });
  observer.observe(el);
  return () => {
    observer.disconnect();
    if (timer) clearTimeout(timer);
  };
}, [status, onListHeightChange, columnCollapsed]);
```

Kolumna: do `className` dodaj `columnCollapsed ? "zad-column--collapsed" : ""` i `stacked ? "zad-column--stacked" : ""`. Nagłówek:

```tsx
<h3 className="zad-column__title">
  <span className={`zad-dot zad-dot--${status}`} aria-hidden="true" />
  <span className="zad-column__title-text">{title}</span>
  <span className="zad-column__count">{tasks.length}</span>
  {listHeight !== undefined && !columnCollapsed ? (
    <button
      type="button"
      className="zad-btn zad-btn--ghost zad-btn--sm zad-column__tool"
      aria-label={t("tasks:tasksColumnResetHeight")}
      onClick={() => onListHeightChange(status, null)}
    >
      <RotateCcw className="w-3 h-3" aria-hidden />
    </button>
  ) : null}
  <button
    type="button"
    className="zad-btn zad-btn--ghost zad-btn--sm zad-column__tool"
    aria-label={columnCollapsed ? t("tasks:tasksColumnExpand") : t("tasks:tasksColumnCollapse")}
    aria-expanded={!columnCollapsed}
    onClick={() => onToggleColumn(status, !columnCollapsed)}
  >
    {stacked ? (
      columnCollapsed ? (
        <ChevronDown className="w-3 h-3" aria-hidden />
      ) : (
        <ChevronUp className="w-3 h-3" aria-hidden />
      )
    ) : columnCollapsed ? (
      <ChevronRight className="w-3 h-3" aria-hidden />
    ) : (
      <ChevronLeft className="w-3 h-3" aria-hidden />
    )}
  </button>
</h3>;
{
  columnCollapsed ? null : (
    <ul
      ref={listRef}
      className={["zad-column__list", listHeight !== undefined ? "zad-column__list--sized" : ""]
        .filter(Boolean)
        .join(" ")}
      style={listHeight !== undefined ? { height: `${listHeight}px` } : undefined}
    >
      {/* dotychczasowe TaskCard */}
    </ul>
  );
}
```

Przyciski „Pokaż więcej/mniej” renderuj tylko gdy `!columnCollapsed`. Root `div` zostaje z `onDragOver`/`onDrop` (zwinięta kolumna nadal przyjmuje upuszczenie).

Gdy kolumna zwinięta, lista (z `ref`) nie istnieje, więc ResizeObserver w efekcie z zależnością `columnCollapsed` odpina się i podpina na nowo po rozwinięciu.

- [ ] **Krok 4: `TasksSection.tsx`.** Z `useBoardLayout()` weź też `setCollapsed, setHeight`. Do `renderColumn(status)` dołóż:

```tsx
                columnCollapsed={collapsedMap[status]}
                stacked={mode === "work" && status !== "todo" && status !== "done"}
                onToggleColumn={setCollapsed}
                listHeight={layout.heights[status]}
                onListHeightChange={setHeight}
```

(w stosie zwinięcie jest per kolumna; `collapsedMap` dla `deferred`, `in_progress`, `to_review` pochodzi z `layout.collapsed` bez domyślnego zwinięcia.)

- [ ] **Krok 5: CSS**

```css
.zad-column__tool {
  padding: 2px 4px;
  min-height: 0;
}

.zad-column__list {
  overflow: auto;
  resize: vertical;
}

.zad-column__list--sized {
  flex: 0 0 auto;
}

/* poniżej 1024 px zwinięcie chowa tylko karty (nagłówek zostaje) */
.zad-column--collapsed {
  min-height: 0;
}

@media (min-width: 1024px) {
  /* zwinięty pasek w poziomie: nazwa i liczba pionowo */
  .zad-column--collapsed:not(.zad-column--stacked) {
    min-height: 12rem;
    padding: var(--s-2);
    align-items: center;
  }
  .zad-column--collapsed:not(.zad-column--stacked) .zad-column__title {
    flex-direction: column;
    border-bottom: 0;
    margin: 0;
    padding: 0;
  }
  .zad-column--collapsed:not(.zad-column--stacked) .zad-column__title-text {
    writing-mode: vertical-rl;
    flex: 0 1 auto;
  }
}
```

Uwaga: `resize` nie działa na dotyku (spec §6): tam zostaje modal, brak wymagań.

- [ ] **Krok 6: Uruchom** (cursor): `npx vitest run tests/unit/features/tasks/`, tsc, lint → przechodzi. W przeglądarce: zwiń/rozwiń kolumnę, odśwież stronę (stan wraca z `localStorage`), pociągnij uchwyt wysokości, ↺ przywraca.
- [ ] **Krok 7: Review agy** (`--fresh`, Hydrogen): „Przejrzyj `git diff main...` dla TaskColumn.tsx, TasksSection.tsx, taskBoardLayout.ts, useBoardLayout.ts: ResizeObserver, pętle zapisu wysokości, upuszczanie na zwiniętą kolumnę, hydracja localStorage. Lista `plik:linia + problem`, max 15 linii.” Zweryfikuj w kodzie, napraw realne.
- [ ] **Krok 8: Commit** `feat(tasks): zwijanie kolumn i regulowana wysokość list z pamięcią w localStorage`.

---

## Zadanie 9: e2e, dokumentacja formatu, weryfikacja końcowa

**Pliki:**

- Zmień: `tests/e2e/tasks.spec.ts`, `docs/nexus-vault-formaty-yaml.md` (sekcja „Zadania: `Tasks/tasks.md`”, po linii o `desc`)
- Test architektury **nie** jest zmieniany.

- [ ] **Krok 1: e2e** (dopisz test do `describe("Task Management")`, w stylu istniejących; modal lub panel zależnie od szerokości viewportu Playwrighta, więc szukaj po roli):

```ts
test("odhacza punkt checklisty i widzi Zapisano", async ({ page }) => {
  const title = `E2E Checklist ${Date.now()}`;
  await page.getByPlaceholder(/nazwa zadania|task name/i).fill(title);
  await page.getByRole("button", { name: /^(Dodaj|Add)$/ }).click();
  await expect(page.getByText(title)).toBeVisible({ timeout: 10000 });

  await page.getByText(title).first().dblclick();
  const note = page.locator("#task-detail-note");
  await expect(note).toBeVisible({ timeout: 5000 });
  await note.fill("- [ ] T-01: pierwszy\n- [ ] T-02: drugi");

  await page.getByRole("button", { name: /^(Lista|List)$/ }).click();
  await page
    .getByRole("button", { name: /Do sprawdzenia|Unchecked/ })
    .first()
    .click();
  await expect(page.getByText(/^(Zapisano|Saved)$/)).toBeVisible({ timeout: 5000 });
});
```

Uwaga: przycisk „Lista” pojawia się dopiero gdy w opisie są punkty (po `fill` komponent przełącza się z samego pola na nagłówek z przełącznikiem; tryb po pierwszym renderze to `text`, więc klik „Lista” jest potrzebny).

Run (cursor): `npx playwright test tests/e2e/tasks.spec.ts` (jeśli środowisko e2e działa lokalnie; w przeciwnym razie zanotuj w opisie PR, że e2e nie uruchomiono).

- [ ] **Krok 2: Dokumentacja.** W `docs/nexus-vault-formaty-yaml.md`, w sekcji „Zadania: `Tasks/tasks.md`”, dopisz podpunkt (jedna lista, po opisie pola `desc`):

```md
- **Checklista testów w `desc`** (spec `2026-11-16-zadania-checklista-panel-design.md`): linie `- [ ] tekst` (do zrobienia), `- [x] tekst` (PASS), `- [!] tekst` (FAIL); wcięcie 2 spacji = podpunkt; linie `> uwaga` bezpośrednio pod punktem to jego komentarz. Reszta tekstu zostaje bez zmian. Aplikacja zapisuje `desc` ucieczkowany (`\n`, `\[`, `\]`), więc zmieniaj go przez aplikację/API, nie ręcznie w `tasks.md`.
```

- [ ] **Krok 3: Weryfikacja końcowa** (cursor, osobne polecenia): `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npm run build`. Wszystko „przeszło”. `git diff main --stat` potwierdza brak zmian w `contexts/`, `lib/nexus/`, `app/api/`, `tests/unit/architecture.static.test.ts`.
- [ ] **Krok 4: Review końcowy agy** (`--role review --fresh`, Hydrogen): cały `git diff main...HEAD` pod kątem spec §3–§6 (utrata danych, wyścigi, dostępność). Weryfikacja zgłoszeń w kodzie.
- [ ] **Krok 5: Commit** (`docs`/`test` osobno) i `finishing-a-development-branch` (PR do `main`; opis kończy się linią „🤖 Generated with [Claude Code](https://claude.com/claude-code)”). Push Monolitha tylko na prośbę użytkownika (pamięć `nexus-push-automatycznie`: auto-push dotyczy NEXUS, nie Monolitha).

---

## Samokontrola planu względem specu

| Wymaganie specu                                   | Zadanie                 |
| ------------------------------------------------- | ----------------------- |
| §3 format, parser, round-trip, eksport            | 1                       |
| D5/D8 autozapis 1,5 s, bez commitów, `flush()`    | 2, 3                    |
| §4 modal bez „Zapisz”, stan zapisu, błąd w UI     | 3                       |
| §4 lista punktów, komentarze, Lista/Tekst, kopiuj | 4                       |
| §7 krok 4: przepisanie „Testy Manualne CG”        | 5                       |
| D4/D6/D7/D8, `boardColumns`, `taskBoardLayout.ts` | 6                       |
| §4 panel 2fr, stos, ≥ 1024 px, modal poniżej      | 7                       |
| Zwijanie (poziomo/pionowo), ↺, `ResizeObserver`   | 8                       |
| §5 testy (checklista, draft, layout, komponenty)  | 1, 2, 3, 4, 6, 7, 8     |
| §5 e2e, dokumentacja formatu                      | 9                       |
| Limit `desc` w `bc_tasks`                         | sprawdzony: brak limitu |

Spójność nazw: `TaskPatch` (`useTasksBoard.ts`) ← `useTaskDraft`, `TaskDetailContent`, `TaskDetailModal`, `TaskWorkPanel`; `saveTaskPatch(id, patch)` ← `onPatch`; `columnCollapsed` / `onToggleColumn(status, collapsed)` / `listHeight` / `onListHeightChange(status, px|null)` w `TaskColumn` ← `TasksSection`; `effectiveCollapsed`, `boardColumns`, `clampHeight`, `LAYOUT_KEY`, `DEFAULT_LAYOUT` z `taskBoardLayout.ts` ← `useBoardLayout`.

Odstępstwa od specu (świadome): (1) spec mówi „klik zadania otwiera panel”, kod otwiera dwuklikiem, gest zostaje; (2) dodany `useBoardLayout.ts` i `useMinWidth.ts` (hooki poza listą specu, bo `taskBoardLayout.ts` ma zostać czysty); (3) `TaskDetailContent.tsx` jako wspólna treść modala i panelu (spec: „wydzielona wspólna treść”).
