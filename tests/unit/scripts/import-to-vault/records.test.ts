// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  convertDump,
  normalizeNote,
  normalizeResource,
  normalizeTag,
  normalizeTask,
  normalizeTemplate,
  toIso,
} from "@/scripts/import-to-vault/records";
import type { DumpData, DumpRow } from "@/scripts/import-to-vault/types";
import { ts } from "./helpers";

const row = (id: string, data: Record<string, unknown>): DumpRow => ({
  id,
  path: `x/${id}`,
  data,
});

describe("toIso", () => {
  it("zwraca tekst bez zmian", () => {
    expect(toIso("2026-05-01 10:00:00")).toBe("2026-05-01 10:00:00");
  });
  it("zwraca iso z Timestamp", () => {
    expect(
      toIso({ __type: "timestamp", iso: "2026-05-01T10:00:00.000Z", seconds: 1, nanos: 0 })
    ).toBe("2026-05-01T10:00:00.000Z");
  });
  it("reszta daje null", () => {
    expect(toIso(undefined)).toBeNull();
    expect(toIso(5)).toBeNull();
    expect(toIso({})).toBeNull();
  });
});

describe("normalizeTask", () => {
  it("przepisuje pełne zadanie, id z _id", () => {
    const warnings: string[] = [];
    const task = normalizeTask(
      row("t1", {
        id: "inne",
        title: "Zrób",
        status: "in_progress",
        link: "https://x.y",
        description: "opis",
        due_date: "2026-06-01",
        priority: 2,
        order: 3,
        created_at: "2026-05-01 10:00:00",
        updated_at: "2026-05-02 10:00:00",
      }),
      warnings
    );
    expect(task).toEqual({
      id: "t1",
      title: "Zrób",
      status: "in_progress",
      link: "https://x.y",
      description: "opis",
      due_date: "2026-06-01",
      priority: 2,
      order: 3,
      created_at: "2026-05-01 10:00:00",
      updated_at: "2026-05-02 10:00:00",
    });
    expect(warnings).toEqual([]);
  });
  it("createdAt jako Timestamp trafia do created_at, gdy brak created_at", () => {
    const task = normalizeTask(
      row("t1", {
        title: "A",
        status: "todo",
        createdAt: ts("2026-05-01T10:00:00.000Z"),
        updatedAt: ts("2026-05-03T10:00:00.000Z"),
      }),
      []
    );
    expect(task.created_at).toBe("2026-05-01T10:00:00.000Z");
    expect(task.updated_at).toBe("2026-05-03T10:00:00.000Z");
  });
  it("nieznany status, priorytet tekstowy, puste due_date, order ułamkowy", () => {
    const warnings: string[] = [];
    const task = normalizeTask(
      row("t2", {
        title: "B",
        status: "archived",
        priority: "3",
        due_date: "",
        order: 1.5,
      }),
      warnings
    );
    expect(task.status).toBe("todo");
    expect(task.priority).toBeNull();
    expect(task.due_date).toBeNull();
    expect(task.order).toBe(1.5);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("t2");
    expect(warnings[0]).toContain("archived");
  });
  it("tytuł nie-tekst daje pusty tytuł i ostrzeżenie", () => {
    const warnings: string[] = [];
    const task = normalizeTask(row("t3", { title: 5, status: "todo" }), warnings);
    expect(task.title).toBe("");
    expect(warnings).toHaveLength(1);
  });
});

describe("normalizeNote", () => {
  it("content do html, tags nie-tablica daje [], createdAt do created", () => {
    const warnings: string[] = [];
    const note = normalizeNote(
      row("n1", {
        title: "N",
        content: "<p>x</p>",
        tags: "x",
        createdAt: ts("2026-05-01T10:00:00.000Z"),
      }),
      warnings
    );
    expect(note.html).toBe("<p>x</p>");
    expect(note.tags).toEqual([]);
    expect(note.created).toBe("2026-05-01T10:00:00.000Z");
    expect(note.updated).toBeNull();
    expect(warnings).toEqual([]);
  });
  it("brak content nie daje ostrzeżenia, content nie-tekst tak", () => {
    const w1: string[] = [];
    expect(normalizeNote(row("n2", { title: "N" }), w1).html).toBe("");
    expect(w1).toEqual([]);
    const w2: string[] = [];
    expect(normalizeNote(row("n3", { title: "N", content: 7 }), w2).html).toBe("");
    expect(w2).toHaveLength(1);
  });
});

describe("normalizeResource", () => {
  it("isFavorite true i brak thumbnailUrl", () => {
    const rec = normalizeResource(
      row("r1", { url: "https://a.b", title: "R", isFavorite: true, tags: ["a"] })
    );
    expect(rec.favorite).toBe(true);
    expect("thumbnail_url" in rec).toBe(false);
    expect("note_id" in rec).toBe(false);
    expect("created" in rec).toBe(false);
    expect("updated" in rec).toBe(false);
    expect(rec.description).toBe("");
    expect(rec.tags).toEqual(["a"]);
  });
  it("ustawia opcjonalne klucze, gdy wartości istnieją", () => {
    const rec = normalizeResource(
      row("r2", {
        url: "u",
        title: "t",
        thumbnailUrl: "th",
        noteId: "n1",
        created_at: "c",
        updatedAt: ts("2026-05-01T10:00:00.000Z"),
      })
    );
    expect(rec.favorite).toBe(false);
    expect(rec.thumbnail_url).toBe("th");
    expect(rec.note_id).toBe("n1");
    expect(rec.created).toBe("c");
    expect(rec.updated).toBe("2026-05-01T10:00:00.000Z");
  });
});

describe("normalizeTag i normalizeTemplate", () => {
  it("tag bez color i created nie ma tych kluczy", () => {
    const tag = normalizeTag(row("g1", { tag: "a", title: "A" }));
    expect(tag).toEqual({ id: "g1", tag: "a", title: "A" });
    expect("color" in tag).toBe(false);
    expect("created" in tag).toBe(false);
  });
  it("tag z color i created", () => {
    const tag = normalizeTag(row("g2", { tag: "a", title: "A", color: "red", created_at: "c" }));
    expect(tag.color).toBe("red");
    expect(tag.created).toBe("c");
  });
  it("szablon", () => {
    expect(normalizeTemplate(row("s1", { label: "L", title: "T", link: "k" }))).toEqual({
      id: "s1",
      label: "L",
      title: "T",
      link: "k",
    });
    expect(normalizeTemplate(row("s2", { label: "L", created_at: "c" }))).toEqual({
      id: "s2",
      label: "L",
      title: "",
      link: "",
      created: "c",
    });
  });
});

describe("convertDump", () => {
  it("po jednym rekordzie każdego typu, bez ostrzeżeń", () => {
    const dump: DumpData = {
      dumpDir: "/d",
      uid: "u",
      exportedAt: "2026-05-01T00:00:00.000Z",
      rows: {
        notes: [row("n1", { title: "N", content: "<p>x</p>" })],
        tasks: [row("t1", { title: "T", status: "todo" })],
        resources: [row("r1", { url: "u", title: "R" })],
        user_tags: [row("g1", { tag: "a", title: "A" })],
        task_templates: [row("s1", { label: "L", title: "T", link: "k" })],
      },
      skipped: [],
    };
    const out = convertDump(dump);
    expect(out.notes).toHaveLength(1);
    expect(out.tasks).toHaveLength(1);
    expect(out.resources).toHaveLength(1);
    expect(out.tags).toHaveLength(1);
    expect(out.templates).toHaveLength(1);
    expect(out.warnings).toEqual([]);
  });
});
