import { describe, expect, it, vi } from "vitest";
import { markdownToHtmlWithWikilinks } from "@/lib/markdown/wikilinks";

const KNOWN: Record<string, string> = {
  "Knowledge/a": "Knowledge/a.md",
  "Knowledge/b": "Knowledge/b.md",
};
const resolve = (target: string): string | null => KNOWN[target] ?? null;
const render = (src: string) => markdownToHtmlWithWikilinks(src, resolve);

describe("wikilinki", () => {
  it("znany cel: link z data-nexus-path, bez celu w href", () => {
    const html = render("[[Knowledge/a]]");
    expect(html).toContain(
      '<a class="not-wikilink" href="#" data-nexus-path="Knowledge/a.md">Knowledge/a</a>'
    );
  });

  it("alias zastępuje etykietę, resolver dostaje sam cel", () => {
    const spy = vi.fn(resolve);
    const html = markdownToHtmlWithWikilinks("[[Knowledge/a|Alias]]", spy);
    expect(html).toContain(">Alias</a>");
    expect(spy).toHaveBeenCalledWith("Knowledge/a");
  });

  it("nagłówek po # nie trafia do celu, ale zostaje w etykiecie", () => {
    const spy = vi.fn(resolve);
    const html = markdownToHtmlWithWikilinks("[[Knowledge/a#sekcja]]", spy);
    expect(spy).toHaveBeenCalledWith("Knowledge/a");
    expect(html).toContain(">Knowledge/a#sekcja</a>");
  });

  it("nieznany cel: wyszarzony tekst z podpowiedzią", () => {
    expect(render("[[Nieznany]]")).toContain(
      '<span class="not-wikilink not-wikilink--missing" title="poza bazą NEXUS w tym panelu">Nieznany</span>'
    );
  });

  it("[[ bez zamknięcia i pusty cel zostają tekstem", () => {
    expect(render("[[ bez zamknięcia")).toContain("[[ bez zamknięcia");
    expect(render("[[ ]] i [[]]")).not.toContain("not-wikilink");
  });

  it("wstrzyknięcie w celu jest escapowane", () => {
    const html = render('[[a"><script>alert(1)</script>]]');
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("ścieżka z resolvera jest escapowana w atrybucie", () => {
    const html = markdownToHtmlWithWikilinks("[[x]]", () => 'a"><b>');
    expect(html).not.toContain("<b>");
    expect(html).toContain('data-nexus-path="a&quot;&gt;&lt;b&gt;"');
  });

  it("działa w komórce tabeli", () => {
    const html = render("| a |\n|---|\n| [[Knowledge/a]] |");
    expect(html).toContain('data-nexus-path="Knowledge/a.md"');
  });

  it("nie rusza code span ani bloku kodu", () => {
    const span = render("`[[Knowledge/a]]`");
    expect(span).toContain("<code>[[Knowledge/a]]</code>");
    expect(span).not.toContain("data-nexus-path");
    const block = render("```\n[[Knowledge/a]]\n```");
    expect(block).toContain("[[Knowledge/a]]");
    expect(block).not.toContain("data-nexus-path");
  });

  it("w tekście zwykłego linku zostaje zwykły tekst (bez zagnieżdżonego <a>)", () => {
    const html = render("[zobacz [[Knowledge/a]]](https://example.com)");
    expect(html).toContain("[[Knowledge/a]]");
    expect(html).not.toContain("data-nexus-path");
    expect(html.match(/<a /g)).toHaveLength(1);
  });

  it("surowy HTML nadal jest escapowany (html: false)", () => {
    expect(render("<script>alert(1)</script>")).not.toContain("<script>");
  });

  it("pusty tekst daje pusty wynik", () => {
    expect(render("  ")).toBe("");
  });
});
