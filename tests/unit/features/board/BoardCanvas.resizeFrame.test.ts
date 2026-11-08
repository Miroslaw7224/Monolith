import { describe, expect, it } from "vitest";
import { resizeFrameBoard } from "@/src/features/board/BoardCanvas";
import type { Board } from "@/src/features/board/boardTypes";

describe("resizeFrameBoard", () => {
  it("resizes from the left without shifting member tile coordinates", () => {
    const board: Board = {
      frames: [{ id: "f1", title: "F", x: 100, y: 50, w: 400, h: 200 }],
      tiles: [{ id: "t1", title: "T", note: "", x: 120, y: 80, w: 100, h: 80, frame: "f1" }],
      edges: [],
    };
    const next = resizeFrameBoard(board, "f1", { x: 60, y: 50, w: 440, h: 200 });
    expect(next?.tiles[0].x).toBe(120);
    expect(next?.tiles[0].y).toBe(80);
    expect(next?.tiles[0].frame).toBe("f1");
    expect(next?.frames[0].x).toBe(60);
  });
});
