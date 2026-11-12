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
