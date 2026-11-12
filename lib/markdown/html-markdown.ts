import MarkdownIt from "markdown-it";
import TurndownService from "turndown";

/** HTML edytora → Markdown (atx nagłówki, `-` w listach, ``` w blokach kodu, `*` kursywa, `~~` przekreślenie). */
export function htmlToMarkdown(html: string): string {
  const turndown = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
  });
  turndown.addRule("strikethrough", {
    filter: (node) => ["S", "DEL", "STRIKE"].includes(node.nodeName),
    replacement: (content) => `~~${content}~~`,
  });
  return turndown.turndown(html).trim();
}

// `html: false`: surowy HTML w źródle jest escapowany (E1); markdown-it odrzuca też linki `javascript:`.
const markdown = new MarkdownIt({ html: false, linkify: false, breaks: false });

/** Markdown → HTML; pusty lub biały tekst daje "". */
export function markdownToHtml(source: string): string {
  if (source.trim() === "") return "";
  return markdown.render(source);
}
