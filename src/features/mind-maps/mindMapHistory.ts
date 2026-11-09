import type { MindMapNode } from "@/src/features/mind-maps/mindMapTypes";

export const NOTE_COALESCE_MS = 1000;
export const HISTORY_LIMIT = 100;

type NoteCoalesce = { nodeId: string; startedAt: number };

export type MindMapHistory = {
  past: MindMapNode[];
  present: MindMapNode;
  future: MindMapNode[];
  noteCoalesce: NoteCoalesce | null;
};

export type TreeChange = { kind: "structure" } | { kind: "note"; nodeId: string; at: number };

export function createHistory(root: MindMapNode): MindMapHistory {
  return { past: [], present: root, future: [], noteCoalesce: null };
}

export function applyChange(
  history: MindMapHistory,
  next: MindMapNode,
  change: TreeChange
): MindMapHistory {
  if (next === history.present) return history;

  const coalesced =
    change.kind === "note" &&
    history.noteCoalesce?.nodeId === change.nodeId &&
    change.at - history.noteCoalesce.startedAt < NOTE_COALESCE_MS;

  if (coalesced) {
    return { ...history, present: next, future: [] };
  }

  const past = [...history.past, history.present];
  return {
    past: past.length > HISTORY_LIMIT ? past.slice(past.length - HISTORY_LIMIT) : past,
    present: next,
    future: [],
    noteCoalesce: change.kind === "note" ? { nodeId: change.nodeId, startedAt: change.at } : null,
  };
}

export function undo(history: MindMapHistory): MindMapHistory {
  if (history.past.length === 0) return history;
  const previous = history.past[history.past.length - 1];
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
    noteCoalesce: null,
  };
}

export function redo(history: MindMapHistory): MindMapHistory {
  if (history.future.length === 0) return history;
  const [next, ...rest] = history.future;
  return {
    past: [...history.past, history.present],
    present: next,
    future: rest,
    noteCoalesce: null,
  };
}
