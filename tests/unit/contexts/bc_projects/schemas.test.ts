// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  NOW_LIMIT as MODEL_NOW_LIMIT,
  PROJECT_TYPES,
  TASK_COLUMNS,
  type Project,
  type ProjectWithContent,
} from "@/contexts/bc_projects/models";
import {
  DevlogInputSchema,
  NOW_LIMIT,
  ProjectTypeInputSchema,
  ProjectTypeSchema,
  StateInputSchema,
  TaskColumnSchema,
  TaskOpInputSchema,
  toDetailDto,
  toSummaryDto,
} from "@/contexts/bc_projects/schemas";

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
  freshness: "fresh",
};

describe("bc_projects schemas", () => {
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
  });

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
    expect(dto.tasks).toEqual(full.tasks);
    expect(dto.bugs).toEqual(full.bugs);
  });
});

const HASH = "a".repeat(64);
const STATE_OK = {
  branch: "main",
  env: "local",
  blocker: "",
  nextStep: "krok",
  links: ["https://a"],
  milestone: "M",
  milestoneDue: "",
  version: null,
};

describe("bc_projects schemas: StateInputSchema", () => {
  it("poprawne dane: version null, milestoneDue pusty → undefined", () => {
    const r = StateInputSchema.safeParse(STATE_OK);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.version).toBeNull();
      expect(r.data.milestoneDue).toBeUndefined();
    }
  });

  it("milestoneDue można pominąć", () => {
    const { milestoneDue: _omit, ...rest } = STATE_OK;
    void _omit;
    expect(StateInputSchema.safeParse(rest).success).toBe(true);
  });

  it("version size:hash → obiekt", () => {
    const r = StateInputSchema.safeParse({ ...STATE_OK, version: `12:${HASH}` });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.version).toEqual({ size: 12, hash: HASH });
  });

  it("zła wersja", () => {
    expect(StateInputSchema.safeParse({ ...STATE_OK, version: "abc" }).success).toBe(false);
  });

  it.each([["javascript:alert(1)"], ["ftp://x"], ["x"]])("odrzuca link %s", (link) => {
    expect(StateInputSchema.safeParse({ ...STATE_OK, links: [link] }).success).toBe(false);
  });

  it("odrzuca 11 linków, przyjmuje 10", () => {
    const link = "https://ok.example";
    expect(StateInputSchema.safeParse({ ...STATE_OK, links: Array(11).fill(link) }).success).toBe(
      false
    );
    expect(StateInputSchema.safeParse({ ...STATE_OK, links: Array(10).fill(link) }).success).toBe(
      true
    );
  });

  it.each([
    ["2026-02-30", false],
    ["jutro", false],
    ["2026-12-01", true],
  ])("milestoneDue %s → %s", (value, ok) => {
    expect(StateInputSchema.safeParse({ ...STATE_OK, milestoneDue: value }).success).toBe(ok);
  });

  it("branch z nową linią i za długi", () => {
    expect(StateInputSchema.safeParse({ ...STATE_OK, branch: "a\nb" }).success).toBe(false);
    expect(StateInputSchema.safeParse({ ...STATE_OK, branch: "a".repeat(201) }).success).toBe(
      false
    );
    expect(StateInputSchema.safeParse({ ...STATE_OK, branch: "a".repeat(200) }).success).toBe(true);
  });
});

describe("bc_projects schemas: DevlogInputSchema", () => {
  it.each([["a\nb"], ["#x"], ["   "], ["a".repeat(201)]])("odrzuca title %j", (title) => {
    expect(DevlogInputSchema.safeParse({ title, why: "" }).success).toBe(false);
  });

  it.each([["a\n## x"], ["# x"], ["a".repeat(2001)]])("odrzuca why %j", (why) => {
    expect(DevlogInputSchema.safeParse({ title: "T", why }).success).toBe(false);
  });

  it("### i #hash w why są dozwolone; CRLF → LF", () => {
    const ok = DevlogInputSchema.safeParse({ title: "T", why: "a\n### x\n#hash" });
    expect(ok.success).toBe(true);
    const crlf = DevlogInputSchema.safeParse({ title: "T", why: "a\r\nb" });
    expect(crlf.success && crlf.data.why).toBe("a\nb");
  });

  it("title przycięty", () => {
    const r = DevlogInputSchema.safeParse({ title: "  T  ", why: "" });
    expect(r.success && r.data.title).toBe("T");
  });
});

describe("bc_projects schemas: type i DTO zapisu", () => {
  it("ProjectTypeInputSchema", () => {
    expect(ProjectTypeInputSchema.safeParse({ type: "etat" }).success).toBe(true);
    expect(ProjectTypeInputSchema.safeParse({ type: "firma" }).success).toBe(false);
  });

  it("lista typów zgodna z models", () => {
    expect([...ProjectTypeSchema.options]).toEqual([...PROJECT_TYPES]);
  });

  it("toSummaryDto przenosi type", () => {
    expect(toSummaryDto({ ...base, type: "wlasny" }).type).toBe("wlasny");
    expect("type" in toSummaryDto(base)).toBe(false);
  });

  it("toDetailDto: stateVersion jako size:hash, devlog ≤ 50, state bez notes i folder", () => {
    const devlog = Array.from({ length: 60 }, (_, i) => ({
      date: "2026-11-13",
      title: `T${i}`,
      why: "",
    }));
    const dto = toDetailDto({
      ...base,
      tasks: [],
      board: { blockers: [], now: [], next: [], icebox: [], version: null },
      bugs: [],
      state: {
        branch: "b",
        env: "",
        blocker: "",
        nextStep: "",
        links: [],
        milestone: "",
        notes: "tajne",
      },
      stateVersion: { size: 5, hash: "h" },
      devlog,
    });
    expect(dto.stateVersion).toBe("5:h");
    expect(dto.devlog).toHaveLength(50);
    expect(dto.devlog[0].title).toBe("T0");
    expect(dto.state).not.toBeNull();
    expect("notes" in (dto.state ?? {})).toBe(false);
    expect("folder" in dto).toBe(false);
  });

  it("toDetailDto bez stanu", () => {
    const dto = toDetailDto({
      ...base,
      tasks: [],
      board: { blockers: [], now: [], next: [], icebox: [], version: null },
      bugs: [],
      state: null,
      stateVersion: null,
      devlog: [],
    });
    expect(dto.state).toBeNull();
    expect(dto.stateVersion).toBeNull();
    expect(dto.devlog).toEqual([]);
  });
});

describe("bc_projects schemas: TaskOpInputSchema", () => {
  const V = `12:${HASH}`;
  const ref = { column: "next", index: 1, text: "Trzecie", version: V } as const;

  it("add z version null", () => {
    const r = TaskOpInputSchema.safeParse({
      op: "add",
      column: "next",
      text: "Nowe",
      version: null,
    });
    expect(r.success).toBe(true);
    if (r.success)
      expect(r.data).toEqual({ op: "add", column: "next", text: "Nowe", version: null });
  });

  it("toggle: version tekstowa zamieniona na { size, hash }", () => {
    const r = TaskOpInputSchema.safeParse({ op: "toggle", ...ref });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.version).toEqual({ size: 12, hash: HASH });
  });

  it("op z referencją wymaga wersji (null i brak odrzucone)", () => {
    for (const op of ["toggle", "remove"] as const) {
      expect(TaskOpInputSchema.safeParse({ op, ...ref, version: null }).success).toBe(false);
      const { version: _omit, ...noVersion } = ref;
      expect(TaskOpInputSchema.safeParse({ op, ...noVersion }).success).toBe(false);
    }
    expect(TaskOpInputSchema.safeParse({ op: "toggle", ...ref, version: "zła" }).success).toBe(
      false
    );
  });

  it.each([
    ["wiele linii", "linia1\nlinia2"],
    ["znacznik Teraz", "x [now::]"],
    ["końcowa data ukończenia", "x — 2026-05-19"],
    ["sam odstęp", "   "],
    ["za długi", "a".repeat(301)],
  ])("add: text odrzucony (%s)", (_label, text) => {
    expect(
      TaskOpInputSchema.safeParse({ op: "add", column: "next", text, version: null }).success
    ).toBe(false);
  });

  it("edit: newText z końcową datą odrzucony, a text referencyjny z datą dozwolony", () => {
    expect(
      TaskOpInputSchema.safeParse({ op: "edit", ...ref, newText: "x — 2026-05-19" }).success
    ).toBe(false);
    expect(
      TaskOpInputSchema.safeParse({
        op: "edit",
        ...ref,
        text: "Coś — 2026-05-19",
        newText: "Coś innego",
      }).success
    ).toBe(true);
  });

  it("move wymaga poprawnej kolumny docelowej", () => {
    expect(TaskOpInputSchema.safeParse({ op: "move", ...ref, to: "icebox" }).success).toBe(true);
    expect(TaskOpInputSchema.safeParse({ op: "move", ...ref, to: "inbox" }).success).toBe(false);
    expect(TaskOpInputSchema.safeParse({ op: "move", ...ref }).success).toBe(false);
  });

  it("index i kolumna: ujemny, ułamkowy i nieznana kolumna odrzucone", () => {
    expect(TaskOpInputSchema.safeParse({ op: "remove", ...ref, index: -1 }).success).toBe(false);
    expect(TaskOpInputSchema.safeParse({ op: "remove", ...ref, index: 1.5 }).success).toBe(false);
    expect(TaskOpInputSchema.safeParse({ op: "remove", ...ref, column: "inbox" }).success).toBe(
      false
    );
  });

  it("nieznana operacja odrzucona", () => {
    expect(TaskOpInputSchema.safeParse({ op: "zly", ...ref }).success).toBe(false);
  });

  it("lista kolumn zgodna z TASK_COLUMNS w models", () => {
    expect([...TaskColumnSchema.options]).toEqual([...TASK_COLUMNS]);
  });

  it("limit Teraz zgodny z NOW_LIMIT w models", () => {
    expect(NOW_LIMIT).toBe(MODEL_NOW_LIMIT);
  });
});

describe("bc_projects schemas: board w DTO", () => {
  const full = (version: { size: number; hash: string } | null): ProjectWithContent => ({
    ...base,
    tasks: [],
    bugs: [],
    board: {
      blockers: [{ text: "B", done: false }],
      now: [{ text: "N", done: false }],
      next: [{ text: "X", done: true, doneDate: "2026-11-13" }],
      icebox: [],
      version,
    },
    state: null,
    stateVersion: null,
    devlog: [],
  });

  it("version jako size:hash i kolumny przepisane", () => {
    const dto = toDetailDto(full({ size: 3, hash: "h" }));
    expect(dto.board).toEqual({
      blockers: [{ text: "B", done: false }],
      now: [{ text: "N", done: false }],
      next: [{ text: "X", done: true, doneDate: "2026-11-13" }],
      icebox: [],
      version: "3:h",
    });
  });

  it("brak pliku: version null", () => {
    expect(toDetailDto(full(null)).board.version).toBeNull();
  });
});
