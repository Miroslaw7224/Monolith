import { describe, expect, it } from "vitest";
import type { MindMapNode } from "@/src/features/mind-maps/mindMapTypes";
import { ROW_H, GAP_H, nodeBoxHeight, subtreeHeight } from "@/src/features/mind-maps/mindMapLayout";

function node(id: string, label: string, children: MindMapNode[] = []): MindMapNode {
  return { id, label, note: "", collapsed: false, children };
}

describe("mindMapLayout", () => {
  it("keeps a short label on one row", () => {
    expect(nodeBoxHeight("Krótki", 150)).toBe(ROW_H);
  });

  it("grows the row for a label that wraps", () => {
    const long = "Bardzo długa nazwa węzła która nie mieści się w jednej linii mapy";
    expect(nodeBoxHeight(long, 150)).toBeGreaterThan(ROW_H);
  });

  it("stacks children and ignores them while the branch is collapsed", () => {
    const child = node("c", "Dziecko");
    const parent = node("p", "Rodzic", [child, child]);
    expect(subtreeHeight(parent, 0, () => 150)).toBe(ROW_H + GAP_H + ROW_H);
    expect(subtreeHeight({ ...parent, collapsed: true }, 0, () => 150)).toBe(ROW_H);
  });
});
