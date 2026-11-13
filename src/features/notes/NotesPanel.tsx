import React, { type ComponentProps } from "react";
import dynamic from "next/dynamic";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { markdownToHtml } from "@/lib/markdown/html-markdown";
import { cn } from "@/src/lib/cn";
import type { Note } from "./useNotesData";
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
}: NotesPanelProps) {
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
  const notesCountLabel = `${notes.length} ${notes.length === 1 ? "notatka" : "notatek"}`;
  const subText = activeTitle
    ? `${notesCountLabel} · aktywna: ${activeTitle}`
    : `${notesCountLabel} w bazie`;

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
          {noteEditMode || (selectedNote && selectedNote.id === "") ? (
            <>
              {selectedNote && selectedNote.id !== "" && (
                <button
                  type="button"
                  onClick={() => setNoteEditMode(false)}
                  className="btn not-btn"
                >
                  {noteCancelEdit}
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
                className="btn btn--primary not-btn--primary"
              >
                {saveNote}
              </button>
            </>
          ) : selectedNote ? (
            <>
              <button type="button" onClick={() => setNoteEditMode(true)} className="btn not-btn">
                <Pencil className="w-4 h-4" />
                {noteEdit}
              </button>
              <button
                type="button"
                onClick={() => onDeleteNote(selectedNote.id)}
                className="btn not-btn not-btn--danger"
                title={deleteNote}
                aria-label={deleteNote}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          ) : null}
        </div>
      </header>

      <div className="not-layout">
        <aside className="not-sidebar" data-testid="notes-sidebar-list" aria-label="Lista notatek">
          <div className="not-sidebar__head">
            <h2 className="not-sidebar__title">
              <b>Pliki</b> · Markdown
            </h2>
            <span className="chip not-chip">{notes.length}</span>
          </div>

          {notes.length === 0 ? (
            <p className="not-state">Brak notatek</p>
          ) : (
            <ul className="not-files">
              {notes.map((note) => {
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
          )}
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
                  <span className={cn("chip not-chip", noteEditMode ? "chip--warn" : "chip--ok")}>
                    {noteEditMode ? "edycja" : "zsynchronizowany"}
                  </span>
                  <div className="tabs not-tabs" role="tablist">
                    <button
                      type="button"
                      className="tabs__btn not-tabs__btn"
                      role="tab"
                      aria-selected={!noteEditMode}
                      onClick={() => setNoteEditMode(false)}
                    >
                      Podgląd
                    </button>
                    <button
                      type="button"
                      className="tabs__btn not-tabs__btn"
                      role="tab"
                      aria-selected={noteEditMode}
                      onClick={() => setNoteEditMode(true)}
                    >
                      Edycja
                    </button>
                  </div>
                </div>
              </div>

              <article className="not-sheet">
                {noteEditMode || selectedNote.id === "" ? (
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
                      content={selectedNote.content}
                      onContentChange={(markdown) =>
                        setSelectedNote({ ...selectedNote, content: markdown })
                      }
                      placeholder={noteContentPlaceholder}
                    />
                  </div>
                ) : (
                  <div className="not-sheet__body">
                    <h1 className="not-h1">{selectedNote.title || noteTitlePlaceholder}</h1>
                    <div
                      className="not-prose"
                      dangerouslySetInnerHTML={{
                        __html:
                          markdownToHtml(selectedNote.content) ||
                          '<p class="not-placeholder">' + noteContentPlaceholder + "</p>",
                      }}
                    />
                  </div>
                )}
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
      </div>
    </div>
  );
}
