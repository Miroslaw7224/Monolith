import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/dynamic", () => ({ default: () => () => null }));

import { NotesPanel, type NotesPanelProps } from "@/src/features/notes/NotesPanel";

afterEach(() => cleanup());

const json = (body: unknown, ok = true) =>
  ({ ok, status: ok ? 200 : 404, json: async () => body }) as Response;

const LIST = [
  { path: "Knowledge/a.md", area: "Knowledge", group: "", title: "Alfa NEXUS", tags: ["db"] },
  { path: "Knowledge/b.md", area: "Knowledge", group: "", title: "Beta NEXUS", tags: [] },
];
const DOCS: Record<string, unknown> = {
  "Knowledge/a.md": {
    ...LIST[0],
    frontmatter: [{ key: "tags", value: "[db]" }],
    body: "Zobacz [[Knowledge/b]] oraz [[Nieznany]].",
  },
  "Knowledge/b.md": { ...LIST[1], frontmatter: [], body: "Treść B" },
};

const apiFetch = vi.fn(async (url: string) => {
  if (url === "/api/nexus-docs") return json(LIST);
  const doc = DOCS[url.replace("/api/nexus-docs/", "")];
  return doc ? json(doc) : json({ error: "nie ma" }, false);
});

const note = {
  id: "n1",
  title: "Moja notatka",
  content: "treść",
  created_at: "2026-03-02T10:00:00.000Z",
};

const props = (over: Partial<NotesPanelProps> = {}): NotesPanelProps => ({
  notes: [note],
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
  apiFetch,
  ...over,
});

beforeEach(() => {
  apiFetch.mockClear();
});

/** Emuluje rodzica (PlanowanieView): trzyma wybraną notatkę w stanie. */
function Parent({ initial, spy }: { initial: typeof note | null; spy: NotesPanelProps }) {
  const [selected, setSelected] = React.useState<typeof note | null>(initial);
  return (
    <NotesPanel
      {...spy}
      selectedNote={selected}
      setSelectedNote={(n) => {
        spy.setSelectedNote(n);
        setSelected(n as typeof note | null);
      }}
    />
  );
}

async function openDoc(utils: ReturnType<typeof render>, title: string) {
  fireEvent.change(await utils.findByLabelText("Filtruj bazę NEXUS"), {
    target: { value: title },
  });
  fireEvent.click(
    await utils.findByText(new RegExp(title), { selector: ".not-nexus .not-file__name" })
  );
}

describe("NotesPanel: baza wiedzy NEXUS", () => {
  it("bez apiFetch sekcji NEXUS nie ma", () => {
    const { queryByLabelText } = render(<NotesPanel {...props({ apiFetch: undefined })} />);
    expect(queryByLabelText("Baza wiedzy NEXUS")).toBeNull();
  });

  it("pokazuje sekcję NEXUS obok sekcji Notatki", async () => {
    const utils = render(<NotesPanel {...props()} />);
    expect(await utils.findByLabelText("Baza wiedzy NEXUS")).toBeTruthy();
    await waitFor(() =>
      expect(utils.container.querySelector(".not-nexus .not-chip")?.textContent).toBe("2")
    );
    expect(utils.getByLabelText("Filtruj notatki")).toBeTruthy();
  });

  it("wybór dokumentu NEXUS: odczyt, brak edycji, zapisu i usuwania, setSelectedNote(null)", async () => {
    const p = props();
    const utils = render(<Parent initial={note} spy={p} />);
    await openDoc(utils, "Alfa");
    expect(await utils.findByTestId("nexus-readonly-badge")).toBeTruthy();
    expect(p.setSelectedNote).toHaveBeenCalledWith(null);
    expect(p.setNoteEditMode).toHaveBeenCalledWith(false);
    expect(utils.queryByRole("tab", { name: "Edycja" })).toBeNull();
    expect(utils.queryByRole("tab", { name: "Split" })).toBeNull();
    expect(utils.queryByRole("button", { name: /Zapisz/ })).toBeNull();
    expect(utils.queryByRole("button", { name: "Usuń" })).toBeNull();
    expect(utils.queryByRole("button", { name: "Edytuj" })).toBeNull();
    await waitFor(() =>
      expect(utils.container.querySelector(".not-frontmatter")?.textContent).toContain("tags: [db]")
    );
  });

  it("kolumna metadanych pokazuje ścieżkę i tagi dokumentu NEXUS", async () => {
    const utils = render(<NotesPanel {...props()} />);
    await openDoc(utils, "Alfa");
    await utils.findByTestId("nexus-readonly-badge");
    const kv = utils.container.querySelector(".not-kv")?.textContent ?? "";
    expect(kv).toContain("Knowledge/a.md");
    expect(kv).toContain("#db");
  });

  it("klik w znany wikilink przełącza dokument, nieznany jest wyszarzony", async () => {
    const utils = render(<NotesPanel {...props()} />);
    await openDoc(utils, "Alfa");
    const link = await waitFor(() => {
      const el = utils.container.querySelector('a[data-nexus-path="Knowledge/b.md"]');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    expect(utils.container.querySelector(".not-wikilink--missing")?.textContent).toBe("Nieznany");
    fireEvent.click(link);
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith("/api/nexus-docs/Knowledge/b.md"));
    expect(await utils.findByText("Treść B")).toBeTruthy();
  });

  it("wybór notatki zeruje wybór NEXUS", async () => {
    const p = props();
    const utils = render(<NotesPanel {...p} />);
    await openDoc(utils, "Alfa");
    await utils.findByTestId("nexus-readonly-badge");
    fireEvent.click(utils.getByText("Moja notatka", { selector: ".not-file__name" }));
    expect(p.setSelectedNote).toHaveBeenLastCalledWith(note);
    expect(utils.queryByTestId("nexus-readonly-badge")).toBeNull();
  });

  it("„Nowa notatka” zeruje wybór NEXUS", async () => {
    const utils = render(<NotesPanel {...props()} />);
    await openDoc(utils, "Alfa");
    await utils.findByTestId("nexus-readonly-badge");
    fireEvent.click(utils.getByRole("button", { name: /Nowa notatka/ }));
    expect(utils.queryByTestId("nexus-readonly-badge")).toBeNull();
  });
});
