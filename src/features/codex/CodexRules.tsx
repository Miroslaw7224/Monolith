"use client";

import React from "react";
import { markdownToHtml } from "@/lib/markdown/html-markdown";
import { useT } from "@/src/i18n/useT";
import type { CodexOk, LevelFilter, SectionDto } from "./codexFilters";
import { countLevels } from "./codexFilters";

type Props = {
  data: CodexOk;
  /** Sekcje po filtrach (puste = brak dopasowań). */
  sections: SectionDto[];
  level: LevelFilter;
  query: string;
  highlightId: string | null;
  onLevel: (level: LevelFilter) => void;
  onQuery: (query: string) => void;
  onJump: (ruleId: string) => void;
};

export const ruleElementId = (ruleId: string): string => `rule-${ruleId.toLowerCase()}`;

function Markdown({ source, className }: { source: string; className: string }) {
  // `markdownToHtml`: markdown-it z `html: false`, więc surowy HTML z pliku jest escapowany.
  return <div className={className} dangerouslySetInnerHTML={{ __html: markdownToHtml(source) }} />;
}

export function CodexRules({
  data,
  sections,
  level,
  query,
  highlightId,
  onLevel,
  onQuery,
  onJump,
}: Props) {
  const t = useT();
  const counts = countLevels(data.rules);
  const byId = new Map(data.rules.map((rule) => [rule.id, rule]));
  const filters: { id: LevelFilter; label: string }[] = [
    { id: "all", label: t("codex:codexFilterAll", { count: counts.all }) },
    { id: "must", label: t("codex:codexFilterMust", { count: counts.must }) },
    { id: "should", label: t("codex:codexFilterShould", { count: counts.should }) },
  ];
  return (
    <section className="kod-rules" aria-label={t("codex:codexRulesAria")}>
      <div className="kod-toolbar">
        <div className="kod-toolbar__row">
          <input
            type="search"
            className="input kod-search"
            placeholder={t("codex:codexSearchPlaceholder")}
            aria-label={t("codex:codexSearchAria")}
            value={query}
            onChange={(event) => onQuery(event.target.value)}
          />
          <div
            className="kod-filter-group"
            role="group"
            aria-label={t("codex:codexLevelFilterAria")}
          >
            {filters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                className="kod-filter-btn"
                aria-pressed={level === filter.id}
                onClick={() => onLevel(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="stack" style={{ ["--gap" as string]: "var(--s-5)" }}>
        {sections.length === 0 ? (
          <div className="kod-empty-filter">{t("codex:codexEmptyFilter")}</div>
        ) : (
          sections.map((section) => {
            const ruleCount = section.blocks.filter((block) => block.kind === "rule").length;
            return (
              <article key={section.id} id={section.id} className="kod-section">
                <div className="kod-section__head">
                  <h2 className="kod-section__title">{section.title}</h2>
                  <span className="kod-section__meta">
                    {t("codex:codexRuleCount", { count: ruleCount })}
                  </span>
                </div>
                {section.blocks.map((block, index) => {
                  if (block.kind === "text") {
                    return (
                      <Markdown
                        key={`text-${index}`}
                        source={block.text}
                        className="kod-text-block"
                      />
                    );
                  }
                  const rule = byId.get(block.ruleId);
                  if (!rule) return null;
                  const elementId = ruleElementId(rule.id);
                  return (
                    <div
                      key={rule.id}
                      id={elementId}
                      className={`kod-rule${highlightId === rule.id ? " kod-rule--highlight" : ""}`}
                      data-level={rule.level.toLowerCase()}
                      data-id={rule.id}
                    >
                      <div className="kod-rule__top">
                        <div className="kod-rule__id-group">
                          <a
                            href={`#${elementId}`}
                            className="kod-rule__anchor"
                            title={t("codex:codexRuleAnchorTitle", { id: rule.id })}
                            onClick={(event) => {
                              event.preventDefault();
                              onJump(rule.id);
                            }}
                          >
                            #{rule.id}
                          </a>
                          <span
                            className={
                              rule.level === "MUST" ? "kod-badge-must" : "kod-badge-should"
                            }
                          >
                            {rule.level}
                          </span>
                        </div>
                        <span className="chip">{rule.id.split("-")[0]}</span>
                      </div>
                      <Markdown source={rule.text} className="kod-rule__content" />
                    </div>
                  );
                })}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
