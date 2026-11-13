import type { ParsedResourceBlock } from "./resourceTypes";

export function getFaviconUrl(url: string): string {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=48`;
  } catch {
    return "";
  }
}

/** Parsuje blok w formacie: Opis: ... URL: ... Tagi: ... (lub Description: / Tags:) */
export function parseBlockFormat(text: string): ParsedResourceBlock | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const lines = trimmed.split(/\r?\n/).map((l) => l.trim());
  let description = "";
  let url = "";
  const tags: string[] = [];
  const keyRe = /^(Opis|Description|URL|Tagi|Tags):\s*(.*)$/i;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(keyRe);
    if (m) {
      const key = m[1].toLowerCase();
      const value = m[2].trim();
      if (key === "opis" || key === "description") {
        const parts = [value];
        i++;
        while (i < lines.length && !lines[i].match(keyRe)) {
          parts.push(lines[i].trim());
          i++;
        }
        description = parts.join(" ").trim();
        continue;
      }
      if (key === "url") {
        url = value;
        i++;
        continue;
      }
      if (key === "tagi" || key === "tags") {
        let tagLine = value;
        i++;
        while (i < lines.length && !lines[i].match(keyRe)) {
          tagLine += " " + lines[i].trim();
          i++;
        }
        tags.push(
          ...tagLine
            .split(/[,;]/)
            .map((s) => s.trim())
            .filter(Boolean)
        );
        continue;
      }
    }
    i++;
  }
  if (!url) return null;
  if (!description) description = url;
  return { description, url, tags };
}

/** Dzieli tekst na wiele bloków (każdy zaczyna się od Opis: / Description:) i parsuje je. */
export function parseMultipleBlocks(text: string): ParsedResourceBlock[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const blocks: string[] = [];
  const re = /(\n\s*)(?=(?:Opis|Description):\s*)/gi;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(trimmed)) !== null) {
    blocks.push(trimmed.slice(lastIndex, m.index).trim());
    lastIndex = m.index + m[1].length;
  }
  blocks.push(trimmed.slice(lastIndex).trim());
  const results: ParsedResourceBlock[] = [];
  for (const block of blocks) {
    const parsed = parseBlockFormat(block);
    if (parsed) results.push(parsed);
  }
  return results;
}
