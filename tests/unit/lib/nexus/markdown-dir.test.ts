// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DomainError } from "@/lib/errors";
import { formatFrontmatter } from "@/lib/nexus/frontmatter";
import {
  createEntry,
  deleteEntry,
  findEntry,
  listEntries,
  updateEntry,
} from "@/lib/nexus/markdown-dir";
import { useTempVault } from "../../helpers/tempVault";

const vault = useTempVault();
const note = (id: string, body = "tekst", extra = "") =>
  `---\nid: ${id}\ntitle: T ${id}\n${extra}---\n\n${body}\n`;

describe("listEntries / findEntry", () => {
  it("skips non-markdown files, directories and files without a string id", () => {
    vault.write("Notes/readme.txt", "x");
    vault.write("Notes/.html/x.html", "<p>x</p>");
    vault.write("Notes/plain.md", "bez frontmattera");
    vault.write("Notes/noid.md", "---\ntitle: X\n---\n\ntekst\n");
    vault.write("Notes/numid.md", "---\nid: 5\n---\n\ntekst\n");
    vault.write("Notes/a.md", note("A"));
    vault.write("Notes/B.MD", note("B"));
    expect(listEntries("Notes").map((e) => [e.rel, e.id])).toEqual([
      ["Notes/B.MD", "B"],
      ["Notes/a.md", "A"],
    ]);
  });

  it("returns [] for a missing directory", () => {
    expect(listEntries("Nope")).toEqual([]);
  });

  it("parses CRLF files and trims the body", () => {
    vault.write("Notes/a.md", "---\r\nid: A\r\n---\r\n\r\n\r\ntekst\r\n\r\n");
    const [entry] = listEntries("Notes");
    expect(entry.body).toBe("tekst");
    expect(entry.meta).toEqual({ id: "A" });
  });

  it("findEntry returns the first file (by name) for a duplicate id", () => {
    vault.write("Notes/b.md", note("D", "druga"));
    vault.write("Notes/a.md", note("D", "pierwsza"));
    expect(findEntry("Notes", "D")?.rel).toBe("Notes/a.md");
    expect(findEntry("Notes", "nope")).toBeNull();
  });
});

describe("createEntry", () => {
  it("names the file after the slug and writes frontmatter plus body", () => {
    vault.write("Notes/old.md", note("OLD"));
    const { id, rel } = createEntry("Notes", "Moja Notatka", (newId) => ({
      meta: { id: newId, title: "Moja Notatka" },
      body: "x",
    }));
    expect(rel).toBe("Notes/moja-notatka.md");
    expect(id).toMatch(/^[A-Za-z0-9]{20}$/);
    expect(id).not.toBe("OLD");
    expect(vault.read(rel)).toBe(formatFrontmatter({ id, title: "Moja Notatka" }, "x"));
  });

  it("adds numeric suffixes on collisions, ignoring letter case", () => {
    const build = (id: string) => ({ meta: { id }, body: "" });
    expect(createEntry("Notes", "moja notatka", build).rel).toBe("Notes/moja-notatka.md");
    expect(createEntry("Notes", "Moja Notatka", build).rel).toBe("Notes/moja-notatka-2.md");
    vault.write("Notes/Zajete.MD", note("Z"));
    expect(createEntry("Notes", "zajete", build).rel).toBe("Notes/zajete-2.md");
  });

  it("keeps hostile titles inside the directory", () => {
    const { rel } = createEntry("Notes", "../../etc", (id) => ({ meta: { id }, body: "" }));
    expect(rel).toBe("Notes/etc.md");
    expect(path.dirname(path.join(vault.root, rel))).toBe(path.join(vault.root, "Notes"));
  });
});

describe("updateEntry", () => {
  it("keeps unknown frontmatter keys and their order, replacing body", async () => {
    vault.write("Notes/a.md", note("A", "stara", "tags:\n  - praca\nx_obsidian: tak\n"));
    await updateEntry("Notes", "A", "Note not found", ({ meta, body }) => ({
      meta: { ...meta, title: "Nowy" },
      body: `${body} + nowa`,
    }));
    expect(vault.read("Notes/a.md")).toBe(
      "---\nid: A\ntitle: Nowy\ntags:\n  - praca\nx_obsidian: tak\n---\n\nstara + nowa\n"
    );
  });

  it("rejects an unknown id with the given message and status 404", async () => {
    const error = await updateEntry("Notes", "nope", "Note not found", (e) => e).catch(
      (err: unknown) => err
    );
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).statusCode).toBe(404);
    expect((error as DomainError).message).toBe("Note not found");
  });

  it("never overwrites a file that lost its frontmatter after it was found", async () => {
    vault.write("Notes/a.md", note("A"));
    const file = path.join(vault.root, "Notes/a.md");
    let calls = 0;
    const error = await updateEntry("Notes", "A", "Note not found", (entry) => {
      calls += 1;
      if (calls === 1) fs.writeFileSync(file, "ktoś nadpisał plik");
      return entry;
    }).catch((err: unknown) => err);
    expect((error as DomainError).statusCode).toBe(404);
    expect(vault.read("Notes/a.md")).toBe("ktoś nadpisał plik");
  });
});

describe("deleteEntry", () => {
  it("removes the file and leaves the HTML archive alone", () => {
    vault.write("Notes/a.md", note("A"));
    vault.write("Notes/.html/A.html", "<p>x</p>");
    expect(deleteEntry("Notes", "A")).toBe(true);
    expect(vault.read("Notes/a.md")).toBeNull();
    expect(vault.read("Notes/.html/A.html")).toBe("<p>x</p>");
  });

  it("returns false for an unknown id", () => {
    expect(deleteEntry("Notes", "nope")).toBe(false);
  });
});
