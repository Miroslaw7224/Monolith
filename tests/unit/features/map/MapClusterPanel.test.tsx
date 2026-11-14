import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MapClusterPanel } from "@/src/features/map/MapClusterPanel";

afterEach(() => cleanup());

const clusters = [
  { id: "knowledge:tools", label: "tools", group: "knowledge" as const, size: 2 },
  { id: "skille", label: "Skille", group: "skills" as const, size: 0, soon: true },
];
const nodes = [
  { id: "Knowledge/a", label: "Alfa", cluster: "knowledge:tools", links: 5 },
  { id: "Knowledge/b", label: "Beta", cluster: "knowledge:tools", links: 1 },
];
const edges = [{ from: "Knowledge/a", to: "Knowledge/b", weight: 2, type: "link" as const }];
const base = { clusters, nodes, edges };

describe("MapClusterPanel", () => {
  it("bez zaznaczenia podpowiada, co zrobić", () => {
    render(<MapClusterPanel {...base} selection={null} onSelect={() => {}} />);
    expect(screen.getByText(/Wybierz skupisko/)).toBeInTheDocument();
  });

  it("skupisko: lista notatek od najbardziej powiązanej, klik zaznacza notatkę", async () => {
    const onSelect = vi.fn();
    render(
      <MapClusterPanel
        {...base}
        selection={{ kind: "cluster", id: "knowledge:tools" }}
        onSelect={onSelect}
      />
    );
    expect(screen.getByRole("heading", { name: "tools" })).toBeInTheDocument();
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(["Alfa", "Beta"]);
    await userEvent.setup().click(buttons[1]);
    expect(onSelect).toHaveBeenCalledWith({ kind: "note", id: "Knowledge/b" });
  });

  it("notatka: skupisko, powiązania i sąsiedzi", async () => {
    const onSelect = vi.fn();
    render(
      <MapClusterPanel
        {...base}
        selection={{ kind: "note", id: "Knowledge/a" }}
        onSelect={onSelect}
      />
    );
    expect(screen.getByText(/Skupisko: tools/)).toBeInTheDocument();
    expect(screen.getByText(/Powiązania: 5/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: /Beta/ }));
    expect(onSelect).toHaveBeenCalledWith({ kind: "note", id: "Knowledge/b" });
  });

  it("Skille: informacja „wkrótce” bez listy notatek", () => {
    render(
      <MapClusterPanel
        {...base}
        selection={{ kind: "cluster", id: "skille" }}
        onSelect={() => {}}
      />
    );
    expect(screen.getByText(/wkrótce/)).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
