import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
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

describe("NotesPanel layout wg makiety 05", () => {
  const baseProps = (over: Partial<NotesPanelProps> = {}): NotesPanelProps => ({
    notes: [
      {
        ...note("---\ntagi: [architektura, decyzje]\nstatus: ok\n---\nTreść **A**"),
        id: "a",
        title: "Alfa",
      },
      { ...note("Inna treść"), id: "b", title: "Beta" },
    ],
    selectedNote: null,
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
    ...over,
  });

  it("pokazuje cztery kafle statystyk z liczbą notatek i Inboxem", () => {
    const { container } = render(<NotesPanel {...baseProps({ inboxOpen: 5 })} />);
    const tiles = container.querySelectorAll(".not-tiles .tile");
    expect(tiles).toHaveLength(4);
    expect(tiles[0].textContent).toContain("2");
    expect(tiles[3].textContent).toContain("5");
  });

  it("filtr zawęża listę po tytule", () => {
    const { container, getByLabelText } = render(<NotesPanel {...baseProps()} />);
    fireEvent.change(getByLabelText("Filtruj notatki"), { target: { value: "beta" } });
    const names = [...container.querySelectorAll(".not-file__name")].map((n) => n.textContent);
    expect(names).toEqual(["Beta"]);
  });

  it("chip tagu filtruje notatki po tagu z frontmattera", () => {
    const { container, getByText } = render(<NotesPanel {...baseProps()} />);
    fireEvent.click(getByText("#architektura"));
    const names = [...container.querySelectorAll(".not-file__name")].map((n) => n.textContent);
    expect(names).toEqual(["Alfa"]);
  });

  it("pokazuje frontmatter, metadane i puste stany wkrótce dla wybranej notatki", () => {
    const props = baseProps();
    const { container } = render(<NotesPanel {...baseProps({ selectedNote: props.notes[0] })} />);
    expect(container.querySelector(".not-frontmatter")?.textContent).toContain("status: ok");
    expect(container.querySelector("strong")?.textContent).toBe("A");
    expect(container.querySelector(".not-kv")?.textContent).toContain("#architektura #decyzje");
    expect(container.textContent).toContain("Wkrótce: indeks linków");
  });

  it("Zapisz (Ctrl+S) jest nieaktywny w podglądzie i wywołuje zapis skrótem w edycji", () => {
    const onSaveNote = vi.fn(async () => {});
    const props = baseProps();
    const { getByRole, rerender } = render(
      <NotesPanel {...props} selectedNote={props.notes[1]} onSaveNote={onSaveNote} />
    );
    expect((getByRole("button", { name: /Zapisz/ }) as HTMLButtonElement).disabled).toBe(true);
    rerender(
      <NotesPanel {...props} selectedNote={props.notes[1]} noteEditMode onSaveNote={onSaveNote} />
    );
    expect((getByRole("button", { name: /Zapisz/ }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.keyDown(window, { key: "s", ctrlKey: true });
    expect(onSaveNote).toHaveBeenCalledTimes(1);
  });

  it("zakładka Split włącza edycję i podgląd obok siebie", () => {
    const setNoteEditMode = vi.fn();
    const props = baseProps();
    const { getByRole, container, rerender } = render(
      <NotesPanel {...props} selectedNote={props.notes[1]} setNoteEditMode={setNoteEditMode} />
    );
    fireEvent.click(getByRole("tab", { name: "Split" }));
    expect(setNoteEditMode).toHaveBeenCalledWith(true);
    rerender(
      <NotesPanel
        {...props}
        selectedNote={props.notes[1]}
        noteEditMode
        setNoteEditMode={setNoteEditMode}
      />
    );
    expect(container.querySelector(".not-sheet--split .not-prose")).not.toBeNull();
    expect(container.querySelector(".not-title-input")).not.toBeNull();
  });
});
