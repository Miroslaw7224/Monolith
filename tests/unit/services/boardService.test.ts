import { describe, it, expect, beforeEach, vi } from "vitest";
import { DomainError } from "../../../lib/errors.js";

const mockBoardDoc = vi.hoisted(() => vi.fn());

vi.mock("../../../lib/firestore-db.js", () => ({
  boardDoc: (...args: unknown[]) => mockBoardDoc(...args),
}));

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => ({ __sv: "ts" }) },
}));

import { getBoard, saveBoard } from "../../../services/boardService.js";

function setupDoc() {
  let stored: Record<string, unknown> | undefined;
  mockBoardDoc.mockReturnValue({
    async get() {
      if (!stored) return { exists: false, data: () => undefined };
      return { exists: true, data: () => stored };
    },
    async set(data: Record<string, unknown>) {
      stored = { ...data };
    },
  });
}

describe("boardService", () => {
  beforeEach(() => mockBoardDoc.mockReset());

  it("returns three empty lists when the document is missing", async () => {
    setupDoc();
    await expect(getBoard("u1")).resolves.toEqual({ tiles: [], frames: [], edges: [] });
  });

  it("reads back a saved board", async () => {
    setupDoc();
    const saved = await saveBoard("u1", {
      tiles: [{ id: "t1", title: "A", note: "", x: 0, y: 0, w: 240, h: 120, frame: null }],
      frames: [],
      edges: [],
    });
    expect(saved.tiles[0].title).toBe("A");
    const loaded = await getBoard("u1");
    expect(loaded.tiles[0].id).toBe("t1");
  });

  it("rejects an unknown frame", async () => {
    setupDoc();
    await expect(
      saveBoard("u1", {
        tiles: [{ id: "t1", title: "A", note: "", x: 0, y: 0, w: 240, h: 120, frame: "nope" }],
        frames: [],
        edges: [],
      })
    ).rejects.toThrow(DomainError);
  });
});
