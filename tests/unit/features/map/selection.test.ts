import { describe, expect, it } from "vitest";
import { noteNeighbors } from "@/src/features/map/selection";

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
