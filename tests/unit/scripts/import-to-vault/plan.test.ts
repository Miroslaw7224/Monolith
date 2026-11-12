// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseFrontmatter } from "@/lib/nexus/frontmatter";
import { parseTaskLines, type TaskLine } from "@/lib/nexus/task-line";
import { GENERATED_BY_IMPORT } from "@/lib/nexus/yaml-lists";
import { buildPlan } from "@/scripts/import-to-vault/plan";
import type { Converted, PlannedFile, VaultNote, VaultView } from "@/scripts/import-to-vault/types";

function memoryVault(files: Record<string, string> = {}): VaultView {
  return {
    read: (rel) => (rel in files ? files[rel] : null),
    list: (dir) => {
      const prefix = dir === "" ? "" : `${dir}/`;
      return Object.keys(files)
        .filter((p) => p.startsWith(prefix) && !p.slice(prefix.length).includes("/"))
        .map((p) => p.slice(prefix.length))
        .sort();
    },
  };
}

function viewOf(planned: PlannedFile[]): VaultView {
  const files: Record<string, string> = {};
  for (const f of planned) files[f.relPath] = f.content;
  return memoryVault(files);
}

function note(id: string, title: string, over: Partial<VaultNote> = {}): VaultNote {
  return {
    id,
    title,
    html: `<p>${title}</p>`,
    created: null,
    updated: null,
    tags: [],
    ...over,
  };
}

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

function converted(over: Partial<Converted> = {}): Converted {
  return { notes: [], tasks: [], resources: [], tags: [], templates: [], warnings: [], ...over };
}

function pathOf(plan: ReturnType<typeof buildPlan>, kind: string, relPath: string) {
  return plan.files.find((f) => f.kind === kind && f.relPath === relPath);
}

describe("buildPlan: notes", () => {
  it("allocates slug paths for new notes", () => {
    const plan = buildPlan(
      converted({
        notes: [
          note("n1", "Zażółć gęślą jaźń", { created: "2026-01-01T00:00:00Z" }),
          note("n2", "Duplikat", { created: "2026-02-01T00:00:00Z" }),
          note("n3", "Duplikat", { created: "2026-03-01T00:00:00Z" }),
          note("n4", "", { created: "2026-04-01T00:00:00Z" }),
        ],
      }),
      memoryVault()
    );
    expect(plan.noteFiles).toEqual({
      n1: "Notes/zazolc-gesla-jazn.md",
      n2: "Notes/duplikat.md",
      n3: "Notes/duplikat-2.md",
      n4: "Notes/bez-tytulu.md",
    });
    const notes = plan.files.filter((f) => f.kind === "note");
    expect(notes).toHaveLength(4);
    expect(plan.files.filter((f) => f.kind === "note-html")).toHaveLength(4);
    expect(plan.files.every((f) => f.action === "create")).toBe(true);
    expect(plan.warnings).toEqual([]);
    expect(pathOf(plan, "note-html", "Notes/.html/n1.html")?.content).toBe(
      "<p>Zażółć gęślą jaźń</p>"
    );
  });

  it("keeps the path of an existing note matched by id", () => {
    const first = buildPlan(converted({ notes: [note("n1", "Nowy tytuł")] }), memoryVault());
    const md = first.files.find((f) => f.kind === "note")!.content;
    const vault = memoryVault({ "Notes/stara-nazwa.md": md });
    const plan = buildPlan(converted({ notes: [note("n1", "Nowy tytuł")] }), vault);
    expect(plan.noteFiles.n1).toBe("Notes/stara-nazwa.md");
    const f = pathOf(plan, "note", "Notes/stara-nazwa.md");
    expect(f?.action).toBe("unchanged");
    expect(plan.files.some((x) => x.relPath === "Notes/nowy-tytul.md")).toBe(false);

    const changed = buildPlan(
      converted({ notes: [note("n1", "Nowy tytuł", { html: "<p>zmiana</p>" })] }),
      vault
    );
    expect(pathOf(changed, "note", "Notes/stara-nazwa.md")?.action).toBe("update");
  });

  it("avoids a foreign file and warns", () => {
    const vault = memoryVault({ "Notes/duplikat.md": "# ręczna notatka\n" });
    const plan = buildPlan(converted({ notes: [note("n1", "Duplikat")] }), vault);
    expect(plan.noteFiles.n1).toBe("Notes/duplikat-2.md");
    expect(plan.warnings).toHaveLength(1);
    expect(plan.warnings[0]).toContain("Notes/duplikat.md");
  });

  it("treats names case-insensitively", () => {
    const vault = memoryVault({ "Notes/Duplikat.md": "ręczna\n" });
    const plan = buildPlan(converted({ notes: [note("n1", "Duplikat")] }), vault);
    expect(plan.noteFiles.n1).toBe("Notes/duplikat-2.md");
    expect(plan.warnings[0]).toContain("Notes/Duplikat.md");
  });

  it("is idempotent on a second run", () => {
    const c = converted({
      notes: [
        note("n1", "Duplikat", { created: "2026-01-01" }),
        note("n2", "Duplikat", { created: "2026-02-01" }),
        note("n3", "Inna", { html: "<p><u>x</u></p>" }),
      ],
      tasks: [task("t1")],
      resources: [
        {
          id: "r1",
          title: "R",
          url: "https://x.test",
          description: "",
          tags: [],
          favorite: false,
        },
      ],
      tags: [{ id: "g1", tag: "a", title: "A" }],
      templates: [{ id: "m1", label: "L", title: "T", link: "" }],
    });
    const first = buildPlan(c, memoryVault());
    const second = buildPlan(c, viewOf(first.files));
    expect(second.files.length).toBe(first.files.length);
    expect(second.files.every((f) => f.action === "unchanged")).toBe(true);
    expect(second.noteFiles).toEqual(first.noteFiles);
    expect(second.targets).toEqual(first.targets);
  });
});

describe("buildPlan: single files", () => {
  const withTask = converted({ tasks: [task("t1")] });

  it("creates Tasks/tasks.md when absent", () => {
    const plan = buildPlan(withTask, memoryVault());
    expect(plan.targets.tasks).toBe("Tasks/tasks.md");
    const f = pathOf(plan, "tasks", "Tasks/tasks.md");
    expect(f?.action).toBe("create");
    const fm = parseFrontmatter(f!.content);
    expect(fm?.meta).toEqual({ generated_by: GENERATED_BY_IMPORT });
    expect(fm?.body.startsWith("# Zadania\n\n")).toBe(true);
  });

  it("updates or leaves our own file", () => {
    const first = buildPlan(withTask, memoryVault());
    const vault = viewOf(first.files);
    expect(buildPlan(withTask, vault).files[0].action).toBe("unchanged");
    const changed = buildPlan(converted({ tasks: [task("t1", { title: "Inny" })] }), vault);
    expect(changed.targets.tasks).toBe("Tasks/tasks.md");
    expect(changed.files[0].action).toBe("update");
  });

  it("writes beside a foreign tasks file, with a warning", () => {
    const vault = memoryVault({ "Tasks/tasks.md": "# Moje zadania\n- [ ] coś\n" });
    const plan = buildPlan(withTask, vault);
    expect(plan.targets.tasks).toBe("Tasks/tasks-2.md");
    expect(plan.warnings).toHaveLength(1);
    expect(plan.warnings[0]).toContain("Tasks/tasks.md");
    expect(plan.warnings[0]).toContain("Tasks/tasks-2.md");
  });

  it("goes on to tasks-3 when tasks-2 is foreign too", () => {
    const vault = memoryVault({
      "Tasks/tasks.md": "ręczny\n",
      "Tasks/tasks-2.md": "---\ngenerated_by: ktoś-inny\n---\n\nx\n",
    });
    const plan = buildPlan(withTask, vault);
    expect(plan.targets.tasks).toBe("Tasks/tasks-3.md");
  });

  it("treats a broken YAML file as foreign without throwing", () => {
    const vault = memoryVault({ "Resources/tags.yaml": "tags: [oops\n  : :\n" });
    const plan = buildPlan(converted({ tags: [{ id: "g1", tag: "a", title: "A" }] }), vault);
    expect(plan.targets.tags).toBe("Resources/tags-2.yaml");
    expect(plan.warnings).toHaveLength(1);
  });

  it("treats an unmarked YAML file as foreign", () => {
    const vault = memoryVault({ "Tasks/templates.yaml": "version: 1\ntemplates: []\n" });
    const plan = buildPlan(
      converted({ templates: [{ id: "m1", label: "L", title: "T", link: "" }] }),
      vault
    );
    expect(plan.targets.templates).toBe("Tasks/templates-2.yaml");
  });

  it("omits files and targets for types without records", () => {
    const plan = buildPlan(converted({ resources: [], tags: [] }), memoryVault());
    expect(plan.targets.tags).toBeUndefined();
    expect(plan.targets.resources).toBeUndefined();
    expect(plan.files).toEqual([]);
  });

  it("sorts tasks by order, with missing order last, and round-trips", () => {
    const tasks = [task("a", { order: 2 }), task("b"), task("c", { order: 1 })];
    const plan = buildPlan(converted({ tasks }), memoryVault());
    const content = pathOf(plan, "tasks", "Tasks/tasks.md")!.content;
    const parsed = parseTaskLines(content);
    expect(parsed.map((t) => t.id)).toEqual(["c", "a", "b"]);
    expect(parsed).toEqual([tasks[2], tasks[0], tasks[1]]);
  });

  it("orders and keys resources, tags and templates deterministically", () => {
    const plan = buildPlan(
      converted({
        resources: [
          {
            id: "r2",
            title: "B",
            url: "https://b.test",
            description: "",
            tags: ["x"],
            favorite: true,
            created: "2026-02-01",
          },
          {
            id: "r1",
            title: "A",
            url: "https://a.test",
            description: "d",
            tags: [],
            favorite: false,
            thumbnail_url: "https://t.test/i.png",
            note_id: "n1",
            created: "2026-01-01",
            updated: "2026-01-02",
          },
        ],
        tags: [
          { id: "g2", tag: "b", title: "B" },
          { id: "g1", tag: "a", title: "A", color: "red", created: "2026-01-01" },
        ],
        templates: [
          { id: "m2", label: "b", title: "T2", link: "" },
          { id: "m1", label: "a", title: "T1", link: "https://l.test", created: "2026-01-01" },
        ],
      }),
      memoryVault()
    );
    const res = pathOf(plan, "resources", "Resources/resources.yaml")!.content;
    expect(res.indexOf("id: r1")).toBeLessThan(res.indexOf("id: r2"));
    const keys = res
      .split("\n")
      .filter((l) => /^ {4}\S|^ {2}- /.test(l))
      .slice(0, 10)
      .map((l) => l.replace(/^\s*(- )?/, "").split(":")[0]);
    expect(keys).toEqual([
      "id",
      "title",
      "url",
      "description",
      "tags",
      "favorite",
      "thumbnail_url",
      "note_id",
      "created",
      "updated",
    ]);
    expect(res).toContain("generated_by: import-to-vault");
    const tags = pathOf(plan, "tags", "Resources/tags.yaml")!.content;
    expect(tags.indexOf("id: g1")).toBeLessThan(tags.indexOf("id: g2"));
    expect(tags.indexOf("tag: a")).toBeLessThan(tags.indexOf("title: A"));
    expect(tags.indexOf("title: A")).toBeLessThan(tags.indexOf("color: red"));
    expect(tags.indexOf("color: red")).toBeLessThan(tags.indexOf("created:"));
    const tpl = pathOf(plan, "templates", "Tasks/templates.yaml")!.content;
    expect(tpl.indexOf("id: m1")).toBeLessThan(tpl.indexOf("id: m2"));
    expect(tpl.indexOf("label: a")).toBeLessThan(tpl.indexOf("title: T1"));
    expect(tpl.indexOf("title: T1")).toBeLessThan(tpl.indexOf("link:"));
    expect(tpl.indexOf("link:")).toBeLessThan(tpl.indexOf("created:"));
  });
});

describe("buildPlan: note losses", () => {
  it("reports only notes that have losses", () => {
    const plan = buildPlan(
      converted({
        notes: [
          note("n1", "Z podkreśleniem", { html: "<p><u>x</u></p>" }),
          note("n2", "Czysta", { html: "<p>x</p>" }),
        ],
      }),
      memoryVault()
    );
    expect(plan.noteLosses).toEqual([
      { id: "n1", relPath: "Notes/z-podkresleniem.md", losses: ["podkreślenie"] },
    ]);
  });
});
