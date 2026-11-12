import React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Widok odczytu nie montuje edytora; dynamiczny import zastępujemy pustym komponentem.
vi.mock("next/dynamic", () => ({ default: () => () => null }));

import { NotesPanel, type NotesPanelProps } from "@/src/features/notes/NotesPanel";

afterEach(() => cleanup());

const note = (content: string) => ({
  id: "n1",
  title: "T",
  content,
  created_at: "2026-03-02T10:00:00.000Z",
});

function renderPanel(content: string) {
  const props: NotesPanelProps = {
    notes: [note(content)],
    selectedNote: note(content),
    setSelectedNote: vi.fn(),
    noteEditMode: false,
    setNoteEditMode: vi.fn(),
    onSaveNote: vi.fn(async () => {}),
    onDeleteNote: vi.fn(),
    newNote: "Nowa notatka",
    noteTitlePlaceholder: "Tytuł",
    noteContentPlaceholder: "Zacznij pisać",
    noteCancelEdit: "Anuluj",
    saveNote: "Zapisz",
    noteEdit: "Edytuj",
    deleteNote: "Usuń",
  };
  return render(<NotesPanel {...props} />);
}

describe("NotesPanel read view renders Markdown", () => {
  it("renders inline Markdown as HTML", () => {
    const { container } = renderPanel("**gruby** tekst");
    expect(container.querySelector("strong")?.textContent).toBe("gruby");
  });

  it("escapes raw HTML instead of executing it", () => {
    const { container } = renderPanel("<script>alert(1)</script>");
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("<script>alert(1)</script>");
  });

  it("shows the placeholder for an empty note", () => {
    const { container } = renderPanel("");
    expect(container.textContent).toContain("Zacznij pisać");
  });
});
