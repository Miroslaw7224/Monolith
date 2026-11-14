import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NexusDocsSection } from "@/src/features/notes/NexusDocsSection";

afterEach(() => cleanup());

const docs = [
  {
    path: "Knowledge/alembic.md",
    area: "Knowledge" as const,
    group: "",
    title: "Alembic",
    tags: ["db"],
  },
  {
    path: "Knowledge/ai/foo.md",
    area: "Knowledge" as const,
    group: "ai",
    title: "Foo",
    tags: ["db", "ai"],
  },
  {
    path: "Projects/p/decyzja.md",
    area: "Projects" as const,
    group: "p",
    title: "Decyzja",
    tags: [],
  },
];

const names = (c: HTMLElement) =>
  [...c.querySelectorAll(".not-nexus .not-file__name")].map((n) => n.textContent);

function setup(over: Partial<React.ComponentProps<typeof NexusDocsSection>> = {}) {
  const onSelect = vi.fn();
  const utils = render(
    <NexusDocsSection docs={docs} error={null} selectedPath={null} onSelect={onSelect} {...over} />
  );
  return { onSelect, ...utils };
}

describe("NexusDocsSection", () => {
  it("pokazuje nagłówek z plakietką tylko do odczytu i liczbę dokumentów", () => {
    const { container, getByLabelText } = setup();
    expect(getByLabelText("Baza wiedzy NEXUS")).toBeTruthy();
    expect(container.querySelector(".not-nexus .not-sidebar__title")?.textContent).toContain(
      "tylko odczyt"
    );
    expect(container.querySelector(".not-nexus .not-chip")?.textContent).toBe("3");
  });

  it("foldery są domyślnie zwinięte; klik w nagłówek je rozwija", () => {
    const { container, getByText } = setup();
    expect(names(container)).toEqual([]);
    fireEvent.click(getByText(/Knowledge\/ai\//));
    expect(names(container)).toEqual(["Foo"]);
  });

  it("wyszukiwanie rozwija foldery i filtruje po tytule", () => {
    const { container, getByLabelText } = setup();
    fireEvent.change(getByLabelText("Filtruj bazę NEXUS"), { target: { value: "alem" } });
    expect(names(container)).toEqual(["Alembic"]);
  });

  it("tag filtruje dokumenty i działa jak przełącznik", () => {
    const { container, getByText } = setup();
    fireEvent.click(getByText("#ai"));
    expect(names(container)).toEqual(["Foo"]);
    fireEvent.click(getByText("#ai"));
    expect(names(container)).toEqual([]);
  });

  it("klik w dokument woła onSelect ze ścieżką i oznacza aktywny", () => {
    const { container, getByLabelText, onSelect, rerender } = setup();
    fireEvent.change(getByLabelText("Filtruj bazę NEXUS"), { target: { value: "alem" } });
    fireEvent.click(container.querySelector(".not-nexus .not-file") as HTMLElement);
    expect(onSelect).toHaveBeenCalledWith("Knowledge/alembic.md");
    rerender(
      <NexusDocsSection
        docs={docs}
        error={null}
        selectedPath="Knowledge/alembic.md"
        onSelect={onSelect}
      />
    );
    expect(container.querySelector(".not-nexus .not-file--active")).not.toBeNull();
  });

  it("zaznaczony dokument rozwija swój folder", () => {
    const { container } = setup({ selectedPath: "Knowledge/ai/foo.md" });
    expect(names(container)).toEqual(["Foo"]);
  });

  it("stany: błąd, pusta baza, brak wyników", () => {
    const err = setup({ error: "Nie udało się wczytać bazy NEXUS" });
    expect(err.container.textContent).toContain("Nie udało się wczytać bazy NEXUS");
    cleanup();
    const empty = setup({ docs: [] });
    expect(empty.container.textContent).toContain("Brak dokumentów NEXUS");
    cleanup();
    const none = setup();
    fireEvent.change(none.getByLabelText("Filtruj bazę NEXUS"), { target: { value: "zzz" } });
    expect(none.container.textContent).toContain("Brak wyników");
  });
});
