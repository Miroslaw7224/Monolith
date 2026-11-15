import type { CodexDto, RunDto } from "@/contexts/bc_codex/schemas";
import i18n, { currentLang, type Lang } from "@/src/i18n";

export type CodexOk = Extract<CodexDto, { status: "ok" }>;
export type SectionDto = CodexOk["sections"][number];
export type RuleDto = CodexOk["rules"][number];
export type LevelFilter = "all" | "must" | "should";

/**
 * Sekcje z regułami spełniającymi filtr poziomu i zapytanie (ID albo tekst, bez względu na wielkość
 * liter). Bez filtra zwraca wejście bez zmian. Przy aktywnym filtrze bloki tekstowe znikają,
 * a sekcje bez dopasowanych reguł są pomijane.
 */
export function filterCodex(
  sections: SectionDto[],
  rules: RuleDto[],
  level: LevelFilter,
  query: string
): SectionDto[] {
  const q = query.trim().toLowerCase();
  if (level === "all" && q === "") return sections;
  const byId = new Map(rules.map((rule) => [rule.id, rule]));
  const matches = (rule: RuleDto | undefined): boolean =>
    rule !== undefined &&
    (level === "all" || rule.level.toLowerCase() === level) &&
    (q === "" || rule.id.toLowerCase().includes(q) || rule.text.toLowerCase().includes(q));
  const result: SectionDto[] = [];
  for (const section of sections) {
    const blocks = section.blocks.filter(
      (block) => block.kind === "rule" && matches(byId.get(block.ruleId))
    );
    if (blocks.length > 0) result.push({ ...section, blocks });
  }
  return result;
}

export function countLevels(rules: RuleDto[]): { all: number; must: number; should: number } {
  const must = rules.filter((rule) => rule.level === "MUST").length;
  return { all: rules.length, must, should: rules.length - must };
}

export function sectionLevelCounts(
  section: SectionDto,
  rules: RuleDto[]
): { must: number; should: number } {
  const byId = new Map(rules.map((rule) => [rule.id, rule]));
  const own = section.blocks.flatMap((block) =>
    block.kind === "rule" ? [byId.get(block.ruleId)] : []
  );
  return {
    must: own.filter((rule) => rule?.level === "MUST").length,
    should: own.filter((rule) => rule?.level === "SHOULD").length,
  };
}

export function checklistProgress(
  items: { id: string }[],
  run: RunDto | undefined
): { done: number; total: number; pct: number } {
  const total = items.length;
  const done = items.filter((item) => run?.items[item.id]?.checked === true).length;
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export type AlertItem = { tag: string; text: string };

/**
 * Pozycje panelu ostrzeżeń: ostrzeżenia parsera oraz jedna zbiorcza pozycja za uszkodzone linie dziennika
 * i jedna za niedokończoną ostatnią linię. Długość tablicy = liczba na kaflu „Stan walidacji”.
 */
export function alertItems(
  warnings: CodexOk["warnings"],
  skippedLines: number,
  unterminatedTail: boolean,
  journalName: string | null,
  lang: Lang = currentLang()
): AlertItem[] {
  const items: AlertItem[] = warnings.map((w) => ({
    tag:
      w.kind === "duplicate-id"
        ? i18n.t("codex:codexTagDuplicateId", { lng: lang })
        : i18n.t("codex:codexTagMissingRule", { lng: lang }),
    text: w.message,
  }));
  const file = journalName ?? i18n.t("codex:codexJournalDefault", { lng: lang });
  const eventLog = i18n.t("codex:codexTagEventLog", { lng: lang });
  if (skippedLines > 0) {
    items.push({
      tag: eventLog,
      text: i18n.t("codex:codexSkippedLines", { count: skippedLines, file, lng: lang }),
    });
  }
  if (unterminatedTail) {
    items.push({
      tag: eventLog,
      text: i18n.t("codex:codexUnterminatedTail", { file, lng: lang }),
    });
  }
  return items;
}
