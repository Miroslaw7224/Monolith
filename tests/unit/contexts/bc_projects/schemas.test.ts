// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  PROJECT_TYPES,
  type Project,
  type ProjectWithContent,
} from "@/contexts/bc_projects/models";
import {
  DevlogInputSchema,
  ProjectTypeInputSchema,
  ProjectTypeSchema,
  StateInputSchema,
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
