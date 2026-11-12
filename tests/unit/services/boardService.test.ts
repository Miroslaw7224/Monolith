import { describe, it, expect, vi } from "vitest";
import { DomainError } from "../../../lib/errors.js";

const repo = vi.hoisted(() => ({
  getBoard: vi.fn(),
  saveBoard: vi.fn(),
}));

vi.mock("../../../lib/firestore-db.js", () => repo);

import { getBoard, saveBoard } from "../../../services/boardService.js";

type Stored = { tiles: unknown; frames: unknown; edges: unknown };

function setupRepo() {
  let stored: Stored | null = null;
  repo.getBoard.mockImplementation(async () => stored);
  repo.saveBoard.mockImplementation(async (_userId: string, board: Stored) => {
    stored = { tiles: board.tiles, frames: board.frames, edges: board.edges };
  });
}

describe("boardService", () => {
  it("returns three empty lists when the document is missing", async () => {
    setupRepo();
    await expect(getBoard("u1")).resolves.toEqual({ tiles: [], frames: [], edges: [] });
  });

  it("reads back a saved board", async () => {
    setupRepo();
    const saved = await saveBoard("u1", {
      tiles: [{ id: "t1", title: "A", note: "", x: 0, y: 0, w: 240, h: 120, frame: null }],
      frames: [],
      edges: [],
    });
    expect(saved.tiles[0].title).toBe("A");
    const loaded = await getBoard("u1");
    expect(loaded.tiles[0].id).toBe("t1");
  });

  it("passes the parsed board to the repository", async () => {
    setupRepo();
    await saveBoard("u1", {
      tiles: [{ id: "t1", title: "A", note: "", x: 0, y: 0, w: 240, h: 120, frame: null }],
      frames: [],
      edges: [],
    });
    expect(repo.saveBoard).toHaveBeenCalledTimes(1);
    const [userId, board] = repo.saveBoard.mock.calls[0];
    expect(userId).toBe("u1");
    expect(board.tiles[0].id).toBe("t1");
    expect(board.frames).toEqual([]);
    expect(board.edges).toEqual([]);
  });

  it("rejects an unknown frame and does not call the repository", async () => {
    setupRepo();
    await expect(
      saveBoard("u1", {
        tiles: [{ id: "t1", title: "A", note: "", x: 0, y: 0, w: 240, h: 120, frame: "nope" }],
        frames: [],
        edges: [],
      })
    ).rejects.toThrow(DomainError);
    expect(repo.saveBoard).not.toHaveBeenCalled();
  });
});
