// @vitest-environment node
import { describe, expect, it } from "vitest";
import { htmlToMarkdown, markdownToHtml } from "@/lib/markdown/html-markdown";

const flat = (s: string) => s.replace(/\n/g, "");

describe("markdownToHtml", () => {
  it("renders inline formatting", () => {
    expect(flat(markdownToHtml("**a** *b* ~~c~~"))).toBe(
      "<p><strong>a</strong> <em>b</em> <s>c</s></p>"
    );
  });

  it("renders headings and lists", () => {
    expect(flat(markdownToHtml("# T\n\n- x\n- y"))).toBe("<h1>T</h1><ul><li>x</li><li>y</li></ul>");
  });

  it("escapes raw HTML", () => {
    expect(flat(markdownToHtml("<script>alert(1)</script>"))).toBe(
      "<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>"
    );
  });

  it("does not produce a javascript: link", () => {
    expect(markdownToHtml("[l](javascript:alert(1))")).not.toContain('href="javascript');
  });

  it("returns an empty string for empty or blank input", () => {
    expect(markdownToHtml("")).toBe("");
    expect(markdownToHtml("  \n ")).toBe("");
  });
});

describe("htmlToMarkdown", () => {
  it("converts inline formatting", () => {
    expect(htmlToMarkdown("<p>a <strong>b</strong> <em>c</em> <s>d</s></p>")).toBe(
      "a **b** *c* ~~d~~"
    );
  });

  it("separates blocks with a blank line and uses atx headings", () => {
    expect(htmlToMarkdown("<p>a</p><h2>H</h2>")).toBe("a\n\n## H");
  });

  it.each(["Akapit **pogrubiony** i *kursywa*", "## Nagłówek\n\nTekst", "Pierwszy\n\nDrugi"])(
    "round-trips %j",
    (markdown) => {
      expect(htmlToMarkdown(markdownToHtml(markdown))).toBe(markdown);
    }
  );
});
