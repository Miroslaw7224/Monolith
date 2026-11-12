// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TaskLine } from "@/lib/nexus/task-line";
import { buildPlan } from "@/scripts/import-to-vault/plan";
import type { Converted, PlanResult } from "@/scripts/import-to-vault/types";
import { verifyVault } from "@/scripts/import-to-vault/verify";
import { applyPlan, createVaultView } from "@/scripts/import-to-vault/write";

const SENTINEL = "SentynelTytulu";

function task(id: string, over: Partial<TaskLine> = {}): TaskLine {
  return {
    id,
    title: `Zadanie ${id}`,
    status: "todo",
    link: "",
    description: "",
    due_date: null,
    priority: null,
    order: null,
    created_at: null,
    updated_at: null,
    ...over,
  };
}

function expectedData(): Converted {
  return {
    notes: [
      {
        id: "n1",
        title: `${SENTINEL} pierwszy`,
        html: "<h1>Nagłówek</h1><p>Tekst <strong>gruby</strong></p>",
        created: "2026-05-01T10:00:00.000Z",
        updated: null,
        tags: ["a"],
      },
      {
        id: "n2",
        title: "Drugi",
        html: "<p>drugi</p>",
        created: "2026-05-02T10:00:00.000Z",
        updated: null,
        tags: [],
      },
    ],
    tasks: [
      task("t1", { status: "in_progress", order: 1, link: "https://x.y/?q=[1]", priority: 2 }),
      task("t2", { status: "done", order: 2, description: "linia 1\nlinia 2" }),
    ],
    resources: [
      {
        id: "r1",
        title: "Doc: cz. 1",
        url: "https://example.com/a::b",
        description: "",
        tags: ["a", "b: c"],
        favorite: true,
        created: "2026-06-01T08:00:00.000Z",
      },
    ],
    tags: [
      { id: "g1", tag: "pilne", title: "Pilne", color: "#ff0000" },
      { id: "g2", tag: "yes", title: "Tak" },
    ],
    templates: [{ id: "m1", label: "Szablon", title: "Tytuł: [x]", link: "" }],
    warnings: [],
  };
}

let dir: string;
let expected: Converted;
let plan: PlanResult;

const abs = (rel: string) => path.join(dir, rel);
const readRel = (rel: string) => fs.readFileSync(abs(rel), "utf8");
const writeRel = (rel: string, text: string) => {
  fs.mkdirSync(path.dirname(abs(rel)), { recursive: true });
  fs.writeFileSync(abs(rel), text);
};
const verify = () => verifyVault(expected, plan, createVaultView(dir));

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "verify-vault-"));
  expected = expectedData();
  plan = buildPlan(expected, createVaultView(dir));
  applyPlan(dir, plan.files);
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("verifyVault", () => {
  it("passes for an untouched import", () => {
    const result = verify();
    expect(result.problems).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.found).toEqual({
      notes: 2,
      tasks: 2,
      resources: 1,
      user_tags: 2,
      task_templates: 1,
    });
  });

  it("reports a deleted note file", () => {
    fs.rmSync(abs(plan.noteFiles.n2));
    const result = verify();
    expect(result.ok).toBe(false);
    expect(result.problems.some((p) => p.includes("brak notatki id=n2"))).toBe(true);
    expect(result.found.notes).toBe(1);
  });

  it("reports a changed title without leaking its value", () => {
    const rel = plan.noteFiles.n1;
    writeRel(rel, readRel(rel).replace(SENTINEL, "Zupelnie inny"));
    const result = verify();
    expect(result.ok).toBe(false);
    const problem = result.problems.find((p) => p.includes("niezgodne pola notatki id=n1"));
    expect(problem).toContain("title");
    expect(result.problems.join("\n")).not.toContain(SENTINEL);
    expect(result.problems.join("\n")).not.toContain("Zupelnie inny");
  });

  it("reports a changed html original", () => {
    writeRel("Notes/.html/n2.html", "<p>zmienione</p>");
    const result = verify();
    expect(result.ok).toBe(false);
    expect(result.problems).toContain("niezgodne pola notatki id=n2: html");
  });

  it("reports a missing html original", () => {
    fs.rmSync(abs("Notes/.html/n2.html"));
    const result = verify();
    expect(result.ok).toBe(false);
    expect(result.problems).toContain("niezgodne pola notatki id=n2: html");
  });

  it("reports a changed task status by field name", () => {
    const rel = plan.targets.tasks!;
    writeRel(rel, readRel(rel).replace("[status:: in_progress]", "[status:: to_review]"));
    const result = verify();
    expect(result.ok).toBe(false);
    expect(result.problems).toContain("niezgodne pola zadania id=t1: status");
  });

  it("reports a deleted task line", () => {
    const rel = plan.targets.tasks!;
    const kept = readRel(rel)
      .split("\n")
      .filter((line) => !line.includes("[id:: t2]"));
    writeRel(rel, kept.join("\n"));
    const result = verify();
    expect(result.ok).toBe(false);
    expect(result.problems).toContain("brak zadania id=t2");
    expect(result.found.tasks).toBe(1);
  });

  it("reports a duplicated task id", () => {
    const rel = plan.targets.tasks!;
    const line = readRel(rel)
      .split("\n")
      .find((l) => l.includes("[id:: t1]"))!;
    writeRel(rel, `${readRel(rel)}${line}\n`);
    const result = verify();
    expect(result.ok).toBe(false);
    expect(result.problems.some((p) => p.includes("zduplikowane id zadania t1"))).toBe(true);
  });

  it("reports a malformed task line with its line number", () => {
    const rel = plan.targets.tasks!;
    writeRel(rel, `${readRel(rel)}- [ ] zepsute [id:: x] [priority:: abc]\n`);
    const result = verify();
    expect(result.ok).toBe(false);
    expect(result.problems.some((p) => /linia \d+/.test(p))).toBe(true);
  });

  it("reports a deleted resources file", () => {
    fs.rmSync(abs("Resources/resources.yaml"));
    const result = verify();
    expect(result.ok).toBe(false);
    expect(result.problems).toContain("brak pliku Resources/resources.yaml");
    expect(result.found.resources).toBe(0);
  });

  it("reports a changed resource field by name", () => {
    const rel = plan.targets.resources!;
    writeRel(rel, readRel(rel).replace("favorite: true", "favorite: false"));
    const result = verify();
    expect(result.ok).toBe(false);
    expect(result.problems).toContain("niezgodne pola zasobu id=r1: favorite");
  });

  it("reports a missing tag and a missing template", () => {
    const tags = plan.targets.tags!;
    writeRel(tags, readRel(tags).replace(/- id: g2[\s\S]*$/, ""));
    fs.rmSync(abs(plan.targets.templates!));
    const result = verify();
    expect(result.ok).toBe(false);
    expect(result.problems).toContain("brak tagu id=g2");
    expect(result.problems).toContain("brak pliku Tasks/templates.yaml");
    expect(result.found.user_tags).toBe(1);
    expect(result.found.task_templates).toBe(0);
  });

  it("ignores a manual note with a foreign id", () => {
    writeRel("Notes/reczna.md", "---\nid: reczna-1\ntitle: Ręczna\n---\n\ntreść\n");
    const result = verify();
    expect(result.problems).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("reports the same note id in two files", () => {
    writeRel("Notes/kopia.md", readRel(plan.noteFiles.n1));
    const result = verify();
    expect(result.ok).toBe(false);
    expect(result.problems.some((p) => p.includes("zduplikowane id notatki n1"))).toBe(true);
  });

  it("keeps ok in sync with problems", () => {
    expect(verify().ok).toBe(verify().problems.length === 0);
    fs.rmSync(abs(plan.noteFiles.n1));
    const result = verify();
    expect(result.ok).toBe(result.problems.length === 0);
  });
});
