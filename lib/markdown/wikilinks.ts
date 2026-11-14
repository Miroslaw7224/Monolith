import type MarkdownIt from "markdown-it";
import { createMarkdown } from "./html-markdown";

/** `cel` (bez aliasu i `#nagłówka`) → ścieżka dokumentu albo `null`, gdy cel jest nieznany. */
export type WikiResolve = (target: string) => string | null;

type InlineRule = Parameters<MarkdownIt["inline"]["ruler"]["push"]>[1];
type InlineState = Parameters<InlineRule>[0];

const MISSING_TITLE = "poza bazą NEXUS w tym panelu";

/**
 * Reguła inline `[[cel|alias#nagłówek]]`. Jako reguła inline nie widzi bloków kodu ani code span,
 * a w tekście zwykłego linku `[...](...)` zostawia tekst (`linkLevel` > 0), żeby nie zagnieżdżać `<a>`.
 */
export function wikilinksPlugin(md: MarkdownIt, resolve: WikiResolve): void {
  const rule: InlineRule = (state: InlineState, silent: boolean) => {
    const src = state.src;
    const start = state.pos;
    if (src.charCodeAt(start) !== 0x5b || src.charCodeAt(start + 1) !== 0x5b) return false;
    // Tryb `silent` służy m.in. do skanowania etykiety linku `[...](...)`: gdy reguła połknie tam token
    // zaczynający się od `[`, markdown-it uznaje go za zagnieżdżony link i odrzuca cały link.
    // Dlatego nie konsumujemy w `silent`; właściwe parsowanie (z `linkLevel` > 0) zostawia tekst.
    if (silent) return false;
    const end = src.indexOf("]]", start + 2);
    if (end === -1 || end + 2 > state.posMax) return false;
    const inner = src.slice(start + 2, end);
    if (/[[\]\n]/.test(inner)) return false;
    const bar = inner.indexOf("|");
    const head = bar === -1 ? inner : inner.slice(0, bar);
    const alias = bar === -1 ? "" : inner.slice(bar + 1).trim();
    const target = head.split("#")[0].trim();
    if (target === "") return false;
    if (!silent) {
      const inLink = (state as unknown as { linkLevel: number }).linkLevel > 0;
      if (inLink) {
        const text = state.push("text", "", 0);
        text.content = src.slice(start, end + 2);
      } else {
        const token = state.push("wikilink", "", 0);
        token.content = alias !== "" ? alias : head.trim();
        token.meta = { path: resolve(target) };
      }
    }
    state.pos = end + 2;
    return true;
  };
  md.inline.ruler.before("link", "wikilink", rule);
  md.renderer.rules.wikilink = (tokens, idx) => {
    const token = tokens[idx];
    const label = md.utils.escapeHtml(token.content);
    const path = (token.meta as { path: string | null }).path;
    if (path === null) {
      return `<span class="not-wikilink not-wikilink--missing" title="${MISSING_TITLE}">${label}</span>`;
    }
    return `<a class="not-wikilink" href="#" data-nexus-path="${md.utils.escapeHtml(path)}">${label}</a>`;
  };
}

/** Markdown → HTML z wikilinkami rozwiązywanymi przez `resolve`; pusty tekst daje "". */
export function markdownToHtmlWithWikilinks(source: string, resolve: WikiResolve): string {
  if (source.trim() === "") return "";
  const md = createMarkdown();
  md.use(wikilinksPlugin, resolve);
  return md.render(source);
}
