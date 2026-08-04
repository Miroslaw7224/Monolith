import React from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/src/lib/cn";
import { NoteEditor } from "@/src/components/NoteEditor";
import type { Note } from "./useNotesData";

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
  return (
    <div className="flex-1 flex overflow-hidden">
      <div
        data-testid="notes-sidebar-list"
        className="w-64 border-r border-[var(--border)] bg-[var(--surface)] overflow-y-auto p-4 space-y-2"
      >
        <button
          onClick={() => {
            setSelectedNote({
              id: "",
              title: "",
              content: "",
              created_at: "",
            });
            setNoteEditMode(true);
          }}
          className="w-full flex items-center gap-2 p-3 bg-[var(--accent)] text-white rounded-xl text-sm font-semibold hover:scale-[1.02] transition-all mb-4"
        >
          <Plus className="w-4 h-4" />
          {newNote}
        </button>
        {notes.map((note) => (
          <button
            key={note.id}
            onClick={() => {
              setSelectedNote(note);
              setNoteEditMode(false);
            }}
            className={cn(
              "w-full text-left p-3 rounded-xl transition-all border",
              selectedNote?.id === note.id
                ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                : "bg-[var(--surface)] text-[var(--text)] border-transparent hover:bg-[var(--bg3)]"
            )}
          >
            <p className="text-sm font-bold truncate">{note.title || "Untitled"}</p>
            <p
              className={cn(
                "text-[10px] uppercase font-bold",
                selectedNote?.id === note.id ? "text-white/60" : "text-[var(--text3)]"
              )}
            >
              {new Date(note.created_at).toLocaleDateString()}
            </p>
          </button>
        ))}
      </div>
      <div className="flex-1 bg-[var(--surface)] p-8 overflow-y-auto min-w-0">
        {selectedNote ? (
          <div className="w-full max-w-full space-y-6">
            {noteEditMode || selectedNote.id === "" ? (
              <>
                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    value={selectedNote.title}
                    onChange={(e) => setSelectedNote({ ...selectedNote, title: e.target.value })}
                    placeholder={noteTitlePlaceholder}
                    className="text-3xl font-bold border-none focus:ring-0 w-full p-0"
                  />
                  <div className="flex items-center gap-2">
                    {selectedNote.id !== "" && (
                      <>
                        <button
                          onClick={() => setNoteEditMode(false)}
                          className="px-4 py-2 border border-[var(--border)] rounded-xl text-sm font-semibold text-[var(--text)] hover:bg-[var(--bg2)] transition-all"
                        >
                          {noteCancelEdit}
                        </button>
                        <button
                          onClick={() => onDeleteNote(selectedNote.id)}
                          className="p-2 hover:bg-red-50 text-red-400 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={onSaveNote}
                      className="px-4 py-2 bg-[var(--accent)] text-white rounded-xl text-sm font-semibold hover:scale-105 transition-all"
                    >
                      {saveNote}
                    </button>
                  </div>
                </div>
                <NoteEditor
                  key={selectedNote.id || "new"}
                  content={selectedNote.content}
                  onContentChange={(html) => setSelectedNote({ ...selectedNote, content: html })}
                  placeholder={noteContentPlaceholder}
                />
              </>
            ) : (
              <>
                <div className="flex items-center justify-between gap-4">
                  <h1 className="text-3xl font-bold text-[var(--text)] flex-1 min-w-0">
                    {selectedNote.title || noteTitlePlaceholder}
                  </h1>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => setNoteEditMode(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-xl text-sm font-semibold hover:scale-105 transition-all"
                    >
                      <Pencil className="w-4 h-4" />
                      {noteEdit}
                    </button>
                    <button
                      onClick={() => onDeleteNote(selectedNote.id)}
                      className="p-2 hover:bg-red-50 text-red-400 rounded-lg transition-colors"
                      title={deleteNote}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div
                  className="prose prose-lg max-w-none min-h-[20vh] text-[var(--text)] leading-relaxed prose-p:my-2 prose-headings:font-bold prose-headings:text-[var(--text)]"
                  dangerouslySetInnerHTML={{
                    __html: selectedNote.content
                      ? selectedNote.content.trim().startsWith("<")
                        ? selectedNote.content
                        : `<p>${selectedNote.content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`
                      : '<p class="text-[var(--text3)]">' + noteContentPlaceholder + "</p>",
                  }}
                />
              </>
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-[var(--bg3)] rounded-2xl flex items-center justify-center mb-4">
              <Plus className="w-8 h-8 text-[var(--text3)]" />
            </div>
            <p className="text-[var(--text3)] font-medium">{newNote}</p>
          </div>
        )}
      </div>
    </div>
  );
}
