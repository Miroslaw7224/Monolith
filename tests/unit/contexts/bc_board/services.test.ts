// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const repo = vi.hoisted(() => ({
  getBoard: vi.fn(),
  saveBoard: vi.fn(),
}));

vi.mock("@/contexts/bc_board/repositories", () => repo);

import { getBoard, saveBoard } from "@/contexts/bc_board/services";

const board = {
  tiles: [{ id: "t1", title: "A", note: "", x: 0, y: 0, w: 240, h: 120, frame: null }],
  frames: [],
  edges: [],
};

beforeEach(() => vi.clearAllMocks());

describe("bc_board services", () => {
  it("returns null when the repository has no board", async () => {
    repo.getBoard.mockResolvedValue(null);
    await expect(getBoard()).resolves.toBeNull();
  });

  it("returns the stored document untouched", async () => {
    const stored = { tiles: [{ id: "x" }], frames: [], edges: [] };
    repo.getBoard.mockResolvedValue(stored);
    await expect(getBoard()).resolves.toBe(stored);
  });

  it("passes the board to the repository and returns it", async () => {
    repo.saveBoard.mockResolvedValue(undefined);
    await expect(saveBoard(board)).resolves.toBe(board);
    expect(repo.saveBoard).toHaveBeenCalledTimes(1);
    expect(repo.saveBoard).toHaveBeenCalledWith(board);
  });

  it("does not return the board when the repository fails", async () => {
    repo.saveBoard.mockRejectedValue(new Error("disk"));
    await expect(saveBoard(board)).rejects.toThrow("disk");
  });
});
