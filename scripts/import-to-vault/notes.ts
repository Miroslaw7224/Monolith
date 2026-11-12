import TurndownService from "turndown";
import { formatFrontmatter } from "../../lib/nexus/frontmatter";
import type { VaultNote } from "./types";

/** Zawartości wszystkich atrybutów `style` (cudzysłowy " i '). */
function styleValues(html: string): string[] {
  const out: string[] = [];
  const re = /\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) out.push(m[1] ?? m[2] ?? "");
  return out;
}

/** Nazwy formatowania, którego Markdown nie odtworzy (stała kolejność). */
export function detectLosses(html: string): string[] {
  const styles = styleValues(html);
  const inStyle = (re: RegExp) => styles.some((s) => re.test(s));
  const has = (re: RegExp) => re.test(html);
  const losses: string[] = [];

  if (inStyle(/(?<![-a-z0-9])color\s*:/i) || has(/<font\b[^>]*\scolor\s*=/i)) {
    losses.push("kolor czcionki");
  }
  if (inStyle(/(?<![-a-z0-9])background(?:-color)?\s*:/i)) losses.push("kolor tła");
  if (inStyle(/(?<![-a-z0-9])text-align\s*:/i)) losses.push("wyrównanie");
  if (inStyle(/(?<![-a-z0-9])font-family\s*:/i) || has(/<font\b[^>]*\sface\s*=/i)) {
    losses.push("krój czcionki");
  }
  if (inStyle(/(?<![-a-z0-9])font-size\s*:/i)) losses.push("rozmiar czcionki");
  if (inStyle(/(?<![-a-z0-9])text-decoration[a-z-]*\s*:[^;]*underline/i) || has(/<u[\s>/]/i)) {
    losses.push("podkreślenie");
  }
  if (has(/<mark[\s>/]/i)) losses.push("zakreślenie");
  if (has(/<(?:sup|sub)[\s>/]/i)) losses.push("indeks górny/dolny");
  if (has(/<table[\s>/]/i)) losses.push("tabela");
  if (has(/data-type\s*=\s*["']?taskList\b/i) || has(/\btype\s*=\s*["']?checkbox\b/i)) {
    losses.push("lista zadań");
  }
  if (has(/<(?:iframe|video|audio|embed|object)[\s>/]/i)) losses.push("osadzone media");
  return losses;
}

export function htmlToMarkdown(html: string): string {
  const turndown = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
  });
  turndown.addRule("strikethrough", {
    filter: ["s", "del", "strike"],
    replacement: (content) => `~~${content}~~`,
  });
  return turndown.turndown(html).trim();
}

export function buildNoteFiles(note: VaultNote): {
  markdown: string;
  html: string;
  losses: string[];
} {
  const markdown = formatFrontmatter(
    {
      id: note.id,
      title: note.title,
      created: note.created ?? undefined,
      updated: note.updated ?? undefined,
      tags: note.tags,
    },
    htmlToMarkdown(note.html)
  );
  return { markdown, html: note.html, losses: detectLosses(note.html) };
}
