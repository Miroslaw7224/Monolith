"use client";

import React from "react";
import { useT } from "@/src/i18n/useT";
import type { CodexOk } from "./codexFilters";
import { sectionLevelCounts } from "./codexFilters";

type Props = {
  data: CodexOk;
  activeId: string | null;
  onSelect: (id: string) => void;
};

function badge(must: number, should: number): string {
  const parts = [];
  if (must > 0) parts.push(`${must} MUST`);
  if (should > 0) parts.push(`${should} SHOULD`);
  return parts.join(" · ");
}

export function CodexToc({ data, activeId, onSelect }: Props) {
  const t = useT();
  const hasChecklists = data.checklists.length > 0;
  const total = data.sections.length + (hasChecklists ? 1 : 0);
  const link = (id: string, label: string, badgeText: string) => (
    <li key={id}>
      <a
        href={`#${id}`}
        className={`kod-toc__link${activeId === id ? " kod-toc__link--active" : ""}`}
        onClick={(event) => {
          event.preventDefault();
          onSelect(id);
        }}
      >
        <span>{label}</span>
        {badgeText ? <span className="kod-toc__badge">{badgeText}</span> : null}
      </a>
    </li>
  );
  return (
    <aside className="kod-toc" aria-label={t("codex:codexTocAria")}>
      <div className="kod-toc__head">
        <h2 className="kod-toc__title">{t("codex:codexTocTitle")}</h2>
        <span className="kod-toc__badge">{t("codex:codexTocSections", { count: total })}</span>
      </div>
      <nav>
        <ul className="kod-toc__list">
          {data.sections.map((section) => {
            const counts = sectionLevelCounts(section, data.rules);
            return link(section.id, section.title, badge(counts.must, counts.should));
          })}
          {hasChecklists
            ? link(
                "sec-checklisty",
                t("codex:codexTocChecklists", { n: data.sections.length + 1 }),
                t("codex:codexTocSetCount", { count: data.checklists.length })
              )
            : null}
        </ul>
      </nav>
      <div className="kod-toc__meta">
        <div className="kod-toc__meta-item">
          {t("codex:codexTocSourceFile")} <b>{data.path.split("/").pop()}</b>
        </div>
        <div className="kod-toc__meta-item">
          {t("codex:codexTocConvention")} <b>Knowledge/</b>
        </div>
        {data.wikilinks.length > 0 ? (
          <div className="kod-toc__meta-item">
            {t("codex:codexTocLink")}{" "}
            <b>{data.wikilinks.map((name) => `[[${name}]]`).join(", ")}</b>
          </div>
        ) : null}
        <div className="kod-toc__meta-item">
          {t("codex:codexTocParser")} <b>{t("codex:codexTocParserPattern")}</b>
        </div>
      </div>
    </aside>
  );
}
