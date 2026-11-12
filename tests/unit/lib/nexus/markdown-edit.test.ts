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
