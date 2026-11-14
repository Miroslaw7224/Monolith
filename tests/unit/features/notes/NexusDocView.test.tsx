import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NexusDocView } from "@/src/features/notes/NexusDocView";

afterEach(() => cleanup());

const json = (body: unknown, ok = true) =>
  ({ ok, status: ok ? 200 : 404, json: async () => body }) as Response;

const docs = [
  { path: "Knowledge/a.md", area: "Knowledge" as const, group: "", title: "A", tags: [] },
  { path: "Knowledge/b.md", area: "Knowledge" as const, group: "", title: "B", tags: [] },
];

const DOC = {
  ...docs[0],
  frontmatter: [
    { key: "title", value: "A" },
    { key: "tags", value: "[x, y]" },
  ],
  body: "Zobacz [[Knowledge/b]] i [[Nieznany]] oraz **gruby**.",
};

describe("NexusDocView", () => {
  it("pokazuje plakietkę tylko do odczytu i jedną zakładkę Podgląd", async () => {
    const apiFetch = vi.fn(async () => json(DOC));
    const { findByText, getAllByRole, getByTestId } = render(
      <NexusDocView apiFetch={apiFetch} path="Knowledge/a.md" docs={docs} onNavigate={vi.fn()} />
    );
    await findByText("A", { selector: "h1" });
    expect(getByTestId("nexus-readonly-badge").textContent).toBe("tylko odczyt");
    expect(getAllByRole("tab").map((t) => t.textContent)).toEqual(["Podgląd"]);
  });

  it("renderuje kartę frontmattera i Markdown", async () => {
    const apiFetch = vi.fn(async () => json(DOC));
    const { container, findByText } = render(
      <NexusDocView apiFetch={apiFetch} path="Knowledge/a.md" docs={docs} onNavigate={vi.fn()} />
    );
    await findByText("A", { selector: "h1" });
    expect(container.querySelector(".not-frontmatter")?.textContent).toContain("tags: [x, y]");
    expect(container.querySelector("strong")?.textContent).toBe("gruby");
  });

  it("znany wikilink prowadzi do dokumentu (onNavigate), nieznany jest wyszarzony", async () => {
    const onNavigate = vi.fn();
    const apiFetch = vi.fn(async () => json(DOC));
    const { container, findByText } = render(
      <NexusDocView apiFetch={apiFetch} path="Knowledge/a.md" docs={docs} onNavigate={onNavigate} />
    );
    await findByText("A", { selector: "h1" });
    fireEvent.click(container.querySelector('a[data-nexus-path="Knowledge/b.md"]') as HTMLElement);
    expect(onNavigate).toHaveBeenCalledWith("Knowledge/b.md");
    const missing = container.querySelector(".not-wikilink--missing");
    expect(missing?.textContent).toBe("Nieznany");
    expect(missing?.getAttribute("title")).toBe("poza bazą NEXUS w tym panelu");
    fireEvent.click(missing as HTMLElement);
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it("surowy HTML w treści jest escapowany", async () => {
    const apiFetch = vi.fn(async () =>
      json({ ...DOC, frontmatter: [], body: "<script>alert(1)</script>" })
    );
    const { container, findByText } = render(
      <NexusDocView apiFetch={apiFetch} path="Knowledge/a.md" docs={docs} onNavigate={vi.fn()} />
    );
    await findByText("A", { selector: "h1" });
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector(".not-frontmatter")).toBeNull();
  });

  it("błąd odczytu pokazuje komunikat", async () => {
    const apiFetch = vi.fn(async () => json({ error: "nie ma" }, false));
    const { findByText } = render(
      <NexusDocView apiFetch={apiFetch} path="Knowledge/a.md" docs={docs} onNavigate={vi.fn()} />
    );
    expect(await findByText("Dokument jest niedostępny")).toBeTruthy();
  });
});
