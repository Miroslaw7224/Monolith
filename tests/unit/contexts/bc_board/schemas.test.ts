// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  BoardBodySchema,
  EMPTY_BOARD,
  normalizeBoard,
  parseBoard,
  toBoardDto,
} from "@/contexts/bc_board/schemas";

const tile = {
  id: "t1",
  title: "  Kafelek  ",
  note: "",
  x: 0,
  y: 0,
  w: 160,
  h: 72,
  frame: null,
};

function failure(input: unknown): string {
  const result = parseBoard(input);
  if (result.success === true) throw new Error("expected a failed parse");
  return result.message;
}

describe("parseBoard", () => {
  it("trims a tile title and accepts an empty note", () => {
    const result = parseBoard({ tiles: [tile], frames: [], edges: [] });
    if (result.success === false) throw new Error(result.message);
    expect(result.board.tiles[0].title).toBe("Kafelek");
  });

  it("rejects an unknown frame, a small tile, and a bad arrow", () => {
    expect(failure({ tiles: [{ ...tile, frame: "missing" }], frames: [], edges: [] })).toBe(
      "Unknown frame"
    );
    expect(failure({ tiles: [{ ...tile, w: 159 }], frames: [], edges: [] })).toBe(
      "Tile or frame is too small"
    );
    const emptyId = failure({ tiles: [{ ...tile, id: "" }], frames: [], edges: [] });
    expect(emptyId).not.toMatch(/too small/);
    expect(
      failure({
        tiles: [tile],
        frames: [],
        edges: [{ id: "e", source: "t1", target: "t1" }],
      })
    ).toMatch(/two different tiles/);
  });

  it("rejects a duplicate id", () => {
    expect(
      failure({
        tiles: [tile],
        frames: [],
        edges: [{ id: "t1", source: "t1", target: "t1" }],
      })
    ).toMatch(/Duplicate id/);
  });

  it("rejects a blank frame title", () => {
    const message = failure({
      tiles: [],
      frames: [{ id: "f", title: "   ", x: 0, y: 0, w: 200, h: 120 }],
      edges: [],
    });
    expect(message).not.toMatch(/too small/);
  });

  it("rejects data that is not a board", () => {
    expect(parseBoard({ tiles: "x", frames: [], edges: [] }).success).toBe(false);
    expect(parseBoard({ tiles: undefined, frames: undefined, edges: undefined }).success).toBe(
      false
    );
  });
});

describe("normalizeBoard", () => {
  it("trims tile titles and keeps frames and edges as they are", () => {
    const body = BoardBodySchema.parse({
      tiles: [tile],
      frames: [{ id: "f1", title: "Rama", x: 0, y: 0, w: 200, h: 120 }],
      edges: [],
    });
    const board = normalizeBoard(body);
    expect(board.tiles[0].title).toBe("Kafelek");
    expect(board.tiles[0].frame).toBeNull();
    expect(board.frames).toEqual([{ id: "f1", title: "Rama", x: 0, y: 0, w: 200, h: 120 }]);
    expect(board.edges).toEqual([]);
  });
});

describe("toBoardDto / EMPTY_BOARD", () => {
  it("copies tiles, frames and edges", () => {
    const board = { tiles: [{ ...tile, title: "Kafelek" }], frames: [], edges: [] };
    expect(toBoardDto(board)).toEqual(board);
  });

  it("has three empty lists", () => {
    expect(EMPTY_BOARD).toEqual({ tiles: [], frames: [], edges: [] });
  });
});
