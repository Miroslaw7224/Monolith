import { describe, expect, it } from "vitest";
import type { MindMapNode } from "@/src/features/mind-maps/mindMapTypes";
import {
  HISTORY_LIMIT,
  NOTE_COALESCE_MS,
  applyChange,
  createHistory,
  redo,
  undo,
} from "@/src/features/mind-maps/mindMapHistory";

function node(id: string, extra?: Partial<MindMapNode>): MindMapNode {
  return {
    id,
    label: id,
    note: "",
    collapsed: false,
    children: [],
    ...extra,
  };
}

describe("mindMapHistory", () => {
  it("undo restores the previous root and redo returns to the edit", () => {
    const initial = node("root", { label: "Start" });
    const renamed = node("root", { label: "Po zmianie" });
    const after = applyChange(createHistory(initial), renamed, { kind: "structure" });

    const undone = undo(after);
    expect(undone.present).toBe(initial);
    expect(redo(undone).present).toBe(renamed);
  });

  it("a new edit drops the redo stack", () => {
    const initial = node("root");
    const first = node("root", { label: "A" });
    const second = node("root", { label: "B" });
    const undone = undo(applyChange(createHistory(initial), first, { kind: "structure" }));
    const branched = applyChange(undone, second, { kind: "structure" });

    expect(branched.future).toHaveLength(0);
    expect(undo(branched).present).toBe(initial);
  });

  it("coalesces note edits on the same node inside one second", () => {
    const initial = node("root", { note: "" });
    const at0 = applyChange(createHistory(initial), node("root", { note: "a" }), {
      kind: "note",
      nodeId: "root",
      at: 0,
    });
    const at500 = applyChange(at0, node("root", { note: "ab" }), {
      kind: "note",
      nodeId: "root",
      at: 500,
    });

    expect(at500.past).toHaveLength(1);
    expect(at500.past[0]).toBe(initial);
    expect(undo(at500).present).toBe(initial);
  });

  it("starts a new history step after the coalesce window or on another node", () => {
    const initial = node("root");
    const first = applyChange(createHistory(initial), node("root", { note: "a" }), {
      kind: "note",
      nodeId: "root",
      at: 0,
    });
    const later = applyChange(first, node("root", { note: "ab" }), {
      kind: "note",
      nodeId: "root",
      at: NOTE_COALESCE_MS,
    });
    const otherNode = applyChange(first, node("root", { note: "x" }), {
      kind: "note",
      nodeId: "child",
      at: 200,
    });

    expect(later.past).toHaveLength(2);
    expect(otherNode.past).toHaveLength(2);
  });

  it("a structure edit ends a note burst", () => {
    const initial = node("root");
    const noted = applyChange(createHistory(initial), node("root", { note: "a" }), {
      kind: "note",
      nodeId: "root",
      at: 0,
    });
    const structured = applyChange(noted, node("root", { label: "Inny" }), { kind: "structure" });
    const nextNote = applyChange(structured, node("root", { note: "b" }), {
      kind: "note",
      nodeId: "root",
      at: 100,
    });

    expect(nextNote.past).toHaveLength(3);
  });

  it("keeps at most HISTORY_LIMIT snapshots", () => {
    let history = createHistory(node("root", { label: "0" }));
    for (let i = 1; i <= HISTORY_LIMIT + 5; i++) {
      history = applyChange(history, node("root", { label: String(i) }), { kind: "structure" });
    }
    expect(history.past).toHaveLength(HISTORY_LIMIT);
    expect(history.past[0]?.label).toBe("5");
  });

  it("undo and redo on an empty stack return the same state", () => {
    const history = createHistory(node("root"));
    expect(undo(history)).toBe(history);
    expect(redo(history)).toBe(history);
  });
});
