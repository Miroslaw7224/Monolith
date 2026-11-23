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
    expect(dirty).toEqual({
      phase: "pending",
      pending: payload("A"),
      inFlight: null,
      lastSavedAt: null,
    });
  });

  it("moves the pending payload into the in-flight save", () => {
    const dirty = markDirty(initialAutosave(), payload("A"));
    const taken = takeForSave(dirty);
    expect(taken).toEqual({
      payload: payload("A"),
      state: { phase: "saving", pending: null, inFlight: payload("A"), lastSavedAt: null },
    });
  });

  it("does not start a second save while one is in flight", () => {
    const dirty = markDirty(initialAutosave(), payload("A"));
    const first = takeForSave(dirty);
    const during = markDirty(first.state, payload("B"));
    const second = takeForSave(during);
    expect(second).toEqual({
      payload: null,
      state: { phase: "saving", pending: payload("B"), inFlight: payload("A"), lastSavedAt: null },
    });
  });

  it("records success only for the payload that finished and keeps a newer edit pending", () => {
    const first = takeForSave(markDirty(initialAutosave(), payload("A")));
    const withNewer = markDirty(first.state, payload("B"));
    const saved = settleSave(withNewer, first.payload!, { ok: true, at: 50 });
    expect(saved).toEqual({
      phase: "pending",
      pending: payload("B"),
      inFlight: null,
      lastSavedAt: 50,
    });
  });

  it("keeps the failed payload so it can be sent again and does not mark it saved", () => {
    const taken = takeForSave(markDirty(initialAutosave(), payload("A")));
    const failed = settleSave(taken.state, taken.payload!, { ok: false, at: 50 });
    expect(failed).toEqual({
      phase: "error",
      pending: payload("A"),
      inFlight: null,
      lastSavedAt: null,
    });
    const retry = takeForSave(failed);
    expect(retry.payload).toEqual(payload("A"));
  });
});
