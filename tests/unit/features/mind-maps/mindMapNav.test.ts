import { describe, expect, it } from "vitest";
import type { MindMapNode } from "@/src/features/mind-maps/mindMapTypes";
import { arrowAction, findLabelMatches, revealMatches } from "@/src/features/mind-maps/mindMapNav";
import { insertSiblingAfter, moveSibling } from "@/src/lib/mindMapUtils";

function node(id: string, children: MindMapNode[] = [], extra?: Partial<MindMapNode>): MindMapNode {
  return { id, label: id, note: "", collapsed: false, children, ...extra };
}

const tree = node("root", [node("a", [node("a1")], { collapsed: true }), node("b", [node("b1")])]);

describe("mind map keyboard navigation", () => {
  it("moves down through visible nodes and skips children of a collapsed branch", () => {
    expect(arrowAction(tree, "root", "ArrowDown")).toEqual({ type: "select", id: "a" });
    expect(arrowAction(tree, "a", "ArrowDown")).toEqual({ type: "select", id: "b" });
  });

  it("expands a collapsed node on ArrowRight before entering it", () => {
    expect(arrowAction(tree, "a", "ArrowRight")).toEqual({ type: "expand", id: "a" });
    const open = node("root", [node("a", [node("a1")]), node("b")]);
    expect(arrowAction(open, "a", "ArrowRight")).toEqual({ type: "select", id: "a1" });
  });

  it("collapses an open branch on ArrowLeft, otherwise selects the parent", () => {
    expect(arrowAction(tree, "b", "ArrowLeft")).toEqual({ type: "collapse", id: "b" });
    expect(arrowAction(tree, "b1", "ArrowLeft")).toEqual({ type: "select", id: "b" });
  });

  it("finds labels and opens only the ancestors of a match", () => {
    expect(findLabelMatches(tree, "B1")).toEqual(["b1"]);
    const revealed = revealMatches(tree, new Set(["a1"]));
    expect(revealed.children[0]?.collapsed).toBe(false);
    expect(revealed.children[1]).toBe(tree.children[1]);
  });
});

describe("sibling edits", () => {
  it("inserts a sibling after the selected node", () => {
    const created = node("c");
    const next = insertSiblingAfter(tree, "a", created);
    expect(next.children.map((child) => child.id)).toEqual(["a", "c", "b"]);
  });

  it("swaps a node with its sibling and ignores the ends of the list", () => {
    const moved = moveSibling(tree, "b", -1);
    expect(moved.children.map((child) => child.id)).toEqual(["b", "a"]);
    expect(moveSibling(moved, "b", -1)).toBe(moved);
  });
});
