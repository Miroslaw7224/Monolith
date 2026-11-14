import React, { useMemo } from "react";
import type { NexusDocSummaryDto } from "@/contexts/bc_nexus_docs/schemas";
import { markdownToHtmlWithWikilinks } from "@/lib/markdown/wikilinks";
import { createNexusResolver } from "./nexusLinks";
import { useNexusDoc, type ApiFetch } from "./useNexusDocs";

export interface NexusDocViewProps {
  apiFetch: ApiFetch;
  path: string;
  /** Lista widocznych dokumentów: źródło dla resolvera wikilinków. */
  docs: NexusDocSummaryDto[];
  onNavigate: (path: string) => void;
}

/** Podgląd dokumentu NEXUS: wyłącznie odczyt, karta frontmattera, klikalne wikilinki. */
export function NexusDocView({ apiFetch, path, docs, onNavigate }: NexusDocViewProps) {
  const { doc: fetched, loading, error } = useNexusDoc(apiFetch, path);
  const doc = fetched && fetched.path === path ? fetched : null;
  const resolve = useMemo(() => createNexusResolver(docs.map((d) => d.path)), [docs]);
  const html = useMemo(
    () => (doc ? markdownToHtmlWithWikilinks(doc.body, resolve) : ""),
    [doc, resolve]
  );

  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const link = (e.target as HTMLElement).closest("a[data-nexus-path]");
    if (!link) return;
    e.preventDefault();
    const target = link.getAttribute("data-nexus-path");
    if (target) onNavigate(target);
  };

  return (
    <div className="not-editor-wrap">
      <div className="not-toolbar">
        <div className="not-toolbar__path">
          <span>NEXUS/</span>
          <b>{path}</b>
        </div>
        <div className="not-toolbar__tools">
          <span className="chip not-chip chip--ok" data-testid="nexus-readonly-badge">
            tylko odczyt
          </span>
          <div className="tabs not-tabs" role="tablist">
            <button type="button" className="tabs__btn not-tabs__btn" role="tab" aria-selected>
              Podgląd
            </button>
          </div>
        </div>
      </div>

      <article className="not-sheet">
        <div className="not-sheet__body">
          {loading ? (
            <p className="not-state">Wczytywanie…</p>
          ) : error ? (
            <p className="not-state">{error}</p>
          ) : doc ? (
            <>
              {doc.frontmatter.length > 0 ? (
                <div className="not-frontmatter">
                  <div className="not-frontmatter__top">
                    <span>--- FRONTMATTER ---</span>
                    <span>NEXUS</span>
                  </div>
                  {doc.frontmatter.map((line) => (
                    <div key={line.key}>
                      {line.key}: {line.value}
                    </div>
                  ))}
                </div>
              ) : null}
              <h1 className="not-h1">{doc.title}</h1>
              <div
                className="not-prose"
                onClick={onClick}
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </>
          ) : null}
        </div>
      </article>
    </div>
  );
}
