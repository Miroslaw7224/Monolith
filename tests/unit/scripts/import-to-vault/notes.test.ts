// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseFrontmatter } from "@/lib/nexus/frontmatter";
import { buildNoteFiles, detectLosses, htmlToMarkdown } from "@/scripts/import-to-vault/notes";
import type { VaultNote } from "@/scripts/import-to-vault/types";

describe("htmlToMarkdown", () => {
  it("converts headings and inline formatting", () => {
    expect(
      htmlToMarkdown("<h1>Tytuł</h1><p>Akapit <strong>gruby</strong> i <em>kursywa</em></p>")
    ).toBe("# Tytuł\n\nAkapit **gruby** i *kursywa*");
  });

  it("converts lists with dash markers", () => {
    const md = htmlToMarkdown("<ul><li>jeden</li><li>dwa</li></ul>");
    expect(md).toMatch(/^-\s+jeden$/m);
    expect(md).toMatch(/^-\s+dwa$/m);
  });

  it("converts strikethrough", () => {
    expect(htmlToMarkdown("<p>a <s>b</s></p>")).toBe("a ~~b~~");
    expect(htmlToMarkdown("<p>a <del>b</del></p>")).toBe("a ~~b~~");
    expect(htmlToMarkdown("<p>a <strike>b</strike></p>")).toBe("a ~~b~~");
  });

  it("handles empty input and plain text", () => {
    expect(htmlToMarkdown("")).toBe("");
    expect(htmlToMarkdown("Zażółć gęślą jaźń")).toBe("Zażółć gęślą jaźń");
  });
});

describe("detectLosses", () => {
  it("detects color, alignment and underline", () => {
    expect(detectLosses('<p style="color: red; text-align: center">x</p><u>y</u>')).toEqual([
      "kolor czcionki",
      "wyrównanie",
      "podkreślenie",
    ]);
  });

  it("detects background color", () => {
    expect(detectLosses('<span style="background-color: #fff">x</span>')).toEqual(["kolor tła"]);
  });

  it("detects font family and size with single quotes", () => {
    expect(detectLosses("<span style='font-family: Arial; font-size: 12px'>x</span>")).toEqual([
      "krój czcionki",
      "rozmiar czcionki",
    ]);
  });

  it("detects font color attribute", () => {
    expect(detectLosses('<font color="red">x</font>')).toEqual(["kolor czcionki"]);
  });

  it("detects tables, task lists, highlights, sub/superscripts", () => {
    expect(detectLosses("<table><tr><td>x</td></tr></table>")).toEqual(["tabela"]);
    expect(detectLosses('<ul data-type="taskList"><li>x</li></ul>')).toEqual(["lista zadań"]);
    expect(detectLosses("<mark>x</mark><sup>2</sup>")).toEqual([
      "zakreślenie",
      "indeks górny/dolny",
    ]);
  });

  it("ignores color text outside a style attribute", () => {
    expect(detectLosses("<p>color: red</p>")).toEqual([]);
  });

  it("is case-insensitive and does not treat background-color or -webkit-color as font color", () => {
    expect(detectLosses('<P STYLE="COLOR: red">x</P>')).toEqual(["kolor czcionki"]);
    expect(detectLosses('<span style="background-color: red">x</span>')).toEqual(["kolor tła"]);
    expect(detectLosses('<span style="text-decoration: underline">x</span>')).toEqual([
      "podkreślenie",
    ]);
  });

  it("detects embedded media and checkboxes", () => {
    expect(detectLosses('<iframe src="x"></iframe>')).toEqual(["osadzone media"]);
    expect(detectLosses('<input type="checkbox">')).toEqual(["lista zadań"]);
  });
});

describe("buildNoteFiles", () => {
  const note: VaultNote = {
    id: "n1",
    title: "A: b ] c",
    html: '<p style="color: red">Treść</p>',
    created: "2026-01-02T03:04:05.000Z",
    updated: "2026-02-03T04:05:06.000Z",
    tags: ["x"],
  };

  it("builds markdown with frontmatter in fixed key order, untouched html and losses", () => {
    const out = buildNoteFiles(note);
    const parsed = parseFrontmatter(out.markdown);
    expect(parsed).not.toBeNull();
    const meta = parsed!.meta;
    expect(meta).toEqual({
      id: "n1",
      title: "A: b ] c",
      created: note.created,
      updated: note.updated,
      tags: ["x"],
    });
    expect(Object.keys(meta)).toEqual(["id", "title", "created", "updated", "tags"]);
    expect(parsed!.body.trim()).toBe("Treść");
    expect(out.html).toBe(note.html);
    expect(out.losses).toEqual(["kolor czcionki"]);
  });

  it("omits created when null", () => {
    const parsed = parseFrontmatter(buildNoteFiles({ ...note, created: null }).markdown);
    expect("created" in parsed!.meta).toBe(false);
    expect(Object.keys(parsed!.meta)).toEqual(["id", "title", "updated", "tags"]);
  });
});
