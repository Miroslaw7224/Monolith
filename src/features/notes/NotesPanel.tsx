import React, { type ComponentProps, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { markdownToHtml } from "@/lib/markdown/html-markdown";
import { cn } from "@/src/lib/cn";
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
}: NotesPanelProps) {
  const [filter, setFilter] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [split, setSplit] = useState(false);

  const handleCreateNew = () => {
    setSelectedNote({
      id: "",
      title: "",
      content: "",
      created_at: "",
    });
    setNoteEditMode(true);
  };

  const activeTitle = selectedNote ? selectedNote.title || "Untitled" : null;
  const lastTwo = notes.length % 100;
  const lastOne = notes.length % 10;
  const noun =
    notes.length === 1
      ? "notatka"
      : lastOne >= 2 && lastOne <= 4 && !(lastTwo >= 12 && lastTwo <= 14)
        ? "notatki"
        : "notatek";
  const notesCountLabel = `${notes.length} ${noun}`;
  const subText = activeTitle
    ? `${notesCountLabel} · aktywna: ${activeTitle}`
    : `${notesCountLabel} w bazie`;

  // Nowa (niezapisana) notatka zawsze pokazuje formularz, więc zakładka i chip mają to odzwierciedlać.
  const editing = noteEditMode || (selectedNote !== null && selectedNote.id === "");
  const showSplit = split && editing;

  const tiles = useMemo(() => computeNoteTiles(notes, new Date(), inboxOpen), [notes, inboxOpen]);
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
          <p className="view-head__eyebrow not-eyebrow">Alt+5 · Notatki</p>
          <h1 className="view-head__title not-title">Baza wiedzy i notatki</h1>
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
          <button
            type="button"
            onClick={onSaveNote}
            disabled={!editing}
            className="btn btn--primary not-btn--primary"
          >
            {saveNote} (Ctrl+S)
          </button>
        </div>
      </header>

      <section className="tiles not-tiles" aria-label="Statystyki bazy wiedzy">
        {tiles.map((tile) => (
          <div key={tile.id} className={cn("tile", tile.accent && "tile--accent")}>
            <span className="tile__label">{tile.label}</span>
            <span className="tile__value">{tile.value}</span>
            <span className="tile__meta">{tile.meta}</span>
          </div>
        ))}
      </section>

      <div className="not-layout">
        <aside className="not-sidebar" data-testid="notes-sidebar-list" aria-label="Lista notatek">
          <div className="not-sidebar__head">
            <h2 className="not-sidebar__title">
              <b>Pliki</b> · Markdown
            </h2>
            <span className="chip not-chip">{notes.length}</span>
          </div>

          <input
            className="input"
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Szukaj notatki…"
            aria-label="Filtruj notatki"
          />

          {notes.length === 0 ? (
            <p className="not-state">Brak notatek</p>
          ) : visibleNotes.length === 0 ? (
            <p className="not-state">Brak wyników</p>
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
                            setSelectedNote(note);
                            setNoteEditMode(false);
                          }}
                          className={cn("not-file", isActive && "not-file--active")}
                          aria-current={isActive ? "page" : undefined}
                        >
                          <span className="not-file__name">{note.title || "Untitled"}</span>
                          {note.created_at ? (
                            <span className="not-file__meta">
                              {new Date(note.created_at).toLocaleDateString()}
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
            <h3 className="not-tags-title">Popularne tagi</h3>
            {popularTags.length === 0 ? (
              <p className="not-state">Brak tagów we frontmatterze</p>
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
        </aside>

        <main className="not-editor-col">
          {selectedNote ? (
            <div className="not-editor-wrap">
              <div className="not-toolbar">
                <div className="not-toolbar__path">
                  <span>Notatki/</span>
                  <b>{selectedNote.title || "Untitled"}</b>
                </div>
                <div className="not-toolbar__tools">
                  <span className={cn("chip not-chip", editing ? "chip--warn" : "chip--ok")}>
                    {editing ? "edycja" : "podgląd"}
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
                      Podgląd
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
                      Edycja
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
                          <span>--- FRONTMATTER ---</span>
                          <span>Markdown</span>
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

        <aside className="not-meta-col" aria-label="Szczegóły i powiązania notatki">
          <section className="not-card">
            <div className="not-card__head">
              <h3 className="not-card__title">
                <b>Metadane</b> · plik
              </h3>
              <span className="chip">Markdown</span>
            </div>
            {selectedNote ? (
              <dl className="not-kv">
                <dt>Utworzono</dt>
                <dd>
                  {selectedNote.created_at
                    ? new Date(selectedNote.created_at).toLocaleString("pl-PL", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })
                    : "—"}
                </dd>
                <dt>Rozmiar</dt>
                <dd>
                  {formatSize(selectedNote.content)} ({countWords(doc?.body ?? "")} słów)
                </dd>
                <dt>Tagi</dt>
                <dd>{docTags.length > 0 ? docTags.map((t) => `#${t}`).join(" ") : "—"}</dd>
              </dl>
            ) : (
              <p className="not-state">Wybierz notatkę</p>
            )}
          </section>

          <section className="not-card">
            <div className="not-card__head">
              <h3 className="not-card__title">
                <b>Linki zwrotne</b>
              </h3>
              <span className="chip">backlinks</span>
            </div>
            <p className="not-state">Wkrótce: indeks linków [[wiki]] między notatkami</p>
          </section>

          <section className="not-card">
            <div className="not-card__head">
              <h3 className="not-card__title">
                <b>Baza decyzji</b> · devlogi
              </h3>
              <span className="chip">wkrótce</span>
            </div>
            <input
              className="input not-decisions-input"
              type="search"
              disabled
              placeholder="Szukaj decyzji we wszystkich devlogach…"
              aria-label="Szukaj decyzji"
            />
            <p className="not-state">Wymaga agregacji devlogów wszystkich projektów</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
