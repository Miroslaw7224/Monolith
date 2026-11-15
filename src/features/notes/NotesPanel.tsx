import React, { type ComponentProps, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { markdownToHtml } from "@/lib/markdown/html-markdown";
import { cn } from "@/src/lib/cn";
import { formatShortDate, formatShortDateTime } from "@/src/i18n/format";
import { useLang } from "@/src/i18n/useLang";
import { useT } from "@/src/i18n/useT";
import { NexusDocsSection } from "./NexusDocsSection";
import { NexusDocView } from "./NexusDocView";
import { useNexusDocs, type ApiFetch } from "./useNexusDocs";
import type { Note } from "./useNotesData";
import {
  collectPopularTags,
  computeNoteTiles,
  countWords,
  extractTags,
  joinFrontmatter,
  splitFrontmatter,
} from "./noteMeta";
import "./notes.css";

const NoteEditor = dynamic<
  ComponentProps<typeof import("@/src/components/note-editor/NoteEditor").NoteEditor>
>(() => import("@/src/components/note-editor/NoteEditor").then((mod) => mod.NoteEditor), {
  loading: () => <div className="min-h-[60vh]" />,
});

export interface NotesPanelProps {
  notes: Note[];
  selectedNote: Note | null;
  setSelectedNote: (note: Note | null) => void;
  noteEditMode: boolean;
  setNoteEditMode: (v: boolean) => void;
  onSaveNote: () => Promise<void>;
  onDeleteNote: (id: string) => void;
  newNote: string;
  noteTitlePlaceholder: string;
  noteContentPlaceholder: string;
  noteCancelEdit: string;
  saveNote: string;
  noteEdit: string;
  deleteNote: string;
  /** Liczba otwartych wpisów Inboxu do kafla; `null`/brak = brak danych. */
  inboxOpen?: number | null;
  /** Gdy podane, panel pokazuje sekcję „Baza wiedzy NEXUS” (tylko odczyt). */
  apiFetch?: ApiFetch;
  /** Dokument NEXUS do otwarcia przy wejściu do panelu (np. z mostu w Arsenale). */
  initialNexusPath?: string | null;
  /** Wołane raz po zużyciu `initialNexusPath`, żeby rodzic wyczyścił stan. */
  onInitialNexusPathConsumed?: () => void;
}

function formatSize(text: string): string {
  const bytes = new TextEncoder().encode(text).length;
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

export function NotesPanel({
  notes,
  selectedNote,
  setSelectedNote,
  noteEditMode,
  setNoteEditMode,
  onSaveNote,
  onDeleteNote,
  newNote,
  noteTitlePlaceholder,
  noteContentPlaceholder,
  noteCancelEdit,
  saveNote,
  noteEdit,
  deleteNote,
  inboxOpen = null,
  apiFetch,
  initialNexusPath,
  onInitialNexusPathConsumed,
}: NotesPanelProps) {
  const t = useT();
  const { lang } = useLang();
  const [filter, setFilter] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [split, setSplit] = useState(false);
  const [nexusPath, setNexusPath] = useState<string | null>(initialNexusPath ?? null);
  useEffect(() => {
    if (initialNexusPath) {
      setSelectedNote(null);
      setNoteEditMode(false);
      onInitialNexusPathConsumed?.();
    }
    // tylko przy montowaniu: panel jest montowany warunkowo przy wejściu na kartę Notatki
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const nexus = useNexusDocs(apiFetch);
  const nexusDoc = useMemo(
    () => nexus.docs.find((d) => d.path === nexusPath) ?? null,
    [nexus.docs, nexusPath]
  );

  const selectNexus = (path: string) => {
    setNexusPath(path);
    setSelectedNote(null);
    setNoteEditMode(false);
  };

  const handleCreateNew = () => {
    setNexusPath(null);
    setSelectedNote({
      id: "",
      title: "",
      content: "",
      created_at: "",
    });
    setNoteEditMode(true);
  };

  const activeTitle = selectedNote ? selectedNote.title || t("notes:notesUntitled") : null;
  const countLabel = t("notes:notesPanelCount", { count: notes.length });
  const subText = activeTitle
    ? t("notes:notesPanelSubtitleActive", { count: countLabel, title: activeTitle })
    : t("notes:notesPanelSubtitleInBase", { count: countLabel });

  // Nowa (niezapisana) notatka zawsze pokazuje formularz, więc zakładka i chip mają to odzwierciedlać.
  const editing = noteEditMode || (selectedNote !== null && selectedNote.id === "");
  const showSplit = split && editing;

  const tiles = useMemo(
    () => computeNoteTiles(notes, new Date(), inboxOpen, lang),
    [notes, inboxOpen, lang]
  );
  const popularTags = useMemo(() => collectPopularTags(notes), [notes]);
  const visibleNotes = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return notes.filter((n) => {
      if (q && !`${n.title}\n${n.content}`.toLowerCase().includes(q)) return false;
      if (activeTag && !extractTags(splitFrontmatter(n.content).frontmatter).includes(activeTag)) {
        return false;
      }
      return true;
    });
  }, [notes, filter, activeTag]);

  const doc = useMemo(
    () => (selectedNote ? splitFrontmatter(selectedNote.content) : null),
    [selectedNote]
  );
  const docTags = useMemo(() => extractTags(doc?.frontmatter ?? null), [doc]);

  // Split ma sens tylko podczas edycji: po wyjściu z niej kolejne „Edytuj” otwiera zwykłą edycję.
  useEffect(() => {
    if (!editing) setSplit(false);
  }, [editing]);

  // Ctrl+S zapisuje notatkę w trybie edycji.
  useEffect(() => {
    if (!editing) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void onSaveNote();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editing, onSaveNote]);

  const previewHtml = (body: string) =>
    markdownToHtml(body) || '<p class="not-placeholder">' + noteContentPlaceholder + "</p>";

  return (
    <div className="not flex-1 min-w-0 flex flex-col overflow-auto" data-card="notatki">
      <header className="view-head not-head">
        <div>
          <p className="view-head__eyebrow not-eyebrow">Alt+5 · {t("shell:cards.notatki")}</p>
          <h1 className="view-head__title not-title">{t("notes:notesPanelTitle")}</h1>
          <p className="view-head__sub not-sub">{subText}</p>
        </div>
        <div className="view-head__actions not-head__actions">
          <button type="button" onClick={handleCreateNew} className="btn not-btn">
            <Plus className="w-4 h-4" />
            {newNote}
          </button>
          {editing && selectedNote && selectedNote.id !== "" && (
            <button type="button" onClick={() => setNoteEditMode(false)} className="btn not-btn">
              {noteCancelEdit}
            </button>
          )}
          {!editing && selectedNote && (
            <button type="button" onClick={() => setNoteEditMode(true)} className="btn not-btn">
              <Pencil className="w-4 h-4" />
              {noteEdit}
            </button>
          )}
          {selectedNote && selectedNote.id !== "" && (
            <button
              type="button"
              onClick={() => onDeleteNote(selectedNote.id)}
              className="btn not-btn not-btn--danger"
              title={deleteNote}
              aria-label={deleteNote}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          {nexusPath === null && (
            <button
              type="button"
              onClick={onSaveNote}
              disabled={!editing}
              className="btn btn--primary not-btn--primary"
            >
              {saveNote} (Ctrl+S)
            </button>
          )}
        </div>
      </header>

      <section className="tiles not-tiles" aria-label={t("notes:notesTilesAria")}>
        {tiles.map((tile) => (
          <div key={tile.id} className={cn("tile", tile.accent && "tile--accent")}>
            <span className="tile__label">{tile.label}</span>
            <span className="tile__value">{tile.value}</span>
            <span className="tile__meta">{tile.meta}</span>
          </div>
        ))}
      </section>

      <div className="not-layout">
        <aside
          className="not-sidebar"
          data-testid="notes-sidebar-list"
          aria-label={t("notes:notesSidebarListAria")}
        >
          <div className="not-sidebar__head">
            <h2 className="not-sidebar__title">
              <b>{t("notes:notesFilesBold")}</b>
              {t("notes:notesFilesTrail")}
            </h2>
            <span className="chip not-chip">{notes.length}</span>
          </div>

          <input
            className="input"
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t("notes:notesSearchPlaceholder")}
            aria-label={t("notes:notesFilterAria")}
          />

          {notes.length === 0 ? (
            <p className="not-state">{t("notes:notesEmptyNotes")}</p>
          ) : visibleNotes.length === 0 ? (
            <p className="not-state">{t("notes:notesNoResults")}</p>
          ) : (
            <ul className="not-tree">
              <li className="not-folder">
                <div className="not-folder__name">
                  <span>▾ Notes/</span>
                  <span className="muted">{visibleNotes.length}</span>
                </div>
                <ul className="not-files">
                  {visibleNotes.map((note) => {
                    const isActive = selectedNote?.id === note.id;
                    return (
                      <li key={note.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setNexusPath(null);
                            setSelectedNote(note);
                            setNoteEditMode(false);
                          }}
                          className={cn("not-file", isActive && "not-file--active")}
                          aria-current={isActive ? "page" : undefined}
                        >
                          <span className="not-file__name">
                            {note.title || t("notes:notesUntitled")}
                          </span>
                          {note.created_at ? (
                            <span className="not-file__meta">
                              {formatShortDate(new Date(note.created_at))}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            </ul>
          )}

          <div className="not-tags-sec">
            <h3 className="not-tags-title">{t("notes:notesPopularTags")}</h3>
            {popularTags.length === 0 ? (
              <p className="not-state">{t("notes:notesNoFrontmatterTags")}</p>
            ) : (
              <div className="not-tags-wrap">
                {popularTags.map(({ tag }) => (
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
            )}
          </div>

          {apiFetch ? (
            <NexusDocsSection
              docs={nexus.docs}
              error={nexus.error}
              selectedPath={nexusPath}
              onSelect={selectNexus}
            />
          ) : null}
        </aside>

        <main className="not-editor-col">
          {nexusPath !== null && apiFetch ? (
            <NexusDocView
              apiFetch={apiFetch}
              path={nexusPath}
              docs={nexus.docs}
              onNavigate={selectNexus}
            />
          ) : selectedNote ? (
            <div className="not-editor-wrap">
              <div className="not-toolbar">
                <div className="not-toolbar__path">
                  <span>Notatki/</span>
                  <b>{selectedNote.title || t("notes:notesUntitled")}</b>
                </div>
                <div className="not-toolbar__tools">
                  <span className={cn("chip not-chip", editing ? "chip--warn" : "chip--ok")}>
                    {editing ? t("notes:notesChipEditing") : t("notes:notesChipPreview")}
                  </span>
                  <div className="tabs not-tabs" role="tablist">
                    <button
                      type="button"
                      className="tabs__btn not-tabs__btn"
                      role="tab"
                      aria-selected={!editing}
                      disabled={selectedNote.id === ""}
                      onClick={() => {
                        setSplit(false);
                        setNoteEditMode(false);
                      }}
                    >
                      {t("notes:notesTabPreview")}
                    </button>
                    <button
                      type="button"
                      className="tabs__btn not-tabs__btn"
                      role="tab"
                      aria-selected={editing && !showSplit}
                      onClick={() => {
                        setSplit(false);
                        setNoteEditMode(true);
                      }}
                    >
                      {t("notes:notesTabEdit")}
                    </button>
                    <button
                      type="button"
                      className="tabs__btn not-tabs__btn"
                      role="tab"
                      aria-selected={showSplit}
                      onClick={() => {
                        setSplit(true);
                        setNoteEditMode(true);
                      }}
                    >
                      Split
                    </button>
                  </div>
                </div>
              </div>

              <article className={cn("not-sheet", showSplit && "not-sheet--split")}>
                {editing ? (
                  <div className="not-editor-form">
                    <input
                      type="text"
                      value={selectedNote.title}
                      onChange={(e) => setSelectedNote({ ...selectedNote, title: e.target.value })}
                      placeholder={noteTitlePlaceholder}
                      aria-label={noteTitlePlaceholder}
                      className="not-title-input"
                    />
                    <NoteEditor
                      key={selectedNote.id || "new"}
                      format="markdown"
                      content={doc?.body ?? ""}
                      onContentChange={(markdown) =>
                        setSelectedNote({
                          ...selectedNote,
                          content: joinFrontmatter(doc?.frontmatter ?? null, markdown),
                        })
                      }
                      placeholder={noteContentPlaceholder}
                    />
                  </div>
                ) : null}
                {!editing || showSplit ? (
                  <div className="not-sheet__body">
                    {doc?.frontmatter ? (
                      <div className="not-frontmatter">
                        <div className="not-frontmatter__top">
                          <span>{t("notes:notesFrontmatterBanner")}</span>
                          <span>{t("notes:notesFrontmatterMarkdown")}</span>
                        </div>
                        {doc.frontmatter.map((line, i) => (
                          <div key={i}>{line}</div>
                        ))}
                      </div>
                    ) : null}
                    <h1 className="not-h1">{selectedNote.title || noteTitlePlaceholder}</h1>
                    <div
                      className="not-prose"
                      dangerouslySetInnerHTML={{ __html: previewHtml(doc?.body ?? "") }}
                    />
                  </div>
                ) : null}
              </article>
            </div>
          ) : (
            <div className="not-editor-wrap not-editor-wrap--empty">
              <div className="not-empty">
                <div className="not-empty__icon">
                  <Plus className="w-8 h-8" />
                </div>
                <p className="not-empty__text">{newNote}</p>
              </div>
            </div>
          )}
        </main>

        <aside className="not-meta-col" aria-label={t("notes:notesMetaAria")}>
          <section className="not-card">
            <div className="not-card__head">
              <h3 className="not-card__title">
                <b>{t("notes:notesMetaTitleBold")}</b>
                {t("notes:notesMetaTitleTrail")}
              </h3>
              <span className="chip">{t("notes:notesFrontmatterMarkdown")}</span>
            </div>
            {nexusDoc ? (
              <dl className="not-kv">
                <dt>{t("notes:notesPath")}</dt>
                <dd>{nexusDoc.path}</dd>
                <dt>{t("notes:notesArea")}</dt>
                <dd>{nexusDoc.group ? `${nexusDoc.area} / ${nexusDoc.group}` : nexusDoc.area}</dd>
                <dt>{t("notes:notesTags")}</dt>
                <dd>
                  {nexusDoc.tags.length > 0 ? nexusDoc.tags.map((t) => `#${t}`).join(" ") : "—"}
                </dd>
              </dl>
            ) : selectedNote ? (
              <dl className="not-kv">
                <dt>{t("notes:notesCreated")}</dt>
                <dd>
                  {selectedNote.created_at
                    ? formatShortDateTime(new Date(selectedNote.created_at))
                    : "—"}
                </dd>
                <dt>{t("notes:notesSize")}</dt>
                <dd>
                  {formatSize(selectedNote.content)} (
                  {t("notes:notesWordCount", { count: countWords(doc?.body ?? "") })})
                </dd>
                <dt>{t("notes:notesTags")}</dt>
                <dd>{docTags.length > 0 ? docTags.map((tag) => `#${tag}`).join(" ") : "—"}</dd>
              </dl>
            ) : (
              <p className="not-state">{t("notes:notesSelectNote")}</p>
            )}
          </section>

          <section className="not-card">
            <div className="not-card__head">
              <h3 className="not-card__title">
                <b>{t("notes:notesBacklinksBold")}</b>
              </h3>
              <span className="chip">{t("notes:notesChipBacklinks")}</span>
            </div>
            <p className="not-state">{t("notes:notesBacklinksSoon")}</p>
          </section>

          <section className="not-card">
            <div className="not-card__head">
              <h3 className="not-card__title">
                <b>{t("notes:notesDecisionsBold")}</b>
                {t("notes:notesDecisionsTrail")}
              </h3>
              <span className="chip">{t("notes:notesChipSoon")}</span>
            </div>
            <input
              className="input not-decisions-input"
              type="search"
              disabled
              placeholder={t("notes:notesDecisionsSearchPlaceholder")}
              aria-label={t("notes:notesDecisionsSearchAria")}
            />
            <p className="not-state">{t("notes:notesDecisionsSoonMeta")}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
