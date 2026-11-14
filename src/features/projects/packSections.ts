/** Przybliżenie z serwisu paczki: 4 znaki na token (bez tokenizera). */
const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

export type PackSection = { name: string; tokens: number };

/** Liczba z odstępem co trzy cyfry: `3850` → `3 850`. */
export function formatTokens(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/**
 * Sekcje paczki (markdown z serwera) do podglądu składu: nagłówek `# …` jako „Nagłówek”, potem każde `## …`
 * z szacunkiem tokenów. Linie wewnątrz bloków kodu (np. `## main` ze `git status -sb`) nie otwierają sekcji.
 */
export function packSections(markdown: string): PackSection[] {
  const sections: { name: string; lines: string[] }[] = [{ name: "Nagłówek", lines: [] }];
  let fenced = false;
  for (const line of markdown.split("\n")) {
    if (line.startsWith("```")) fenced = !fenced;
    const heading = !fenced && /^## (.+?)\s*$/.exec(line);
    if (heading) {
      sections.push({ name: heading[1], lines: [line] });
    } else {
      sections[sections.length - 1].lines.push(line);
    }
  }
  return sections
    .map((s) => ({ name: s.name, tokens: estimateTokens(s.lines.join("\n")) }))
    .filter((s) => s.tokens > 0);
}
