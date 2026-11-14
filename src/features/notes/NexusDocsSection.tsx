import React, { useMemo, useState } from "react";
import type { NexusDocSummaryDto } from "@/contexts/bc_nexus_docs/schemas";
import { cn } from "@/src/lib/cn";
import { collectNexusTags, filterNexusDocs, groupNexusDocs } from "./nexusTree";

export interface NexusDocsSectionProps {
  docs: NexusDocSummaryDto[];
  error: string | null;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

/** Sekcja „Baza wiedzy NEXUS” w lewej kolumnie panelu Notatki (tylko odczyt). */
export function NexusDocsSection({ docs, error, selectedPath, onSelect }: NexusDocsSectionProps) {
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  const visible = useMemo(() => filterNexusDocs(docs, query, activeTag), [docs, query, activeTag]);
  const folders = useMemo(() => groupNexusDocs(visible), [visible]);
  const tags = useMemo(() => collectNexusTags(docs), [docs]);
  const forceOpen = query.trim() !== "" || activeTag !== null;

  return (
    <section className="not-nexus" aria-label="Baza wiedzy NEXUS">
      <div className="not-sidebar__head">
        <h2 className="not-sidebar__title">
          <b>Baza wiedzy NEXUS</b> · tylko odczyt
        </h2>
        <span className="chip not-chip">{docs.length}</span>
      </div>

      <input
        className="input"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Szukaj w bazie NEXUS…"
        aria-label="Filtruj bazę NEXUS"
      />

      {error ? (
        <p className="not-state">{error}</p>
      ) : docs.length === 0 ? (
        <p className="not-state">Brak dokumentów NEXUS</p>
      ) : visible.length === 0 ? (
        <p className="not-state">Brak wyników</p>
      ) : (
        <ul className="not-tree">
          {folders.map((folder) => {
            const open =
              toggled[folder.key] ??
              (forceOpen || folder.docs.some((doc) => doc.path === selectedPath));
            return (
              <li key={folder.key} className="not-folder">
                <button
                  type="button"
                  className="not-folder__name"
                  aria-expanded={open}
                  onClick={() => setToggled((prev) => ({ ...prev, [folder.key]: !open }))}
                >
                  <span>
                    {open ? "▾" : "▸"} {folder.label}
                  </span>
                  <span className="muted">{folder.docs.length}</span>
                </button>
                {open ? (
                  <ul className="not-files">
                    {folder.docs.map((doc) => {
                      const isActive = doc.path === selectedPath;
                      return (
                        <li key={doc.path}>
                          <button
                            type="button"
                            onClick={() => onSelect(doc.path)}
                            className={cn("not-file", isActive && "not-file--active")}
                            aria-current={isActive ? "page" : undefined}
                            title={doc.path}
                          >
                            <span className="not-file__name">{doc.title}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {tags.length > 0 ? (
        <div className="not-tags-sec">
          <h3 className="not-tags-title">Tagi NEXUS</h3>
          <div className="not-tags-wrap">
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                className={cn("chip", activeTag === tag && "chip--accent")}
                aria-pressed={activeTag === tag}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
