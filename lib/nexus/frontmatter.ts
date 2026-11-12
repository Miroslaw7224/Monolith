import YAML from "yaml";

export type Frontmatter = Record<string, unknown>;

/** `---\n<yaml>---\n\n<treść>\n`. Wartości `undefined` w `meta` są pomijane. */
export function formatFrontmatter(meta: Frontmatter, body: string): string {
  const yamlText = YAML.stringify(meta, { lineWidth: 0, version: "1.1" });
  const trimmed = body.replace(/^\n+/, "").replace(/\s+$/, "");
  return `---\n${yamlText}---\n\n${trimmed}\n`;
}

/** Zwraca `null`, gdy tekst nie zaczyna się poprawnym frontmatterem (mapa YAML). */
export function parseFrontmatter(text: string): { meta: Frontmatter; body: string } | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)([\s\S]*)$/.exec(text);
  if (!match) return null;
  let meta: unknown;
  try {
    meta = YAML.parse(match[1]);
  } catch {
    return null;
  }
  if (meta === null || typeof meta !== "object" || Array.isArray(meta)) return null;
  return { meta: meta as Frontmatter, body: match[2].replace(/^\r?\n/, "") };
}
