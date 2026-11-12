// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "@/lib/errors";
import { parseFrontmatter } from "@/lib/nexus/frontmatter";
import { createNote, deleteNote, getNotes, updateNote } from "@/lib/nexus/repos/notes";
import { useTempVault } from "./helpers";

const NOW = "2026-11-12T10:00:00.000Z";
const FIXTURE = `---
id: noteA
title: Pierwsza
created: "2026-03-02T10:00:00.000Z"
updated: "2026-03-03T10:00:00.000Z"
tags:
  - praca
x_obsidian: tak
---

Treść **pogrubiona**
`;

const vault = useTempVault();
afterEach(() => vi.useRealTimers());
const freeze = () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
};

describe("notes repository: read", () => {
  it("returns [] when Notes/ does not exist", async () => {
    expect(await getNotes()).toEqual([]);
  });

  it("maps a 0b file", async () => {
    vault.write("Notes/pierwsza.md", FIXTURE);
    expect(await getNotes()).toEqual([
      {
        id: "noteA",
        title: "Pierwsza",
        content: "Treść **pogrubiona**",
        created_at: "2026-03-02T10:00:00.000Z",
        updated_at: "2026-03-03T10:00:00.000Z",
      },
    ]);
  });

  it("sorts newest created first and ties by id", async () => {
    vault.write("Notes/a.md", "---\nid: a\ncreated: 2026-01-01T00:00:00.000Z\n---\n\nx\n");
    vault.write("Notes/b.md", "---\nid: b\ncreated: 2026-02-01T00:00:00.000Z\n---\n\nx\n");
    vault.write("Notes/c.md", "---\nid: c\n---\n\nx\n");
    vault.write("Notes/d.md", "---\nid: d\n---\n\nx\n");
    expect((await getNotes()).map((n) => n.id)).toEqual(["b", "a", "c", "d"]);
  });

  it("falls back to the file name for a missing title but keeps an empty one", async () => {
    vault.write("Notes/bez.md", "---\nid: a\n---\n\nx\n");
    vault.write("Notes/pusty.md", '---\nid: b\ntitle: ""\n---\n\nx\n');
    const byId = Object.fromEntries((await getNotes()).map((n) => [n.id, n.title]));
    expect(byId).toEqual({ a: "bez", b: "" });
  });
});

describe("notes repository: create", () => {
  it("creates Notes/<slug>.md and the note is readable", async () => {
    freeze();
    const created = await createNote({ title: "Moja notatka", content: "Treść" });
    expect(created).toEqual({
      id: expect.stringMatching(/^[A-Za-z0-9]{20}$/),
      title: "Moja notatka",
      content: "Treść",
    });
    expect(parseFrontmatter(vault.read("Notes/moja-notatka.md")!)?.meta).toEqual({
      id: created.id,
      title: "Moja notatka",
      created: NOW,
      updated: NOW,
    });
    expect(await getNotes()).toEqual([
      { id: created.id, title: "Moja notatka", content: "Treść", created_at: NOW, updated_at: NOW },
    ]);
  });

  it("uses bez-tytulu for an empty title and suffixes the next one", async () => {
    await createNote({ title: "", content: "a" });
    await createNote({ title: "", content: "b" });
    expect(vault.read("Notes/bez-tytulu.md")).not.toBeNull();
    expect(vault.read("Notes/bez-tytulu-2.md")).not.toBeNull();
  });

  it("round-trips an empty content", async () => {
    await createNote({ title: "Pusta", content: "" });
    expect((await getNotes())[0].content).toBe("");
  });

  it("round-trips special characters in the title and body", async () => {
    const title = 'Tytuł: "cytat" # [x] \\ end';
    const content = "---\n# nagłówek\n\n- punkt\n\n---\nkoniec";
    const { id } = await createNote({ title, content });
    const [note] = await getNotes();
    expect(note).toMatchObject({ id, title, content });
  });
});

describe("notes repository: update", () => {
  it("changes title and content, keeps tags, unknown keys, created and the file name", async () => {
    freeze();
    vault.write("Notes/pierwsza.md", FIXTURE);
    await updateNote("noteA", { title: "Nowa", content: "Nowa treść" });
    expect(parseFrontmatter(vault.read("Notes/pierwsza.md")!)?.meta).toEqual({
      id: "noteA",
      title: "Nowa",
      created: "2026-03-02T10:00:00.000Z",
      updated: NOW,
      tags: ["praca"],
      x_obsidian: "tak",
    });
    expect((await getNotes())[0].content).toBe("Nowa treść");
    expect(vault.read("Notes/nowa.md")).toBeNull();
  });

  it("rejects an unknown id with 404", async () => {
    const error = await updateNote("nope", { title: "x", content: "y" }).catch(
      (err: unknown) => err
    );
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).statusCode).toBe(404);
    expect((error as DomainError).message).toBe("Note not found");
  });

  it("does not lose updates of different notes written in parallel", async () => {
    vault.write("Notes/a.md", "---\nid: a\ntitle: A\n---\n\nx\n");
    vault.write("Notes/b.md", "---\nid: b\ntitle: B\n---\n\nx\n");
    await Promise.all([
      updateNote("a", { title: "A2", content: "1" }),
      updateNote("b", { title: "B2", content: "2" }),
    ]);
    const byId = Object.fromEntries((await getNotes()).map((n) => [n.id, n.title]));
    expect(byId).toEqual({ a: "A2", b: "B2" });
  });
});

describe("notes repository: delete", () => {
  it("removes the file, keeps the HTML archive and is idempotent", async () => {
    vault.write("Notes/pierwsza.md", FIXTURE);
    vault.write("Notes/.html/noteA.html", "<p>x</p>");
    await deleteNote("noteA");
    expect(vault.read("Notes/pierwsza.md")).toBeNull();
    expect(vault.read("Notes/.html/noteA.html")).toBe("<p>x</p>");
    await expect(deleteNote("noteA")).resolves.toBeUndefined();
  });
});
