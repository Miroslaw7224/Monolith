import { describe, expect, it } from "vitest";
import { noteNeighbors, selectionHighlight } from "@/src/features/map/selection";

const nodes = ["a", "b", "c", "d"].map((id) => ({
  id,
  label: id.toUpperCase(),
  cluster: "k",
  links: 0,
}));

describe("noteNeighbors", () => {
  it("zbiera sąsiadów w obie strony, sortuje po wadze, ignoruje krawędzie project", () => {
    const edges = [
      { from: "a", to: "b", weight: 2, type: "link" as const },
      { from: "c", to: "a", weight: 5, type: "link" as const },
      { from: "a", to: "k", weight: 1, type: "project" as const },
      { from: "b", to: "d", weight: 1, type: "link" as const },
    ];
    expect(noteNeighbors("a", nodes, edges)).toEqual([
      { id: "c", label: "C", weight: 5 },
      { id: "b", label: "B", weight: 2 },
    ]);
  });
});

describe("selectionHighlight", () => {
  const hn = [
    { id: "a", label: "A", cluster: "k", links: 0 },
    { id: "b", label: "B", cluster: "k", links: 0 },
    { id: "c", label: "C", cluster: "z", links: 0 },
  ];
  const he = [
    { from: "b", to: "c", weight: 1, type: "link" as const },
    { from: "a", to: "b", weight: 1, type: "link" as const },
    { from: "c", to: "k", weight: 1, type: "project" as const },
    { from: "a", to: "z", weight: 1, type: "project" as const },
  ];
  it("brak zaznaczenia: nic do rysowania", () => {
    const h = selectionHighlight(null, hn, he);
    expect(h).toMatchObject({ clusterId: null, noteId: null, edges: [] });
    expect(h.lit.size).toBe(0);
  });
  it("skupisko: najpierw krawędzie wewnętrzne, potem pozostałe po from/to; limit obcina", () => {
    const h = selectionHighlight({ kind: "cluster", id: "k" }, hn, he);
    expect(h.clusterId).toBe("k");
    expect(h.edges.map((e) => `${e.from}>${e.to}`)).toEqual(["a>b", "a>z", "b>c", "c>k"]);
    const cut = selectionHighlight({ kind: "cluster", id: "k" }, hn, he, 2);
    expect(cut.edges).toHaveLength(2);
    expect([...cut.lit].sort()).toEqual(["a", "b"]);
  });
  it("notatka: tylko jej krawędzie, skupisko notatki i podświetlone końce", () => {
    const h = selectionHighlight({ kind: "note", id: "c" }, hn, he);
    expect(h.noteId).toBe("c");
    expect(h.clusterId).toBe("z");
    expect(h.edges.map((e) => `${e.from}>${e.to}`)).toEqual(["b>c", "c>k"]);
    expect([...h.lit].sort()).toEqual(["b", "c"]);
  });
});
