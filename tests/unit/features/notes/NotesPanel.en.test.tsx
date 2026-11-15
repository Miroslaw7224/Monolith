import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotesPanel, type NotesPanelProps } from "@/src/features/notes/NotesPanel";
import { formatShortDate, formatShortDateTime } from "@/src/i18n/format";
import { setLanguage } from "@/src/i18n";
import { countWords } from "@/src/features/notes/noteMeta";

vi.mock("next/dynamic", () => ({ default: () => () => null }));

afterEach(async () => {
  cleanup();
  await act(async () => {
    await setLanguage("pl");
  });
});

const props = (over: Partial<NotesPanelProps> = {}): NotesPanelProps => ({
  notes: [
    {
      id: "a",
      title: "One",
      content: "one two",
      created_at: "2026-03-02T10:00:00.000Z",
    },
    {
      id: "b",
      title: "Two",
      content: "single",
      created_at: "2026-03-02T10:00:00.000Z",
    },
  ],
  selectedNote: null,
  setSelectedNote: vi.fn(),
  noteEditMode: false,
  setNoteEditMode: vi.fn(),
  onSaveNote: vi.fn(async () => {}),
  onDeleteNote: vi.fn(),
  newNote: "New note",
  noteTitlePlaceholder: "Title",
  noteContentPlaceholder: "Start writing",
  noteCancelEdit: "Cancel",
  saveNote: "Save",
  noteEdit: "Edit",
  deleteNote: "Delete",
  ...over,
});

describe("NotesPanel po angielsku", () => {
  it("filtr, pusty stan, metadane, licznik słów i daty", async () => {
    await act(async () => {
      await setLanguage("en");
    });
    const created = new Date("2026-03-02T14:30:00.000Z");
    const noteA = props().notes[0];
    const { rerender, container } = render(<NotesPanel {...props()} />);

    expect(screen.getByLabelText("Filter notes")).toBeInTheDocument();
    expect(screen.getByText("Select a note")).toBeInTheDocument();
    expect(container.textContent).toContain(formatShortDate(new Date(noteA.created_at), "en"));

    rerender(
      <NotesPanel
        {...props({
          selectedNote: { ...noteA, created_at: created.toISOString() },
        })}
      />
    );

    expect(screen.getByText("Created")).toBeInTheDocument();
    expect(screen.getByText("Size")).toBeInTheDocument();
    expect(
      screen.getByText(`(${countWords("one two")} words)`, { exact: false })
    ).toBeInTheDocument();
    expect(screen.getByText(formatShortDateTime(created, "en"))).toBeInTheDocument();

    rerender(
      <NotesPanel
        {...props({
          selectedNote: props().notes[1],
        })}
      />
    );
    expect(
      screen.getByText(`(${countWords("single")} word)`, { exact: false })
    ).toBeInTheDocument();
  });
});
