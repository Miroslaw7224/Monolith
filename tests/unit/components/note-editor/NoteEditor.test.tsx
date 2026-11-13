import React from "react";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, afterEach } from "vitest";

// Mock @tiptap/core — must be before component import (hoisted by vitest)
vi.mock("@tiptap/core", () => {
  return {
    Extension: {
      create: (config: Record<string, unknown>) => ({ ...config }),
    },
  };
});

// Mock @tiptap/react — factory must be self-contained (no outer variable refs)
vi.mock("@tiptap/react", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const React = require("react");

  const run = () => true;
  const chainLink: Record<string, unknown> = {};
  const chainMethods = [
    "focus",
    "toggleBold",
    "toggleItalic",
    "toggleUnderline",
    "toggleStrike",
    "setTextAlign",
    "setFontSize",
    "unsetFontSize",
    "setFontFamily",
    "unsetFontFamily",
    "setColor",
    "unsetColor",
    "setMark",
    "removeEmptyTextStyle",
  ];
  chainMethods.forEach((m) => {
    chainLink[m] = () => ({ ...chainLink, run });
  });
  chainLink["run"] = run;

  const fakeEditor = {
    getHTML: () => "<p>Test</p>",
    getText: () => "Test",
    getAttributes: () => ({ fontSize: "", fontFamily: "", color: "" }),
    commands: { setContent: () => {}, focus: () => {} },
    isActive: () => false,
    isDestroyed: false,
    on: () => {},
    off: () => {},
    chain: () => chainLink,
  };

  return {
    useEditor: () => fakeEditor,
    EditorContent: ({ editor }: { editor: unknown }) =>
      React.createElement("div", { "data-testid": "tiptap-editor" }),
    BubbleMenu: ({ children }: { children: unknown }) => null,
    FloatingMenu: ({ children }: { children: unknown }) => null,
  };
});

// Mock all Tiptap extensions used by NoteEditor
vi.mock("@tiptap/starter-kit", () => ({ default: { configure: () => ({}) } }));
vi.mock("@tiptap/extension-underline", () => ({ default: {} }));
vi.mock("@tiptap/extension-text-align", () => ({
  default: { configure: () => ({}) },
  TextAlign: { configure: () => ({}) },
}));
vi.mock("@tiptap/extension-text-style", () => ({
  default: {},
  TextStyle: {},
}));
vi.mock("@tiptap/extension-color", () => ({
  default: {},
  Color: {},
}));
vi.mock("@tiptap/extension-font-family", () => ({
  default: { configure: () => ({}) },
  FontFamily: { configure: () => ({}) },
}));
vi.mock("@tiptap/pm/model", () => ({
  Fragment: { from: (x: unknown) => x, empty: null },
  Slice: { maxOpen: (x: unknown) => x },
}));

import { NoteEditor } from "@/src/components/note-editor/NoteEditor";

afterEach(() => cleanup());

describe("NoteEditor", () => {
  it("renders without crashing", () => {
    render(<NoteEditor content="<p>Hello</p>" onContentChange={vi.fn()} />);
    expect(screen.getByTestId("tiptap-editor")).toBeInTheDocument();
  });

  it("renders toolbar buttons", () => {
    render(<NoteEditor content="<p>Test</p>" onContentChange={vi.fn()} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("renders without content (empty string)", () => {
    render(<NoteEditor content="" onContentChange={vi.fn()} />);
    expect(screen.getByTestId("tiptap-editor")).toBeInTheDocument();
  });

  it("renders with variant=panel", () => {
    render(<NoteEditor content="<p>Panel</p>" onContentChange={vi.fn()} variant="panel" />);
    expect(screen.getByTestId("tiptap-editor")).toBeInTheDocument();
  });

  it("renders bold toolbar button", () => {
    render(<NoteEditor content="<p>Bold test</p>" onContentChange={vi.fn()} />);
    expect(screen.getByTitle("Pogrubienie")).toBeInTheDocument();
  });

  it("renders italic toolbar button", () => {
    render(<NoteEditor content="<p>Italic test</p>" onContentChange={vi.fn()} />);
    expect(screen.getByTitle("Kursywa")).toBeInTheDocument();
  });

  it("renders underline toolbar button", () => {
    render(<NoteEditor content="" onContentChange={vi.fn()} />);
    expect(screen.getByTitle("Podkreślenie")).toBeInTheDocument();
  });

  it("renders strikethrough toolbar button", () => {
    render(<NoteEditor content="" onContentChange={vi.fn()} />);
    expect(screen.getByTitle("Przekreślenie")).toBeInTheDocument();
  });

  it("renders text-align toolbar buttons", () => {
    render(<NoteEditor content="" onContentChange={vi.fn()} />);
    expect(screen.getByTitle("Wyrównaj do lewej")).toBeInTheDocument();
    expect(screen.getByTitle("Wyśrodkuj")).toBeInTheDocument();
    expect(screen.getByTitle("Wyrównaj do prawej")).toBeInTheDocument();
    expect(screen.getByTitle("Justowanie")).toBeInTheDocument();
  });

  it("renders font size select", () => {
    render(<NoteEditor content="" onContentChange={vi.fn()} />);
    expect(screen.getByTitle("Rozmiar czcionki")).toBeInTheDocument();
  });

  it("renders font family select", () => {
    render(<NoteEditor content="" onContentChange={vi.fn()} />);
    expect(screen.getByTitle("Czcionka")).toBeInTheDocument();
  });

  it("renders color picker button", () => {
    render(<NoteEditor content="" onContentChange={vi.fn()} />);
    expect(screen.getByTitle("Kolor tekstu")).toBeInTheDocument();
  });

  it("shows 'Kolor' label on color button when no color is set", () => {
    render(<NoteEditor content="" onContentChange={vi.fn()} />);
    expect(screen.getByText("Kolor")).toBeInTheDocument();
  });

  it("opens color dropdown on button click", () => {
    render(<NoteEditor content="" onContentChange={vi.fn()} />);
    const colorContainer = screen.getByTitle("Kolor tekstu");
    const toggleButton = colorContainer.querySelector("button")!;
    fireEvent.click(toggleButton);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByText("Domyślny")).toBeInTheDocument();
  });

  it("closes color dropdown after selecting a color", () => {
    render(<NoteEditor content="" onContentChange={vi.fn()} />);
    const colorContainer = screen.getByTitle("Kolor tekstu");
    const toggleButton = colorContainer.querySelector("button")!;
    fireEvent.click(toggleButton);
    const colorBtn = screen.getByText("#000000").closest("button")!;
    fireEvent.click(colorBtn);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("closes color dropdown after clicking 'Domyślny'", () => {
    render(<NoteEditor content="" onContentChange={vi.fn()} />);
    const colorContainer = screen.getByTitle("Kolor tekstu");
    const toggleButton = colorContainer.querySelector("button")!;
    fireEvent.click(toggleButton);
    fireEvent.click(screen.getByText("Domyślny"));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});

describe("NoteEditor format=markdown", () => {
  const renderMarkdown = () =>
    render(<NoteEditor content="**x**" onContentChange={vi.fn()} format="markdown" />);

  it("renders without crashing", () => {
    renderMarkdown();
    expect(screen.getByTestId("tiptap-editor")).toBeInTheDocument();
  });

  it("keeps bold, italic and strikethrough", () => {
    renderMarkdown();
    expect(screen.getByTitle("Pogrubienie")).toBeInTheDocument();
    expect(screen.getByTitle("Kursywa")).toBeInTheDocument();
    expect(screen.getByTitle("Przekreślenie")).toBeInTheDocument();
  });

  it("drops formatting that Markdown cannot represent", () => {
    renderMarkdown();
    for (const title of [
      "Podkreślenie",
      "Wyrównaj do lewej",
      "Wyśrodkuj",
      "Wyrównaj do prawej",
      "Justowanie",
      "Rozmiar czcionki",
      "Czcionka",
      "Kolor tekstu",
    ]) {
      expect(screen.queryByTitle(title), title).not.toBeInTheDocument();
    }
  });

  it("keeps the full toolbar in the default html mode", () => {
    render(<NoteEditor content="<p>x</p>" onContentChange={vi.fn()} />);
    expect(screen.getByTitle("Podkreślenie")).toBeInTheDocument();
    expect(screen.getByTitle("Kolor tekstu")).toBeInTheDocument();
    expect(screen.getByTitle("Rozmiar czcionki")).toBeInTheDocument();
  });
});
