import { describe, expect, it } from "vitest";
import type { MindMapNode } from "@/src/features/mind-maps/mindMapTypes";
import {
  initialAutosave,
  markDirty,
  settleSave,
  takeForSave,
} from "@/src/features/mind-maps/mindMapAutosave";

function payload(label: string) {
  const root: MindMapNode = {
    id: "root",
    label,
    note: "",
    collapsed: false,
    children: [],
  };
  return { mapId: "map-1", rootNode: root, colWidths: { 0: 150 }, title: label };
}

describe("mindMapAutosave", () => {
  it("queues a pending save without pretending it already succeeded", () => {
    const dirty = markDirty(initialAutosave(), payload("A"));
    expect(dirty.phase).toBe("pending");
    expect(dirty.pending?.title).toBe("A");
    expect(dirty.lastSavedAt).toBeNull();
  });

  it("moves the pending payload into the in-flight save", () => {
    const dirty = markDirty(initialAutosave(), payload("A"));
    const taken = takeForSave(dirty);
    expect(taken.payload?.title).toBe("A");
    expect(taken.state.pending).toBeNull();
    expect(taken.state.inFlight?.title).toBe("A");
    expect(taken.state.phase).toBe("saving");
  });

  it("does not start a second save while one is in flight", () => {
    const dirty = markDirty(initialAutosave(), payload("A"));
    const first = takeForSave(dirty);
    const during = markDirty(first.state, payload("B"));
    const second = takeForSave(during);
    expect(second.payload).toBeNull();
    expect(second.state.pending?.title).toBe("B");
    expect(second.state.inFlight?.title).toBe("A");
  });

  it("records success only for the payload that finished and keeps a newer edit pending", () => {
    const first = takeForSave(markDirty(initialAutosave(), payload("A")));
    const withNewer = markDirty(first.state, payload("B"));
    const saved = settleSave(withNewer, first.payload!, { ok: true, at: 50 });
    expect(saved.phase).toBe("pending");
    expect(saved.pending?.title).toBe("B");
    expect(saved.lastSavedAt).toBe(50);
    expect(saved.inFlight).toBeNull();
  });

  it("keeps the failed payload so it can be sent again and does not mark it saved", () => {
    const taken = takeForSave(markDirty(initialAutosave(), payload("A")));
    const failed = settleSave(taken.state, taken.payload!, { ok: false, at: 50 });
    expect(failed.phase).toBe("error");
    expect(failed.lastSavedAt).toBeNull();
    expect(failed.pending?.title).toBe("A");
    const retry = takeForSave(failed);
    expect(retry.payload?.title).toBe("A");
  });
});
